type ModelContextTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<string> | string;
};

type ModelContextLike = {
  registerTool: (tool: ModelContextTool, options?: { signal?: AbortSignal }) => Promise<unknown>;
};

function getModelContext(): ModelContextLike | null {
  if (typeof document === 'undefined') return null;
  const context = (document as Document & { modelContext?: ModelContextLike }).modelContext;
  return context || null;
}

async function jsonFetch(path: string): Promise<unknown> {
  const response = await fetch(path, { headers: { Accept: 'application/json' }, cache: 'no-store' });
  const text = await response.text();
  let payload: unknown = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text }; }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return payload;
}

async function register(modelContext: ModelContextLike, controller: AbortController, tool: ModelContextTool) {
  try {
    await modelContext.registerTool(tool, { signal: controller.signal });
  } catch (error) {
    if (!controller.signal.aborted) console.warn(`[WebMCP] failed to register ${tool.name}`, error);
  }
}

export function installWebMcpTools(): () => void {
  const modelContext = getModelContext();
  if (!modelContext) return () => undefined;

  const controller = new AbortController();
  const tools: ModelContextTool[] = [
    {
      name: 'solmint-get-solana-status',
      title: 'Solmint Solana status',
      description: 'Read the current public Solana network status and market metrics exposed by Solmint. Read-only.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: async () => JSON.stringify(await jsonFetch('/api/solana/status')),
    },
    {
      name: 'solmint-search-articles',
      title: 'Search Solmint articles',
      description: 'Search Solmint public published articles by title, summary, category, or tags. Read-only and limited to public content.',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Search phrase.' } },
        required: ['query'],
        additionalProperties: false,
      },
      execute: async ({ query }) => {
        const q = String(query || '').trim().toLocaleLowerCase();
        if (!q) return JSON.stringify({ results: [] });
        const payload = await jsonFetch('/api/articles') as { articles?: Array<Record<string, unknown>> };
        const articles = Array.isArray(payload?.articles) ? payload.articles : [];
        const results = articles.filter((article) => {
          const haystack = [article.title, article.summary, article.category, ...(Array.isArray(article.tags) ? article.tags : [])]
            .filter(Boolean).map(String).join(' ').toLocaleLowerCase();
          return haystack.includes(q);
        }).slice(0, 10).map((article) => ({
          title: article.title,
          slug: article.slug,
          url: typeof article.slug === 'string' ? `/article/${article.slug}` : null,
          category: article.category,
          summary: article.summary,
          publishedAt: article.publishedAt,
        }));
        return JSON.stringify({ results });
      },
    },
    {
      name: 'solmint-analyze-token',
      title: 'Analyze Solana token',
      description: 'Inspect a public Solana token mint using Solmint read-only on-chain and market risk analysis. Never provide private keys or signing credentials.',
      inputSchema: {
        type: 'object',
        properties: { mint: { type: 'string', description: 'Base58 Solana token Mint address.' } },
        required: ['mint'],
        additionalProperties: false,
      },
      execute: async ({ mint }) => JSON.stringify(await jsonFetch(`/api/tools/token-risk?mint=${encodeURIComponent(String(mint || ''))}`)),
    },
    {
      name: 'solmint-analyze-wallet',
      title: 'Analyze public Solana wallet',
      description: 'Read-only analysis of a public Solana wallet address. Never provide seed phrases, private keys, passwords, or signing credentials.',
      inputSchema: {
        type: 'object',
        properties: { address: { type: 'string', description: 'Base58 public Solana wallet address.' } },
        required: ['address'],
        additionalProperties: false,
      },
      execute: async ({ address }) => JSON.stringify(await jsonFetch(`/api/wallet/analyze?address=${encodeURIComponent(String(address || ''))}`)),
    },
  ];

  for (const tool of tools) void register(modelContext, controller, tool);
  return () => controller.abort();
}
