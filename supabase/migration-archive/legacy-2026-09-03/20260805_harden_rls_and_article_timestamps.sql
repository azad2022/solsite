begin;

-- Public data policy: published articles are readable; all mutations are server-side.
drop policy if exists "Public Read Published Articles" on public.articles;
create policy "Public Read Published Articles"
on public.articles for select
to anon, authenticated
using (is_draft is not true);

-- Media metadata is public because published article pages may consume it.
drop policy if exists "Public Read Media Assets" on public.media_assets;
create policy "Public Read Media Assets"
on public.media_assets for select
to anon, authenticated
using (true);

-- Sensitive tables must never be writable directly with the public anon key.
drop policy if exists "Public Write Media Assets" on public.media_assets;
drop policy if exists "Public Read Media Config" on public.media_config;
drop policy if exists "Public Write Media Config" on public.media_config;
drop policy if exists "Public Read Write Settings" on public.cms_settings;
drop policy if exists "Public Read Write Users" on public.users;

-- Public users may submit unapproved comments. Moderation is server-side only.
drop policy if exists "Public Read Write Comments" on public.comments;
create policy "Public Read Approved Comments"
on public.comments for select
to anon, authenticated
using (approved is true);

create policy "Public Insert Comments"
on public.comments for insert
to anon, authenticated
with check (approved is false);

-- Accurate article lastmod for sitemap/SEO.
alter table public.articles
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_articles_set_updated_at on public.articles;
create trigger trg_articles_set_updated_at
before update on public.articles
for each row execute function public.set_updated_at();

drop trigger if exists trg_media_assets_set_updated_at on public.media_assets;
create trigger trg_media_assets_set_updated_at
before update on public.media_assets
for each row execute function public.set_updated_at();

create index if not exists idx_articles_published_created_at
  on public.articles (is_draft, created_at desc);
create unique index if not exists idx_articles_slug_unique
  on public.articles (slug);
create index if not exists idx_comments_article_approved
  on public.comments (article_id, approved, created_at desc);
create index if not exists idx_media_assets_created_at
  on public.media_assets (created_at desc);

commit;
