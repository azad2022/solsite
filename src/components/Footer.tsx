import React, { useEffect, useMemo, useState } from 'react';
import { Lock, Github } from 'lucide-react';

interface FooterProps {
  onNavigate?: (path: string) => void;
  openAdminModal: () => void;
}

type PublicArticle = {
  id?: string;
  title?: string;
  slug?: string;
  category?: string;
  tags?: string[] | unknown;
  summary?: string;
  isDraft?: boolean;
  is_draft?: boolean;
};

const TOOL_KEYWORDS: Record<string, string[]> = {
  '/tools/solana-token-tools': ['سولانا', 'توکن', 'token-2022', 'spl token', 'mint', 'authority', 'امنیت'],
  '/tools/solana-token-scanner': ['سولانا', 'توکن', 'token-2022', 'mint', 'mint authority', 'freeze authority', 'tokenomics', 'امنیت'],
  '/tools/token-2022-inspector': ['token-2022', 'سولانا', 'توکن', 'spl token', 'extension', 'transfer fee', 'transfer hook'],
};

function normalize(value: unknown) {
  return String(value ?? '').toLocaleLowerCase('fa-IR').replace(/\u200c/g, ' ').replace(/\s+/g, ' ').trim();
}

function tagsToText(tags: unknown) {
  if (Array.isArray(tags)) return tags.map(tag => typeof tag === 'string' ? tag : JSON.stringify(tag)).join(' ');
  if (typeof tags === 'string') return tags;
  return '';
}

function scoreArticle(article: PublicArticle, keywords: string[]) {
  const text = normalize(`${article.title || ''} ${article.summary || ''} ${tagsToText(article.tags)} ${article.category || ''}`);
  return keywords.reduce((total, keyword) => total + (text.includes(normalize(keyword)) ? (keyword.length > 8 ? 4 : 2) : 0), 0);
}

const ToolRelatedArticles: React.FC<{ articles: PublicArticle[]; pathname: string }> = ({ articles, pathname }) => {
  const related = useMemo(() => {
    const keywords = TOOL_KEYWORDS[pathname] || [];
    return articles
      .filter(article => !article.isDraft && !article.is_draft && article.slug && article.title)
      .map(article => ({ article, score: scoreArticle(article, keywords) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || String(a.article.title).localeCompare(String(b.article.title), 'fa'))
      .slice(0, 5)
      .map(item => item.article);
  }, [articles, pathname]);

  if (!related.length) return null;

  return (
    <section className="w-full border-b border-slate-800/60 bg-[#08080f] px-4 py-8 sm:px-6" dir="rtl" aria-labelledby="footer-related-articles-title">
      <div className="mx-auto w-full max-w-7xl">
        <h2 id="footer-related-articles-title" className="text-xl font-black text-white sm:text-2xl">مقالات مرتبط</h2>
        <nav className="mt-3" aria-label="مقالات مرتبط">
          <ul className="divide-y divide-slate-800/80">
            {related.map(article => (
              <li key={article.id || article.slug}>
                <a href={`/article/${encodeURIComponent(String(article.slug))}`} className="block py-3 text-sm font-bold leading-7 text-slate-200 transition hover:text-[#14F195] sm:text-base">
                  {article.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </section>
  );
};

export const Footer: React.FC<FooterProps> = ({ onNavigate, openAdminModal }) => {
  const [articles, setArticles] = useState<PublicArticle[]>([]);
  const [pathname, setPathname] = useState(() => window.location.pathname.replace(/\/+$/, '') || '/');

  useEffect(() => {
    const nextPath = () => setPathname(window.location.pathname.replace(/\/+$/, '') || '/');
    window.addEventListener('popstate', nextPath);
    let cancelled = false;
    const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';

    if (!TOOL_KEYWORDS[currentPath]) {
      setArticles([]);
      return () => {
        cancelled = true;
        window.removeEventListener('popstate', nextPath);
      };
    }

    const loadArticles = async () => {
      try {
        const response = await fetch('/api/articles', {
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
          cache: 'no-store'
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        const items = Array.isArray(payload?.articles) ? payload.articles : [];
        if (!cancelled) setArticles(items);
      } catch (error) {
        console.warn('Related articles could not be loaded:', error);
        if (!cancelled) setArticles([]);
      }
    };

    void loadArticles();

    return () => {
      cancelled = true;
      window.removeEventListener('popstate', nextPath);
    };
  }, [pathname]);

  const handleNav = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-[#05050a] border-t border-white/[0.08] pt-16 pb-10 text-slate-300 text-xs sm:text-sm">
      {TOOL_KEYWORDS[pathname] && <ToolRelatedArticles articles={articles} pathname={pathname} />}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3 text-center md:text-right">
            <span className="font-bold text-white text-base block">دسترسی سریع و صفحات رسمی</span>
            <ul className="flex flex-wrap items-center justify-center md:justify-start gap-4 sm:gap-6 text-slate-200">
              <li><a href="/" onClick={(e) => { e.preventDefault(); handleNav('/'); }} className="hover:text-[#14F195] transition-colors cursor-pointer text-inherit decoration-none">صفحه اصلی</a></li>
              <li><a href="/app-guide" onClick={(e) => { e.preventDefault(); handleNav('/app-guide'); }} className="hover:text-[#14F195] transition-colors cursor-pointer text-inherit decoration-none font-bold">راهنمای کامل اپلیکیشن</a></li>
              <li><a href="/solana-wallet" onClick={(e) => { e.preventDefault(); handleNav('/solana-wallet'); }} className="hover:text-[#14F195] transition-colors cursor-pointer text-inherit decoration-none">کیف پول سولانا</a></li>
              <li><a href="/solana-token" onClick={(e) => { e.preventDefault(); handleNav('/solana-token'); }} className="hover:text-cyan-300 transition-colors cursor-pointer text-inherit decoration-none">ساخت توکن SPL</a></li>
              <li><a href="/solana-meme-coin" onClick={(e) => { e.preventDefault(); handleNav('/solana-meme-coin'); }} className="hover:text-amber-300 transition-colors cursor-pointer text-inherit decoration-none">ساخت میم کوین</a></li>
              <li><a href="/solana-nft" onClick={(e) => { e.preventDefault(); handleNav('/solana-nft'); }} className="hover:text-purple-300 transition-colors cursor-pointer text-inherit decoration-none">ساخت NFT سولانا</a></li>
              <li><a href="/security" onClick={(e) => { e.preventDefault(); handleNav('/security'); }} className="hover:text-emerald-400 transition-colors cursor-pointer text-inherit decoration-none">معماری امنیتی غیرامانی</a></li>
              <li><a href="/download" onClick={(e) => { e.preventDefault(); handleNav('/download'); }} className="hover:text-[#14F195] transition-colors cursor-pointer text-inherit decoration-none">دانلود اپلیکیشن اندروید</a></li>
              <li><a href="/faq" onClick={(e) => { e.preventDefault(); handleNav('/faq'); }} className="hover:text-sky-300 transition-colors cursor-pointer text-inherit decoration-none">سوالات متداول</a></li>
              <li><a href="/blog" onClick={(e) => { e.preventDefault(); handleNav('/blog'); }} className="hover:text-[#14F195] transition-colors cursor-pointer text-inherit decoration-none">وبلاگ و آکادمی (solmint.ir)</a></li>
              <li><a href="/tools/solana-token-tools" onClick={(e) => { e.preventDefault(); handleNav('/tools/solana-token-tools'); }} className="hover:text-[#14F195] transition-colors cursor-pointer text-inherit decoration-none font-bold">مرکز ابزارهای Solmint</a></li>
              <li><button onClick={openAdminModal} className="hover:text-emerald-400 transition-colors cursor-pointer flex items-center gap-1"><Lock className="w-3.5 h-3.5 text-emerald-400" /><span>ورود / ثبت‌نام</span></button></li>
            </ul>
          </div>
        </div>

        <div className="pt-2 flex flex-col items-center gap-3">
          <a href="https://www.producthunt.com/products/solmint-3?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-solmint-2" target="_blank" rel="noopener noreferrer" aria-label="Solmint on Product Hunt" className="inline-block transition-opacity hover:opacity-90">
            <img alt="solmint - solana web3 wallet | Product Hunt" width="250" height="54" src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1218856&theme=light&t=1786302074692" />
          </a>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" aria-label="GitHub" title="GitHub" className="flex items-center justify-center text-slate-300 hover:text-white transition-colors mt-1">
            <Github className="w-[54px] h-[54px]" aria-hidden="true" />
          </a>
        </div>

        <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-300 text-xs">
          <span className="w-full text-center sm:text-right leading-6 break-words [overflow-wrap:anywhere]">تمامی حقوق برای برند و پلتفرم سولمینت (solmint.ir) محفوظ است</span>
          <div className="w-full sm:w-auto flex items-center justify-center sm:justify-end gap-4 min-w-0">
            <span className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 font-mono text-slate-200 text-center leading-5 whitespace-nowrap">
              <span>Solmint Wallet —</span>
              <span>Official Android Web3 Platform</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
