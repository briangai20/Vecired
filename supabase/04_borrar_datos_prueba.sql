-- =====================================================================
-- Vecired · Borra los datos de prueba de 03_datos_prueba.sql
-- Al borrar los usuarios @demo.vecired.test se borran en cascada sus
-- perfiles, comercios, productos, reservas, reseñas y vistas.
-- Correrlo antes de lanzar con comercios reales.
-- =====================================================================
delete from auth.users where email like '%@demo.vecired.test';
