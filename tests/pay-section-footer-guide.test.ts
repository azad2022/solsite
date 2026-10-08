import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app=readFileSync('src/pay/PayApp.tsx','utf8');
const guide=readFileSync('src/pay/components/PaySectionGuide.tsx','utf8');
const i18n=readFileSync('src/pay/components/pay-section-guide-i18n.ts','utf8');
const bulk=readFileSync('src/pay/components/pay-bulk-i18n.ts','utf8');
const payI18n=readFileSync('src/pay/i18n.ts','utf8');

test('section guide is rendered from localized presentation data and adds no backend calls',()=>{
  assert.match(app,/PaySectionGuide/);
  assert.match(app,/<PaySectionGuide locale=\{locale\} section=\{currentSection\} \/>/);
  assert.match(guide,/trainingT\(locale\)\.topics/);
  assert.doesNotMatch(guide,/fetch\(/);
  assert.doesNotMatch(guide,/supabase/i);
});

test('all Pay routes have guide coverage, including dedicated workflow guides',()=>{
  for(const id of ['overview','dashboard','checkout','transactions','merchants','wallet','customers','referrals','reports','developer','security','tickets','webhooks']) {
    assert.ok(guide.includes(id + ':'), 'Missing guide mapping for ' + id);
  }
  for(const key of ['invoices','payment-links','bulk-pay','api-keys']) {
    assert.match(i18n,new RegExp(key.replace('-', '\\-')+'\\s*:\\s*\\{'));
  }
});

test('Persian Bulk Pay navigation and feature copy are localized',()=>{
  assert.match(payI18n,/bulkPayNavLabel: 'پرداخت گروهی'/);
  assert.match(bulk,/title:'پرداخت گروهی'/);
  assert.match(bulk,/\bBulk Pay\b/);
});

test('Pay uses the already-resolved application session and guards loading/anonymous states',()=>{
  assert.match(app,/applicationUser: PaySessionUser \| null/);
  assert.match(app,/applicationUser\?\.id/);
  assert.doesNotMatch(app,/getPaySessionUser/);
  assert.match(app,/showSessionLoadingPanel/);
  assert.match(app,/showSessionRequiredPanel/);
  assert.match(app,/kind="session-loading"/);
  assert.match(app,/kind="session-required"/);
});
