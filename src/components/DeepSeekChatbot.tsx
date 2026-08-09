import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, Bot, Check, Copy, Minus, Send, Sparkles, Trash2, X } from 'lucide-react';
import { ChatbotSettings, DeepSeekAiSettings } from '../types';
import { sendDeepSeekChatMessage } from '../utils/siteChatService';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface DeepSeekChatbotProps {
  chatbotSettings: ChatbotSettings;
  deepseekSettings: DeepSeekAiSettings;
  openAdminModal?: () => void;
}

const timeNow = () => new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

export const DeepSeekChatbot: React.FC<DeepSeekChatbotProps> = ({ chatbotSettings, deepseekSettings }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [{
    id: 'welcome-1',
    role: 'assistant',
    content: chatbotSettings.welcomeMessage || 'سلام! 👋 من پشتیبان هوشمند سولمینت هستم. چطور می‌توانم کمکتان کنم؟',
    timestamp: timeNow()
  }]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen, isLoading]);

  // The setting may come from persisted JSON or legacy storage, so accept only
  // the literal boolean true (or the exact string "true"). Values such as
  // "false" must never be treated as enabled by JavaScript truthiness.
  const isChatbotEnabled = chatbotSettings?.enabled === true || chatbotSettings?.enabled === 'true';

  if (!isChatbotEnabled) return null;

  const handleSendMessage = async () => {
    const text = inputMessage.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: text, timestamp: timeNow() };
    const history = [...messages, userMsg].map(({ role, content }) => ({ role, content }));
    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const reply = await sendDeepSeekChatMessage(history, chatbotSettings, deepseekSettings);
      setMessages(prev => [...prev, { id: `bot-${Date.now()}`, role: 'assistant', content: reply, timestamp: timeNow() }]);
    } catch (error) {
      console.error('Chatbot execution error:', error);
      setErrorMessage('در حال حاضر سیستم پاسخگویی موقتاً در دسترس نیست. لطفاً چند لحظه بعد دوباره تلاش کنید.');
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = () => {
    if (!window.confirm('آیا مایلید تاریخچه گفتگو پاک شود؟')) return;
    setMessages([{ id: `welcome-${Date.now()}`, role: 'assistant', content: chatbotSettings.welcomeMessage || 'سلام! 👋 من پشتیبان هوشمند سولمینت هستم. چطور می‌توانم کمکتان کنم؟', timestamp: timeNow() }]);
    setErrorMessage(null);
  };

  const copyMessage = async (id: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      setErrorMessage('کپی متن در این مرورگر انجام نشد.');
    }
  };

  return (
    <div className="fixed bottom-6 left-6 z-50 font-['Vazirmatn',sans-serif]" dir="rtl">
      {!isOpen && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, y: [0, -5, 0] }}
          transition={{ scale: { duration: 0.25 }, opacity: { duration: 0.25 }, y: { duration: 3, repeat: Infinity, ease: 'easeInOut' } }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => setIsOpen(true)}
          aria-label="پشتیبان هوشمند سولمینت"
          className="relative w-14 h-14 p-1 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] shadow-[0_10px_30px_rgba(153,69,255,0.4)]"
        >
          <span className="flex h-full w-full items-center justify-center rounded-full bg-[#0b0c1e] text-white border border-white/20"><Bot className="w-6 h-6 text-[#14F195]" /></span>
          <span className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#0b0c1e]" />
          {messages.length > 1 && <span className="absolute -bottom-1 -left-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-rose-500 text-white border-2 border-[#0b0c1e]">{messages.length - 1}</span>}
        </motion.button>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.97 }}
            className={`w-[92vw] sm:w-[410px] bg-[#0c0c18]/95 backdrop-blur-2xl border border-white/15 rounded-3xl shadow-2xl shadow-black/80 flex flex-col overflow-hidden ${isMinimized ? 'h-[72px]' : 'h-[580px] max-h-[82vh]'}`}
          >
            <div className="p-4 bg-gradient-to-r from-[#121028] via-[#161234] to-[#0d1f23] border-b border-white/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative"><div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#9945FF]/30 to-[#14F195]/30 border border-[#14F195]/40 flex items-center justify-center text-xl">{chatbotSettings.botAvatar || '🤖'}</div><span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#14F195] border-2 border-[#0d0d18]" /></div>
                <div><h4 className="font-extrabold text-white text-xs sm:text-sm">{chatbotSettings.botName || 'پشتیبان هوشمند سولمینت'}</h4><span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5"><span className="w-1.5 h-1.5 rounded-full bg-[#14F195]" />پشتیبان رسمی سولمینت</span></div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setIsMinimized(v => !v)} aria-label="کوچک یا بزرگ کردن چت" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"><Minus className="w-4 h-4" /></button>
                <button onClick={clearHistory} aria-label="پاک کردن تاریخچه" className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/5"><Trash2 className="w-4 h-4" /></button>
                <button onClick={() => setIsOpen(false)} aria-label="بستن چت" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"><X className="w-4 h-4" /></button>
              </div>
            </div>

            {!isMinimized && <>
              <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs">
                {messages.map(message => {
                  const isUser = message.role === 'user';
                  return <div key={message.id} className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
                    {!isUser && <div className="w-7 h-7 rounded-xl bg-[#9945FF]/20 border border-[#9945FF]/30 flex items-center justify-center shrink-0 mt-1">{chatbotSettings.botAvatar || '🤖'}</div>}
                    <div className={`group max-w-[84%] rounded-2xl p-3.5 leading-relaxed ${isUser ? 'bg-gradient-to-r from-[#9945FF] to-[#7c3aed] text-white rounded-tl-none' : 'bg-white/5 border border-white/10 text-slate-200 rounded-tr-none'}`}>
                      <div className="whitespace-pre-wrap text-[12px]">{message.content}</div>
                      <div className={`flex items-center justify-between gap-4 pt-1 text-[9px] opacity-70 ${isUser ? 'text-slate-200' : 'text-slate-400'}`}><span>{message.timestamp}</span><button onClick={() => copyMessage(message.id, message.content)} className="opacity-0 group-hover:opacity-100 hover:text-white" aria-label="کپی پیام">{copiedId === message.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}</button></div>
                    </div>
                  </div>;
                })}

                {isLoading && <div className="flex items-center gap-2 text-slate-400 py-2"><div className="w-7 h-7 rounded-xl bg-[#9945FF]/20 border border-[#9945FF]/30 flex items-center justify-center"><Sparkles className="w-3.5 h-3.5 text-[#14F195] animate-spin" /></div><span>در حال پاسخ‌دهی...</span></div>}
                {errorMessage && <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px]"><div className="flex items-center gap-2 font-bold"><AlertCircle className="w-4 h-4" />اشکال در ارتباط</div><p className="mt-1 leading-relaxed">{errorMessage}</p></div>}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-3 bg-slate-950/80 border-t border-white/10 flex items-center gap-2 shrink-0">
                <input value={inputMessage} onChange={e => setInputMessage(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} disabled={isLoading} maxLength={2000} placeholder={chatbotSettings.placeholderText || 'سوال خود را درباره سولمینت بپرسید...'} className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 text-slate-100 text-xs focus:border-[#9945FF] focus:outline-none placeholder:text-slate-500 disabled:opacity-50" />
                <button onClick={handleSendMessage} disabled={isLoading || !inputMessage.trim()} aria-label="ارسال پیام" className="p-2.5 rounded-2xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-black font-bold disabled:opacity-40"><Send className="w-4 h-4" /></button>
              </div>
            </>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
