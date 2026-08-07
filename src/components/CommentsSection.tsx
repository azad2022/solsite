import React, { useMemo, useState } from 'react';
import { Heart, ThumbsDown, MessageCircle, Reply, Send, ChevronDown, ChevronUp } from 'lucide-react';

interface CommentItem {
  id: string;
  article_id?: string;
  articleId?: string;
  user_name?: string;
  userName?: string;
  user_id?: string;
  userId?: string;
  text: string;
  created_at?: string;
  createdAt?: string;
  approved?: boolean;
  parent_id?: string | null;
  parentId?: string | null;
  like_count?: number;
  likeCount?: number;
  dislike_count?: number;
  dislikeCount?: number;
}

interface Props {
  articleId: string;
  comments: CommentItem[];
  currentUser: any;
  openAuthModal: () => void;
  onCommentCreated: (comment: CommentItem) => void;
}

const getParentId = (comment: CommentItem) => comment.parent_id ?? comment.parentId ?? null;
const getName = (comment: CommentItem) => comment.user_name || comment.userName || 'کاربر سولمینت';

export const CommentsSection: React.FC<Props> = ({ articleId, comments, currentUser, openAuthModal, onCommentCreated }) => {
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [voteState, setVoteState] = useState<Record<string, number>>({});
  const [voteCounts, setVoteCounts] = useState<Record<string, { like: number; dislike: number }>>({});

  const roots = useMemo(() => comments.filter(comment => !getParentId(comment)), [comments]);
  const children = useMemo(() => {
    const map: Record<string, CommentItem[]> = {};
    comments.forEach(comment => {
      const parentId = getParentId(comment);
      if (parentId) (map[parentId] ||= []).push(comment);
    });
    return map;
  }, [comments]);

  const countFor = (comment: CommentItem) => voteCounts[comment.id] || {
    like: Number(comment.like_count ?? comment.likeCount ?? 0),
    dislike: Number(comment.dislike_count ?? comment.dislikeCount ?? 0)
  };

  const submit = async (parentId: string | null) => {
    if (!currentUser) return openAuthModal();
    const token = String(currentUser.commentToken || '');
    if (!token) return openAuthModal();
    const text = draft.trim();
    if (text.length < 3 || text.length > 4000) return;

    setBusy(parentId || 'root');
    try {
      const response = await fetch('/api/comments/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ articleId, userId: currentUser.id, parentId, text })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || 'خطا در ثبت دیدگاه');
      setDraft('');
      setReplyTo(null);
      onCommentCreated(data.comment);
    } catch (error: any) {
      window.alert(error?.message || 'خطا در ثبت دیدگاه');
    } finally {
      setBusy(null);
    }
  };

  const vote = async (comment: CommentItem, nextVote: number) => {
    if (!currentUser) return openAuthModal();
    const token = String(currentUser.commentToken || '');
    if (!token) return openAuthModal();
    setBusy(`vote:${comment.id}`);
    try {
      const response = await fetch('/api/comments/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: currentUser.id, commentId: comment.id, vote: nextVote })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || 'خطا در ثبت رأی');
      setVoteState(state => ({ ...state, [comment.id]: Number(data.user_vote || 0) }));
      setVoteCounts(state => ({ ...state, [comment.id]: { like: Number(data.like_count || 0), dislike: Number(data.dislike_count || 0) } }));
    } catch (error: any) {
      window.alert(error?.message || 'خطا در ثبت رأی');
    } finally {
      setBusy(null);
    }
  };

  const renderComment = (comment: CommentItem, depth = 0): React.ReactNode => {
    const replies = children[comment.id] || [];
    const counts = countFor(comment);
    const currentVote = voteState[comment.id] || 0;
    const canReply = depth < 3;

    return (
      <div key={comment.id} className={depth ? 'mr-3 sm:mr-8 border-r border-slate-800 pr-3 sm:pr-5 space-y-3' : 'space-y-3'}>
        <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-3.5 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-bold text-sky-400 text-xs sm:text-sm truncate">{getName(comment)}</div>
              <div className="text-[10px] text-slate-500 mt-1">{comment.created_at || comment.createdAt || 'اخیراً'}</div>
            </div>
          </div>
          <p className="text-sm text-slate-300 leading-7 break-words mt-3 whitespace-pre-wrap">{comment.text}</p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button type="button" disabled={busy === `vote:${comment.id}`} onClick={() => vote(comment, currentVote === 1 ? 0 : 1)} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] ${currentVote === 1 ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10' : 'text-slate-400 border-slate-700 hover:text-emerald-300'}`}><Heart className="w-3.5 h-3.5" />{counts.like}</button>
            <button type="button" disabled={busy === `vote:${comment.id}`} onClick={() => vote(comment, currentVote === -1 ? 0 : -1)} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] ${currentVote === -1 ? 'text-rose-300 border-rose-500/40 bg-rose-500/10' : 'text-slate-400 border-slate-700 hover:text-rose-300'}`}><ThumbsDown className="w-3.5 h-3.5" />{counts.dislike}</button>
            {canReply && <button type="button" onClick={() => { setReplyTo(replyTo === comment.id ? null : comment.id); setExpanded(state => ({ ...state, [comment.id]: true })); }} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-sky-300 text-[11px]"><Reply className="w-3.5 h-3.5" />پاسخ</button>}
            {replies.length > 0 && <button type="button" onClick={() => setExpanded(state => ({ ...state, [comment.id]: !state[comment.id] }))} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] text-slate-500 hover:text-white">{expanded[comment.id] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}{replies.length} پاسخ</button>}
          </div>
          {replyTo === comment.id && <div className="mt-3 flex gap-2"><textarea value={draft} onChange={event => setDraft(event.target.value)} rows={3} maxLength={4000} placeholder="پاسخ خود را بنویسید..." className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 resize-y focus:outline-none focus:border-sky-500/50" /><button type="button" disabled={busy === comment.id} onClick={() => submit(comment.id)} className="self-end shrink-0 px-3 py-2.5 rounded-xl bg-sky-500 text-white text-xs font-bold"><Send className="w-4 h-4" /></button></div>}
        </div>
        {expanded[comment.id] && replies.length > 0 && <div className="space-y-3">{replies.map(reply => renderComment(reply, depth + 1))}</div>}
      </div>
    );
  };

  return (
    <section className="pt-5 sm:pt-7 border-t border-slate-800 space-y-5 sm:space-y-6" aria-labelledby="article-comments-title">
      <div className="flex items-center justify-between gap-3"><h3 id="article-comments-title" className="text-base sm:text-lg font-bold text-white flex items-center gap-2"><MessageCircle className="w-5 h-5 text-sky-400" />دیدگاه‌های کاربران ({comments.length})</h3><span className="text-[10px] text-slate-500">دیدگاه‌ها پس از تأیید منتشر می‌شوند</span></div>
      {currentUser ? <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3"><div className="text-xs font-bold text-slate-300">ثبت دیدگاه جدید</div><div className="flex gap-2"><textarea value={replyTo ? '' : draft} onChange={event => { if (!replyTo) setDraft(event.target.value); }} rows={4} maxLength={4000} placeholder="نظر تخصصی خود را بنویسید..." className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 resize-y focus:outline-none focus:border-sky-500/50" /><button type="button" disabled={busy === 'root'} onClick={() => submit(null)} className="self-end shrink-0 px-4 py-3 rounded-xl bg-sky-500 text-white text-xs font-bold"><Send className="w-4 h-4" /></button></div></div> : <button type="button" onClick={openAuthModal} className="w-full p-4 rounded-2xl bg-slate-900 border border-amber-500/30 text-amber-300 text-xs font-bold">برای ثبت نظر، ورود یا ثبت‌نام کنید.</button>}
      <div className="space-y-3">{roots.length ? roots.map(comment => renderComment(comment)) : <div className="text-center py-8 text-slate-500 text-xs">هنوز دیدگاه تأییدشده‌ای ثبت نشده است.</div>}</div>
    </section>
  );
};
