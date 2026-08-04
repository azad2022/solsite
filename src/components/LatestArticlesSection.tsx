import React, { useState } from 'react';
import { Article } from '../types';
import { BookOpen, Clock, Eye, MessageSquare, ArrowLeft, Video, Sparkles, X, Copy, Check, Send } from 'lucide-react';
import { AuthorAvatar } from './AuthorAvatar';

interface LatestArticlesSectionProps {
  articles: Article[];
  setArticles: React.Dispatch<React.SetStateAction<Article[]>>;
  onGoToBlog: () => void;
}

export const LatestArticlesSection: React.FC<LatestArticlesSectionProps> = ({
  articles,
  setArticles,
  onGoToBlog
}) => {
  const [readingArticle, setReadingArticle] = useState<Article | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Take the 3 latest articles
  const latestArticles = articles.slice(0, 3);

  const handleOpenArticle = (art: Article) => {
    setReadingArticle(art);
    setArticles(prev => prev.map(a => a.id === art.id ? { ...a, viewsCount: a.viewsCount + 1 } : a));
  };

  const handleCopyArticleLink = (slug: string) => {
    const url = `https://solmint.ir/article/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <section className="py-20 border-b border-white/5 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Section Header */}
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

        {/* 3 Featured Articles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {latestArticles.map((art) => (
            <a
              key={art.id}
              href={`/article/${art.slug}`}
              onClick={(e) => {
                if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
                  e.preventDefault();
                  handleOpenArticle(art);
                }
              }}
              className="bg-[#101020]/80 border border-white/10 rounded-3xl overflow-hidden hover:border-[#9945FF]/50 transition-all duration-300 hover:-translate-y-1 cursor-pointer backdrop-blur-xl flex flex-col justify-between shadow-xl group block text-right decoration-none"
            >
              <div>
                {/* Image or Header Badge */}
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
                        <Video className="w-3 h-3" />
                        ویدیو
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
                        <Video className="w-3 h-3" />
                        ویدیو
                      </span>
                    )}
                  </div>
                )}

                {/* Body */}
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 font-medium">
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

              {/* Card Footer */}
              <div className="px-5 py-3.5 bg-black/40 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-300">{art.author.name}</span>
                <span className="flex items-center gap-1 text-sky-400 group-hover:text-[#14F195] font-bold transition-colors">
                  <span>مطالعه</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </span>
              </div>
            </a>
          ))}
        </div>

      </div>

      {/* Article Reader Modal */}
      {readingArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-[#101020] w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/15 p-6 sm:p-8 space-y-6 my-auto text-slate-200 shadow-2xl">
            
            {/* Modal Top Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full bg-[#9945FF]/20 text-[#14F195] text-xs font-bold border border-[#9945FF]/30">
                  {readingArticle.category}
                </span>
                <span className="text-xs text-slate-400 font-mono">{readingArticle.publishedAt}</span>
              </div>

              <button
                onClick={() => setReadingArticle(null)}
                className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
              {readingArticle.title}
            </h1>

            {/* Author bar & Share */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-black/40 border border-white/10">
              <div className="flex items-center gap-3">
                <AuthorAvatar author={readingArticle.author} size="lg" />
                <div>
                  <span className="text-xs font-bold text-white block">{readingArticle.author.name}</span>
                  <span className="text-[11px] text-slate-400">{readingArticle.author.role}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`https://t.me/share/url?url=https://solmint.ir/article/${readingArticle.slug}&text=${encodeURIComponent(readingArticle.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 text-xs font-semibold flex items-center gap-1.5 border border-sky-500/30 transition-colors"
                >
                  <Send className="w-3.5 h-3.5 text-sky-400" />
                  <span>اشتراک در تلگرام</span>
                </a>

                <button
                  onClick={() => handleCopyArticleLink(readingArticle.slug)}
                  className="px-3 py-1.5 rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 text-xs font-semibold flex items-center gap-1.5 border border-white/10 cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>کپی لینک</span>
                </button>
              </div>
            </div>

            {/* Cover Image */}
            {readingArticle.coverImage ? (
              <div className="rounded-2xl overflow-hidden border border-white/10">
                <img
                  src={readingArticle.coverImage}
                  alt={readingArticle.title}
                  className="w-full max-h-80 object-cover"
                />
              </div>
            ) : null}

            {/* MP4 Video Player if available */}
            {readingArticle.videoUrl && (
              <div className="space-y-2 p-4 rounded-2xl bg-black/50 border border-white/10">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 mb-2">
                  <Video className="w-4 h-4 text-emerald-400" />
                  <span>ویدیو آموزشی اختصاصی مقاله</span>
                </div>
                <video
                  controls
                  className="w-full rounded-xl max-h-80 bg-black"
                  src={readingArticle.videoUrl}
                >
                  مرورگر شما از ویدیو پشتیبانی نمی‌کند.
                </video>
              </div>
            )}

            {/* Content Text */}
            <div className="text-slate-200 text-sm sm:text-base leading-relaxed space-y-4 whitespace-pre-line bg-black/30 p-6 rounded-2xl border border-white/5">
              {readingArticle.content}
            </div>

            {/* Go to full blog button */}
            <div className="pt-2 text-center">
              <button
                onClick={() => {
                  setReadingArticle(null);
                  onGoToBlog();
                }}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-black font-extrabold text-xs inline-flex items-center gap-2 shadow-lg cursor-pointer"
              >
                <span>مشاهده آرشیو کامل و دیدگاه‌ها در وبلاگ</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      )}

    </section>
  );
};
