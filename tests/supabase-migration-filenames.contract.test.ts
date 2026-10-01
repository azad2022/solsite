import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import test from 'node:test';

const directory = 'supabase/migrations';
const files = new Set(readdirSync(directory));

test('local Pay migration filenames match the production migration history', () => {
  const expected = [
    '20260925181331_solmint_pay_invoice_creation.sql',
    '20260927134700_solmint_pay_payment_link_end_to_end.sql',
    '20260927150000_solmint_pay_payment_link_mutations.sql',
    '20260930073558_solmint_pay_public_payer_identity_20260930100000.sql',
    '20260930073605_solmint_pay_payment_email_delivery_20260930101000.sql',
    '20261001071009_solmint_pay_referral_short_codes.sql',
  ];

  for (const file of expected) {
    assert.equal(existsSync(directory + '/' + file), true, 'Missing migration filename: ' + file);
    assert.equal(files.has(file), true, 'Migration directory entry missing: ' + file);
  }

  const obsolete = [
    '20260925210000_solmint_pay_invoice_creation.sql',
    '20260927000100_solmint_pay_payment_link_end_to_end.sql',
    '20260930100000_solmint_pay_public_payer_identity.sql',
    '20260930101000_solmint_pay_payment_email_delivery.sql',
    '20261001090000_solmint_pay_referral_short_codes.sql',
  ];

  for (const file of obsolete) {
    assert.equal(files.has(file), false, 'Obsolete migration filename remains: ' + file);
  }
});
