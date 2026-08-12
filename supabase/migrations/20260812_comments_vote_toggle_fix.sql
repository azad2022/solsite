-- Align the production comment vote RPC with the client contract:
-- vote = 1 like, -1 dislike, 0 remove the current user's vote.

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
  v_likes integer := 0;
  v_dislikes integer := 0;
  v_user_vote smallint := 0;
begin
  if p_vote not in (-1, 0, 1) then raise exception 'invalid_vote'; end if;
  if length(trim(coalesce(p_comment_id, ''))) = 0 or length(trim(coalesce(p_user_id, ''))) = 0 then raise exception 'invalid_identity'; end if;

  if p_vote = 0 then
    delete from public.comment_votes
    where comment_votes.comment_id = p_comment_id
      and comment_votes.user_id = p_user_id;
  else
    insert into public.comment_votes(comment_id, user_id, vote)
    values (p_comment_id, p_user_id, p_vote)
    on conflict (comment_id, user_id) do update
      set vote = excluded.vote,
          updated_at = now();
  end if;

  select
    count(*) filter (where vote = 1),
    count(*) filter (where vote = -1),
    coalesce((select vote from public.comment_votes where comment_votes.comment_id = p_comment_id and comment_votes.user_id = p_user_id), 0)
  into v_likes, v_dislikes, v_user_vote
  from public.comment_votes
  where comment_votes.comment_id = p_comment_id;

  update public.comments
  set like_count = coalesce(v_likes, 0),
      dislike_count = coalesce(v_dislikes, 0)
  where id = p_comment_id and approved = true;

  return query select p_comment_id, coalesce(v_likes, 0), coalesce(v_dislikes, 0), coalesce(v_user_vote, 0);
end;
$$;

revoke all on function public.set_comment_vote(text, text, smallint) from public;
grant execute on function public.set_comment_vote(text, text, smallint) to anon, authenticated;
