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
  hope          int  not null default 2  check (hope between 0 and 12),
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
alter table public.rolls add column if not exists manual boolean not null default false;
-- effetti realmente applicati dal tiro (servono per annullarlo)
alter table public.rolls add column if not exists hope_gain int;
alter table public.rolls add column if not exists stress_cleared int;
alter table public.rolls add column if not exists fear_gain int;
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
  new.hope          := least(greatest(new.hope, 0), coalesce((new.data->>'hope_max')::int, 6));
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

-- Tiro di Dualità. Di norma i dadi si tirano sul server (niente trucchi);
-- con p_hope/p_fear il giocatore registra il risultato di dadi fisici.
-- Poi si aggiornano Speranza del PG o Paura del master.
drop function if exists public.roll_duality(uuid, uuid, int, text, int);
create or replace function public.roll_duality(
  p_campaign  uuid,
  p_character uuid,
  p_modifier  int  default 0,
  p_label     text default '',
  p_advantage int  default 0,      -- 1 vantaggio, -1 svantaggio, 0 nessuno
  p_hope      int  default null,   -- dadi fisici: valori inseriti a mano
  p_fear      int  default null,
  p_adv       int  default null    -- valore del d6 (sempre positivo)
) returns public.rolls language plpgsql security definer set search_path = public as $$
declare
  ch characters;
  r rolls;
  manual boolean := p_hope is not null or p_fear is not null;
  h int;
  f int;
  a int := 0;
  res text;
  who text;
  fb int;
  nh int;
  ns int;
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

  if manual then
    if p_hope is null or p_fear is null or p_hope not between 1 and 12 or p_fear not between 1 and 12 then
      raise exception 'I dadi di Speranza e Paura vanno da 1 a 12';
    end if;
    if p_advantage <> 0 and (p_adv is null or p_adv not between 1 and 6) then
      raise exception 'Il dado di vantaggio va da 1 a 6';
    end if;
    h := p_hope; f := p_fear;
    if p_advantage <> 0 then a := sign(p_advantage) * p_adv; end if;
  else
    h := 1 + floor(random() * 12)::int;
    f := 1 + floor(random() * 12)::int;
    if p_advantage > 0 then a := 1 + floor(random() * 6)::int;
    elsif p_advantage < 0 then a := -(1 + floor(random() * 6)::int);
    end if;
  end if;

  if h = f then res := 'crit';
  elsif h > f then res := 'hope';
  else res := 'fear';
  end if;

  insert into rolls (campaign_id, character_id, user_id, roller_name, label,
                     hope_die, fear_die, adv_die, modifier, total, outcome, manual)
  values (p_campaign, p_character, auth.uid(), coalesce(who,''), coalesce(p_label,''),
          h, f, a, coalesce(p_modifier,0), h + f + a + coalesce(p_modifier,0), res, manual)
  returning * into r;

  if res = 'fear' then
    select fear into fb from campaigns where id = p_campaign for update;
    update campaigns set fear = least(fb + 1, 12) where id = p_campaign;
    update rolls set fear_gain = least(fb + 1, 12) - fb where id = r.id;
  elsif p_character is not null then
    update characters
       set hope = least(hope + 1, coalesce((data->>'hope_max')::int, 6)),
           stress_marked = case when res = 'crit' then greatest(stress_marked - 1, 0)
                                else stress_marked end
     where id = p_character
     returning hope, stress_marked into nh, ns;
    update rolls set hope_gain = nh - ch.hope, stress_cleared = ch.stress_marked - ns where id = r.id;
  end if;

  select * into r from rolls where id = r.id;
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
grant execute on function public.roll_duality(uuid, uuid, int, text, int, int, int, int) to authenticated;

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

-- Migrazione 2: slot Speranza variabili (retaggi homebrew). Idempotente.
alter table public.characters drop constraint if exists characters_hope_check;
alter table public.characters add constraint characters_hope_check check (hope between 0 and 12);

-- ---------------------------------------------------------------------
--  Migrazione 3: ritratti dei personaggi (Supabase Storage)
--  Percorso dei file: <campaign_id>/<character_id>/<timestamp>.webp
--  Lettura pubblica (bucket public); scrittura solo per chi può
--  modificare quel personaggio (proprietario o master della campagna).
-- ---------------------------------------------------------------------
create or replace function public.can_edit_character(p_campaign text, p_character text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from characters ch
    where ch.id::text = p_character and ch.campaign_id::text = p_campaign
      and (ch.owner_id = auth.uid() or is_gm(ch.campaign_id))
  );
$$;
grant execute on function public.can_edit_character(text, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portraits', 'portraits', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "portraits read"   on storage.objects;
drop policy if exists "portraits insert" on storage.objects;
drop policy if exists "portraits update" on storage.objects;
drop policy if exists "portraits delete" on storage.objects;
create policy "portraits read" on storage.objects for select
  using (bucket_id = 'portraits');
create policy "portraits insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'portraits'
              and public.can_edit_character((storage.foldername(name))[1], (storage.foldername(name))[2]));
create policy "portraits update" on storage.objects for update to authenticated
  using (bucket_id = 'portraits'
         and public.can_edit_character((storage.foldername(name))[1], (storage.foldername(name))[2]));
create policy "portraits delete" on storage.objects for delete to authenticated
  using (bucket_id = 'portraits'
         and public.can_edit_character((storage.foldername(name))[1], (storage.foldername(name))[2]));

-- ---------------------------------------------------------------------
--  Migrazione 4: Storia (recap delle sessioni), Galleria e Musica
-- ---------------------------------------------------------------------
create table if not exists public.session_recaps (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  number      int,
  title       text not null default '' check (char_length(title) <= 140),
  played_on   date,
  body        text not null default '' check (char_length(body) <= 40000),
  author_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists session_recaps_campaign on public.session_recaps(campaign_id, number);

create table if not exists public.campaign_media (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  kind        text not null check (kind in ('image','audio')),
  title       text not null default '' check (char_length(title) <= 200),
  album       text not null default '' check (char_length(album) <= 80),
  url         text,
  drive_id    text check (drive_id ~ '^[A-Za-z0-9_-]{10,80}$'),
  sort        int not null default 0,
  created_by  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  check (url is not null or drive_id is not null)
);
create index if not exists campaign_media_campaign on public.campaign_media(campaign_id, kind, album, sort);

alter table public.session_recaps enable row level security;
alter table public.campaign_media enable row level security;
grant select, insert, update, delete on public.session_recaps to authenticated;
grant select, insert, update, delete on public.campaign_media to authenticated;

drop policy if exists "recaps read"   on public.session_recaps;
drop policy if exists "recaps insert" on public.session_recaps;
drop policy if exists "recaps update" on public.session_recaps;
drop policy if exists "recaps delete" on public.session_recaps;
create policy "recaps read"   on public.session_recaps for select to authenticated using (is_member(campaign_id));
create policy "recaps insert" on public.session_recaps for insert to authenticated
  with check (author_id = auth.uid() and is_member(campaign_id));
create policy "recaps update" on public.session_recaps for update to authenticated
  using (author_id = auth.uid() or is_gm(campaign_id)) with check (is_member(campaign_id));
create policy "recaps delete" on public.session_recaps for delete to authenticated
  using (author_id = auth.uid() or is_gm(campaign_id));

drop policy if exists "media read"   on public.campaign_media;
drop policy if exists "media insert" on public.campaign_media;
drop policy if exists "media update" on public.campaign_media;
drop policy if exists "media delete" on public.campaign_media;
create policy "media read"   on public.campaign_media for select to authenticated using (is_member(campaign_id));
create policy "media insert" on public.campaign_media for insert to authenticated
  with check (created_by = auth.uid() and is_member(campaign_id));
create policy "media update" on public.campaign_media for update to authenticated
  using (created_by = auth.uid() or is_gm(campaign_id)) with check (is_member(campaign_id));
create policy "media delete" on public.campaign_media for delete to authenticated
  using (created_by = auth.uid() or is_gm(campaign_id));

alter table public.session_recaps replica identity full;
alter table public.campaign_media replica identity full;
do $$
declare t text;
begin
  foreach t in array array['session_recaps','campaign_media'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- File caricati: <campaign_id>/<timestamp>-<nome>  (immagini fino a 10 MB, audio fino a 50 MB per il limite del piano free)
create or replace function public.is_member_text(p_campaign text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from campaign_members
                 where campaign_id::text = p_campaign and user_id = auth.uid());
$$;
grant execute on function public.is_member_text(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('campaign-media', 'campaign-media', true, 52428800,
        array['image/webp','image/jpeg','image/png','image/gif','audio/mpeg','audio/mp3','audio/ogg','audio/wav','audio/x-wav','audio/mp4','audio/aac','audio/x-m4a','audio/webm','audio/flac'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "media files read"   on storage.objects;
drop policy if exists "media files insert" on storage.objects;
drop policy if exists "media files delete" on storage.objects;
create policy "media files read" on storage.objects for select using (bucket_id = 'campaign-media');
create policy "media files insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'campaign-media' and public.is_member_text((storage.foldername(name))[1]));
create policy "media files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'campaign-media' and (owner = auth.uid()
         or exists (select 1 from public.campaigns c where c.id::text = (storage.foldername(name))[1] and c.gm_id = auth.uid())));

-- ---------------------------------------------------------------------
--  Migrazione 5: il master può annullare un tiro della sessione,
--  togliendo la Speranza/Paura (e ridando lo Stress) assegnate dal tiro.
-- ---------------------------------------------------------------------
create or replace function public.undo_roll(p_roll uuid, p_revert boolean default true)
returns void language plpgsql security definer set search_path = public as $$
declare
  r rolls;
begin
  select * into r from rolls where id = p_roll;
  if not found then return; end if;
  if not is_gm(r.campaign_id) then raise exception 'Solo il master può annullare i tiri'; end if;
  if p_revert and r.kind = 'duality' then
    if r.outcome = 'fear' then
      update campaigns set fear = greatest(fear - coalesce(r.fear_gain, 1), 0) where id = r.campaign_id;
    elsif r.character_id is not null then
      -- tiri vecchi (prima di questa versione): +1 Speranza nota, Stress tolto sconosciuto
      update characters
         set hope = greatest(hope - coalesce(r.hope_gain, 1), 0),
             stress_marked = least(stress_marked + coalesce(r.stress_cleared, 0), stress_max)
       where id = r.character_id;
    end if;
  end if;
  delete from rolls where id = p_roll;
end $$;
grant execute on function public.undo_roll(uuid, boolean) to authenticated;

-- Migrazione 6: la Edge Function drive-audio chiede se un file di Drive è un brano registrato
create or replace function public.is_drive_audio(p_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from campaign_media where kind = 'audio' and drive_id = p_id);
$$;
revoke all on function public.is_drive_audio(text) from public;
grant execute on function public.is_drive_audio(text) to anon, authenticated;

-- ---------------------------------------------------------------------
--  Migrazione 7: tiri di danno e dadi liberi (d4…d20), nella stessa cronologia.
--  dice = {"groups":[{"sides":10,"rolls":[3,7]}],"bonus":3,"crit_bonus":20}
-- ---------------------------------------------------------------------
alter table public.rolls add column if not exists kind text not null default 'duality';
alter table public.rolls drop constraint if exists rolls_kind_check;
alter table public.rolls add constraint rolls_kind_check check (kind in ('duality','damage','dice'));
alter table public.rolls add column if not exists dice jsonb;
alter table public.rolls add column if not exists damage_type text;
alter table public.rolls add column if not exists crit boolean not null default false;
alter table public.rolls alter column outcome drop not null;

create or replace function public.roll_dice(
  p_campaign  uuid,
  p_character uuid,
  p_label     text,
  p_groups    jsonb,             -- [{"n":2,"sides":10}, ...]
  p_bonus     int  default 0,
  p_kind      text default 'damage',
  p_type      text default null, -- 'phy' | 'mag'
  p_crit      boolean default false,
  p_manual    int  default null  -- dadi fisici: somma dei dadi letta sul tavolo
) returns public.rolls language plpgsql security definer set search_path = public as $$
declare
  ch characters;
  r rolls;
  who text;
  g jsonb;
  n int; s int; v int; i int;
  rolls_arr int[];
  out_groups jsonb := '[]'::jsonb;
  dice_sum int := 0;
  crit_bonus int := 0;
  count_all int := 0;
begin
  if not is_member(p_campaign) then raise exception 'Non fai parte di questa campagna'; end if;
  if p_kind not in ('damage','dice') then raise exception 'Tipo di tiro non valido'; end if;
  if p_type is not null and p_type not in ('phy','mag') then raise exception 'Tipo di danno non valido'; end if;

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

  if jsonb_typeof(p_groups) <> 'array' or jsonb_array_length(p_groups) = 0 then
    raise exception 'Scegli almeno un dado';
  end if;

  for g in select * from jsonb_array_elements(p_groups) loop
    n := (g->>'n')::int; s := (g->>'sides')::int;
    if n is null or n < 1 or s not in (4,6,8,10,12,20,100) then raise exception 'Dadi non validi'; end if;
    count_all := count_all + n;
    if count_all > 40 then raise exception 'Massimo 40 dadi per tiro'; end if;
    rolls_arr := '{}';
    if p_manual is null then
      for i in 1..n loop
        v := 1 + floor(random() * s)::int;
        rolls_arr := rolls_arr || v;
        dice_sum := dice_sum + v;
      end loop;
    end if;
    if p_crit then crit_bonus := crit_bonus + n * s; end if;
    out_groups := out_groups || jsonb_build_object('sides', s, 'n', n, 'rolls', to_jsonb(rolls_arr));
  end loop;

  if p_manual is not null then
    if p_manual < count_all then raise exception 'La somma dei dadi è troppo bassa'; end if;
    dice_sum := p_manual;
  end if;

  insert into rolls (campaign_id, character_id, user_id, roller_name, label,
                     hope_die, fear_die, adv_die, modifier, total, outcome, manual,
                     kind, dice, damage_type, crit)
  values (p_campaign, p_character, auth.uid(), coalesce(who,''), coalesce(p_label,''),
          0, 0, 0, coalesce(p_bonus,0), dice_sum + crit_bonus + coalesce(p_bonus,0), null, p_manual is not null,
          p_kind, jsonb_build_object('groups', out_groups, 'bonus', coalesce(p_bonus,0), 'crit_bonus', crit_bonus),
          case when p_kind = 'damage' then coalesce(p_type, 'phy') end, p_crit)
  returning * into r;
  return r;
end $$;
grant execute on function public.roll_dice(uuid, uuid, text, jsonb, int, text, text, boolean, int) to authenticated;

-- ---------------------------------------------------------------------
--  Migrazione 8: mosse di gruppo (tiri di reazione, Tiro Combinato)
--  e privilegio Speranza del Serafino che cura un alleato.
-- ---------------------------------------------------------------------
alter table public.rolls add column if not exists reaction boolean not null default false;
alter table public.rolls add column if not exists group_id uuid;
alter table public.rolls add column if not exists pending boolean not null default false;
-- effetti applicati da un tiro su più personaggi: {"hope":{"<id>":1},"stress":{"<id>":1},"fear":2}
alter table public.rolls add column if not exists effects jsonb;

drop function if exists public.roll_duality(uuid, uuid, int, text, int, int, int, int);
create or replace function public.roll_duality(
  p_campaign  uuid,
  p_character uuid,
  p_modifier  int  default 0,
  p_label     text default '',
  p_advantage int  default 0,      -- 1 vantaggio, -1 svantaggio, 0 nessuno
  p_hope      int  default null,   -- dadi fisici: valori inseriti a mano
  p_fear      int  default null,
  p_adv       int  default null,   -- valore del d6 (sempre positivo)
  p_reaction  boolean default false -- tiro di reazione: niente Speranza né Paura
) returns public.rolls language plpgsql security definer set search_path = public as $$
declare
  ch characters;
  r rolls;
  manual boolean := p_hope is not null or p_fear is not null;
  h int;
  f int;
  a int := 0;
  res text;
  who text;
  fb int;
  nh int;
  ns int;
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

  if manual then
    if p_hope is null or p_fear is null or p_hope not between 1 and 12 or p_fear not between 1 and 12 then
      raise exception 'I dadi di Speranza e Paura vanno da 1 a 12';
    end if;
    if p_advantage <> 0 and (p_adv is null or p_adv not between 1 and 6) then
      raise exception 'Il dado di vantaggio va da 1 a 6';
    end if;
    h := p_hope; f := p_fear;
    if p_advantage <> 0 then a := sign(p_advantage) * p_adv; end if;
  else
    h := 1 + floor(random() * 12)::int;
    f := 1 + floor(random() * 12)::int;
    if p_advantage > 0 then a := 1 + floor(random() * 6)::int;
    elsif p_advantage < 0 then a := -(1 + floor(random() * 6)::int);
    end if;
  end if;

  if h = f then res := 'crit';
  elsif h > f then res := 'hope';
  else res := 'fear';
  end if;

  insert into rolls (campaign_id, character_id, user_id, roller_name, label,
                     hope_die, fear_die, adv_die, modifier, total, outcome, manual, reaction)
  values (p_campaign, p_character, auth.uid(), coalesce(who,''), coalesce(p_label,''),
          h, f, a, coalesce(p_modifier,0), h + f + a + coalesce(p_modifier,0), res, manual, coalesce(p_reaction, false))
  returning * into r;

  if coalesce(p_reaction, false) then
    return r;
  elsif res = 'fear' then
    select fear into fb from campaigns where id = p_campaign for update;
    update campaigns set fear = least(fb + 1, 12) where id = p_campaign;
    update rolls set fear_gain = least(fb + 1, 12) - fb where id = r.id;
  elsif p_character is not null then
    update characters
       set hope = least(hope + 1, coalesce((data->>'hope_max')::int, 6)),
           stress_marked = case when res = 'crit' then greatest(stress_marked - 1, 0)
                                else stress_marked end
     where id = p_character
     returning hope, stress_marked into nh, ns;
    update rolls set hope_gain = nh - ch.hope, stress_cleared = ch.stress_marked - ns where id = r.id;
  end if;

  select * into r from rolls where id = r.id;
  return r;
end $$;
grant execute on function public.roll_duality(uuid, uuid, int, text, int, int, int, int, boolean) to authenticated;

-- Tiro Combinato: chi lo avvia spende 3 Speranza, si tirano entrambi i tiri senza effetti;
-- poi si sceglie quale risultato vale per tutti e due (resolve_tag_team).
create or replace function public.roll_tag_team(
  p_campaign uuid, p_a uuid, p_mod_a int, p_label_a text, p_b uuid, p_mod_b int, p_label_b text
) returns setof public.rolls language plpgsql security definer set search_path = public as $$
declare
  ca characters; cb characters; g uuid := gen_random_uuid();
  h int; f int; res text;
  who uuid; ch characters; m int; lab text;
begin
  select * into ca from characters where id = p_a and campaign_id = p_campaign;
  select * into cb from characters where id = p_b and campaign_id = p_campaign;
  if ca.id is null or cb.id is null or ca.id = cb.id then raise exception 'Scegli due personaggi diversi della campagna'; end if;
  if ca.owner_id <> auth.uid() and not is_gm(p_campaign) then raise exception 'Non puoi avviare il tiro per questo personaggio'; end if;
  if ca.hope < 3 then raise exception 'Servono 3 Speranza per il Tiro Combinato'; end if;
  update characters set hope = hope - 3 where id = ca.id;
  foreach who in array array[ca.id, cb.id] loop
    if who = ca.id then ch := ca; m := p_mod_a; lab := p_label_a; else ch := cb; m := p_mod_b; lab := p_label_b; end if;
    h := 1 + floor(random() * 12)::int;
    f := 1 + floor(random() * 12)::int;
    res := case when h = f then 'crit' when h > f then 'hope' else 'fear' end;
    return query
      insert into rolls (campaign_id, character_id, user_id, roller_name, label, hope_die, fear_die, adv_die,
                         modifier, total, outcome, group_id, pending)
      values (p_campaign, ch.id, auth.uid(), ch.name, trim('Tiro Combinato ' || coalesce(lab, '')), h, f, 0,
              coalesce(m, 0), h + f + coalesce(m, 0), res, g, true)
      returning *;
  end loop;
end $$;
grant execute on function public.roll_tag_team(uuid, uuid, int, text, uuid, int, text) to authenticated;

create or replace function public.resolve_tag_team(p_group uuid, p_chosen uuid)
returns public.rolls language plpgsql security definer set search_path = public as $$
declare
  r rolls; other rolls; ids uuid[]; eff jsonb := '{}'::jsonb; cid uuid; nh int; ns int; fb int;
begin
  select * into r from rolls where id = p_chosen and group_id = p_group and pending;
  if not found then raise exception 'Tiro già risolto'; end if;
  if not exists (select 1 from rolls x join characters c on c.id = x.character_id
                 where x.group_id = p_group and (c.owner_id = auth.uid()))
     and not is_gm(r.campaign_id) then
    raise exception 'Non partecipi a questo Tiro Combinato';
  end if;
  select array_agg(character_id) into ids from rolls where group_id = p_group;
  if r.outcome = 'fear' then
    select fear into fb from campaigns where id = r.campaign_id for update;
    update campaigns set fear = least(fb + array_length(ids, 1), 12) where id = r.campaign_id;
    eff := jsonb_build_object('fear', least(fb + array_length(ids, 1), 12) - fb);
  else
    eff := jsonb_build_object('hope', '{}'::jsonb, 'stress', '{}'::jsonb);
    foreach cid in array ids loop
      select hope, stress_marked into nh, ns from characters where id = cid for update;
      update characters
         set hope = least(hope + 1, coalesce((data->>'hope_max')::int, 6)),
             stress_marked = case when r.outcome = 'crit' then greatest(stress_marked - 1, 0) else stress_marked end
       where id = cid;
      eff := jsonb_set(eff, array['hope', cid::text], to_jsonb((select hope from characters where id = cid) - nh));
      eff := jsonb_set(eff, array['stress', cid::text], to_jsonb(ns - (select stress_marked from characters where id = cid)));
    end loop;
  end if;
  delete from rolls where group_id = p_group and id <> p_chosen;
  update rolls set pending = false, effects = eff, label = trim(label || ' (scelto)') where id = p_chosen returning * into r;
  return r;
end $$;
grant execute on function public.resolve_tag_team(uuid, uuid) to authenticated;

-- Annullare: anche i tiri combinati (effetti su più personaggi)
create or replace function public.undo_roll(p_roll uuid, p_revert boolean default true)
returns void language plpgsql security definer set search_path = public as $$
declare
  r rolls; k text; v jsonb;
begin
  select * into r from rolls where id = p_roll;
  if not found then return; end if;
  if not is_gm(r.campaign_id) then raise exception 'Solo il master può annullare i tiri'; end if;
  if p_revert and r.kind = 'duality' and not r.reaction and not r.pending then
    if r.effects is not null then
      if r.effects ? 'fear' then
        update campaigns set fear = greatest(fear - (r.effects->>'fear')::int, 0) where id = r.campaign_id;
      end if;
      for k, v in select * from jsonb_each(coalesce(r.effects->'hope', '{}'::jsonb)) loop
        update characters set hope = greatest(hope - v::int, 0) where id = k::uuid;
      end loop;
      for k, v in select * from jsonb_each(coalesce(r.effects->'stress', '{}'::jsonb)) loop
        update characters set stress_marked = least(stress_marked + v::int, stress_max) where id = k::uuid;
      end loop;
    elsif r.outcome = 'fear' then
      update campaigns set fear = greatest(fear - coalesce(r.fear_gain, 1), 0) where id = r.campaign_id;
    elsif r.character_id is not null then
      update characters
         set hope = greatest(hope - coalesce(r.hope_gain, 1), 0),
             stress_marked = least(stress_marked + coalesce(r.stress_cleared, 0), stress_max)
       where id = r.character_id;
    end if;
  end if;
  if r.group_id is not null and r.pending then
    delete from rolls where group_id = r.group_id;
  else
    delete from rolls where id = p_roll;
  end if;
end $$;

-- Serafino, "Proteggere la Vita": 3 Speranza per togliere 1 PF a un alleato
create or replace function public.protect_life(p_from uuid, p_to uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a characters; b characters;
begin
  select * into a from characters where id = p_from;
  select * into b from characters where id = p_to;
  if a.id is null or b.id is null or a.campaign_id <> b.campaign_id then raise exception 'Alleato non valido'; end if;
  if a.owner_id <> auth.uid() and not is_gm(a.campaign_id) then raise exception 'Non puoi usare questo personaggio'; end if;
  if a.hope < 3 then raise exception 'Servono 3 Speranza'; end if;
  update characters set hope = hope - 3 where id = a.id;
  update characters set hp_marked = greatest(hp_marked - 1, 0) where id = b.id;
end $$;
grant execute on function public.protect_life(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
--  Migrazione 9: Tiro Combinato su invito.
--  Chi lo propone spende 3 Speranza; gli altri giocatori ricevono l'invito,
--  il primo che accetta partecipa; ognuno tira i propri dadi; il master fissa
--  la Difficoltà; si sceglie un risultato che vale per entrambi; se riesce si tirano i danni.
-- ---------------------------------------------------------------------
create table if not exists public.tag_teams (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null references public.campaigns(id) on delete cascade,
  initiator_char uuid not null references public.characters(id) on delete cascade,
  initiator_user uuid not null references auth.users(id) on delete cascade,
  partner_char   uuid references public.characters(id) on delete cascade,
  partner_user   uuid references auth.users(id) on delete cascade,
  difficulty     int check (difficulty between 1 and 40),
  status         text not null default 'open' check (status in ('open','joined','resolved','cancelled')),
  chosen_roll    uuid,
  success        boolean,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists tag_teams_campaign on public.tag_teams(campaign_id, created_at desc);
alter table public.tag_teams enable row level security;
grant select on public.tag_teams to authenticated;
drop policy if exists "tag read" on public.tag_teams;
create policy "tag read" on public.tag_teams for select to authenticated using (is_member(campaign_id));
alter table public.tag_teams replica identity full;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tag_teams') then
    alter publication supabase_realtime add table public.tag_teams;
  end if;
end $$;

-- i danni del Tiro Combinato si legano al tiro con group_id
drop function if exists public.roll_dice(uuid, uuid, text, jsonb, int, text, text, boolean, int);
create or replace function public.roll_dice(
  p_campaign  uuid,
  p_character uuid,
  p_label     text,
  p_groups    jsonb,             -- [{"n":2,"sides":10}, ...]
  p_bonus     int  default 0,
  p_kind      text default 'damage',
  p_type      text default null, -- 'phy' | 'mag'
  p_crit      boolean default false,
  p_manual    int  default null, -- dadi fisici: somma dei dadi letta sul tavolo
  p_group     uuid default null  -- danni di un Tiro Combinato
) returns public.rolls language plpgsql security definer set search_path = public as $$
declare
  ch characters;
  r rolls;
  who text;
  g jsonb;
  n int; s int; v int; i int;
  rolls_arr int[];
  out_groups jsonb := '[]'::jsonb;
  dice_sum int := 0;
  crit_bonus int := 0;
  count_all int := 0;
begin
  if not is_member(p_campaign) then raise exception 'Non fai parte di questa campagna'; end if;
  if p_kind not in ('damage','dice') then raise exception 'Tipo di tiro non valido'; end if;
  if p_type is not null and p_type not in ('phy','mag') then raise exception 'Tipo di danno non valido'; end if;

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

  if jsonb_typeof(p_groups) <> 'array' or jsonb_array_length(p_groups) = 0 then
    raise exception 'Scegli almeno un dado';
  end if;

  for g in select * from jsonb_array_elements(p_groups) loop
    n := (g->>'n')::int; s := (g->>'sides')::int;
    if n is null or n < 1 or s not in (4,6,8,10,12,20,100) then raise exception 'Dadi non validi'; end if;
    count_all := count_all + n;
    if count_all > 40 then raise exception 'Massimo 40 dadi per tiro'; end if;
    rolls_arr := '{}';
    if p_manual is null then
      for i in 1..n loop
        v := 1 + floor(random() * s)::int;
        rolls_arr := rolls_arr || v;
        dice_sum := dice_sum + v;
      end loop;
    end if;
    if p_crit then crit_bonus := crit_bonus + n * s; end if;
    out_groups := out_groups || jsonb_build_object('sides', s, 'n', n, 'rolls', to_jsonb(rolls_arr));
  end loop;

  if p_manual is not null then
    if p_manual < count_all then raise exception 'La somma dei dadi è troppo bassa'; end if;
    dice_sum := p_manual;
  end if;

  insert into rolls (campaign_id, character_id, user_id, roller_name, label,
                     hope_die, fear_die, adv_die, modifier, total, outcome, manual,
                     kind, dice, damage_type, crit, group_id)
  values (p_campaign, p_character, auth.uid(), coalesce(who,''), coalesce(p_label,''),
          0, 0, 0, coalesce(p_bonus,0), dice_sum + crit_bonus + coalesce(p_bonus,0), null, p_manual is not null,
          p_kind, jsonb_build_object('groups', out_groups, 'bonus', coalesce(p_bonus,0), 'crit_bonus', crit_bonus),
          case when p_kind = 'damage' then coalesce(p_type, 'phy') end, p_crit, p_group)
  returning * into r;
  return r;
end $$;
grant execute on function public.roll_dice(uuid, uuid, text, jsonb, int, text, text, boolean, int, uuid) to authenticated;

create or replace function public.tag_open(p_char uuid)
returns public.tag_teams language plpgsql security definer set search_path = public as $$
declare c characters; t tag_teams;
begin
  select * into c from characters where id = p_char;
  if not found then raise exception 'Personaggio non trovato'; end if;
  if c.owner_id <> auth.uid() and not is_gm(c.campaign_id) then raise exception 'Non puoi usare questo personaggio'; end if;
  if exists (select 1 from tag_teams where campaign_id = c.campaign_id and status in ('open','joined') and created_at > now() - interval '2 hours') then
    raise exception 'C''è già un Tiro Combinato in corso';
  end if;
  if c.hope < 3 then raise exception 'Servono 3 Speranza per il Tiro Combinato'; end if;
  update characters set hope = hope - 3 where id = c.id;
  insert into tag_teams (campaign_id, initiator_char, initiator_user) values (c.campaign_id, c.id, auth.uid()) returning * into t;
  return t;
end $$;

create or replace function public.tag_join(p_tag uuid, p_char uuid)
returns public.tag_teams language plpgsql security definer set search_path = public as $$
declare c characters; t tag_teams;
begin
  select * into c from characters where id = p_char;
  if not found or c.owner_id <> auth.uid() then raise exception 'Personaggio non valido'; end if;
  update tag_teams set partner_char = c.id, partner_user = auth.uid(), status = 'joined', updated_at = now()
   where id = p_tag and status = 'open' and campaign_id = c.campaign_id and initiator_char <> c.id
  returning * into t;
  if not found then raise exception 'Qualcun altro ha già accettato, o il tiro è stato annullato'; end if;
  return t;
end $$;

create or replace function public.tag_cancel(p_tag uuid)
returns void language plpgsql security definer set search_path = public as $$
declare t tag_teams;
begin
  select * into t from tag_teams where id = p_tag for update;
  if not found or t.status not in ('open','joined') then return; end if;
  if t.initiator_user <> auth.uid() and not is_gm(t.campaign_id) then raise exception 'Solo chi l''ha proposto o il master può annullarlo'; end if;
  update characters set hope = least(hope + 3, coalesce((data->>'hope_max')::int, 6)) where id = t.initiator_char;
  delete from rolls where group_id = t.id;
  update tag_teams set status = 'cancelled', updated_at = now() where id = t.id;
end $$;

create or replace function public.tag_set_difficulty(p_tag uuid, p_difficulty int)
returns void language plpgsql security definer set search_path = public as $$
declare t tag_teams;
begin
  select * into t from tag_teams where id = p_tag;
  if not found or not is_gm(t.campaign_id) then raise exception 'Solo il master fissa la Difficoltà'; end if;
  if t.status not in ('open','joined') then raise exception 'Il tiro è già concluso'; end if;
  update tag_teams set difficulty = p_difficulty, updated_at = now() where id = p_tag;
end $$;

create or replace function public.tag_roll(p_tag uuid, p_char uuid, p_modifier int, p_label text,
                                           p_hope int default null, p_fear int default null)
returns public.rolls language plpgsql security definer set search_path = public as $$
declare t tag_teams; c characters; r rolls; h int; f int; res text;
begin
  select * into t from tag_teams where id = p_tag;
  if not found or t.status <> 'joined' then raise exception 'Il Tiro Combinato non è pronto'; end if;
  if p_char not in (t.initiator_char, t.partner_char) then raise exception 'Questo personaggio non partecipa'; end if;
  select * into c from characters where id = p_char;
  if c.owner_id <> auth.uid() and not is_gm(t.campaign_id) then raise exception 'Non puoi tirare per questo personaggio'; end if;
  if exists (select 1 from rolls where group_id = t.id and character_id = p_char and kind = 'duality') then raise exception 'Hai già tirato'; end if;
  if p_hope is not null or p_fear is not null then
    if p_hope not between 1 and 12 or p_fear not between 1 and 12 then raise exception 'I dadi vanno da 1 a 12'; end if;
    h := p_hope; f := p_fear;
  else
    h := 1 + floor(random() * 12)::int; f := 1 + floor(random() * 12)::int;
  end if;
  res := case when h = f then 'crit' when h > f then 'hope' else 'fear' end;
  insert into rolls (campaign_id, character_id, user_id, roller_name, label, hope_die, fear_die, adv_die,
                     modifier, total, outcome, group_id, pending, manual)
  values (t.campaign_id, c.id, auth.uid(), c.name, trim('Tiro Combinato ' || coalesce(p_label, '')), h, f, 0,
          coalesce(p_modifier, 0), h + f + coalesce(p_modifier, 0), res, t.id, true, p_hope is not null)
  returning * into r;
  update tag_teams set updated_at = now() where id = t.id;
  return r;
end $$;

create or replace function public.tag_resolve(p_tag uuid, p_roll uuid)
returns public.tag_teams language plpgsql security definer set search_path = public as $$
declare t tag_teams; r rolls; eff jsonb; cid uuid; nh int; ns int; fb int; ids uuid[];
begin
  select * into t from tag_teams where id = p_tag for update;
  if not found or t.status <> 'joined' then raise exception 'Il Tiro Combinato non è pronto'; end if;
  if auth.uid() not in (t.initiator_user, t.partner_user) and not is_gm(t.campaign_id) then raise exception 'Non partecipi a questo tiro'; end if;
  if t.difficulty is null then raise exception 'Il master non ha ancora fissato la Difficoltà'; end if;
  if (select count(*) from rolls where group_id = t.id and kind = 'duality') < 2 then raise exception 'Mancano ancora dei tiri'; end if;
  select * into r from rolls where id = p_roll and group_id = t.id and kind = 'duality';
  if not found then raise exception 'Tiro non valido'; end if;
  ids := array[t.initiator_char, t.partner_char];
  if r.outcome = 'fear' then
    select fear into fb from campaigns where id = t.campaign_id for update;
    update campaigns set fear = least(fb + 2, 12) where id = t.campaign_id;
    eff := jsonb_build_object('fear', least(fb + 2, 12) - fb);
  else
    eff := jsonb_build_object('hope', '{}'::jsonb, 'stress', '{}'::jsonb);
    foreach cid in array ids loop
      select hope, stress_marked into nh, ns from characters where id = cid for update;
      update characters
         set hope = least(hope + 1, coalesce((data->>'hope_max')::int, 6)),
             stress_marked = case when r.outcome = 'crit' then greatest(stress_marked - 1, 0) else stress_marked end
       where id = cid;
      eff := jsonb_set(eff, array['hope', cid::text], to_jsonb((select hope from characters where id = cid) - nh));
      eff := jsonb_set(eff, array['stress', cid::text], to_jsonb(ns - (select stress_marked from characters where id = cid)));
    end loop;
  end if;
  delete from rolls where group_id = t.id and kind = 'duality' and id <> r.id;
  update rolls set pending = false, effects = eff,
         label = trim(label || case when r.outcome = 'crit' or r.total >= t.difficulty then ' (riuscito)' else ' (fallito)' end)
   where id = r.id;
  update tag_teams set status = 'resolved', chosen_roll = r.id,
         success = (r.outcome = 'crit' or r.total >= t.difficulty), updated_at = now()
   where id = t.id returning * into t;
  return t;
end $$;

grant execute on function public.tag_open(uuid) to authenticated;
grant execute on function public.tag_join(uuid, uuid) to authenticated;
grant execute on function public.tag_cancel(uuid) to authenticated;
grant execute on function public.tag_set_difficulty(uuid, int) to authenticated;
grant execute on function public.tag_roll(uuid, uuid, int, text, int, int) to authenticated;
grant execute on function public.tag_resolve(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
--  Migrazione 10: Conti alla rovescia.
--  Il master li crea e li muove; i giocatori vedono quelli visibili.
--  "auto_tick": scende di 1 a ogni tiro di Dualità dei giocatori.
-- ---------------------------------------------------------------------
create table if not exists public.countdowns (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name        text not null default '' check (char_length(name) <= 80),
  note        text not null default '' check (char_length(note) <= 400),
  max         int  not null default 4 check (max between 1 and 20),
  value       int  not null default 4 check (value between 0 and 20),
  kind        text not null default 'consequence' check (kind in ('progress','consequence')),
  visible     boolean not null default true,
  auto_tick   boolean not null default false,
  loop        boolean not null default false,
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists countdowns_campaign on public.countdowns(campaign_id, sort);
alter table public.countdowns enable row level security;
grant select, insert, update, delete on public.countdowns to authenticated;
drop policy if exists "countdowns read"  on public.countdowns;
drop policy if exists "countdowns write" on public.countdowns;
create policy "countdowns read"  on public.countdowns for select to authenticated
  using (is_gm(campaign_id) or (visible and is_member(campaign_id)));
create policy "countdowns write" on public.countdowns for all to authenticated
  using (is_gm(campaign_id)) with check (is_gm(campaign_id));
alter table public.countdowns replica identity full;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'countdowns') then
    alter publication supabase_realtime add table public.countdowns;
  end if;
end $$;

-- ogni tiro di Dualità di un PG (non di reazione, non combinato) fa scendere i conti automatici
create or replace function public.countdowns_on_roll()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'duality' and new.character_id is not null and not new.reaction and new.group_id is null then
    update countdowns
       set value = case when value - 1 <= 0 and loop then max else greatest(value - 1, 0) end,
           updated_at = now()
     where campaign_id = new.campaign_id and auto_tick and value > 0;
  end if;
  return new;
end $$;
drop trigger if exists rolls_tick_countdowns on public.rolls;
create trigger rolls_tick_countdowns after insert on public.rolls
  for each row execute function public.countdowns_on_roll();

-- ---------------------------------------------------------------------
--  Migrazione 11: Scontri e avversari personalizzati (solo master).
--  units = [{"uid","adv","name","hp","stress","defeated","note"}]
-- ---------------------------------------------------------------------
create table if not exists public.encounters (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name        text not null default '' check (char_length(name) <= 80),
  units       jsonb not null default '[]'::jsonb,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists encounters_campaign on public.encounters(campaign_id, updated_at desc);
alter table public.encounters enable row level security;
grant select, insert, update, delete on public.encounters to authenticated;
drop policy if exists "encounters gm" on public.encounters;
create policy "encounters gm" on public.encounters for all to authenticated
  using (is_gm(campaign_id)) with check (is_gm(campaign_id));

create table if not exists public.custom_adversaries (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.custom_adversaries enable row level security;
grant select, insert, update, delete on public.custom_adversaries to authenticated;
drop policy if exists "custom adversaries owner" on public.custom_adversaries;
create policy "custom adversaries owner" on public.custom_adversaries for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
