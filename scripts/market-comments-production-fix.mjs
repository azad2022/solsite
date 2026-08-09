import fs from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const files = [resolve(root, 'server.ts'), resolve(root, 'dist/server.cjs')];

function patch(filePath) {
  if (!fs.existsSync(filePath)) return false;
  let source = fs.readFileSync(filePath, 'utf8');
  const original = source;

  // /solana-price is a public virtual page, not a row in public.articles.
  // The production comments layer previously rejected it with 404 before the
  // insert, which made the price-page comment form unusable.
  const pattern = /const \{ data: article, error: articleError \} = await serverSupabase\.from\('articles'\)\.select\('id,slug'\)\.or\(`id\.eq\.\$\{articleId\},slug\.eq\.\$\{articleId\}`\)\.maybeSingle\(\);\s*if \(articleError \|\| !article\) return res\.status\(404\)\.json\(\{ success: false, message: 'مقاله مورد نظر یافت نشد\.' \}\);\s*const canonicalArticleId = String\(article\.id\);/;
  const replacement = `let canonicalArticleId = articleId;\n        if (articleId !== 'solana-price') {\n          const { data: article, error: articleError } = await serverSupabase.from('articles').select('id,slug').or(\`id.eq.\${articleId},slug.eq.\${articleId}\`).maybeSingle();\n          if (articleError || !article) return res.status(404).json({ success: false, message: 'مقاله مورد نظر یافت نشد.' });\n          canonicalArticleId = String(article.id);\n        }`;

  if (pattern.test(source)) source = source.replace(pattern, replacement);
  else if (!source.includes("articleId !== 'solana-price'")) {
    console.warn(`Market comment article guard not found in ${filePath}`);
    return false;
  }

  if (source !== original) {
    fs.writeFileSync(filePath, source, 'utf8');
    console.log(`Applied Solana market comments fix to ${filePath}`);
    return true;
  }
  return false;
}

files.forEach(patch);
