import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readdirSync } from 'node:fs';

const dir = 'supabase/migrations';
const files = new Set(readdirSync(dir));

test('local Supabase migration filenames stay aligned with production migration history', () => {
  const expected = [
    '20260925181331_solmint_pay_invoice_creation.sql',
    '20260927134700_solmint_pay_payment_link_end_to_end.sql',
    '20260927150000_solmint_pay_payment_link_mutations.sql',
    '20260930073558_solmint_pay_public_payer_identity_20260930100000.sql',
    '20260930073605_solmint_pay_payment_email_delivery_20260930101000.sql',
  ];
  for (const file of expected) assert.equal(existsSync(dir + '/' + file), true, 'Missing migration filename: ' + file);
});
