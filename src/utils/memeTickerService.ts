export type MarketTickerSource = 'binance' | 'jupiter';

export interface MemeTickerItem {
  id: string;
  source?: MarketTickerSource;
  pair?: string;
  mint: string;
  symbol: string;
  name: string;
  logoUrl?: string;
  enabled: boolean;
  order: number;
  priceUsd: number | null;
  change24h: number | null;
  fetchedAt?: string;
}

export interface MemeTickerConfig {
  enabled: boolean;
  provider: string;
  endpoint: string;
  refreshSeconds: number;
  direction: 'ltr' | 'rtl';
  speedSeconds: number;
  items: Omit<MemeTickerItem, 'priceUsd' | 'change24h' | 'fetchedAt'>[];
  apiKeyConfigured?: boolean;
  apiKeyMasked?: string;
}

export interface MemeTickerFeed {
  enabled: boolean;
  provider?: string;
  refreshSeconds?: number;
  direction?: 'ltr' | 'rtl';
  speedSeconds?: number;
  items: MemeTickerItem[];
  fetchedAt?: string;
  stale?: boolean;
  message?: string;
}

const FUNCTION_NAME = 'meme-price-ticker';

async function invoke(body: Record<string, unknown>) {
  // Keep Supabase completely out of the synchronous dependency graph. The
  // ticker is non-critical and loads the client only when a request is made.
  const { getSupabaseClient } = await import('./supabaseClient');
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client is not configured.');
  const { data, error } = await client.functions.invoke(FUNCTION_NAME, { body });
  if (error) throw error;
  return data;
}

export async function fetchMemeTickerFeed(): Promise<MemeTickerFeed> {
  return invoke({ action: 'public_feed' });
}

export async function fetchMemeTickerConfig(adminPasscode: string): Promise<MemeTickerConfig> {
  const result = await invoke({ action: 'get_config', adminPasscode });
  if (!result?.success) throw new Error(result?.message || 'Unable to load ticker settings.');
  return result.config as MemeTickerConfig;
}

export async function saveMemeTickerConfig(adminPasscode: string, config: MemeTickerConfig, apiKey?: string): Promise<void> {
  const result = await invoke({ action: 'save_config', adminPasscode, config, apiKey });
  if (!result?.success) throw new Error(result?.message || 'Unable to save ticker settings.');
}

export async function testMemeTickerConfig(adminPasscode: string, config: MemeTickerConfig, apiKey?: string): Promise<{ success: boolean; validItems: number; items: MemeTickerItem[]; message?: string }> {
  return invoke({ action: 'test', adminPasscode, config, apiKey });
}
