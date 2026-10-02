import { PublicKey, Connection, SystemProgram, Transaction } from '@solana/web3.js';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import {
  enforcePayRateLimit,
  makePayRequestId,
  payFeatureEnabled,
  payJson,
  readJsonBody,
  supabaseRequest,
} from '../../../_shared/runtime';
import type { PaymentAsset, TokenProgram } from '../../../../../../src/pay/types/domain';

interface PayEnv {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  PAY_API_ENABLED?: string;
  SOLANA_RPC_URL?: string;
}

interface PaymentRow {
  id: string;
  merchant_id: string;
  amount_atomic: string;
  customer_total_atomic: string;
  merchant_settlement_atomic: string;
  fee_atomic: string;
  asset: PaymentAsset;
  token_mint: string | null;
  token_program: TokenProgram | null;
  token_decimals: number | null;
  recipient: string;
  fee_recipient: string;
  reference: string;
  status: string;
  expires_at: string;
  merchant_business_name: string;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);
}

function isBase58PublicKey(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < 32 || value.length > 44) return false;
  try { new PublicKey(value); return true; } catch { return false; }
}

function asBigInt(value: string): bigint {
  if (!/^\d+$/.test(value)) throw new Error('INVALID_ATOMIC_AMOUNT');
  return BigInt(value);
}

function asSafeSolLamports(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('SOL_AMOUNT_TOO_LARGE');
  return Number(value);
}

function bytesToBase64(value: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let offset = 0; offset < value.length; offset += chunk) {
    binary += String.fromCharCode(...value.subarray(offset, Math.min(offset + chunk, value.length)));
  }
  return btoa(binary);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function loadPayment(env: PayEnv, paymentId: string): Promise<PaymentRow | null> {
  const response = await supabaseRequest(
    env,
    `/rest/v1/pay_payment_intents?select=id,merchant_id,amount_atomic,customer_total_atomic,merchant_settlement_atomic,fee_atomic,asset,token_mint,token_program,token_decimals,recipient,fee_recipient,reference,status,expires_at,merchant:pay_merchants!inner(business_name)&id=eq.${encodeURIComponent(paymentId)}&limit=1`,
    { headers: { Accept: 'application/json' } },
  );
  const rows = await response.json() as Array<Omit<PaymentRow, 'merchant_business_name'> & { merchant?: { business_name?: string } }>;
  const row = rows[0];
  if (!row || !row.merchant?.business_name) return null;
  return { ...row, merchant_business_name: row.merchant.business_name };
}

function validatePayment(row: PaymentRow): void {
  if (!['created', 'pending', 'detected', 'verifying'].includes(row.status)) throw new Error('PAYMENT_NOT_PAYABLE');
  if (Date.parse(row.expires_at) <= Date.now()) throw new Error('PAYMENT_EXPIRED');
  if (row.asset === 'SOL') {
    if (row.token_mint !== null || row.token_program !== null || row.token_decimals !== null) throw new Error('PAYMENT_TOKEN_FIELDS_INVALID');
  } else if (!row.token_mint || !row.token_program || row.token_decimals === null) {
    throw new Error('PAYMENT_TOKEN_FIELDS_INVALID');
  }
  const merchant = asBigInt(row.merchant_settlement_atomic);
  const fee = asBigInt(row.fee_atomic);
  const total = asBigInt(row.customer_total_atomic);
  if (merchant + fee !== total) throw new Error('PAYMENT_TOTAL_MISMATCH');
  if (merchant <= 0n) throw new Error('PAYMENT_AMOUNT_INVALID');
  if (!isBase58PublicKey(row.recipient) || !isBase58PublicKey(row.fee_recipient)) throw new Error('PAYMENT_RECIPIENT_INVALID');
  if (row.recipient === row.fee_recipient) throw new Error('PAYMENT_DESTINATION_COLLISION');
}

async function buildTransaction(row: PaymentRow, buyer: PublicKey, connection: Connection): Promise<string> {
  const transaction = new Transaction();
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = buyer;

  const merchantAmount = asBigInt(row.merchant_settlement_atomic);
  const feeAmount = asBigInt(row.fee_atomic);

  if (row.asset === 'SOL') {
    transaction.add(
      SystemProgram.transfer({ fromPubkey: buyer, toPubkey: new PublicKey(row.recipient), lamports: asSafeSolLamports(merchantAmount) }),
    );
    if (feeAmount > 0n) {
      transaction.add(
        SystemProgram.transfer({ fromPubkey: buyer, toPubkey: new PublicKey(row.fee_recipient), lamports: asSafeSolLamports(feeAmount) }),
      );
    }
  } else {
    const mint = new PublicKey(row.token_mint!);
    const programId = row.token_program === 'token-2022' ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
    const source = getAssociatedTokenAddressSync(mint, buyer, false, programId, ASSOCIATED_TOKEN_PROGRAM_ID);
    const merchantOwner = new PublicKey(row.recipient);
    const feeOwner = new PublicKey(row.fee_recipient);
    const merchantDestination = getAssociatedTokenAddressSync(mint, merchantOwner, false, programId, ASSOCIATED_TOKEN_PROGRAM_ID);
    const feeDestination = getAssociatedTokenAddressSync(mint, feeOwner, false, programId, ASSOCIATED_TOKEN_PROGRAM_ID);

    const sourceInfo = await connection.getAccountInfo(source, 'confirmed');
    if (!sourceInfo) throw new Error('CUSTOMER_TOKEN_ACCOUNT_NOT_FOUND');

    transaction.add(createAssociatedTokenAccountIdempotentInstruction(buyer, merchantDestination, merchantOwner, mint, programId, ASSOCIATED_TOKEN_PROGRAM_ID));
    if (feeAmount > 0n) {
      transaction.add(createAssociatedTokenAccountIdempotentInstruction(buyer, feeDestination, feeOwner, mint, programId, ASSOCIATED_TOKEN_PROGRAM_ID));
    }
    transaction.add(createTransferCheckedInstruction(source, mint, merchantDestination, buyer, merchantAmount, row.token_decimals!, [], programId));
    if (feeAmount > 0n) {
      transaction.add(createTransferCheckedInstruction(source, mint, feeDestination, buyer, feeAmount, row.token_decimals!, [], programId));
    }
  }

  const serialized = transaction.serialize({ requireAllSignatures: false, verifySignatures: false });
  return bytesToBase64(serialized);
}

export const onRequestGet = async ({ request, env, params }: { request: Request; env: PayEnv; params: { id?: string } }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);
  const paymentId = String(params?.id || '').trim();
  if (!isUuid(paymentId)) return payJson({ code: 'PAYMENT_INTENT_ID_INVALID', message: 'Payment Intent ID is invalid.' }, 400, requestId);

  try {
    const row = await loadPayment(env, paymentId);
    if (!row) return payJson({ code: 'PAYMENT_INTENT_NOT_FOUND', message: 'Payment Intent was not found.' }, 404, requestId);
    validatePayment(row);
    const origin = new URL(request.url).origin;
    return payJson({ label: `${row.merchant_business_name} · SolMint Pay`, icon: `${origin}/assets/solmint-mascot-solana-coin.webp` }, 200, requestId);
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : 'TRANSACTION_REQUEST_FAILED';
    const status = code === 'PAYMENT_EXPIRED' ? 410 : code === 'PAYMENT_NOT_PAYABLE' ? 409 : 422;
    return payJson({ code, message: code === 'PAYMENT_EXPIRED' ? 'Payment Intent has expired.' : 'Payment Intent is not available for payment.' }, status, requestId);
  }
};

export const onRequestPost = async ({ request, env, params }: { request: Request; env: PayEnv; params: { id?: string } }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);
  const paymentId = String(params?.id || '').trim();
  if (!isUuid(paymentId)) return payJson({ code: 'PAYMENT_INTENT_ID_INVALID', message: 'Payment Intent ID is invalid.' }, 400, requestId);

  try {
    const body = await readJsonBody(request);
    if (!isBase58PublicKey(body.account)) return payJson({ code: 'INVALID_ACCOUNT', message: 'A valid wallet account is required.' }, 400, requestId);
    const buyer = new PublicKey(body.account);
    const source = request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || 'anonymous';
    const rateSubject = await sha256Hex(`${paymentId}:${source}`);
    await enforcePayRateLimit(env, 'payment-intents:transaction-request', rateSubject, 30, 6);

    const row = await loadPayment(env, paymentId);
    if (!row) return payJson({ code: 'PAYMENT_INTENT_NOT_FOUND', message: 'Payment Intent was not found.' }, 404, requestId);
    validatePayment(row);
    if (!env.SOLANA_RPC_URL) return payJson({ code: 'SOLANA_RPC_MISCONFIGURED', message: 'Solana RPC is not configured.' }, 503, requestId);

    const connection = new Connection(env.SOLANA_RPC_URL, 'confirmed');
    const transaction = await buildTransaction(row, buyer, connection);
    const origin = new URL(request.url).origin;
    return payJson({
      transaction,
      message: `${row.merchant_business_name} payment · ${row.asset}`,
      redirect: `${origin}/pay/checkout/${encodeURIComponent(row.id)}?payment=return`,
    }, 200, requestId);
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : 'TRANSACTION_BUILD_FAILED';
    const known = new Set(['PAYMENT_EXPIRED', 'PAYMENT_NOT_PAYABLE', 'PAYMENT_TOTAL_MISMATCH', 'PAYMENT_AMOUNT_INVALID', 'PAYMENT_RECIPIENT_INVALID', 'PAYMENT_DESTINATION_COLLISION', 'CUSTOMER_TOKEN_ACCOUNT_NOT_FOUND', 'SOL_AMOUNT_TOO_LARGE']);
    const status = code === 'PAYMENT_EXPIRED' ? 410 : code === 'PAYMENT_NOT_PAYABLE' ? 409 : known.has(code) ? 422 : 502;
    console.error('Pay transaction request failed:', JSON.stringify({ requestId, paymentId, code }));
    return payJson({ code, message: code === 'CUSTOMER_TOKEN_ACCOUNT_NOT_FOUND' ? 'Your wallet does not have the required token account.' : 'Payment transaction could not be prepared.' }, status, requestId);
  }
};
