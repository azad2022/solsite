-- Reconcile category default media fields created by the legacy single-image flow
-- with the gallery relation table used by the current category media picker.
insert into public.category_default_media_assets(category_id, media_asset_id, sort_order)
select c.id, m.id, 0
from public.article_categories c
join public.media_assets m on m.public_url = c.default_media_url
where nullif(trim(coalesce(c.default_media_url, '')), '') is not null
on conflict (category_id, media_asset_id) do nothing;

update public.article_categories c
set default_media_asset_id = m.id,
    updated_at = timezone('utc', now())
from public.media_assets m
where nullif(trim(coalesce(c.default_media_url, '')), '') is not null
  and m.public_url = c.default_media_url
  and c.default_media_asset_id is distinct from m.id;
