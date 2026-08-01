import React, { useState } from 'react';
import { Article, ArticleComment, UserAccount } from '../types';
import { sanitizeText, safeSetLocalStorage } from '../utils/security';
import { addCommentApi } from '../utils/cmsApiClient';
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
  UserPlus
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

  // Sync initial article slug from URL
  React.useEffect(() => {
    if (initialArticleSlug) {
      const matched = articles.find(a => a.slug === initialArticleSlug);
      if (matched) {
        setReadingArticle(matched);
      }
    }
  }, [initialArticleSlug, articles]);

  // New Comment Form state
  const [commentText, setCommentText] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Categories list
  const categories = ['همه', 'آموزش سولانا', 'توسعه وب۳', 'امنیت', 'اخبار و تحلیل'];

  // All tags
  const allTags = Array.from(new Set(articles.flatMap(a => a.tags)));

  // Filter articles
  const filteredArticles = articles.filter(art => {
    const matchesSearch = 
      art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      art.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      art.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

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
    if (onNavigate) {
      onNavigate(targetPath);
    }
    // increment views
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
    if (onNavigate) {
      onNavigate(targetPath);
    }
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

    // Call real backend server API
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

    const updatedArticles = articles.map(a => {
      if (a.id === readingArticle.id) {
        return {
          ...a,
          comments: [newComment, ...(a.comments || [])]
        };
      }
      return a;
    });

    setArticles(updatedArticles);
    safeSetLocalStorage('solmint_articles', updatedArticles);
    setReadingArticle(prev => prev ? { ...prev, comments: [newComment, ...(prev.comments || [])] } : null);
    setCommentText('');
  };

  const handleCopyArticleLink = (slug: string) => {
    const url = `https://solmint.ir/article/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <section className="py-16 bg-[#0f1117] border-b border-slate-800/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">

        {/* Blog Section Header */}
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

        {/* Search Bar & Filters */}
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی مقاله، عنوان، برچسب یا موضوع مورد نظر در solmint.ir..."
              className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl pr-12 pl-4 py-3.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-500/50 focus:outline-none transition-all shadow-lg"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {categories.map((cat) => (
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

          {/* Tag Pills */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
              <span className="text-[11px] text-slate-500 flex items-center gap-1 ml-2 font-medium">
                <Tag className="w-3 h-3" /> برچسب‌ها:
              </span>
              {allTags.map((tag) => (
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
                <button
                  onClick={() => setSelectedTag(null)}
                  className="text-[11px] text-rose-400 hover:underline px-2"
                >
                  حذف فیلتر برچسب
                </button>
              )}
            </div>
          )}
        </div>

        {/* Featured Hero Article */}
        {featuredArticle && !searchQuery && selectedCategory === 'همه' && !selectedTag && (
          <a 
            href={`/article/${featuredArticle.slug}`}
            onClick={(e) => {
              if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
                e.preventDefault();
                handleOpenArticle(featuredArticle);
              }
            }}
            className="glass-card rounded-3xl overflow-hidden border border-slate-700/80 hover:border-sky-500/50 transition-all cursor-pointer grid grid-cols-1 lg:grid-cols-12 gap-0 group glow-sky block text-right decoration-none"
          >
            <div className="lg:col-span-7 relative h-64 lg:h-auto overflow-hidden">
              <img
                src={featuredArticle.coverImage}
                alt={featuredArticle.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-sky-500 text-white text-xs font-bold shadow-md">
                مقاله ویژه پلتفرم
              </div>
              {featuredArticle.videoUrl && (
                <div className="absolute bottom-4 right-4 px-2.5 py-1 rounded-lg bg-black/80 text-emerald-400 text-[11px] font-semibold flex items-center gap-1.5 backdrop-blur-md">
                  <Video className="w-3.5 h-3.5" />
                  <span>شامل ویدیو آموزشی</span>
                </div>
              )}
            </div>

            <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-xs text-slate-400 font-medium">
                  <span className="text-sky-400 font-bold">{featuredArticle.category}</span>
                  <span>•</span>
                  <span className="font-mono text-slate-200">{featuredArticle.publishedAtJalali || featuredArticle.publishedAt}</span>
                  {featuredArticle.publishedAtGregorian && (
                    <span className="text-[11px] text-slate-400 font-mono">({featuredArticle.publishedAtGregorian})</span>
                  )}
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {featuredArticle.readTimeMinutes} دقیقه مطالعه
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl font-extrabold text-white group-hover:text-sky-300 transition-colors leading-snug">
                  {featuredArticle.title}
                </h3>

                <p className="text-slate-300 text-xs sm:text-sm line-clamp-3 leading-relaxed">
                  {featuredArticle.summary}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <img
                    src={featuredArticle.author.avatar}
                    alt={featuredArticle.author.name}
                    className="w-8 h-8 rounded-full object-cover border border-slate-700"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">{featuredArticle.author.name}</span>
                    <span className="text-[10px] text-slate-400">{featuredArticle.author.role}</span>
                  </div>
                </div>

                <span className="text-xs font-bold text-sky-400 flex items-center gap-1 group-hover:translate-x-[-4px] transition-transform">
                  مطالعه کامل مقاله
                  <ArrowLeft className="w-4 h-4" />
                </span>
              </div>
            </div>
          </a>
        )}

        {/* Articles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {gridArticles.map((art) => (
            <a
              key={art.id}
              href={`/article/${art.slug}`}
              onClick={(e) => {
                if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
                  e.preventDefault();
                  handleOpenArticle(art);
                }
              }}
              className="glass-card rounded-2xl overflow-hidden border border-slate-800 hover:border-slate-700 glass-card-hover cursor-pointer flex flex-col justify-between block text-right decoration-none group"
            >
              <div>
                {/* Article Image */}
                <div className="relative h-48 overflow-hidden bg-slate-900">
                  <img
                    src={art.coverImage}
                    alt={art.title}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                  <span className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-slate-900/90 text-sky-400 text-[11px] font-bold backdrop-blur-md border border-slate-800">
                    {art.category}
                  </span>
                  {art.videoUrl && (
                    <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 text-[10px] font-bold flex items-center gap-1 border border-emerald-500/30">
                      <Video className="w-3 h-3" />
                      ویدیو
                    </span>
                  )}
                </div>

                {/* Article Body */}
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 font-medium">
                    <span className="font-mono text-slate-300">{art.publishedAtJalali || art.publishedAt}</span>
                    {art.publishedAtGregorian && (
                      <span className="text-[10px] text-slate-400 font-mono">({art.publishedAtGregorian})</span>
                    )}
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {art.readTimeMinutes} دقیقه
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" /> {art.viewsCount}
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-white hover:text-sky-300 transition-colors line-clamp-2 leading-snug">
                    {art.title}
                  </h3>

                  <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed">
                    {art.summary}
                  </p>

                  <div className="flex flex-wrap gap-1 pt-1">
                    {art.tags.map(tag => (
                      <span key={tag} className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="px-5 py-3 bg-slate-900/50 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-300">{art.author.name}</span>
                <span className="flex items-center gap-1 text-slate-400">
                  <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                  {art.comments.length} دیدگاه
                </span>
              </div>
            </a>
          ))}
        </div>

      </div>

      {/* Article Reader Modal */}
      {readingArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="glass-card w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-700 p-6 sm:p-10 space-y-6 my-auto text-slate-200">
            
            {/* Modal Top Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full bg-sky-500/10 text-sky-400 text-xs font-bold border border-sky-500/20">
                  {readingArticle.category}
                </span>
                <span className="text-xs text-slate-400 font-mono">{readingArticle.publishedAt}</span>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5 text-slate-400" /> {readingArticle.viewsCount} بازدید
                </span>
              </div>

              <button
                onClick={handleCloseArticle}
                className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight">
              {readingArticle.title}
            </h1>

            {/* Author bar & Share */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
              <div className="flex items-center gap-3">
                <img
                  src={readingArticle.author.avatar}
                  alt={readingArticle.author.name}
                  className="w-10 h-10 rounded-full object-cover border border-slate-700"
                />
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
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>کپی لینک</span>
                </button>
              </div>
            </div>

            {/* Cover Image */}
            <div className="rounded-2xl overflow-hidden border border-slate-800">
              <img
                src={readingArticle.coverImage}
                alt={readingArticle.title}
                className="w-full max-h-96 object-cover"
              />
            </div>

            {/* MP4 Video Player if available */}
            {readingArticle.videoUrl && (
              <div className="space-y-2 p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 mb-2">
                  <Video className="w-4 h-4 text-emerald-400" />
                  <span>ویدیو آموزشی اختصاصی مقاله</span>
                </div>
                <video
                  controls
                  className="w-full rounded-xl max-h-96 bg-black"
                  src={readingArticle.videoUrl}
                >
                  مرورگر شما از ویدیو پشتیبانی نمی‌کند.
                </video>
              </div>
            )}

            {/* Content Text */}
            <div className="prose prose-invert max-w-none text-slate-200 text-sm sm:text-base leading-relaxed space-y-4 whitespace-pre-line bg-slate-900/40 p-6 rounded-2xl border border-slate-800/80">
              {readingArticle.content}
            </div>

            {/* Comments Section */}
            <div className="pt-6 border-t border-slate-800 space-y-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-sky-400" />
                دیدگاه‌های کاربران ({readingArticle.comments.length})
              </h3>

              {/* Comment Submission Form */}
              {currentUser ? (
                <form onSubmit={handleAddComment} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-300">ثبت دیدگاه جدید:</span>
                    <span className="text-[11px] text-[#14F195] font-semibold flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      دیدگاه از طرف: {currentUser.fullName}
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    required
                    placeholder={`پاسخ یا نظر خود را بنویسید آقای/خانم ${currentUser.fullName}...`}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 resize-none focus:border-sky-500/50 focus:outline-none"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="btn-gradient px-5 py-2 rounded-xl text-xs font-bold cursor-pointer hover:scale-105 transition-all"
                    >
                      ارسال دیدگاه
                    </button>
                  </div>
                </form>
              ) : (
                <div className="p-5 rounded-2xl bg-slate-900/90 border border-amber-500/30 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-white text-sm">جهت ثبت نظر باید ثبت‌نام کرده باشید</h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      برای جلوگیری از اسپم و حفظ کیفیت گفتگوها، ثبت دیدگاه مستلزم داشتن حساب کاربری در وبسایت سولمینت است.
                    </p>
                  </div>
                  <button
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

              {/* Existing Comments List */}
              <div className="space-y-3">
                {readingArticle.comments.map(c => (
                  <div key={c.id} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-sky-400">{c.userName}</span>
                      <span className="text-[10px] text-slate-500">{c.createdAt}</span>
                    </div>
                    <p className="text-xs text-slate-300 pt-1">{c.text}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

    </section>
  );
};
