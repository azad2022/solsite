-- Production comment interactions: threaded replies + per-user like/dislike votes.
-- The public client never writes approval state directly.

alter table public.comments
  add column if not exists parent_id text references public.comments(id) on delete cascade,
  add column if not exists like_count integer not null default 0,
  add column if not exists dislike_count integer not null default 0;

create index if not exists comments_article_parent_idx
  on public.comments(article_id, parent_id, created_at desc);

create table if not exists public.comment_votes (
  comment_id text not null references public.comments(id) on delete cascade,
  user_id text not null,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists comment_votes_user_idx
  on public.comment_votes(user_id, updated_at desc);

alter table public.comment_votes enable row level security;

-- Vote writes are performed through the server API / trusted database function.
-- No direct anonymous UPDATE/DELETE is exposed.
drop policy if exists comment_votes_public_read on public.comment_votes;
create policy comment_votes_public_read
  on public.comment_votes for select
  to anon, authenticated
  using (true);

authorize extension if not exists pgcrypto;

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
  if p_vote not in (-1, 1) then
    raise exception 'invalid_vote';
  end if;
  if length(trim(coalesce(p_comment_id, ''))) = 0 or length(trim(coalesce(p_user_id, ''))) = 0 then
    raise exception 'invalid_identity';
  end if;

  select vote into v_previous
  from public.comment_votes
  where comment_votes.comment_id = p_comment_id and comment_votes.user_id = p_user_id
  for update;

  if v_previous is null then
    insert into public.comment_votes(comment_id, user_id, vote)
    values (p_comment_id, p_user_id, p_vote);
  elsif v_previous = p_vote then
    delete from public.comment_votes
    where comment_votes.comment_id = p_comment_id and comment_votes.user_id = p_user_id;
  else
    update public.comment_votes
      set vote = p_vote, updated_at = now()
    where comment_votes.comment_id = p_comment_id and comment_votes.user_id = p_user_id;
  end if;

  select count(*) filter (where vote = 1), count(*) filter (where vote = -1)
    into v_likes, v_dislikes
  from public.comment_votes
  where comment_votes.comment_id = p_comment_id;

  update public.comments
    set like_count = v_likes, dislike_count = v_dislikes
  where id = p_comment_id and approved = true;

  return query
  select p_comment_id, coalesce(v_likes, 0), coalesce(v_dislikes, 0),
         (select vote from public.comment_votes where comment_votes.comment_id = p_comment_id and comment_votes.user_id = p_user_id);
end;
$$;

revoke all on function public.set_comment_vote(text, text, smallint) from public;
grant execute on function public.set_comment_vote(text, text, smallint) to anon, authenticated;
