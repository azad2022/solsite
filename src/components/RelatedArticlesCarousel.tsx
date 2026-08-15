import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const AUTO_ADVANCE_MS = 4200;
const RESUME_AFTER_INTERACTION_MS = 1600;

export const RelatedArticlesCarousel: React.FC<Props> = ({ article, articles, onNavigate }) => {
  const related = useMemo(
    () => getRelatedArticles(article, articles.filter(candidate => !candidate.isDraft), 10),
    [article, articles]
  );
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const resumeTimerRef = useRef<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (related.length < 2) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduceMotion) return;

    const clearResumeTimer = () => {
      if (resumeTimerRef.current !== null) {
        window.clearTimeout(resumeTimerRef.current);
        resumeTimerRef.current = null;
      }
    };

    const pause = () => {
      clearResumeTimer();
      setIsPaused(true);
    };

    const resumeSoon = () => {
      clearResumeTimer();
      resumeTimerRef.current = window.setTimeout(() => {
        setIsPaused(false);
        resumeTimerRef.current = null;
      }, RESUME_AFTER_INTERACTION_MS);
    };

    const handlePointerDown = () => pause();
    const handlePointerUp = () => resumeSoon();
    const handleWheel = () => { pause(); resumeSoon(); };
    const handleFocusIn = () => pause();
    const handleFocusOut = () => resumeSoon();

    scroller.addEventListener('pointerdown', handlePointerDown, { passive: true });
    scroller.addEventListener('pointerup', handlePointerUp, { passive: true });
    scroller.addEventListener('pointercancel', handlePointerUp, { passive: true });
    scroller.addEventListener('wheel', handleWheel, { passive: true });
    scroller.addEventListener('focusin', handleFocusIn);
    scroller.addEventListener('focusout', handleFocusOut);

    return () => {
      clearResumeTimer();
      scroller.removeEventListener('pointerdown', handlePointerDown);
      scroller.removeEventListener('pointerup', handlePointerUp);
      scroller.removeEventListener('pointercancel', handlePointerUp);
      scroller.removeEventListener('wheel', handleWheel);
      scroller.removeEventListener('focusin', handleFocusIn);
      scroller.removeEventListener('focusout', handleFocusOut);
    };
  }, [related.length]);

  useEffect(() => () => {
    if (resumeTimerRef.current !== null) window.clearTimeout(resumeTimerRef.current);
  }, []);

  useEffect(() => {
    if (!related.length || isPaused) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduceMotion) return;

    const advance = () => {
      const firstCard = scroller.querySelector<HTMLElement>('[data-related-card]');
      if (!firstCard) return;

      const styles = window.getComputedStyle(firstCard.parentElement ?? scroller);
      const gap = Number.parseFloat(styles.columnGap || styles.gap || '0') || 0;
      const step = firstCard.offsetWidth + gap;
      const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
      if (maxScrollLeft <= 0) return;

      const nextPosition = Math.min(scroller.scrollLeft + step, maxScrollLeft);
      scroller.scrollTo({ left: nextPosition, behavior: 'smooth' });
      if (nextPosition >= maxScrollLeft - 2) setIsPaused(true);
    };

    const timer = window.setInterval(advance, AUTO_ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [isPaused, related.length]);

  if (!related.length) return null;

  return (
    <section className="my-10 border-t border-slate-800/70 pt-8" dir="rtl" aria-labelledby="related-articles-title">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 id="related-articles-title" className="text-xl font-black text-white sm:text-2xl">مقالات مرتبط</h2>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">مطالب مرتبط با همین موضوع برای مطالعه بیشتر</p>
        </div>
        <span className="hidden text-[11px] text-slate-600 sm:block">برای مشاهده موارد بیشتر به چپ یا راست حرکت کنید</span>
      </div>

      <div
        ref={scrollerRef}
        dir="ltr"
        className="-mx-1 overflow-x-auto overscroll-x-contain px-1 pb-2 snap-x snap-mandatory [scrollbar-color:rgba(71,85,105,.7)_transparent] [scrollbar-width:thin]"
        style={{ WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth' }}
        aria-label="مقالات مرتبط"
      >
        <div className="flex w-max gap-4">
          {related.map(relatedArticle => (
            <article
              key={relatedArticle.id || relatedArticle.slug}
              data-related-card
              dir="rtl"
              className="w-[290px] shrink-0 snap-start overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 transition-colors hover:border-slate-700 sm:w-[320px]"
            >
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
                  <h3 className="line-clamp-2 text-base font-extrabold leading-7 text-white transition-colors hover:text-sky-300">{relatedArticle.title}</h3>
                  <p className="line-clamp-2 text-xs leading-6 text-slate-400">{relatedArticle.summary}</p>

                  <div className="flex items-center justify-between gap-3 border-t border-slate-800 pt-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <AuthorAvatar author={relatedArticle.author} size="sm" />
                      <span className="truncate text-[11px] font-semibold text-slate-300">{relatedArticle.author.name}</span>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-sky-400">مطالعه <ArrowLeft className="h-3.5 w-3.5" /></span>
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
