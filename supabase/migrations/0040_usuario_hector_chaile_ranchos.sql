-- ASFION — Alta de Héctor Chaile (Mixero de Ranchos)
-- Cliente: El Renuevo / Estancia La Hoyada
-- Campo: La Hoyada (Ranchos está modelado como sector/circuito del campo)
-- Rol: operario; puede trabajar solamente sobre La Hoyada.

BEGIN;

INSERT INTO usuarios (
  email,
  cliente_id,
  nombre,
  apellido,
  rol,
  campo_asignado_id
)
VALUES (
  'hectorchaile2018@gmail.com',
  'el-renuevo',
  'Héctor',
  'Chaile',
  'operario',
  'campo-el-renuevo-la-hoyada'
)
ON CONFLICT (email) DO UPDATE SET
  cliente_id = EXCLUDED.cliente_id,
  nombre = EXCLUDED.nombre,
  apellido = EXCLUDED.apellido,
  rol = EXCLUDED.rol,
  campo_asignado_id = EXCLUDED.campo_asignado_id;

COMMIT;

-- Verificación:
SELECT
  email,
  cliente_id,
  nombre,
  apellido,
  rol,
  campo_asignado_id
FROM usuarios
WHERE email = 'hectorchaile2018@gmail.com';
