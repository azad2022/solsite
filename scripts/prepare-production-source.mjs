import { spawnSync } from 'node:child_process';

const steps = [
  ['harden-admin-frontend-v2.mjs', 'frontend auth/session hardening'],
  ['media-article-linking-patch-fixed.mjs', 'article/media linking'],
  ['category-default-media-patch.mjs', 'category default media'],
  ['category-article-default-integration-patch.mjs', 'article/category integration'],
  ['final-auth-cleanup.mjs', 'legacy auth cleanup'],
  ['harden-server-auth-v2.mjs', 'server auth hardening'],
  ['production-comments-client-wiring.mjs', 'public comments wiring'],
  ['production-comments-admin-patch.mjs', 'comments moderation wiring'],
  ['production-comments-unification.mjs', 'comments convergence'],
  ['production-comments-build-verify.mjs', 'comments verification'],
  ['solana-projects-cluster-seo.mjs', 'Solana topical SEO wiring'],
  ['perf-split.mjs', 'performance split'],
  ['fix-auth-pbkdf2-buffers.mjs', 'PBKDF2 TypeScript normalization'],
  ['stage2-production-hardening.mjs', 'Stage 2 invariants'],
  ['stage3-auth-hardening.mjs', 'Stage 3 invariants']
];

for (const [script, label] of steps) {
  const result = spawnSync(process.execPath, [`scripts/${script}`], {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`[prepare-production-source] ${label} failed (${script}) with exit code ${result.status ?? 'unknown'}`);
  }
}

console.log('✓ Production source preparation completed.');
