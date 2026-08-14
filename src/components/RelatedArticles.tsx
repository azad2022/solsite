import React, { useMemo } from 'react';
import type { Article } from '../types';
import { getRelatedArticles } from '../utils/articleLinking';

interface Props {
  articles: Article[];
  context: 'token-tools' | 'token-scanner' | 'token-2022-inspector';
}

const contexts: Record<Props['context'], { title: string; category: Article['category']; tags: string[]; keywords: string[] }> = {
  'token-tools': {
    title: 'ابزارهای بررسی توکن سولانا',
    category: 'آموزش سولانا',
    tags: ['سولانا', 'توکن', 'Token-2022', 'امنیت'],
    keywords: ['توکن سولانا', 'Token-2022', 'SPL Token', 'Mint', 'Authority']
  },
  'token-scanner': {
    title: 'بررسی توکن سولانا',
    category: 'آموزش سولانا',
    tags: ['سولانا', 'توکن', 'Token-2022', 'امنیت'],
    keywords: ['توکن سولانا', 'Mint', 'Mint Authority', 'Freeze Authority', 'Tokenomics', 'امنیت توکن']
  },
  'token-2022-inspector': {
    title: 'بازرس Token-2022',
    category: 'آموزش سولانا',
    tags: ['سولانا', 'Token-2022', 'توکن', 'امنیت'],
    keywords: ['Token-2022', 'SPL Token', 'Extension', 'Transfer Fee', 'Transfer Hook']
  }
};

function makeContextArticle(context: Props['context']): Article {
  const item = contexts[context];
  return {
    id: `tool-context:${context}`,
    title: item.title,
    slug: '',
    category: item.category,
    tags: item.tags,
    summary: `${item.title} ${item.keywords.join(' ')}`,
    content: '',
    coverImage: '',
    author: { name: 'Solmint', role: 'Tool', avatar: '⚡' },
    publishedAt: new Date(0).toISOString(),
    readTimeMinutes: 0,
    viewsCount: 0,
    comments: [],
    isDraft: false
  };
}

export const RelatedArticles: React.FC<Props> = ({ articles, context }) => {
  const related = useMemo(() => {
    const source = makeContextArticle(context);
    const ranked = getRelatedArticles(source, articles, 5);
    const contextKeywords = contexts[context].keywords.map(keyword => keyword.toLocaleLowerCase('fa-IR'));

    return articles
      .filter(article => !article.isDraft && article.slug)
      .filter(article => !ranked.some(item => item.id === article.id))
      .map(article => {
        const text = `${article.title} ${article.summary} ${article.tags.join(' ')}`.toLocaleLowerCase('fa-IR');
        const contextScore = contextKeywords.reduce((score, keyword) => score + (text.includes(keyword) ? 6 : 0), 0);
        return { article, score: contextScore };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(0, 5 - ranked.length))
      .map(item => item.article)
      .concat(ranked)
      .slice(0, 5);
  }, [articles, context]);

  if (related.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6" aria-labelledby="related-articles-title">
      <div className="rounded-3xl border border-slate-800/80 bg-slate-950/70 p-5 sm:p-7">
        <h2 id="related-articles-title" className="text-xl font-black text-white sm:text-2xl">
          مقالات مرتبط
        </h2>
        <nav className="mt-4" aria-label="مقالات مرتبط">
          <ul className="divide-y divide-slate-800/80">
            {related.map(article => (
              <li key={article.id}>
                <a
                  href={`/article/${encodeURIComponent(article.slug)}`}
                  className="block py-3 text-sm font-bold leading-7 text-slate-200 transition hover:text-[#14F195] sm:text-base"
                >
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
