import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, Gauge, MessageCircle, RefreshCw, ShieldCheck, TrendingDown, TrendingUp, Waves } from 'lucide-react';
import { CommentsSection } from './CommentsSection';

const KRAKEN_OHLC_URL = 'https://api.kraken.com/0/public/OHLC';
const INTERVALS = [
  { value: 1, label: '1m', name: '۱ دقیقه' },
  { value: 5, label: '5m', name: '۵ دقیقه' },
  { value: 15, label: '15m', name: '۱۵ دقیقه' },
  { value: 60, label: '1H', name: '۱ ساعت' },
  { value: 240, label: '4H', name: '۴ ساعت' },
  { value: 1440, label: '1D', name: 'روزانه' },
];

type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };
type IndicatorResult = {
  ema20: number; ema50: number; rsi: number; macd: number; signal: number; histogram: number;
  atr: number; atrPct: number; bbUpper: number; bbMiddle: number; bbLower: number;
  stochK: number; stochD: number; adx: number; obvSlope: number; volumeRatio: number;
  support: number; resistance: number; score: number; bias: 'bullish' | 'bearish' | 'neutral';
};

const fmt = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

function ema(values: number[], period: number) {
  if (!values.length) return [];
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  out.push(prev);
  for (let i = 1; i < values.length; i += 1) { prev = values[i] * k + prev * (1 - k); out.push(prev); }
  return out;
}

function rsi(values: number[], period = 14) {
  if (values.length <= period) return 50;
  let gains = 0; let losses = 0;
  for (let i = 1; i <= period; i += 1) { const d = values[i] - values[i - 1]; if (d >= 0) gains += d; else losses -= d; }
  let avgGain = gains / period; let avgLoss = losses / period;
  for (let i = period + 1; i < values.length; i += 1) {
    const d = values[i] - values[i - 1]; const gain = Math.max(0, d); const loss = Math.max(0, -d);
    avgGain = (avgGain * (period - 1) + gain) / period; avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + avgGain / avgLoss));
}

function atr(data: Candle[], period = 14) {
  if (data.length < period + 1) return 0;
  const tr = data.map((c, i) => i === 0 ? c.high - c.low : Math.max(c.high - c.low, Math.abs(c.high - data[i - 1].close), Math.abs(c.low - data[i - 1].close)));
  let value = tr.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
  for (let i = period + 1; i < tr.length; i += 1) value = (value * (period - 1) + tr[i]) / period;
  return value;
}

function bollinger(values: number[], period = 20, mult = 2) {
  const slice = values.slice(-period); const mean = slice.reduce((a, b) => a + b, 0) / Math.max(1, slice.length);
  const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, slice.length);
  const sd = Math.sqrt(variance); return { upper: mean + mult * sd, middle: mean, lower: mean - mult * sd };
}

function stochastic(data: Candle[], period = 14, smooth = 3) {
  const ks: number[] = [];
  for (let i = Math.max(0, data.length - 40); i < data.length; i += 1) {
    const window = data.slice(Math.max(0, i - period + 1), i + 1); const high = Math.max(...window.map(c => c.high)); const low = Math.min(...window.map(c => c.low));
    ks.push(high === low ? 50 : ((data[i].close - low) / (high - low)) * 100);
  }
  const k = ks.at(-1) ?? 50; const d = ks.slice(-smooth).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(smooth, ks.length)); return { k, d };
}

function adx(data: Candle[], period = 14) {
  if (data.length < period * 2 + 1) return 20;
  const trs: number[] = []; const plus: number[] = []; const minus: number[] = [];
  for (let i = 1; i < data.length; i += 1) {
    const c = data[i]; const p = data[i - 1]; trs.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
    const up = c.high - p.high; const down = p.low - c.low; plus.push(up > down && up > 0 ? up : 0); minus.push(down > up && down > 0 ? down : 0);
  }
  const avg = (a: number[]) => a.slice(-period).reduce((x, y) => x + y, 0) / period;
  const t = avg(trs); if (!t) return 0; const p = (avg(plus) / t) * 100; const m = (avg(minus) / t) * 100; return p + m ? (Math.abs(p - m) / (p + m)) * 100 : 0;
}

function calculate(data: Candle[]): IndicatorResult | null {
  if (data.length < 60) return null;
  const closes = data.map(c => c.close); const e20 = ema(closes, 20).at(-1)!; const e50 = ema(closes, 50).at(-1)!;
  const macdFast = ema(closes, 12); const macdSlow = ema(closes, 26); const macdSeries = macdFast.map((v, i) => v - macdSlow[i]); const signalSeries = ema(macdSeries.slice(26), 9); const macd = macdSeries.at(-1)!; const signal = signalSeries.at(-1)!;
  const a = atr(data); const bb = bollinger(closes); const st = stochastic(data); const adxValue = adx(data); const volumes = data.map(c => c.volume); const avgVol = volumes.slice(-20).reduce((x, y) => x + y, 0) / 20; const volumeRatio = avgVol ? volumes.at(-1)! / avgVol : 1;
  let obv = 0; const obvSeries: number[] = []; for (let i = 1; i < data.length; i += 1) { if (data[i].close > data[i - 1].close) obv += data[i].volume; else if (data[i].close < data[i - 1].close) obv -= data[i].volume; obvSeries.push(obv); }
  const obvSlope = obvSeries.length > 10 ? obvSeries.at(-1)! - obvSeries.at(-11)! : 0;
  const support = Math.min(...data.slice(-30).map(c => c.low)); const resistance = Math.max(...data.slice(-30).map(c => c.high)); const price = closes.at(-1)!;
  let score = 50;
  if (price > e20) score += 8; else score -= 8; if (e20 > e50) score += 10; else score -= 10; if (macd > signal) score += 8; else score -= 8;
  const r = rsi(closes); if (r > 55 && r < 72) score += 7; else if (r < 45 && r > 28) score -= 7; else if (r >= 72) score -= 3; else if (r <= 28) score += 3;
  if (st.k > st.d) score += 5; else score -= 5; if (obvSlope > 0) score += 4; else if (obvSlope < 0) score -= 4; if (adxValue > 25) score += price > e20 ? 3 : -3; if (volumeRatio > 1.2) score += price > data.at(-1)!.open ? 3 : -3;
  score = Math.max(0, Math.min(100, Math.round(score)));
  return { ema20: e20, ema50: e50, rsi: r, macd, signal, histogram: macd - signal, atr: a, atrPct: price ? (a / price) * 100 : 0, bbUpper: bb.upper, bbMiddle: bb.middle, bbLower: bb.lower, stochK: st.k, stochD: st.d, adx: adxValue, obvSlope, volumeRatio, support, resistance, score, bias: score >= 60 ? 'bullish' : score <= 40 ? 'bearish' : 'neutral' };
}

function interpretation(i: IndicatorResult, price: number, timeframe: string) {
  const parts: string[] = [];
  parts.push(i.bias === 'bullish' ? `ساختار ${timeframe} فعلاً متمایل به صعود است` : i.bias === 'bearish' ? `ساختار ${timeframe} فعلاً متمایل به نزول است` : `ساختار ${timeframe} فعلاً خنثی و بدون برتری واضح است`);
  parts.push(price > i.ema20 ? 'قیمت بالای EMA20 قرار دارد' : 'قیمت زیر EMA20 قرار دارد');
  parts.push(i.ema20 > i.ema50 ? 'EMA20 بالاتر از EMA50 است' : 'EMA20 پایین‌تر از EMA50 است');
  parts.push(i.macd > i.signal ? 'MACD مومنتوم مثبت را نشان می‌دهد' : 'MACD مومنتوم منفی را نشان می‌دهد');
  if (i.rsi >= 70) parts.push('RSI وارد ناحیه اشباع خرید شده است'); else if (i.rsi <= 30) parts.push('RSI وارد ناحیه اشباع فروش شده است'); else parts.push(`RSI در محدوده ${i.rsi.toFixed(0)} قرار دارد و هنوز سیگنال اشباع شدیدی نمی‌دهد`);
  if (i.volumeRatio > 1.25) parts.push('حجم اخیر بالاتر از میانگین ۲۰ دوره‌ای است'); else if (i.volumeRatio < 0.75) parts.push('حجم اخیر پایین‌تر از میانگین ۲۰ دوره‌ای است');
  return parts.join('؛ ') + ' .';
}

export const SolanaMarketInsights: React.FC = () => {
  const [interval, setIntervalValue] = useState(60); const [data, setData] = useState<Candle[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [updated, setUpdated] = useState('');
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); try {
      const res = await fetch(`${KRAKEN_OHLC_URL}?pair=SOLUSD&interval=${interval}&_=${Date.now()}`, { cache: 'no-store', signal }); if (!res.ok) throw new Error('request'); const json = await res.json();
      if (json?.error?.length) throw new Error('kraken'); const key = Object.keys(json?.result ?? {}).find(k => k !== 'last'); const rows = key ? json.result[key] : [];
      const candles: Candle[] = rows.slice(-240).map((row: unknown[]) => ({ time: Number(row[0]), open: Number(row[1]), high: Number(row[2]), low: Number(row[3]), close: Number(row[4]), volume: Number(row[6]) || 0 })).filter((c: Candle) => [c.time,c.open,c.high,c.low,c.close,c.volume].every(Number.isFinite));
      if (candles.length < 60) throw new Error('insufficient'); setData(candles); setError(''); setUpdated(new Date().toLocaleTimeString('fa-IR'));
    } catch (e) { if ((e as Error)?.name !== 'AbortError') setError('داده کافی برای تحلیل این تایم‌فریم دریافت نشد.'); } finally { if (!signal?.aborted) setLoading(false); }
  }, [interval]);
  useEffect(() => { const c = new AbortController(); void load(c.signal); const t = window.setInterval(() => void load(), 20000); return () => { c.abort(); clearInterval(t); }; }, [load]);
  const result = useMemo(() => calculate(data), [data]); const price = data.at(-1)?.close ?? 0; const selected = INTERVALS.find(x => x.value === interval)!;
  return <section className="rounded-3xl border border-slate-800 bg-[#091017] overflow-hidden shadow-2xl" dir="rtl">
    <div className="p-5 sm:p-7 border-b border-slate-800 bg-gradient-to-l from-[#111625] to-[#091017]">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"><div><div className="flex items-center gap-2"><Gauge className="w-5 h-5 text-[#14F195]"/><h2 className="text-xl sm:text-2xl font-black">تحلیل زنده بازار SOL</h2></div><p className="text-xs text-slate-500 mt-2">تحلیل کاملاً خودکار بر پایه داده لحظه‌ای Kraken؛ بدون نیاز به بروزرسانی دستی.</p></div><div className="flex items-center gap-2 text-[10px] text-slate-500"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}/> بروزرسانی خودکار هر ۲۰ ثانیه {updated && `· ${updated}`}</div></div>
      <div className="flex flex-wrap gap-2 mt-5">{INTERVALS.map(x => <button key={x.value} type="button" onClick={() => setIntervalValue(x.value)} className={`px-3 py-2 rounded-xl text-[10px] font-black border transition ${interval === x.value ? 'bg-[#9945FF]/15 border-[#9945FF] text-white' : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-white'}`}>{x.label}</button>)}</div>
    </div>
    {error ? <div className="p-8 text-center text-sm text-amber-300">{error}</div> : result && <>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 p-4 border-b border-slate-800">{[
        ['RSI 14', result.rsi.toFixed(1), result.rsi >= 70 ? 'اشباع خرید' : result.rsi <= 30 ? 'اشباع فروش' : 'متعادل'],
        ['MACD', result.histogram >= 0 ? 'مثبت' : 'منفی', result.histogram >= 0 ? 'مومنتوم مثبت' : 'مومنتوم منفی'],
        ['ADX', result.adx.toFixed(1), result.adx >= 25 ? 'روند قوی' : 'روند ضعیف'],
        ['Stoch', result.stochK.toFixed(0), result.stochK > 80 ? 'اشباع خرید' : result.stochK < 20 ? 'اشباع فروش' : 'متعادل'],
        ['ATR', `${result.atrPct.toFixed(2)}%`, 'نوسان'],
        ['Volume', `${result.volumeRatio.toFixed(2)}×`, 'نسبت به میانگین'],
        ['EMA20/50', result.ema20 > result.ema50 ? 'Bullish' : 'Bearish', 'ساختار روند'],
        ['Score', `${result.score}/100`, result.bias === 'bullish' ? 'صعودی' : result.bias === 'bearish' ? 'نزولی' : 'خنثی'],
      ].map(([a,b,c]) => <div key={a} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><div className="text-[9px] text-slate-500">{a}</div><div className="font-black text-sm mt-1 text-white">{b}</div><div className="text-[9px] text-slate-600 mt-1">{c}</div></div>)}</div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-5 sm:p-7">
        <div className={`rounded-2xl border p-5 ${result.bias === 'bullish' ? 'border-emerald-500/25 bg-emerald-500/[0.06]' : result.bias === 'bearish' ? 'border-rose-500/25 bg-rose-500/[0.06]' : 'border-amber-500/25 bg-amber-500/[0.05]'}`}><div className="flex items-center justify-between"><span className="text-xs text-slate-400">سوگیری تایم‌فریم {selected.name}</span>{result.bias === 'bullish' ? <TrendingUp className="w-5 h-5 text-emerald-400"/> : result.bias === 'bearish' ? <TrendingDown className="w-5 h-5 text-rose-400"/> : <Activity className="w-5 h-5 text-amber-400"/>}</div><div className="text-3xl font-black mt-3">{result.score}/100</div><div className="text-xs font-bold mt-1">{result.bias === 'bullish' ? 'متمایل به صعود' : result.bias === 'bearish' ? 'متمایل به نزول' : 'خنثی'}</div><p className="text-xs text-slate-400 leading-6 mt-4">{interpretation(result, price, selected.name)}</p></div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5"><div className="flex items-center gap-2 text-xs font-bold"><Waves className="w-4 h-4 text-[#9945FF]"/> محدوده‌های مهم</div><div className="grid grid-cols-2 gap-3 mt-5"><div className="rounded-xl bg-slate-900 p-3"><div className="text-[9px] text-slate-500">حمایت ۳۰ کندل</div><div className="font-black mt-1">${fmt(result.support)}</div></div><div className="rounded-xl bg-slate-900 p-3"><div className="text-[9px] text-slate-500">مقاومت ۳۰ کندل</div><div className="font-black mt-1">${fmt(result.resistance)}</div></div><div className="rounded-xl bg-slate-900 p-3"><div className="text-[9px] text-slate-500">EMA 20</div><div className="font-black mt-1">${fmt(result.ema20)}</div></div><div className="rounded-xl bg-slate-900 p-3"><div className="text-[9px] text-slate-500">EMA 50</div><div className="font-black mt-1">${fmt(result.ema50)}</div></div></div></div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5"><div className="flex items-center gap-2 text-xs font-bold"><BarChart3 className="w-4 h-4 text-[#14F195]"/> باندهای بولینگر و نوسان</div><div className="space-y-3 mt-5 text-xs"><div className="flex justify-between"><span className="text-slate-500">Upper</span><b>${fmt(result.bbUpper)}</b></div><div className="flex justify-between"><span className="text-slate-500">Middle</span><b>${fmt(result.bbMiddle)}</b></div><div className="flex justify-between"><span className="text-slate-500">Lower</span><b>${fmt(result.bbLower)}</b></div><div className="h-px bg-slate-800"/><div className="flex justify-between"><span className="text-slate-500">ATR</span><b>{fmt(result.atr)} ({result.atrPct.toFixed(2)}%)</b></div><div className="flex justify-between"><span className="text-slate-500">OBV</span><b>{result.obvSlope >= 0 ? 'افزایشی' : 'کاهشی'}</b></div></div></div>
      </div>
      <div className="px-5 pb-6 sm:px-7 sm:pb-7"><div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 flex gap-3"><ShieldCheck className="w-5 h-5 text-slate-500 shrink-0"/><p className="text-[11px] text-slate-500 leading-6">این خروجی یک سیستم محاسباتی بر پایه اندیکاتورهاست و توصیه خرید یا فروش نیست. تغییر تایم‌فریم، داده و نتیجه تحلیل را تغییر می‌دهد.</p></div></div>
    </>}
  </section>;
};

export const SolanaMarketComments: React.FC<{ currentUser: any; openAuthModal: () => void }> = ({ currentUser, openAuthModal }) => {
  const [comments, setComments] = useState<any[]>([]);
  return <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10"><div className="rounded-3xl border border-slate-800 bg-[#0b1018] p-5 sm:p-8"><div className="flex items-center gap-3 mb-5"><MessageCircle className="w-5 h-5 text-sky-400"/><div><h2 className="text-xl font-black">دیدگاه و تحلیل کاربران</h2><p className="text-xs text-slate-500 mt-1">تجربه و تحلیل خود را درباره وضعیت فعلی SOL با دیگر کاربران به اشتراک بگذارید.</p></div></div><CommentsSection articleId="solana-price" comments={comments} currentUser={currentUser} openAuthModal={openAuthModal} onCommentCreated={(comment) => setComments(prev => [...prev, comment])} /></div></section>;
};
