-- =============================================================================
-- 0061 · HOTFIX: caravanas únicas únicamente dentro de la misma campaña/evento
-- =============================================================================
-- 0060 comparaba contra todo el historial del cliente. Eso bloqueaba una
-- caravana reutilizada en la campaña actual si el mismo color+número existía
-- en una campaña anterior.
--
-- Una misma identificación también puede aparecer primero como Nacimiento y
-- luego como Muerte. Por eso la clave funcional correcta es:
--   cliente + campaña + evento + color + número normalizado.
--
-- No elimina datos y libera inmediatamente la sincronización de pendientes
-- que solo chocaban con campañas anteriores.

BEGIN;

DROP INDEX IF EXISTS public.pariciones_caravana_normalizada_idx;

CREATE INDEX IF NOT EXISTS pariciones_caravana_campania_evento_idx
  ON public.pariciones (
    cliente_id,
    campania_id,
    lower(btrim(evento)),
    lower(btrim(caravana_color)),
    normalizar_numero_caravana(caravana_numero)
  )
  WHERE btrim(COALESCE(caravana_color, '')) <> ''
    AND btrim(COALESCE(caravana_numero, '')) <> '';

CREATE OR REPLACE FUNCTION public.impedir_paricion_caravana_duplicada()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  color_normalizado TEXT;
  numero_normalizado TEXT;
  evento_normalizado TEXT;
  campania_scope TEXT;
  old_campania_scope TEXT;
BEGIN
  color_normalizado := lower(btrim(COALESCE(NEW.caravana_color, '')));
  numero_normalizado := public.normalizar_numero_caravana(NEW.caravana_numero);
  evento_normalizado := lower(btrim(COALESCE(NEW.evento, '')));
  campania_scope := COALESCE(NEW.campania_id, 'fecha:' || NEW.fecha::TEXT);

  -- Orejanos y registros sin identificación completa no participan.
  IF color_normalizado = '' OR numero_normalizado = '' THEN
    RETURN NEW;
  END IF;

  -- Permite editar otros datos de un registro existente sin chocar consigo
  -- mismo ni con duplicados históricos previos a esta protección.
  IF TG_OP = 'UPDATE' THEN
    old_campania_scope := COALESCE(OLD.campania_id, 'fecha:' || OLD.fecha::TEXT);

    IF OLD.cliente_id IS NOT DISTINCT FROM NEW.cliente_id
       AND old_campania_scope IS NOT DISTINCT FROM campania_scope
       AND lower(btrim(COALESCE(OLD.evento, ''))) = evento_normalizado
       AND lower(btrim(COALESCE(OLD.caravana_color, ''))) = color_normalizado
       AND public.normalizar_numero_caravana(OLD.caravana_numero) = numero_normalizado THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Evita que dos dispositivos inserten la misma carga simultáneamente.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      COALESCE(NEW.cliente_id, '') || '|' ||
      campania_scope || '|' || evento_normalizado || '|' ||
      color_normalizado || '|' || numero_normalizado,
      0
    )
  );

  IF EXISTS (
    SELECT 1
    FROM public.pariciones p
    WHERE p.cliente_id = NEW.cliente_id
      AND p.id IS DISTINCT FROM NEW.id
      AND COALESCE(p.campania_id, 'fecha:' || p.fecha::TEXT) = campania_scope
      AND lower(btrim(COALESCE(p.evento, ''))) = evento_normalizado
      AND lower(btrim(COALESCE(p.caravana_color, ''))) = color_normalizado
      AND public.normalizar_numero_caravana(p.caravana_numero) = numero_normalizado
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = format(
        'La caravana %s %s ya tiene un evento %s en esta campaña. Revisá la carga anterior.',
        NEW.caravana_color,
        NEW.caravana_numero,
        NEW.evento
      ),
      CONSTRAINT = 'pariciones_caravana_unica_por_campania_evento';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pariciones_caravana_unica_trigger ON public.pariciones;
CREATE TRIGGER pariciones_caravana_unica_trigger
BEFORE INSERT OR UPDATE OF
  cliente_id, campania_id, fecha, evento, caravana_color, caravana_numero
ON public.pariciones
FOR EACH ROW
EXECUTE FUNCTION public.impedir_paricion_caravana_duplicada();

COMMIT;

-- Verificación manual opcional:
-- SELECT p.id, p.fecha, p.campania_id, p.evento,
--        p.caravana_color, p.caravana_numero
-- FROM public.pariciones p
-- WHERE p.cliente_id = 'ganaderas'
--   AND public.normalizar_numero_caravana(p.caravana_numero) IN ('466', '467', '468')
-- ORDER BY p.fecha DESC, p.created_at DESC;
