import { createAdapterFactory } from 'better-auth/adapters';

const RPC_NAME = 'solmint_better_auth_adapter';

type SupabaseRpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{
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

async function callRpc(client: SupabaseRpcClient, operation: string, input: Record<string, unknown> = {}): Promise<unknown> {
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
 * Production uses Supabase PostgREST over HTTPS instead of opening a TCP
 * connection from the Pages runtime. The RPC is private to service_role and
 * allow-lists the Better Auth models, while Better Auth remains the owner of
 * identity/session semantics.
 */
export const createSupabaseBetterAuthAdapter = (config: SupabaseBetterAuthAdapterConfig) =>
  createAdapterFactory({
    config: {
      adapterId: 'solmint-supabase-http',
      adapterName: 'Solmint Supabase HTTP Adapter',
      supportsJSON: true,
      supportsDates: false,
      supportsBooleans: true,
      supportsArrays: true,
      supportsNumericIds: false,
      transaction: false,
      debugLogs: false,
    },
    adapter: () => ({
      create: async <T extends Record<string, any>>({ model, data }: { model: string; data: T }) =>
        (await callRpc(config.client, 'create', { model, data })) as T,
      update: async <T extends Record<string, any>>({ model, where, update }: { model: string; where: any[]; update: Partial<T> }) =>
        (((await callRpc(config.client, 'update', { model, where, data: update })) as T | null) ?? null),
      updateMany: async ({ model, where, update }: { model: string; where: any[]; update: Record<string, unknown> }) =>
        Number(await callRpc(config.client, 'update_many', { model, where, data: update })),
      delete: async ({ model, where }: { model: string; where: any[] }) => {
        await callRpc(config.client, 'delete', { model, where });
      },
      deleteMany: async ({ model, where }: { model: string; where: any[] }) =>
        Number(await callRpc(config.client, 'delete_many', { model, where })),
      findOne: async <T extends Record<string, any>>({ model, where }: { model: string; where: any[] }) =>
        (((await callRpc(config.client, 'find_one', { model, where })) as T | null) ?? null),
      findMany: async <T extends Record<string, any>>({ model, where, limit, offset, sortBy }: { model: string; where: any[]; limit?: number; offset?: number; sortBy?: { field: string; direction: 'asc' | 'desc' } }) =>
        (((await callRpc(config.client, 'find_many', {
          model,
          where,
          limit,
          offset,
          sort: sortBy ? { field: sortBy.field, direction: sortBy.direction } : null,
        })) as T[]) ?? []),
      count: async ({ model, where }: { model: string; where: any[] }) => Number(await callRpc(config.client, 'count', { model, where })),
      incrementOne: async <T extends Record<string, any>>({ model, where, increment, set }: { model: string; where: any[]; increment: Record<string, number>; set: Record<string, unknown> }) =>
        (((await callRpc(config.client, 'increment_one', { model, where, increment, set })) as T | null) ?? null),
      consumeOne: async <T extends Record<string, any>>({ model, where }: { model: string; where: any[] }) =>
        (((await callRpc(config.client, 'consume_one', { model, where })) as T | null) ?? null),
    }),
  });
