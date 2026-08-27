import React from 'react';
import { ArrowRight, BookOpen, Clock, Tag } from 'lucide-react';
import { Article } from '../types';
import { CATEGORY_SEO } from '../config/articleTaxonomy';
import { TAG_SEO } from '../config/tagSeo';
import { buildTaxonomyUrl, getArticleCategoryTaxonomy, getArticleTagTaxonomy } from '../utils/articleTaxonomy';
import { formatArticleDisplayDate, getArticleDateTime } from '../utils/articleDate';

interface ArticleTaxonomyPageProps {
  articles: Article[];
  type: 'category' | 'tag';
  slug: string;
  onNavigate: (path: string) => void;
}

export const ArticleTaxonomyPage: React.FC<ArticleTaxonomyPageProps> = ({ articles, type, slug, onNavigate }) => {
  const taxonomy = articles.flatMap(article => {
    if (type === 'category') {
      const item = getArticleCategoryTaxonomy(article.category);
      return item && item.slug === slug ? [item] : [];
    }
    return getArticleTagTaxonomy(article.tags).filter(item => item.slug === slug);
  })[0];

  const matchingArticles = articles.filter(article => {
    if (type === 'category') return getArticleCategoryTaxonomy(article.category)?.slug === slug;
    return getArticleTagTaxonomy(article.tags).some(item => item.slug === slug);
  });

  const name = taxonomy?.name || 'موضوع مورد نظر';
  const typeLabel = type === 'category' ? 'دسته‌بندی' : 'برچسب';
  const specialized = type === 'category' ? CATEGORY_SEO[slug] : TAG_SEO[slug];
  const h1 = specialized?.h1 || name;
  const intro = specialized?.intro || `مقالات مرتبط با ${typeLabel} «${name}» در آکادمی سولمینت.`;

  return (
    <section className="py-16 bg-[#0f1117] border-b border-slate-800/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav aria-label="مسیر صفحه" className="mb-8 text-xs text-slate-500 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => onNavigate('/')} className="hover:text-sky-400">خانه</button>
          <ArrowRight className="w-3.5 h-3.5 rotate-180" aria-hidden="true" />
          <button type="button" onClick={() => onNavigate('/blog')} className="hover:text-sky-400">وبلاگ</button>
          <ArrowRight className="w-3.5 h-3.5 rotate-180" aria-hidden="true" />
          <span className="text-slate-300">{name}</span>
        </nav>

        <header className="max-w-4xl mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold">
            {type === 'category' ? <BookOpen className="w-4 h-4" aria-hidden="true" /> : <Tag className="w-4 h-4" aria-hidden="true" />}
            {typeLabel}
          </div>
          <h1 className="mt-4 text-3xl sm:text-5xl font-black text-white leading-tight">{h1}</h1>
          <p className="mt-4 text-slate-400 leading-8 max-w-3xl">{intro}</p>
          {specialized?.relatedPage && (
            <div className="mt-5 rounded-2xl border border-[#14F195]/20 bg-[#14F195]/5 p-4">
              <p className="text-sm leading-7 text-slate-300">
                برای مشاهده داده‌های زنده بازار SOL و نمودار، <a href={specialized.relatedPage.href} onClick={event => { event.preventDefault(); onNavigate(specialized.relatedPage!.href); }} className="font-bold text-[#14F195] hover:underline">{specialized.relatedPage.anchor}</a> در دسترس است.
              </p>
            </div>
          )}
        </header>

        {matchingArticles.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-slate-400">مقاله‌ای در این {typeLabel} پیدا نشد.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {matchingArticles.map(article => {
              const articleTags = Array.isArray(article.tags) ? article.tags : [];
              return (
                <article key={article.id} className="glass-card rounded-2xl border border-slate-800 overflow-hidden flex flex-col">
                  {article.coverImage && <a href={`/article/${article.slug}`} onClick={event => { event.preventDefault(); onNavigate(`/article/${article.slug}`); }} className="block h-48 overflow-hidden bg-slate-900"><img src={article.coverImage} alt={article.title} loading="lazy" className="w-full h-full object-cover" /></a>}
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 mb-3"><time dateTime={getArticleDateTime(article) || undefined}>{formatArticleDisplayDate(article)}</time><span aria-hidden="true">•</span><span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" aria-hidden="true" />{article.readTimeMinutes} دقیقه مطالعه</span></div>
                    <h2 className="text-lg font-bold text-white leading-8"><a href={`/article/${article.slug}`} onClick={event => { event.preventDefault(); onNavigate(`/article/${article.slug}`); }} className="hover:text-sky-300 transition-colors">{article.title}</a></h2>
                    <p className="mt-2 text-sm text-slate-400 leading-7 line-clamp-3">{article.summary}</p>
                    <div className="mt-auto pt-4 flex flex-wrap gap-1.5">{articleTags.slice(0, 6).map(tag => { const item = getArticleTagTaxonomy([tag])[0]; if (!item) return null; return <a key={tag} href={buildTaxonomyUrl(item)} onClick={event => { event.preventDefault(); onNavigate(buildTaxonomyUrl(item)); }} className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-slate-400 hover:text-sky-300">#{tag}</a>; })}</div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
