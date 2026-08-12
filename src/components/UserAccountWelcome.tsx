import React from 'react';
import { BookOpen, CheckCircle2, LogOut, MessageCircle, ShieldCheck, ThumbsUp, UserCheck } from 'lucide-react';
import { UserAccount } from '../types';

interface Props {
  user: UserAccount;
  onClose: () => void;
  onGoToBlog?: () => void;
  onLogout: () => void;
}

const getInitials = (name: string, username: string) => {
  const source = name?.trim() || username?.trim() || 'کاربر';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
};

export const UserAccountWelcome: React.FC<Props> = ({ user, onClose, onGoToBlog, onLogout }) => {
  const initials = getInitials(user.fullName || '', user.username || '');

  return (
    <div className="max-w-2xl mx-auto py-4 sm:py-8">
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#0e1625] via-[#0a0f1c] to-[#07120f] shadow-2xl">
        <div className="absolute -top-24 -right-20 w-56 h-56 rounded-full bg-[#14F195]/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-20 w-56 h-56 rounded-full bg-[#9945FF]/10 blur-3xl" />

        <div className="relative p-5 sm:p-8 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-br from-[#9945FF] via-[#14F195] to-[#00C2FF] p-[1px] shrink-0 shadow-lg">
                <div className="w-full h-full rounded-[23px] bg-[#09101a] flex items-center justify-center text-white text-xl sm:text-2xl font-black">
                  {initials}
                </div>
              </div>
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" /> حساب فعال
                </div>
                <h3 className="mt-2 text-xl sm:text-2xl font-black text-white truncate">خوش آمدید، {user.fullName || user.username}</h3>
                <p className="mt-1 text-xs text-slate-400 truncate">@{user.username}</p>
              </div>
            </div>
            <button type="button" onClick={onLogout} className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-[11px] font-bold text-rose-300 hover:bg-rose-500/10 transition-colors">
              <LogOut className="w-3.5 h-3.5" /> خروج
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <MessageCircle className="w-5 h-5 text-sky-400 mb-3" />
              <div className="text-xs font-bold text-white">ثبت دیدگاه</div>
              <p className="mt-1 text-[11px] leading-5 text-slate-400">نظر تخصصی خود را زیر مقالات منتشرشده ثبت کنید.</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <ThumbsUp className="w-5 h-5 text-emerald-400 mb-3" />
              <div className="text-xs font-bold text-white">رأی به نظرات</div>
              <p className="mt-1 text-[11px] leading-5 text-slate-400">به دیدگاه‌های مفید لایک یا دیس‌لایک بدهید.</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <ShieldCheck className="w-5 h-5 text-violet-400 mb-3" />
              <div className="text-xs font-bold text-white">حساب امن</div>
              <p className="mt-1 text-[11px] leading-5 text-slate-400">احراز هویت و نشست شما سمت سرور مدیریت می‌شود.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                onClose();
                onGoToBlog?.();
              }}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 bg-gradient-to-r from-[#9945FF] via-[#14F195] to-[#00C2FF] text-slate-950 font-black text-xs shadow-lg hover:scale-[1.01] transition-transform"
            >
              <BookOpen className="w-4 h-4" /> رفتن به وبلاگ و ثبت نظر
            </button>
            <button
              type="button"
              onClick={onClose}
              className="sm:w-36 inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 border border-white/10 bg-white/[0.04] text-slate-200 font-bold text-xs hover:bg-white/[0.07] transition-colors"
            >
              <UserCheck className="w-4 h-4" /> ادامه در سایت
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 text-[10px] text-slate-500 pt-1">
            <span>عضویت: {user.createdAt || '—'}</span>
            <span>برای ثبت نظر، پاسخ و رأی به حساب خود وارد شده‌اید.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
