import test from 'node:test';
import assert from 'node:assert/strict';
import { isPaySection, pathForPaySection } from '../src/pay/routing';
import { sectionLabel, sectionNavLabel } from '../src/pay/i18n';
import { matchPayRoute } from '../src/pay/route-match';

test('Bulk Pay is a registered Pay route in both directions',()=>{
  assert.equal(isPaySection('bulk-pay'),true);
  assert.equal(pathForPaySection('bulk-pay'),'/pay/bulk-pay');
  assert.deepEqual(matchPayRoute('/pay/bulk-pay'),{kind:'dashboard',section:'bulk-pay'});
  assert.equal(sectionLabel('fa-IR','bulk-pay'),'پرداخت گروهی');
  assert.equal(sectionNavLabel('en-US','bulk-pay'),'Bulk Pay');
});
