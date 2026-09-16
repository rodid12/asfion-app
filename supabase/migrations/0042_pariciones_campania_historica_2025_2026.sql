-- =============================================================================
-- 0042 — Vincular el cierre Servicio 2024 con la campaña de pariciones 2025/26
-- =============================================================================
--
-- El cierre agregado importado desde Excel conserva `servicio_anio = 2024`,
-- pero sus eventos individuales ocurrieron entre septiembre de 2025 y marzo
-- de 2026. Hasta ahora el dashboard infería la campaña únicamente a partir de
-- `servicio_anio`, por lo que mostraba los KPIs en 2024/25 y dejaba vacíos los
-- gráficos basados en eventos.
--
-- Esta migración no cambia fechas ni totales del cliente. Agrega una relación
-- explícita entre el cierre y la campaña real, registra la campaña histórica y
-- vincula los eventos individuales que ya existen.
-- =============================================================================

BEGIN;

ALTER TABLE pariciones_resumen_servicio
  ADD COLUMN IF NOT EXISTS campania_id TEXT
    REFERENCES campanias_reproductivas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS pariciones_resumen_campania_idx
  ON pariciones_resumen_servicio(cliente_id, campania_id);

INSERT INTO campanias_reproductivas (
  id,
  cliente_id,
  nombre,
  servicio_anio,
  fecha_inicio,
  fecha_fin,
  activa,
  observaciones
)
VALUES (
  'campania-ganaderas-2025-2026',
  'ganaderas',
  'Campaña 2025-2026',
  2024,
  DATE '2025-09-01',
  DATE '2026-03-31',
  FALSE,
  'Campaña histórica de pariciones. Vinculada al cierre consolidado Servicio 2024.'
)
ON CONFLICT (id) DO UPDATE SET
  nombre         = EXCLUDED.nombre,
  servicio_anio  = EXCLUDED.servicio_anio,
  fecha_inicio   = EXCLUDED.fecha_inicio,
  fecha_fin      = EXCLUDED.fecha_fin,
  activa         = EXCLUDED.activa,
  observaciones  = EXCLUDED.observaciones,
  updated_at     = NOW();

-- Asociar el cierre Excel sin modificar su denominación "Servicio 2024".
UPDATE pariciones_resumen_servicio
SET campania_id = 'campania-ganaderas-2025-2026',
    updated_at = NOW()
WHERE cliente_id = 'ganaderas'
  AND servicio_anio = 2024
  AND campania_id IS DISTINCT FROM 'campania-ganaderas-2025-2026';

-- Vincular el detalle individual con el mismo período reproductivo.
UPDATE pariciones
SET campania_id = 'campania-ganaderas-2025-2026'
WHERE cliente_id = 'ganaderas'
  AND fecha BETWEEN DATE '2025-09-01' AND DATE '2026-03-31'
  AND campania_id IS DISTINCT FROM 'campania-ganaderas-2025-2026';

COMMIT;

-- Verificación esperada:
--   cierres = 6
--   nacimientos_detalle = 2349
--   nacimientos_cierre = 2348
-- La diferencia +1 ya existía en la fuente: Picaflor +3 y Quirquincho -2.
SELECT
  cr.id AS campania_id,
  cr.nombre,
  cr.servicio_anio,
  cr.fecha_inicio,
  cr.fecha_fin,
  (SELECT COUNT(*)
   FROM pariciones_resumen_servicio prs
   WHERE prs.campania_id = cr.id) AS cierres,
  (SELECT COUNT(*)
   FROM pariciones p
   WHERE p.campania_id = cr.id
     AND p.evento = 'Nacimiento') AS nacimientos_detalle,
  (SELECT COALESCE(SUM(prs.terneros_nacidos), 0)
   FROM pariciones_resumen_servicio prs
   WHERE prs.campania_id = cr.id) AS nacimientos_cierre
FROM campanias_reproductivas cr
WHERE cr.id = 'campania-ganaderas-2025-2026';
