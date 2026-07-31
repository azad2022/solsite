import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bot, 
  Send, 
  X, 
  Minus, 
  Sparkles, 
  Trash2, 
  Copy, 
  Check, 
  AlertCircle,
  MessageSquare,
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { ChatbotSettings, DeepSeekAiSettings } from '../types';
import { sendDeepSeekChatMessage } from '../utils/deepseekService';

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

export const DeepSeekChatbot: React.FC<DeepSeekChatbotProps> = ({
  chatbotSettings,
  deepseekSettings,
  openAdminModal
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [hasUnread, setHasUnread] = useState(true);

  // Initial Welcome Message
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome-1',
      role: 'assistant',
      content: chatbotSettings.welcomeMessage || 'سلام! 👋 من پشتیبان هوشمند سولمینت هستم. چطور می‌توانم کمکتان کنم؟',
      timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setHasUnread(false);
    }
  }, [messages, isOpen, isLoading]);

  // If chatbot disabled by admin, return null
  if (chatbotSettings && !chatbotSettings.enabled) {
    return null;
  }

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const historyForApi = messages
        .concat(userMsg)
        .map(m => ({ role: m.role, content: m.content }));

      const botReplyText = await sendDeepSeekChatMessage(
        historyForApi,
        chatbotSettings,
        deepseekSettings
      );

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: botReplyText,
        timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      console.error('Chatbot execution error:', err);
      // Public friendly message without exposing API keys or technical details
      setErrorMessage('در حال حاضر سیستم پاسخگویی موقتاً در دسترس نیست. لطفاً چند لحظه بعد دوباره تلاش کنید.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    if (window.confirm('آیا مایلید تاریخچه گفتگو پاک شود؟')) {
      setMessages([
        {
          id: `welcome-${Date.now()}`,
          role: 'assistant',
          content: chatbotSettings.welcomeMessage || 'سلام! 👋 من پشتیبان هوشمند سولمینت هستم. چطور می‌توانم کمکتان کنم؟',
          timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      setErrorMessage(null);
    }
  };

  return (
    <div className="fixed bottom-6 left-6 z-50 font-['Vazirmatn',sans-serif] dir-rtl">
      
      {/* Floating Widget Trigger Button */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, y: [0, -6, 0] }}
          transition={{
            scale: { duration: 0.3 },
            opacity: { duration: 0.3 },
            y: { duration: 3, repeat: Infinity, ease: "easeInOut" }
          }}
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsOpen(true)}
          aria-label="پشتیبان هوشمند سولمینت"
          className="relative group w-14 h-14 sm:w-15 sm:h-15 p-[2px] rounded-full shadow-[0_10px_30px_rgba(153,69,255,0.45)] cursor-pointer transition-all duration-300 flex items-center justify-center overflow-hidden"
          title="پشتیبان هوشمند سولمینت"
        >
          {/* Rotating Animated Gradient Ring */}
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            className="absolute -inset-1 rounded-full bg-gradient-to-r from-[#9945FF] via-indigo-500 via-[#14F195] to-[#9945FF] opacity-90 blur-[1px]"
          />

          {/* Ambient Outer Pulse Glow */}
          <motion.div 
            animate={{ scale: [1, 1.25, 1], opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -inset-2 rounded-full bg-gradient-to-r from-[#9945FF] to-[#14F195] blur-md pointer-events-none"
          />

          {/* Inner Circular Glass Container */}
          <div className="relative z-10 w-full h-full rounded-full bg-[#0b0c1e]/90 backdrop-blur-xl border border-white/20 group-hover:border-white/40 flex items-center justify-center text-white transition-all shadow-inner">
            <motion.div 
              animate={{ scale: [1, 1.1, 1], rotate: [0, 6, -6, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="relative flex items-center justify-center"
            >
              <Bot className="w-6 h-6 sm:w-7 sm:h-7 text-[#14F195] drop-shadow-[0_0_8px_rgba(20,241,149,0.6)]" />
              <motion.div
                animate={{ scale: [0.8, 1.3, 0.8], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-1 -right-2 text-[#9945FF]"
              >
                <Sparkles className="w-3.5 h-3.5 fill-[#9945FF]" />
              </motion.div>
            </motion.div>
          </div>

          {/* Online Indicator Badge */}
          <span className="absolute top-0 right-0 z-20 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-[#0b0c1e]"></span>
          </span>

          {/* Unread dot if messages exist */}
          {messages.length > 1 && (
            <span className="absolute -bottom-1 -left-1 z-20 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-rose-500 text-white border-2 border-[#0b0c1e] shadow-sm">
              {messages.length - 1}
            </span>
          )}
        </motion.button>
      )}

      {/* Main Chatbot Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className={`w-[92vw] sm:w-[410px] bg-[#0c0c18]/95 backdrop-blur-2xl border border-white/15 rounded-3xl shadow-2xl shadow-black/80 flex flex-col overflow-hidden transition-all ${
              isMinimized ? 'h-[72px]' : 'h-[580px] max-h-[82vh]'
            }`}
          >
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-[#121028] via-[#161234] to-[#0d1f23] border-b border-white/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#9945FF]/30 to-[#14F195]/30 border border-[#14F195]/40 flex items-center justify-center text-xl shadow-inner">
                    {chatbotSettings.botAvatar || '🤖'}
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#14F195] border-2 border-[#0d0d18]" />
                </div>

                <div>
                  <h4 className="font-extrabold text-white text-xs sm:text-sm">
                    {chatbotSettings.botName || 'پشتیبان هوشمند سولمینت'}
                  </h4>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#14F195] animate-pulse" />
                    آنلاین • پاسخگویی آنی وب۳
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  aria-label={isMinimized ? 'بزرگ‌نمایی' : 'کوچک‌نمایی'}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  title={isMinimized ? 'بزرگ‌نمایی' : 'کوچک‌نمایی'}
                >
                  <Minus className="w-4 h-4" />
                </button>

                <button
                  onClick={handleClearHistory}
                  aria-label="پاک کردن تاریخچه چت"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/5 transition-colors cursor-pointer"
                  title="پاک کردن تاریخچه چت"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setIsOpen(false)}
                  aria-label="بستن چت"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  title="بستن چت"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Chat Content Body (when not minimized) */}
            {!isMinimized && (
              <>
                <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar text-xs">
                  
                  {/* Messages List */}
                  {messages.map((msg) => {
                    const isUser = msg.role === 'user';
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                      >
                        {/* Avatar */}
                        {!isUser && (
                          <div className="w-7 h-7 rounded-xl bg-[#9945FF]/20 border border-[#9945FF]/30 text-white flex items-center justify-center shrink-0 text-xs mt-1">
                            {chatbotSettings.botAvatar || '🤖'}
                          </div>
                        )}

                        <div className={`group relative max-w-[84%] rounded-2xl p-3.5 space-y-1.5 leading-relaxed ${
                          isUser
                            ? 'bg-gradient-to-r from-[#9945FF] to-[#7c3aed] text-white rounded-tl-none shadow-md'
                            : 'bg-white/5 border border-white/10 text-slate-200 rounded-tr-none backdrop-blur-md'
                        }`}>
                          
                          {/* Message Text */}
                          <div className="whitespace-pre-wrap font-sans text-[12px] dir-rtl">
                            {msg.content}
                          </div>

                          {/* Footer Timestamp & Copy */}
                          <div className={`flex items-center justify-between pt-1 text-[9px] opacity-70 ${
                            isUser ? 'text-slate-200' : 'text-slate-400'
                          }`}>
                            <span>{msg.timestamp}</span>

                            <button
                              onClick={() => handleCopyMessage(msg.id, msg.content)}
                              className="opacity-0 group-hover:opacity-100 hover:text-white transition-opacity cursor-pointer flex items-center gap-1"
                              title="کپی متن"
                            >
                              {copiedId === msg.id ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}

                  {/* Loading Typing Indicator */}
                  {isLoading && (
                    <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
                      <div className="w-7 h-7 rounded-xl bg-[#9945FF]/20 border border-[#9945FF]/30 text-white flex items-center justify-center shrink-0">
                        <Sparkles className="w-3.5 h-3.5 text-[#14F195] animate-spin" />
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-300">در حال پاسخ‌دهی...</span>
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#14F195] animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-[#14F195] animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-[#14F195] animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Error Notification */}
                  {errorMessage && (
                    <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] space-y-1">
                      <div className="flex items-center gap-2 font-bold">
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>اشکال در ارتباط</span>
                      </div>
                      <p className="leading-relaxed opacity-90">{errorMessage}</p>
                    </div>
                  )}



                  <div ref={messagesEndRef} />
                </div>

                {/* Input Footer */}
                <div className="p-3 bg-slate-950/80 border-t border-white/10 flex items-center gap-2 shrink-0">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                    placeholder={chatbotSettings.placeholderText || 'سوال خود را درباره سولمینت بپرسید...'}
                    className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 text-slate-100 text-xs focus:border-[#9945FF] focus:outline-none placeholder:text-slate-500 disabled:opacity-50"
                  />

                  <button
                    onClick={() => handleSendMessage()}
                    disabled={isLoading || !inputMessage.trim()}
                    aria-label="ارسال پیام"
                    className="p-2.5 rounded-2xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-black font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 cursor-pointer transition-all shrink-0"
                    title="ارسال پیام"
                  >
                    <Send className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
