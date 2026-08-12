import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, EyeOff, MessageSquare, RefreshCw, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import type { Article } from '../types';
import { approveCommentApi, deleteCommentApi, fetchCommentsForAdminApi, type ModerationComment } from '../utils/cmsApiClient';

interface Props {
  articles: Article[];
}

export const CommentsModerationPanel: React.FC<Props> = ({ articles }) => {
  const [comments, setComments] = useState<ModerationComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all');
  const [notice, setNotice] = useState<{ success: boolean; message: string } | null>(null);

  const loadComments = useCallback(async () => {
    setLoading(true);
    const result = await fetchCommentsForAdminApi();
    if (result.success) {
      setComments(result.comments);
      setNotice(null);
    } else {
      setNotice({ success: false, message: result.message || 'دریافت دیدگاه‌های مدیریت ناموفق بود.' });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  const articleTitles = useMemo(() => {
    const map = new Map<string, string>();
    articles.forEach(article => {
      map.set(String(article.id), article.title);
      if (article.slug) map.set(String(article.slug), article.title);
    });
    return map;
  }, [articles]);

  const visibleComments = useMemo(() => {
    if (filter === 'pending') return comments.filter(comment => comment.approved !== true);
    if (filter === 'approved') return comments.filter(comment => comment.approved === true);
    return comments;
  }, [comments, filter]);

  const pendingCount = comments.filter(comment => comment.approved !== true).length;
  const approvedCount = comments.filter(comment => comment.approved === true).length;

  const moderate = async (comment: ModerationComment, approved: boolean) => {
    setBusyId(comment.id);
    setNotice(null);
    const result = await approveCommentApi(comment.id, approved);
    if (result.success) {
      setComments(current => current.map(item => item.id === comment.id ? { ...item, approved } : item));
      setNotice({ success: true, message: approved ? 'دیدگاه با موفقیت منتشر شد.' : 'دیدگاه از انتشار خارج شد.' });
    } else {
      setNotice({ success: false, message: result.message || 'تغییر وضعیت دیدگاه انجام نشد.' });
    }
    setBusyId(null);
  };

  const remove = async (comment: ModerationComment) => {
    if (!window.confirm('این دیدگاه و پاسخ‌های وابسته به آن حذف شوند؟')) return;
    setBusyId(comment.id);
    setNotice(null);
    const ok = await deleteCommentApi(comment.id);
    if (ok) {
      setComments(current => current.filter(item => item.id !== comment.id && item.parentId !== comment.id));
      setNotice({ success: true, message: 'دیدگاه حذف شد.' });
    } else {
      setNotice({ success: false, message: 'حذف دیدگاه در سرور انجام نشد.' });
    }
    setBusyId(null);
  };

  return (
    <div className="space-y-5 text-xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-sky-950/70 via-slate-900 to-emerald-950/60 border border-sky-500/20">
        <div>
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-sky-400" />
            مدیریت واقعی دیدگاه‌های وبلاگ
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">فهرست مستقیماً از production خوانده می‌شود و عملیات تأیید/مخفی‌سازی/حذف فقط از طریق API امن سرور انجام می‌گیرد.</p>
        </div>
        <button type="button" onClick={() => void loadComments()} disabled={loading} className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold flex items-center gap-2 disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          بازخوانی
        </button>
      </div>

      {notice && (
        <div className={`p-3 rounded-xl border font-semibold flex items-center gap-2 ${notice.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}>
          {notice.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
          <span>{notice.message}</span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <button type="button" onClick={() => setFilter('all')} className={`p-3 rounded-xl border text-right ${filter === 'all' ? 'bg-sky-500/15 border-sky-500/40 text-sky-300' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
          <span className="block text-[10px]">همه</span><strong className="text-lg">{comments.length}</strong>
        </button>
        <button type="button" onClick={() => setFilter('pending')} className={`p-3 rounded-xl border text-right ${filter === 'pending' ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
          <span className="block text-[10px]">در انتظار تأیید</span><strong className="text-lg">{pendingCount}</strong>
        </button>
        <button type="button" onClick={() => setFilter('approved')} className={`p-3 rounded-xl border text-right ${filter === 'approved' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
          <span className="block text-[10px]">منتشرشده</span><strong className="text-lg">{approvedCount}</strong>
        </button>
      </div>

      {loading ? (
        <div className="py-14 text-center text-slate-500"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />در حال دریافت دیدگاه‌های production...</div>
      ) : visibleComments.length === 0 ? (
        <div className="py-14 rounded-2xl bg-slate-900/60 border border-slate-800 text-center text-slate-500">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-600" />
          دیدگاهی در این فیلتر وجود ندارد.
        </div>
      ) : (
        <div className="space-y-3">
          {visibleComments.map(comment => {
            const title = articleTitles.get(String(comment.articleId)) || String(comment.articleId);
            const pending = comment.approved !== true;
            const busy = busyId === comment.id;
            return (
              <div key={comment.id} className={`p-4 rounded-2xl border ${pending ? 'bg-amber-500/5 border-amber-500/25' : 'bg-slate-900/70 border-slate-800'}`}>
                <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-white">{comment.userName || 'کاربر'}</span>
                      {pending ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[10px] font-bold"><Clock3 className="w-3 h-3" />در انتظار تأیید</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-[10px] font-bold"><CheckCircle2 className="w-3 h-3" />منتشر شده</span>
                      )}
                      <span className="text-[10px] text-slate-500">{comment.createdAt || 'اخیراً'}</span>
                    </div>
                    <div className="text-[10px] text-sky-400 truncate">مقاله: {title}</div>
                    <p className="text-sm text-slate-300 leading-7 whitespace-pre-wrap break-words">{comment.text}</p>
                    <div className="text-[10px] text-slate-500 font-mono dir-ltr">ID: {comment.id}</div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {pending ? (
                      <button type="button" disabled={busy} onClick={() => void moderate(comment, true)} className="px-3 py-2 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1.5 disabled:opacity-50">
                        <CheckCircle2 className="w-3.5 h-3.5" />تأیید و انتشار
                      </button>
                    ) : (
                      <button type="button" disabled={busy} onClick={() => void moderate(comment, false)} className="px-3 py-2 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/30 font-bold flex items-center gap-1.5 disabled:opacity-50">
                        <EyeOff className="w-3.5 h-3.5" />مخفی‌کردن
                      </button>
                    )}
                    <button type="button" disabled={busy} onClick={() => void remove(comment)} className="p-2 rounded-xl bg-rose-500/10 text-rose-300 border border-rose-500/25 disabled:opacity-50" title="حذف دیدگاه">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
