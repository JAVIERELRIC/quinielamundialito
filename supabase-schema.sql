-- =====================================================
-- QUINIELA MUNDIAL 2026 — Schema de Supabase
-- Ejecuta este SQL en Supabase → SQL Editor
-- =====================================================

-- Tabla de usuarios (complementa auth.users de Supabase)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  nombre text not null,
  email text not null,
  es_admin boolean default false,
  created_at timestamptz default now()
);

-- Tabla de partidos (se pueden agregar fechas reales desde el admin)
create table public.partidos (
  id integer primary key,
  grupo text not null,
  equipo_a text not null,
  equipo_b text not null,
  jornada integer not null,
  fecha_hora timestamptz,        -- null hasta que el admin la cargue
  goles_a integer,               -- null hasta que el admin cargue el resultado
  goles_b integer,               -- null hasta que el admin cargue el resultado
  cerrado boolean default false  -- se cierra cuando empieza el partido
);

-- Tabla de picks de los participantes
create table public.picks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  partido_id integer references public.partidos(id) not null,
  pick text check (pick in ('A', 'empate', 'B')) not null,  -- A=gana equipo A, B=gana equipo B
  puntos integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, partido_id)
);

-- Tabla de posiciones (se recalcula automáticamente con un trigger)
create table public.posiciones (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  puntos_total integer default 0,
  picks_correctos integer default 0,
  picks_totales integer default 0,
  updated_at timestamptz default now()
);

-- =====================================================
-- Función para calcular puntos cuando el admin carga resultado
-- =====================================================
create or replace function calcular_puntos_partido(p_partido_id integer)
returns void as $$
declare
  v_goles_a integer;
  v_goles_b integer;
  v_resultado text;
  v_pick record;
begin
  select goles_a, goles_b into v_goles_a, v_goles_b
  from public.partidos where id = p_partido_id;

  if v_goles_a is null or v_goles_b is null then return; end if;

  if v_goles_a > v_goles_b then v_resultado := 'A';
  elsif v_goles_b > v_goles_a then v_resultado := 'B';
  else v_resultado := 'empate';
  end if;

  -- Actualizar puntos de cada pick
  for v_pick in select * from public.picks where partido_id = p_partido_id loop
    if v_pick.pick = v_resultado then
      update public.picks set puntos = 1, updated_at = now()
      where id = v_pick.id;
    else
      update public.picks set puntos = 0, updated_at = now()
      where id = v_pick.id;
    end if;
  end loop;

  -- Recalcular posiciones de todos
  insert into public.posiciones (user_id, puntos_total, picks_correctos, picks_totales, updated_at)
  select
    p.user_id,
    sum(p.puntos) as puntos_total,
    count(case when p.puntos = 1 then 1 end) as picks_correctos,
    count(*) as picks_totales,
    now()
  from public.picks p
  group by p.user_id
  on conflict (user_id) do update set
    puntos_total = excluded.puntos_total,
    picks_correctos = excluded.picks_correctos,
    picks_totales = excluded.picks_totales,
    updated_at = now();
end;
$$ language plpgsql security definer;

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================
alter table public.profiles enable row level security;
alter table public.partidos enable row level security;
alter table public.picks enable row level security;
alter table public.posiciones enable row level security;

-- Profiles: cada quien ve todos, solo edita el suyo
create policy "Profiles visibles para todos" on public.profiles for select using (true);
create policy "Solo editas tu perfil" on public.profiles for update using (auth.uid() = id);
create policy "Insertar perfil propio" on public.profiles for insert with check (auth.uid() = id);

-- Partidos: todos pueden ver, solo admins editan
create policy "Partidos visibles para todos" on public.partidos for select using (true);
create policy "Solo admin edita partidos" on public.partidos for all
  using (exists (select 1 from public.profiles where id = auth.uid() and es_admin = true));

-- Picks: cada quien ve y edita los suyos, no pueden editar picks de otros
create policy "Ver picks propios" on public.picks for select using (auth.uid() = user_id);
create policy "Insertar pick propio" on public.picks for insert with check (auth.uid() = user_id);
create policy "Actualizar pick propio" on public.picks for update using (auth.uid() = user_id);

-- Posiciones: todos pueden ver
create policy "Posiciones visibles para todos" on public.posiciones for select using (true);

-- =====================================================
-- Insertar los 72 partidos iniciales (sin fechas, el admin las agrega)
-- =====================================================
insert into public.partidos (id, grupo, equipo_a, equipo_b, jornada) values
(1,'A','México','Sudáfrica',1),(2,'A','Rep. de Corea','Chequia',1),
(3,'A','México','Rep. de Corea',2),(4,'A','Sudáfrica','Chequia',2),
(5,'A','México','Chequia',3),(6,'A','Sudáfrica','Rep. de Corea',3),
(7,'B','Canadá','Bosnia y Herzegovina',1),(8,'B','Catar','Suiza',1),
(9,'B','Canadá','Catar',2),(10,'B','Bosnia y Herzegovina','Suiza',2),
(11,'B','Canadá','Suiza',3),(12,'B','Bosnia y Herzegovina','Catar',3),
(13,'C','Brasil','Marruecos',1),(14,'C','Haití','Escocia',1),
(15,'C','Brasil','Haití',2),(16,'C','Marruecos','Escocia',2),
(17,'C','Brasil','Escocia',3),(18,'C','Marruecos','Haití',3),
(19,'D','USA','Paraguay',1),(20,'D','Australia','Turquía',1),
(21,'D','USA','Australia',2),(22,'D','Paraguay','Turquía',2),
(23,'D','USA','Turquía',3),(24,'D','Paraguay','Australia',3),
(25,'E','Alemania','Curazao',1),(26,'E','Costa de Marfil','Ecuador',1),
(27,'E','Alemania','Costa de Marfil',2),(28,'E','Curazao','Ecuador',2),
(29,'E','Alemania','Ecuador',3),(30,'E','Curazao','Costa de Marfil',3),
(31,'F','Países Bajos','Japón',1),(32,'F','Suecia','Túnez',1),
(33,'F','Países Bajos','Suecia',2),(34,'F','Japón','Túnez',2),
(35,'F','Países Bajos','Túnez',3),(36,'F','Japón','Suecia',3),
(37,'G','Bélgica','Egipto',1),(38,'G','Irán','Nueva Zelanda',1),
(39,'G','Bélgica','Irán',2),(40,'G','Egipto','Nueva Zelanda',2),
(41,'G','Bélgica','Nueva Zelanda',3),(42,'G','Egipto','Irán',3),
(43,'H','España','Cabo Verde',1),(44,'H','Arabia Saudita','Uruguay',1),
(45,'H','España','Arabia Saudita',2),(46,'H','Cabo Verde','Uruguay',2),
(47,'H','España','Uruguay',3),(48,'H','Cabo Verde','Arabia Saudita',3),
(49,'I','Francia','Senegal',1),(50,'I','Irak','Noruega',1),
(51,'I','Francia','Irak',2),(52,'I','Senegal','Noruega',2),
(53,'I','Francia','Noruega',3),(54,'I','Senegal','Irak',3),
(55,'J','Argentina','Argelia',1),(56,'J','Austria','Jordania',1),
(57,'J','Argentina','Austria',2),(58,'J','Argelia','Jordania',2),
(59,'J','Argentina','Jordania',3),(60,'J','Argelia','Austria',3),
(61,'K','Portugal','Congo',1),(62,'K','Uzbekistán','Colombia',1),
(63,'K','Portugal','Uzbekistán',2),(64,'K','Congo','Colombia',2),
(65,'K','Portugal','Colombia',3),(66,'K','Congo','Uzbekistán',3),
(67,'L','Inglaterra','Croacia',1),(68,'L','Ghana','Panamá',1),
(69,'L','Inglaterra','Ghana',2),(70,'L','Croacia','Panamá',2),
(71,'L','Inglaterra','Panamá',3),(72,'L','Croacia','Ghana',3);
