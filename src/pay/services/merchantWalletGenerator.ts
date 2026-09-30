import * as bip39 from '@scure/bip39';
import { wordlist as englishWordlist } from '@scure/bip39/wordlists/english.js';
import * as ed25519 from '@noble/ed25519';
import slip10 from 'micro-key-producer/slip10.js';
import { encodeBase58 } from './base58';

export const SOLANA_MERCHANT_DERIVATION_PATH = "m/44'/501'/0'/0'";
export type MerchantWalletWordCount = 12 | 24;

export interface LocalSolanaMerchantWallet {
  readonly mnemonic: string;
  readonly address: string;
  signMessage(message: string): Promise<Uint8Array>;
  dispose(): void;
}

function wipe(value: Uint8Array | null | undefined): void {
  if (value) value.fill(0);
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let different = 0;
  for (let i = 0; i < a.length; i += 1) different |= a[i] ^ b[i];
  return different === 0;
}

/**
 * Creates a Solana BIP39/BIP44 wallet locally in the merchant's browser.
 *
 * Secret material never leaves this function except for the mnemonic exposed
 * to the one-time UI recovery step. The backend receives only the public
 * address and a challenge signature.
 */
export async function generateLocalSolanaMerchantWallet(
  wordCount: MerchantWalletWordCount = 24,
): Promise<LocalSolanaMerchantWallet> {
  if (wordCount !== 12 && wordCount !== 24) throw new Error('Unsupported recovery phrase length.');
  if (typeof crypto?.getRandomValues !== 'function') throw new Error('Secure browser randomness is unavailable.');

  const mnemonic = bip39.generateMnemonic(englishWordlist, wordCount === 24 ? 256 : 128);
  if (!bip39.validateMnemonic(mnemonic, englishWordlist)) throw new Error('Generated recovery phrase failed validation.');

  let seed = await bip39.mnemonicToSeedWebcrypto(mnemonic, '');
  const root = slip10.fromMasterSeed(seed);
  const account = root.derive(SOLANA_MERCHANT_DERIVATION_PATH);
  const privateKey = new Uint8Array(account.privateKey);
  const publicKey = new Uint8Array(account.publicKeyRaw);
  const derivedPublicKey = await ed25519.getPublicKeyAsync(privateKey);

  // Fail closed if the derivation or signing primitive ever disagrees.
  if (!equalBytes(publicKey, derivedPublicKey)) {
    wipe(seed);
    wipe(root.privateKey);
    wipe(root.chainCode);
    wipe(account.privateKey);
    wipe(account.chainCode);
    wipe(privateKey);
    wipe(publicKey);
    wipe(derivedPublicKey);
    throw new Error('Generated Solana keypair failed cryptographic self-check.');
  }

  const address = encodeBase58(publicKey);
  let disposed = false;

  // Once the child key is copied, discard HD-wallet intermediates immediately.
  wipe(seed);
  seed = new Uint8Array(0);
  wipe(root.privateKey);
  wipe(root.chainCode);
  wipe(account.privateKey);
  wipe(account.chainCode);
  wipe(derivedPublicKey);

  return {
    mnemonic,
    address,
    signMessage: async (message: string) => {
      if (disposed) throw new Error('Generated wallet signer has been disposed.');
      const messageBytes = new TextEncoder().encode(message);
      const signature = await ed25519.signAsync(messageBytes, privateKey);
      return new Uint8Array(signature);
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      wipe(privateKey);
    },
  };
}
