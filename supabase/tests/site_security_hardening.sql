-- Regression fixture for Issue #38 site-wide security hardening.
-- Validates client privilege removal while preserving public read access.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
END $$;

CREATE TABLE public.article_categories (id text primary key, name text not null, default_media_asset_id text, default_media_url text);
CREATE TABLE public.category_default_media_assets (category_id text not null, media_asset_id text not null);
CREATE TABLE public.private_service_secrets (key text primary key, secret_value text not null);

CREATE OR REPLACE FUNCTION public.apply_category_default_cover_to_article()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION public.set_category_default_media(
  p_assign_category_ids text[] DEFAULT '{}',
  p_clear_category_ids text[] DEFAULT '{}',
  p_asset_id text DEFAULT NULL,
  p_url text DEFAULT NULL
)
RETURNS TABLE(category_id text, articles_updated bigint, action text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN RETURN; END $$;

CREATE OR REPLACE FUNCTION public.set_category_default_media_gallery(
  p_category_id text,
  p_media_asset_ids text[],
  p_mode text DEFAULT 'single',
  p_interval_ms integer DEFAULT 4500
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN RETURN '{}'::jsonb; END $$;

CREATE OR REPLACE FUNCTION public.sync_category_default_cover_to_articles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION public.sync_legacy_category_default_media_relation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN RETURN NEW; END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.article_categories TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.category_default_media_assets TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.private_service_secrets TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_category_default_cover_to_article() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_category_default_media(text[], text[], text, text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_category_default_media_gallery(text, text[], text, integer) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_category_default_cover_to_articles() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_legacy_category_default_media_relation() TO PUBLIC;

\set hardening_migration 'supabase/migrations/20260920131133_solmint_site_security_hardening_20260920.sql'
\i :hardening_migration

DO $$
BEGIN
  IF has_function_privilege('anon','public.apply_category_default_cover_to_article()','EXECUTE') THEN
    RAISE EXCEPTION 'anon can still execute apply_category_default_cover_to_article';
  END IF;
  IF has_function_privilege('authenticated','public.set_category_default_media(text[],text[],text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated can still execute set_category_default_media';
  END IF;
  IF has_function_privilege('anon','public.set_category_default_media_gallery(text,text[],text,integer)','EXECUTE') THEN
    RAISE EXCEPTION 'anon can still execute set_category_default_media_gallery';
  END IF;
  IF has_function_privilege('authenticated','public.sync_category_default_cover_to_articles()','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated can still execute sync_category_default_cover_to_articles';
  END IF;
  IF has_function_privilege('anon','public.sync_legacy_category_default_media_relation()','EXECUTE') THEN
    RAISE EXCEPTION 'anon can still execute sync_legacy_category_default_media_relation';
  END IF;

  IF has_table_privilege('anon','public.article_categories','INSERT') THEN
    RAISE EXCEPTION 'anon still has article_categories INSERT';
  END IF;
  IF has_table_privilege('authenticated','public.article_categories','UPDATE') THEN
    RAISE EXCEPTION 'authenticated still has article_categories UPDATE';
  END IF;
  IF has_table_privilege('anon','public.category_default_media_assets','DELETE') THEN
    RAISE EXCEPTION 'anon still has category_default_media_assets DELETE';
  END IF;
  IF has_table_privilege('authenticated','public.private_service_secrets','SELECT') THEN
    RAISE EXCEPTION 'authenticated still has private_service_secrets SELECT';
  END IF;

  IF NOT has_table_privilege('anon','public.article_categories','SELECT') THEN
    RAISE EXCEPTION 'anon article category SELECT was removed';
  END IF;
  IF NOT has_table_privilege('anon','public.category_default_media_assets','SELECT') THEN
    RAISE EXCEPTION 'anon category media SELECT was removed';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE oid = 'public.apply_category_default_cover_to_article()'::regprocedure
      AND proconfig @> ARRAY['search_path=']
  ) THEN
    RAISE EXCEPTION 'trigger function search_path was not pinned to empty';
  END IF;
END $$;

select 'site_security_hardening_ok' as result;
