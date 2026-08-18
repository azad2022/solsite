import React, { useEffect, useMemo, useState } from 'react';
import { Article, ArticleComment, UserAccount } from '../../types';
import { sanitizeText, safeSetLocalStorage } from '../../utils/security';
import { addCommentApi } from '../../utils/cmsApiClient';
import { renderMarkdownToHtml } from '../../utils/markdownRenderer';
import { AuthorAvatar } from '../AuthorAvatar';
import { Search, BookOpen, Clock, MessageSquare, Send, Copy, Check, Tag, User, X, ArrowLeft, Video, Lock, UserPlus, Sparkles } from 'lucide-react';

interface EnglishBlogHubProps {
  articles: Article[];
  setArticles: React.Dispatch<React.SetStateAction<Article[]>>;
  currentUser: UserAccount | null;
  openAuthModal: () => void;
  initialArticleSlug?: string;
  onNavigate: (path: string) => void;
}

const formatDate = (article: Article) => {
  const date = new Date(article.publishedAt || Date.now());
  return Number.isNaN(date.getTime()) ? article.publishedAtGregorian || article.publishedAt : new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date);
};

export const EnglishBlogHub: React.FC<EnglishBlogHubProps> = ({ articles, setArticles, currentUser, openAuthModal, initialArticleSlug, onNavigate }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [readingArticle, setReadingArticle] = useState<Article | null>(null);
  const [commentText, setCommentText] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const categories = ['All', 'Solana Education', 'Web3 Development', 'Security', 'News & Analysis', 'Trading'];
  const allTags = useMemo(() => Array.from(new Set(articles.flatMap(article => article.tags))), [articles]);

  useEffect(() => {
    if (!initialArticleSlug) { setReadingArticle(null); return; }
    setReadingArticle(articles.find(article => article.slug === initialArticleSlug) || null);
  }, [initialArticleSlug, articles]);

  useEffect(() => {
    if (!readingArticle) return;
    const handleKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setReadingArticle(null); onNavigate('/en/blog'); } };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [readingArticle, onNavigate]);

  const filteredArticles = articles.filter(article => {
    const query = searchQuery.trim().toLowerCase();
    const categoryMap: Record<string, string> = {
      'Solana Education': 'آموزش سولانا',
      'Web3 Development': 'توسعه وب۳',
      'Security': 'امنیت',
      'News & Analysis': 'اخبار و تحلیل',
      'Trading': 'ترید'
    };
    const matchesSearch = !query || article.title.toLowerCase().includes(query) || article.summary.toLowerCase().includes(query) || article.tags.some(tag => tag.toLowerCase().includes(query));
    const matchesCategory = selectedCategory === 'All' || article.category === categoryMap[selectedCategory] || article.category === selectedCategory;
    const matchesTag = !selectedTag || article.tags.includes(selectedTag);
    return matchesSearch && matchesCategory && matchesTag;
  });

  const featuredArticle = filteredArticles[0] || articles[0];
  const gridArticles = filteredArticles.length > 1 ? filteredArticles.slice(1) : filteredArticles;

  const openArticle = (article: Article) => {
    setReadingArticle(article);
    onNavigate(`/en/articles/${encodeURIComponent(article.slug)}`);
    setArticles(previous => {
      const updated = previous.map(item => item.id === article.id ? { ...item, viewsCount: item.viewsCount + 1 } : item);
      safeSetLocalStorage('solmint_articles_en', updated);
      return updated;
    });
  };

  const closeArticle = () => { setReadingArticle(null); onNavigate('/en/blog'); };

  const handleAddComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser) { openAuthModal(); return; }
    const text = sanitizeText(commentText);
    if (!text || !readingArticle) return;
    const authorName = sanitizeText(currentUser.fullName || currentUser.username);
    const result = await addCommentApi({ articleId: readingArticle.id, userName: authorName, userId: currentUser.id, text });
    const comment: ArticleComment = result.comment || { id: `comment-${Date.now()}`, userName: authorName, userId: currentUser.id, text, createdAt: new Date().toISOString() };
    const updated = articles.map(article => article.id === readingArticle.id ? { ...article, comments: [comment, ...(article.comments || [])] } : article);
    setArticles(updated);
    safeSetLocalStorage('solmint_articles_en', updated);
    setReadingArticle(current => current ? { ...current, comments: [comment, ...(current.comments || [])] } : null);
    setCommentText('');
  };

  const copyLink = async (slug: string) => {
    const url = `https://solmint.ir/en/articles/${encodeURIComponent(slug)}`;
    try { await navigator.clipboard.writeText(url); setCopiedLink(true); window.setTimeout(() => setCopiedLink(false), 2000); } catch { setCopiedLink(false); }
  };

  return (
    <section dir="ltr" className="py-16 bg-[#0f1117] border-b border-slate-800/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold"><BookOpen className="w-4 h-4" /><span>Solmint Research & Web3 Academy</span></div>
          <h1 className="text-3xl sm:text-5xl font-black text-white">Solana <span className="text-gradient">Web3 Academy</span></h1>
          <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto">Research, practical Solana education, Web3 security and ecosystem coverage from Solmint.</p>
        </div>

        <div className="max-w-4xl mx-auto space-y-4">
          <div className="relative"><Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" aria-hidden="true" /><input type="search" aria-label="Search articles" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search articles, topics, tags or keywords..." className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-500/50 focus:outline-none transition-all shadow-lg" /></div>
          <div className="flex flex-wrap items-center justify-center gap-2" aria-label="Article categories">{categories.map(category => <button key={category} type="button" onClick={() => setSelectedCategory(category)} aria-pressed={selectedCategory === category} className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${selectedCategory === category ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20' : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'}`}>{category}</button>)}</div>
          {allTags.length > 0 && <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1"><span className="text-[11px] text-slate-500 flex items-center gap-1 mr-2 font-medium"><Tag className="w-3 h-3" /> Tags:</span>{allTags.map(tag => <button key={tag} type="button" onClick={() => setSelectedTag(selectedTag === tag ? null : tag)} aria-pressed={selectedTag === tag} className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors cursor-pointer ${selectedTag === tag ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800/80'}`}>#{tag}</button>)}{selectedTag && <button type="button" onClick={() => setSelectedTag(null)} className="text-[11px] text-rose-400 hover:underline px-2">Clear tag filter</button>}</div>}
        </div>

        {featuredArticle && !searchQuery && selectedCategory === 'All' && !selectedTag && <a href={`/en/articles/${encodeURIComponent(featuredArticle.slug)}`} onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey) { event.preventDefault(); openArticle(featuredArticle); } }} className="glass-card rounded-3xl overflow-hidden border border-slate-700/80 hover:border-sky-500/50 transition-all cursor-pointer grid grid-cols-1 lg:grid-cols-12 gap-0 group glow-sky block text-left decoration-none">
          <div className="lg:col-span-7 relative h-64 lg:h-auto overflow-hidden bg-slate-900">{featuredArticle.coverImage ? <img src={featuredArticle.coverImage} alt={featuredArticle.title} fetchPriority="high" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <div className="w-full h-full min-h-[220px] bg-gradient-to-br from-slate-950 via-cyan-950/80 to-blue-950/80 p-8 flex flex-col justify-between"><div className="flex items-center justify-between"><span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/30">SOLMINT FEATURED</span><Sparkles className="w-5 h-5 text-cyan-400" /></div><div className="space-y-2"><span className="text-xs text-slate-400 font-bold block">{featuredArticle.category}</span><h2 className="text-xl sm:text-2xl font-extrabold text-white leading-tight">{featuredArticle.title}</h2></div></div>}<div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-sky-500 text-white text-xs font-bold shadow-md">Featured article</div>{featuredArticle.videoUrl && <div className="absolute bottom-4 left-4 px-2.5 py-1 rounded-lg bg-black/80 text-emerald-400 text-[11px] font-semibold flex items-center gap-1.5 backdrop-blur-md"><Video className="w-3.5 h-3.5" /><span>Video</span></div>}</div>
          <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between space-y-4"><div className="space-y-3"><div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-medium"><span className="text-sky-400 font-bold">{featuredArticle.category}</span><span>•</span><time dateTime={featuredArticle.publishedAt || undefined} className="font-mono text-slate-200">{formatDate(featuredArticle)}</time><span>•</span><span className="flex items-center gap-1"><Clock className="w-3 h-3" />{featuredArticle.readTimeMinutes} min read</span></div><h2 className="text-xl sm:text-2xl font-extrabold text-white group-hover:text-sky-300 transition-colors leading-snug">{featuredArticle.title}</h2><p className="text-slate-300 text-xs sm:text-sm line-clamp-3 leading-relaxed">{featuredArticle.summary}</p></div><div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-4"><div className="flex items-center gap-2.5 min-w-0"><AuthorAvatar author={featuredArticle.author} size="sm" /><div className="min-w-0"><span className="text-xs font-bold text-slate-200 block truncate">{featuredArticle.author.name}</span><span className="text-[10px] text-slate-400 truncate block">{featuredArticle.author.role}</span></div></div><span className="text-xs font-bold text-sky-400 flex items-center gap-1 shrink-0">Read article <ArrowLeft className="w-4 h-4" /></span></div></div>
        </a>}

        {articles.length === 0 && <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-10 text-center"><BookOpen className="w-10 h-10 text-slate-600 mx-auto" /><h2 className="mt-4 text-xl font-black text-white">English articles are being added</h2><p className="mt-2 text-sm leading-7 text-slate-400 max-w-xl mx-auto">The English content layer is ready. New English articles will appear here as they are published and linked to their Persian counterparts.</p></div>}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{gridArticles.map(article => <a key={article.id} href={`/en/articles/${encodeURIComponent(article.slug)}`} onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey) { event.preventDefault(); openArticle(article); } }} className="glass-card rounded-2xl overflow-hidden border border-slate-800 hover:border-slate-700 glass-card-hover cursor-pointer flex flex-col justify-between block text-left decoration-none group"><div>{article.coverImage ? <div className="relative h-48 overflow-hidden bg-slate-900"><img src={article.coverImage} alt={article.title} loading="lazy" decoding="async" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" /><span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-slate-900/90 text-sky-400 text-[11px] font-bold backdrop-blur-md border border-slate-800">{article.category}</span>{article.videoUrl && <span className="absolute bottom-3 left-3 px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 text-[10px] font-bold flex items-center gap-1 border border-emerald-500/30"><Video className="w-3 h-3" />Video</span>}</div> : <div className="pt-5 px-5"><span className="px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-400 text-[11px] font-bold border border-sky-500/30">{article.category}</span></div>}<div className="p-5 space-y-3"><div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-medium"><time dateTime={article.publishedAt || undefined} className="font-mono text-slate-300">{formatDate(article)}</time><span>•</span><span className="flex items-center gap-1"><Clock className="w-3 h-3" />{article.readTimeMinutes} min read</span></div><h3 className="font-bold text-base text-white hover:text-sky-300 transition-colors line-clamp-2 leading-snug">{article.title}</h3><p className="text-slate-400 text-xs line-clamp-2 leading-relaxed">{article.summary}</p><div className="flex flex-wrap gap-1 pt-1">{article.tags.map(tag => <span key={tag} className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">#{tag}</span>)}</div></div></div><div className="px-5 py-3 bg-slate-900/50 border-t border-slate-800/80 flex items-center justify-between gap-3 text-xs text-slate-400"><div className="flex items-center gap-2 min-w-0"><AuthorAvatar author={article.author} size="sm" /><span className="font-semibold text-slate-300 truncate">{article.author.name}</span></div><span className="flex items-center gap-1 text-slate-400 shrink-0"><MessageSquare className="w-3.5 h-3.5 text-sky-400" />{article.comments.length}</span></div></a>)}</div>
      </div>

      {readingArticle && <div className="fixed inset-0 z-30 flex items-start sm:items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4 overflow-y-auto overscroll-auto" role="dialog" aria-modal="true" aria-labelledby="article-reader-title" onMouseDown={event => { if (event.target === event.currentTarget) closeArticle(); }}><article className="glass-card w-full max-w-5xl min-h-full sm:min-h-0 sm:max-h-[92vh] overflow-y-auto rounded-none sm:rounded-3xl border-0 sm:border border-slate-700 p-4 sm:p-7 lg:p-10 space-y-5 sm:space-y-7 my-0 sm:my-auto text-slate-200 shadow-2xl" itemScope itemType="https://schema.org/Article">
        <header className="flex items-start justify-between gap-3 pb-4 sm:pb-5 border-b border-slate-800"><div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0"><span className="px-2.5 sm:px-3 py-1 rounded-full bg-sky-500/10 text-sky-400 text-[11px] sm:text-xs font-bold border border-sky-500/20">{readingArticle.category}</span></div><button type="button" onClick={closeArticle} aria-label="Close article and return to blog" className="shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer flex items-center justify-center"><X className="w-5 h-5" /></button></header>
        <h2 id="article-reader-title" itemProp="headline" className="text-[1.65rem] sm:text-4xl lg:text-[2.7rem] font-extrabold text-white leading-[1.45] sm:leading-tight break-words">{readingArticle.title}</h2>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-4 p-3.5 sm:p-4 rounded-2xl bg-slate-900/80 border border-slate-800"><div className="flex items-center gap-3 min-w-0"><AuthorAvatar author={readingArticle.author} size="lg" /><div className="min-w-0"><span className="text-xs font-bold text-white block truncate" itemProp="author">{readingArticle.author.name}</span><span className="text-[11px] text-slate-400 block truncate">{readingArticle.author.role}</span></div></div><div className="grid grid-cols-2 sm:flex items-stretch gap-2 w-full sm:w-auto"><a href={`https://t.me/share/url?url=https://solmint.ir/en/articles/${encodeURIComponent(readingArticle.slug)}&text=${encodeURIComponent(readingArticle.title)}`} target="_blank" rel="noopener noreferrer" className="justify-center px-3 py-2.5 sm:py-1.5 rounded-xl bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 border border-sky-500/30 transition-colors"><Send className="w-3.5 h-3.5 text-sky-400" /><span>Share</span></a><button type="button" onClick={() => copyLink(readingArticle.slug)} className="justify-center px-3 py-2.5 sm:py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 border border-slate-700 cursor-pointer">{copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}<span>{copiedLink ? 'Copied' : 'Copy link'}</span></button></div><div className="w-full pt-3 border-t border-slate-800 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] sm:text-xs text-slate-400"><time dateTime={readingArticle.publishedAt || undefined} itemProp="datePublished" className="inline-flex items-center gap-1.5"><span aria-hidden="true">📅</span>{formatDate(readingArticle)}</time><span className="inline-flex items-center gap-1.5" itemProp="timeRequired"><Clock className="w-3.5 h-3.5" /><span>{readingArticle.readTimeMinutes} min read</span></span></div></div>
        {readingArticle.coverImage && <figure className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-950"><img src={readingArticle.coverImage} alt={readingArticle.title} itemProp="image" loading="eager" decoding="async" className="w-full max-h-[52vh] sm:max-h-[30rem] object-cover" /></figure>}
        {readingArticle.videoUrl && <div className="space-y-2 p-3 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800"><div className="flex items-center gap-2 text-xs font-bold text-emerald-400 mb-2"><Video className="w-4 h-4" /><span>Article video</span></div><video controls playsInline className="w-full rounded-xl max-h-[55vh] sm:max-h-96 bg-black" src={readingArticle.videoUrl}>Your browser does not support video playback.</video></div>}
        <div className="article-content max-w-3xl mx-auto w-full bg-slate-900/40 p-4 sm:p-6 lg:p-8 rounded-2xl border border-slate-800/80 break-words" itemProp="articleBody" dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(readingArticle.content) }} />
        <div className="pt-5 sm:pt-7 border-t border-slate-800 space-y-5 sm:space-y-6"><h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2"><MessageSquare className="w-5 h-5 text-sky-400" />Comments ({readingArticle.comments.length})</h3>
          {currentUser ? <form onSubmit={handleAddComment} className="p-3.5 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3"><div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs"><span className="font-bold text-slate-300">Add a comment:</span><span className="text-[11px] text-[#14F195] font-semibold flex items-center gap-1"><User className="w-3.5 h-3.5" />Posting as {currentUser.fullName}</span></div><textarea rows={4} required placeholder={`Write your comment, ${currentUser.fullName}...`} value={commentText} onChange={event => setCommentText(event.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 resize-y min-h-28 focus:border-sky-500/50 focus:outline-none" /><div className="flex justify-end"><button type="submit" className="btn-gradient px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer">Post comment</button></div></form> : <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-amber-500/30 text-center space-y-3"><div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto"><Lock className="w-5 h-5" /></div><div className="space-y-1"><h4 className="font-bold text-white text-sm">Sign in to comment</h4><p className="text-xs text-slate-400 max-w-md mx-auto leading-6">Commenting is currently protected by the existing Solmint account system.</p></div><button type="button" onClick={openAuthModal} className="btn-gradient px-5 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-lg"><UserPlus className="w-4 h-4" />Sign in or create an account</button></div>}
          <div className="space-y-3">{readingArticle.comments.map(comment => <div key={comment.id} className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1"><div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs"><span className="font-bold text-sky-400">{comment.userName}</span><span className="text-[10px] text-slate-500">{comment.createdAt}</span></div><p className="text-sm text-slate-300 pt-1 leading-7 break-words">{comment.text}</p></div>)}</div>
        </div>
      </article></div>}
    </section>
  );
};
