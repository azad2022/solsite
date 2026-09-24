-- Align API-key mutation responses with the released PayApiKey contract.
-- Newly created/rotated keys are active because expiry <= now() is rejected.
-- Plaintext secrets remain one-time HTTP response values and are never stored.

do $$
declare v_definition text;
begin
  select pg_get_functiondef(p.oid) into v_definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='pay_create_api_key_unlocked'
  order by p.oid limit 1;

  if v_definition is null then raise exception 'pay_create_api_key_unlocked is missing'; end if;

  if position('''status'',''active''' in v_definition)=0 then
    if position('''scopes'',v_key.scopes,''expiresAt''' in v_definition)=0 then
      raise exception 'pay_create_api_key_unlocked response contract pattern not found';
    end if;
    v_definition := replace(
      v_definition,
      '''scopes'',v_key.scopes,''expiresAt''',
      '''scopes'',v_key.scopes,''status'',''active'',''expiresAt'''
    );
    execute v_definition;
  end if;
end
$$;

do $$
declare v_definition text;
begin
  select pg_get_functiondef(p.oid) into v_definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='pay_rotate_api_key_unlocked'
  order by p.oid limit 1;

  if v_definition is null then raise exception 'pay_rotate_api_key_unlocked is missing'; end if;

  if position('''status'',''active''' in v_definition)=0 then
    if position('''scopes'',v_new_key.scopes,''expiresAt''' in v_definition)=0 then
      raise exception 'pay_rotate_api_key_unlocked response contract pattern not found';
    end if;
    v_definition := replace(
      v_definition,
      '''scopes'',v_new_key.scopes,''expiresAt''',
      '''scopes'',v_new_key.scopes,''status'',''active'',''expiresAt'''
    );
    execute v_definition;
  end if;
end
$$;
