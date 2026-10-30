-- =============================================================================
-- 0060 · Evitar doble carga del mismo animal por color + número de caravana
-- =============================================================================
-- La validación de la app mejora la experiencia, pero no alcanza: dos equipos
-- pueden guardar a la vez o sincronizar cargas offline posteriormente. Este
-- trigger es la defensa definitiva en la base de datos.
--
-- No borra ni modifica datos históricos. Si ya existen duplicados, permanecen
-- para revisión manual. Una edición que no cambie la caravana sigue permitida.

BEGIN;

CREATE OR REPLACE FUNCTION normalizar_numero_caravana(valor TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN limpio = '' THEN ''
    WHEN limpio ~ '^[0-9]+$' THEN COALESCE(NULLIF(ltrim(limpio, '0'), ''), '0')
    ELSE limpio
  END
  FROM (
    SELECT upper(regexp_replace(btrim(COALESCE(valor, '')), '[[:space:]]+', '', 'g')) AS limpio
  ) s;
$$;

CREATE INDEX IF NOT EXISTS pariciones_caravana_normalizada_idx
  ON pariciones (
    cliente_id,
    lower(btrim(caravana_color)),
    normalizar_numero_caravana(caravana_numero)
  )
  WHERE caravana_color IS NOT NULL
    AND btrim(caravana_color) <> ''
    AND caravana_numero IS NOT NULL
    AND btrim(caravana_numero) <> '';

CREATE OR REPLACE FUNCTION impedir_paricion_caravana_duplicada()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  color_normalizado TEXT;
  numero_normalizado TEXT;
BEGIN
  color_normalizado := lower(btrim(COALESCE(NEW.caravana_color, '')));
  numero_normalizado := normalizar_numero_caravana(NEW.caravana_numero);

  -- Orejanos y registros sin identificación completa no participan.
  IF color_normalizado = '' OR numero_normalizado = '' THEN
    RETURN NEW;
  END IF;

  -- No bloquear correcciones de otros datos en registros históricos que ya
  -- pudieran formar parte de un duplicado previo a esta migración.
  IF TG_OP = 'UPDATE'
     AND OLD.cliente_id = NEW.cliente_id
     AND lower(btrim(COALESCE(OLD.caravana_color, ''))) = color_normalizado
     AND normalizar_numero_caravana(OLD.caravana_numero) = numero_normalizado THEN
    RETURN NEW;
  END IF;

  -- Serializa únicamente intentos sobre la misma caravana para cubrir la
  -- carrera de dos dispositivos guardando al mismo tiempo.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(NEW.cliente_id || '|' || color_normalizado || '|' || numero_normalizado, 0)
  );

  IF EXISTS (
    SELECT 1
    FROM pariciones p
    WHERE p.cliente_id = NEW.cliente_id
      AND p.id <> NEW.id
      AND lower(btrim(COALESCE(p.caravana_color, ''))) = color_normalizado
      AND normalizar_numero_caravana(p.caravana_numero) = numero_normalizado
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = format(
        'La caravana %s %s ya existe. Revisá la carga anterior antes de guardar.',
        NEW.caravana_color,
        NEW.caravana_numero
      ),
      CONSTRAINT = 'pariciones_caravana_unica_por_cliente';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pariciones_caravana_unica_trigger ON pariciones;
CREATE TRIGGER pariciones_caravana_unica_trigger
BEFORE INSERT OR UPDATE OF cliente_id, caravana_color, caravana_numero
ON pariciones
FOR EACH ROW
EXECUTE FUNCTION impedir_paricion_caravana_duplicada();

COMMIT;

-- Diagnóstico opcional posterior (no modifica datos):
-- SELECT cliente_id, caravana_color, normalizar_numero_caravana(caravana_numero), count(*)
-- FROM pariciones
-- WHERE btrim(COALESCE(caravana_color, '')) <> ''
--   AND btrim(COALESCE(caravana_numero, '')) <> ''
-- GROUP BY 1, 2, 3
-- HAVING count(*) > 1
-- ORDER BY count(*) DESC;
