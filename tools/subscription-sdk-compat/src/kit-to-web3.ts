import { isSignerRole, isWritableRole } from '@solana/kit';
import { Buffer } from 'buffer';
import { PublicKey, TransactionInstruction } from '@solana/web3.js';

type KitAccountRole = Parameters<typeof isSignerRole>[0];

export interface KitInstructionLike {
  readonly programAddress: string;
  readonly data?: ArrayLike<number>;
  readonly accounts?: readonly {
    readonly address: string;
    readonly role: KitAccountRole;
  }[];
}

/**
 * Converts a narrow Kit instruction into a legacy web3.js instruction.
 * It copies the Program ID, bytes and account metas only. It does not sign,
 * submit, simulate, query RPC state, verify consent or establish payment.
 */
export function kitInstructionToWeb3(
  instruction: KitInstructionLike,
): TransactionInstruction {
  if (!instruction || typeof instruction !== 'object') {
    throw new TypeError('Kit instruction must be an object.');
  }

  const programAddress = instruction.programAddress;
  if (typeof programAddress !== 'string' || programAddress.length === 0) {
    throw new TypeError('Kit instruction programAddress is missing.');
  }

  const data = instruction.data ?? new Uint8Array();
  if (!(data instanceof Uint8Array)) {
    throw new TypeError('Kit instruction data must be Uint8Array.');
  }

  const accounts = instruction.accounts ?? [];
  if (!Array.isArray(accounts)) {
    throw new TypeError('Kit instruction accounts must be an array.');
  }

  const keys = accounts.map((account, index) => {
    if (!account || typeof account.address !== 'string' || account.address.length === 0) {
      throw new TypeError(`Kit account[${index}] is missing its address.`);
    }
    const role = account.role;
    if (role !== 0 && role !== 1 && role !== 2 && role !== 3) {
      throw new RangeError(`Kit account[${index}] has an unsupported role.`);
    }
    return {
      pubkey: new PublicKey(account.address),
      isSigner: isSignerRole(role),
      isWritable: isWritableRole(role),
    };
  });

  return new TransactionInstruction({
    programId: new PublicKey(programAddress),
    keys,
    data: Buffer.from(data),
  });
}
