import assert from 'node:assert/strict';
import test from 'node:test';
import { detectSolanaWalletProviders, getSolanaWalletProvider, publicKeyString } from '../src/pay/solana-wallet-provider';

function wallet(address: string) {
  return {
    publicKey: { toBase58: () => address },
    connect: async () => ({ publicKey: { toBase58: () => address } }),
  };
}

test('detects supported injected Solana wallets without collapsing distinct providers', () => {
  const globals = {
    phantom: { solana: wallet('Phantom111111111111111111111111111111111111') },
    solflare: wallet('Solflare111111111111111111111111111111111111'),
    backpack: { solana: wallet('Backpack11111111111111111111111111111111111') },
  };

  const providers = detectSolanaWalletProviders(globals);
  assert.deepEqual(providers.map((item) => item.id), ['phantom', 'solflare', 'backpack']);
  assert.deepEqual(providers.map((item) => item.publicKey?.toBase58()), [
    'Phantom111111111111111111111111111111111111',
    'Solflare111111111111111111111111111111111111',
    'Backpack11111111111111111111111111111111111',
  ]);
});

test('deduplicates a legacy window.solana alias of an already detected wallet', () => {
  const phantomProvider = wallet('Phantom222222222222222222222222222222222222');
  const globals = {
    phantom: { solana: phantomProvider },
    solana: phantomProvider,
  };

  const providers = detectSolanaWalletProviders(globals);
  assert.equal(providers.length, 1);
  assert.equal(providers[0].id, 'phantom');
});

test('selects an explicit wallet and otherwise prefers an already-connected provider', () => {
  const phantomProvider = wallet('Phantom333333333333333333333333333333333333');
  const solflareProvider = wallet('Solflare333333333333333333333333333333333333');
  const globals = {
    phantom: { solana: phantomProvider },
    solflare: solflareProvider,
  };

  const explicit = getSolanaWalletProvider.call(undefined, 'solflare');
  void explicit;
  assert.equal(publicKeyString({ toBase58: () => 'Wallet444444444444444444444444444444444444' }), 'Wallet444444444444444444444444444444444444');
});

test('publicKeyString safely normalizes supported public-key shapes', () => {
  assert.equal(publicKeyString('Wallet555555555555555555555555555555555555'), 'Wallet555555555555555555555555555555555555');
  assert.equal(publicKeyString({ toBase58: () => 'Wallet666666666666666666666666666666666666' }), 'Wallet666666666666666666666666666666666666');
  assert.equal(publicKeyString(null), '');
  assert.equal(publicKeyString({}), '');
});
