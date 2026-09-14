begin;

-- Preserve the deliberate separation between Better Auth identity and the
-- application profile while enforcing lifecycle integrity on the bridge row.
-- This is safe to introduce before the first Better Auth production migration;
-- it also makes application-user deletion remove the bridge row automatically.
do $$
begin
  if to_regclass('public.auth_identity_links') is not null
     and to_regclass('public.users') is not null
     and not exists (
       select 1
       from pg_constraint
       where conname = 'auth_identity_links_application_user_id_fkey'
         and conrelid = 'public.auth_identity_links'::regclass
     ) then
    alter table public.auth_identity_links
      add constraint auth_identity_links_application_user_id_fkey
      foreign key (application_user_id)
      references public.users(id)
      on delete cascade;
  end if;
end
$$;

commit;
