import { isSignerRole, isWritableRole } from '@solana/kit';
import { PublicKey, TransactionInstruction } from '@solana/web3.js';

/**
 * Converts one Codama/@solana/kit Instruction into a legacy web3.js
 * TransactionInstruction. The mapping is intentionally narrow and fail-closed:
 * no unknown account roles, missing addresses, or arbitrary object coercion.
 *
 * This adapter converts instruction data/account metas only. It does not sign,
 * send, simulate, fetch RPC state, or establish payment/consent validity.
 */
export function kitInstructionToWeb3(instruction) {
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
    if (!Number.isInteger(account.role) || account.role < 0 || account.role > 3) {
      throw new RangeError(`Kit account[${index}] has an unsupported role.`);
    }

    return {
      pubkey: new PublicKey(account.address),
      isSigner: isSignerRole(account.role),
      isWritable: isWritableRole(account.role),
    };
  });

  return new TransactionInstruction({
    programId: new PublicKey(programAddress),
    keys,
    data: Buffer.from(data),
  });
}
