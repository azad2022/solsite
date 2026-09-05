create or replace function public.apply_category_default_cover_to_article()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_default_asset_id text;
  v_default_url text;
begin
  if new.category_id is null then
    return new;
  end if;

  select c.default_media_asset_id, c.default_media_url
    into v_default_asset_id, v_default_url
  from public.article_categories c
  where c.id = new.category_id;

  if nullif(trim(coalesce(v_default_url, '')), '') is not null then
    new.cover_image := v_default_url;
    new.cover_image_asset_id := nullif(trim(coalesce(v_default_asset_id, '')), '');
  end if;

  return new;
end;
$$;

create or replace function public.sync_category_default_cover_to_articles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(trim(coalesce(new.default_media_url, '')), '') is not null
     and (
       tg_op = 'INSERT'
       or new.default_media_url is distinct from old.default_media_url
       or new.default_media_asset_id is distinct from old.default_media_asset_id
       or new.name is distinct from old.name
     ) then
    update public.articles
       set cover_image = new.default_media_url,
           cover_image_asset_id = nullif(trim(coalesce(new.default_media_asset_id, '')), ''),
           updated_at = timezone('utc', now())
     where category_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_articles_apply_category_default_cover on public.articles;
create trigger trg_articles_apply_category_default_cover
before insert or update of category_id on public.articles
for each row execute function public.apply_category_default_cover_to_article();

drop trigger if exists trg_category_sync_default_cover_to_articles on public.article_categories;
create trigger trg_category_sync_default_cover_to_articles
after insert or update of default_media_asset_id, default_media_url, name on public.article_categories
for each row execute function public.sync_category_default_cover_to_articles();

create index if not exists idx_articles_category_id on public.articles(category_id);
