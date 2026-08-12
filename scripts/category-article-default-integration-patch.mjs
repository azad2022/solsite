import fs from 'node:fs';

function patchFile(path, transform, description) {
  if (!fs.existsSync(path)) throw new Error(`[category-default] Missing ${path}`);
  const source = fs.readFileSync(path, 'utf8');
  const result = transform(source);
  if (result === source) throw new Error(`[category-default] No changes made to ${path}: ${description}`);
  fs.writeFileSync(path, result, 'utf8');
  console.log(`✓ [category-default] ${description}`);
}

patchFile('src/types.ts', source => {
  if (source.includes('  categoryId?: string;')) return source;
  const anchor = /(^\s*category:\s*[^;]+;\s*$)/m;
  if (!anchor.test(source)) throw new Error('[category-default] Article category anchor not found');
  return source.replace(anchor, '$1\n  categoryId?: string;');
}, 'add persistent Article.categoryId');

patchFile('src/utils/supabaseClient.ts', source => {
  if (source.includes('categoryId: item.category_id || undefined')) return source;
  const anchor = "      category: item.category || 'آموزش سولانا',\n";
  if (!source.includes(anchor)) throw new Error('[category-default] Supabase article category mapping anchor not found');
  return source.replace(anchor, anchor + "      categoryId: item.category_id || undefined,\n");
}, 'hydrate Article.categoryId from Supabase');

patchFile('server.ts', source => {
  let out = source;
  if (!out.includes('categoryId: item.category_id || undefined')) {
    const readAnchor = /(^\s*category:\s*item\.category\s*\|\|\s*['\"]آموزش سولانا['\"],\s*$)/m;
    if (!readAnchor.test(out)) throw new Error('[category-default] server article category mapping anchor not found');
    out = out.replace(readAnchor, '$1\n            categoryId: item.category_id || undefined,');
  }
  if (!out.includes('category_id: article.categoryId || null')) {
    const writeAnchor = /(^\s*category:\s*article\.category,\s*$)/m;
    if (!writeAnchor.test(out)) throw new Error('[category-default] server article write category anchor not found');
    out = out.replace(writeAnchor, '$1\n            category_id: article.categoryId || null,');
  }
  return out;
}, 'persist and hydrate categoryId in the legacy server article path');

patchFile('src/components/AdminCmsModal.tsx', source => {
  let out = source;

  if (!out.includes("import { fetchArticleCategories } from './ArticleCategoryManager';")) {
    const importAnchor = "import { ProArticleEditor } from './ProArticleEditor';\n";
    if (!out.includes(importAnchor)) throw new Error('[category-default] AdminCmsModal import anchor not found');
    out = out.replace(importAnchor, importAnchor + "import { fetchArticleCategories } from './ArticleCategoryManager';\n");
  }

  if (!out.includes('const [articleCategories, setArticleCategories]')) {
    const categoryStateRegex = /(^\s*const\s*\[formCategory,\s*setFormCategory\]\s*=\s*useState(?:<[^>]+>)?\([^;\n]+\);\s*$)/m;
    const match = out.match(categoryStateRegex);
    if (!match) throw new Error('[category-default] formCategory state anchor not found');
    out = out.replace(categoryStateRegex, '$1\n  const [articleCategories, setArticleCategories] = useState<Array<any>>([]);\n  const [formCategoryId, setFormCategoryId] = useState(\'\');');
  }

  if (!out.includes('fetchArticleCategories(false, true)')) {
    const effectAnchor = "  useEffect(() => {\n    const syncUsersAndData = () => {\n";
    if (!out.includes(effectAnchor)) throw new Error('[category-default] data sync effect anchor not found');
    const insertion = "    fetchArticleCategories(false, true).then((categories) => {\n      setArticleCategories(categories || []);\n    }).catch(() => {});\n\n";
    out = out.replace(effectAnchor, effectAnchor + insertion);
  }

  if (!out.includes("setFormCategoryId(articleToEdit.categoryId || ''")) {
    const editLine = /(^\s*setFormCategory\(articleToEdit\.category\);\s*$)/m;
    if (!editLine.test(out)) throw new Error('[category-default] edit category line not found');
    out = out.replace(editLine, "$1\n      setFormCategoryId(articleToEdit.categoryId || articleCategories.find((c: any) => c.name === articleToEdit.category)?.id || '');");
  }

  if (!out.includes("setFormCategoryId(articleCategories.find((c: any) => c.name === 'آموزش سولانا')?.id || '')")) {
    const newCategoryLine = /(^\s*setFormCategory\(['\"]آموزش سولانا['\"]\);\s*$)/m;
    if (!newCategoryLine.test(out)) throw new Error('[category-default] new article category line not found');
    out = out.replace(newCategoryLine, "$1\n      setFormCategoryId(articleCategories.find((c: any) => c.name === 'آموزش سولانا')?.id || '');");
  }

  const defaultCover = "      setFormCoverImage('https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1200&q=80');\n";
  if (out.includes(defaultCover)) out = out.replace(defaultCover, "      setFormCoverImage('');\n");

  // The category default is component-scoped because it is consumed by both
  // handleSaveArticle and the editor JSX preview.
  if (!out.includes('const selectedArticleCategory = articleCategories.find((c: any) => c.id === formCategoryId || c.name === formCategory);')) {
    const saveComment = /(^\s*\/\/ SAVE ARTICLE\s*$)/m;
    if (!saveComment.test(out)) throw new Error('[category-default] save article anchor not found');
    const helper = "  const selectedArticleCategory = articleCategories.find((c: any) => c.id === formCategoryId || c.name === formCategory);\n  const categoryDefaultMediaUrl = String(selectedArticleCategory?.default_media_url || '').trim();\n\n";
    out = out.replace(saveComment, helper + '$1');
  }

  // Remove any old helper that may have been inserted inside handleSaveArticle.
  out = out.replace(/\n\s*const selectedArticleCategory = articleCategories\.find\(\(c: any\) => c\.id === formCategoryId \|\| c\.name === formCategory\);\n\s*const categoryDefaultMediaUrl = String\(selectedArticleCategory\?\.default_media_url \|\| ''\)\.trim\(\);/g, '');

  // Ensure component-level helper exists after cleanup.
  if (!out.includes('const selectedArticleCategory = articleCategories.find((c: any) => c.id === formCategoryId || c.name === formCategory);')) {
    const saveComment = /(^\s*\/\/ SAVE ARTICLE\s*$)/m;
    const helper = "  const selectedArticleCategory = articleCategories.find((c: any) => c.id === formCategoryId || c.name === formCategory);\n  const categoryDefaultMediaUrl = String(selectedArticleCategory?.default_media_url || '').trim();\n\n";
    out = out.replace(saveComment, helper + '$1');
  }

  out = out.replace(
    "    if (isCoverRequired && !formCoverImage.trim()) {",
    "    if (isCoverRequired && !formCoverImage.trim() && !categoryDefaultMediaUrl) {"
  );

  if (!out.includes('categoryId: formCategoryId || undefined')) {
    const categorySavePattern = /(^\s*category:\s*formCategory,\s*$)/gm;
    const matches = out.match(categorySavePattern) || [];
    if (matches.length < 1) throw new Error('[category-default] article category save site not found');
    out = out.replace(categorySavePattern, '$1\n            categoryId: formCategoryId || undefined,');
  }

  const selectRegex = /<select\s+value=\{formCategory\}\s+onChange=\{\(e\)\s*=>\s*setFormCategory\(e\.target\.value\s+as\s+any\)\}[\s\S]*?<\/select>/m;
  if (selectRegex.test(out)) {
    const replacement = `<select
                      value={formCategory}
                      onChange={(e) => {
                        const nextName = e.target.value;
                        setFormCategory(nextName as Article['category']);
                        setFormCategoryId(articleCategories.find((c: any) => c.name === nextName)?.id || '');
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200"
                    >
                      {articleCategories.length > 0 ? articleCategories.map((category: any) => (
                        <option key={category.id} value={category.name}>{category.name}</option>
                      )) : (
                        <>
                          <option value="آموزش سولانا">آموزش سولانا</option>
                          <option value="توسعه وب۳">توسعه وب۳</option>
                          <option value="امنیت">امنیت</option>
                          <option value="اخبار و تحلیل">اخبار و تحلیل</option>
                        </>
                      )}
                    </select>`;
    out = out.replace(selectRegex, replacement);
  }

  const coverLabelAnchor = /(^\s*<p className=\"text-\[11px\] text-slate-400 mt-1\">\s*$)/m;
  if (!out.includes('تصویر پیش‌فرض دسته‌بندی') && coverLabelAnchor.test(out)) {
    const section = "                      {!formCoverImage && categoryDefaultMediaUrl && (\n                        <div className=\"mt-2 p-2 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-2\">\n                          <img src={categoryDefaultMediaUrl} alt=\"تصویر پیش‌فرض دسته‌بندی\" className=\"w-16 h-10 object-cover rounded-lg\" />\n                          <span className=\"text-[10px] text-emerald-300\">تصویر پیش‌فرض دسته‌بندی «{formCategory}» هنگام انتشار خودکار استفاده خواهد شد.</span>\n                        </div>\n                      )}\n\n";
    out = out.replace(coverLabelAnchor, section + '$1');
  }

  return out;
}, 'wire dynamic categories and category-default fallback into article editor');

console.log('✓ [category-default] Article/category integration patch complete.');
