-- ============================================================================
-- QUINIELA LIGUILLA MX — instalación/reinicio controlado
-- ============================================================================
-- ADVERTENCIA: este script borra la competencia anterior y elimina de
-- Supabase Auth a todos los participantes, excepto las cuentas marcadas como
-- administradoras en public.profiles. Ejecútalo UNA sola vez en Supabase
-- SQL Editor; nunca lo agregues al proceso automático de despliegue.
-- ============================================================================

begin;

create temporary table _admins_backup (
  id uuid primary key,
  nombre text not null,
  email text not null
) on commit drop;

do $$
begin
  if to_regclass('public.profiles') is not null then
    insert into _admins_backup (id, nombre, email)
    select id, nombre, email
    from public.profiles
    where es_admin = true;
  end if;
end $$;

-- Elimina participantes y sus sesiones; conserva al administrador para no
-- bloquear el panel después del reinicio.
delete from auth.users
where id not in (select id from _admins_backup);

drop view if exists public.posiciones cascade;
drop view if exists public.vista_picks_puntos cascade;
drop function if exists public.calcular_puntos_partido(integer) cascade;
drop function if exists public.calcular_puntos_campeon(text) cascade;
drop function if exists public.configurar_liguilla(text[]) cascade;
drop function if exists public.actualizar_semifinalistas(text[]) cascade;
drop function if exists public.actualizar_finalistas(text[]) cascade;
drop function if exists public.reiniciar_competencia() cascade;
drop table if exists public.picks_campeon cascade;
drop table if exists public.picks cascade;
drop table if exists public.partidos cascade;
drop table if exists public.equipos cascade;
drop table if exists public.configuracion cascade;
drop table if exists public.profiles cascade;

create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  nombre text not null,
  email text not null unique,
  es_admin boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.profiles (id, nombre, email, es_admin)
select backup.id, backup.nombre, backup.email, true
from _admins_backup backup
join auth.users users on users.id = backup.id;

create table public.configuracion (
  id smallint primary key default 1 check (id = 1),
  configurada boolean not null default false,
  campeon_real text,
  updated_at timestamptz not null default now()
);
insert into public.configuracion (id) values (1);

create table public.equipos (
  id smallint primary key check (id between 1 and 8),
  posicion smallint not null unique check (posicion between 1 and 8),
  nombre text not null unique check (char_length(nombre) between 1 and 60)
);

create table public.partidos (
  id integer primary key check (id between 1 and 14),
  grupo text not null,
  llave smallint not null,
  equipo_a text not null,
  equipo_b text not null,
  jornada smallint not null check (jornada between 1 and 6),
  fase text not null check (fase in ('cuartos', 'semifinales', 'final')),
  vuelta smallint not null check (vuelta in (1, 2)),
  puntos_valor integer not null default 1,
  fecha_hora timestamptz,
  goles_a integer check (goles_a is null or goles_a >= 0),
  goles_b integer check (goles_b is null or goles_b >= 0),
  se_definio_penales boolean not null default false,
  cerrado boolean not null default false
);

create table public.picks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  partido_id integer references public.partidos(id) on delete cascade not null,
  pick text not null check (pick in ('A', 'empate', 'B')),
  goles_a_pred integer check (goles_a_pred is null or goles_a_pred >= 0),
  goles_b_pred integer check (goles_b_pred is null or goles_b_pred >= 0),
  predice_penales boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, partido_id)
);

create table public.picks_campeon (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null unique,
  equipo text not null,
  puntos integer not null default 0,
  created_at timestamptz not null default now()
);

create or replace function public.configurar_liguilla(p_equipos text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  equipos_limpios text[];
begin
  select array_agg(btrim(value) order by ord)
  into equipos_limpios
  from unnest(p_equipos) with ordinality as input(value, ord);

  if coalesce(array_length(equipos_limpios, 1), 0) <> 8 then
    raise exception 'Debes enviar exactamente 8 equipos';
  end if;
  if exists (select 1 from unnest(equipos_limpios) as item(value) where value = '' or char_length(value) > 60) then
    raise exception 'Los nombres de equipo no son válidos';
  end if;
  if (select count(distinct lower(value)) from unnest(equipos_limpios) as item(value)) <> 8 then
    raise exception 'Los equipos no pueden repetirse';
  end if;

  delete from public.picks_campeon;
  delete from public.picks;
  delete from public.partidos;
  delete from public.equipos;

  insert into public.equipos (id, posicion, nombre)
  select ord::smallint, ord::smallint, value
  from unnest(equipos_limpios) with ordinality as input(value, ord);

  -- Cuartos: el mejor sembrado cierra cada serie como local.
  insert into public.partidos (id, grupo, llave, equipo_a, equipo_b, jornada, fase, vuelta) values
    (1,  'Cuartos 1', 1, equipos_limpios[8], equipos_limpios[1], 1, 'cuartos', 1),
    (2,  'Cuartos 2', 2, equipos_limpios[7], equipos_limpios[2], 1, 'cuartos', 1),
    (3,  'Cuartos 3', 3, equipos_limpios[6], equipos_limpios[3], 1, 'cuartos', 1),
    (4,  'Cuartos 4', 4, equipos_limpios[5], equipos_limpios[4], 1, 'cuartos', 1),
    (5,  'Cuartos 1', 1, equipos_limpios[1], equipos_limpios[8], 2, 'cuartos', 2),
    (6,  'Cuartos 2', 2, equipos_limpios[2], equipos_limpios[7], 2, 'cuartos', 2),
    (7,  'Cuartos 3', 3, equipos_limpios[3], equipos_limpios[6], 2, 'cuartos', 2),
    (8,  'Cuartos 4', 4, equipos_limpios[4], equipos_limpios[5], 2, 'cuartos', 2),
    (9,  'Semifinal 1', 1, 'Ganador Cuartos 1', 'Ganador Cuartos 4', 3, 'semifinales', 1),
    (10, 'Semifinal 2', 2, 'Ganador Cuartos 2', 'Ganador Cuartos 3', 3, 'semifinales', 1),
    (11, 'Semifinal 1', 1, 'Ganador Cuartos 4', 'Ganador Cuartos 1', 4, 'semifinales', 2),
    (12, 'Semifinal 2', 2, 'Ganador Cuartos 3', 'Ganador Cuartos 2', 4, 'semifinales', 2),
    (13, 'Final', 1, 'Finalista 1', 'Finalista 2', 5, 'final', 1),
    (14, 'Final', 1, 'Finalista 2', 'Finalista 1', 6, 'final', 2);

  update public.configuracion
  set configurada = true, campeon_real = null, updated_at = now()
  where id = 1;
end;
$$;

create or replace function public.actualizar_semifinalistas(p_equipos text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e text[];
begin
  select array_agg(btrim(value) order by ord) into e
  from unnest(p_equipos) with ordinality as input(value, ord);
  if coalesce(array_length(e, 1), 0) <> 4 or (select count(distinct lower(value)) from unnest(e) as item(value)) <> 4 then
    raise exception 'Debes enviar 4 semifinalistas distintos';
  end if;
  if exists (select 1 from unnest(e) as item(value) where not exists (select 1 from public.equipos where lower(nombre) = lower(value))) then
    raise exception 'Todos los semifinalistas deben pertenecer a los 8 equipos';
  end if;
  delete from public.picks where partido_id between 9 and 14;
  update public.partidos set equipo_a=e[1], equipo_b=e[2], goles_a=null, goles_b=null, cerrado=false, se_definio_penales=false where id=9;
  update public.partidos set equipo_a=e[3], equipo_b=e[4], goles_a=null, goles_b=null, cerrado=false, se_definio_penales=false where id=10;
  update public.partidos set equipo_a=e[2], equipo_b=e[1], goles_a=null, goles_b=null, cerrado=false, se_definio_penales=false where id=11;
  update public.partidos set equipo_a=e[4], equipo_b=e[3], goles_a=null, goles_b=null, cerrado=false, se_definio_penales=false where id=12;
  update public.partidos set equipo_a='Finalista 1', equipo_b='Finalista 2', goles_a=null, goles_b=null, cerrado=false, se_definio_penales=false where id=13;
  update public.partidos set equipo_a='Finalista 2', equipo_b='Finalista 1', goles_a=null, goles_b=null, cerrado=false, se_definio_penales=false where id=14;
end;
$$;

create or replace function public.actualizar_finalistas(p_equipos text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e text[];
begin
  select array_agg(btrim(value) order by ord) into e
  from unnest(p_equipos) with ordinality as input(value, ord);
  if coalesce(array_length(e, 1), 0) <> 2 or lower(e[1]) = lower(e[2]) then
    raise exception 'Debes enviar 2 finalistas distintos';
  end if;
  if exists (select 1 from unnest(e) as item(value) where not exists (select 1 from public.equipos where lower(nombre) = lower(value))) then
    raise exception 'Los finalistas deben pertenecer a los 8 equipos';
  end if;
  delete from public.picks where partido_id between 13 and 14;
  update public.partidos set equipo_a=e[1], equipo_b=e[2], goles_a=null, goles_b=null, cerrado=false, se_definio_penales=false where id=13;
  update public.partidos set equipo_a=e[2], equipo_b=e[1], goles_a=null, goles_b=null, cerrado=false, se_definio_penales=false where id=14;
end;
$$;

create or replace function public.reiniciar_competencia()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.profiles where es_admin = false;
  perform public.configurar_liguilla(array[
    'Equipo 1','Equipo 2','Equipo 3','Equipo 4',
    'Equipo 5','Equipo 6','Equipo 7','Equipo 8'
  ]::text[]);
  update public.configuracion set configurada = false, updated_at = now() where id = 1;
end;
$$;

-- Marcador, aciertos y puntuación se calculan en una vista; no hay triggers ni
-- contadores que puedan quedar desincronizados.
create view public.vista_picks_puntos
with (security_invoker = true)
as
select
  pick.id as pick_id,
  pick.user_id,
  pick.partido_id,
  pick.pick as mi_ganador_pred,
  pick.goles_a_pred,
  pick.goles_b_pred,
  pick.predice_penales,
  partido.equipo_a,
  partido.equipo_b,
  partido.goles_a as goles_a_reales,
  partido.goles_b as goles_b_reales,
  partido.se_definio_penales,
  partido.jornada,
  partido.fase,
  partido.puntos_valor as puntos_fase,
  case
    when partido.goles_a is null or partido.goles_b is null then null
    when partido.goles_a > partido.goles_b then 'A'
    when partido.goles_b > partido.goles_a then 'B'
    else 'empate'
  end as resultado_real,
  case when partido.goles_a is not null and partido.goles_b is not null and pick.pick =
    case when partido.goles_a > partido.goles_b then 'A' when partido.goles_b > partido.goles_a then 'B' else 'empate' end
    then 1 else 0 end as acerto_ganador,
  case when partido.goles_a is not null and partido.goles_b is not null and pick.goles_a_pred = partido.goles_a and pick.goles_b_pred = partido.goles_b
    then 1 else 0 end as acerto_marcador_exacto,
  case when partido.goles_a is not null and pick.predice_penales and partido.se_definio_penales then 1 else 0 end as acerto_tanda_penales,
  case when partido.goles_a is null or partido.goles_b is null then 0 else
    (case when pick.pick = case when partido.goles_a > partido.goles_b then 'A' when partido.goles_b > partido.goles_a then 'B' else 'empate' end then partido.puntos_valor else 0 end)
    + (case when pick.goles_a_pred = partido.goles_a and pick.goles_b_pred = partido.goles_b then 1 else 0 end)
    + (case when pick.predice_penales and partido.se_definio_penales then 1 else 0 end)
  end as puntos
from public.picks pick
join public.partidos partido on partido.id = pick.partido_id;

create view public.posiciones
with (security_invoker = true)
as
select
  profile.id as user_id,
  profile.nombre,
  coalesce(sum(vista.puntos), 0)::integer + coalesce(campeon.puntos, 0) as puntos_total,
  coalesce(sum(vista.acerto_ganador), 0)::integer as picks_correctos,
  count(vista.pick_id)::integer as picks_totales
from public.profiles profile
left join public.vista_picks_puntos vista on vista.user_id = profile.id
left join public.picks_campeon campeon on campeon.user_id = profile.id
group by profile.id, profile.nombre, campeon.puntos;

-- Equipos y calendario iniciales; el administrador los reemplaza desde la app.
select public.configurar_liguilla(array[
  'Equipo 1','Equipo 2','Equipo 3','Equipo 4',
  'Equipo 5','Equipo 6','Equipo 7','Equipo 8'
]::text[]);
update public.configuracion set configurada = false where id = 1;

alter table public.profiles enable row level security;
alter table public.configuracion enable row level security;
alter table public.equipos enable row level security;
alter table public.partidos enable row level security;
alter table public.picks enable row level security;
alter table public.picks_campeon enable row level security;

create policy "Perfiles visibles" on public.profiles for select to authenticated using (true);
create policy "Configuración visible" on public.configuracion for select to authenticated using (true);
create policy "Equipos visibles" on public.equipos for select to authenticated using (true);
create policy "Partidos visibles" on public.partidos for select to authenticated using (true);
create policy "Picks visibles" on public.picks for select to authenticated using (true);
create policy "Insertar pick propio abierto" on public.picks for insert to authenticated
with check (
  auth.uid() = user_id and exists (
    select 1 from public.partidos partido
    where partido.id = partido_id
      and not partido.cerrado
      and (partido.fecha_hora is null or partido.fecha_hora > now())
  )
);
create policy "Actualizar pick propio abierto" on public.picks for update to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id and exists (
    select 1 from public.partidos partido
    where partido.id = partido_id
      and not partido.cerrado
      and (partido.fecha_hora is null or partido.fecha_hora > now())
  )
);
create policy "Picks de campeón visibles" on public.picks_campeon for select to authenticated using (true);
create policy "Insertar campeón propio" on public.picks_campeon for insert to authenticated
with check (auth.uid() = user_id and exists (select 1 from public.configuracion where id = 1 and campeon_real is null));

revoke all on function public.configurar_liguilla(text[]) from public, anon, authenticated;
revoke all on function public.actualizar_semifinalistas(text[]) from public, anon, authenticated;
revoke all on function public.actualizar_finalistas(text[]) from public, anon, authenticated;
revoke all on function public.reiniciar_competencia() from public, anon, authenticated;
grant execute on function public.configurar_liguilla(text[]) to service_role;
grant execute on function public.actualizar_semifinalistas(text[]) to service_role;
grant execute on function public.actualizar_finalistas(text[]) to service_role;
grant execute on function public.reiniciar_competencia() to service_role;
grant select on public.vista_picks_puntos, public.posiciones to authenticated;

commit;

-- Si no existía una cuenta administradora antes del reinicio, crea primero el
-- usuario desde Supabase Authentication y después ejecuta, cambiando el email:
-- insert into public.profiles (id, nombre, email, es_admin)
-- select id, 'Administrador', email, true from auth.users where email = 'tu@correo.com';
