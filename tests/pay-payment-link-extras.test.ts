import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizePaymentLinkSuccessUrl,
  parseNullableCapacityCount,
  parsePaymentLinkCheckoutFields,
  parsePaymentLinkMaxPayments,
  sanitizePaymentLinkCheckoutFieldValues,
} from '../src/pay/services/paymentLinkExtras';

const fields = [
  { key: 'order_id', label: 'Order ID', type: 'text', required: true },
  { key: 'email', label: 'Receipt email', type: 'email', required: false },
  { key: 'notes', label: 'Notes', type: 'textarea', required: false },
] as const;

test('Payment Link success URL is optional and accepts only absolute HTTPS destinations without credentials', () => {
  assert.equal(normalizePaymentLinkSuccessUrl(undefined), null);
  assert.equal(normalizePaymentLinkSuccessUrl(null), null);
  assert.equal(normalizePaymentLinkSuccessUrl('https://merchant.example/paid'), 'https://merchant.example/paid');
  assert.equal(normalizePaymentLinkSuccessUrl('https://merchant.example:8443/paid'), 'https://merchant.example:8443/paid');
  assert.equal(normalizePaymentLinkSuccessUrl('https://merchant.example:443/paid'), 'https://merchant.example/paid');
  assert.throws(() => normalizePaymentLinkSuccessUrl('/paid'));
  assert.throws(() => normalizePaymentLinkSuccessUrl('http://merchant.example/paid'));
  assert.throws(() => normalizePaymentLinkSuccessUrl('https://user:pass@merchant.example/paid'));
  assert.throws(() => normalizePaymentLinkSuccessUrl('https://merchant.example:99999/paid'));
  assert.throws(() => normalizePaymentLinkSuccessUrl('https://merchant_name.example/paid'));
  assert.throws(() => normalizePaymentLinkSuccessUrl('https://merchant.example/%zz'));
  assert.throws(() => normalizePaymentLinkSuccessUrl('https://merchant.example/has space'));
  assert.throws(() => normalizePaymentLinkSuccessUrl('https://merchant.example/' + 'a'.repeat(2048)));
});

test('Payment Link payment limit is a positive PostgreSQL integer; null means unlimited', () => {
  assert.equal(parsePaymentLinkMaxPayments(undefined), null);
  assert.equal(parsePaymentLinkMaxPayments(null), null);
  assert.equal(parsePaymentLinkMaxPayments(''), null);
  assert.equal(parsePaymentLinkMaxPayments('1'), 1);
  assert.equal(parsePaymentLinkMaxPayments(2147483647), 2147483647);
  for (const invalid of [0, -1, 1.5, '0', '-2', '1.2', '01', '2147483648', Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => parsePaymentLinkMaxPayments(invalid));
  }
  assert.equal(parseNullableCapacityCount('0', 'remainingPayments'), 0);
  assert.throws(() => parseNullableCapacityCount('-1', 'remainingPayments'));
});

test('Checkout field definitions are strict, uniquely keyed and capped at five', () => {
  assert.deepEqual(parsePaymentLinkCheckoutFields(fields), fields);
  assert.equal(parsePaymentLinkCheckoutFields([]).length, 0);
  assert.throws(() => parsePaymentLinkCheckoutFields([...fields, ...fields]));
  assert.throws(() => parsePaymentLinkCheckoutFields([{ key: 'bad-key', label: 'Bad', type: 'text', required: false }]));
  assert.throws(() => parsePaymentLinkCheckoutFields([{ key: 'x', label: '', type: 'text', required: false }]));
  assert.throws(() => parsePaymentLinkCheckoutFields([{ key: 'x', label: 'X', type: 'number', required: false }]));
  assert.throws(() => parsePaymentLinkCheckoutFields([{ key: 'x', label: 'X', type: 'email', required: 'yes' }]));
  assert.throws(() => parsePaymentLinkCheckoutFields(Array.from({ length: 6 }, (_, i) => ({
    key: 'field_' + i, label: 'Field ' + i, type: 'text', required: false,
  }))));
  assert.throws(() => parsePaymentLinkCheckoutFields([{ ...fields[0], extra: true }]));
});

test('Custom field values enforce required fields, accepted keys, email syntax and lengths', () => {
  assert.deepEqual(
    sanitizePaymentLinkCheckoutFieldValues(fields, {
      order_id: '  ORDER-42  ',
      email: ' customer@example.com ',
      notes: 'First line\r\nSecond line',
    }),
    { order_id: 'ORDER-42', email: 'customer@example.com', notes: 'First line\nSecond line' },
  );
  assert.throws(() => sanitizePaymentLinkCheckoutFieldValues(fields, { email: 'customer@example.com' }));
  assert.throws(() => sanitizePaymentLinkCheckoutFieldValues(fields, { order_id: 'ORDER-42', other: 'unexpected' }));
  assert.throws(() => sanitizePaymentLinkCheckoutFieldValues(fields, { order_id: 'ORDER-42', email: 'not-an-email' }));
  assert.throws(() => sanitizePaymentLinkCheckoutFieldValues(fields, { order_id: 'ORDER-42', notes: 'x'.repeat(2001) }));
  assert.throws(() => sanitizePaymentLinkCheckoutFieldValues(fields, { order_id: 42 }));
  assert.deepEqual(sanitizePaymentLinkCheckoutFieldValues(fields, { order_id: 'ORDER-42', email: '' }), { order_id: 'ORDER-42' });
});
