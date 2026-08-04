import React, { useEffect, useState } from 'react';
import { Article, ArticleComment, UserAccount } from '../types';
import { sanitizeText, safeSetLocalStorage } from '../utils/security';
import { addCommentApi } from '../utils/cmsApiClient';
import { renderMarkdownToHtml } from '../utils/markdownRenderer';
import { AuthorAvatar } from './AuthorAvatar';
import {
  Search,
  BookOpen,
  Clock,
  Eye,
  MessageSquare,
  Send,
  Copy,
  Check,
  Tag,
  User,
  X,
  ArrowLeft,
  Video,
  Lock,
  UserPlus,
  Sparkles
} from 'lucide-react';

interface BlogHubProps {
  articles: Article[];
  setArticles: React.Dispatch<React.SetStateAction<Article[]>>;
  currentUser: UserAccount | null;
  openAuthModal: () => void;
  initialArticleSlug?: string;
  onNavigate?: (path: string) => void;
}

export const BlogHub: React.FC<BlogHubProps> = ({
  articles,
  setArticles,
  currentUser,
  openAuthModal,
  initialArticleSlug,
  onNavigate
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('همه');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [readingArticle, setReadingArticle] = useState<Article | null>(null);
  const [commentText, setCommentText] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Sync the article reader with the real URL and prevent the background page
  // from scrolling while the reader is open, especially on mobile browsers.
  useEffect(() => {
    if (initialArticleSlug) {
      const matched = articles.find(a => a.slug === initialArticleSlug);
      if (matched) setReadingArticle(matched);
    }
  }, [initialArticleSlug, articles]);

  useEffect(() => {
    if (!readingArticle) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleCloseArticle();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [readingArticle]);

  const categories = ['همه', 'آموزش سولانا', 'توسعه وب۳', 'امنیت', 'اخبار و تحلیل'];
  const allTags = Array.from(new Set(articles.flatMap(a => a.tags)));

  const filteredArticles = articles.filter(art => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      art.title.toLowerCase().includes(query) ||
      art.summary.toLowerCase().includes(query) ||
      art.tags.some(t => t.toLowerCase().includes(query));
    const matchesCategory = selectedCategory === 'همه' || art.category === selectedCategory;
    const matchesTag = !selectedTag || art.tags.includes(selectedTag);
    return matchesSearch && matchesCategory && matchesTag;
  });

  const featuredArticle = filteredArticles[0] || articles[0];
  const gridArticles = filteredArticles.length > 1 ? filteredArticles.slice(1) : filteredArticles;

  const handleOpenArticle = (art: Article) => {
    setReadingArticle(art);
    const targetPath = `/article/${art.slug}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    onNavigate?.(targetPath);

    setArticles(prev => {
      const updated = prev.map(a => a.id === art.id ? { ...a, viewsCount: a.viewsCount + 1 } : a);
      localStorage.setItem('solmint_articles', JSON.stringify(updated));
      return updated;
    });
  };

  const handleCloseArticle = () => {
    setReadingArticle(null);
    const targetPath = '/blog';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    onNavigate?.(targetPath);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      openAuthModal();
      return;
    }

    const sanitizedText = sanitizeText(commentText);
    if (!sanitizedText || !readingArticle) return;

    const authorName = sanitizeText(currentUser.fullName || currentUser.username);
    const result = await addCommentApi({
      articleId: readingArticle.id,
      userName: authorName,
      userId: currentUser.id,
      text: sanitizedText
    });

    const newComment: ArticleComment = result.comment || {
      id: 'comment-' + Date.now(),
      userName: authorName,
      userId: currentUser.id,
      text: sanitizedText,
      createdAt: 'همین الان'
    };

    const updatedArticles = articles.map(a =>
      a.id === readingArticle.id
        ? { ...a, comments: [newComment, ...(a.comments || [])] }
        : a
    );

    setArticles(updatedArticles);
    safeSetLocalStorage('solmint_articles', updatedArticles);
    setReadingArticle(prev => prev ? { ...prev, comments: [newComment, ...(prev.comments || [])] } : null);
    setCommentText('');
  };

  const handleCopyArticleLink = async (slug: string) => {
    const url = `https://solmint.ir/article/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      setCopiedLink(false);
    }
  };

  return (
    <section className="py-16 bg-[#0f1117] border-b border-slate-800/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold">
            <BookOpen className="w-4 h-4 text-sky-400" />
            <span>رسانه و وبلاگ تخصصی سولمینت — solmint.ir</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white">
            مرکز آموزش و آکادمی <span className="text-gradient">وب۳ سولانا</span>
          </h2>
          <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto">
            تحلیل‌های تخصصی، آموزش توسعه قرارداد هوشمند، راه‌کارهای امنیت غیرامانی و تازه‌ترین اخبار اکوسیستم سولانا.
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-4">
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="جستجوی مقاله، عنوان، برچسب یا موضوع مورد نظر در solmint.ir..."
              className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl pr-12 pl-4 py-3.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-500/50 focus:outline-none transition-all shadow-lg"
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                    : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
              <span className="text-[11px] text-slate-500 flex items-center gap-1 ml-2 font-medium">
                <Tag className="w-3 h-3" /> برچسب‌ها:
              </span>
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors cursor-pointer ${
                    selectedTag === tag
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800/80'
                  }`}
                >
                  #{tag}
                </button>
              ))}
              {selectedTag && (
                <button onClick={() => setSelectedTag(null)} className="text-[11px] text-rose-400 hover:underline px-2">
                  حذف فیلتر برچسب
                </button>
              )}
            </div>
          )}
        </div>

        {featuredArticle && !searchQuery && selectedCategory === 'همه' && !selectedTag && (
          <a
            href={`/article/${featuredArticle.slug}`}
            onClick={e => {
              if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
                e.preventDefault();
                handleOpenArticle(featuredArticle);
              }
            }}
            className="glass-card rounded-3xl overflow-hidden border border-slate-700/80 hover:border-sky-500/50 transition-all cursor-pointer grid grid-cols-1 lg:grid-cols-12 gap-0 group glow-sky block text-right decoration-none"
          >
            <div className="lg:col-span-7 relative h-64 lg:h-auto overflow-hidden bg-slate-900">
              {featuredArticle.coverImage ? (
                <img src={featuredArticle.coverImage} alt={featuredArticle.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              ) : (
                <div className="w-full h-full min-h-[220px] bg-gradient-to-br from-slate-950 via-cyan-950/80 to-blue-950/80 p-8 flex flex-col justify-between border-b lg:border-b-0 lg:border-l border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/30">SOLMINT FEATURED</span>
                    <Sparkles className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs text-slate-400 font-bold block">{featuredArticle.category}</span>
                    <h3 className="text-xl sm:text-2xl font-extrabold text-white leading-tight">{featuredArticle.title}</h3>
                  </div>
                </div>
              )}
              <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-sky-500 text-white text-xs font-bold shadow-md">مقاله ویژه پلتفرم</div>
              {featuredArticle.videoUrl && (
                <div className="absolute bottom-4 right-4 px-2.5 py-1 rounded-lg bg-black/80 text-emerald-400 text-[11px] font-semibold flex items-center gap-1.5 backdrop-blur-md">
                  <Video className="w-3.5 h-3.5" />
                  <span>شامل ویدیو آموزشی</span>
                </div>
              )}
            </div>

            <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-medium">
                  <span className="text-sky-400 font-bold">{featuredArticle.category}</span>
                  <span>•</span>
                  <span className="font-mono text-slate-200">{featuredArticle.publishedAtJalali || featuredArticle.publishedAt}</span>
                  {featuredArticle.publishedAtGregorian && <span className="text-[11px] text-slate-400 font-mono">({featuredArticle.publishedAtGregorian})</span>}
                  <span>•</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-slate-400" />{featuredArticle.readTimeMinutes} دقیقه مطالعه</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-white group-hover:text-sky-300 transition-colors leading-snug">{featuredArticle.title}</h3>
                <p className="text-slate-300 text-xs sm:text-sm line-clamp-3 leading-relaxed">{featuredArticle.summary}</p>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5 min-w-0">
                  <AuthorAvatar author={featuredArticle.author} size="sm" />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-200 block truncate">{featuredArticle.author.name}</span>
                    <span className="text-[10px] text-slate-400 truncate block">{featuredArticle.author.role}</span>
                  </div>
                </div>
                <span className="text-xs font-bold text-sky-400 flex items-center gap-1 shrink-0">
                  مطالعه کامل مقاله <ArrowLeft className="w-4 h-4" />
                </span>
              </div>
            </div>
          </a>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {gridArticles.map(art => (
            <a
              key={art.id}
              href={`/article/${art.slug}`}
              onClick={e => {
                if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
                  e.preventDefault();
                  handleOpenArticle(art);
                }
              }}
              className="glass-card rounded-2xl overflow-hidden border border-slate-800 hover:border-slate-700 glass-card-hover cursor-pointer flex flex-col justify-between block text-right decoration-none group"
            >
              <div>
                {art.coverImage ? (
                  <div className="relative h-48 overflow-hidden bg-slate-900">
                    <img src={art.coverImage} alt={art.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                    <span className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-slate-900/90 text-sky-400 text-[11px] font-bold backdrop-blur-md border border-slate-800">{art.category}</span>
                    {art.videoUrl && <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 text-[10px] font-bold flex items-center gap-1 border border-emerald-500/30"><Video className="w-3 h-3" />ویدیو</span>}
                  </div>
                ) : (
                  <div className="pt-5 px-5 flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-400 text-[11px] font-bold border border-sky-500/30">{art.category}</span>
                    {art.videoUrl && <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 text-[10px] font-bold flex items-center gap-1 border border-emerald-500/30"><Video className="w-3 h-3" />ویدیو</span>}
                  </div>
                )}

                <div className="p-5 space-y-3">
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-medium">
                    <span className="font-mono text-slate-300">{art.publishedAtJalali || art.publishedAt}</span>
                    {art.publishedAtGregorian && <span className="text-[10px] text-slate-400 font-mono">({art.publishedAtGregorian})</span>}
                    <span>•</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{art.readTimeMinutes} دقیقه</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{art.viewsCount}</span>
                  </div>
                  <h3 className="font-bold text-base text-white hover:text-sky-300 transition-colors line-clamp-2 leading-snug">{art.title}</h3>
                  <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed">{art.summary}</p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {art.tags.map(tag => <span key={tag} className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">#{tag}</span>)}
                  </div>
                </div>
              </div>

              <div className="px-5 py-3 bg-slate-900/50 border-t border-slate-800/80 flex items-center justify-between gap-3 text-xs text-slate-400">
                <div className="flex items-center gap-2 min-w-0"><AuthorAvatar author={art.author} size="sm" /><span className="font-semibold text-slate-300 truncate">{art.author.name}</span></div>
                <span className="flex items-center gap-1 text-slate-400 shrink-0"><MessageSquare className="w-3.5 h-3.5 text-sky-400" />{art.comments.length} دیدگاه</span>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Article Reader */}
      {readingArticle && (
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4 overflow-y-auto overscroll-contain"
          role="dialog"
          aria-modal="true"
          aria-labelledby="article-reader-title"
          onMouseDown={e => {
            if (e.target === e.currentTarget) handleCloseArticle();
          }}
        >
          <article className="glass-card w-full max-w-5xl min-h-full sm:min-h-0 sm:max-h-[92vh] overflow-y-auto overscroll-contain rounded-none sm:rounded-3xl border-0 sm:border border-slate-700 p-4 sm:p-7 lg:p-10 space-y-5 sm:space-y-7 my-0 sm:my-auto text-slate-200 shadow-2xl">
            {/* Reader header */}
            <header className="flex items-start justify-between gap-3 pb-4 sm:pb-5 border-b border-slate-800">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0 pr-2">
                <span className="px-2.5 sm:px-3 py-1 rounded-full bg-sky-500/10 text-sky-400 text-[11px] sm:text-xs font-bold border border-sky-500/20">{readingArticle.category}</span>
                <span className="text-[11px] sm:text-xs text-slate-400 font-mono">{readingArticle.publishedAtJalali || readingArticle.publishedAt}</span>
                <span className="text-[11px] sm:text-xs text-slate-400 flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{readingArticle.viewsCount} بازدید</span>
              </div>
              <button
                type="button"
                onClick={handleCloseArticle}
                aria-label="بستن مقاله"
                className="shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            <h1 id="article-reader-title" className="text-[1.65rem] sm:text-4xl lg:text-[2.7rem] font-extrabold text-white leading-[1.45] sm:leading-tight break-words">
              {readingArticle.title}
            </h1>

            {/* Author and sharing actions */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-4 p-3.5 sm:p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
              <div className="flex items-center gap-3 min-w-0">
                <AuthorAvatar author={readingArticle.author} size="lg" />
                <div className="min-w-0">
                  <span className="text-xs font-bold text-white block truncate">{readingArticle.author.name}</span>
                  <span className="text-[11px] text-slate-400 block truncate">{readingArticle.author.role}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:flex items-stretch gap-2 w-full sm:w-auto">
                <a
                  href={`https://t.me/share/url?url=https://solmint.ir/article/${readingArticle.slug}&text=${encodeURIComponent(readingArticle.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="justify-center px-3 py-2.5 sm:py-1.5 rounded-xl bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 border border-sky-500/30 transition-colors"
                >
                  <Send className="w-3.5 h-3.5 text-sky-400" />
                  <span>اشتراک در تلگرام</span>
                </a>
                <button
                  type="button"
                  onClick={() => handleCopyArticleLink(readingArticle.slug)}
                  className="justify-center px-3 py-2.5 sm:py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'کپی شد' : 'کپی لینک'}</span>
                </button>
              </div>
            </div>

            {readingArticle.coverImage && (
              <figure className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
                <img
                  src={readingArticle.coverImage}
                  alt={readingArticle.title}
                  className="w-full max-h-[52vh] sm:max-h-[30rem] object-cover"
                />
              </figure>
            )}

            {readingArticle.videoUrl && (
              <div className="space-y-2 p-3 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 mb-2">
                  <Video className="w-4 h-4" />
                  <span>ویدیو آموزشی اختصاصی مقاله</span>
                </div>
                <video controls playsInline className="w-full rounded-xl max-h-[55vh] sm:max-h-96 bg-black" src={readingArticle.videoUrl}>
                  مرورگر شما از ویدیو پشتیبانی نمی‌کند.
                </video>
              </div>
            )}

            {/* Semantic article body: Markdown is rendered as real HTML for users and crawlers. */}
            <div
              className="article-content max-w-3xl mx-auto w-full bg-slate-900/40 p-4 sm:p-6 lg:p-8 rounded-2xl border border-slate-800/80 break-words"
              dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(readingArticle.content) }}
            />

            {/* Comments */}
            <div className="pt-5 sm:pt-7 border-t border-slate-800 space-y-5 sm:space-y-6">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-sky-400" />
                دیدگاه‌های کاربران ({readingArticle.comments.length})
              </h3>

              {currentUser ? (
                <form onSubmit={handleAddComment} className="p-3.5 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                    <span className="font-bold text-slate-300">ثبت دیدگاه جدید:</span>
                    <span className="text-[11px] text-[#14F195] font-semibold flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      دیدگاه از طرف: {currentUser.fullName}
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    required
                    placeholder={`پاسخ یا نظر خود را بنویسید آقای/خانم ${currentUser.fullName}...`}
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 resize-y min-h-28 focus:border-sky-500/50 focus:outline-none"
                  />
                  <div className="flex justify-end">
                    <button type="submit" className="btn-gradient px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer hover:scale-105 transition-all">ارسال دیدگاه</button>
                  </div>
                </form>
              ) : (
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-amber-500/30 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto"><Lock className="w-5 h-5" /></div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-white text-sm">جهت ثبت نظر باید ثبت‌نام کرده باشید</h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto leading-6">برای جلوگیری از اسپم و حفظ کیفیت گفتگوها، ثبت دیدگاه مستلزم داشتن حساب کاربری در وبسایت سولمینت است.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setReadingArticle(null);
                      openAuthModal();
                    }}
                    className="btn-gradient px-5 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer hover:scale-105 transition-all shadow-lg"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>ورود یا ثبت‌نام حساب کاربر</span>
                  </button>
                </div>
              )}

              <div className="space-y-3">
                {readingArticle.comments.map(c => (
                  <div key={c.id} className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs">
                      <span className="font-bold text-sky-400">{c.userName}</span>
                      <span className="text-[10px] text-slate-500">{c.createdAt}</span>
                    </div>
                    <p className="text-sm text-slate-300 pt-1 leading-7 break-words">{c.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </div>
      )}
    </section>
  );
};
