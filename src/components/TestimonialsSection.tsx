import React, { useState } from 'react';
import { Testimonial } from '../types';
import { Star, MessageSquareQuote, Plus, Send, CheckCircle2, Sparkles, X, User } from 'lucide-react';

interface TestimonialsSectionProps {
  testimonials: Testimonial[];
  setTestimonials: React.Dispatch<React.SetStateAction<Testimonial[]>>;
}

export const TestimonialsSection: React.FC<TestimonialsSectionProps> = ({
  testimonials,
  setTestimonials
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userComment, setUserComment] = useState('');
  const [userStars, setUserStars] = useState(5);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  // Filter approved testimonials
  const displayTestimonials = testimonials.filter(t => t.approved !== false);

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !userComment.trim()) return;

    const newTestimonial: Testimonial = {
      id: 't-' + Date.now(),
      name: userName.trim(),
      role: userRole.trim() || 'کاربر اپلیکیشن سولمینت',
      comment: userComment.trim(),
      avatar: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80`,
      stars: userStars,
      createdAt: new Date().toLocaleDateString('fa-IR'),
      approved: true
    };

    const updated = [newTestimonial, ...testimonials];
    setTestimonials(updated);
    localStorage.setItem('solmint_testimonials', JSON.stringify(updated));

    setSubmittedSuccess(true);
    setUserName('');
    setUserRole('');
    setUserComment('');
    setTimeout(() => {
      setSubmittedSuccess(false);
      setIsFormOpen(false);
    }, 2500);
  };

  return (
    <section className="py-20 border-b border-white/5 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-2 border-b border-white/5">
          <div className="space-y-2 text-center sm:text-right">
            <h2 className="text-3xl sm:text-5xl font-black text-white">
              تجربه کاربران <span className="bg-gradient-to-r from-[#9945FF] to-[#14F195] bg-clip-text text-transparent">سولمینت</span>
            </h2>
          </div>

          <button
            onClick={() => setIsFormOpen(true)}
            className="px-6 py-3.5 rounded-full bg-gradient-to-r from-[#9945FF] to-[#14F195] text-black font-extrabold text-xs flex items-center gap-2 shadow-xl shadow-[#9945FF]/20 hover:scale-105 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>ثبت تجربه و نظر شما درباره اپلیکیشن</span>
          </button>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {displayTestimonials.map((t) => (
            <div
              key={t.id}
              className="bg-[#101020]/80 border border-white/10 hover:border-[#9945FF]/40 transition-all rounded-3xl p-6 space-y-4 backdrop-blur-xl flex flex-col justify-between shadow-xl"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-amber-400">
                    {[...Array(t.stars)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400" />
                    ))}
                  </div>

                  <span className="text-[10px] font-mono text-slate-500">{t.createdAt}</span>
                </div>

                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed italic">
                  "{t.comment}"
                </p>
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-white/5">
                <img src={t.avatar} alt={t.name} className="w-10 h-10 rounded-full object-cover border border-[#9945FF]" />
                <div>
                  <span className="text-xs font-bold text-white block">{t.name}</span>
                  <span className="text-[10px] text-slate-400">{t.role}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add Review Modal Form */}
        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
            <div className="bg-[#101020] w-full max-w-lg rounded-3xl border border-white/15 p-6 sm:p-8 space-y-6 my-auto text-slate-200 shadow-2xl relative">
              
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <MessageSquareQuote className="w-5 h-5 text-amber-400" />
                  <h3 className="text-lg font-bold text-white">ثبت دیدگاه و تجربه درباره سولمینت</h3>
                </div>

                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {submittedSuccess ? (
                <div className="py-8 text-center space-y-3">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
                  <h4 className="text-lg font-bold text-white">دیدگاه شما با موفقیت ثبت شد!</h4>
                  <p className="text-xs text-slate-300">با تشکر از همکاری شما در ارتقای اکوسیستم سولمینت.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmitReview} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">نام و نام خانوادگی:</label>
                    <input
                      type="text"
                      required
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder="مانند: محمد رضایی"
                      className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white placeholder:text-slate-500 focus:border-[#9945FF] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">حرفه یا حوزه فعالیت (اختیاری):</label>
                    <input
                      type="text"
                      value={userRole}
                      onChange={(e) => setUserRole(e.target.value)}
                      placeholder="مانند: تریدر / توسعه‌دهنده وب۳"
                      className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white placeholder:text-slate-500 focus:border-[#9945FF] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">امتیاز شما به اپلیکیشن سولمینت:</label>
                    <div className="flex items-center gap-2 bg-slate-900 p-2.5 rounded-xl border border-white/10">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setUserStars(s)}
                          className="p-1 cursor-pointer hover:scale-125 transition-transform"
                        >
                          <Star className={`w-5 h-5 ${s <= userStars ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}`} />
                        </button>
                      ))}
                      <span className="text-xs text-amber-400 font-bold mr-2">{userStars} از ۵ ستاره</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">متن نظر یا تجربه استفاده شما:</label>
                    <textarea
                      rows={4}
                      required
                      value={userComment}
                      onChange={(e) => setUserComment(e.target.value)}
                      placeholder="تجربه کار با امکانات کیف‌پول غیرامانی، ساخت توکن یا سواپ سولمینت..."
                      className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white placeholder:text-slate-500 focus:border-[#9945FF] focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>ارسال و ثبت نظر</span>
                  </button>
                </form>
              )}

            </div>
          </div>
        )}

      </div>
    </section>
  );
};
