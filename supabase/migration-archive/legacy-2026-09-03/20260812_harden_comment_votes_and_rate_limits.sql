-- Harden comment voting privacy and abuse controls for production.
revoke all on table public.comment_votes from anon, authenticated;

alter table public.comment_votes enable row level security;
drop policy if exists comment_votes_public_read on public.comment_votes;

create or replace function public.set_comment_vote(
  p_comment_id text,
  p_user_id text,
  p_vote smallint
)
returns table (like_count integer, dislike_count integer, user_vote smallint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old smallint;
begin
  if p_user_id is null or length(trim(p_user_id)) < 1 then raise exception 'invalid user'; end if;
  if p_vote not in (-1,0,1) then raise exception 'invalid vote'; end if;

  select vote into v_old
  from public.comment_votes
  where comment_id=p_comment_id and user_id=p_user_id
  for update;

  if p_vote=0 then
    delete from public.comment_votes where comment_id=p_comment_id and user_id=p_user_id;
  elsif v_old is null then
    insert into public.comment_votes(comment_id,user_id,vote) values(p_comment_id,p_user_id,p_vote);
  else
    update public.comment_votes set vote=p_vote,updated_at=now()
    where comment_id=p_comment_id and user_id=p_user_id;
  end if;

  update public.comments c
  set like_count=(select count(*) from public.comment_votes v where v.comment_id=c.id and v.vote=1),
      dislike_count=(select count(*) from public.comment_votes v where v.comment_id=c.id and v.vote=-1)
  where c.id=p_comment_id;

  return query
  select c.like_count,
         c.dislike_count,
         coalesce((select v.vote from public.comment_votes v where v.comment_id=c.id and v.user_id=p_user_id),0)::smallint
  from public.comments c
  where c.id=p_comment_id;
end;
$$;

revoke all on function public.set_comment_vote(text,text,smallint) from public, anon, authenticated;
grant execute on function public.set_comment_vote(text,text,smallint) to service_role;

-- Server-only atomic rate limiter for comment creation and voting.
create table if not exists public.comment_rate_limits (
  key_hash text primary key,
  operation text not null check (operation in ('create','vote')),
  window_started_at timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now()
);

revoke all on table public.comment_rate_limits from public, anon, authenticated;

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
  v_now timestamptz := now();
  v_row public.comment_rate_limits%rowtype;
begin
  if p_key_hash is null or length(trim(p_key_hash)) < 32 then raise exception 'invalid rate limit key'; end if;
  if p_operation not in ('create','vote') then raise exception 'invalid operation'; end if;
  if p_window_seconds < 1 or p_window_seconds > 86400 then raise exception 'invalid window'; end if;
  if p_max_requests < 1 or p_max_requests > 1000 then raise exception 'invalid max requests'; end if;

  insert into public.comment_rate_limits(key_hash,operation,window_started_at,request_count,updated_at)
  values(p_key_hash,p_operation,v_now,1,v_now)
  on conflict (key_hash) do update
    set operation = excluded.operation,
        window_started_at = case
          when public.comment_rate_limits.window_started_at <= v_now - make_interval(secs => p_window_seconds)
            then v_now else public.comment_rate_limits.window_started_at end,
        request_count = case
          when public.comment_rate_limits.window_started_at <= v_now - make_interval(secs => p_window_seconds)
            then 1 else public.comment_rate_limits.request_count + 1 end,
        updated_at = v_now
  returning * into v_row;

  return v_row.request_count <= p_max_requests;
end;
$$;

revoke all on function public.consume_comment_rate_limit(text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_comment_rate_limit(text,text,integer,integer) to service_role;
