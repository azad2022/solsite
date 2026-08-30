-- Ordered security cleanup and ownership hardening for SolMint Pay.
-- This is the single 01000 security migration. It consolidates the wallet
-- challenge metadata and the second-pass tenant/webhook invariants.

alter table public.pay_merchants
  alter column owner_user_id set not null;

create table if not exists public.pay_merchant_members (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.pay_merchants(id) on delete cascade,
  user_id text not null references public.users(id) on delete restrict,
  role text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, user_id),
  constraint pay_merchant_member_role_check
    check (role in ('owner','admin','finance','developer','viewer')),
  constraint pay_merchant_member_status_check
    check (status in ('active','suspended','removed'))
);

create index if not exists pay_merchant_members_user_idx
  on public.pay_merchant_members (user_id, status);

create index if not exists pay_merchant_members_merchant_idx
  on public.pay_merchant_members (merchant_id, status);

create unique index if not exists pay_merchant_members_one_owner_uidx
  on public.pay_merchant_members (merchant_id)
  where role = 'owner' and status = 'active';

alter table public.pay_webhooks
  add column if not exists signing_secret_ciphertext text,
  add column if not exists signing_secret_kid text;

alter table public.pay_wallet_challenges
  add column if not exists signature_base58 text,
  add column if not exists signer_public_key text,
  add column if not exists rejection_reason text;

create unique index if not exists pay_wallet_challenge_verified_uidx
  on public.pay_wallet_challenges (merchant_id, wallet_address)
  where status = 'verified';

create unique index if not exists pay_wallet_challenges_active_wallet_uidx
  on public.pay_wallet_challenges (merchant_id, wallet_address)
  where status = 'issued' and consumed_at is null;

alter table public.pay_merchant_wallets
  add column if not exists deactivated_at timestamptz;

-- HMAC signing needs server-usable secret material. The database contains only
-- an encrypted envelope; the plaintext secret is never stored. `secret_hash`
-- remains nullable for compatibility but is no longer the signing source.
alter table public.pay_webhooks
  alter column secret_hash drop not null;

comment on table public.pay_merchant_members is 'Merchant tenant membership and RBAC roles; authorization is resolved server-side.';
comment on column public.pay_webhooks.signing_secret_ciphertext is 'Encrypted webhook HMAC secret envelope; decrypt only inside the isolated server-side signing worker through KMS/HSM.';
comment on column public.pay_webhooks.signing_secret_kid is 'Key-management-system key identifier for the webhook signing secret.';
comment on column public.pay_webhooks.secret_hash is 'Legacy/non-authoritative digest retained only for compatibility; runtime signing uses the encrypted secret envelope.';
comment on column public.pay_wallet_challenges.signature_base58 is 'One-time wallet ownership proof; never accepted as a reusable credential.';
comment on column public.pay_wallet_challenges.signer_public_key is 'Public key presented during challenge verification; runtime must prove correspondence to wallet address.';
comment on column public.pay_wallet_challenges.rejection_reason is 'Non-sensitive reason for a rejected ownership challenge.';
