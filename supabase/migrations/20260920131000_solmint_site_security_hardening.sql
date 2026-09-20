-- Site-wide security hardening for pre-existing category/media administrative RPCs.
-- Scope: Issue #38. Client roles must not be able to execute privileged administrative
-- functions or mutate category/media configuration tables directly.
-- Public read access for article categories and category-media relations is preserved
-- because the production site reads those resources server-side with the public API key.

REVOKE EXECUTE ON FUNCTION public.apply_category_default_cover_to_article() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_category_default_media(text[], text[], text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_category_default_media_gallery(text, text[], text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_category_default_cover_to_articles() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_legacy_category_default_media_relation() FROM PUBLIC, anon, authenticated;

-- These routines execute privileged database-side work and use fully-qualified
-- public objects, so an empty search_path removes public-path shadowing risk.
ALTER FUNCTION public.apply_category_default_cover_to_article() SET search_path = '';
ALTER FUNCTION public.set_category_default_media(text[], text[], text, text) SET search_path = '';
ALTER FUNCTION public.set_category_default_media_gallery(text, text[], text, integer) SET search_path = '';
ALTER FUNCTION public.sync_category_default_cover_to_articles() SET search_path = '';
ALTER FUNCTION public.sync_legacy_category_default_media_relation() SET search_path = '';

-- Preserve SELECT for public site reads, but remove direct client-side mutation
-- capabilities from category and category-media relation tables.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.article_categories FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.category_default_media_assets FROM PUBLIC, anon, authenticated;

-- This table is a private server-side secret store and must never be directly
-- addressable by anonymous or authenticated API roles.
REVOKE ALL ON public.private_service_secrets FROM PUBLIC, anon, authenticated;
