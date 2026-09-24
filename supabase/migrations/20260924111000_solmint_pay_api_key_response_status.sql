-- Align API-key mutation responses with the released PayApiKey contract.
-- The existing lifecycle/locking migrations remain authoritative; this migration
-- preserves their full definitions and only adds status='active' to newly
-- created/rotated key metadata.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(p.oid)
    into v_definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'pay_create_api_key_unlocked'
  order by p.oid
  limit 1;

  if v_definition is null then
    raise exception 'pay_create_api_key_unlocked is missing';
  end if;

  if position('''status'',''active''::text' in v_definition) = 0 then
    v_definition := replace(
      v_definition,
      '''keyPrefix'',v_key.key_prefix,''scopes'',v_key.scopes,''expiresAt''',
      '''keyPrefix'',v_key.key_prefix,''scopes'',v_key.scopes,''status'',''active'',''expiresAt'''
    );
    if position('''status'',''active''::text' in v_definition) = 0 then
      raise exception 'pay_create_api_key_unlocked response contract pattern not found';
    end if;
    execute v_definition;
  end if;
end
$$;

do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(p.oid)
    into v_definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'pay_rotate_api_key_unlocked'
  order by p.oid
  limit 1;

  if v_definition is null then
    raise exception 'pay_rotate_api_key_unlocked is missing';
  end if;

  if position('''status'',''active''::text' in v_definition) = 0 then
    v_definition := replace(
      v_definition,
      '''keyPrefix'',v_new_key.key_prefix,''scopes'',v_new_key.scopes,''expiresAt''',
      '''keyPrefix'',v_new_key.key_prefix,''scopes'',v_new_key.scopes,''status'',''active'',''expiresAt'''
    );
    if position('''status'',''active''::text' in v_definition) = 0 then
      raise exception 'pay_rotate_api_key_unlocked response contract pattern not found';
    end if;
    execute v_definition;
  end if;
end
$$;
