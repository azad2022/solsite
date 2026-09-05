-- Production comments: threaded replies + one vote per user + atomic counters.
alter table public.comments add column if not exists parent_id text references public.comments(id) on delete cascade;
alter table public.comments add column if not exists like_count integer not null default 0;
alter table public.comments add column if not exists dislike_count integer not null default 0;

create index if not exists idx_comments_article_approved_created on public.comments(article_id, approved, created_at desc);
create index if not exists idx_comments_parent on public.comments(parent_id);

create table if not exists public.comment_votes (
  comment_id text not null references public.comments(id) on delete cascade,
  user_id text not null,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

alter table public.comment_votes enable row level security;

create or replace function public.set_comment_vote(p_comment_id text, p_user_id text, p_vote smallint)
returns table(like_count integer, dislike_count integer, user_vote smallint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old smallint;
begin
  if p_user_id is null or length(trim(p_user_id)) < 1 then raise exception 'invalid user'; end if;
  if p_vote not in (-1, 0, 1) then raise exception 'invalid vote'; end if;

  select vote into v_old from public.comment_votes
  where comment_id = p_comment_id and user_id = p_user_id for update;

  if p_vote = 0 then
    delete from public.comment_votes where comment_id = p_comment_id and user_id = p_user_id;
  elsif v_old is null then
    insert into public.comment_votes(comment_id, user_id, vote) values(p_comment_id, p_user_id, p_vote);
  else
    update public.comment_votes set vote = p_vote, updated_at = now()
    where comment_id = p_comment_id and user_id = p_user_id;
  end if;

  update public.comments c
  set like_count = (select count(*) from public.comment_votes v where v.comment_id = c.id and v.vote = 1),
      dislike_count = (select count(*) from public.comment_votes v where v.comment_id = c.id and v.vote = -1)
  where c.id = p_comment_id;

  return query
  select c.like_count, c.dislike_count,
    coalesce((select v.vote from public.comment_votes v where v.comment_id = c.id and v.user_id = p_user_id), 0)::smallint
  from public.comments c where c.id = p_comment_id;
end;
$$;

revoke all on function public.set_comment_vote(text, text, smallint) from public, anon, authenticated;
grant execute on function public.set_comment_vote(text, text, smallint) to service_role;
