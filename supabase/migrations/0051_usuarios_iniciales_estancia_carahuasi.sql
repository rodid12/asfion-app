-- =============================================================================
-- 0051 — Usuarios iniciales de Estancia Carahuasi
-- =============================================================================
-- Encargados:
--   - Sebastián Zárate: solamente Campo Carahuasi.
--   - Richar Espíndola: solamente Campo La Población.
-- Dueños y secretaría:
--   - Hugo Saravia, Hugo Saravia Olmos y Zoe Torres: administradores del
--     cliente; pueden consultar y trabajar sobre ambos campos.
-- Juan Alvarado queda expresamente fuera hasta nueva confirmación.
-- =============================================================================

INSERT INTO public.usuarios (
  email,
  cliente_id,
  nombre,
  apellido,
  rol,
  campo_asignado_id
)
VALUES
  (
    'richarespindola9@gmail.com',
    'estancia-carahuasi',
    'Richar',
    'Espíndola',
    'operario',
    'campo-estancia-carahuasi-la-poblacion'
  ),
  (
    'sebaszar20@gmail.com',
    'estancia-carahuasi',
    'Sebastián',
    'Zárate',
    'operario',
    'campo-estancia-carahuasi-carahuasi'
  ),
  (
    'huguito@saraviaolmos.com',
    'estancia-carahuasi',
    'Hugo',
    'Saravia',
    'administrador',
    NULL
  ),
  (
    'hugo@saraviaolmos.com',
    'estancia-carahuasi',
    'Hugo',
    'Saravia Olmos',
    'administrador',
    NULL
  ),
  (
    'ztorreshuidobro@gmail.com',
    'estancia-carahuasi',
    'Zoe',
    'Torres',
    'administrador',
    NULL
  )
ON CONFLICT (email) DO UPDATE SET
  cliente_id = EXCLUDED.cliente_id,
  nombre = EXCLUDED.nombre,
  apellido = EXCLUDED.apellido,
  rol = EXCLUDED.rol,
  campo_asignado_id = EXCLUDED.campo_asignado_id;

SELECT
  u.email,
  concat_ws(' ', u.nombre, u.apellido) AS nombre,
  u.rol,
  c.nombre AS campo_asignado,
  u.cliente_id
FROM public.usuarios u
LEFT JOIN public.campos c ON c.id = u.campo_asignado_id
WHERE u.email IN (
  'richarespindola9@gmail.com',
  'sebaszar20@gmail.com',
  'huguito@saraviaolmos.com',
  'hugo@saraviaolmos.com',
  'ztorreshuidobro@gmail.com'
)
ORDER BY u.rol, u.email;
