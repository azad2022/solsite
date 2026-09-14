-- Production hardening for blog comments.
-- Source of truth: public.comments. New comments are pending by default.
-- Public clients may read approved comments and insert pending comments only.
-- Approval/deletion must be performed by a trusted server-side admin path.

alter table public.comments alter column approved set default false;
update public.comments set approved = false where approved is null;
alter table public.comments alter column approved set not null;

alter table public.comments drop constraint if exists comments_user_name_length;
alter table public.comments add constraint comments_user_name_length
  check (char_length(btrim(user_name)) between 2 and 80);

alter table public.comments drop constraint if exists comments_text_length;
alter table public.comments add constraint comments_text_length
  check (char_length(btrim(text)) between 3 and 4000);

alter table public.comments drop constraint if exists comments_article_id_length;
alter table public.comments add constraint comments_article_id_length
  check (char_length(btrim(article_id)) between 1 and 200);

create index if not exists comments_article_approved_created_idx
  on public.comments(article_id, approved, created_at desc);

create index if not exists comments_user_id_idx
  on public.comments(user_id);

alter table public.comments enable row level security;

drop policy if exists "Public Read Approved Comments" on public.comments;
drop policy if exists "Public Insert Comments" on public.comments;
drop policy if exists "Public Update Comments" on public.comments;
drop policy if exists "Public Delete Comments" on public.comments;

create policy "Public Read Approved Comments"
  on public.comments for select
  to anon, authenticated
  using (approved is true);

create policy "Public Insert Pending Comments"
  on public.comments for insert
  to anon, authenticated
  with check (approved is false);

revoke update, delete on public.comments from anon, authenticated;
grant select, insert on public.comments to anon, authenticated;
