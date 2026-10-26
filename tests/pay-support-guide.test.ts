import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app=readFileSync('src/pay/PayApp.tsx','utf8');
const tickets=readFileSync('src/pay/components/PayTicketCenter.tsx','utf8');
const training=readFileSync('src/pay/components/PayTrainingCenter.tsx','utf8');
const i18n=readFileSync('src/pay/components/pay-training-i18n.ts','utf8');
const browserE2E=readFileSync('e2e/pay-production-ui.e2e.mjs','utf8');

test('contextual footer guides are removed from ordinary Pay sections and owned by Support',()=>{
  assert.doesNotMatch(app,/PaySectionGuide/);
  assert.match(app,/<footer className="pay-footer">\s*<div className="pay-footer-legal">/);
  assert.match(tickets,/PayTrainingCenter locale=\{locale\}/);
  assert.match(tickets,/pay-ticket-id/);
  assert.match(tickets,/className="pay-ticket-messages" role="region" aria-label=\{ticketT\(locale,'conversation'\)\}/);
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
  for(const id of ['onboarding','account-wallet','overview','checkout','transactions','customers','billing-links','invoices','payment-links','bulk-pay','referrals','reports','api-keys','developer','security','tickets']) {
    assert.ok(i18n.includes(`id:'${id}'`), 'Missing support guide: ' + id);
  }
  const documentedIds=[...i18n.matchAll(/id:'([^']+)'/g)].map(match=>match[1]);
  assert.equal(new Set(documentedIds).size,16,'Each of the four locales must expose the same 16 guide topics.');
  assert.ok(documentedIds.includes('billing-links'),'Billing & Links guide must be covered by the catalogue test.');
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

test('Ticket list fails closed on merchant switches, errors and out-of-order responses',()=>{
  assert.match(tickets,/ticketListRequestSeq=useRef\(0\)/);
  assert.match(tickets,/activeTenantContext\.current=tenantContext/);
  assert.match(tickets,/selectedTicketIdRef\.current=selectedId/);
  assert.match(tickets,/selectedTicketIdRef\.current!==id/);
  assert.match(tickets,/detail\?\.ticket\.id===selectedId\?detail\.ticket:null/);
  assert.match(tickets,/current\?\.ticket\.id===ticketId\?\{\.\.\.current,ticket:updated\}:current/);
  assert.match(tickets,/requestContext!==activeTenantContext\.current/);
  assert.match(tickets,/const rows=await loadTickets\(false\); if\(requestContext!==activeTenantContext\.current \|\| !rows\) return/);
  assert.match(tickets,/return rows;/);
  assert.match(tickets,/requestSeq !== ticketListRequestSeq\.current/);
  assert.match(tickets,/setTickets\(\[\]\);\s*setSelectedId\(null\);\s*setDetail\(null\);\s*setDetailError\(null\);\s*setError\(accessError\(e\)\)/);
  assert.match(tickets,/return \(\)=>\{ \+\+ticketListRequestSeq\.current; \+\+detailRequestSeq\.current; \+\+moderationRequestSeq\.current; \};/);
});

test('Production browser E2E covers ticket lifecycle, access denial and mobile overflow',()=>{
  assert.match(browserE2E,/Anonymous requests must not be able to enumerate or mutate support tickets/);
  assert.match(browserE2E,/anonymousTicketList\.status\(\), 401/);
  assert.match(browserE2E,/anonymousTicketCreate\.status\(\), 401/);
  assert.match(browserE2E,/merchantStatusAttempt\.status\(\), 403/);
  assert.match(browserE2E,/foreignTicketResponse\.status\(\), 404/);
  assert.match(browserE2E,/closedReplyResponse\.status\(\), 409/);
  assert.match(browserE2E,/visibleTicketId\.innerText\(\)\)\.includes\(ticketId\)/);
  assert.match(browserE2E,/getByRole\('region', \{ name: 'Conversation', exact: true \}\)/);
  assert.match(browserE2E,/mobileTicketLayout\.layoutScrollWidth <= mobileTicketLayout\.layoutClientWidth \+ 1/);
});

test('Ticket status and access handling remain contract-backed and messages stay readable on mobile',()=>{
  for(const status of ['open','pending_customer','pending_admin','resolved','closed']) assert.ok(tickets.includes(status));
  assert.match(tickets,/error==='forbidden'\?ticketT\(locale,'forbidden'\):error==='unauthorized'\?ticketT\(locale,'unauthorized'\)/);
  assert.match(tickets,/detail && detail\.ticket\.id===selectedId && !detailError \?/);
  assert.match(tickets,/detailError!==null/);
  assert.match(tickets,/!detail \|\| detail\.ticket\.id!==selectedId \|\| detailError/);
  const ticketCss=readFileSync('src/pay/components/pay-tickets.css','utf8');
  assert.match(ticketCss,/@media\(max-width:900px\)\{\.pay-ticket-layout\{grid-template-columns:1fr\}/);
  assert.match(ticketCss,/max-width:560px/);
  assert.match(ticketCss,/flex-wrap:wrap/);
  assert.match(ticketCss,/overflow-wrap:anywhere/);
});
