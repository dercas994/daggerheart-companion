-- =====================================================================
--  Daggerheart Companion — schema Supabase
--  Esegui tutto questo file nel SQL Editor del tuo progetto Supabase.
--  È idempotente: puoi rilanciarlo senza perdere dati.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
--  Tabelle
-- ---------------------------------------------------------------------

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Avventuriero',
  created_at   timestamptz not null default now()
);

create table if not exists public.campaigns (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  gm_id       uuid not null references public.profiles(id) on delete cascade,
  invite_code text not null unique,
  fear        int  not null default 0 check (fear between 0 and 12),
  created_at  timestamptz not null default now()
);

create table if not exists public.campaign_members (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        text not null check (role in ('gm','player')),
  joined_at   timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

create table if not exists public.characters (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.campaigns(id) on delete cascade,
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 60),
  level         int  not null default 1  check (level between 1 and 10),
  hp_max        int  not null default 6  check (hp_max between 1 and 12),
  hp_marked     int  not null default 0  check (hp_marked >= 0),
  stress_max    int  not null default 6  check (stress_max between 1 and 12),
  stress_marked int  not null default 0  check (stress_marked >= 0),
  hope          int  not null default 2  check (hope between 0 and 6),
  armor_max     int  not null default 0  check (armor_max between 0 and 12),
  armor_marked  int  not null default 0  check (armor_marked >= 0),
  data          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists characters_campaign_idx on public.characters(campaign_id);

create table if not exists public.rolls (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.campaigns(id) on delete cascade,
  character_id uuid references public.characters(id) on delete set null,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  roller_name  text not null default '',
  label        text not null default '',
  hope_die     int  not null,
  fear_die     int  not null,
  adv_die      int  not null default 0,   -- positivo = vantaggio, negativo = svantaggio
  modifier     int  not null default 0,
  total        int  not null,
  outcome      text not null check (outcome in ('hope','fear','crit')),
  created_at   timestamptz not null default now()
);
create index if not exists rolls_campaign_idx on public.rolls(campaign_id, created_at desc);

-- ---------------------------------------------------------------------
--  Helper (security definer per evitare ricorsione nelle policy)
-- ---------------------------------------------------------------------

create or replace function public.is_member(p_campaign uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from campaign_members
                 where campaign_id = p_campaign and user_id = auth.uid());
$$;

create or replace function public.is_gm(p_campaign uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from campaigns
                 where id = p_campaign and gm_id = auth.uid());
$$;

-- profilo automatico alla registrazione
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'display_name',''),
                           split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at + clamp dei contatori
create or replace function public.characters_before_write()
returns trigger language plpgsql as $$
begin
  new.updated_at    := now();
  new.hp_marked     := least(greatest(new.hp_marked, 0), new.hp_max);
  new.stress_marked := least(greatest(new.stress_marked, 0), new.stress_max);
  new.armor_marked  := least(greatest(new.armor_marked, 0), new.armor_max);
  new.hope          := least(greatest(new.hope, 0), 6);
  return new;
end $$;

drop trigger if exists characters_bw on public.characters;
create trigger characters_bw before insert or update on public.characters
  for each row execute function public.characters_before_write();

-- ---------------------------------------------------------------------
--  RPC
-- ---------------------------------------------------------------------

-- Crea una campagna con codice invito e inserisce il master tra i membri
create or replace function public.create_campaign(p_name text, p_description text default '')
returns public.campaigns language plpgsql security definer set search_path = public as $$
declare
  c campaigns;
  code text;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
begin
  if auth.uid() is null then raise exception 'Devi essere autenticato'; end if;
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    code := substr(code,1,3) || '-' || substr(code,4,3);
    exit when not exists (select 1 from campaigns where invite_code = code);
  end loop;
  insert into campaigns (name, description, gm_id, invite_code)
  values (p_name, coalesce(p_description,''), auth.uid(), code)
  returning * into c;
  insert into campaign_members (campaign_id, user_id, role) values (c.id, auth.uid(), 'gm');
  return c;
end $$;

-- Entra in una campagna con il codice invito
create or replace function public.join_campaign(p_code text)
returns public.campaigns language plpgsql security definer set search_path = public as $$
declare c campaigns;
begin
  if auth.uid() is null then raise exception 'Devi essere autenticato'; end if;
  select * into c from campaigns where invite_code = upper(trim(p_code));
  if not found then raise exception 'Nessuna campagna con questo codice'; end if;
  insert into campaign_members (campaign_id, user_id, role)
  values (c.id, auth.uid(), 'player')
  on conflict do nothing;
  return c;
end $$;

-- Tiro di Dualità: i dadi si tirano sul server (niente trucchi),
-- poi si aggiornano Speranza del PG o Paura del master.
create or replace function public.roll_duality(
  p_campaign  uuid,
  p_character uuid,
  p_modifier  int  default 0,
  p_label     text default '',
  p_advantage int  default 0      -- 1 vantaggio, -1 svantaggio, 0 nessuno
) returns public.rolls language plpgsql security definer set search_path = public as $$
declare
  ch characters;
  r rolls;
  h int := 1 + floor(random() * 12)::int;
  f int := 1 + floor(random() * 12)::int;
  a int := 0;
  res text;
  who text;
begin
  if not is_member(p_campaign) then raise exception 'Non fai parte di questa campagna'; end if;

  if p_character is not null then
    select * into ch from characters where id = p_character and campaign_id = p_campaign;
    if not found then raise exception 'Personaggio non trovato'; end if;
    if ch.owner_id <> auth.uid() and not is_gm(p_campaign) then
      raise exception 'Non puoi tirare per questo personaggio';
    end if;
    who := ch.name;
  else
    select display_name into who from profiles where id = auth.uid();
  end if;

  if p_advantage > 0 then a := 1 + floor(random() * 6)::int;
  elsif p_advantage < 0 then a := -(1 + floor(random() * 6)::int);
  end if;

  if h = f then res := 'crit';
  elsif h > f then res := 'hope';
  else res := 'fear';
  end if;

  insert into rolls (campaign_id, character_id, user_id, roller_name, label,
                     hope_die, fear_die, adv_die, modifier, total, outcome)
  values (p_campaign, p_character, auth.uid(), coalesce(who,''), coalesce(p_label,''),
          h, f, a, coalesce(p_modifier,0), h + f + a + coalesce(p_modifier,0), res)
  returning * into r;

  if res = 'fear' then
    update campaigns set fear = least(fear + 1, 12) where id = p_campaign;
  elsif p_character is not null then
    update characters
       set hope = least(hope + 1, 6),
           stress_marked = case when res = 'crit' then greatest(stress_marked - 1, 0)
                                else stress_marked end
     where id = p_character;
  end if;

  return r;
end $$;

-- I progetti Supabase recenti non danno più permessi automatici sulle nuove tabelle:
-- li concedo esplicitamente al ruolo degli utenti loggati (poi decide la RLS).
grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, update, delete on public.campaigns to authenticated;
grant select, delete on public.campaign_members to authenticated;
grant select, insert, update, delete on public.characters to authenticated;
grant select on public.rolls to authenticated;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.is_gm(uuid) to authenticated;

grant execute on function public.create_campaign(text, text) to authenticated;
grant execute on function public.join_campaign(text) to authenticated;
grant execute on function public.roll_duality(uuid, uuid, int, text, int) to authenticated;

-- ---------------------------------------------------------------------
--  Row Level Security
-- ---------------------------------------------------------------------

alter table public.profiles         enable row level security;
alter table public.campaigns        enable row level security;
alter table public.campaign_members enable row level security;
alter table public.characters       enable row level security;
alter table public.rolls            enable row level security;

drop policy if exists "profiles read"   on public.profiles;
drop policy if exists "profiles update" on public.profiles;
create policy "profiles read"   on public.profiles for select to authenticated using (true);
create policy "profiles update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "campaigns read"   on public.campaigns;
drop policy if exists "campaigns update" on public.campaigns;
drop policy if exists "campaigns delete" on public.campaigns;
create policy "campaigns read"   on public.campaigns for select to authenticated using (is_member(id));
create policy "campaigns update" on public.campaigns for update to authenticated
  using (gm_id = auth.uid()) with check (gm_id = auth.uid());
create policy "campaigns delete" on public.campaigns for delete to authenticated using (gm_id = auth.uid());

drop policy if exists "members read"  on public.campaign_members;
drop policy if exists "members leave" on public.campaign_members;
create policy "members read"  on public.campaign_members for select to authenticated using (is_member(campaign_id));
create policy "members leave" on public.campaign_members for delete to authenticated
  using ((user_id = auth.uid() and role = 'player') or is_gm(campaign_id));

drop policy if exists "characters read"   on public.characters;
drop policy if exists "characters insert" on public.characters;
drop policy if exists "characters update" on public.characters;
drop policy if exists "characters delete" on public.characters;
create policy "characters read"   on public.characters for select to authenticated using (is_member(campaign_id));
create policy "characters insert" on public.characters for insert to authenticated
  with check (owner_id = auth.uid() and is_member(campaign_id));
create policy "characters update" on public.characters for update to authenticated
  using (owner_id = auth.uid() or is_gm(campaign_id))
  with check (is_member(campaign_id));
create policy "characters delete" on public.characters for delete to authenticated
  using (owner_id = auth.uid() or is_gm(campaign_id));

drop policy if exists "rolls read" on public.rolls;
create policy "rolls read" on public.rolls for select to authenticated using (is_member(campaign_id));
-- nessuna policy di insert: i tiri passano solo da roll_duality()

-- ---------------------------------------------------------------------
--  Realtime
-- ---------------------------------------------------------------------
alter table public.characters replica identity full;
alter table public.campaigns  replica identity full;

do $$
declare t text;
begin
  foreach t in array array['characters','campaigns','rolls','campaign_members'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
