-- Security migration cleanup. This is the single ordered place for wallet challenge
-- signature metadata; duplicate 00800 security migration content was removed.

alter table public.pay_wallet_ownership_challenges
  add column if not exists signature_base58 text,
  add column if not exists signer_public_key text,
  add column if not exists rejection_reason text;

comment on column public.pay_wallet_ownership_challenges.signature_base58 is 'One-time wallet ownership proof; authentication artifact, never used as a reusable credential.';
comment on column public.pay_wallet_ownership_challenges.signer_public_key is 'Public key presented by the wallet during challenge verification; must match the challenged wallet address.';
comment on column public.pay_wallet_ownership_challenges.rejection_reason is 'Non-sensitive reason for a rejected ownership challenge.';
