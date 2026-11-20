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
