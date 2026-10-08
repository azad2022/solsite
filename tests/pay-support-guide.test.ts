import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app=readFileSync('src/pay/PayApp.tsx','utf8');
const tickets=readFileSync('src/pay/components/PayTicketCenter.tsx','utf8');
const training=readFileSync('src/pay/components/PayTrainingCenter.tsx','utf8');
const i18n=readFileSync('src/pay/components/pay-training-i18n.ts','utf8');

test('contextual footer guides are removed from ordinary Pay sections and owned by Support',()=>{
  assert.doesNotMatch(app,/PaySectionGuide/);
  assert.match(app,/<footer className="pay-footer">\s*<div className="pay-footer-legal">/);
  assert.match(tickets,/PayTrainingCenter locale=\{locale\}/);
});

test('Support guide hub has searchable localized presentation UI',()=>{
  assert.match(training,/useState\(/);
  assert.match(training,/type="search"/);
  assert.match(training,/copy\.searchPlaceholder/);
  assert.match(training,/copy\.resultCount/);
  assert.match(training,/pay-training-no-results/);
  assert.doesNotMatch(training,/fetch\(/);
  assert.doesNotMatch(training,/supabase/i);
});

test('Support guide catalog includes dedicated operational guides',()=>{
  for(const id of ['onboarding','account-wallet','overview','checkout','transactions','customers','invoices','payment-links','bulk-pay','referrals','reports','api-keys','developer','security','tickets']) {
    assert.ok(i18n.includes(`id:'${id}'`), 'Missing support guide: ' + id);
  }
  assert.match(i18n,/مرکز راهنمای SolMint Pay/);
  assert.match(i18n,/راهنماهای کاربردی|راهنمای کاربردی/);
});

test('Bulk Pay support guidance matches the real form and keeps financial truth server-authoritative',()=>{
  const start=i18n.indexOf("id:'bulk-pay'");
  const end=i18n.indexOf("id:'api-keys'");
  const bulk=i18n.slice(start,end);
  assert.match(bulk,/واحد همان دارایی|normal unit|وحدة الأصل نفسها|обычных единицах/);
  assert.match(bulk,/حداکثر ۵۰ پرداخت|up to 50 payouts|حتى 50 دفعة|50 выплат/);
  assert.match(bulk,/خودکار خرد نمی‌شود|not automatically split|لن يتم تقسيمه تلقائيًا|не разбивается автоматически/);
  assert.match(bulk,/تکمیل‌شده نیست|not.*completed|لا يعني الاكتمال|не означает завершено/);
});
