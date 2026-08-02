import React, { useState, useRef } from 'react';
import { 
  Bold, 
  Italic, 
  Heading1, 
  Heading2, 
  Heading3, 
  List, 
  ListOrdered, 
  Quote, 
  Code, 
  Table, 
  Minus, 
  Maximize2, 
  Minimize2, 
  HelpCircle, 
  Columns, 
  FileCode, 
  Highlighter, 
  CheckSquare, 
  AlertTriangle, 
  Lightbulb, 
  Info,
  Sparkles,
  ImageIcon,
  Video,
  Link as LinkIcon,
  Check,
  Copy,
  Eye,
  Edit3,
  Layers
} from 'lucide-react';

interface ProArticleEditorProps {
  content: string;
  onChange: (newContent: string) => void;
  onOpenMediaPicker: () => void;
  onCallGeminiAi: (action: 'seo_summary' | 'seo_keywords' | 'expand' | 'faq') => void;
  isAiLoading: boolean;
}

export const ProArticleEditor: React.FC<ProArticleEditorProps> = ({
  content,
  onChange,
  onOpenMediaPicker,
  onCallGeminiAi,
  isAiLoading
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [viewMode, setViewMode] = useState<'edit' | 'split' | 'preview'>('edit');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [copiedCodeIndex, setCopiedCodeIndex] = useState<number | null>(null);

  // Formatting helper function
  const insertFormatting = (prefix: string, suffix: string = '', defaultText: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) {
      onChange(content + prefix + defaultText + suffix);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const replacementText = selectedText || defaultText;
    const newContent = content.substring(0, start) + prefix + replacementText + suffix + content.substring(end);

    onChange(newContent);

    setTimeout(() => {
      textarea.focus();
      const cursorStart = start + prefix.length;
      const cursorEnd = cursorStart + replacementText.length;
      textarea.setSelectionRange(cursorStart, cursorEnd);
    }, 50);
  };

  // Word & Character Analytics
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;
  const readTime = Math.max(1, Math.round(wordCount / 180));
  const paragraphCount = content.split(/\n\s*\n/).filter(Boolean).length;

  // Render Markdown Preview helper
  const renderFormattedPreview = (text: string) => {
    if (!text.trim()) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12 space-y-2">
          <FileCode className="w-10 h-10 text-slate-600" />
          <p className="text-xs font-semibold">هنوز متنی وارد نشده است...</p>
        </div>
      );
    }

    const lines = text.split('\n');
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];
    let codeBlockLang = '';

    const elements: React.ReactNode[] = [];

    lines.forEach((line, index) => {
      // Code Block Start / End
      if (line.trim().startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeBlockLang = line.trim().replace('```', '') || 'text';
          codeBlockContent = [];
        } else {
          inCodeBlock = false;
          const codeString = codeBlockContent.join('\n');
          const blockIdx = index;
          elements.push(
            <div key={`code-${index}`} className="my-4 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden font-mono dir-ltr text-left">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400">
                <span className="font-bold text-cyan-400">{codeBlockLang.toUpperCase()}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(codeString);
                    setCopiedCodeIndex(blockIdx);
                    setTimeout(() => setCopiedCodeIndex(null), 2000);
                  }}
                  className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  {copiedCodeIndex === blockIdx ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCodeIndex === blockIdx ? 'کپی شد' : 'کپی کد'}</span>
                </button>
              </div>
              <pre className="p-4 text-xs text-emerald-300 overflow-x-auto whitespace-pre leading-relaxed">{codeString}</pre>
            </div>
          );
          codeBlockContent = [];
        }
        return;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        return;
      }

      // Headers
      if (line.startsWith('# ')) {
        elements.push(
          <h1 key={index} className="text-2xl font-extrabold text-white mt-6 mb-3 border-b border-slate-800 pb-2 flex items-center gap-2">
            <span className="w-2 h-6 bg-cyan-500 rounded-full inline-block"></span>
            {line.substring(2)}
          </h1>
        );
      } else if (line.startsWith('## ')) {
        elements.push(
          <h2 key={index} className="text-xl font-bold text-[#14F195] mt-5 mb-2.5 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-[#14F195] rounded-full inline-block"></span>
            {line.substring(3)}
          </h2>
        );
      } else if (line.startsWith('### ')) {
        elements.push(
          <h3 key={index} className="text-lg font-bold text-sky-400 mt-4 mb-2">
            {line.substring(4)}
          </h3>
        );
      } else if (line.startsWith('> 💡') || line.startsWith('> ⚠️') || line.startsWith('> ℹ️') || line.startsWith('> ')) {
        // Callouts & Blockquotes
        const isTip = line.includes('💡');
        const isWarn = line.includes('⚠️');
        const isInfo = line.includes('ℹ️');

        const bgClass = isWarn ? 'bg-amber-950/30 border-amber-500/40 text-amber-200' :
                        isTip ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200' :
                        isInfo ? 'bg-sky-950/30 border-sky-500/40 text-sky-200' :
                        'bg-slate-900 border-purple-500/40 text-slate-200';

        elements.push(
          <div key={index} className={`my-3 p-4 rounded-xl border-r-4 ${bgClass} text-xs leading-relaxed space-y-1`}>
            <p className="font-medium">{line.replace(/^>\s*/, '')}</p>
          </div>
        );
      } else if (line.trim().startsWith('---')) {
        elements.push(<hr key={index} className="my-6 border-slate-800" />);
      } else if (line.trim().startsWith('- [ ] ') || line.trim().startsWith('- [x] ')) {
        const checked = line.includes('[x]');
        elements.push(
          <div key={index} className="flex items-center gap-2 my-1 text-xs text-slate-300">
            <input type="checkbox" checked={checked} readOnly className="accent-cyan-500" />
            <span>{line.replace(/- \[[ x\]]\s*/, '')}</span>
          </div>
        );
      } else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        elements.push(
          <li key={index} className="text-xs text-slate-300 my-1 mr-4 list-disc leading-relaxed">
            {line.replace(/^[-*]\s*/, '')}
          </li>
        );
      } else if (/^\d+\.\s/.test(line.trim())) {
        elements.push(
          <li key={index} className="text-xs text-slate-300 my-1 mr-4 list-decimal leading-relaxed">
            {line.replace(/^\d+\.\s*/, '')}
          </li>
        );
      } else if (line.trim().startsWith('<video') || line.trim().startsWith('<iframe')) {
        elements.push(
          <div key={index} className="my-4 rounded-2xl overflow-hidden border border-slate-800 bg-black p-1" dangerouslySetInnerHTML={{ __html: line }} />
        );
      } else if (line.trim()) {
        elements.push(
          <p key={index} className="text-xs sm:text-sm text-slate-300 leading-relaxed my-2">
            {line}
          </p>
        );
      } else {
        elements.push(<div key={index} className="h-2" />);
      }
    });

    return elements;
  };

  return (
    <div className={`space-y-3 transition-all ${isFullScreen ? 'fixed inset-0 z-50 bg-[#0c0e14] p-6 overflow-y-auto' : ''}`}>
      
      {/* Editor Main Container Header & Toolbar */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
        
        {/* Top Control Bar */}
        <div className="p-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          
          {/* Mode Tabs */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('edit')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold flex items-center gap-1 sm:gap-1.5 cursor-pointer transition-all ${
                viewMode === 'edit' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>ویرایشگر کد</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`hidden md:flex px-3 py-1.5 rounded-lg text-xs font-bold items-center gap-1.5 cursor-pointer transition-all ${
                viewMode === 'split' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>نمایش دوپنجره‌ای</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold flex items-center gap-1 sm:gap-1.5 cursor-pointer transition-all ${
                viewMode === 'preview' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>پیش‌نمایش زنده</span>
            </button>
          </div>

          {/* AI Assistance Quick Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              disabled={isAiLoading}
              onClick={() => onCallGeminiAi('expand')}
              className="px-2 sm:px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-500/20 to-blue-600/20 text-sky-300 hover:bg-sky-500/30 border border-sky-500/30 text-[10px] sm:text-[11px] font-bold flex items-center gap-1 sm:gap-1.5 cursor-pointer transition-all shrink-0"
              title="تکمیل و بازنویسی متن با Gemini AI"
            >
              <Sparkles className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
              <span>{isAiLoading ? 'در حال نگارش...' : 'تکمیل با AI'}</span>
            </button>

            <button
              type="button"
              disabled={isAiLoading}
              onClick={() => onCallGeminiAi('faq')}
              className="px-2 sm:px-2.5 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 text-[10px] sm:text-[11px] font-bold flex items-center gap-1 sm:gap-1.5 cursor-pointer transition-all shrink-0"
              title="تولید بخش سوالات متداول سئو"
            >
              <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>افزودن FAQ</span>
            </button>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer border border-slate-700 shrink-0"
              title={isFullScreen ? 'خروج از حالت تمام صفحه' : 'حالت تمام صفحه بدون تمرکز'}
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>

        </div>

        {/* Formatting Toolbar (Visible in Edit & Split modes) */}
        {viewMode !== 'preview' && (
          <div className="p-2 bg-slate-900/90 border-b border-slate-800 flex items-center gap-1 text-slate-300 overflow-x-auto no-scrollbar scroll-smooth whitespace-nowrap">
            
            {/* Headers Group */}
            <div className="flex items-center gap-0.5 border-l border-slate-800 pl-2 ml-1">
              <button
                type="button"
                onClick={() => insertFormatting('# ', '', 'عنوان اصلی (H1)')}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-cyan-400 cursor-pointer transition-colors"
                title="تیتر سطح اول (H1)"
              >
                <Heading1 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => insertFormatting('## ', '', 'عنوان بخش اصلی (H2)')}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-[#14F195] cursor-pointer transition-colors"
                title="تیتر بخش اصلی (H2)"
              >
                <Heading2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => insertFormatting('### ', '', 'زیرعنوان (H3)')}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-sky-400 cursor-pointer transition-colors"
                title="زیرعنوان (H3)"
              >
                <Heading3 className="w-4 h-4" />
              </button>
            </div>

            {/* Inline Formatting Group */}
            <div className="flex items-center gap-0.5 border-l border-slate-800 pl-2 ml-1">
              <button
                type="button"
                onClick={() => insertFormatting('**', '**', 'متن پررنگ')}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer transition-colors"
                title="متن پررنگ (Bold)"
              >
                <Bold className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => insertFormatting('*', '*', 'متن مورب')}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer transition-colors"
                title="متن مورب (Italic)"
              >
                <Italic className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => insertFormatting('`', '`', 'کد کوتاه')}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-cyan-400 cursor-pointer transition-colors"
                title="کد درون‌خطی (Inline Code)"
              >
                <Code className="w-4 h-4" />
              </button>
            </div>

            {/* Lists Group */}
            <div className="flex items-center gap-0.5 border-l border-slate-800 pl-2 ml-1">
              <button
                type="button"
                onClick={() => insertFormatting('- ', '', 'مورد فهرست')}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer transition-colors"
                title="فهرست نقطه‌ای"
              >
                <List className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => insertFormatting('1. ', '', 'مورد اول')}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer transition-colors"
                title="فهرست عددی"
              >
                <ListOrdered className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => insertFormatting('- [ ] ', '', 'وظیفه جدید')}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-emerald-400 cursor-pointer transition-colors"
                title="فهرست چک‌باکس"
              >
                <CheckSquare className="w-4 h-4" />
              </button>
            </div>

            {/* Blocks & Callouts Group */}
            <div className="flex items-center gap-0.5 border-l border-slate-800 pl-2 ml-1">
              <button
                type="button"
                onClick={() => insertFormatting('> ℹ️ **نکته کاربردی:**\n> ', '', 'توضیحات تکمیلی را بنویسید.')}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-sky-400 cursor-pointer transition-colors"
                title="باکس اطلاعات (Info Callout)"
              >
                <Info className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => insertFormatting('> 💡 **راهنمای سریع:**\n> ', '', 'نکته کلیدی را اینجا وارد نمایید.')}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-amber-400 cursor-pointer transition-colors"
                title="باکس نکته و راهنما (Tip Callout)"
              >
                <Lightbulb className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => insertFormatting('> ⚠️ **توجه مهم:**\n> ', '', 'هشدار امنیتی یا فنی.')}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-rose-400 cursor-pointer transition-colors"
                title="باکس هشدار (Warning Callout)"
              >
                <AlertTriangle className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => insertFormatting('> ', '', 'نقل قول مهم...')}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-purple-400 cursor-pointer transition-colors"
                title="نقل قول (Quote)"
              >
                <Quote className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => insertFormatting('```solidity\n', '\n```', '// کد هوشمند سولانا')}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-emerald-400 cursor-pointer transition-colors"
                title="بلوک کد چندخطی"
              >
                <FileCode className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Templates & Inserts */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => insertFormatting('\n| عنوان ویژگی | پشتیبانی در سولمینت | توضیحات |\n|---|---|---|\n| ساخت میم کوین | ✅ بله | بدون کدنویسی |\n| بازیابی اجاره SOL | ✅ بله | با یک کلیک |\n', '', '')}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                title="درج جدول اطلاعاتی"
              >
                <Table className="w-3.5 h-3.5" />
                <span>جدول</span>
              </button>

              <button
                type="button"
                onClick={onOpenMediaPicker}
                className="px-2 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors border border-purple-500/30"
                title="درج تصویر از کتابخانه رسانه"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>تصویر</span>
              </button>

              <button
                type="button"
                onClick={() => insertFormatting('<video controls className="w-full rounded-2xl my-4" src="', '"></video>', 'https://domain.com/video.mp4')}
                className="px-2 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors border border-emerald-500/30"
                title="درج پلیر ویدیو MP4"
              >
                <Video className="w-3.5 h-3.5" />
                <span>ویدیو MP4</span>
              </button>

              <button
                type="button"
                onClick={() => insertFormatting('[', '](https://solmint.ir)', 'عنوان لینک')}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer transition-colors"
                title="درج لینک"
              >
                <LinkIcon className="w-4 h-4" />
              </button>
            </div>

          </div>
        )}

        {/* Editor & Preview Workspace Viewports */}
        <div className={`grid ${viewMode === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'} divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-slate-800 min-h-[420px]`}>
          
          {/* Editor Textarea */}
          {viewMode !== 'preview' && (
            <div className="p-3 bg-slate-950 flex flex-col justify-between">
              <textarea
                ref={textareaRef}
                rows={isFullScreen ? 24 : 14}
                required
                value={content}
                onChange={(e) => onChange(e.target.value)}
                placeholder="محتوای تخصصی مقاله را اینجا با فرمت مارک‌داون یا HTML بنویسید..."
                className="w-full bg-slate-950 text-slate-100 font-mono text-xs sm:text-sm leading-relaxed p-3 focus:outline-none resize-y selection:bg-cyan-500/30"
              />
            </div>
          )}

          {/* Live Preview Panel */}
          {viewMode !== 'edit' && (
            <div className="p-4 sm:p-6 bg-slate-900/60 overflow-y-auto max-h-[550px] border-r border-slate-800/80">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800 text-xs">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  پیش‌نمایش خروجی نهایی مقاله:
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {readTime} دقیقه زمان مطالعه تقریبی
                </span>
              </div>

              <div className="prose prose-invert max-w-none space-y-2">
                {renderFormattedPreview(content)}
              </div>
            </div>
          )}

        </div>

        {/* Analytics Footer Status Bar */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <strong className="text-cyan-400 font-bold">{wordCount}</strong> کلمه
            </span>
            <span className="flex items-center gap-1">
              <strong className="text-emerald-400 font-bold">{charCount}</strong> کاراکتر
            </span>
            <span className="flex items-center gap-1">
              <strong className="text-purple-400 font-bold">{paragraphCount}</strong> پاراگراف
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            <span>⏱️ زمان مطالعه:</span>
            <span className="text-white font-bold">{readTime} دقیقه</span>
          </div>
        </div>

      </div>

    </div>
  );
};
