import React from 'react';
import { Article } from '../types';
import { BookOpen, Clock, Eye, ArrowLeft, Video } from 'lucide-react';
import { AuthorAvatar } from './AuthorAvatar';

interface LatestArticlesSectionProps {
  articles: Article[];
  setArticles: React.Dispatch<React.SetStateAction<Article[]>>;
  onGoToBlog: () => void;
}

/**
 * Homepage article preview.
 *
 * Article reading is intentionally handled by BlogHub so there is only one
 * article-reader implementation across the site. The homepage cards now
 * navigate to the real /article/:slug route instead of opening a second,
 * phone-like modal reader.
 */
export const LatestArticlesSection: React.FC<LatestArticlesSectionProps> = ({
  articles,
  onGoToBlog
}) => {
  const latestArticles = articles.slice(0, 3);

  const navigateToArticle = (art: Article) => {
    const path = `/article/${art.slug}`;
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  return (
    <section className="py-20 border-b border-white/5 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-2 border-b border-white/5">
          <div className="space-y-2 text-center md:text-right">
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              آخرین <span className="bg-gradient-to-r from-[#9945FF] to-[#14F195] bg-clip-text text-transparent">آموزش‌ها و تحلیل‌ها</span>
            </h2>
          </div>

          <button
            onClick={onGoToBlog}
            className="px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer group hover:border-[#14F195]/40"
          >
            <span>ورود به آرشیو کامل وبلاگ</span>
            <ArrowLeft className="w-4 h-4 text-[#14F195] group-hover:-translate-x-1 transition-transform" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {latestArticles.map(art => (
            <a
              key={art.id}
              href={`/article/${art.slug}`}
              onClick={e => {
                if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                  e.preventDefault();
                  navigateToArticle(art);
                }
              }}
              className="bg-[#101020]/80 border border-white/10 rounded-3xl overflow-hidden hover:border-[#9945FF]/50 transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col justify-between shadow-xl group block text-right decoration-none"
            >
              <div>
                {art.coverImage ? (
                  <div className="relative h-48 overflow-hidden bg-slate-900">
                    <img
                      src={art.coverImage}
                      alt={art.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/80 text-[#14F195] text-[10px] font-mono font-bold backdrop-blur-md border border-white/10">
                      {art.category}
                    </span>
                    {art.videoUrl && (
                      <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 text-[10px] font-bold flex items-center gap-1 border border-emerald-500/30">
                        <Video className="w-3 h-3" /> ویدیو
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="pt-5 px-5 flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full bg-[#14F195]/10 text-[#14F195] text-[10px] font-mono font-bold border border-[#14F195]/30">
                      {art.category}
                    </span>
                    {art.videoUrl && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 text-[10px] font-bold flex items-center gap-1 border border-emerald-500/30">
                        <Video className="w-3 h-3" /> ویدیو
                      </span>
                    )}
                  </div>
                )}

                <div className="p-5 space-y-3">
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-medium">
                    <span className="font-mono text-slate-300">{art.publishedAtJalali || art.publishedAt}</span>
                    {art.publishedAtGregorian && (
                      <span className="text-[10px] text-slate-400 font-mono">({art.publishedAtGregorian})</span>
                    )}
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" /> {art.readTimeMinutes} دقیقه
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3 text-[#14F195]" /> {art.viewsCount}
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-white group-hover:text-[#14F195] transition-colors line-clamp-2 leading-snug">
                    {art.title}
                  </h3>

                  <p className="text-slate-300 text-xs line-clamp-2 leading-relaxed">
                    {art.summary}
                  </p>
                </div>
              </div>

              <div className="px-5 py-3.5 bg-black/40 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-2 min-w-0">
                  <AuthorAvatar author={art.author} size="sm" />
                  <span className="font-semibold text-slate-300 truncate">{art.author.name}</span>
                </div>
                <span className="flex items-center gap-1 text-sky-400 group-hover:text-[#14F195] font-bold transition-colors">
                  <span>مطالعه</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};
