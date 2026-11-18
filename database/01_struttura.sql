-- =====================================================================
--  ALBERO DI FAMIGLIA - struttura del database (Supabase / PostgreSQL)
--
--  Si esegue una volta sola, tutto intero, nel "SQL Editor" di Supabase.
--  Rieseguirlo non cancella i dati: aggiorna solo le funzioni.
--
--  Principio di sicurezza: le tabelle sono chiuse a chiunque arrivi da
--  internet (Row Level Security attiva e nessuna regola di accesso).
--  Si passa SOLO dalle funzioni qui sotto, e ognuna vuole la chiave
--  contenuta nel link: la chiave decide la famiglia e il ruolo.
--
--  Tre livelli di chiave:
--    familiare  -> vede e modifica la propria famiglia
--    referente  -> come il familiare, in piu' ripristina l'intero albero
--                  da una copia serale e cambia il link d'invito
--    gestore    -> crea ed elimina le famiglie, fa le esportazioni complete
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tabelle

create table if not exists gestore (
  id           int primary key default 1 check (id = 1),
  chiave_hash  text not null
);

create table if not exists famiglie (
  id            uuid primary key default extensions.gen_random_uuid(),
  nome          text not null check (length(nome) between 1 and 80),
  chiave        text not null unique,          -- chiave del link familiare (serve per gli inviti)
  admin_hash    text not null unique,          -- impronta della chiave del referente
  creata_il     timestamptz not null default now()
);

create table if not exists foto (
  id           uuid primary key default extensions.gen_random_uuid(),
  famiglia_id  uuid not null references famiglie(id) on delete cascade,
  dati         text not null check (length(dati) <= 2500000),
  creata_il    timestamptz not null default now()
);
create index if not exists foto_famiglia on foto(famiglia_id);

create table if not exists persone (
  id             uuid primary key default extensions.gen_random_uuid(),
  famiglia_id    uuid not null references famiglie(id) on delete cascade,
  nome           text not null check (length(nome) between 1 and 80),
  cognome        text not null default '' check (length(cognome) <= 80),
  sesso          text not null default '' check (sesso in ('', 'M', 'F')),
  data_nascita   text not null default '' check (data_nascita ~ '^([0-9]{4}(-[0-9]{2}(-[0-9]{2})?)?)?$'),
  luogo_nascita  text not null default '' check (length(luogo_nascita) <= 120),
  deceduto       boolean not null default false,
  data_morte     text not null default '' check (data_morte ~ '^([0-9]{4}(-[0-9]{2}(-[0-9]{2})?)?)?$'),
  note           text not null default '' check (length(note) <= 5000),
  miniatura      text not null default '' check (length(miniatura) <= 80000),
  foto_id        uuid references foto(id) on delete set null,
  creato_da      text not null default '',
  creato_il      timestamptz not null default now(),
  aggiornato_da  text not null default '',
  aggiornato_il  timestamptz not null default now()
);
create index if not exists persone_famiglia on persone(famiglia_id);

-- tipo 'genitore': "da" e' genitore di "a".  tipo 'coppia': da e a sono una coppia.
create table if not exists relazioni (
  id           uuid primary key default extensions.gen_random_uuid(),
  famiglia_id  uuid not null references famiglie(id) on delete cascade,
  tipo         text not null check (tipo in ('genitore', 'coppia')),
  da           uuid not null references persone(id) on delete cascade,
  a            uuid not null references persone(id) on delete cascade,
  dettaglio    text not null default '' check (length(dettaglio) <= 120),
  check (da <> a),
  unique (tipo, da, a)
);
create index if not exists relazioni_famiglia on relazioni(famiglia_id);

create table if not exists registro (
  id            bigint generated always as identity primary key,
  famiglia_id   uuid not null references famiglie(id) on delete cascade,
  quando        timestamptz not null default now(),
  chi           text not null default '',
  azione        text not null,
  descrizione   text not null default '',
  prima         jsonb,
  ripristinato  boolean not null default false
);
create index if not exists registro_famiglia on registro(famiglia_id, quando desc);

create table if not exists copie (
  id           bigint generated always as identity primary key,
  famiglia_id  uuid not null references famiglie(id) on delete cascade,
  giorno       date not null,
  creata_il    timestamptz not null default now(),
  motivo       text not null default 'serale',
  dati         jsonb not null
);
create unique index if not exists copie_una_per_sera on copie(famiglia_id, giorno) where motivo = 'serale';

-- chiuse a internet: si entra solo dalle funzioni
alter table gestore   enable row level security;
alter table famiglie  enable row level security;
alter table foto      enable row level security;
alter table persone   enable row level security;
alter table relazioni enable row level security;
alter table registro  enable row level security;
alter table copie     enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on gestore, famiglie, foto, persone, relazioni, registro, copie from anon, authenticated';
  end if;
end $$;

-- ---------------------------------------------------------------- funzioni interne

create or replace function _hash(t text) returns text
language sql immutable set search_path = public, extensions as $$
  select encode(extensions.digest(coalesce(t, ''), 'sha256'), 'hex')
$$;

create or replace function _nuova_chiave() returns text
language sql volatile set search_path = public, extensions as $$
  select encode(extensions.gen_random_bytes(16), 'hex')
$$;

-- dalla chiave del link ricava famiglia e ruolo; altrimenti errore
create or replace function _accesso(p_chiave text, out fid uuid, out ruolo text)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if p_chiave is null or length(p_chiave) < 16 then
    raise exception 'chiave_non_valida';
  end if;
  select f.id, 'referente' into fid, ruolo from famiglie f where f.admin_hash = _hash(p_chiave);
  if fid is null then
    select f.id, 'familiare' into fid, ruolo from famiglie f where f.chiave = p_chiave;
  end if;
  if fid is null then
    raise exception 'chiave_non_valida';
  end if;
end $$;

create or replace function _gestore(p_chiave text) returns void
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if p_chiave is null or not exists (select 1 from gestore where chiave_hash = _hash(p_chiave)) then
    raise exception 'chiave_non_valida';
  end if;
end $$;

create or replace function _nome_persona(p persone) returns text
language sql immutable as $$
  select trim(coalesce(p.nome, '') || ' ' || coalesce(p.cognome, ''))
$$;

create or replace function _chi(p_chi text) returns text
language sql immutable as $$
  select left(trim(coalesce(p_chi, '')), 60)
$$;

-- fotografia dello stato di una famiglia (senza le foto grandi, che restano per id)
create or replace function _istantanea(p_fid uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'persone',   coalesce((select jsonb_agg(to_jsonb(p)) from persone p where p.famiglia_id = p_fid), '[]'::jsonb),
    'relazioni', coalesce((select jsonb_agg(to_jsonb(r)) from relazioni r where r.famiglia_id = p_fid), '[]'::jsonb))
$$;

-- copia serale di tutte le famiglie + pulizia (la lancia pg_cron ogni sera)
create or replace function _copia_serale() returns int
language plpgsql security definer set search_path = public, extensions as $$
declare
  n int := 0;
  f record;
  oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  for f in select id from famiglie loop
    insert into copie(famiglia_id, giorno, motivo, dati)
    values (f.id, oggi, 'serale', _istantanea(f.id))
    on conflict (famiglia_id, giorno) where motivo = 'serale'
    do update set dati = excluded.dati, creata_il = now();
    n := n + 1;
  end loop;

  -- si tengono 30 giorni di copie
  delete from copie where giorno < oggi - 30;

  -- foto non piu' usate da nessuno: ne' oggi, ne' in una copia, ne' nel registro recente
  delete from foto x
  where x.creata_il < now() - interval '1 day'
    and not exists (select 1 from persone p where p.foto_id = x.id)
    and not exists (select 1 from copie c where c.famiglia_id = x.famiglia_id and position(x.id::text in c.dati::text) > 0)
    and not exists (select 1 from registro r where r.famiglia_id = x.famiglia_id and r.prima is not null
                      and r.quando > now() - interval '90 days' and position(x.id::text in r.prima::text) > 0);
  return n;
end $$;

-- ---------------------------------------------------------------- lettura

create or replace function albero_carica(p_chiave text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare acc record;
begin
  select * into acc from _accesso(p_chiave);
  return jsonb_build_object(
    'famiglia', (select jsonb_build_object('id', f.id, 'nome', f.nome) from famiglie f where f.id = acc.fid),
    'ruolo', acc.ruolo,
    'invito', case when acc.ruolo = 'referente' then (select f.chiave from famiglie f where f.id = acc.fid) end,
    'persone', coalesce((select jsonb_agg(to_jsonb(p) - 'famiglia_id' order by p.cognome, p.nome)
                         from persone p where p.famiglia_id = acc.fid), '[]'::jsonb),
    'relazioni', coalesce((select jsonb_agg(to_jsonb(r) - 'famiglia_id')
                           from relazioni r where r.famiglia_id = acc.fid), '[]'::jsonb));
end $$;

create or replace function albero_foto(p_chiave text, p_foto_id uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare acc record; d text;
begin
  select * into acc from _accesso(p_chiave);
  select x.dati into d from foto x where x.id = p_foto_id and x.famiglia_id = acc.fid;
  return coalesce(d, '');
end $$;

-- ---------------------------------------------------------------- persone

-- p_foto:  null = non toccare la foto;  '' = togliere la foto;  'data:image/...' = foto nuova
create or replace function albero_salva_persona(p_chiave text, p_chi text, p_persona jsonb,
                                                p_foto text default null, p_miniatura text default null)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  acc record;
  v_id uuid := nullif(p_persona->>'id', '')::uuid;
  v_prima persone;
  v_dopo persone;
  v_foto_id uuid;
  v_chi text := _chi(p_chi);
begin
  select * into acc from _accesso(p_chiave);
  if coalesce(trim(p_persona->>'nome'), '') = '' then
    raise exception 'nome_mancante';
  end if;
  if coalesce(p_foto, '') <> '' and p_foto !~ '^data:image/(jpeg|png|webp);base64,' then
    raise exception 'foto_non_valida';
  end if;
  if coalesce(p_miniatura, '') <> '' and p_miniatura !~ '^data:image/(jpeg|png|webp);base64,' then
    raise exception 'foto_non_valida';
  end if;

  if coalesce(p_foto, '') <> '' then
    insert into foto(famiglia_id, dati) values (acc.fid, p_foto) returning id into v_foto_id;
  end if;

  if v_id is null then
    insert into persone(famiglia_id, nome, cognome, sesso, data_nascita, luogo_nascita, deceduto,
                        data_morte, note, miniatura, foto_id, creato_da, aggiornato_da)
    values (acc.fid,
            trim(p_persona->>'nome'),
            coalesce(trim(p_persona->>'cognome'), ''),
            coalesce(p_persona->>'sesso', ''),
            coalesce(p_persona->>'data_nascita', ''),
            coalesce(trim(p_persona->>'luogo_nascita'), ''),
            coalesce((p_persona->>'deceduto')::boolean, false),
            coalesce(p_persona->>'data_morte', ''),
            coalesce(p_persona->>'note', ''),
            case when coalesce(p_foto, '') <> '' then coalesce(p_miniatura, '') else '' end,
            v_foto_id, v_chi, v_chi)
    returning * into v_dopo;
    insert into registro(famiglia_id, chi, azione, descrizione)
    values (acc.fid, v_chi, 'aggiunta_persona', 'Aggiunta ' || _nome_persona(v_dopo));
    return v_dopo.id;
  end if;

  select * into v_prima from persone where id = v_id and famiglia_id = acc.fid for update;
  if not found then
    raise exception 'persona_non_trovata';
  end if;

  update persone set
    nome          = trim(p_persona->>'nome'),
    cognome       = coalesce(trim(p_persona->>'cognome'), ''),
    sesso         = coalesce(p_persona->>'sesso', ''),
    data_nascita  = coalesce(p_persona->>'data_nascita', ''),
    luogo_nascita = coalesce(trim(p_persona->>'luogo_nascita'), ''),
    deceduto      = coalesce((p_persona->>'deceduto')::boolean, false),
    data_morte    = coalesce(p_persona->>'data_morte', ''),
    note          = coalesce(p_persona->>'note', ''),
    miniatura     = case when p_foto is null then miniatura
                         when p_foto = '' then ''
                         else coalesce(p_miniatura, '') end,
    foto_id       = case when p_foto is null then foto_id
                         when p_foto = '' then null
                         else v_foto_id end,
    aggiornato_da = v_chi,
    aggiornato_il = now()
  where id = v_id
  returning * into v_dopo;

  insert into registro(famiglia_id, chi, azione, descrizione, prima)
  values (acc.fid, v_chi, 'modifica_persona',
          'Modificata ' || _nome_persona(v_dopo)
            || case when p_foto is null then '' when p_foto = '' then ' (tolta la foto)' else ' (nuova foto)' end,
          jsonb_build_object('persona', to_jsonb(v_prima), 'foto_cambiata', p_foto is not null));
  return v_id;
end $$;

create or replace function albero_elimina_persona(p_chiave text, p_chi text, p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare acc record; v persone;
begin
  select * into acc from _accesso(p_chiave);
  select * into v from persone where id = p_id and famiglia_id = acc.fid for update;
  if not found then
    raise exception 'persona_non_trovata';
  end if;
  insert into registro(famiglia_id, chi, azione, descrizione, prima)
  values (acc.fid, _chi(p_chi), 'elimina_persona', 'Eliminata ' || _nome_persona(v),
          jsonb_build_object('persona', to_jsonb(v),
                             'relazioni', coalesce((select jsonb_agg(to_jsonb(r)) from relazioni r
                                                    where r.da = p_id or r.a = p_id), '[]'::jsonb)));
  delete from persone where id = p_id;
end $$;

-- ---------------------------------------------------------------- legami

create or replace function albero_salva_relazione(p_chiave text, p_chi text, p_tipo text,
                                                  p_da uuid, p_a uuid, p_dettaglio text default '')
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare acc record; v_id uuid; v_da uuid := p_da; v_a uuid := p_a; n1 text; n2 text;
begin
  select * into acc from _accesso(p_chiave);
  if p_tipo not in ('genitore', 'coppia') then
    raise exception 'tipo_non_valido';
  end if;
  if p_da = p_a then
    raise exception 'stessa_persona';
  end if;
  select _nome_persona(p) into n1 from persone p where p.id = p_da and p.famiglia_id = acc.fid;
  select _nome_persona(p) into n2 from persone p where p.id = p_a and p.famiglia_id = acc.fid;
  if n1 is null or n2 is null then
    raise exception 'persona_non_trovata';
  end if;
  if p_tipo = 'coppia' then
    v_da := least(p_da, p_a);
    v_a  := greatest(p_da, p_a);
  else
    -- non si puo' essere genitore del proprio genitore
    if exists (select 1 from relazioni r where r.tipo = 'genitore' and r.da = p_a and r.a = p_da) then
      raise exception 'legame_circolare';
    end if;
  end if;

  insert into relazioni(famiglia_id, tipo, da, a, dettaglio)
  values (acc.fid, p_tipo, v_da, v_a, left(coalesce(p_dettaglio, ''), 120))
  on conflict (tipo, da, a) do update set dettaglio = excluded.dettaglio
  returning id into v_id;

  insert into registro(famiglia_id, chi, azione, descrizione)
  values (acc.fid, _chi(p_chi), 'aggiunta_relazione',
          case when p_tipo = 'genitore' then n1 || ' indicato come genitore di ' || n2
               else n1 || ' e ' || n2 || ' indicati come coppia' end);
  return v_id;
end $$;

create or replace function albero_elimina_relazione(p_chiave text, p_chi text, p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare acc record; r relazioni; n1 text; n2 text;
begin
  select * into acc from _accesso(p_chiave);
  select * into r from relazioni where id = p_id and famiglia_id = acc.fid;
  if not found then
    raise exception 'legame_non_trovato';
  end if;
  select _nome_persona(p) into n1 from persone p where p.id = r.da;
  select _nome_persona(p) into n2 from persone p where p.id = r.a;
  insert into registro(famiglia_id, chi, azione, descrizione, prima)
  values (acc.fid, _chi(p_chi), 'elimina_relazione',
          case when r.tipo = 'genitore' then 'Tolto il legame: ' || n1 || ' genitore di ' || n2
               else 'Tolto il legame di coppia tra ' || n1 || ' e ' || n2 end,
          to_jsonb(r));
  delete from relazioni where id = p_id;
end $$;

-- ---------------------------------------------------------------- registro e annullamento

create or replace function albero_registro(p_chiave text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare acc record;
begin
  select * into acc from _accesso(p_chiave);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', r.id, 'quando', r.quando, 'chi', r.chi, 'azione', r.azione,
             'descrizione', r.descrizione,
             'annullabile', r.prima is not null and not r.ripristinato,
             'annullato', r.ripristinato) order by r.id desc)
    from (select * from registro where famiglia_id = acc.fid order by id desc limit 300) r), '[]'::jsonb);
end $$;

create or replace function albero_ripristina(p_chiave text, p_chi text, p_id bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare acc record; v registro; vp persone; cambiata boolean;
begin
  select * into acc from _accesso(p_chiave);
  select * into v from registro where id = p_id and famiglia_id = acc.fid for update;
  if not found or v.prima is null or v.ripristinato then
    raise exception 'non_annullabile';
  end if;

  if v.azione = 'elimina_persona' then
    vp := jsonb_populate_record(null::persone, v.prima->'persona');
    if vp.foto_id is not null and not exists (select 1 from foto where id = vp.foto_id) then
      vp.foto_id := null;
      vp.miniatura := '';
    end if;
    insert into persone select vp.* on conflict (id) do nothing;
    insert into relazioni
      select x.* from jsonb_populate_recordset(null::relazioni, v.prima->'relazioni') x
      where exists (select 1 from persone p where p.id = x.da and p.famiglia_id = acc.fid)
        and exists (select 1 from persone p where p.id = x.a and p.famiglia_id = acc.fid)
    on conflict do nothing;

  elsif v.azione = 'modifica_persona' then
    vp := jsonb_populate_record(null::persone, v.prima->'persona');
    cambiata := coalesce((v.prima->>'foto_cambiata')::boolean, false);
    if vp.foto_id is not null and not exists (select 1 from foto where id = vp.foto_id) then
      vp.foto_id := null;
      vp.miniatura := '';
    end if;
    update persone p set
      nome = vp.nome, cognome = vp.cognome, sesso = vp.sesso,
      data_nascita = vp.data_nascita, luogo_nascita = vp.luogo_nascita,
      deceduto = vp.deceduto, data_morte = vp.data_morte, note = vp.note,
      miniatura = case when cambiata then vp.miniatura else p.miniatura end,
      foto_id   = case when cambiata then vp.foto_id   else p.foto_id   end,
      aggiornato_da = _chi(p_chi), aggiornato_il = now()
    where p.id = vp.id and p.famiglia_id = acc.fid;
    if not found then
      raise exception 'persona_non_trovata';
    end if;

  elsif v.azione = 'elimina_relazione' then
    insert into relazioni
      select x.* from jsonb_populate_record(null::relazioni, v.prima) x
      where exists (select 1 from persone p where p.id = x.da and p.famiglia_id = acc.fid)
        and exists (select 1 from persone p where p.id = x.a and p.famiglia_id = acc.fid)
    on conflict do nothing;
    if not found then
      raise exception 'persona_non_trovata';
    end if;
  else
    raise exception 'non_annullabile';
  end if;

  update registro set ripristinato = true where id = p_id;
  insert into registro(famiglia_id, chi, azione, descrizione)
  values (acc.fid, _chi(p_chi), 'annullamento', 'Annullato: ' || v.descrizione);
end $$;

-- ---------------------------------------------------------------- copie serali

create or replace function albero_copie(p_chiave text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare acc record;
begin
  select * into acc from _accesso(p_chiave);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', c.id, 'giorno', c.giorno, 'creata_il', c.creata_il, 'motivo', c.motivo,
             'persone', jsonb_array_length(c.dati->'persone')) order by c.creata_il desc)
    from copie c where c.famiglia_id = acc.fid), '[]'::jsonb);
end $$;

create or replace function albero_copia(p_chiave text, p_copia_id bigint) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare acc record; d jsonb;
begin
  select * into acc from _accesso(p_chiave);
  select c.dati into d from copie c where c.id = p_copia_id and c.famiglia_id = acc.fid;
  if d is null then
    raise exception 'copia_non_trovata';
  end if;
  return d;
end $$;

-- rimette una sola persona com'era nella copia (e i suoi legami con chi esiste ancora)
create or replace function albero_ripristina_persona(p_chiave text, p_chi text, p_copia_id bigint, p_persona_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare acc record; d jsonb; vp persone; esisteva boolean;
begin
  select * into acc from _accesso(p_chiave);
  select c.dati into d from copie c where c.id = p_copia_id and c.famiglia_id = acc.fid;
  if d is null then
    raise exception 'copia_non_trovata';
  end if;
  select x.* into vp from jsonb_populate_recordset(null::persone, d->'persone') x where x.id = p_persona_id;
  if vp.id is null then
    raise exception 'persona_non_trovata';
  end if;
  vp.famiglia_id := acc.fid;
  if vp.foto_id is not null and not exists (select 1 from foto where id = vp.foto_id) then
    vp.foto_id := null;
    vp.miniatura := '';
  end if;
  esisteva := exists (select 1 from persone where id = vp.id);
  if esisteva then
    insert into registro(famiglia_id, chi, azione, descrizione, prima)
    select acc.fid, _chi(p_chi), 'modifica_persona',
           'Rimessa com''era il ' || to_char((select giorno from copie where id = p_copia_id), 'DD/MM/YYYY') || ': ' || _nome_persona(p),
           jsonb_build_object('persona', to_jsonb(p), 'foto_cambiata', true)
    from persone p where p.id = vp.id;
    update persone p set
      nome = vp.nome, cognome = vp.cognome, sesso = vp.sesso,
      data_nascita = vp.data_nascita, luogo_nascita = vp.luogo_nascita,
      deceduto = vp.deceduto, data_morte = vp.data_morte, note = vp.note,
      miniatura = vp.miniatura, foto_id = vp.foto_id,
      aggiornato_da = _chi(p_chi), aggiornato_il = now()
    where p.id = vp.id and p.famiglia_id = acc.fid;
  else
    insert into persone select vp.*;
    insert into registro(famiglia_id, chi, azione, descrizione)
    values (acc.fid, _chi(p_chi), 'aggiunta_persona',
            'Recuperata dalla copia del ' || to_char((select giorno from copie where id = p_copia_id), 'DD/MM/YYYY') || ': ' || _nome_persona(vp));
  end if;
  insert into relazioni
    select x.* from jsonb_populate_recordset(null::relazioni, d->'relazioni') x
    where (x.da = vp.id or x.a = vp.id)
      and exists (select 1 from persone p where p.id = x.da and p.famiglia_id = acc.fid)
      and exists (select 1 from persone p where p.id = x.a and p.famiglia_id = acc.fid)
  on conflict do nothing;
end $$;

-- rimette TUTTO l'albero com'era nella copia (solo referente); prima salva lo stato attuale
create or replace function albero_ripristina_copia(p_chiave text, p_chi text, p_copia_id bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare acc record; d jsonb; g date;
begin
  select * into acc from _accesso(p_chiave);
  if acc.ruolo <> 'referente' then
    raise exception 'serve_referente';
  end if;
  select c.dati, c.giorno into d, g from copie c where c.id = p_copia_id and c.famiglia_id = acc.fid;
  if d is null then
    raise exception 'copia_non_trovata';
  end if;
  insert into copie(famiglia_id, giorno, motivo, dati)
  values (acc.fid, (now() at time zone 'Europe/Rome')::date, 'prima del ripristino', _istantanea(acc.fid));

  delete from persone where famiglia_id = acc.fid;   -- i legami se ne vanno con le persone
  insert into persone
    select x.id, acc.fid, x.nome, x.cognome, x.sesso, x.data_nascita, x.luogo_nascita, x.deceduto,
           x.data_morte, x.note,
           case when exists (select 1 from foto f where f.id = x.foto_id) then x.miniatura else '' end,
           case when exists (select 1 from foto f where f.id = x.foto_id) then x.foto_id end,
           x.creato_da, x.creato_il, x.aggiornato_da, x.aggiornato_il
    from jsonb_populate_recordset(null::persone, d->'persone') x;
  insert into relazioni
    select x.id, acc.fid, x.tipo, x.da, x.a, x.dettaglio
    from jsonb_populate_recordset(null::relazioni, d->'relazioni') x
  on conflict do nothing;
  insert into registro(famiglia_id, chi, azione, descrizione)
  values (acc.fid, _chi(p_chi), 'ripristino_completo',
          'Albero rimesso com''era il ' || to_char(g, 'DD/MM/YYYY'));
end $$;

-- ---------------------------------------------------------------- referente

create or replace function albero_rinomina(p_chiave text, p_nome text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare acc record;
begin
  select * into acc from _accesso(p_chiave);
  if acc.ruolo <> 'referente' then
    raise exception 'serve_referente';
  end if;
  update famiglie set nome = left(trim(p_nome), 80) where id = acc.fid;
end $$;

-- nuovo link d'invito: quello vecchio smette di funzionare
create or replace function albero_nuovo_invito(p_chiave text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare acc record; k text := _nuova_chiave();
begin
  select * into acc from _accesso(p_chiave);
  if acc.ruolo <> 'referente' then
    raise exception 'serve_referente';
  end if;
  update famiglie set chiave = k where id = acc.fid;
  return k;
end $$;

-- ---------------------------------------------------------------- gestore

create or replace function gestore_famiglie(p_chiave text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _gestore(p_chiave);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', f.id, 'nome', f.nome, 'creata_il', f.creata_il, 'chiave', f.chiave,
      'persone', (select count(*) from persone p where p.famiglia_id = f.id),
      'foto', (select count(*) from persone p where p.famiglia_id = f.id and p.foto_id is not null),
      'ultima_modifica', (select max(r.quando) from registro r where r.famiglia_id = f.id),
      'ultima_copia', (select max(c.creata_il) from copie c where c.famiglia_id = f.id and c.motivo = 'serale'))
      order by f.nome)
    from famiglie f), '[]'::jsonb);
end $$;

-- restituisce le due chiavi in chiaro: e' l'unico momento in cui si vede quella del referente
create or replace function gestore_crea_famiglia(p_chiave text, p_nome text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare k text := _nuova_chiave(); ka text := _nuova_chiave(); v_id uuid;
begin
  perform _gestore(p_chiave);
  if coalesce(trim(p_nome), '') = '' then
    raise exception 'nome_mancante';
  end if;
  insert into famiglie(nome, chiave, admin_hash) values (left(trim(p_nome), 80), k, _hash(ka))
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'chiave', k, 'chiave_referente', ka);
end $$;

create or replace function gestore_nuovo_referente(p_chiave text, p_famiglia uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare ka text := _nuova_chiave();
begin
  perform _gestore(p_chiave);
  update famiglie set admin_hash = _hash(ka) where id = p_famiglia;
  if not found then
    raise exception 'famiglia_non_trovata';
  end if;
  return ka;
end $$;

-- per sicurezza bisogna riscrivere esattamente il nome della famiglia
create or replace function gestore_elimina_famiglia(p_chiave text, p_famiglia uuid, p_conferma text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _gestore(p_chiave);
  delete from famiglie where id = p_famiglia and nome = trim(p_conferma);
  if not found then
    raise exception 'conferma_errata';
  end if;
end $$;

-- esportazione completa di una famiglia, foto comprese (per la copia su OneDrive)
create or replace function gestore_esporta(p_chiave text, p_famiglia uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _gestore(p_chiave);
  return (select jsonb_build_object(
            'famiglia', jsonb_build_object('id', f.id, 'nome', f.nome, 'creata_il', f.creata_il),
            'esportata_il', now(),
            'dati', _istantanea(f.id),
            'foto', coalesce((select jsonb_object_agg(x.id, x.dati) from foto x
                              where x.famiglia_id = f.id
                                and exists (select 1 from persone p where p.foto_id = x.id)), '{}'::jsonb),
            'registro', coalesce((select jsonb_agg(to_jsonb(r) - 'famiglia_id' order by r.id)
                                  from registro r where r.famiglia_id = f.id), '[]'::jsonb))
          from famiglie f where f.id = p_famiglia);
end $$;

-- ---------------------------------------------------------------- permessi sulle funzioni

do $$
declare fn text;
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    return;
  end if;
  -- le interne non si chiamano da fuori
  foreach fn in array array['_hash(text)', '_nuova_chiave()', '_accesso(text)', '_gestore(text)',
                            '_nome_persona(persone)', '_chi(text)', '_istantanea(uuid)', '_copia_serale()'] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
  end loop;
  foreach fn in array array['albero_carica(text)', 'albero_foto(text, uuid)',
      'albero_salva_persona(text, text, jsonb, text, text)', 'albero_elimina_persona(text, text, uuid)',
      'albero_salva_relazione(text, text, text, uuid, uuid, text)', 'albero_elimina_relazione(text, text, uuid)',
      'albero_registro(text)', 'albero_ripristina(text, text, bigint)', 'albero_copie(text)',
      'albero_copia(text, bigint)', 'albero_ripristina_persona(text, text, bigint, uuid)',
      'albero_ripristina_copia(text, text, bigint)', 'albero_rinomina(text, text)', 'albero_nuovo_invito(text)',
      'gestore_famiglie(text)', 'gestore_crea_famiglia(text, text)', 'gestore_nuovo_referente(text, uuid)',
      'gestore_elimina_famiglia(text, uuid, text)', 'gestore_esporta(text, uuid)'] loop
    execute format('revoke all on function %s from public', fn);
    execute format('grant execute on function %s to anon', fn);
  end loop;
end $$;

-- ---------------------------------------------------------------- copia ogni sera (pg_cron)
-- alle 21:00 UTC = 22:00 ora solare italiana, 23:00 ora legale

do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'albero-copia-serale';
  perform cron.schedule('albero-copia-serale', '0 21 * * *', 'select public._copia_serale()');
  raise notice 'Copia serale programmata.';
exception when others then
  raise notice 'ATTENZIONE: copia serale NON programmata (%). Attivare pg_cron e rieseguire.', sqlerrm;
end $$;
