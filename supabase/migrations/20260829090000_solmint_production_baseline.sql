-- SolMint Pay canonical production baseline.
-- Source snapshot SHA-256: 553d0f9a34f52ef344471c45398c41780438c0dbeec5d6cc63c912d6a8b223c5
-- Captured from Production project nvopkbiedorfshwbmyhn on 2026-09-03.
-- This migration is the exact captured PostgreSQL schema and contains no production data.
-- It must be activated only after disposable replay/equivalence validation and guarded migration-history repair.
-- SOLMINT_PAY_BASELINE_START
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "private"."claim_autopublish_slot"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'private'
    AS $$
declare claimed boolean;
begin
  update private.autopublish_run_lock
  set claimed_at = now()
  where id = true
    and (claimed_at is null or claimed_at < now() - interval '10 minutes')
  returning true into claimed;
  return coalesce(claimed, false);
end;
$$;


ALTER FUNCTION "private"."claim_autopublish_slot"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."release_autopublish_slot"() RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'private'
    AS $$
  update private.autopublish_run_lock set claimed_at = null where id = true;
$$;


ALTER FUNCTION "private"."release_autopublish_slot"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_category_default_cover_to_article"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."apply_category_default_cover_to_article"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_category_default_media_to_article"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  cat_id text;
  default_asset_id text;
  default_url text;
  resolved_url text;
BEGIN
  IF NEW.category_id IS NULL AND NULLIF(trim(COALESCE(NEW.category, '')), '') IS NOT NULL THEN
    SELECT id INTO cat_id
    FROM public.article_categories
    WHERE name = NEW.category OR slug = NEW.category
    ORDER BY is_active DESC, sort_order ASC
    LIMIT 1;
    IF cat_id IS NOT NULL THEN
      NEW.category_id := cat_id;
    END IF;
  END IF;

  IF COALESCE(NEW.is_draft, false) = false AND NULLIF(trim(COALESCE(NEW.cover_image, '')), '') IS NULL AND NEW.category_id IS NOT NULL THEN
    SELECT default_media_asset_id, default_media_url
      INTO default_asset_id, default_url
    FROM public.article_categories
    WHERE id = NEW.category_id
    LIMIT 1;

    IF default_url IS NULL AND default_asset_id IS NOT NULL THEN
      SELECT public_url INTO resolved_url
      FROM public.media_assets
      WHERE id = default_asset_id
      LIMIT 1;
      default_url := resolved_url;
    END IF;

    IF NULLIF(trim(COALESCE(default_url, '')), '') IS NOT NULL THEN
      NEW.cover_image := default_url;
      NEW.cover_image_asset_id := default_asset_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."apply_category_default_media_to_article"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_auth_login_rate_limit"("p_key_hash" "text", "p_max_attempts" integer DEFAULT 8, "p_window_seconds" integer DEFAULT 900, "p_block_seconds" integer DEFAULT 900) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_row public.auth_login_attempts%rowtype;
  v_now timestamptz := now();
begin
  insert into public.auth_login_attempts(key_hash, window_started_at, attempt_count, blocked_until, updated_at)
  values (p_key_hash, v_now, 0, null, v_now)
  on conflict (key_hash) do nothing;
  select * into v_row from public.auth_login_attempts where key_hash = p_key_hash for update;
  if v_row.blocked_until is not null and v_row.blocked_until > v_now then return false; end if;
  if v_row.window_started_at + make_interval(secs => p_window_seconds) <= v_now then
    update public.auth_login_attempts set window_started_at=v_now, attempt_count=0, blocked_until=null, updated_at=v_now where key_hash=p_key_hash;
  end if;
  return true;
end;
$$;


ALTER FUNCTION "public"."check_auth_login_rate_limit"("p_key_hash" "text", "p_max_attempts" integer, "p_window_seconds" integer, "p_block_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_autopublish_slot"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'private'
    AS $$ select private.claim_autopublish_slot(); $$;


ALTER FUNCTION "public"."claim_autopublish_slot"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_chatbot_rate_limit"("p_key_hash" "text", "p_limit" integer DEFAULT 12, "p_window_seconds" integer DEFAULT 300) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  current_count integer;
  current_started timestamptz;
  now_ts timestamptz := now();
begin
  select request_count, window_started_at into current_count, current_started
  from public.chatbot_rate_limits where key_hash = p_key_hash for update;

  if not found then
    insert into public.chatbot_rate_limits(key_hash, window_started_at, request_count, updated_at)
    values (p_key_hash, now_ts, 1, now_ts);
    return true;
  end if;

  if current_started + make_interval(secs => p_window_seconds) <= now_ts then
    update public.chatbot_rate_limits
      set window_started_at = now_ts, request_count = 1, updated_at = now_ts
      where key_hash = p_key_hash;
    return true;
  end if;

  if current_count >= p_limit then
    update public.chatbot_rate_limits set updated_at = now_ts where key_hash = p_key_hash;
    return false;
  end if;

  update public.chatbot_rate_limits
    set request_count = request_count + 1, updated_at = now_ts
    where key_hash = p_key_hash;
  return true;
end;
$$;


ALTER FUNCTION "public"."consume_chatbot_rate_limit"("p_key_hash" "text", "p_limit" integer, "p_window_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_comment_rate_limit"("p_key_hash" "text", "p_operation" "text", "p_window_seconds" integer, "p_max_requests" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$ declare v_started timestamptz; v_count integer; begin if length(trim(coalesce(p_key_hash,''))) < 32 then raise exception 'invalid_rate_key'; end if; if p_operation not in ('create','vote') then raise exception 'invalid_rate_operation'; end if; if p_window_seconds < 1 or p_window_seconds > 86400 then raise exception 'invalid_rate_window'; end if; if p_max_requests < 1 or p_max_requests > 1000 then raise exception 'invalid_rate_limit'; end if; insert into public.comment_rate_limits(key_hash,operation,window_started_at,request_count) values(p_key_hash,p_operation,now(),1) on conflict(key_hash,operation) do update set window_started_at=case when public.comment_rate_limits.window_started_at <= now()-make_interval(secs=>p_window_seconds) then now() else public.comment_rate_limits.window_started_at end, request_count=case when public.comment_rate_limits.window_started_at <= now()-make_interval(secs=>p_window_seconds) then 1 else public.comment_rate_limits.request_count+1 end; select window_started_at,request_count into v_started,v_count from public.comment_rate_limits where comment_rate_limits.key_hash=p_key_hash and comment_rate_limits.operation=p_operation; return not(v_started > now()-make_interval(secs=>p_window_seconds) and v_count > p_max_requests); end; $$;


ALTER FUNCTION "public"."consume_comment_rate_limit"("p_key_hash" "text", "p_operation" "text", "p_window_seconds" integer, "p_max_requests" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_registration_rate_limit"("p_key_hash" "text", "p_window_seconds" integer, "p_max_requests" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_started timestamptz;
  v_count integer;
begin
  if length(trim(coalesce(p_key_hash, ''))) < 32 then raise exception 'invalid_registration_rate_key'; end if;
  if p_window_seconds < 1 or p_window_seconds > 86400 then raise exception 'invalid_registration_rate_window'; end if;
  if p_max_requests < 1 or p_max_requests > 1000 then raise exception 'invalid_registration_rate_limit'; end if;

  insert into public.registration_rate_limits(key_hash, window_started_at, request_count)
  values (p_key_hash, now(), 1)
  on conflict (key_hash)
  do update set
    window_started_at = case
      when public.registration_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
      then now()
      else public.registration_rate_limits.window_started_at
    end,
    request_count = case
      when public.registration_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
      then 1
      else public.registration_rate_limits.request_count + 1
    end;

  select window_started_at, request_count into v_started, v_count
  from public.registration_rate_limits
  where registration_rate_limits.key_hash = p_key_hash;

  return not (v_started > now() - make_interval(secs => p_window_seconds) and v_count > p_max_requests);
end;
$$;


ALTER FUNCTION "public"."consume_registration_rate_limit"("p_key_hash" "text", "p_window_seconds" integer, "p_max_requests" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_article_seo_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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


ALTER FUNCTION "public"."normalize_article_seo_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_article_slug"("input" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."normalize_article_slug"("input" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_auth_login_failure"("p_key_hash" "text", "p_window_seconds" integer DEFAULT 900, "p_max_attempts" integer DEFAULT 8, "p_block_seconds" integer DEFAULT 900) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_now timestamptz := now();
begin
  insert into public.auth_login_attempts(key_hash, window_started_at, attempt_count, blocked_until, updated_at)
  values (p_key_hash, v_now, 0, null, v_now)
  on conflict (key_hash) do nothing;
  update public.auth_login_attempts
  set window_started_at = case when window_started_at + make_interval(secs => p_window_seconds) <= v_now then v_now else window_started_at end,
      attempt_count = case when window_started_at + make_interval(secs => p_window_seconds) <= v_now then 1 else attempt_count + 1 end,
      blocked_until = case when window_started_at + make_interval(secs => p_window_seconds) <= v_now then null when attempt_count + 1 >= p_max_attempts then v_now + make_interval(secs => p_block_seconds) else blocked_until end,
      updated_at = v_now
  where key_hash = p_key_hash;
end;
$$;


ALTER FUNCTION "public"."record_auth_login_failure"("p_key_hash" "text", "p_window_seconds" integer, "p_max_attempts" integer, "p_block_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."release_autopublish_slot"() RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'private'
    AS $$ select private.release_autopublish_slot(); $$;


ALTER FUNCTION "public"."release_autopublish_slot"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_article_categories_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin new.updated_at = timezone('utc', now()); return new; end;
$$;


ALTER FUNCTION "public"."set_article_categories_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_category_default_media"("p_assign_category_ids" "text"[] DEFAULT '{}'::"text"[], "p_clear_category_ids" "text"[] DEFAULT '{}'::"text"[], "p_asset_id" "text" DEFAULT NULL::"text", "p_url" "text" DEFAULT NULL::"text") RETURNS TABLE("category_id" "text", "articles_updated" bigint, "action" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."set_category_default_media"("p_assign_category_ids" "text"[], "p_clear_category_ids" "text"[], "p_asset_id" "text", "p_url" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_category_default_media_gallery"("p_category_id" "text", "p_media_asset_ids" "text"[], "p_mode" "text" DEFAULT 'single'::"text", "p_interval_ms" integer DEFAULT 4500) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_ids text[] := array(select distinct trim(x) from unnest(coalesce(p_media_asset_ids, array[]::text[])) x where nullif(trim(x), '') is not null);
  v_first_id text;
  v_first_url text;
  v_updated_count integer := 0;
  v_category public.article_categories%rowtype;
begin
  if p_category_id is null or nullif(trim(p_category_id), '') is null then
    raise exception 'CATEGORY_ID_REQUIRED';
  end if;
  if p_mode not in ('single','random','slideshow') then
    raise exception 'INVALID_MEDIA_MODE';
  end if;
  if coalesce(cardinality(v_ids), 0) > 20 then
    raise exception 'TOO_MANY_MEDIA_ASSETS';
  end if;
  if p_interval_ms < 1500 or p_interval_ms > 20000 then
    raise exception 'INVALID_MEDIA_INTERVAL';
  end if;

  select * into v_category from public.article_categories where id = p_category_id for update;
  if not found then raise exception 'CATEGORY_NOT_FOUND'; end if;

  if cardinality(v_ids) > 0 then
    if (select count(*) from public.media_assets where id = any(v_ids)) <> cardinality(v_ids) then
      raise exception 'MEDIA_ASSET_NOT_FOUND';
    end if;
    v_first_id := v_ids[1];
    select public_url into v_first_url from public.media_assets where id = v_first_id;
  else
    v_first_id := null;
    v_first_url := null;
  end if;

  delete from public.category_default_media_assets where category_id = p_category_id;
  if cardinality(v_ids) > 0 then
    insert into public.category_default_media_assets(category_id, media_asset_id, sort_order)
    select p_category_id, x, ordinality - 1
    from unnest(v_ids) with ordinality as t(x, ordinality);
  end if;

  update public.article_categories
     set default_media_asset_id = v_first_id,
         default_media_url = v_first_url,
         default_media_mode = p_mode,
         default_media_interval_ms = p_interval_ms,
         updated_at = timezone('utc', now())
   where id = p_category_id
   returning * into v_category;

  select count(*) into v_updated_count from public.articles where category_id = p_category_id;

  return jsonb_build_object(
    'category', to_jsonb(v_category),
    'media_asset_ids', coalesce(v_ids, array[]::text[]),
    'articles_updated', v_updated_count
  );
end;
$$;


ALTER FUNCTION "public"."set_category_default_media_gallery"("p_category_id" "text", "p_media_asset_ids" "text"[], "p_mode" "text", "p_interval_ms" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_comment_vote"("p_comment_id" "text", "p_user_id" "text", "p_vote" smallint) RETURNS TABLE("comment_id" "text", "like_count" integer, "dislike_count" integer, "user_vote" smallint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$ declare v_previous smallint; v_likes integer; v_dislikes integer; begin if p_vote not in(-1,0,1) then raise exception 'invalid_vote'; end if; if length(trim(coalesce(p_comment_id,'')))=0 or length(trim(coalesce(p_user_id,'')))=0 then raise exception 'invalid_identity'; end if; perform 1 from public.comments where id=p_comment_id and approved=true for update; if not found then raise exception 'comment_not_found'; end if; select vote into v_previous from public.comment_votes where comment_votes.comment_id=p_comment_id and comment_votes.user_id=p_user_id for update; if p_vote=0 then delete from public.comment_votes where comment_votes.comment_id=p_comment_id and comment_votes.user_id=p_user_id; elsif v_previous is null then insert into public.comment_votes(comment_id,user_id,vote) values(p_comment_id,p_user_id,p_vote); elsif v_previous=p_vote then delete from public.comment_votes where comment_votes.comment_id=p_comment_id and comment_votes.user_id=p_user_id; else update public.comment_votes set vote=p_vote,updated_at=now() where comment_votes.comment_id=p_comment_id and comment_votes.user_id=p_user_id; end if; select count(*) filter(where vote=1),count(*) filter(where vote=-1) into v_likes,v_dislikes from public.comment_votes where comment_votes.comment_id=p_comment_id; update public.comments set like_count=coalesce(v_likes,0),dislike_count=coalesce(v_dislikes,0) where id=p_comment_id and approved=true; return query select p_comment_id,coalesce(v_likes,0),coalesce(v_dislikes,0),coalesce((select vote from public.comment_votes where comment_votes.comment_id=p_comment_id and comment_votes.user_id=p_user_id),0)::smallint; end; $$;


ALTER FUNCTION "public"."set_comment_vote"("p_comment_id" "text", "p_user_id" "text", "p_vote" smallint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_article_category_reference"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare resolved_id text;
declare resolved_name text;
begin
  if new.category_id is not null then
    select id, name into resolved_id, resolved_name from public.article_categories where id = new.category_id;
    if resolved_id is null then
      raise exception 'ARTICLE_CATEGORY_NOT_FOUND: category_id % does not exist', new.category_id using errcode = '23503';
    end if;
    new.category_id := resolved_id;
    new.category := resolved_name;
    return new;
  end if;

  select id, name into resolved_id, resolved_name
  from public.article_categories
  where name = btrim(new.category)
  limit 1;

  if resolved_id is null then
    raise exception 'ARTICLE_CATEGORY_NOT_FOUND: category "%" is not registered in article_categories', new.category using errcode = '23514';
  end if;

  new.category_id := resolved_id;
  new.category := resolved_name;
  return new;
end;
$$;


ALTER FUNCTION "public"."sync_article_category_reference"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_article_cover_asset_reference"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  matched_asset_id text;
  cfg_owner text;
  cfg_repo text;
  cfg_branch text;
  raw_prefix text;
  media_path text;
  file_name text;
  asset_id text;
  mime text;
  encoded_url text;
begin
  if nullif(trim(coalesce(new.cover_image, '')), '') is null then
    new.cover_image_asset_id := null;
    return new;
  end if;

  select id into matched_asset_id
  from public.media_assets
  where public_url = trim(new.cover_image)
  limit 1;

  if matched_asset_id is not null then
    new.cover_image_asset_id := matched_asset_id;
    return new;
  end if;

  select github_owner, github_repository, branch
    into cfg_owner, cfg_repo, cfg_branch
  from public.media_config
  where id = 'active_config'
  limit 1;

  cfg_owner := coalesce(nullif(trim(cfg_owner), ''), 'azad2022');
  cfg_repo := coalesce(nullif(trim(cfg_repo), ''), 'solsite');
  cfg_branch := coalesce(nullif(trim(cfg_branch), ''), 'main');
  raw_prefix := 'https://raw.githubusercontent.com/' || cfg_owner || '/' || cfg_repo || '/' || cfg_branch || '/';

  if left(trim(new.cover_image), length(raw_prefix)) <> raw_prefix then
    new.cover_image_asset_id := null;
    return new;
  end if;

  media_path := substring(trim(new.cover_image) from length(raw_prefix) + 1);
  if nullif(media_path, '') is null or media_path like '%..%' or media_path like '%//%' then
    new.cover_image_asset_id := null;
    return new;
  end if;

  file_name := regexp_replace(media_path, '^.*/', '');
  mime := case lower(regexp_replace(file_name, '^.*\.', ''))
    when 'jpg' then 'image/jpeg'
    when 'jpeg' then 'image/jpeg'
    when 'png' then 'image/png'
    when 'webp' then 'image/webp'
    when 'gif' then 'image/gif'
    when 'avif' then 'image/avif'
    when 'svg' then 'image/svg+xml'
    else 'image/*'
  end;

  encoded_url := rtrim(translate(encode(convert_to(trim(new.cover_image), 'UTF8'), 'base64'), '+/', '-_'), '=');
  asset_id := 'media_url_' || encoded_url;

  insert into public.media_assets (
    id, provider, github_owner, github_repository, branch, path, filename,
    public_url, mime_type, file_size, width, height, sha,
    original_filename, alt_text, title, created_at, updated_at
  ) values (
    asset_id, 'github', cfg_owner, cfg_repo, cfg_branch, media_path, file_name,
    trim(new.cover_image), mime, 0, 0, 0, null,
    file_name, '', file_name, now(), now()
  )
  on conflict (id) do update set
    public_url = excluded.public_url,
    github_owner = excluded.github_owner,
    github_repository = excluded.github_repository,
    branch = excluded.branch,
    path = excluded.path,
    filename = excluded.filename,
    mime_type = excluded.mime_type,
    updated_at = now();

  new.cover_image_asset_id := asset_id;
  return new;
end;
$$;


ALTER FUNCTION "public"."sync_article_cover_asset_reference"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_article_cover_asset_reference"() IS 'Internal trigger for article cover asset canonicalization; direct API execution is revoked.';



CREATE OR REPLACE FUNCTION "public"."sync_category_default_cover_to_articles"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if nullif(trim(coalesce(new.default_media_url, '')), '') is not null
     and (
       tg_op = 'INSERT'
       or new.default_media_url is distinct from old.default_media_url
       or new.default_media_asset_id is distinct from old.default_media_asset_id
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


ALTER FUNCTION "public"."sync_category_default_cover_to_articles"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_legacy_category_default_media_relation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if nullif(trim(coalesce(new.default_media_asset_id, '')), '') is not null then
    insert into public.category_default_media_assets(category_id, media_asset_id, sort_order)
    values (new.id, trim(new.default_media_asset_id), 0)
    on conflict (category_id, media_asset_id) do update set sort_order = least(public.category_default_media_assets.sort_order, excluded.sort_order);
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."sync_legacy_category_default_media_relation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_autopublish_token"("candidate" "text") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'private', 'extensions'
    AS $$
  select encode(extensions.digest(coalesce(candidate,''),'sha256'),'hex') = (select token_sha256 from private.autopublish_scheduler_control where id=true);
$$;


ALTER FUNCTION "public"."verify_autopublish_token"("candidate" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "private"."autopublish_run_lock" (
    "id" boolean DEFAULT true NOT NULL,
    "claimed_at" timestamp with time zone,
    CONSTRAINT "autopublish_run_lock_id_check" CHECK ("id")
);


ALTER TABLE "private"."autopublish_run_lock" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "private"."autopublish_scheduler_control" (
    "id" boolean DEFAULT true NOT NULL,
    "token_sha256" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "autopublish_scheduler_control_id_check" CHECK ("id")
);


ALTER TABLE "private"."autopublish_scheduler_control" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."article_categories" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "seo_title" "text" DEFAULT ''::"text" NOT NULL,
    "seo_description" "text" DEFAULT ''::"text" NOT NULL,
    "parent_id" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "default_media_asset_id" "text",
    "default_media_url" "text",
    "default_media_mode" "text" DEFAULT 'single'::"text" NOT NULL,
    "default_media_interval_ms" integer DEFAULT 4500 NOT NULL,
    CONSTRAINT "article_categories_default_media_interval_ms_check" CHECK ((("default_media_interval_ms" >= 1500) AND ("default_media_interval_ms" <= 20000))),
    CONSTRAINT "article_categories_default_media_mode_check" CHECK (("default_media_mode" = ANY (ARRAY['single'::"text", 'random'::"text", 'slideshow'::"text"]))),
    CONSTRAINT "article_categories_name_nonempty" CHECK ((("length"("btrim"("name")) >= 1) AND ("length"("btrim"("name")) <= 120))),
    CONSTRAINT "article_categories_parent_not_self" CHECK ((("parent_id" IS NULL) OR ("parent_id" <> "id"))),
    CONSTRAINT "article_categories_slug_nonempty" CHECK (("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::"text"))
);


ALTER TABLE "public"."article_categories" OWNER TO "postgres";


COMMENT ON COLUMN "public"."article_categories"."default_media_asset_id" IS 'Optional default MediaAsset ID used as the category cover when an article has no explicit cover image.';



CREATE TABLE IF NOT EXISTS "public"."articles" (
    "id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "category" "text" NOT NULL,
    "tags" "jsonb" DEFAULT '[]'::"jsonb",
    "summary" "text",
    "content" "text" NOT NULL,
    "cover_image" "text",
    "video_url" "text",
    "author" "jsonb",
    "published_at" "text",
    "published_at_jalali" "text",
    "published_at_gregorian" "text",
    "read_time_minutes" integer DEFAULT 5,
    "views_count" integer DEFAULT 0,
    "comments" "jsonb" DEFAULT '[]'::"jsonb",
    "seo_score" integer DEFAULT 90,
    "is_draft" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "cover_image_asset_id" "text",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "category_id" "text",
    "language" "text" DEFAULT 'fa'::"text" NOT NULL,
    "translation_group_id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    CONSTRAINT "articles_language_check" CHECK (("language" = ANY (ARRAY['fa'::"text", 'en'::"text"]))),
    CONSTRAINT "articles_translation_group_id_nonempty" CHECK (("char_length"(TRIM(BOTH FROM "translation_group_id")) > 0))
);


ALTER TABLE "public"."articles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."auth_login_attempts" (
    "key_hash" "text" NOT NULL,
    "window_started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "blocked_until" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."auth_login_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."auth_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "token_hash" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."auth_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."category_default_media_assets" (
    "category_id" "text" NOT NULL,
    "media_asset_id" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."category_default_media_assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chatbot_rate_limits" (
    "key_hash" "text" NOT NULL,
    "window_started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "request_count" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chatbot_rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cms_settings" (
    "id" "text" DEFAULT 'main_settings'::"text" NOT NULL,
    "settings_json" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."cms_settings" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."cms_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comment_rate_limits" (
    "key_hash" "text" NOT NULL,
    "operation" "text" NOT NULL,
    "window_started_at" timestamp with time zone NOT NULL,
    "request_count" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "comment_rate_limits_operation_check" CHECK (("operation" = ANY (ARRAY['create'::"text", 'vote'::"text"])))
);


ALTER TABLE "public"."comment_rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comment_votes" (
    "comment_id" "text" NOT NULL,
    "user_id" "text" NOT NULL,
    "vote" smallint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "comment_votes_user_id_length" CHECK ((("char_length"(TRIM(BOTH FROM "user_id")) >= 10) AND ("char_length"(TRIM(BOTH FROM "user_id")) <= 120))),
    CONSTRAINT "comment_votes_vote_check" CHECK (("vote" = ANY (ARRAY['-1'::integer, 1])))
);


ALTER TABLE "public"."comment_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "text" NOT NULL,
    "article_id" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "user_id" "text",
    "text" "text" NOT NULL,
    "approved" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "parent_id" "text",
    "like_count" integer DEFAULT 0 NOT NULL,
    "dislike_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "comments_article_id_length" CHECK ((("char_length"(TRIM(BOTH FROM "article_id")) >= 1) AND ("char_length"(TRIM(BOTH FROM "article_id")) <= 200))),
    CONSTRAINT "comments_text_length" CHECK ((("char_length"(TRIM(BOTH FROM "text")) >= 3) AND ("char_length"(TRIM(BOTH FROM "text")) <= 4000))),
    CONSTRAINT "comments_user_name_length" CHECK ((("char_length"(TRIM(BOTH FROM "user_name")) >= 2) AND ("char_length"(TRIM(BOTH FROM "user_name")) <= 80)))
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."market_ticker_config" (
    "id" "text" DEFAULT 'main'::"text" NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "provider" "text" DEFAULT 'jupiter'::"text" NOT NULL,
    "endpoint" "text" DEFAULT 'https://api.jup.ag/price/v3'::"text" NOT NULL,
    "refresh_seconds" integer DEFAULT 20 NOT NULL,
    "direction" "text" DEFAULT 'ltr'::"text" NOT NULL,
    "speed_seconds" integer DEFAULT 28 NOT NULL,
    "items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."market_ticker_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."media_assets" (
    "id" "text" NOT NULL,
    "provider" "text" DEFAULT 'github'::"text",
    "github_owner" "text" NOT NULL,
    "github_repository" "text" NOT NULL,
    "branch" "text" DEFAULT 'main'::"text" NOT NULL,
    "path" "text" NOT NULL,
    "filename" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "mime_type" "text",
    "file_size" integer DEFAULT 0,
    "width" integer DEFAULT 0,
    "height" integer DEFAULT 0,
    "sha" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "original_filename" "text",
    "alt_text" "text" DEFAULT ''::"text",
    "title" "text" DEFAULT ''::"text"
);


ALTER TABLE "public"."media_assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."media_config" (
    "id" "text" DEFAULT 'active_config'::"text" NOT NULL,
    "provider" "text" DEFAULT 'github'::"text",
    "github_owner" "text" NOT NULL,
    "github_repository" "text" NOT NULL,
    "branch" "text" DEFAULT 'main'::"text" NOT NULL,
    "base_path" "text" DEFAULT 'articles/'::"text" NOT NULL,
    "connection_status" "text" DEFAULT 'untested'::"text",
    "last_test_at" timestamp with time zone
);


ALTER TABLE "public"."media_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."media_system_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "level" "text" NOT NULL,
    "service" "text" NOT NULL,
    "stage" "text" NOT NULL,
    "error_code" "text" DEFAULT ''::"text" NOT NULL,
    "message" "text" NOT NULL,
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "media_system_logs_level_check" CHECK (("level" = ANY (ARRAY['info'::"text", 'warn'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."media_system_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."private_service_secrets" (
    "service" "text" NOT NULL,
    "secret_value" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."private_service_secrets" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."private_service_secrets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."registration_rate_limits" (
    "key_hash" "text" NOT NULL,
    "window_started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "request_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "registration_rate_limits_request_count_check" CHECK (("request_count" >= 0))
);


ALTER TABLE "public"."registration_rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "text" NOT NULL,
    "username" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "password_hash" "text" NOT NULL,
    "role" "text" DEFAULT 'admin'::"text",
    "permissions" "jsonb" DEFAULT '[]'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "private"."autopublish_run_lock"
    ADD CONSTRAINT "autopublish_run_lock_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "private"."autopublish_scheduler_control"
    ADD CONSTRAINT "autopublish_scheduler_control_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."article_categories"
    ADD CONSTRAINT "article_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."article_categories"
    ADD CONSTRAINT "article_categories_slug_unique" UNIQUE ("slug");



ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."auth_login_attempts"
    ADD CONSTRAINT "auth_login_attempts_pkey" PRIMARY KEY ("key_hash");



ALTER TABLE ONLY "public"."auth_sessions"
    ADD CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auth_sessions"
    ADD CONSTRAINT "auth_sessions_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."category_default_media_assets"
    ADD CONSTRAINT "category_default_media_assets_pkey" PRIMARY KEY ("category_id", "media_asset_id");



ALTER TABLE ONLY "public"."chatbot_rate_limits"
    ADD CONSTRAINT "chatbot_rate_limits_pkey" PRIMARY KEY ("key_hash");



ALTER TABLE ONLY "public"."cms_settings"
    ADD CONSTRAINT "cms_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comment_rate_limits"
    ADD CONSTRAINT "comment_rate_limits_pkey" PRIMARY KEY ("key_hash", "operation");



ALTER TABLE ONLY "public"."comment_votes"
    ADD CONSTRAINT "comment_votes_pkey" PRIMARY KEY ("comment_id", "user_id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."market_ticker_config"
    ADD CONSTRAINT "market_ticker_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."media_assets"
    ADD CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."media_config"
    ADD CONSTRAINT "media_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."media_system_logs"
    ADD CONSTRAINT "media_system_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."private_service_secrets"
    ADD CONSTRAINT "private_service_secrets_pkey" PRIMARY KEY ("service");



ALTER TABLE ONLY "public"."registration_rate_limits"
    ADD CONSTRAINT "registration_rate_limits_pkey" PRIMARY KEY ("key_hash");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_username_key" UNIQUE ("username");



CREATE INDEX "article_categories_active_sort_idx" ON "public"."article_categories" USING "btree" ("is_active", "sort_order", "name");



CREATE INDEX "article_categories_parent_idx" ON "public"."article_categories" USING "btree" ("parent_id");



CREATE INDEX "articles_category_id_idx" ON "public"."articles" USING "btree" ("category_id");



CREATE INDEX "articles_language_idx" ON "public"."articles" USING "btree" ("language");



CREATE UNIQUE INDEX "articles_translation_group_language_key" ON "public"."articles" USING "btree" ("translation_group_id", "language") WHERE ("translation_group_id" IS NOT NULL);



CREATE INDEX "auth_login_attempts_blocked_until_idx" ON "public"."auth_login_attempts" USING "btree" ("blocked_until");



CREATE INDEX "auth_sessions_expires_at_idx" ON "public"."auth_sessions" USING "btree" ("expires_at");



CREATE INDEX "auth_sessions_user_id_idx" ON "public"."auth_sessions" USING "btree" ("user_id");



CREATE INDEX "comments_article_approved_created_idx" ON "public"."comments" USING "btree" ("article_id", "approved", "created_at" DESC);



CREATE INDEX "comments_user_id_idx" ON "public"."comments" USING "btree" ("user_id");



CREATE INDEX "idx_article_categories_default_media_asset_id" ON "public"."article_categories" USING "btree" ("default_media_asset_id");



CREATE INDEX "idx_article_categories_default_media_url" ON "public"."article_categories" USING "btree" ("default_media_url");



CREATE INDEX "idx_articles_category_id" ON "public"."articles" USING "btree" ("category_id");



CREATE INDEX "idx_articles_cover_image_asset_id" ON "public"."articles" USING "btree" ("cover_image_asset_id");



CREATE INDEX "idx_articles_published_created_at" ON "public"."articles" USING "btree" ("is_draft", "created_at" DESC);



CREATE INDEX "idx_articles_translation_group_id" ON "public"."articles" USING "btree" ("translation_group_id") WHERE ("translation_group_id" IS NOT NULL);



CREATE INDEX "idx_category_default_media_assets_category_order" ON "public"."category_default_media_assets" USING "btree" ("category_id", "sort_order", "created_at");



CREATE INDEX "idx_comments_article_approved" ON "public"."comments" USING "btree" ("article_id", "approved", "created_at" DESC);



CREATE INDEX "idx_comments_article_approved_created" ON "public"."comments" USING "btree" ("article_id", "approved", "created_at" DESC);



CREATE INDEX "idx_comments_parent" ON "public"."comments" USING "btree" ("parent_id");



CREATE INDEX "idx_media_assets_created_at" ON "public"."media_assets" USING "btree" ("created_at" DESC);



CREATE INDEX "media_system_logs_created_at_idx" ON "public"."media_system_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "media_system_logs_service_stage_idx" ON "public"."media_system_logs" USING "btree" ("service", "stage");



CREATE UNIQUE INDEX "users_username_lower_unique_idx" ON "public"."users" USING "btree" ("lower"("username"));



CREATE OR REPLACE TRIGGER "article_categories_updated_at" BEFORE UPDATE ON "public"."article_categories" FOR EACH ROW EXECUTE FUNCTION "public"."set_article_categories_updated_at"();



CREATE OR REPLACE TRIGGER "articles_sync_category_reference" BEFORE INSERT OR UPDATE OF "category", "category_id" ON "public"."articles" FOR EACH ROW EXECUTE FUNCTION "public"."sync_article_category_reference"();



CREATE OR REPLACE TRIGGER "trg_article_category_default_media" BEFORE INSERT OR UPDATE OF "category", "category_id", "cover_image", "is_draft" ON "public"."articles" FOR EACH ROW EXECUTE FUNCTION "public"."apply_category_default_media_to_article"();



CREATE OR REPLACE TRIGGER "trg_articles_apply_category_default_cover" BEFORE INSERT OR UPDATE OF "category_id" ON "public"."articles" FOR EACH ROW EXECUTE FUNCTION "public"."apply_category_default_cover_to_article"();



CREATE OR REPLACE TRIGGER "trg_articles_normalize_seo" BEFORE INSERT OR UPDATE OF "title", "slug", "summary", "content", "tags" ON "public"."articles" FOR EACH ROW EXECUTE FUNCTION "public"."normalize_article_seo_fields"();



CREATE OR REPLACE TRIGGER "trg_articles_set_updated_at" BEFORE UPDATE ON "public"."articles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_category_sync_default_cover_to_articles" AFTER INSERT OR UPDATE OF "default_media_asset_id", "default_media_url", "name" ON "public"."article_categories" FOR EACH ROW EXECUTE FUNCTION "public"."sync_category_default_cover_to_articles"();



CREATE OR REPLACE TRIGGER "trg_media_assets_set_updated_at" BEFORE UPDATE ON "public"."media_assets" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sync_article_cover_asset_reference" BEFORE INSERT OR UPDATE OF "cover_image", "cover_image_asset_id" ON "public"."articles" FOR EACH ROW EXECUTE FUNCTION "public"."sync_article_cover_asset_reference"();



CREATE OR REPLACE TRIGGER "trg_sync_legacy_category_default_media_relation" AFTER INSERT OR UPDATE OF "default_media_asset_id" ON "public"."article_categories" FOR EACH ROW EXECUTE FUNCTION "public"."sync_legacy_category_default_media_relation"();



ALTER TABLE ONLY "public"."article_categories"
    ADD CONSTRAINT "article_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."article_categories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."article_categories"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."auth_sessions"
    ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."category_default_media_assets"
    ADD CONSTRAINT "category_default_media_assets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."article_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."category_default_media_assets"
    ADD CONSTRAINT "category_default_media_assets_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comment_votes"
    ADD CONSTRAINT "comment_votes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



CREATE POLICY "No public market ticker writes" ON "public"."market_ticker_config" USING (false) WITH CHECK (false);



CREATE POLICY "Public Insert Pending Comments" ON "public"."comments" FOR INSERT TO "authenticated", "anon" WITH CHECK (("approved" IS FALSE));



CREATE POLICY "Public Read Approved Comments" ON "public"."comments" FOR SELECT TO "authenticated", "anon" USING (("approved" IS TRUE));



CREATE POLICY "Public Read Media Assets" ON "public"."media_assets" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public Read Published Articles" ON "public"."articles" FOR SELECT TO "authenticated", "anon" USING (("is_draft" IS NOT TRUE));



CREATE POLICY "Public market ticker access" ON "public"."market_ticker_config" FOR SELECT USING (false);



ALTER TABLE "public"."article_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "article_categories_public_active_select" ON "public"."article_categories" FOR SELECT TO "authenticated", "anon" USING (("is_active" = true));



ALTER TABLE "public"."articles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auth_login_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auth_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."category_default_media_assets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "category_default_media_public_select" ON "public"."category_default_media_assets" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."chatbot_rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cms_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comment_rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comment_votes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."market_ticker_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."media_assets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."media_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."media_system_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."private_service_secrets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."registration_rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































REVOKE ALL ON FUNCTION "private"."claim_autopublish_slot"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."release_autopublish_slot"() FROM PUBLIC;



GRANT ALL ON FUNCTION "public"."apply_category_default_cover_to_article"() TO "anon";
GRANT ALL ON FUNCTION "public"."apply_category_default_cover_to_article"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_category_default_cover_to_article"() TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_category_default_media_to_article"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_auth_login_rate_limit"("p_key_hash" "text", "p_max_attempts" integer, "p_window_seconds" integer, "p_block_seconds" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_auth_login_rate_limit"("p_key_hash" "text", "p_max_attempts" integer, "p_window_seconds" integer, "p_block_seconds" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_autopublish_slot"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_autopublish_slot"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."consume_chatbot_rate_limit"("p_key_hash" "text", "p_limit" integer, "p_window_seconds" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consume_chatbot_rate_limit"("p_key_hash" "text", "p_limit" integer, "p_window_seconds" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."consume_comment_rate_limit"("p_key_hash" "text", "p_operation" "text", "p_window_seconds" integer, "p_max_requests" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consume_comment_rate_limit"("p_key_hash" "text", "p_operation" "text", "p_window_seconds" integer, "p_max_requests" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."consume_registration_rate_limit"("p_key_hash" "text", "p_window_seconds" integer, "p_max_requests" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consume_registration_rate_limit"("p_key_hash" "text", "p_window_seconds" integer, "p_max_requests" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_article_seo_fields"() TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_article_slug"("input" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_auth_login_failure"("p_key_hash" "text", "p_window_seconds" integer, "p_max_attempts" integer, "p_block_seconds" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_auth_login_failure"("p_key_hash" "text", "p_window_seconds" integer, "p_max_attempts" integer, "p_block_seconds" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."release_autopublish_slot"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."release_autopublish_slot"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_article_categories_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_article_categories_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_article_categories_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_category_default_media"("p_assign_category_ids" "text"[], "p_clear_category_ids" "text"[], "p_asset_id" "text", "p_url" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_category_default_media"("p_assign_category_ids" "text"[], "p_clear_category_ids" "text"[], "p_asset_id" "text", "p_url" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_category_default_media"("p_assign_category_ids" "text"[], "p_clear_category_ids" "text"[], "p_asset_id" "text", "p_url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_category_default_media"("p_assign_category_ids" "text"[], "p_clear_category_ids" "text"[], "p_asset_id" "text", "p_url" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_category_default_media_gallery"("p_category_id" "text", "p_media_asset_ids" "text"[], "p_mode" "text", "p_interval_ms" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_comment_vote"("p_comment_id" "text", "p_user_id" "text", "p_vote" smallint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_comment_vote"("p_comment_id" "text", "p_user_id" "text", "p_vote" smallint) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_article_category_reference"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_article_cover_asset_reference"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_article_cover_asset_reference"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_category_default_cover_to_articles"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_category_default_cover_to_articles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_category_default_cover_to_articles"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_legacy_category_default_media_relation"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_legacy_category_default_media_relation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_legacy_category_default_media_relation"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."verify_autopublish_token"("candidate" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."verify_autopublish_token"("candidate" "text") TO "service_role";
























GRANT ALL ON TABLE "public"."article_categories" TO "anon";
GRANT ALL ON TABLE "public"."article_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."article_categories" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."articles" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."articles" TO "authenticated";
GRANT ALL ON TABLE "public"."articles" TO "service_role";



GRANT ALL ON TABLE "public"."auth_login_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."auth_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."category_default_media_assets" TO "anon";
GRANT ALL ON TABLE "public"."category_default_media_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."category_default_media_assets" TO "service_role";



GRANT ALL ON TABLE "public"."chatbot_rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."cms_settings" TO "service_role";



GRANT ALL ON TABLE "public"."comment_rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."comment_votes" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."comments" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."market_ticker_config" TO "anon";
GRANT ALL ON TABLE "public"."market_ticker_config" TO "authenticated";
GRANT ALL ON TABLE "public"."market_ticker_config" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."media_assets" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."media_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."media_assets" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."media_config" TO "anon";
GRANT MAINTAIN ON TABLE "public"."media_config" TO "authenticated";
GRANT ALL ON TABLE "public"."media_config" TO "service_role";



GRANT ALL ON TABLE "public"."media_system_logs" TO "anon";
GRANT ALL ON TABLE "public"."media_system_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."media_system_logs" TO "service_role";



GRANT ALL ON TABLE "public"."private_service_secrets" TO "anon";
GRANT ALL ON TABLE "public"."private_service_secrets" TO "authenticated";
GRANT ALL ON TABLE "public"."private_service_secrets" TO "service_role";



GRANT ALL ON TABLE "public"."registration_rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
-- SOLMINT_PAY_BASELINE_END
