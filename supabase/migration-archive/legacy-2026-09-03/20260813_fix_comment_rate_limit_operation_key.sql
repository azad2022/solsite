-- The rate limiter supports separate create/vote operations for the same
-- user+IP hash. The old primary key used only key_hash, which made the
-- SECURITY DEFINER RPC fail before a new comment could be inserted.
ALTER TABLE public.comment_rate_limits
  DROP CONSTRAINT IF EXISTS comment_rate_limits_pkey;

ALTER TABLE public.comment_rate_limits
  ADD CONSTRAINT comment_rate_limits_pkey PRIMARY KEY (key_hash, operation);
