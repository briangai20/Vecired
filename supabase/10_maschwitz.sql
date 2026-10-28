-- VeciRed arranca en Ingeniero Maschwitz en lugar de Belén de Escobar.
-- Escobar queda como zona inactiva para abrirla más adelante.
-- Se puede correr más de una vez.

insert into public.zonas (id, nombre, activa) values
  ('maschwitz', 'Ingeniero Maschwitz', true)
on conflict (id) do update set nombre = excluded.nombre, activa = excluded.activa;

update public.zonas set activa = false where id = 'escobar';

-- Los comercios de prueba de Escobar pasan a Maschwitz (solo los de las
-- cuentas @demo.vecired.test; no toca comercios reales).
update public.comercios c
set zona_id = 'maschwitz', direccion = x.direccion, lat = x.lat, lng = x.lng
from (values
  ('Mercería La Aguja',      'Av. Independencia 1250, Ingeniero Maschwitz',     -34.38204, -58.73707),
  ('Ferretería El Tornillo', 'Mendoza 1100, Ingeniero Maschwitz',               -34.38167, -58.74743),
  ('Solido herrajes',        'Av. Benito Villanueva 1500, Ingeniero Maschwitz', -34.39523, -58.73961),
  ('Librería de Prueba',     'Mendoza 800, Ingeniero Maschwitz',                -34.38200, -58.74400)
) as x (nombre, direccion, lat, lng)
where c.nombre = x.nombre
  and c.zona_id = 'escobar'
  and exists (select 1 from auth.users u where u.id = c.dueno_id and u.email like '%@demo.vecired.test');
