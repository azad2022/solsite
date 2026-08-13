import { Article } from '../types';

/**
 * Lightweight internal linking engine.
 * Scores article relationships without changing URLs or taxonomy.
 * Designed for SEO topic clusters.
 */

const normalize = (value: string) => value.toLowerCase().replace(/[\u200c\s]+/g, ' ').trim();

const topicKeywords: Record<string, string[]> = {
  solana: ['سولانا', 'solana', 'sol'],
  defi: ['defi', 'دیفای', 'نقدینگی', 'استخر'],
  security: ['امنیت', 'کیف پول', 'کلید خصوصی', 'امن'],
  development: ['توسعه', 'قرارداد', 'برنامه نویسی', 'web3', 'وب۳'],
  trading: ['ترید', 'معامله', 'بازار', 'تحلیل']
};

function keywordScore(a: Article, b: Article): number {
  const source = normalize(`${a.title} ${a.summary} ${a.tags.join(' ')}`);
  const target = normalize(`${b.title} ${b.summary} ${b.tags.join(' ')}`);

  return Object.values(topicKeywords).reduce((score, words) => {
    const matched = words.some(word => source.includes(word) && target.includes(word));
    return score + (matched ? 5 : 0);
  }, 0);
}

export function scoreRelatedArticles(source: Article, candidate: Article): number {
  if (source.id === candidate.id) return -1;

  let score = 0;

  if (source.category === candidate.category) score += 20;

  const sharedTags = source.tags.filter(tag => candidate.tags.includes(tag));
  score += sharedTags.length * 10;

  score += keywordScore(source, candidate);

  return score;
}

export function getRelatedArticles(
  source: Article,
  articles: Article[],
  limit = 5
): Article[] {
  return articles
    .map(article => ({ article, score: scoreRelatedArticles(source, article) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.article);
}
