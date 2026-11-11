-- =====================================================================
-- VeciRed · Avisos en el celular con la página cerrada (notificaciones push)
--
-- 1. Cada celular o compu donde la persona activó los avisos guarda su
--    "suscripción" (la dirección a la que el navegador recibe avisos).
-- 2. Cuando la base crea una notificación (ver 15_mensajes_y_notificaciones),
--    le avisa al servidor de VeciRed (/api/push) con pg_net, y el servidor
--    la manda a todos los aparatos de esa persona.
--
-- El servidor no confía en quien lo llama: solo manda notificaciones que
-- existen, que se crearon hace menos de 5 minutos y que todavía no se
-- mandaron. Así nadie puede usar /api/push para molestar a otros.
-- =====================================================================

create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------
-- 1. Suscripciones
-- ---------------------------------------------------------------------
create table public.suscripciones_push (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%' and length(endpoint) <= 1000),
  p256dh text not null check (length(p256dh) <= 200),
  auth text not null check (length(auth) <= 100),
  creada_en timestamptz not null default now()
);
create index on public.suscripciones_push (usuario_id);

alter table public.suscripciones_push enable row level security;

create policy "suscripciones: ver las propias" on public.suscripciones_push
  for select to authenticated
  using (usuario_id = (select auth.uid()));
create policy "suscripciones: borrar las propias" on public.suscripciones_push
  for delete to authenticated
  using (usuario_id = (select auth.uid()));

revoke all on public.suscripciones_push from anon, authenticated;
grant select, delete on public.suscripciones_push to authenticated;

-- Guarda (o pasa a mi nombre) la suscripción de este aparato. Si en la
-- misma compu entra otra persona, los avisos pasan a ser de quien entró.
create function public.guardar_suscripcion_push(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Ingresá a tu cuenta para activar los avisos';
  end if;
  insert into public.suscripciones_push (usuario_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set usuario_id = excluded.usuario_id, p256dh = excluded.p256dh, auth = excluded.auth, creada_en = now();
  -- Como máximo 10 aparatos por persona: se van los más viejos.
  delete from public.suscripciones_push
  where usuario_id = auth.uid()
    and id not in (select id from public.suscripciones_push where usuario_id = auth.uid() order by creada_en desc limit 10);
end;
$$;
revoke execute on function public.guardar_suscripcion_push(text, text, text) from public, anon;
grant execute on function public.guardar_suscripcion_push(text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Envío
-- ---------------------------------------------------------------------
alter table public.notificaciones add column push_enviada_en timestamptz;

-- Al crear una notificación, si la persona tiene algún aparato con avisos
-- activados, se le pide al servidor que la mande. pg_net la envía recién
-- cuando se confirma el cambio, y no frena nada si el servidor no responde.
create function public.pedir_push()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.suscripciones_push where usuario_id = new.usuario_id) then
    perform net.http_post(
      url := 'https://vecired.com.ar/api/push',
      body := jsonb_build_object('id', new.id),
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 5000
    );
  end if;
  return new;
end;
$$;
revoke execute on function public.pedir_push() from public, anon, authenticated;

create trigger pedir_push_al_notificar
  after insert on public.notificaciones
  for each row execute function public.pedir_push();
