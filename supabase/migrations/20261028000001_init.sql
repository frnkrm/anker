-- Anker: Sync-Tabelle (ein Datensatz pro App-Eintrag), PC-Stopp, Tokens.
-- Jeder Nutzer sieht ausschließlich seine eigenen Daten (Row Level Security).

-- ---------- Sync ----------
create table if not exists public.records (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  collection text not null check (collection in ('settings', 'days', 'inbox', 'game', 'reviews')),
  id text not null,
  data jsonb,
  updated_at bigint not null,             -- Client-Zeitstempel (ms), entscheidet last-write-wins
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),  -- Cursor für "seit dem letzten Abruf"
  primary key (user_id, collection, id)
);

create index if not exists records_user_cursor on public.records (user_id, server_updated_at);

alter table public.records enable row level security;

create policy "records: nur eigene lesen" on public.records
  for select using (auth.uid() = user_id);
create policy "records: nur eigene anlegen" on public.records
  for insert with check (auth.uid() = user_id);
create policy "records: nur eigene ändern" on public.records
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "records: nur eigene löschen" on public.records
  for delete using (auth.uid() = user_id);

create or replace function public.touch_server_updated_at() returns trigger
language plpgsql as $$
begin
  new.server_updated_at := now();
  return new;
end $$;

drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
  for each row execute function public.touch_server_updated_at();

-- Upsert mit last-write-wins: ältere Stände überschreiben nie neuere.
-- security invoker: läuft mit den Rechten des Aufrufers, RLS greift.
create or replace function public.upsert_records(recs jsonb) returns integer
language plpgsql security invoker set search_path = public as $$
declare
  n integer;
begin
  insert into public.records as r (user_id, collection, id, data, updated_at, deleted)
  select auth.uid(), x.collection, x.id, x.data, x.updated_at, coalesce(x.deleted, false)
  from jsonb_to_recordset(recs) as x(collection text, id text, data jsonb, updated_at bigint, deleted boolean)
  on conflict (user_id, collection, id) do update
    set data = excluded.data, updated_at = excluded.updated_at, deleted = excluded.deleted
    where r.updated_at < excluded.updated_at;
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on function public.upsert_records(jsonb) to authenticated;

-- ---------- PC-Stopp ----------
-- Nur die PC-Stopp-Zeiten für heute und morgen. Die Edge Function liest ausschließlich diese Tabelle.
create table if not exists public.pc_stop (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  entries jsonb not null default '[]'::jsonb,   -- [{date, stopAt (ISO), localTime "HH:MM", extended}]
  updated_at timestamptz not null default now()
);

alter table public.pc_stop enable row level security;

create policy "pc_stop: nur eigene" on public.pc_stop
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Persönliche Tokens für den PC. Gespeichert wird nur der SHA-256-Hash.
create table if not exists public.pc_stop_tokens (
  token_hash text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.pc_stop_tokens enable row level security;

create policy "pc_stop_tokens: eigene anlegen" on public.pc_stop_tokens
  for insert with check (auth.uid() = user_id);
create policy "pc_stop_tokens: eigene sehen" on public.pc_stop_tokens
  for select using (auth.uid() = user_id);
create policy "pc_stop_tokens: eigene löschen" on public.pc_stop_tokens
  for delete using (auth.uid() = user_id);
