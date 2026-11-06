-- Optionaler Vorschlagsdienst: atomare Tagesgrenzen pro Konto, ohne Aufgaben-/Adress-/Promptprotokoll.
-- Erst bei bewusst eingerichteter Serververbindung erforderlich; Appbuild führt keine Migration aus.
create table if not exists public.assistant_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  budget_date date not null,
  kind text not null check (kind in ('steps', 'route')),
  used integer not null check (used > 0 and used <= 8),
  primary key (user_id, budget_date, kind)
);
alter table public.assistant_usage enable row level security;
create policy "assistant_usage: eigene Zähler lesen" on public.assistant_usage
  for select using (auth.uid() = user_id);

create or replace function public.claim_assistant_request(request_kind text) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := auth.uid();
  current_day date := (now() at time zone 'Europe/Berlin')::date;
  day_limit integer;
  accepted integer;
begin
  if actor is null or request_kind is null or request_kind not in ('steps', 'route') then return false; end if;
  day_limit := case when request_kind = 'steps' then 8 else 6 end;
  -- Nur technische Kostenbegrenzung,14 Tage Aufbewahrung, keine Nutzungs-/Symptomanalyse.
  delete from public.assistant_usage where user_id = actor and budget_date <= current_day - 14;
  insert into public.assistant_usage as usage(user_id, budget_date, kind, used)
    values (actor, current_day, request_kind, 1)
    on conflict (user_id, budget_date, kind) do update set used = usage.used + 1
      where usage.used < day_limit
    returning used into accepted;
  return accepted is not null;
end $$;
revoke all on function public.claim_assistant_request(text) from public, anon;
grant execute on function public.claim_assistant_request(text) to authenticated;
