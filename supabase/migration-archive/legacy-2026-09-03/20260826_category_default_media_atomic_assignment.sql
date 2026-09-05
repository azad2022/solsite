create or replace function public.set_category_default_media(
  p_assign_category_ids text[] default '{}',
  p_clear_category_ids text[] default '{}',
  p_asset_id text default null,
  p_url text default null
)
returns table(category_id text, articles_updated bigint, action text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
  v_count bigint;
begin
  if coalesce(array_length(p_assign_category_ids, 1), 0) > 0 then
    if nullif(trim(coalesce(p_url, '')), '') is null then
      raise exception 'CATEGORY_DEFAULT_MEDIA_URL_REQUIRED';
    end if;
    for v_id in select distinct unnest(p_assign_category_ids) loop
      update public.article_categories
         set default_media_asset_id = nullif(trim(coalesce(p_asset_id, '')), ''),
             default_media_url = trim(p_url),
             updated_at = timezone('utc', now())
       where article_categories.id = v_id;
      if found then
        select count(*) into v_count from public.articles a where a.category_id = v_id;
        category_id := v_id;
        articles_updated := v_count;
        action := 'assigned';
        return next;
      end if;
    end loop;
  end if;
  if coalesce(array_length(p_clear_category_ids, 1), 0) > 0 then
    for v_id in select distinct unnest(p_clear_category_ids) loop
      update public.article_categories
         set default_media_asset_id = null,
             default_media_url = null,
             updated_at = timezone('utc', now())
       where article_categories.id = v_id
         and (p_asset_id is null or article_categories.default_media_asset_id = p_asset_id);
      if found then
        category_id := v_id;
        articles_updated := 0;
        action := 'cleared';
        return next;
      end if;
    end loop;
  end if;
  return;
end;
$$;

revoke all on function public.set_category_default_media(text[], text[], text, text) from public;
grant execute on function public.set_category_default_media(text[], text[], text, text) to service_role;
