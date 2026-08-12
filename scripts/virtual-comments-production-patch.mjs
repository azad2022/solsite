import fs from 'node:fs';

const root = process.cwd();
const marker = '  // VIRTUAL SOLANA PRICE COMMENT TARGET';

function patchServer(filePath) {
  if (!fs.existsSync(filePath)) return false;
  let source = fs.readFileSync(filePath, 'utf8');
  if (source.includes(marker)) return false;

  const lookup = "        const { data: article, error: articleError } = await serverSupabase.from('articles').select('id,slug').or(`id.eq.${articleId},slug.eq.${articleId}`).maybeSingle();\n        if (articleError || !article) return res.status(404).json({ success: false, message: 'مقاله مورد نظر یافت نشد.' });\n        const canonicalArticleId = String(article.id);";
  if (!source.includes(lookup)) {
    console.warn(`Virtual comments lookup marker not found in ${filePath}`);
    return false;
  }

  const replacement = `        ${marker}\n        const isVirtualTarget = articleId === 'solana-price';\n        let canonicalArticleId = articleId;\n        if (!isVirtualTarget) {\n          const { data: article, error: articleError } = await serverSupabase.from('articles').select('id,slug').or(\`id.eq.\${articleId},slug.eq.\${articleId}\`).maybeSingle();\n          if (articleError || !article) return res.status(404).json({ success: false, message: 'مقاله مورد نظر یافت نشد.' });\n          canonicalArticleId = String(article.id);\n        }`;

  source = source.replace(lookup, replacement);
  fs.writeFileSync(filePath, source, 'utf8');
  console.log(`Applied virtual Solana price comment target to ${filePath}`);
  return true;
}

for (const file of [`${root}/server.ts`, `${root}/dist/server.cjs`]) patchServer(file);
