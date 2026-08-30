-- Finalize two security invariants discovered during the second audit pass:
-- 1) every merchant has an explicit owner;
-- 2) merchant team access is first-class rather than inferred from owner-only checks;
-- 3) webhook signing material must be usable by the server, so a one-way hash alone
--    is insufficient. The production implementation must encrypt/decrypt this
--    field through a KMS/HSM-backed secret provider.

alter table public.pay_merchants
  alter column owner_user_id set not null;

create table if not exists public.pay_merchant_members (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.pay_merchants(id) on delete cascade,
  user_id uuid not null,
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

-- Keep one explicit owner membership row per merchant. The application workflow
-- must create this row atomically with merchant creation.
create unique index if not exists pay_merchant_members_one_owner_uidx
  on public.pay_merchant_members (merchant_id)
  where role = 'owner' and status = 'active';

-- HMAC webhook signing requires server-usable secret material. Store only an
-- encrypted envelope here; the plaintext secret must never be persisted. The
-- concrete KMS/HSM implementation is a release gate.
alter table public.pay_webhooks
  add column if not exists signing_secret_ciphertext text,
  add column if not exists signing_secret_kid text;

comment on column public.pay_webhooks.signing_secret_ciphertext is 'Encrypted webhook HMAC secret envelope; decrypt only inside the server-side signing worker using an approved KMS/HSM provider.';
comment on column public.pay_webhooks.signing_secret_kid is 'Key-management-system key identifier used to decrypt the webhook signing secret.';
