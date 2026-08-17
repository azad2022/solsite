import { handleOptions, json } from './_shared';

export const onRequestGet = async ({ request }: { request: Request }) => {
  const options = handleOptions(request);
  if (options) return options;

  return json(request, {
    success: true,
    version: 'v1',
    name: 'Solmint Public Content API',
    documentation: 'https://solmint.ir/api/v1',
    endpoints: {
      articles: '/api/v1/articles',
      article: '/api/v1/articles/{slug}',
      categories: '/api/v1/categories',
      tags: '/api/v1/tags'
    },
    defaults: {
      page: 1,
      limit: 20,
      maxLimit: 50,
      sort: 'published_at',
      order: 'desc'
    }
  }, 200, 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
};
