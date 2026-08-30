import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const providerFile = path.join(root, 'src/pay/services/solanaRpcProvider.ts');
const reconcileFile = path.join(root, 'functions/api/internal/pay/reconcile.ts');
const runtimeFile = path.join(root, 'functions/api/pay/_shared/runtime.ts');
const paymentIntentFile = path.join(root, 'functions/api/pay/v1/payment-intents.ts');

function replaceOnce(file, from, to, label) {
  const source = fs.readFileSync(file, 'utf8');
  if (!source.includes(from)) {
    if (source.includes(to)) return false;
    throw new Error(`Unable to locate ${label} in ${file}`);
  }
  fs.writeFileSync(file, source.replace(from, to), 'utf8');
  return true;
}

const providerMethod = String.raw`  async findTransactionsByReference(reference: string, commitment: SolanaCommitment, window?: { createdAt: string; expiresAt: string }): Promise<readonly ObservedPaymentTransaction[]> {
    if (!reference) return [];
    const windowStart = window ? Date.parse(window.createdAt) : Number.NEGATIVE_INFINITY;
    const windowEnd = window ? Date.parse(window.expiresAt) : Number.POSITIVE_INFINITY;
    if (window && (!Number.isFinite(windowStart) || !Number.isFinite(windowEnd) || windowEnd <= windowStart)) throw new Error('Invalid payment discovery window.');

    const results: ObservedPaymentTransaction[] = [];
    let before: string | undefined;

    for (let page = 0; page < 24; page += 1) {
      const params: Record<string, unknown> = { commitment: commitmentValue(commitment), limit: 1000 };
      if (before) params.before = before;
      const signatures = await rpc<Array<{ signature?: string; blockTime?: number | null }>>(this.rpcUrl, 'getSignaturesForAddress', [reference, params]);
      if (!Array.isArray(signatures) || signatures.length === 0) return results;

      let reachedStart = false;
      for (const item of signatures) {
        if (!item?.signature) continue;
        const timestamp = typeof item.blockTime === 'number' ? item.blockTime * 1000 : null;
        if (timestamp !== null && timestamp < windowStart) {
          reachedStart = true;
          break;
        }
        if (timestamp !== null && timestamp > windowEnd) continue;

        const raw = await this.fetchTransaction(item.signature, commitment);
        if (!raw) continue;
        const observation = await this.normalize(raw, item.signature, commitment);
        if (transactionContainsReference(raw, reference)) results.push({ ...observation, referenceMatched: true });
      }

      if (reachedStart || signatures.length < 1000) return results;
      before = signatures[signatures.length - 1]?.signature;
      if (!before) return results;
    }

    // A bounded scan that cannot prove it reached the payment's creation time is
    // incomplete. Fail closed so the worker retries instead of recording no_match.
    throw new Error('REFERENCE_DISCOVERY_INCOMPLETE');
  }`;

let changes = [];
changes.push(...(replaceOnce(
  providerFile,
  /  async findTransactionsByReference\(reference: string, commitment: SolanaCommitment\): Promise<readonly ObservedPaymentTransaction\[]> \{[\s\S]*?\n  \}\n\n  async getHealth/s,
  providerMethod + '\n\n  async getHealth',
  'legacy reference discovery'
) ? ['paginated reference discovery'] : []));

changes.push(...(replaceOnce(
  reconcileFile,
  '    for (const payment of payments) results.push(await reconcilePayment(provider, repository, payment));',
  '    for (const payment of payments) results.push(await reconcilePayment(provider, repository, { ...payment, createdAt: (payment as ReconciliationPayment & { createdAt?: string }).createdAt || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }));',
  'reconciliation payment window wiring'
) ? ['reconciliation window wiring'] : []));

const oldKnown = "const response = await supabaseRequest(this.env, `/rest/v1/pay_payment_transactions?select=signature&payment_id=eq.${encodeURIComponent(paymentId)}&limit=100`, { headers: { Accept: 'application/json' } });";
const newKnown = "const response = await supabaseRequest(this.env, `/rest/v1/pay_payment_transactions?select=signature&payment_id=eq.${encodeURIComponent(paymentId)}&order=observed_at.asc`, { headers: { Accept: 'application/json' } });";
changes.push(...(replaceOnce(reconcileFile, oldKnown, newKnown, 'bounded known signature query') ? ['unbounded known signature replay set'] : []));

const helper = `\nexport async function enforcePayRateLimit(env: PayRuntimeEnv, scope: string, subjectHash: string, windowSeconds: number, maxRequests: number): Promise<void> {\n  const response = await supabaseRequest(env, '/rest/v1/rpc/pay_check_and_increment_rate_limit', {\n    method: 'POST',\n    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },\n    body: JSON.stringify({ p_scope: scope, p_subject_hash: subjectHash, p_window_seconds: windowSeconds, p_max_requests: maxRequests }),\n  });\n  const allowed = await response.json() as boolean;\n  if (allowed !== true) throw new PayRuntimeError('RATE_LIMITED', 429, 'Too many Pay API requests.');\n}\n`;
if (!fs.readFileSync(runtimeFile, 'utf8').includes('export async function enforcePayRateLimit(')) {
  fs.appendFileSync(runtimeFile, helper, 'utf8');
  changes.push('atomic Pay rate-limit helper');
}

const authNeedle = "const principal = await authenticateMerchantApi(env, request, 'payment.create');\n    const idempotencyKey = await assertIdempotencyKey(request);";
const authReplacement = "const principal = await authenticateMerchantApi(env, request, 'payment.create');\n    const keySubject = principal.keyId;\n    const merchantSubject = principal.merchantId;\n    const hashSubject = async (value: string) => { const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join(''); };\n    await enforcePayRateLimit(env, 'payment-intents:create:key', await hashSubject(keySubject), 60, 60);\n    await enforcePayRateLimit(env, 'payment-intents:create:merchant', await hashSubject(merchantSubject), 60, 300);\n    const idempotencyKey = await assertIdempotencyKey(request);";
if (replaceOnce(paymentIntentFile, authNeedle, authReplacement, 'payment creation rate-limit insertion')) changes.push('payment intent rate limits');

const runtimeImportNeedle = '  readJsonBody,\n} from \'../_shared/runtime\';';
const runtimeImportReplacement = '  readJsonBody,\n  enforcePayRateLimit,\n} from \'../_shared/runtime\';';
replaceOnce(paymentIntentFile, runtimeImportNeedle, runtimeImportReplacement, 'runtime rate-limit import');

console.log(changes.length ? `Applied Pay reference/rate-limit hardening: ${changes.join(', ')}` : 'Pay reference/rate-limit hardening already applied.');
