-- =============================================================================
-- 0034 — Lista autorizada de usuarios Ganaderas (Usuarios.xlsx)
-- =============================================================================
-- Fuente: Usuarios.xlsx, Hoja1!A2:D19 (18 usuarios).
--
-- Este script administra el PERFIL y la autorización multi-tenant. No crea
-- contraseñas. Con Google OAuth, auth.users se crea en el primer ingreso y el
-- row de `usuarios` determina si la cuenta puede acceder al tenant Ganaderas.
--
-- Idempotente: puede ejecutarse más de una vez.
-- Semántica de campo:
--   campo_asignado_id con valor → operario fijo en ese campo.
--   campo_asignado_id NULL      → operario itinerante en TODOS los campos.
-- NULL no cambia el rol y nunca concede permisos de edición/eliminación.
-- =============================================================================

BEGIN;

-- Fallar de forma explícita si los campos escritos en la planilla todavía no
-- existen. Evita dejar perfiles apuntando a IDs inventados o mal tipeados.
DO $$
DECLARE
  campo_faltante TEXT;
BEGIN
  SELECT esperado.id INTO campo_faltante
  FROM (VALUES
    ('campo-picaflor'),
    ('campo-carolina'),
    ('campo-quirquincho'),
    ('campo-progreso')
  ) AS esperado(id)
  LEFT JOIN campos c ON c.id = esperado.id AND c.cliente_id = 'ganaderas'
  WHERE c.id IS NULL
  LIMIT 1;

  IF campo_faltante IS NOT NULL THEN
    RAISE EXCEPTION 'No existe el campo % para el cliente ganaderas', campo_faltante;
  END IF;
END $$;

INSERT INTO usuarios (
  email, cliente_id, nombre, apellido, rol, campo_asignado_id
) VALUES
  ('luisfernandocarranza155@gmail.com',   'ganaderas', 'Luis',      'Carranza', 'operario',      'campo-picaflor'),
  ('emilianogabrielzerpa5@gmail.com',     'ganaderas', 'Emiliano',  'Zerpa',    'operario',      'campo-carolina'),
  ('alejandromiguel9087@gmail.com',       'ganaderas', 'Alejandro', 'Miguel',   'operario',      NULL),
  ('ruedaroberto431@gmail.com',           'ganaderas', 'Roberto',   'Rueda',    'operario',      'campo-picaflor'),
  ('armandocollante15@gmail.com',         'ganaderas', 'Armando',   'Collante', 'operario',      'campo-quirquincho'),
  ('montenegrocarlosariel32@gmail.com',   'ganaderas', NULL,        NULL,       'operario',      'campo-quirquincho'),
  ('nelsonisidrolopez2025@gmail.com',     'ganaderas', 'Nelson',    'López',    'operario',      'campo-quirquincho'),
  ('agusufi20@gmail.com',                 'ganaderas', 'Agustín',   'Sufi',     'administrador', NULL),
  ('robustianoasaravia@gmail.com',        'ganaderas', NULL,        NULL,       'administrador', NULL),
  ('victorjaviersaravia2@gmail.com',      'ganaderas', NULL,        NULL,       'operario',      'campo-quirquincho'),
  ('panchofreytes@gmail.com',             'ganaderas', NULL,        NULL,       'administrador', NULL),
  ('carranzamiguel584@gmail.com',         'ganaderas', NULL,        NULL,       'administrador', NULL),
  ('matiasortiz.gva@gmail.com',           'ganaderas', NULL,        NULL,       'administrador', NULL),
  ('hugogustavogonzalez459@gmail.com',    'ganaderas', NULL,        NULL,       'administrador', NULL),
  ('exico.cuellar25@gmail.com',           'ganaderas', NULL,        NULL,       'operario',      NULL),
  ('rosariodidziulis8@gmail.com',         'ganaderas', NULL,        NULL,       'administrador', NULL),
  ('1223alevera@gmail.com',               'ganaderas', NULL,        NULL,       'operario',      NULL),
  ('cordobaoscar850@gmail.com',           'ganaderas', NULL,        NULL,       'operario',      'campo-progreso')
ON CONFLICT (email) DO UPDATE SET
  cliente_id        = EXCLUDED.cliente_id,
  -- La planilla no trae nombres: conservamos los que ya estaban cargados.
  nombre            = COALESCE(usuarios.nombre, EXCLUDED.nombre),
  apellido          = COALESCE(usuarios.apellido, EXCLUDED.apellido),
  rol               = EXCLUDED.rol,
  campo_asignado_id = EXCLUDED.campo_asignado_id;

COMMIT;

-- Verificación 1: deben ser 18 perfiles autorizados.
SELECT
  COUNT(*) AS total_usuarios_ganaderas,
  COUNT(*) FILTER (WHERE rol = 'administrador') AS administradores,
  COUNT(*) FILTER (WHERE rol = 'operario') AS operarios
FROM usuarios
WHERE cliente_id = 'ganaderas'
  AND lower(email) IN (
    'luisfernandocarranza155@gmail.com','emilianogabrielzerpa5@gmail.com',
    'alejandromiguel9087@gmail.com','ruedaroberto431@gmail.com',
    'armandocollante15@gmail.com','montenegrocarlosariel32@gmail.com',
    'nelsonisidrolopez2025@gmail.com','agusufi20@gmail.com',
    'robustianoasaravia@gmail.com','victorjaviersaravia2@gmail.com',
    'panchofreytes@gmail.com','carranzamiguel584@gmail.com',
    'matiasortiz.gva@gmail.com','hugogustavogonzalez459@gmail.com',
    'exico.cuellar25@gmail.com','rosariodidziulis8@gmail.com',
    '1223alevera@gmail.com','cordobaoscar850@gmail.com'
  );

-- Verificación 2: muestra quién todavía no ingresó/aceptó invitación en Auth.
-- Con Google es normal que aparezcan acá hasta su primer inicio de sesión.
SELECT u.email, u.rol, u.campo_asignado_id
FROM usuarios u
LEFT JOIN auth.users au ON lower(au.email) = lower(u.email)
WHERE u.cliente_id = 'ganaderas'
  AND au.id IS NULL
ORDER BY u.email;
