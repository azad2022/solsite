import { Article, MediaItem, Testimonial } from '../types';

export const INITIAL_TESTIMONIALS: Testimonial[] = [
  {
    id: 't-1',
    name: 'مهندس محمدرضا شریفی',
    role: 'توسعه‌دهنده Web3 و کریپتو',
    comment: 'سولمینت واقعاً سرعت کار روی سولانا را بالا برد. ساخت توکن با لغو Freeze Authority بدون نیاز به کدهای Rust دقیقاً همان چیزی بود که نیاز داشتم.',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    stars: 5,
    createdAt: '۱۴۰۴/۰۵/۰۱',
    createdAtJalali: '۱۴۰۴/۰۵/۰۱',
    createdAtGregorian: '2025/07/23',
    approved: true
  },
  {
    id: 't-2',
    name: 'سارا کریمی',
    role: 'بنیان‌گذار پروژه NFT',
    comment: 'رابط کاربری غیرامانی بسیار امن و تمیز است. قابلیت ضرب NFT متالپیکس روی موبایل با کارمزد بسیار ناچیزی انجام شد و فوراً در Phantom قرار گرفت.',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80',
    stars: 5,
    createdAt: '۱۴۰۴/۰۵/۰۲',
    createdAtJalali: '۱۴۰۴/۰۵/۰۲',
    createdAtGregorian: '2025/07/24',
    approved: true
  },
  {
    id: 't-3',
    name: 'علی احمدی',
    role: 'فعال اکوسیستم سولانا',
    comment: 'قابلیت Rent Claim یا بازیابی کارمزد اجاره عالی بود! بیش از ۲.۵ سولانای قفل شده در حساب‌های قدیمی توکن‌هایم را با یک کلیک آزاد کردم.',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    stars: 5,
    createdAt: '۱۴۰۴/۰۵/۰۳',
    createdAtJalali: '۱۴۰۴/۰۵/۰۳',
    createdAtGregorian: '2025/07/25',
    approved: true
  }
];

export const INITIAL_ARTICLES: Article[] = [];

export const INITIAL_MEDIA_ITEMS: MediaItem[] = [
  {
    id: 'm-1',
    name: 'solana-network-banner.jpg',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1200&q=80',
    uploadedAt: '۱۴۰۴/۰۵/۰۱',
    sizeMb: 1.2
  },
  {
    id: 'm-2',
    name: 'security-vault.jpg',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1200&q=80',
    uploadedAt: '۱۴۰۴/۰۴/۲۵',
    sizeMb: 0.9
  },
  {
    id: 'm-3',
    name: 'solana-tutorial-demo.mp4',
    type: 'video',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    uploadedAt: '۱۴۰۴/۰۵/۰۲',
    sizeMb: 14.5
  }
];
