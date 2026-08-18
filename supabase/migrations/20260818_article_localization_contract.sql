-- Article localization contract for bilingual publishing.
-- Existing Persian records remain valid because the default is generated per row.

alter table public.articles
  add column if not exists language text not null default 'fa';

alter table public.articles
  add column if not exists translation_group_id uuid default gen_random_uuid();

update public.articles
set translation_group_id = coalesce(translation_group_id, gen_random_uuid())
where translation_group_id is null;

alter table public.articles
  alter column translation_group_id set not null;

alter table public.articles
  drop constraint if exists articles_language_check;

alter table public.articles
  add constraint articles_language_check
  check (language in ('fa', 'en'));

create unique index if not exists articles_translation_group_language_key
  on public.articles (translation_group_id, language)
  where translation_group_id is not null;

create index if not exists idx_articles_translation_group_id
  on public.articles (translation_group_id)
  where translation_group_id is not null;

-- Keep article localization queries language-aware and forbid duplicate language variants.
