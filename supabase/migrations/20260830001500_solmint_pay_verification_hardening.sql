-- Verification hardening aligned with Solana's current payment guidance.
-- This migration is intentionally NOT applied to production yet.
-- It snapshots the token program/decimals used by a payment and adds the
-- encrypted webhook-secret envelope required by the signing worker.

alter table public.pay_payment_intents
  add column if not exists token_program text,
  add column if not exists token_decimals integer;

alter table public.pay_payment_transactions
  add column if not exists token_mint text,
  add column if not exists token_program text,
  add column if not exists token_decimals integer;

alter table public.pay_payment_transfers
  add column if not exists token_program text,
  add column if not exists token_decimals integer;

alter table public.pay_webhooks
  add column if not exists encrypted_secret text,
  add column if not exists secret_key_version text;

alter table public.pay_payment_intents
  add constraint pay_payment_token_program_check
  check (
    (asset = 'SOL' and token_mint is null and token_program is null and token_decimals is null)
    or
    (asset in ('USDC','USDT') and token_mint is not null and token_program is not null and token_decimals is not null and token_decimals between 0 and 255)
  );

alter table public.pay_payment_transactions
  add constraint pay_tx_token_program_check
  check (
    (asset = 'SOL' and token_mint is null and token_program is null and token_decimals is null)
    or
    (asset in ('USDC','USDT') and token_mint is not null and token_program is not null and token_decimals is not null and token_decimals between 0 and 255)
  );

alter table public.pay_payment_transfers
  add constraint pay_transfer_token_program_check
  check (
    (asset = 'SOL' and token_mint is null and token_program is null and token_decimals is null)
    or
    (asset in ('USDC','USDT') and token_mint is not null and token_program is not null and token_decimals is not null and token_decimals between 0 and 255)
  );

-- HMAC signing requires the secret itself (or an encrypted form) at delivery
-- time. The hash remains useful for integrity/rotation checks but is not a
-- signing key. Production code must decrypt only inside the isolated webhook
-- signer/worker boundary and must never expose this value to clients.
alter table public.pay_webhooks
  add constraint pay_webhooks_secret_envelope_check
  check (
    encrypted_secret is null
    or (char_length(encrypted_secret) >= 32 and char_length(encrypted_secret) <= 4096)
  );

comment on column public.pay_payment_intents.token_program is 'Authoritative Token Program or Token-2022 program address snapshotted at payment creation.';
comment on column public.pay_payment_intents.token_decimals is 'Mint decimals snapshotted at payment creation; used only for verification/display, never for floating-point accounting.';
comment on column public.pay_webhooks.encrypted_secret is 'Encrypted webhook signing secret; decrypt only in the isolated signing worker using the configured key-management provider.';
comment on column public.pay_webhooks.secret_hash is 'Integrity/rotation fingerprint only; not usable as the HMAC signing key.';
