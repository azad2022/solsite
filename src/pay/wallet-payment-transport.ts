import { PublicKey } from '@solana/web3.js';

export type MobileWalletId = 'phantom' | 'solflare' | 'backpack';

const TRANSACTION_REQUEST_PATH = (intentId: string) =>
  `/api/pay/v1/payment-intents/${encodeURIComponent(intentId)}/transaction-request`;

function absoluteHttpUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new TypeError('Wallet URL must use HTTP(S).');
  return url;
}

export function isValidWalletAddress(value: string): boolean {
  try {
    new PublicKey(value.trim());
    return true;
  } catch {
    return false;
  }
}

export function buildTransactionRequestUrl(origin: string, intentId: string): string {
  return new URL(TRANSACTION_REQUEST_PATH(intentId), absoluteHttpUrl(origin)).toString();
}

export function buildSolanaTransactionRequestUri(origin: string, intentId: string): string {
  const url = buildTransactionRequestUrl(origin, intentId);
  return `solana:${url}`;
}

export function isMobileWalletContext(userAgent: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
}

export function buildWalletBrowseUrl(wallet: MobileWalletId, pageUrl: string): string {
  const page = absoluteHttpUrl(pageUrl);
  const encodedPage = encodeURIComponent(page.toString());
  const ref = encodeURIComponent(page.origin);
  switch (wallet) {
    case 'phantom': return `https://phantom.app/ul/browse/${encodedPage}?ref=${ref}`;
    case 'solflare': return `https://solflare.com/ul/v1/browse/${encodedPage}?ref=${ref}`;
    case 'backpack': return `https://backpack.app/ul/v1/browse/${encodedPage}?ref=${ref}`;
  }
}
