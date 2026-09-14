create schema if not exists better_auth;

create table if not exists better_auth."user" (
  id text primary key,
  name text not null,
  email text not null unique,
  email_verified boolean not null default false,
  image text,
  username text unique,
  display_username text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists better_auth.session (
  id text primary key,
  user_id text not null references better_auth."user"(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists better_auth_session_user_id_idx
  on better_auth.session(user_id);
create index if not exists better_auth_session_expires_at_idx
  on better_auth.session(expires_at);

create table if not exists better_auth.account (
  id text primary key,
  user_id text not null references better_auth."user"(id) on delete cascade,
  account_id text not null,
  provider_id text not null,
  -- Better Auth 1.7.0-1.7.2 introduced issuer but stopped writing it for new rows.
  -- Keep it nullable and retain the composite uniqueness semantics; the 1.7.3
  -- release removes the requirement entirely.
  issuer text,
  access_token text,
  refresh_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  id_token text,
  password text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (issuer, account_id)
);

create index if not exists better_auth_account_user_id_idx
  on better_auth.account(user_id);
create index if not exists better_auth_account_provider_id_idx
  on better_auth.account(provider_id);

create table if not exists better_auth.verification (
  id text primary key,
  identifier text not null,
  value text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists better_auth_verification_identifier_idx
  on better_auth.verification(identifier);
create index if not exists better_auth_verification_expires_at_idx
  on better_auth.verification(expires_at);

create table if not exists better_auth.rate_limit (
  id text primary key,
  key text not null unique,
  count integer not null,
  last_request bigint not null
);

-- Complete the identity bridge FK only after both sides exist. The bridge migration
-- intentionally creates the table without this dependency so migration replay is
-- deterministic despite its historical short timestamp-based filename.
do $$
begin
  if to_regclass('public.auth_identity_links') is not null
     and not exists (
       select 1
       from pg_constraint
       where conname = 'auth_identity_links_better_auth_user_id_fkey'
         and conrelid = 'public.auth_identity_links'::regclass
     ) then
    alter table public.auth_identity_links
      add constraint auth_identity_links_better_auth_user_id_fkey
      foreign key (better_auth_user_id)
      references better_auth."user"(id)
      on delete cascade;
  end if;
end
$$;

-- Better Auth owns these tables through the server-side PostgreSQL connection.
-- They are never exposed to Supabase anon/authenticated clients.
revoke all on schema better_auth from public;
revoke all on all tables in schema better_auth from public;

create or replace function better_auth.set_updated_at()
returns trigger
language plpgsql
set search_path = better_auth, pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_set_updated_at on better_auth."user";
create trigger user_set_updated_at
before update on better_auth."user"
for each row execute function better_auth.set_updated_at();

drop trigger if exists session_set_updated_at on better_auth.session;
create trigger session_set_updated_at
before update on better_auth.session
for each row execute function better_auth.set_updated_at();

drop trigger if exists account_set_updated_at on better_auth.account;
create trigger account_set_updated_at
before update on better_auth.account
for each row execute function better_auth.set_updated_at();

drop trigger if exists verification_set_updated_at on better_auth.verification;
create trigger verification_set_updated_at
before update on better_auth.verification
for each row execute function better_auth.set_updated_at();

revoke all on function better_auth.set_updated_at() from public;
