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
