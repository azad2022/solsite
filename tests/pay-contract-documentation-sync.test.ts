import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const openapi = JSON.parse(readFileSync('public/openapi.json','utf8')) as {
  info?: { version?: string };
  paths?: Record<string, unknown>;
};
const catalog = readFileSync('functions/.well-known/api-catalog.ts','utf8');

test('Pay read contracts are present in OpenAPI',()=>{
  assert.equal(openapi.info?.version,'1.4.0');
  for(const path of ['/api/pay/v1/invoices','/api/pay/v1/payment-links','/api/pay/v1/referrals','/api/pay/v1/customers','/api/pay/v1/reports']) {
    assert.ok(openapi.paths?.[path], path+' missing from OpenAPI');
  }
});

test('Pay read contracts are discoverable from API Catalog',()=>{
  for(const path of ['/api/pay/v1/invoices','/api/pay/v1/payment-links','/api/pay/v1/referrals']) {
    assert.ok(catalog.includes(path), path+' missing from API Catalog');
  }
});