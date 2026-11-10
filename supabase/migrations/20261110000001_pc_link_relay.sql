-- Optional v3 ciphertext relay. No service is activated by adding this migration.
-- Only the Edge Function's service role may mutate these tables or execute RPCs.
create table public.pc_link_devices (
  user_id uuid not null references auth.users(id) on delete cascade,
  pair_id text not null check (pair_id ~ '^[A-Za-z0-9._:-]{1,160}$'),
  token_hash text unique check (token_hash is null or token_hash ~ '^[a-f0-9]{64}$'),
  phone_token_hash text unique check (phone_token_hash is null or phone_token_hash ~ '^[a-f0-9]{64}$'),
  phone_expires_at timestamptz,
  revoked boolean not null default false,
  phone_seq bigint not null default 0 check (phone_seq between 0 and 9007199254740991),
  pc_seq bigint not null default 0 check (pc_seq between 0 and 9007199254740991),
  created_at timestamptz not null default clock_timestamp(),
  primary key (user_id, pair_id)
);

create function public.pc_link_valid_envelope(e jsonb, p text, d text, s bigint)
returns boolean language plpgsql immutable set search_path = public, pg_temp as $$
begin
  return jsonb_typeof(e) = 'object' and (select count(*) from jsonb_object_keys(e)) = 8
    and e ?& array['v','kind','pair','from','seq','sentAt','nonce','ct']
    and e->'v' = '3'::jsonb and e->>'kind' = 'anker-link'
    and jsonb_typeof(e->'pair') = 'string' and e->>'pair' = p
    and jsonb_typeof(e->'from') = 'string' and e->>'from' = d
    and d in ('phone','pc') and jsonb_typeof(e->'seq') = 'number'
    and (e->>'seq') ~ '^[1-9][0-9]{0,15}$'
    and (e->>'seq')::bigint = s and s between 1 and 9007199254740991
    and jsonb_typeof(e->'sentAt') = 'string'
    and (e->>'sentAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,3})?(Z|[+-][0-9]{2}:[0-9]{2})$'
    and jsonb_typeof(e->'nonce') = 'string' and (e->>'nonce') ~ '^[A-Za-z0-9_-]{16}$'
    and jsonb_typeof(e->'ct') = 'string' and (e->>'ct') ~ '^[A-Za-z0-9_-]{22,87382}$'
    and length(e->>'ct') % 4 <> 1 and octet_length(e::text) <= 65536;
exception when others then return false;
end $$;

create table public.pc_link_mailbox (
  user_id uuid not null,
  pair_id text not null,
  direction text not null check (direction in ('phone','pc')),
  seq bigint not null check (seq between 1 and 9007199254740991),
  envelope jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  primary key (user_id, pair_id, direction, seq),
  foreign key (user_id, pair_id) references public.pc_link_devices(user_id, pair_id) on delete cascade,
  check (expires_at > created_at and expires_at <= created_at + interval '14 days'),
  check (public.pc_link_valid_envelope(envelope, pair_id, direction, seq))
);
create index pc_link_mailbox_expiry on public.pc_link_mailbox(expires_at);
alter table public.pc_link_devices enable row level security;
alter table public.pc_link_mailbox enable row level security;
revoke all on public.pc_link_devices, public.pc_link_mailbox from public, anon, authenticated;
grant select (user_id, pair_id, revoked, created_at) on public.pc_link_devices to authenticated;
grant select on public.pc_link_mailbox to authenticated;
grant all on public.pc_link_devices, public.pc_link_mailbox to service_role;
create policy pc_link_device_owner_read on public.pc_link_devices for select to authenticated
  using (auth.uid() = user_id);
create policy pc_link_mailbox_owner_read on public.pc_link_mailbox for select to authenticated
  using (auth.uid() = user_id and expires_at > clock_timestamp()
    and exists (select 1 from public.pc_link_devices d
      where d.user_id = pc_link_mailbox.user_id and d.pair_id = pc_link_mailbox.pair_id and not d.revoked));

create function public.pc_link_relay_cleanup() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare n integer;
begin
  delete from public.pc_link_mailbox where expires_at <= clock_timestamp()
    or created_at < clock_timestamp() - interval '14 days';
  get diagnostics n = row_count;
  return n;
end $$;

create function public.pc_link_relay_provision(p_owner uuid, p_pair text, p_hash text, p_phone_hash text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_owner is null or p_pair !~ '^[A-Za-z0-9._:-]{1,160}$' or p_hash !~ '^[a-f0-9]{64}$'
    or p_phone_hash !~ '^[a-f0-9]{64}$' or p_hash=p_phone_hash then
    return jsonb_build_object('ok',false,'error','invalid');
  end if;
  insert into public.pc_link_devices as d(user_id,pair_id,token_hash,phone_token_hash,phone_expires_at)
    values(p_owner,p_pair,p_hash,p_phone_hash,clock_timestamp()+interval '14 days')
    on conflict(user_id,pair_id) do update set token_hash=excluded.token_hash,
      phone_token_hash=excluded.phone_token_hash,phone_expires_at=excluded.phone_expires_at,revoked=false;
  -- Rotation invalidates the previous token and removes its queued ciphertext.
  delete from public.pc_link_mailbox where user_id=p_owner and pair_id=p_pair;
  perform public.pc_link_relay_cleanup();
  return jsonb_build_object('ok',true,'phoneExpiresAt',
    to_char((select phone_expires_at from public.pc_link_devices where user_id=p_owner and pair_id=p_pair) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
end $$;

create function public.pc_link_relay_renew_phone(p_owner uuid,p_pair text,p_phone_hash text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare expiry timestamptz;
begin
  if p_phone_hash !~ '^[a-f0-9]{64}$' then return jsonb_build_object('ok',false,'error','invalid'); end if;
  update public.pc_link_devices set phone_token_hash=p_phone_hash,phone_expires_at=clock_timestamp()+interval '14 days'
    where user_id=p_owner and pair_id=p_pair and not revoked and token_hash is not null returning phone_expires_at into expiry;
  if not found then return jsonb_build_object('ok',false,'error','unauthorized'); end if;
  return jsonb_build_object('ok',true,'phoneExpiresAt',to_char(expiry at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
end $$;

create function public.pc_link_relay_lookup(p_hash text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare d public.pc_link_devices%rowtype;
begin
  if p_hash !~ '^[a-f0-9]{64}$' then return null; end if;
  select * into d from public.pc_link_devices where not revoked and
    (token_hash=p_hash or (phone_token_hash=p_hash and phone_expires_at>clock_timestamp()));
  if not found then return null; end if;
  return jsonb_build_object('owner',d.user_id,'pair',d.pair_id,'role',case when d.token_hash=p_hash then 'pc' else 'phone' end);
end $$;

create function public.pc_link_relay_revoke(p_owner uuid, p_pair text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- UPDATE obtains the same row lock as put/get, closing the revoke race.
  update public.pc_link_devices set revoked=true,token_hash=null,phone_token_hash=null,phone_expires_at=null where user_id=p_owner and pair_id=p_pair;
  delete from public.pc_link_mailbox where user_id=p_owner and pair_id=p_pair;
  perform public.pc_link_relay_cleanup();
  return jsonb_build_object('ok',true);
end $$;

create function public.pc_link_relay_put(p_owner uuid, p_pair text, p_hash text,
  p_direction text, p_seq bigint, p_envelope jsonb, p_expires timestamptz)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare device public.pc_link_devices%rowtype; prior jsonb; current_seq bigint; at_time timestamptz := clock_timestamp(); sent timestamptz;
begin
  select * into device from public.pc_link_devices where user_id=p_owner and pair_id=p_pair for update;
  if not found or device.revoked
    or (p_hash is not null and not coalesce((device.token_hash=p_hash and p_direction='pc')
      or (device.phone_token_hash=p_hash and p_direction='phone' and device.phone_expires_at>at_time),false))
    or (p_hash is null and p_direction <> 'phone') then
    return jsonb_build_object('ok',false,'error','unauthorized');
  end if;
  if not public.pc_link_valid_envelope(p_envelope,p_pair,p_direction,p_seq) then
    return jsonb_build_object('ok',false,'error','invalid');
  end if;
  begin sent := (p_envelope->>'sentAt')::timestamptz;
  exception when others then return jsonb_build_object('ok',false,'error','invalid'); end;
  if sent > at_time + interval '2 minutes' or sent < at_time - interval '14 days'
    or p_expires <= at_time or p_expires > at_time + interval '14 days'
    or p_expires > sent + interval '14 days' then
    return jsonb_build_object('ok',false,'error','expired');
  end if;
  perform public.pc_link_relay_cleanup();
  select envelope into prior from public.pc_link_mailbox
    where user_id=p_owner and pair_id=p_pair and direction=p_direction and seq=p_seq;
  if found then
    return jsonb_build_object('ok', prior = p_envelope, 'error', case when prior=p_envelope then null else 'conflict' end);
  end if;
  current_seq := case when p_direction='phone' then device.phone_seq else device.pc_seq end;
  if p_seq <= current_seq then return jsonb_build_object('ok',false,'error','replay'); end if;
  if (select count(*) from public.pc_link_mailbox where user_id=p_owner and pair_id=p_pair and direction=p_direction) >= 512 then
    return jsonb_build_object('ok',false,'error','full');
  end if;
  insert into public.pc_link_mailbox(user_id,pair_id,direction,seq,envelope,expires_at)
    values(p_owner,p_pair,p_direction,p_seq,p_envelope,p_expires);
  update public.pc_link_devices set phone_seq=case when p_direction='phone' then p_seq else phone_seq end,
    pc_seq=case when p_direction='pc' then p_seq else pc_seq end where user_id=p_owner and pair_id=p_pair;
  return jsonb_build_object('ok',true);
end $$;

create function public.pc_link_relay_get(p_owner uuid, p_pair text, p_hash text, p_after bigint)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare device public.pc_link_devices%rowtype; rows jsonb;
begin
  select * into device from public.pc_link_devices where user_id=p_owner and pair_id=p_pair for update;
  if not found or device.revoked or (p_hash is not null and not coalesce(device.token_hash=p_hash
    or (device.phone_token_hash=p_hash and device.phone_expires_at>clock_timestamp()),false)) then
    return jsonb_build_object('ok',false,'error','unauthorized');
  end if;
  if p_after is null or p_after not between 0 and 9007199254740991 then
    return jsonb_build_object('ok',false,'error','invalid');
  end if;
  perform public.pc_link_relay_cleanup();
  select coalesce(jsonb_agg(t.envelope order by t.seq),'[]'::jsonb) into rows from (
    select envelope,seq from public.pc_link_mailbox where user_id=p_owner and pair_id=p_pair
      and direction=case when p_hash is null or device.phone_token_hash=p_hash then 'pc' else 'phone' end
      and seq>p_after and expires_at>clock_timestamp() order by seq limit 8
  ) t;
  return jsonb_build_object('ok',true,'envelopes',rows);
end $$;

revoke all on function public.pc_link_valid_envelope(jsonb,text,text,bigint) from public,anon,authenticated;
grant execute on function public.pc_link_valid_envelope(jsonb,text,text,bigint) to service_role;
revoke all on function public.pc_link_relay_cleanup() from public,anon,authenticated;
revoke all on function public.pc_link_relay_provision(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.pc_link_relay_renew_phone(uuid,text,text) from public,anon,authenticated;
revoke all on function public.pc_link_relay_lookup(text) from public,anon,authenticated;
revoke all on function public.pc_link_relay_revoke(uuid,text) from public,anon,authenticated;
revoke all on function public.pc_link_relay_put(uuid,text,text,text,bigint,jsonb,timestamptz) from public,anon,authenticated;
revoke all on function public.pc_link_relay_get(uuid,text,text,bigint) from public,anon,authenticated;
grant execute on function public.pc_link_relay_cleanup() to service_role;
grant execute on function public.pc_link_relay_provision(uuid,text,text,text) to service_role;
grant execute on function public.pc_link_relay_renew_phone(uuid,text,text) to service_role;
grant execute on function public.pc_link_relay_lookup(text) to service_role;
grant execute on function public.pc_link_relay_revoke(uuid,text) to service_role;
grant execute on function public.pc_link_relay_put(uuid,text,text,text,bigint,jsonb,timestamptz) to service_role;
grant execute on function public.pc_link_relay_get(uuid,text,text,bigint) to service_role;

-- If the operator already enabled pg_cron, install one hourly cleanup job.
-- No extension, account, deployment or paid plan is created here.
do $$
begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    execute 'select cron.schedule(''anker-pc-link-expiry'', ''17 * * * *'', ''select public.pc_link_relay_cleanup();'')';
  end if;
end $$;
