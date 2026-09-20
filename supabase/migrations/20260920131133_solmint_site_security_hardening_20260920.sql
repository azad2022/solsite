-- Site-wide security hardening for pre-existing category/media administrative RPCs.
-- Production migration version: 20260920131133.
-- Scope: Issue #38. Client roles must not be able to execute privileged
-- administrative functions or mutate category/media configuration tables directly.
-- Public read access required by the site is preserved.

REVOKE EXECUTE ON FUNCTION public.apply_category_default_cover_to_article() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_category_default_media(text[], text[], text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_category_default_media_gallery(text, text[], text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_category_default_cover_to_articles() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_legacy_category_default_media_relation() FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.apply_category_default_cover_to_article() SET search_path = '';
ALTER FUNCTION public.set_category_default_media(text[], text[], text, text) SET search_path = '';
ALTER FUNCTION public.set_category_default_media_gallery(text, text[], text, integer) SET search_path = '';
ALTER FUNCTION public.sync_category_default_cover_to_articles() SET search_path = '';
ALTER FUNCTION public.sync_legacy_category_default_media_relation() SET search_path = '';

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.article_categories FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.category_default_media_assets FROM PUBLIC, anon, authenticated;

REVOKE ALL ON public.private_service_secrets FROM PUBLIC, anon, authenticated;
