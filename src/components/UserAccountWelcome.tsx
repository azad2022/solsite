import React from 'react';
import { BookOpen, CheckCircle2, LogOut, MessageCircle, ThumbsUp, X } from 'lucide-react';
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
    <div className="w-full max-w-xl mx-auto py-2 sm:py-6">
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0b111c] shadow-2xl">
        <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-[#14F195]/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-[#9945FF]/10 blur-3xl" />

        <div className="relative p-5 sm:p-7">
          <div className="flex items-center justify-between gap-3 mb-6">
            <button type="button" onClick={onClose} aria-label="بستن" className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-colors">
              <X className="w-4 h-4" />
            </button>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5" /> حساب فعال شد
            </span>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-[1.75rem] bg-gradient-to-br from-[#9945FF] via-[#14F195] to-[#00C2FF] p-[1px] shadow-lg shadow-[#14F195]/10">
              <div className="w-full h-full rounded-[1.7rem] bg-[#09101a] flex items-center justify-center text-white text-2xl sm:text-3xl font-black">
                {initials}
              </div>
            </div>

            <h3 className="mt-5 text-2xl sm:text-3xl font-black text-white tracking-tight">خوش آمدید، {user.fullName || user.username}</h3>
            <p className="mt-2 text-sm text-slate-400">حساب شما با موفقیت ساخته شد و آماده استفاده است.</p>
            <div className="mt-3 text-[11px] text-slate-500 font-mono">@{user.username}</div>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-center">
              <MessageCircle className="w-5 h-5 mx-auto text-sky-400 mb-2" />
              <div className="text-xs font-bold text-white">ثبت دیدگاه</div>
              <p className="mt-1 text-[10px] leading-5 text-slate-500">دیدگاه جدید را زیر مقالات بنویسید.</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-center">
              <ThumbsUp className="w-5 h-5 mx-auto text-emerald-400 mb-2" />
              <div className="text-xs font-bold text-white">تعامل با نظرات</div>
              <p className="mt-1 text-[10px] leading-5 text-slate-500">به نظرات مفید رأی بدهید یا پاسخ دهید.</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => {
                onClose();
                onGoToBlog?.();
              }}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 bg-gradient-to-r from-[#9945FF] to-[#14F195] text-slate-950 font-black text-xs shadow-lg hover:brightness-110 transition-all"
            >
              <BookOpen className="w-4 h-4" /> ادامه و رفتن به وبلاگ
            </button>
            <button
              type="button"
              onClick={onClose}
              className="sm:w-32 inline-flex items-center justify-center rounded-2xl px-4 py-3.5 border border-white/10 bg-white/[0.04] text-slate-200 font-bold text-xs hover:bg-white/[0.07] transition-colors"
            >
              ادامه در سایت
            </button>
          </div>

          <div className="mt-5 flex justify-between items-center gap-3 border-t border-white/6 pt-4">
            <span className="text-[10px] text-slate-600">ورود امن با نشست HttpOnly</span>
            <button type="button" onClick={onLogout} className="inline-flex items-center gap-1.5 text-[10px] font-bold text-rose-300 hover:text-rose-200 transition-colors">
              <LogOut className="w-3.5 h-3.5" /> خروج از حساب
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
