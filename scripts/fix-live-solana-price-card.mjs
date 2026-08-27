import fs from 'node:fs';
import path from 'node:path';

const file = path.join(process.cwd(), 'src/components/SolanaPricePage.tsx');
let source = fs.readFileSync(file, 'utf8');

const legacyUrl = "const PRICE_CARD_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co/functions/v1/solana-price-card';\n";
source = source.replace(legacyUrl, '');

// Keep this build-time patch idempotent. If the card is already migrated, do nothing.
if (source.includes("fetch(`/api/market/solana-ticker?_=${Date.now()}`")) {
  fs.writeFileSync(file, source, 'utf8');
  console.log('✓ Solana price card already uses the internal ticker API.');
  process.exit(0);
}

const newBlock = [
  'const LivePriceCard: React.FC = () => {',
  '  const [price, setPrice] = useState<number | null>(null);',
  '  const [change24h, setChange24h] = useState<number | null>(null);',
  '  const [updated, setUpdated] = useState<number | null>(null);',
  '  const [loading, setLoading] = useState(true);',
  '',
  '  const load = useCallback(async (signal?: AbortSignal) => {',
  '    try {',
  "      const response = await fetch(`/api/market/solana-ticker?_=${Date.now()}`, { cache: 'no-store', signal });",
  "      if (!response.ok) throw new Error('Market request failed');",
  "      const json = await response.json() as { price?: number; change24h?: number | null; fetchedAt?: string };",
  '      const nextPrice = Number(json.price);',
  "      if (!Number.isFinite(nextPrice) || nextPrice <= 0) throw new Error('Invalid market price');",
  '      setPrice(nextPrice);',
  '      setChange24h(Number.isFinite(Number(json.change24h)) ? Number(json.change24h) : null);',
  '      setUpdated(json.fetchedAt ? Date.parse(json.fetchedAt) || Date.now() : Date.now());',
  "    } catch (error) {",
  "      if ((error as Error)?.name !== 'AbortError') console.warn('Solana ticker refresh failed');",
  '    } finally {',
  '      if (!signal?.aborted) setLoading(false);',
  '    }',
  '  }, []);',
  '',
  '  useEffect(() => {',
  '    const controller = new AbortController();',
  '    void load(controller.signal);',
  '    const timer = window.setInterval(() => void load(controller.signal), REFRESH_MS);',
  '    return () => { controller.abort(); window.clearInterval(timer); };',
  '  }, [load]);',
  '',
  '  const priceLabel = price === null ? \'—\' : `$${formatPrice(price)}`;',
  '  const changeLabel = change24h === null ? \'—\' : `${change24h >= 0 ? \'+\' : \'\'}${change24h.toFixed(2)}%`;',
  '  return <div className="rounded-2xl border border-[#9945FF]/30 bg-gradient-to-br from-[#171124] to-[#0c1119] p-4 shadow-xl overflow-hidden">',
  '    <div className="flex items-center justify-between mb-3"><span className="text-xs text-slate-400 font-bold">قیمت لحظه‌ای SOL</span><Activity className="w-4 h-4 text-[#14F195]" aria-hidden="true" /></div>',
  '    <div className="flex items-end justify-between gap-4">',
  '      <div><div className="text-3xl font-black text-white tracking-tight" aria-live="polite">{priceLabel}</div><div className="mt-1 text-xs text-slate-500">SOL / USD · Kraken</div></div>',
  '      <div className="rounded-xl px-3 py-2 text-sm font-black bg-slate-800 text-slate-300">{changeLabel}<div className="text-[10px] font-medium text-slate-500 mt-0.5">۲۴ ساعت</div></div>',
  '    </div>',
  '    <p className="mt-3 text-[11px] text-slate-500">{loading && price === null ? \'در حال دریافت داده بازار...\' : `قیمت بدون رفرش صفحه به‌صورت خودکار به‌روزرسانی می‌شود.${updated ? ` آخرین دریافت: ${new Date(updated).toLocaleTimeString(\'fa-IR\')}` : \'\'}`}</p>',
  '  </div>;',
  '};'
].join('\n');

const cardStart = source.indexOf('const LivePriceCard: React.FC = () => {');
if (cardStart === -1) throw new Error('LivePriceCard source pattern not found');

const cardEndMarker = '\n\nconst LiveSolanaChart';
const cardEnd = source.indexOf(cardEndMarker, cardStart);
if (cardEnd === -1) throw new Error('LivePriceCard end marker not found');

source = source.slice(0, cardStart) + newBlock + source.slice(cardEnd);
fs.writeFileSync(file, source, 'utf8');
console.log('✓ Solana price card migrated to the internal ticker API.');
