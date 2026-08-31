-- Webhook secrets are encrypted for persistence. The master key remains in the
-- deployment secret store and is never written to the database.

alter table public.pay_webhooks
  add column if not exists secret_ciphertext text,
  add column if not exists secret_key_version text,
  add constraint pay_webhooks_secret_ciphertext_check
    check (secret_ciphertext is null or length(secret_ciphertext) >= 20);

comment on column public.pay_webhooks.secret_hash is 'One-way digest for operational comparison/audit; never used as the HMAC secret.';
comment on column public.pay_webhooks.secret_ciphertext is 'Versioned AES-GCM envelope containing the webhook signing secret; decrypt only in a trusted server runtime using the deployment master secret.';
comment on column public.pay_webhooks.secret_key_version is 'Deployment secret/envelope key version used for rotation.';
