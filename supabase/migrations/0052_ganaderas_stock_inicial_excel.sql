-- =============================================================================
-- 0052 — Ganaderas: stock inicial oficial por campaña y corrección de campo
-- =============================================================================
--
-- Confirmación funcional (26/10/2026):
--   * La fuente del stock inicial de Pariciones es la hoja `StockInicial`
--     del Excel GVA_F(10) (1).xlsx, no la suma de tactos de Preñez.
--   * Los rodeos "VQ 27M Margarita" y "Vaquillas 15M Ag" corresponden a
--     Quirquincho para las métricas de Pariciones.
--
-- Stock oficial campaña 2026/27:
--   Carolina      417
--   Picaflor     1140  (595 + 545)
--   Progreso      455
--   Quirquincho   698  (235 + 463)
--   Resto           0
--   TOTAL        2710
--
-- `campos.stock_inicial_vacas` continúa como cache para no romper la app ni
-- el dashboard. La nueva tabla conserva la fuente por campaña y evita que un
-- cambio posterior en `tactos` vuelva a sobrescribir el stock confirmado.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Fuente de verdad del stock inicial por campaña/campo
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS stock_inicial_campanias (
  cliente_id    TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  campania_id   TEXT NOT NULL REFERENCES campanias_reproductivas(id) ON DELETE CASCADE,
  campo_id      TEXT NOT NULL REFERENCES campos(id) ON DELETE CASCADE,
  cantidad      INTEGER NOT NULL CHECK (cantidad >= 0),
  fuente        TEXT,
  observaciones TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (campania_id, campo_id)
);

CREATE INDEX IF NOT EXISTS stock_inicial_campanias_cliente_idx
  ON stock_inicial_campanias(cliente_id, campania_id, campo_id);

ALTER TABLE stock_inicial_campanias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stock_inicial_campanias_select
  ON stock_inicial_campanias;
CREATE POLICY stock_inicial_campanias_select ON stock_inicial_campanias
  FOR SELECT TO authenticated
  USING (cliente_id = current_cliente_id() OR is_super_admin());

DROP POLICY IF EXISTS stock_inicial_campanias_modify
  ON stock_inicial_campanias;
CREATE POLICY stock_inicial_campanias_modify ON stock_inicial_campanias
  FOR ALL TO authenticated
  USING (current_user_can_manage_events() OR is_super_admin())
  WITH CHECK (
    (cliente_id = current_cliente_id() AND current_user_can_manage_events())
    OR is_super_admin()
  );

-- Falla temprano si falta alguna pieza estructural esperada.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM campanias_reproductivas
    WHERE id = 'campania-ganaderas-2026-2027'
      AND cliente_id = 'ganaderas'
  ) THEN
    RAISE EXCEPTION 'No existe la campaña reproductiva Ganaderas 2026-2027';
  END IF;

  IF (
    SELECT COUNT(*)
    FROM campos
    WHERE cliente_id = 'ganaderas'
      AND id IN (
        'campo-carolina', 'campo-picaflor',
        'campo-progreso', 'campo-quirquincho'
      )
  ) <> 4 THEN
    RAISE EXCEPTION 'Falta al menos uno de los campos oficiales de Ganaderas';
  END IF;
END;
$$;

-- Guardamos una fila para cada campo actual de Ganaderas. Los campos que no
-- aparecen en StockInicial reciben 0 de forma explícita y no vuelven a tomar
-- accidentalmente el valor de Preñez.
INSERT INTO stock_inicial_campanias (
  cliente_id, campania_id, campo_id, cantidad, fuente, observaciones
)
SELECT
  'ganaderas',
  'campania-ganaderas-2026-2027',
  c.id,
  CASE c.id
    WHEN 'campo-carolina'    THEN 417
    WHEN 'campo-picaflor'    THEN 1140
    WHEN 'campo-progreso'    THEN 455
    WHEN 'campo-quirquincho' THEN 698
    ELSE 0
  END,
  'GVA_F(10) (1).xlsx / StockInicial',
  CASE
    WHEN c.id = 'campo-quirquincho'
      THEN 'Incluye VQ 27M Margarita (235) y Vaquillas 15M Ag (463).'
    ELSE 'Valor confirmado por Ganaderas el 26/10/2026.'
  END
FROM campos c
WHERE c.cliente_id = 'ganaderas'
ON CONFLICT (campania_id, campo_id) DO UPDATE SET
  cliente_id    = EXCLUDED.cliente_id,
  cantidad      = EXCLUDED.cantidad,
  fuente        = EXCLUDED.fuente,
  observaciones = EXCLUDED.observaciones,
  updated_at    = NOW();

-- -----------------------------------------------------------------------------
-- 2) Cache compatible: usar stock explícito y Preñez solo como fallback
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION _refrescar_stock_prenez_activa(p_cliente_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE campos c
  SET stock_inicial_vacas = COALESCE(
    (
      SELECT sic.cantidad
      FROM stock_inicial_campanias sic
      JOIN campanias_reproductivas cr ON cr.id = sic.campania_id
      WHERE sic.cliente_id = p_cliente_id
        AND sic.campo_id = c.id
        AND cr.cliente_id = p_cliente_id
        AND cr.activa = TRUE
      LIMIT 1
    ),
    (
      SELECT SUM(
        COALESCE(t.prenez_cabeza, 0) +
        COALESCE(t.prenez_cuerpo, 0) +
        COALESCE(t.prenez_cola, 0)
      )::INTEGER
      FROM tactos t
      JOIN campanias_reproductivas cr ON cr.id = t.campania_id
      WHERE t.cliente_id = p_cliente_id
        AND t.campo_id = c.id
        AND cr.activa = TRUE
    ),
    0
  )
  WHERE c.cliente_id = p_cliente_id;
END;
$$;

REVOKE ALL ON FUNCTION _refrescar_stock_prenez_activa(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION _refrescar_stock_prenez_activa(TEXT) FROM anon;
REVOKE ALL ON FUNCTION _refrescar_stock_prenez_activa(TEXT) FROM authenticated;

-- -----------------------------------------------------------------------------
-- 3) Corregir la atribución de los dos rodeos para Pariciones
-- -----------------------------------------------------------------------------

UPDATE tactos
SET campo_id  = 'campo-quirquincho',
    campo     = 'Quirquincho',
    updated_at = NOW()
WHERE cliente_id = 'ganaderas'
  AND campania_id = 'campania-ganaderas-2026-2027'
  AND id IN ('tacto-gva-001', 'tacto-gva-002');

UPDATE campanias_reproductivas
SET observaciones =
      'Stock inicial tomado de la hoja StockInicial del Excel oficial. '
      'VQ 27M Margarita y Vaquillas 15M Ag se atribuyen a Quirquincho.',
    updated_at = NOW()
WHERE id = 'campania-ganaderas-2026-2027'
  AND cliente_id = 'ganaderas';

-- Refresco final, aun si los dos tactos ya estaban correctamente asignados.
SELECT _refrescar_stock_prenez_activa('ganaderas');

-- -----------------------------------------------------------------------------
-- 4) Validaciones antes del COMMIT
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_total INTEGER;
BEGIN
  SELECT COALESCE(SUM(stock_inicial_vacas), 0)
    INTO v_total
  FROM campos
  WHERE cliente_id = 'ganaderas';

  IF v_total <> 2710 THEN
    RAISE EXCEPTION 'Stock total inesperado: %, se esperaba 2710', v_total;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (VALUES
      ('campo-carolina', 417),
      ('campo-picaflor', 1140),
      ('campo-progreso', 455),
      ('campo-quirquincho', 698)
    ) AS esperado(campo_id, cantidad)
    LEFT JOIN campos c
      ON c.id = esperado.campo_id
     AND c.cliente_id = 'ganaderas'
    WHERE c.stock_inicial_vacas IS DISTINCT FROM esperado.cantidad
  ) THEN
    RAISE EXCEPTION 'El stock por campo no coincide con el Excel oficial';
  END IF;

  IF (
    SELECT COUNT(*)
    FROM tactos
    WHERE cliente_id = 'ganaderas'
      AND id IN ('tacto-gva-001', 'tacto-gva-002')
      AND campo_id = 'campo-quirquincho'
  ) <> 2 THEN
    RAISE EXCEPTION 'No se pudieron atribuir ambos rodeos a Quirquincho';
  END IF;
END;
$$;

COMMIT;

-- Resultado de control para copiar y compartir después de ejecutar:
SELECT
  c.id,
  c.nombre,
  c.stock_inicial_vacas,
  sic.fuente
FROM campos c
LEFT JOIN stock_inicial_campanias sic
  ON sic.campo_id = c.id
 AND sic.campania_id = 'campania-ganaderas-2026-2027'
WHERE c.cliente_id = 'ganaderas'
ORDER BY c.nombre;

SELECT
  id,
  rodeo,
  campo,
  campo_id,
  (COALESCE(prenez_cabeza, 0) +
   COALESCE(prenez_cuerpo, 0) +
   COALESCE(prenez_cola, 0)) AS total_prenadas
FROM tactos
WHERE cliente_id = 'ganaderas'
  AND id IN ('tacto-gva-001', 'tacto-gva-002')
ORDER BY id;
