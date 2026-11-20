import { EventEmitter } from 'node:events';
import * as fsPromises from 'node:fs/promises';
import { basename } from 'node:path';
import { buildSubscriptionPlanInstructionFixture } from '../../src/workerd-entry.js';

const PROGRAM_ID = 'De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44';

export const onRequestGet = async (): Promise<Response> => {
  try {
    const emitter = new EventEmitter();
    let eventObserved = false;
    emitter.once('compatibility-probe', () => { eventObserved = true; });
    emitter.emit('compatibility-probe');

    const instruction = await buildSubscriptionPlanInstructionFixture();
    const builtProgramId = instruction.programId.toBase58();
    const body = {
      ok: true,
      runtime: 'cloudflare-pages-functions-workerd',
      compatibilityDate: '2026-08-10',
      nodeBuiltins: {
        events: eventObserved,
        path: basename('/solmint/subscription-sdk-compat.fixture') === 'subscription-sdk-compat.fixture',
        fsPromises: typeof fsPromises.readFile === 'function',
        buffer: typeof Buffer === 'function',
      },
      instruction: {
        programId: builtProgramId,
        discriminator: instruction.data[0],
        dataLength: instruction.data.length,
        accountCount: instruction.keys.length,
      },
    };

    if (builtProgramId !== PROGRAM_ID) throw new Error('Unexpected Program ID in SDK fixture.');
    if (!Object.values(body.nodeBuiltins).every(Boolean)) throw new Error('Required Node.js compatibility API is unavailable.');
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      ok: false,
      code: error instanceof Error ? error.name : 'UNKNOWN_RUNTIME_ERROR',
    }), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
};
