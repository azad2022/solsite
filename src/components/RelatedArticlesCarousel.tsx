import React, { useMemo } from 'react';
import type { Article } from '../types';
import { getRelatedArticles } from '../utils/articleLinking';
import { AuthorAvatar } from './AuthorAvatar';
import { formatArticleDisplayDate, getArticleDateTime } from '../utils/articleDate';
import { ArrowLeft, Clock } from 'lucide-react';

type Props = {
  article: Article;
  articles: Article[];
  onNavigate?: (path: string) => void;
};

export const RelatedArticlesCarousel: React.FC<Props> = ({ article, articles, onNavigate }) => {
  const related = useMemo(() => getRelatedArticles(article, articles, 10), [article, articles]);

  if (!related.length) return null;

  return (
    <section className="my-10 border-t border-slate-800/70 pt-8" dir="rtl" aria-labelledby="related-articles-title">
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <h2 id="related-articles-title" className="text-xl sm:text-2xl font-black text-white">مقالات مرتبط</h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">مطالب مرتبط با همین موضوع برای مطالعه بیشتر</p>
        </div>
        <span className="hidden sm:block text-[11px] text-slate-600">حرکت افقی برای مشاهده بیشتر</span>
      </div>

      <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1 pb-2 [scrollbar-width:thin] [scrollbar-color:rgba(71,85,105,.7)_transparent]" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="flex w-max gap-4 pr-0">
          {related.map(relatedArticle => (
            <article key={relatedArticle.id || relatedArticle.slug} className="w-[290px] sm:w-[320px] shrink-0 snap-start overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 hover:border-slate-700 transition-colors">
              <a
                href={`/article/${encodeURIComponent(relatedArticle.slug)}`}
                onClick={event => {
                  if (!onNavigate || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                  event.preventDefault();
                  onNavigate(`/article/${relatedArticle.slug}`);
                }}
                className="block h-full text-right no-underline"
              >
                <div className="relative h-44 overflow-hidden bg-slate-950">
                  {relatedArticle.coverImage ? (
                    <img
                      src={relatedArticle.coverImage}
                      alt={relatedArticle.title}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800" />
                  )}
                  <span className="absolute right-3 top-3 rounded-lg border border-slate-800 bg-slate-950/85 px-2.5 py-1 text-[10px] font-bold text-sky-400 backdrop-blur-md">
                    {relatedArticle.category}
                  </span>
                </div>

                <div className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium text-slate-500">
                    <time dateTime={getArticleDateTime(relatedArticle) || undefined}>{formatArticleDisplayDate(relatedArticle)}</time>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{relatedArticle.readTimeMinutes} دقیقه</span>
                  </div>
                  <h3 className="line-clamp-2 text-base font-extrabold leading-7 text-white hover:text-sky-300 transition-colors">{relatedArticle.title}</h3>
                  <p className="line-clamp-2 text-xs leading-6 text-slate-400">{relatedArticle.summary}</p>

                  <div className="flex items-center justify-between gap-3 border-t border-slate-800 pt-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <AuthorAvatar author={relatedArticle.author} size="sm" />
                      <span className="truncate text-[11px] font-semibold text-slate-300">{relatedArticle.author.name}</span>
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-sky-400">مطالعه <ArrowLeft className="h-3.5 w-3.5" /></span>
                  </div>
                </div>
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
