-- Final production hardening for public comments and authenticated interactions.
-- Read access is public; all mutations remain server-authoritative.

create index if not exists comments_article_approved_created_idx
  on public.comments(article_id, approved, created_at desc);

create table if not exists public.comment_rate_limits (
  key_hash text not null,
  operation text not null check (operation in ('create', 'vote')),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  primary key (key_hash, operation)
);

alter table public.comment_rate_limits enable row level security;
revoke all on public.comment_rate_limits from anon, authenticated, public;
grant select, insert, update, delete on public.comment_rate_limits to service_role;

create or replace function public.consume_comment_rate_limit(
  p_key_hash text,
  p_operation text,
  p_window_seconds integer,
  p_max_requests integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started timestamptz;
  v_count integer;
begin
  if length(trim(coalesce(p_key_hash, ''))) < 32 then raise exception 'invalid_rate_key'; end if;
  if p_operation not in ('create', 'vote') then raise exception 'invalid_rate_operation'; end if;
  if p_window_seconds < 1 or p_window_seconds > 86400 then raise exception 'invalid_rate_window'; end if;
  if p_max_requests < 1 or p_max_requests > 1000 then raise exception 'invalid_rate_limit'; end if;

  insert into public.comment_rate_limits(key_hash, operation, window_started_at, request_count)
  values (p_key_hash, p_operation, now(), 1)
  on conflict (key_hash, operation)
  do update set
    window_started_at = case
      when public.comment_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
      then now()
      else public.comment_rate_limits.window_started_at
    end,
    request_count = case
      when public.comment_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
      then 1
      else public.comment_rate_limits.request_count + 1
    end;

  select window_started_at, request_count into v_started, v_count
  from public.comment_rate_limits
  where comment_rate_limits.key_hash = p_key_hash
    and comment_rate_limits.operation = p_operation;

  return not (v_started > now() - make_interval(secs => p_window_seconds) and v_count > p_max_requests);
end;
$$;

revoke all on function public.consume_comment_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_comment_rate_limit(text, text, integer, integer) to service_role;

create or replace function public.set_comment_vote(
  p_comment_id text,
  p_user_id text,
  p_vote smallint
)
returns table (comment_id text, like_count integer, dislike_count integer, user_vote smallint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous smallint;
  v_likes integer;
  v_dislikes integer;
begin
  if p_vote not in (-1, 0, 1) then raise exception 'invalid_vote'; end if;
  if length(trim(coalesce(p_comment_id, ''))) = 0 or length(trim(coalesce(p_user_id, ''))) = 0 then raise exception 'invalid_identity'; end if;

  perform 1 from public.comments where id = p_comment_id and approved = true for update;
  if not found then raise exception 'comment_not_found'; end if;

  select vote into v_previous
  from public.comment_votes
  where comment_votes.comment_id = p_comment_id and comment_votes.user_id = p_user_id
  for update;

  if p_vote = 0 then
    delete from public.comment_votes
    where comment_votes.comment_id = p_comment_id and comment_votes.user_id = p_user_id;
  elsif v_previous is null then
    insert into public.comment_votes(comment_id, user_id, vote) values (p_comment_id, p_user_id, p_vote);
  elsif v_previous = p_vote then
    delete from public.comment_votes
    where comment_votes.comment_id = p_comment_id and comment_votes.user_id = p_user_id;
  else
    update public.comment_votes set vote = p_vote, updated_at = now()
    where comment_votes.comment_id = p_comment_id and comment_votes.user_id = p_user_id;
  end if;

  select count(*) filter (where vote = 1), count(*) filter (where vote = -1)
    into v_likes, v_dislikes
  from public.comment_votes where comment_votes.comment_id = p_comment_id;

  update public.comments
  set like_count = coalesce(v_likes, 0), dislike_count = coalesce(v_dislikes, 0)
  where id = p_comment_id and approved = true;

  return query
  select p_comment_id,
    coalesce(v_likes, 0),
    coalesce(v_dislikes, 0),
    coalesce((select vote from public.comment_votes where comment_votes.comment_id = p_comment_id and comment_votes.user_id = p_user_id), 0)::smallint;
end;
$$;

revoke all on function public.set_comment_vote(text, text, smallint) from public, anon, authenticated;
grant execute on function public.set_comment_vote(text, text, smallint) to service_role;
