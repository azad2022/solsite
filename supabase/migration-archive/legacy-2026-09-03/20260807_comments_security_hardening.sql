-- Security hardening for production blog comments.
-- Public browsers must never receive direct write access to comment state or vote identities.

alter table public.comment_votes enable row level security;
drop policy if exists comment_votes_public_read on public.comment_votes;
drop policy if exists comment_votes_anon_insert on public.comment_votes;
drop policy if exists comment_votes_anon_update on public.comment_votes;
drop policy if exists comment_votes_anon_delete on public.comment_votes;

-- Vote rows contain pseudonymous session identifiers and are therefore not publicly readable.
-- All reads/writes go through the server-side service-role client.
revoke select, insert, update, delete on public.comment_votes from anon, authenticated;

-- Comments are also server-mediated. This prevents a browser from changing approval,
-- parent relationships, author identity, or counters directly.
revoke insert, update, delete on public.comments from anon, authenticated;

-- Defense in depth: constrain externally supplied values even if a future endpoint is added.
alter table public.comments
  drop constraint if exists comments_user_name_length,
  drop constraint if exists comments_text_length,
  drop constraint if exists comments_article_id_length;

alter table public.comments
  add constraint comments_user_name_length check (char_length(trim(user_name)) between 2 and 80),
  add constraint comments_text_length check (char_length(trim(text)) between 3 and 4000),
  add constraint comments_article_id_length check (char_length(trim(article_id)) between 1 and 200);

alter table public.comment_votes
  drop constraint if exists comment_votes_user_id_length;

alter table public.comment_votes
  add constraint comment_votes_user_id_length check (char_length(trim(user_id)) between 10 and 120);

-- Never allow a public caller to execute the privileged vote RPC.
revoke all on function public.set_comment_vote(text, text, smallint) from public, anon, authenticated;
grant execute on function public.set_comment_vote(text, text, smallint) to service_role;
