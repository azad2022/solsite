-- Webhook signing requires server-usable secret material. `secret_hash` alone
-- cannot produce an HMAC signature, so it is retained only as a legacy audit
-- field and is no longer the source of truth.

alter table public.pay_webhooks
  alter column secret_hash drop not null;

comment on column public.pay_webhooks.secret_hash is 'Legacy/non-authoritative digest retained for compatibility. Runtime signing uses signing_secret_ciphertext decrypted only inside the server-side KMS/HSM boundary.';

comment on column public.pay_webhooks.signing_secret_ciphertext is 'Authoritative encrypted webhook signing secret. Never expose or decrypt outside the isolated server-side signing worker.';
