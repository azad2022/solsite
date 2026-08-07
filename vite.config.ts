import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

function articleCategoryRegistryPlugin(): Plugin {
  const registryPath = path.resolve(__dirname, 'src/config/articleCategories.json');
  const categories = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as string[];
  const allCategories = ['همه', ...categories];
  const options = categories.map(category => `<option value="${category}">${category}</option>`).join('\n');
  const union = categories.map(category => `'${category}'`).join(' | ');

  return {
    name: 'solmint-article-category-registry',
    enforce: 'pre',
    transform(code, id) {
      if (id.endsWith('/src/components/BlogHub.tsx')) {
        return code.replace(
          /const categories = \[[\s\S]*?\];/,
          `const categories = ${JSON.stringify(allCategories)};`
        );
      }
      if (id.endsWith('/src/components/AdminCmsModal.tsx')) {
        const nextCode = code
          .replace(
            /useState<'آموزش سولانا' \| 'توسعه وب۳' \| 'امنیت' \| 'اخبار و تحلیل'>\('آموزش سولانا'\)/,
            `useState<${union}>('آموزش سولانا')`
          )
          .replace(
            /<option value=\\"آموزش سولانا\\">آموزش سولانا<\\/option>\n\s*<option value=\\"توسعه وب۳\\">توسعه وب۳<\\/option>\n\s*<option value=\\"امنیت\\">امنیت<\\/option>\n\s*<option value=\\"اخبار و تحلیل\\">اخبار و تحلیل<\\/option>/,
            options
          );
        return nextCode;
      }
      return null;
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [articleCategoryRegistryPlugin(), react(), tailwindcss()],
    resolve: {
      alias: { '@': path.resolve(__dirname, '.') },
    },
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
  };
});
