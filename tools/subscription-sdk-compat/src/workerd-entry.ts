import { address, createNoopSigner } from '@solana/kit';
import { getCreatePlanOverlayInstructionAsync } from '@solana/subscriptions';
import { kitInstructionToWeb3 } from './kit-to-web3.js';

// Synthetic fixture only: no RPC, signing, submission or chain mutation.
export async function buildSubscriptionPlanInstructionFixture() {
  const instruction = await getCreatePlanOverlayInstructionAsync({
    owner: createNoopSigner(address('SysvarRent111111111111111111111111111111111')),
    planId: 17n,
    mint: address('So11111111111111111111111111111111111111112'),
    amount: 1_250_000n,
    periodHours: 720n,
    endTs: 0n,
    destinations: [address('Stake11111111111111111111111111111111111111')],
    pullers: [],
    metadataUri: 'https://solmint.ir/sdk-compatibility-fixture.json',
    tokenProgram: address('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
  });
  return kitInstructionToWeb3(instruction);
}
