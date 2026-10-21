-- =============================================================================
-- 0045 — Alta inicial de Estancia Carahuasi
-- =============================================================================
-- Alcance seguro de esta primera carga:
--   - Crea el cliente multi-tenant con los seis módulos habilitados.
--   - Crea los campos Carahuasi y La Población.
--   - Conserva las ubicaciones conocidas y deja preparadas superficie/GPS.
--   - Crea un lote y un pluviómetro provisorios por campo para que la app
--     pueda operar mientras el cliente completa el detalle territorial.
--   - Carga los dos tactos informados de Carahuasi y deja 169 preñadas como
--     stock inicial de pariciones.
--
-- No se crean usuarios porque la fuente recibida no incluye emails.
-- No se importan todavía nacimientos, lluvias, compras ni ventas: primero hay
-- que confirmar campañas, potreros, pluviómetros y mapeos históricos para no
-- asignar registros a un período/campo incorrecto.
--
-- Script idempotente: puede ejecutarse más de una vez.
-- =============================================================================

BEGIN;

-- Datos territoriales reutilizables por todos los clientes. La app actual no
-- depende de estas columnas, por lo que son compatibles con versiones previas.
ALTER TABLE campos
  ADD COLUMN IF NOT EXISTS ubicacion_descripcion TEXT,
  ADD COLUMN IF NOT EXISTS superficie_ha NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS latitud NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS longitud NUMERIC(10,7);

COMMENT ON COLUMN campos.ubicacion_descripcion IS
  'Localidad/departamento/provincia en texto; no reemplaza las coordenadas.';
COMMENT ON COLUMN campos.superficie_ha IS
  'Superficie total declarada del establecimiento en hectáreas.';

INSERT INTO clientes (
  id, nombre, tagline, logo_url, accent_color, modulos_habilitados, catalogos
) VALUES (
  'estancia-carahuasi',
  'Estancia Carahuasi',
  'Carahuasi · La Población',
  NULL, -- Subir el logo recibido a Storage y completar su URL pública.
  NULL,
  ARRAY['pariciones','lluvias','mortandad','pastoreo','compras','ventas']::TEXT[],
  '{
    "pariciones": {
      "vacasGrupos": ["Vacas cabeza","Vacas cuerpo","Vacas cola"],
      "eventos": ["Nacimiento","Muerte","Retacto","Aborto"],
      "sexos": ["Macho","Hembra","Orejano"],
      "asistencia": ["Si","No"],
      "caravanaColores": ["Celeste","Blanca","Amarillo","Naranja"],
      "causaTipos": ["Muerte Señalado","Nacido Muerto"],
      "causasFrecuentes": ["Insolación","Diarrea","Calor","Picadura de víbora","Empantanado"]
    },
    "mortandad": {
      "categorias": ["Toros","Vacas","Vaquillonas","Novillos","Novillitos","Terneros","Terneras"],
      "actividades": ["Cría","Destete Precoz","Invernada","Recría","Engorde"],
      "causaTipos": ["Muerte Señalado","Nacido Muerto","Desconocido"]
    },
    "pastoreo": {
      "categorias": ["Toros","Vacas","Vaquillonas","Novillos","Novillitos","Terneros","Terneras"],
      "eventos": ["Muerte","Rotación","Salida","Entrada"],
      "catAnimal": ["Vaca preñada","Vaca vacía","Toros","Terneros H","Terneros M","Vaquillas","Novillo","Novillito"]
    },
    "compras": {
      "actividades": ["Cría","Destete Precoz","Engorde","Invernada","Recepción"],
      "plazos": ["Contado","30 días","60 días","90 días"]
    }
  }'::JSONB
)
ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  tagline = EXCLUDED.tagline,
  modulos_habilitados = EXCLUDED.modulos_habilitados,
  catalogos = EXCLUDED.catalogos,
  updated_at = NOW();

INSERT INTO campos (
  id, cliente_id, nombre, organizacion_id, stock_inicial_vacas,
  ubicacion_descripcion, superficie_ha, latitud, longitud
) VALUES
  (
    'campo-estancia-carahuasi-carahuasi', 'estancia-carahuasi', 'Carahuasi',
    'org-estancia-carahuasi', 169, 'Guachipas, Salta', NULL, NULL, NULL
  ),
  (
    'campo-estancia-carahuasi-la-poblacion', 'estancia-carahuasi', 'La Población',
    'org-estancia-carahuasi', NULL, 'El Quebrachal, Anta, Salta', NULL, NULL, NULL
  )
ON CONFLICT (id) DO UPDATE SET
  cliente_id = EXCLUDED.cliente_id,
  nombre = EXCLUDED.nombre,
  organizacion_id = EXCLUDED.organizacion_id,
  stock_inicial_vacas = EXCLUDED.stock_inicial_vacas,
  ubicacion_descripcion = EXCLUDED.ubicacion_descripcion;

-- Los nombres definitivos de lotes/potreros todavía no están completos.
-- Estos registros permiten seleccionar un campo y cargar eventos desde el MVP.
INSERT INTO lotes (id, cliente_id, campo_id, nombre) VALUES
  (
    'lote-estancia-carahuasi-carahuasi-general',
    'estancia-carahuasi', 'campo-estancia-carahuasi-carahuasi',
    'General (detalle pendiente)'
  ),
  (
    'lote-estancia-carahuasi-la-poblacion-general',
    'estancia-carahuasi', 'campo-estancia-carahuasi-la-poblacion',
    'General (detalle pendiente)'
  )
ON CONFLICT (id) DO UPDATE SET
  cliente_id = EXCLUDED.cliente_id,
  campo_id = EXCLUDED.campo_id,
  nombre = EXCLUDED.nombre;

-- Un pluviómetro provisorio por establecimiento. Al recibir nombres y GPS se
-- actualiza el master sin perder el histórico importado.
INSERT INTO pluviometros (id, cliente_id, campo_id, nombre) VALUES
  (
    'pluv-estancia-carahuasi-carahuasi-general',
    'estancia-carahuasi', 'campo-estancia-carahuasi-carahuasi',
    'Pluviómetro general (ubicación pendiente)'
  ),
  (
    'pluv-estancia-carahuasi-la-poblacion-general',
    'estancia-carahuasi', 'campo-estancia-carahuasi-la-poblacion',
    'Pluviómetro general (ubicación pendiente)'
  )
ON CONFLICT (id) DO UPDATE SET
  cliente_id = EXCLUDED.cliente_id,
  campo_id = EXCLUDED.campo_id,
  nombre = EXCLUDED.nombre;

-- Preñez informada para Carahuasi:
--   29/09/2026: 151 preñadas + 88 vacías = 239 evaluadas
--   30/09/2026:  18 preñadas +  6 vacías =  24 evaluadas
-- Total: 169 preñadas, 94 vacías, 263 evaluadas. El stock informado es de
-- 268 vacas, por lo que quedan 5 animales pendientes de aclaración/tacto.
INSERT INTO tactos (
  id, cliente_id, rodeo, campo, campo_id, fecha, origen_total,
  prenez_cabeza, prenez_cuerpo, prenez_cola, vacias,
  perdon, descarte, feed_lot, observaciones, usuario_email, campania_id
) VALUES
  (
    'tacto-estancia-carahuasi-2026-09-29',
    'estancia-carahuasi', 'Rodeo general — tacto 29/09/2026', 'Carahuasi',
    'campo-estancia-carahuasi-carahuasi', DATE '2026-09-29', 239,
    151, 0, 0, 88, 0, 0, 0,
    'Importado del documento inicial. La fuente no segmenta cabeza/cuerpo/cola; las 151 preñadas se conservan en cabeza para mantener el total.',
    NULL, NULL
  ),
  (
    'tacto-estancia-carahuasi-2026-09-30',
    'estancia-carahuasi', 'Rodeo general — tacto 30/09/2026', 'Carahuasi',
    'campo-estancia-carahuasi-carahuasi', DATE '2026-09-30', 24,
    18, 0, 0, 6, 0, 0, 0,
    'Importado del documento inicial. La fuente no segmenta cabeza/cuerpo/cola; las 18 preñadas se conservan en cabeza para mantener el total.',
    NULL, NULL
  )
ON CONFLICT (id) DO UPDATE SET
  cliente_id = EXCLUDED.cliente_id,
  rodeo = EXCLUDED.rodeo,
  campo = EXCLUDED.campo,
  campo_id = EXCLUDED.campo_id,
  fecha = EXCLUDED.fecha,
  origen_total = EXCLUDED.origen_total,
  prenez_cabeza = EXCLUDED.prenez_cabeza,
  prenez_cuerpo = EXCLUDED.prenez_cuerpo,
  prenez_cola = EXCLUDED.prenez_cola,
  vacias = EXCLUDED.vacias,
  perdon = EXCLUDED.perdon,
  descarte = EXCLUDED.descarte,
  feed_lot = EXCLUDED.feed_lot,
  observaciones = EXCLUDED.observaciones,
  updated_at = NOW();

COMMIT;

-- =============================================================================
-- Verificación: debe devolver 2 campos, 2 lotes, 2 pluviómetros y 2 tactos.
-- =============================================================================
SELECT
  c.id,
  c.nombre,
  c.ubicacion_descripcion,
  c.stock_inicial_vacas,
  (SELECT count(*) FROM lotes l WHERE l.campo_id = c.id) AS lotes,
  (SELECT count(*) FROM pluviometros p WHERE p.campo_id = c.id) AS pluviometros,
  (SELECT count(*) FROM tactos t WHERE t.campo_id = c.id) AS tactos
FROM campos c
WHERE c.cliente_id = 'estancia-carahuasi'
ORDER BY c.nombre;
