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
  if (source.includes('  categoryId?: string;\n')) return source;
  const anchor = "  category: 'آموزش سولانا' | 'توسعه وب۳' | 'امنیت' | 'اخبار و تحلیل' | 'آموزش ساخت میم کوین' | 'آموزش ساخت NFT' | 'کیف پول سولانا' | 'ترید' | 'پراپ تریدینگ';\n";
  if (!source.includes(anchor)) throw new Error('[category-default] Article category anchor not found');
  return source.replace(anchor, anchor + "  categoryId?: string;\n");
}, 'add persistent Article.categoryId');

patchFile('src/utils/supabaseClient.ts', source => {
  if (source.includes('categoryId: item.category_id || undefined,')) return source;
  const anchor = "      category: item.category || 'آموزش سولانا',\n";
  if (!source.includes(anchor)) throw new Error('[category-default] Supabase article category mapping anchor not found');
  return source.replace(anchor, anchor + "      categoryId: item.category_id || undefined,\n");
}, 'hydrate Article.categoryId from Supabase');

patchFile('server.ts', source => {
  let out = source;
  const readAnchor = "            category: item.category || \"آموزش سولانا\",\n";
  if (!out.includes('categoryId: item.category_id || undefined')) {
    if (!out.includes(readAnchor)) throw new Error('[category-default] server article category mapping anchor not found');
    out = out.replace(readAnchor, readAnchor + "            categoryId: item.category_id || undefined,\n");
  }
  const writeAnchor = "            category: article.category,\n";
  if (!out.includes('category_id: article.categoryId || null,')) {
    if (!out.includes(writeAnchor)) throw new Error('[category-default] server article write category anchor not found');
    out = out.replace(writeAnchor, writeAnchor + "            category_id: article.categoryId || null,\n");
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
    const categoryState = "  const [formCategory, setFormCategory] = useState<Article['category']>('آموزش سولانا');\n";
    if (!out.includes(categoryState)) throw new Error('[category-default] formCategory state anchor not found');
    out = out.replace(categoryState, categoryState + "  const [articleCategories, setArticleCategories] = useState<Array<any>>([]);\n  const [formCategoryId, setFormCategoryId] = useState('');\n");
  }

  if (!out.includes('fetchArticleCategories(false, true)')) {
    const effectAnchor = "  useEffect(() => {\n    const syncUsersAndData = () => {\n";
    if (!out.includes(effectAnchor)) throw new Error('[category-default] data sync effect anchor not found');
    const insertion = "    fetchArticleCategories(false, true).then((categories) => {\n      setArticleCategories(categories || []);\n    }).catch(() => {});\n\n";
    out = out.replace(effectAnchor, effectAnchor + insertion);
  }

  if (!out.includes("setFormCategoryId(articleToEdit.categoryId || ''),")) {
    const editLine = "      setFormCategory(articleToEdit.category);\n";
    if (!out.includes(editLine)) throw new Error('[category-default] edit category line not found');
    out = out.replace(editLine, editLine + "      setFormCategoryId(articleToEdit.categoryId || articleCategories.find((c: any) => c.name === articleToEdit.category)?.id || '');\n");
  }

  const newCategoryLine = "      setFormCategory('آموزش سولانا');\n";
  if (!out.includes("      setFormCategoryId(articleCategories.find((c: any) => c.name === 'آموزش سولانا')?.id || '');\n")) {
    if (!out.includes(newCategoryLine)) throw new Error('[category-default] new article category line not found');
    out = out.replace(newCategoryLine, newCategoryLine + "      setFormCategoryId(articleCategories.find((c: any) => c.name === 'آموزش سولانا')?.id || '');\n");
  }

  const defaultCover = "      setFormCoverImage('https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1200&q=80');\n";
  if (out.includes(defaultCover)) out = out.replace(defaultCover, "      setFormCoverImage('');\n");

  if (!out.includes('const selectedArticleCategory = articleCategories.find')) {
    const saveAnchor = "    const finalCoverImage = formCoverImage.trim();\n";
    if (!out.includes(saveAnchor)) throw new Error('[category-default] article save cover anchor not found');
    const helper = "    const selectedArticleCategory = articleCategories.find((c: any) => c.id === formCategoryId || c.name === formCategory);\n    const categoryDefaultMediaUrl = String(selectedArticleCategory?.default_media_url || '').trim();\n";
    out = out.replace(saveAnchor, "    const finalCoverImage = formCoverImage.trim();\n" + helper);
  }

  out = out.replace(
    "    if (isCoverRequired && !formCoverImage.trim()) {",
    "    if (isCoverRequired && !formCoverImage.trim() && !categoryDefaultMediaUrl) {"
  );

  if (!out.includes('categoryId: formCategoryId || undefined,')) {
    const categorySavePattern = "            category: formCategory,\n";
    const count = out.split(categorySavePattern).length - 1;
    if (count < 2) throw new Error(`[category-default] Expected two article category save sites, found ${count}`);
    out = out.replaceAll(categorySavePattern, categorySavePattern + "            categoryId: formCategoryId || undefined,\n");
  }

  const selectRegex = /<select\n\s+value=\{formCategory\}\n\s+onChange=\{\(e\) => setFormCategory\(e\.target\.value as any\)\}\n[\s\S]*?<\/select>/m;
  if (selectRegex.test(out)) {
    const replacement = `<select\n                      value={formCategory}\n                      onChange={(e) => {\n                        const nextName = e.target.value;\n                        setFormCategory(nextName as Article['category']);\n                        setFormCategoryId(articleCategories.find((c: any) => c.name === nextName)?.id || '');\n                      }}\n                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200"\n                    >\n                      {articleCategories.length > 0 ? articleCategories.map((category: any) => (\n                        <option key={category.id} value={category.name}>{category.name}</option>\n                      )) : (\n                        <>\n                          <option value="آموزش سولانا">آموزش سولانا</option>\n                          <option value="توسعه وب۳">توسعه وب۳</option>\n                          <option value="امنیت">امنیت</option>\n                          <option value="اخبار و تحلیل">اخبار و تحلیل</option>\n                        </>\n                      )}\n                    </select>`;
    out = out.replace(selectRegex, replacement);
  }

  const coverLabelAnchor = "                      <p className=\"text-[11px] text-slate-400 mt-1\">\n";
  if (!out.includes('تصویر پیش‌فرض دسته‌بندی') && out.includes(coverLabelAnchor)) {
    out = out.replace(coverLabelAnchor, "                      {!formCoverImage && categoryDefaultMediaUrl && (\n                        <div className=\"mt-2 p-2 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-2\">\n                          <img src={categoryDefaultMediaUrl} alt=\"تصویر پیش‌فرض دسته‌بندی\" className=\"w-16 h-10 object-cover rounded-lg\" />\n                          <span className=\"text-[10px] text-emerald-300\">تصویر پیش‌فرض دسته‌بندی «{formCategory}» هنگام انتشار خودکار استفاده خواهد شد.</span>\n                        </div>\n                      )}\n\n" + coverLabelAnchor);
  }

  return out;
}, 'wire dynamic categories and category-default fallback into article editor');

console.log('✓ [category-default] Article/category integration patch complete.');
