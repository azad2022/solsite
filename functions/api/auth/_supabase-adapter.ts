import { createAdapterFactory } from 'better-auth/adapters';

const RPC_NAME = 'solmint_better_auth_adapter';

type SupabaseRpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{
    data: unknown;
    error: { message?: string; details?: string; hint?: string } | null;
  }>;
};

export interface SupabaseBetterAuthAdapterConfig {
  client: SupabaseRpcClient;
}

function raiseRpcError(error: { message?: string; details?: string; hint?: string } | null): never {
  const message = [error?.message, error?.details, error?.hint].filter(Boolean).join(' | ');
  throw new Error(`Better Auth Supabase adapter RPC failed${message ? `: ${message}` : ''}`);
}

async function callRpc(
  client: SupabaseRpcClient,
  operation: string,
  input: Record<string, unknown> = {},
): Promise<unknown> {
  const { data, error } = await client.rpc(RPC_NAME, {
    p_operation: operation,
    p_model: input.model ?? null,
    p_data: input.data ?? {},
    p_where: input.where ?? [],
    p_limit: input.limit ?? null,
    p_offset: input.offset ?? 0,
    p_sort: input.sort ?? null,
    p_increment: input.increment ?? {},
    p_set: input.set ?? {},
  });

  if (error) raiseRpcError(error);
  return data;
}

/**
 * Better Auth database adapter for Cloudflare Pages Functions.
 *
 * Production never opens a TCP connection to PostgreSQL. Instead, the adapter
 * calls one allow-listed SECURITY DEFINER RPC exposed by Supabase PostgREST.
 * The RPC itself owns all SQL against the private `better_auth` schema.
 *
 * This preserves Better Auth's server-side persistence without requiring a
 * Cloudflare Hyperdrive binding while keeping the auth tables inaccessible to
 * anon/authenticated Supabase clients.
 */
export const createSupabaseBetterAuthAdapter = (config: SupabaseBetterAuthAdapterConfig) =>
  createAdapterFactory({
    config: {
      adapterId: 'solmint-supabase-http',
      adapterName: 'Solmint Supabase HTTP Adapter',
      supportsJSON: true,
      supportsDates: true,
      supportsBooleans: true,
      supportsArrays: true,
      supportsNumericIds: false,
      transaction: false,
      debugLogs: false,
    },
    adapter: () => ({
      create: async ({ model, data }) =>
        (await callRpc(config.client, 'create', { model, data })) as Record<string, unknown>,

      update: async ({ model, where, update }) =>
        ((await callRpc(config.client, 'update', { model, where, data: update })) as Record<string, unknown> | null) ?? null,

      updateMany: async ({ model, where, update }) =>
        Number(await callRpc(config.client, 'update_many', { model, where, data: update })),

      delete: async ({ model, where }) => {
        await callRpc(config.client, 'delete', { model, where });
      },

      deleteMany: async ({ model, where }) =>
        Number(await callRpc(config.client, 'delete_many', { model, where })),

      findOne: async ({ model, where }) =>
        ((await callRpc(config.client, 'find_one', { model, where })) as Record<string, unknown> | null) ?? null,

      findMany: async ({ model, where, limit, offset, sortBy }) =>
        ((await callRpc(config.client, 'find_many', {
          model,
          where,
          limit,
          offset,
          sort: sortBy ? { field: sortBy.field, direction: sortBy.direction } : null,
        })) as Record<string, unknown>[]) ?? [],

      count: async ({ model, where }) => Number(await callRpc(config.client, 'count', { model, where })),

      incrementOne: async ({ model, where, increment, set }) =>
        ((await callRpc(config.client, 'increment_one', {
          model,
          where,
          increment,
          set,
        })) as Record<string, unknown> | null) ?? null,

      consumeOne: async ({ model, where }) =>
        ((await callRpc(config.client, 'consume_one', { model, where })) as Record<string, unknown> | null) ?? null,
    }),
  });
