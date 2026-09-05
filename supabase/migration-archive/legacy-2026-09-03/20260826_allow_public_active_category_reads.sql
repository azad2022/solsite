-- The media-library category picker and public category API need to read active
-- article categories with the publishable Supabase key. RLS was enabled on
-- article_categories without a SELECT policy, causing PostgREST to return
-- HTTP 200 with an empty array instead of the real categories.
DROP POLICY IF EXISTS article_categories_public_active_select ON public.article_categories;

CREATE POLICY article_categories_public_active_select
ON public.article_categories
FOR SELECT
TO anon, authenticated
USING (is_active = true);
