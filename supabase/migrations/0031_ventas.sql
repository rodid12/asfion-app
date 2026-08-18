-- =============================================================================
-- 0031 — Módulo Ventas
-- =============================================================================
--
-- Modelo confirmado por el cliente el 17/08/2026:
--   • 1 venta contiene entre 1 y 4 grupos/categorías.
--   • El administrador escribe CANT CAB Y CAT respetando exactamente sus
--     separadores y denominaciones.
--   • Siempre se cargan KG BRUTOS.
--   • KG NETOS = KG BRUTOS × 0,92 (desbaste fijo del 8%).
--   • KG PROMEDIO = KG NETOS / primer número de CANT CAB Y CAT.
--   • Precio es por kg neto y vive dentro de cada grupo.
--   • Importe total es MANUAL; nunca se calcula como precio × kg.
--   • Correlativo/número de operación y tropa también son manuales.
--   • Solo administradores pueden insertar, editar o borrar ventas.
--
-- `grupos` usa JSONB porque los sufijos 2/3/4 pertenecen a la MISMA venta.
-- Evita cuatro juegos de columnas físicas y permite mantener una transacción
-- atómica al trabajar offline desde la app.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS ventas (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  campo_id TEXT NOT NULL REFERENCES campos(id) ON DELETE RESTRICT,
  usuario_email TEXT NOT NULL,
  fecha DATE NOT NULL,

  -- Array de 1..4 objetos con cantCabYCat, cabezas, kgBrutos, kgNetos,
  -- kgPromedio y precio. Un trigger normaliza los campos derivados.
  grupos JSONB NOT NULL,

  consignado TEXT NOT NULL CHECK (btrim(consignado) <> ''),
  titular TEXT NOT NULL CHECK (btrim(titular) <> ''),
  pago TEXT NOT NULL CHECK (btrim(pago) <> ''),
  frigorifico TEXT NOT NULL CHECK (btrim(frigorifico) <> ''),
  numero_dte TEXT NOT NULL CHECK (btrim(numero_dte) <> ''),
  correlativo TEXT NOT NULL CHECK (btrim(correlativo) <> ''),
  tropa TEXT NOT NULL CHECK (btrim(tropa) <> ''),
  importe_total NUMERIC(16, 2) CHECK (importe_total IS NULL OR importe_total >= 0),
  observaciones TEXT NOT NULL CHECK (btrim(observaciones) <> ''),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ventas_grupos_array_chk CHECK (
    jsonb_typeof(grupos) = 'array'
    AND jsonb_array_length(grupos) BETWEEN 1 AND 4
  )
);

CREATE INDEX IF NOT EXISTS ventas_cliente_fecha_idx
  ON ventas(cliente_id, fecha DESC, id);

CREATE INDEX IF NOT EXISTS ventas_campo_fecha_idx
  ON ventas(cliente_id, campo_id, fecha DESC, id);

CREATE INDEX IF NOT EXISTS ventas_consignado_idx
  ON ventas(cliente_id, consignado);

-- El número de operación es único para toda la venta dentro del cliente.
CREATE UNIQUE INDEX IF NOT EXISTS ventas_correlativo_unico_idx
  ON ventas(cliente_id, lower(btrim(correlativo)));

-- -----------------------------------------------------------------------------
-- Normalización única de grupos
-- -----------------------------------------------------------------------------
-- La app calcula estos valores para mostrarlos instantáneamente, pero la DB los
-- vuelve a calcular. Así una carga móvil, una edición y un importador de Excel
-- no pueden producir fórmulas diferentes.

CREATE OR REPLACE FUNCTION normalizar_grupos_venta()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item JSONB;
  v_grupos JSONB := '[]'::JSONB;
  v_orden INTEGER := 0;
  v_descripcion TEXT;
  v_primer_numero TEXT;
  v_cabezas INTEGER;
  v_kg_brutos NUMERIC;
  v_kg_netos NUMERIC;
  v_kg_promedio NUMERIC;
  v_precio NUMERIC;
BEGIN
  IF NEW.grupos IS NULL OR jsonb_typeof(NEW.grupos) <> 'array' THEN
    RAISE EXCEPTION 'grupos debe ser un array JSON';
  END IF;

  IF jsonb_array_length(NEW.grupos) NOT BETWEEN 1 AND 4 THEN
    RAISE EXCEPTION 'una venta debe tener entre 1 y 4 grupos';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(NEW.grupos)
  LOOP
    v_orden := v_orden + 1;
    v_descripcion := btrim(COALESCE(v_item ->> 'cantCabYCat', ''));
    IF v_descripcion = '' THEN
      RAISE EXCEPTION 'falta CANT CAB Y CAT en el grupo %', v_orden;
    END IF;

    -- El primer número de la casilla es la cantidad de animales confirmada
    -- por el cliente. No alteramos el texto original ni sus separadores.
    v_primer_numero := substring(v_descripcion FROM '^[[:space:]]*([0-9]+)');
    IF v_primer_numero IS NULL THEN
      RAISE EXCEPTION 'CANT CAB Y CAT del grupo % debe comenzar con la cantidad de animales', v_orden;
    END IF;
    v_cabezas := v_primer_numero::INTEGER;
    IF v_cabezas <= 0 THEN
      RAISE EXCEPTION 'la cantidad de animales del grupo % debe ser mayor a cero', v_orden;
    END IF;

    BEGIN
      v_kg_brutos := NULLIF(replace(v_item ->> 'kgBrutos', ',', '.'), '')::NUMERIC;
      v_precio := NULLIF(replace(v_item ->> 'precio', ',', '.'), '')::NUMERIC;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'kg brutos o precio inválido en el grupo %', v_orden;
    END;

    IF v_kg_brutos IS NULL OR v_kg_brutos <= 0 THEN
      RAISE EXCEPTION 'kg brutos inválidos en el grupo %', v_orden;
    END IF;
    IF v_precio IS NULL OR v_precio <= 0 THEN
      RAISE EXCEPTION 'precio inválido en el grupo %', v_orden;
    END IF;

    v_kg_netos := round(v_kg_brutos * 0.92, 2);
    v_kg_promedio := round(v_kg_netos / v_cabezas, 2);

    v_grupos := v_grupos || jsonb_build_array(jsonb_build_object(
      'orden', v_orden,
      'cantCabYCat', v_descripcion,
      'cabezas', v_cabezas,
      'kgBrutos', round(v_kg_brutos, 2),
      'kgNetos', v_kg_netos,
      'kgPromedio', v_kg_promedio,
      'precio', round(v_precio, 2)
    ));
  END LOOP;

  NEW.grupos := v_grupos;
  NEW.consignado := btrim(NEW.consignado);
  NEW.titular := btrim(NEW.titular);
  NEW.pago := btrim(NEW.pago);
  NEW.frigorifico := btrim(NEW.frigorifico);
  NEW.numero_dte := btrim(NEW.numero_dte);
  NEW.correlativo := btrim(NEW.correlativo);
  NEW.tropa := btrim(NEW.tropa);
  NEW.observaciones := btrim(NEW.observaciones);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ventas_normalizar_grupos_trg ON ventas;
CREATE TRIGGER ventas_normalizar_grupos_trg
  BEFORE INSERT OR UPDATE OF grupos, consignado, titular, pago, frigorifico,
    numero_dte, correlativo, tropa, observaciones
  ON ventas
  FOR EACH ROW
  EXECUTE FUNCTION normalizar_grupos_venta();

-- -----------------------------------------------------------------------------
-- Permisos: lectura del tenant; escritura solo por administradores activos
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION current_user_can_manage_ventas()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM usuarios u
    WHERE lower(btrim(u.email)) = current_user_email()
      AND u.cliente_id = current_cliente_id()
      AND u.rol = 'administrador'
  );
$$;

ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ventas_select ON ventas;
CREATE POLICY ventas_select ON ventas FOR SELECT TO authenticated
  USING (
    cliente_id = current_cliente_id()
    AND current_user_can_manage_ventas()
  );

DROP POLICY IF EXISTS ventas_insert ON ventas;
CREATE POLICY ventas_insert ON ventas FOR INSERT TO authenticated
  WITH CHECK (
    cliente_id = current_cliente_id()
    AND current_cliente_can_write()
    AND current_user_can_manage_ventas()
  );

DROP POLICY IF EXISTS ventas_update ON ventas;
CREATE POLICY ventas_update ON ventas FOR UPDATE TO authenticated
  USING (
    cliente_id = current_cliente_id()
    AND current_cliente_can_write()
    AND current_user_can_manage_ventas()
  )
  WITH CHECK (
    cliente_id = current_cliente_id()
    AND current_cliente_can_write()
    AND current_user_can_manage_ventas()
  );

DROP POLICY IF EXISTS ventas_delete ON ventas;
CREATE POLICY ventas_delete ON ventas FOR DELETE TO authenticated
  USING (
    cliente_id = current_cliente_id()
    AND current_cliente_can_write()
    AND current_user_can_manage_ventas()
  );

COMMENT ON COLUMN ventas.grupos IS
  'Array de 1..4 categorías. La DB deriva kgNetos=kgBrutos*0.92 y kgPromedio=kgNetos/cabezas.';
COMMENT ON COLUMN ventas.correlativo IS
  'Número de operación manual, único por cliente. No se autogenera en la app.';
COMMENT ON COLUMN ventas.importe_total IS
  'Importe total manual informado por el administrador. Nunca se calcula automáticamente.';

COMMIT;

-- =============================================================================
-- Verificación después de ejecutar
-- =============================================================================
-- SELECT id, fecha, correlativo, jsonb_array_length(grupos) AS categorias,
--        grupos, importe_total
-- FROM ventas
-- ORDER BY fecha DESC, id;
--
-- SELECT policyname, cmd
-- FROM pg_policies
-- WHERE tablename = 'ventas'
-- ORDER BY policyname;
-- =============================================================================
