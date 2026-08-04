import React, { useState } from 'react';
import { User, ShieldCheck, Bot, Sparkles, PenTool, Crown } from 'lucide-react';

interface AuthorAvatarProps {
  author?: {
    name?: string;
    role?: string;
    avatar?: string;
  } | string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const AuthorAvatar: React.FC<AuthorAvatarProps> = ({ author, className = '', size = 'md' }) => {
  const [imgError, setImgError] = useState(false);

  const authorName = typeof author === 'string' ? author : author?.name || 'نویسنده سولمینت';
  const authorRole = typeof author === 'object' ? author?.role || '' : '';
  const rawAvatar = typeof author === 'object' ? author?.avatar : undefined;

  // Determine size classes
  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-11 h-11 text-base',
    xl: 'w-14 h-14 text-lg'
  }[size];

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
    xl: 'w-7 h-7'
  }[size];

  // Smart resolution of avatar URL or default fallback
  const getAvatarSrc = () => {
    if (!rawAvatar) return null;
    if (rawAvatar.startsWith('http') || rawAvatar.startsWith('/')) {
      return rawAvatar;
    }
    // If emoji or keyword mapped to SVG
    if (rawAvatar.includes('⚡') || authorName.includes('سولمینت')) return '/avatars/solmint.svg';
    if (rawAvatar.includes('🤖') || authorName.includes('دیپ‌سیک') || authorName.includes('DeepSeek')) return '/avatars/deepseek.svg';
    if (authorName.includes('ویرایش') || authorRole.includes('تحریریه')) return '/avatars/editor.svg';
    if (authorName.includes('تحلیل') || authorRole.includes('تحلیل‌گر')) return '/avatars/analyst.svg';
    return null;
  };

  const avatarSrc = getAvatarSrc();

  if (avatarSrc && !imgError) {
    return (
      <img
        src={avatarSrc}
        alt={authorName}
        onError={() => setImgError(true)}
        className={`${sizeClasses} rounded-full object-cover shrink-0 border border-sky-500/40 shadow-sm ${className}`}
      />
    );
  }

  // Fallback icon selection based on author role or name
  const renderFallbackIcon = () => {
    const roleLower = (authorRole + ' ' + authorName).toLowerCase();
    if (roleLower.includes('مدیر') || roleLower.includes('superadmin') || roleLower.includes('ارشد')) {
      return <Crown className={`${iconSizes} text-amber-400`} />;
    }
    if (roleLower.includes('ربات') || roleLower.includes('دیپ‌سیک') || roleLower.includes('deepseek') || roleLower.includes('ai')) {
      return <Bot className={`${iconSizes} text-purple-400`} />;
    }
    if (roleLower.includes('تحریریه') || roleLower.includes('نویسنده') || roleLower.includes('editor')) {
      return <PenTool className={`${iconSizes} text-sky-400`} />;
    }
    if (roleLower.includes('تحلیل')) {
      return <Sparkles className={`${iconSizes} text-emerald-400`} />;
    }
    if (roleLower.includes('سولمینت') || roleLower.includes('solmint')) {
      return <ShieldCheck className={`${iconSizes} text-[#14F195]`} />;
    }
    return <User className={`${iconSizes} text-slate-300`} />;
  };

  return (
    <div
      className={`${sizeClasses} rounded-full bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 border border-slate-700/80 flex items-center justify-center shrink-0 shadow-inner ${className}`}
      title={authorName}
    >
      {renderFallbackIcon()}
    </div>
  );
};
