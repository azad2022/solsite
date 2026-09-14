-- Harden the Better Auth HTTPS adapter RPC for concurrent auth traffic.
-- Every single-row operation is constrained to one target row and re-checks
-- the original predicate on write/delete, so concurrent requests cannot consume
-- or update multiple records or bypass a conditional guard.

create or replace function public.solmint_better_auth_adapter(
  p_operation text,
  p_model text,
  p_data jsonb default '{}'::jsonb,
  p_where jsonb default '[]'::jsonb,
  p_limit integer default null,
  p_offset integer default 0,
  p_sort jsonb default null,
  p_increment jsonb default '{}'::jsonb,
  p_set jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_table text;
  v_type text;
  v_sql text;
  v_where text := 'true';
  v_expression text;
  v_set text := '';
  v_key text;
  v_operator text;
  v_connector text;
  v_mode text;
  v_value text;
  v_values text;
  v_sort_field text;
  v_sort_direction text;
  v_result jsonb;
  v_count bigint;
  v_index integer := 0;
  v_row_count bigint := 0;
  v_item jsonb;
begin
  case p_model
    when 'user' then v_table := 'better_auth."user"'; v_type := 'better_auth."user"';
    when 'session' then v_table := 'better_auth.session'; v_type := 'better_auth.session';
    when 'account' then v_table := 'better_auth.account'; v_type := 'better_auth.account';
    when 'verification' then v_table := 'better_auth.verification'; v_type := 'better_auth.verification';
    when 'rate_limit' then v_table := 'better_auth.rate_limit'; v_type := 'better_auth.rate_limit';
    else raise exception 'unsupported Better Auth model';
  end case;

  p_where := coalesce(p_where, '[]'::jsonb);

  for v_item in select value from jsonb_array_elements(p_where) loop
    v_key := v_item->>'field';
    v_operator := coalesce(v_item->>'operator', 'eq');
    v_connector := case when v_index = 0 then '' else coalesce(v_item->>'connector', 'AND') end;
    v_mode := coalesce(v_item->>'mode', 'sensitive');

    if v_key is null or v_key !~ '^[A-Za-z_][A-Za-z0-9_]*$' then raise exception 'invalid Better Auth field'; end if;
    if not exists (
      select 1
      from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
      where n.nspname='better_auth'
        and c.relname = case p_model when 'user' then 'user' when 'session' then 'session' when 'account' then 'account' when 'verification' then 'verification' when 'rate_limit' then 'rate_limit' end
        and a.attname=v_key and a.attnum>0 and not a.attisdropped
    ) then raise exception 'invalid Better Auth field for model'; end if;

    if (v_item->'value') is null or (v_item->'value')::text='null' then
      v_expression := format('t.%I is %s', v_key, case when v_operator='ne' then 'not null' else 'null' end);
    elsif v_operator in ('in','not_in') then
      if jsonb_typeof(v_item->'value') <> 'array' then raise exception 'Better Auth IN operator requires an array'; end if;
      select string_agg(quote_literal(value), ',') into v_values from jsonb_array_elements_text(v_item->'value');
      if v_mode='insensitive' then
        v_expression := format('lower(t.%I::text) %s (select lower(x) from unnest(array[%s]) as x)', v_key, case when v_operator='in' then 'in' else 'not in' end, v_values);
      else
        v_expression := format('t.%I %s (%s)', v_key, case when v_operator='in' then 'in' else 'not in' end, v_values);
      end if;
    else
      v_value := v_item->>'value';
      case v_operator
        when 'eq' then v_expression := case when v_mode='insensitive' then format('lower(t.%I::text)=lower(%L)',v_key,v_value) else format('t.%I=%L',v_key,v_value) end;
        when 'ne' then v_expression := case when v_mode='insensitive' then format('lower(t.%I::text)<>lower(%L)',v_key,v_value) else format('t.%I<>%L',v_key,v_value) end;
        when 'gt' then v_expression := format('t.%I>%L',v_key,v_value);
        when 'gte' then v_expression := format('t.%I>=%L',v_key,v_value);
        when 'lt' then v_expression := format('t.%I<%L',v_key,v_value);
        when 'lte' then v_expression := format('t.%I<=%L',v_key,v_value);
        when 'contains' then v_expression := format('t.%I::text %s %L',v_key,case when v_mode='insensitive' then 'ilike' else 'like' end,'%'||v_value||'%');
        when 'starts_with' then v_expression := format('t.%I::text %s %L',v_key,case when v_mode='insensitive' then 'ilike' else 'like' end,v_value||'%');
        when 'ends_with' then v_expression := format('t.%I::text %s %L',v_key,case when v_mode='insensitive' then 'ilike' else 'like' end,'%'||v_value);
        else raise exception 'unsupported Better Auth where operator';
      end case;
    end if;

    if v_index=0 then v_where := '('||v_expression||')';
    elsif upper(v_connector)='OR' then v_where := '('||v_where||' or ('||v_expression||'))';
    else v_where := '('||v_where||') and ('||v_expression||')'; end if;
    v_index := v_index+1;
  end loop;

  case p_operation
    when 'create' then
      v_sql:=format('insert into %s as t select * from jsonb_populate_record(null::%s,$1) returning to_jsonb(t)',v_table,v_type);
      execute v_sql into v_result using p_data; return v_result;

    when 'find_one' then
      v_sql:=format('select to_jsonb(t) from %s as t where %s limit 1',v_table,v_where);
      execute v_sql into v_result; return v_result;

    when 'find_many' then
      v_sql:=format('select coalesce(jsonb_agg(to_jsonb(q)),''[]''::jsonb) from (select t.* from %s as t where %s',v_table,v_where);
      if p_sort is not null and p_sort<>'null'::jsonb then
        v_sort_field:=p_sort->>'field'; v_sort_direction:=lower(coalesce(p_sort->>'direction','asc'));
        if v_sort_field is not null and v_sort_field~'^[A-Za-z_][A-Za-z0-9_]*$' then
          if not exists (select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='better_auth' and c.relname=case p_model when 'user' then 'user' when 'session' then 'session' when 'account' then 'account' when 'verification' then 'verification' when 'rate_limit' then 'rate_limit' end and a.attname=v_sort_field and a.attnum>0 and not a.attisdropped) then raise exception 'invalid Better Auth sort field'; end if;
          if v_sort_direction not in ('asc','desc') then raise exception 'invalid Better Auth sort direction'; end if;
          v_sql:=v_sql||format(' order by t.%I %s',v_sort_field,v_sort_direction);
        end if;
      end if;
      if p_limit is not null then v_sql:=v_sql||format(' limit %s',greatest(p_limit,0)); end if;
      v_sql:=v_sql||format(' offset %s) q',greatest(coalesce(p_offset,0),0)); execute v_sql into v_result; return v_result;

    when 'count' then
      v_sql:=format('select count(*) from %s as t where %s',v_table,v_where); execute v_sql into v_count; return to_jsonb(v_count);

    when 'update' then
      if p_data='{}'::jsonb then raise exception 'Better Auth update requires data'; end if;
      for v_key in select key from jsonb_object_keys(p_data) as key loop
        if v_key!~'^[A-Za-z_][A-Za-z0-9_]*$' then raise exception 'invalid Better Auth update field'; end if;
        if not exists (select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='better_auth' and c.relname=case p_model when 'user' then 'user' when 'session' then 'session' when 'account' then 'account' when 'verification' then 'verification' when 'rate_limit' then 'rate_limit' end and a.attname=v_key and a.attnum>0 and not a.attisdropped) then raise exception 'invalid Better Auth update field'; end if;
        v_set:=v_set||case when v_set='' then '' else ', ' end||format('%I=s.%I',v_key,v_key);
      end loop;
      v_sql:=format('with target as (select t.ctid from %s as t where %s limit 1) update %s as t set %s from target, jsonb_populate_record(null::%s,$1) as s where t.ctid=target.ctid and %s returning to_jsonb(t)',v_table,v_where,v_table,v_set,v_type,v_where);
      execute v_sql into v_result using p_data; return v_result;

    when 'update_many' then
      if p_data='{}'::jsonb then return to_jsonb(0::bigint); end if;
      for v_key in select key from jsonb_object_keys(p_data) as key loop
        if v_key!~'^[A-Za-z_][A-Za-z0-9_]*$' then raise exception 'invalid Better Auth update field'; end if;
        if not exists (select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='better_auth' and c.relname=case p_model when 'user' then 'user' when 'session' then 'session' when 'account' then 'account' when 'verification' then 'verification' when 'rate_limit' then 'rate_limit' end and a.attname=v_key and a.attnum>0 and not a.attisdropped) then raise exception 'invalid Better Auth update field'; end if;
        v_set:=v_set||case when v_set='' then '' else ', ' end||format('%I=s.%I',v_key,v_key);
      end loop;
      v_sql:=format('update %s as t set %s from jsonb_populate_record(null::%s,$1) as s where %s',v_table,v_set,v_type,v_where); execute v_sql using p_data; get diagnostics v_row_count=row_count; return to_jsonb(v_row_count);

    when 'delete' then
      v_sql:=format('with target as (select t.ctid from %s as t where %s limit 1) delete from %s as t using target where t.ctid=target.ctid and %s returning to_jsonb(t)',v_table,v_where,v_table,v_where);
      execute v_sql into v_result; return v_result;

    when 'delete_many' then
      v_sql:=format('delete from %s as t where %s',v_table,v_where); execute v_sql; get diagnostics v_row_count=row_count; return to_jsonb(v_row_count);

    when 'consume_one' then
      v_sql:=format('with target as (select t.ctid from %s as t where %s limit 1) delete from %s as t using target where t.ctid=target.ctid and %s returning to_jsonb(t)',v_table,v_where,v_table,v_where);
      execute v_sql into v_result; return v_result;

    when 'increment_one' then
      for v_key in select key from jsonb_object_keys(p_increment) as key loop
        if v_key!~'^[A-Za-z_][A-Za-z0-9_]*$' then raise exception 'invalid Better Auth increment field'; end if;
        if jsonb_typeof(p_increment->v_key) <> 'number' then raise exception 'Better Auth increment values must be numeric'; end if;
        if not exists (select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='better_auth' and c.relname=case p_model when 'user' then 'user' when 'session' then 'session' when 'account' then 'account' when 'verification' then 'verification' when 'rate_limit' then 'rate_limit' end and a.attname=v_key and a.attnum>0 and not a.attisdropped) then raise exception 'invalid Better Auth increment field'; end if;
        v_set:=v_set||case when v_set='' then '' else ', ' end||format('%I=coalesce(t.%I,0)+%L',v_key,v_key,p_increment->>v_key);
      end loop;
      for v_key in select key from jsonb_object_keys(p_set) as key loop
        if v_key!~'^[A-Za-z_][A-Za-z0-9_]*$' then raise exception 'invalid Better Auth set field'; end if;
        if not exists (select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='better_auth' and c.relname=case p_model when 'user' then 'user' when 'session' then 'session' when 'account' then 'account' when 'verification' then 'verification' when 'rate_limit' then 'rate_limit' end and a.attname=v_key and a.attnum>0 and not a.attisdropped) then raise exception 'invalid Better Auth set field'; end if;
        v_set:=v_set||case when v_set='' then '' else ', ' end||format('%I=s.%I',v_key,v_key);
      end loop;
      if v_set='' then
        v_sql:=format('select to_jsonb(t) from %s as t where %s limit 1',v_table,v_where);
      else
        v_sql:=format('with target as (select t.ctid from %s as t where %s limit 1) update %s as t set %s from target, jsonb_populate_record(null::%s,$1) as s where t.ctid=target.ctid and %s returning to_jsonb(t)',v_table,v_where,v_table,v_set,v_type,v_where);
      end if;
      execute v_sql into v_result using p_set; return v_result;

    else raise exception 'unsupported Better Auth adapter operation';
  end case;
end;
$$;

revoke all on function public.solmint_better_auth_adapter(text,text,jsonb,jsonb,integer,integer,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.solmint_better_auth_adapter(text,text,jsonb,jsonb,integer,integer,jsonb,jsonb,jsonb) to service_role;
