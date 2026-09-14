-- Production article SEO guardrails.
-- Applied to the live Supabase project on 2026-08-07.
-- The database is the final safety net for article URLs and taxonomy.

create or replace function public.normalize_article_slug(input text)
returns text
language plpgsql
immutable
as $$
declare
  s text := lower(trim(coalesce(input,'')));
begin
  s := replace(s, 'آ','a'); s := replace(s,'ا','a'); s := replace(s,'أ','a'); s := replace(s,'إ','e');
  s := replace(s,'ب','b'); s := replace(s,'پ','p'); s := replace(s,'ت','t'); s := replace(s,'ث','s');
  s := replace(s,'ج','j'); s := replace(s,'چ','ch'); s := replace(s,'ح','h'); s := replace(s,'خ','kh');
  s := replace(s,'د','d'); s := replace(s,'ذ','z'); s := replace(s,'ر','r'); s := replace(s,'ز','z');
  s := replace(s,'ژ','zh'); s := replace(s,'س','s'); s := replace(s,'ش','sh'); s := replace(s,'ص','s');
  s := replace(s,'ض','z'); s := replace(s,'ط','t'); s := replace(s,'ظ','z'); s := replace(s,'ع','a');
  s := replace(s,'غ','gh'); s := replace(s,'ف','f'); s := replace(s,'ق','q'); s := replace(s,'ک','k');
  s := replace(s,'ك','k'); s := replace(s,'گ','g'); s := replace(s,'ل','l'); s := replace(s,'م','m');
  s := replace(s,'ن','n'); s := replace(s,'و','v'); s := replace(s,'ؤ','v'); s := replace(s,'ه','h');
  s := replace(s,'ة','h'); s := replace(s,'ۀ','h'); s := replace(s,'ی','y'); s := replace(s,'ي','y');
  s := replace(s,'ئ','y'); s := replace(s,'ء','');
  s := translate(s, '۰۱۲۳۴۵۶۷۸۹', '0123456789');
  s := regexp_replace(s, '[^a-z0-9]+', '-', 'g');
  s := regexp_replace(s, '-+', '-', 'g');
  s := trim(both '-' from s);
  if length(s) > 72 then
    s := left(s, 72);
    s := regexp_replace(s, '-[^-]*$', '');
    s := trim(both '-' from s);
  end if;
  return s;
end;
$$;

create or replace function public.normalize_article_seo_fields()
returns trigger
language plpgsql
as $$
declare
  base_slug text;
  candidate text;
  suffix integer := 2;
  existing_id text;
  scores jsonb := '{}'::jsonb;
  generated_tags jsonb := '[]'::jsonb;
  existing_tags jsonb := coalesce(new.tags, '[]'::jsonb);
  clean_tokens text[];
  phrase text;
  token text;
  i integer;
  section text;
  section_weight numeric;
  generic_only boolean := false;
begin
  base_slug := public.normalize_article_slug(coalesce(nullif(trim(new.slug), ''), new.title));
  if base_slug = '' then base_slug := 'article'; end if;

  candidate := base_slug;
  existing_id := null;
  select a.id::text into existing_id from public.articles a where a.slug = candidate and a.id <> new.id limit 1;
  while existing_id is not null loop
    candidate := left(base_slug, greatest(1, 72 - length(suffix::text) - 1)) || '-' || suffix::text;
    existing_id := null;
    select a.id::text into existing_id from public.articles a where a.slug = candidate and a.id <> new.id limit 1;
    suffix := suffix + 1;
  end loop;
  new.slug := candidate;

  for section, section_weight in
    select * from (values
      (coalesce(new.title,''), 5::numeric),
      (coalesce(new.summary,''), 3::numeric),
      (coalesce(new.content,''), 1::numeric)
    ) as s(text, weight)
  loop
    clean_tokens := regexp_split_to_array(regexp_replace(lower(section), '[^[:space:][:alnum:]آ-ی۰-۹A-Za-z0-9_-]', ' ', 'g'), '[[:space:]]+');
    if clean_tokens is null then continue; end if;

    for i in 1..coalesce(array_length(clean_tokens,1),0) loop
      token := trim(clean_tokens[i]);
      if length(token) < 3 then continue; end if;
      if token in ('برای','درباره','است','این','آن','یک','های','را','در','به','با','از','و','یا','که','می','شود','شد','شده','بود','باشد','هم','اما','اگر','تا','بر','روی','هر','چه','چگونه','چیست','کدام','مقاله','راهنما','آموزش','بررسی','معرفی','کامل','جامع','مهم','نکات','استفاده','کاربرد','the','and','for','with','from','this','that','guide','article') then continue; end if;
      scores := jsonb_set(scores, array[token], to_jsonb(coalesce((scores->>token)::numeric,0) + section_weight), true);

      if i < array_length(clean_tokens,1) and length(trim(clean_tokens[i+1])) >= 3 then
        if trim(clean_tokens[i+1]) not in ('برای','درباره','است','این','آن','یک','های','را','در','به','با','از','و','یا','که','می','شود','شد','شده','بود','باشد','هم','اما','اگر','تا','بر','روی','هر','چه','چگونه','چیست','کدام') then
          phrase := token || ' ' || trim(clean_tokens[i+1]);
          scores := jsonb_set(scores, array[phrase], to_jsonb(coalesce((scores->>phrase)::numeric,0) + section_weight * 1.8), true);
        end if;
      end if;
    end loop;
  end loop;

  select coalesce(jsonb_agg(to_jsonb(r.tag_term) order by r.score desc), '[]'::jsonb)
    into generated_tags
  from (
    select e.key as tag_term, e.value::numeric as score
    from jsonb_each_text(scores) e
    where length(e.key) >= 3
      and (position(' ' in e.key) > 0 or length(e.key) >= 4)
    order by e.value::numeric desc
    limit 8
  ) r;

  generic_only := jsonb_typeof(existing_tags) = 'array' and
    (select count(*) from jsonb_array_elements_text(existing_tags) t(value)
      where lower(trim(t.value)) in ('سولانا','سولمینت','وب۳','کریپتو','crypto','web3')) = jsonb_array_length(existing_tags);

  if jsonb_typeof(existing_tags) <> 'array' or jsonb_array_length(existing_tags) = 0 or generic_only then
    new.tags := generated_tags;
  else
    select coalesce(jsonb_agg(d.value order by d.ord), '[]'::jsonb)
      into new.tags
    from (
      select m.value, min(m.ord) as ord
      from (
        select t.value, t.ordinality::integer as ord from jsonb_array_elements_text(existing_tags) with ordinality t
        union all
        select g.value, 100 + row_number() over () as ord from jsonb_array_elements_text(generated_tags) g
      ) m
      group by m.value
      order by min(m.ord)
      limit 8
    ) d;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_articles_normalize_seo on public.articles;
create trigger trg_articles_normalize_seo
before insert or update of title, slug, summary, content, tags on public.articles
for each row execute function public.normalize_article_seo_fields();

drop index if exists public.idx_articles_slug_unique;
