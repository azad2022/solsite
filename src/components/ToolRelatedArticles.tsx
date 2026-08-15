import React, { useMemo } from 'react';
import type { Article } from '../types';

type ToolContext = 'token-tools' | 'token-scanner' | 'token-2022-inspector';

const CONTEXT_KEYWORDS: Record<ToolContext, string[]> = {
  'token-tools': ['سولانا', 'توکن', 'token-2022', 'spl token', 'mint', 'authority', 'امنیت'],
  'token-scanner': ['سولانا', 'توکن', 'token-2022', 'mint', 'mint authority', 'freeze authority', 'tokenomics', 'امنیت'],
  'token-2022-inspector': ['token-2022', 'سولانا', 'توکن', 'spl token', 'extension', 'transfer fee', 'transfer hook'],
};

function normalize(value: unknown) {
  return String(value ?? '').toLocaleLowerCase('fa-IR').replace(/\u200c/g, ' ').replace(/\s+/g, ' ').trim();
}

function scoreArticle(article: Article, keywords: string[]) {
  const text = normalize(`${article.title} ${article.summary} ${(article.tags || []).join(' ')} ${article.category}`);
  let score = 0;
  for (const keyword of keywords) {
    if (text.includes(normalize(keyword))) score += keyword.length > 8 ? 4 : 2;
  }
  return score;
}

export const ToolRelatedArticles: React.FC<{ articles: Article[]; context: ToolContext }> = ({ articles, context }) => {
  const related = useMemo(() => articles
    .filter(article => !article.isDraft && Boolean(article.slug) && Boolean(article.title))
    .map(article => ({ article, score: scoreArticle(article, CONTEXT_KEYWORDS[context]) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || String(a.article.title).localeCompare(String(b.article.title), 'fa'))
    .slice(0, 5)
    .map(item => item.article), [articles, context]);

  if (!related.length) return null;

  return (
    <section className="relative z-10 w-full border-t border-slate-800/60 bg-[#08080f] px-4 py-10 sm:px-6" dir="rtl" aria-labelledby="tool-related-articles-title">
      <div className="mx-auto w-full max-w-6xl rounded-3xl border border-slate-800/80 bg-slate-950/70 p-5 sm:p-7">
        <h2 id="tool-related-articles-title" className="text-xl font-black text-white sm:text-2xl">مقالات مرتبط</h2>
        <nav className="mt-4" aria-label="مقالات مرتبط">
          <ul className="divide-y divide-slate-800/80">
            {related.map(article => (
              <li key={article.id}>
                <a href={`/article/${encodeURIComponent(article.slug)}`} className="block py-3 text-sm font-bold leading-7 text-slate-200 transition hover:text-[#14F195] sm:text-base">
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
