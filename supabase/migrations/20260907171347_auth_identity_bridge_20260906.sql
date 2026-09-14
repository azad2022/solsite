begin;

create table if not exists public.auth_identity_links (
  -- The Better Auth user is the identity authority. The application user is the
  -- domain/profile authority. The FK to better_auth."user" is attached by the
  -- following Better Auth schema migration after that table exists.
  better_auth_user_id text primary key,
  application_user_id text not null unique,
  source text not null check (source in ('native', 'legacy-migration')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists auth_identity_links_application_user_id_idx
  on public.auth_identity_links(application_user_id);

create or replace function public.auth_identity_links_set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists auth_identity_links_set_updated_at on public.auth_identity_links;
create trigger auth_identity_links_set_updated_at
before update on public.auth_identity_links
for each row execute function public.auth_identity_links_set_updated_at();

-- application_user_id intentionally has no FK here because the historical
-- public.users DDL is not present in the repository. The server provisioning path
-- resolves and validates the application user before creating this row.
alter table public.auth_identity_links enable row level security;
revoke all on table public.auth_identity_links from public, anon, authenticated;
revoke all on function public.auth_identity_links_set_updated_at() from public, anon, authenticated;

commit;
