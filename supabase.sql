-- =====================================================================
--  LineHot — guardado en la nube (Supabase)
--  Pégalo completo en: Supabase -> SQL Editor -> New query -> Run
--  Se puede ejecutar más de una vez sin romper nada.
-- =====================================================================

-- 1) Tabla: una fila por jugador (usuario anónimo) y por clave guardada
create table if not exists public.linehot_datos (
    user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
    clave      text        not null check (clave ~ '^[A-Za-z0-9_.-]{1,60}$'),
    valor      text        not null check (char_length(valor) <= 200000),
    updated_at timestamptz not null default now(),
    primary key (user_id, clave)
);

-- 2) La fecha de modificación la pone siempre el servidor
create or replace function public.linehot_tocar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists linehot_datos_tocar on public.linehot_datos;
create trigger linehot_datos_tocar
    before insert or update on public.linehot_datos
    for each row execute function public.linehot_tocar();

-- 3) Seguridad: cada jugador solo ve y modifica SUS filas
alter table public.linehot_datos enable row level security;

drop policy if exists "linehot_leer"     on public.linehot_datos;
drop policy if exists "linehot_insertar" on public.linehot_datos;
drop policy if exists "linehot_cambiar"  on public.linehot_datos;
drop policy if exists "linehot_borrar"   on public.linehot_datos;

create policy "linehot_leer"     on public.linehot_datos for select to authenticated
    using ((select auth.uid()) = user_id);
create policy "linehot_insertar" on public.linehot_datos for insert to authenticated
    with check ((select auth.uid()) = user_id);
create policy "linehot_cambiar"  on public.linehot_datos for update to authenticated
    using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "linehot_borrar"   on public.linehot_datos for delete to authenticated
    using ((select auth.uid()) = user_id);

-- 4) Permisos (los usuarios anónimos usan el rol "authenticated"; sin sesión no hay acceso)
revoke all on public.linehot_datos from anon;
grant select, insert, update, delete on public.linehot_datos to authenticated;

-- =====================================================================
--  OPCIONAL (ejecútalo a mano de vez en cuando): borrar jugadores anónimos
--  que no han entrado en 90 días y todos sus datos.
-- =====================================================================
-- delete from auth.users
--  where is_anonymous
--    and coalesce(last_sign_in_at, created_at) < now() - interval '90 days';


-- =====================================================================
--  RANKING ONLINE  (añadido en v2.3)  ·  también se puede ejecutar más de una vez
--  La tabla NO se toca desde el juego: solo se entra por las 2 funciones de abajo,
--  que validan nombre, límites y frecuencia. Cada jugador conserva su MEJOR puntuación
--  (una fila para el ranking mundial y una por cada día del reto diario).
-- =====================================================================
create table if not exists public.linehot_ranking (
    user_id    uuid        not null references auth.users (id) on delete cascade,
    modo       text        not null check (modo in ('global', 'diario')),
    dia        date        not null default date '2000-01-01',      -- en 'global' es siempre esta fecha fija
    nombre     text        not null check (nombre ~ '^[A-Za-z0-9_ .-]{3,14}$'),
    puntos     integer     not null check (puntos between 0 and 50000000),
    oleada     integer     not null check (oleada between 0 and 500),
    combo      integer     not null default 0 check (combo between 0 and 100000),
    kills      integer     not null default 0 check (kills between 0 and 1000000),
    updated_at timestamptz not null default now(),
    primary key (user_id, modo, dia)
);
create index if not exists linehot_ranking_top on public.linehot_ranking (modo, dia, puntos desc);

alter table public.linehot_ranking enable row level security;           -- sin políticas = acceso directo cerrado
revoke all on public.linehot_ranking from anon, authenticated;

-- Enviar una puntuación (solo sustituye la anterior si es mejor; el nombre se actualiza siempre)
create or replace function public.linehot_enviar(
    p_nombre text, p_puntos integer, p_oleada integer, p_combo integer, p_kills integer,
    p_diario boolean default false, p_dia date default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
    uid     uuid := auth.uid();
    v_modo  text := case when p_diario then 'diario' else 'global' end;
    v_dia   date := case when p_diario then p_dia else date '2000-01-01' end;
    v_hoy   date := (now() at time zone 'utc')::date;
    v_ult   timestamptz;
    v_mio   integer;
    v_puesto integer;
    v_total  integer;
begin
    if uid is null then raise exception 'sin sesión'; end if;
    p_nombre := btrim(coalesce(p_nombre, ''));
    if p_nombre !~ '^[A-Za-z0-9_ .-]{3,14}$' then raise exception 'nombre no válido (3-14 letras, números, espacio . _ -)'; end if;
    if p_puntos is null or p_puntos < 1 or p_puntos > 50000000 then raise exception 'puntuación fuera de rango'; end if;
    if p_oleada is null or p_oleada < 1 or p_oleada > 500 then raise exception 'oleada fuera de rango'; end if;
    if p_puntos > p_oleada * 3000000 then raise exception 'puntuación no plausible'; end if;
    if p_diario and (v_dia is null or abs(v_dia - v_hoy) > 1) then raise exception 'fecha del reto no válida'; end if;

    -- freno: como mucho un envío cada 5 s por jugador y tablero
    select max(updated_at) into v_ult from public.linehot_ranking where user_id = uid and modo = v_modo and dia = v_dia;
    if v_ult is not null and v_ult > now() - interval '5 seconds' then raise exception 'demasiado rápido, espera unos segundos'; end if;

    insert into public.linehot_ranking as r (user_id, modo, dia, nombre, puntos, oleada, combo, kills)
    values (uid, v_modo, v_dia, p_nombre, p_puntos, p_oleada, greatest(coalesce(p_combo, 0), 0), greatest(coalesce(p_kills, 0), 0))
    on conflict (user_id, modo, dia) do update set
        nombre     = excluded.nombre,
        puntos     = case when excluded.puntos > r.puntos then excluded.puntos else r.puntos end,
        oleada     = case when excluded.puntos > r.puntos then excluded.oleada else r.oleada end,
        combo      = case when excluded.puntos > r.puntos then excluded.combo  else r.combo  end,
        kills      = case when excluded.puntos > r.puntos then excluded.kills  else r.kills  end,
        updated_at = now();

    select puntos into v_mio from public.linehot_ranking where user_id = uid and modo = v_modo and dia = v_dia;
    select count(*) + 1 into v_puesto from public.linehot_ranking where modo = v_modo and dia = v_dia and puntos > v_mio;
    select count(*)     into v_total  from public.linehot_ranking where modo = v_modo and dia = v_dia;
    return json_build_object('puesto', v_puesto, 'total', v_total, 'puntos', v_mio, 'record', p_puntos >= v_mio);
end;
$$;

-- Leer el ranking: los mejores + tu propia posición
create or replace function public.linehot_top(p_diario boolean default false, p_dia date default null, p_limite integer default 25)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    uid    uuid := auth.uid();
    v_modo text := case when p_diario then 'diario' else 'global' end;
    v_dia  date := case when p_diario then coalesce(p_dia, (now() at time zone 'utc')::date) else date '2000-01-01' end;
    v_top  json;
    v_yo   json;
begin
    if uid is null then raise exception 'sin sesión'; end if;
    select coalesce(json_agg(t order by t.puesto), '[]'::json) into v_top from (
        select row_number() over (order by puntos desc, updated_at asc) as puesto,
               nombre, puntos, oleada, combo, (user_id = uid) as yo
          from public.linehot_ranking
         where modo = v_modo and dia = v_dia
         order by puntos desc, updated_at asc
         limit least(greatest(coalesce(p_limite, 25), 1), 50)
    ) t;
    select json_build_object('puesto', (select count(*) + 1 from public.linehot_ranking x where x.modo = v_modo and x.dia = v_dia and x.puntos > r.puntos),
                             'nombre', r.nombre, 'puntos', r.puntos, 'oleada', r.oleada, 'combo', r.combo)
      into v_yo from public.linehot_ranking r where r.user_id = uid and r.modo = v_modo and r.dia = v_dia;
    return json_build_object('top', v_top, 'yo', v_yo,
                             'total', (select count(*) from public.linehot_ranking where modo = v_modo and dia = v_dia));
end;
$$;

revoke all on function public.linehot_enviar(text, integer, integer, integer, integer, boolean, date) from public, anon;
revoke all on function public.linehot_top(boolean, date, integer) from public, anon;
grant execute on function public.linehot_enviar(text, integer, integer, integer, integer, boolean, date) to authenticated;
grant execute on function public.linehot_top(boolean, date, integer) to authenticated;
