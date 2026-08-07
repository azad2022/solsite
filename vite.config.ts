import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

function articleCategoryRegistryPlugin(): Plugin {
  const registryPath = path.resolve(__dirname, 'src/config/articleCategories.json');
  const categories = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as string[];
  const allCategories = ['همه', ...categories];
  const staticOptions = categories.map(category => `<option value="${category}">${category}</option>`).join('\n');

  return {
    name: 'solmint-article-category-registry',
    enforce: 'pre',
    transform(code, id) {
      if (id.endsWith('/src/components/BlogHub.tsx')) {
        let transformed = code;
        transformed = transformed.replace(
          "import { buildTaxonomyUrl, getArticleCategoryTaxonomy, getArticleTagTaxonomy } from '../utils/articleTaxonomy';",
          "import { buildTaxonomyUrl, getArticleCategoryTaxonomy, getArticleTagTaxonomy } from '../utils/articleTaxonomy';\nimport { fetchArticleCategories } from './ArticleCategoryManager';"
        );
        transformed = transformed.replace(
          "  const [selectedCategory, setSelectedCategory] = useState<string>('همه');",
          "  const [selectedCategory, setSelectedCategory] = useState<string>('همه');\n  const [dynamicCategories, setDynamicCategories] = useState<string[]>([]);"
        );
        transformed = transformed.replace(
          "  const categories = ['همه', 'آموزش سولانا', 'توسعه وب۳', 'امنیت', 'اخبار و تحلیل', 'ترید', 'پراپ تریدینگ'];",
          "  useEffect(() => { fetchArticleCategories().then(items => setDynamicCategories(items.map(item => item.name))).catch(() => setDynamicCategories([])); }, []);\n\n  const categories = dynamicCategories.length ? ['همه', ...dynamicCategories] : " + JSON.stringify(allCategories) + ";"
        );
        return transformed;
      }
      if (id.endsWith('/src/components/AdminCmsModal.tsx')) {
        let transformed = code;
        transformed = transformed.replace(
          "import React, { useState, useEffect } from 'react';",
          "import React, { useState, useEffect } from 'react';\nimport { ArticleCategoryManager, ArticleCategorySelect } from './ArticleCategoryManager';"
        );
        transformed = transformed.replace(
          /const \[formCategory, setFormCategory\] = useState<'[^']+'(?: \| '[^']+')+>\('آموزش سولانا'\);/,
          "const [formCategory, setFormCategory] = useState<string>('آموزش سولانا');"
        );
        transformed = transformed.replace(
          /<select\n\s+value=\{formCategory\}\n\s+onChange=\{\(e\) => setFormCategory\(e\.target\.value as any\)\}\n\s+className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2\.5 text-slate-200"\n\s*>[\s\S]*?<\/select>/,
          '<ArticleCategorySelect value={formCategory} onChange={setFormCategory} />'
        );
        transformed = transformed.replace(
          /\{adminTab === 'seo' && \(\n\s*<div className="space-y-6 text-xs">/,
          "{adminTab === 'seo' && (\n              <div className=\"space-y-6 text-xs\">\n                <ArticleCategoryManager />"
        );
        if (transformed.includes('{/* STATIC_CATEGORY_OPTIONS_FALLBACK */}')) transformed = transformed.replace('{/* STATIC_CATEGORY_OPTIONS_FALLBACK */}', staticOptions);
        return transformed;
      }
      return null;
    },
  };
}

export default defineConfig(() => ({
  plugins: [articleCategoryRegistryPlugin(), react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  build: {
    target: 'esnext',
    minify: 'esbuild' as const,
    cssCodeSplit: true,
    sourcemap: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('lucide-react')) return 'vendor-lucide';
            if (id.includes('motion') || id.includes('framer-motion')) return 'vendor-motion';
            if (id.includes('recharts') || id.includes('d3')) return 'vendor-charts';
            return 'vendor-core';
          }
        },
      },
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
}));
