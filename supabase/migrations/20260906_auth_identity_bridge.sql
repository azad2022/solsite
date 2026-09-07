begin;

create table if not exists public.auth_identity_links (
  -- The FK is attached by the Better Auth schema migration after better_auth."user"
  -- exists. Keeping this migration independently replayable avoids a filename-order
  -- dependency between the two 20260906 migrations.
  better_auth_user_id text primary key,
  legacy_user_id text unique,
  source text not null check (source in ('native', 'legacy-migration')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists auth_identity_links_legacy_user_id_idx
  on public.auth_identity_links(legacy_user_id);

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

-- legacy_user_id is intentionally not an FK: the repository does not contain the
-- historical public.users DDL, while production already owns that table. The server
-- migration/provisioning path validates the legacy identity before creating the row.
alter table public.auth_identity_links enable row level security;
revoke all on table public.auth_identity_links from public, anon, authenticated;
revoke all on function public.auth_identity_links_set_updated_at() from public, anon, authenticated;

commit;
