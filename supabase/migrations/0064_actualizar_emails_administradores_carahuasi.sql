-- =============================================================================
-- 0064 · Corrección de emails de administradores de Estancia Carahuasi
-- =============================================================================
-- Conserva cliente, rol, nombre, permisos y fecha de alta. Solo reemplaza los
-- emails inicialmente informados por las cuentas Google que usarán realmente.
-- Idempotente: si el email nuevo ya existe, no crea ni pisa otro perfil.
-- =============================================================================

BEGIN;

UPDATE public.usuarios
SET email = 'torreshuidobrozoe@gmail.com'
WHERE cliente_id = 'estancia-carahuasi'
  AND LOWER(email) = 'ztorreshuidobro@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE LOWER(email) = 'torreshuidobrozoe@gmail.com'
  );

UPDATE public.usuarios
SET email = 'hugosaravia.carahuasi@gmail.com'
WHERE cliente_id = 'estancia-carahuasi'
  AND LOWER(email) = 'huguito@saraviaolmos.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE LOWER(email) = 'hugosaravia.carahuasi@gmail.com'
  );

UPDATE public.usuarios
SET email = 'hugosaraviafigueroa@gmail.com'
WHERE cliente_id = 'estancia-carahuasi'
  AND LOWER(email) = 'hugo@saraviaolmos.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE LOWER(email) = 'hugosaraviafigueroa@gmail.com'
  );

COMMIT;

SELECT
  email,
  cliente_id,
  nombre,
  apellido,
  rol,
  campo_asignado_id,
  created_at
FROM public.usuarios
WHERE cliente_id = 'estancia-carahuasi'
ORDER BY rol, email;
