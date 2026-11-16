-- =============================================================================
-- 0070 · Estancia Carahuasi — lotes informados el 16/11/2026
-- =============================================================================
-- Agrega:
--   - 14 lotes para Campo Carahuasi.
--   - 7 lotes numerados para Campo La Población.
--
-- La fotografía de La Población repite “Lote lado represa” para los puntos 1
-- y 2, y no consigna un nombre adicional para el punto 3. Conservamos la
-- numeración del croquis para que sean inequívocos en la aplicación.
--
-- Es idempotente: puede ejecutarse más de una vez. No elimina ni modifica el
-- lote General preexistente porque puede estar referenciado por eventos
-- históricos que todavía no fueron reclasificados.
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.campos
    WHERE id = 'campo-estancia-carahuasi-carahuasi'
      AND cliente_id = 'estancia-carahuasi'
  ) THEN
    RAISE EXCEPTION 'No existe el campo Carahuasi del cliente estancia-carahuasi.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.campos
    WHERE id = 'campo-estancia-carahuasi-la-poblacion'
      AND cliente_id = 'estancia-carahuasi'
  ) THEN
    RAISE EXCEPTION 'No existe el campo La Población del cliente estancia-carahuasi.';
  END IF;
END $$;

INSERT INTO public.lotes (id, cliente_id, campo_id, nombre)
VALUES
  (
    'lote-estancia-carahuasi-carahuasi-potrero-la-cruz',
    'estancia-carahuasi',
    'campo-estancia-carahuasi-carahuasi',
    'Potrero de La Cruz'
  ),
  (
    'lote-estancia-carahuasi-carahuasi-potrero-del-medio',
    'estancia-carahuasi',
    'campo-estancia-carahuasi-carahuasi',
    'Potrero del Medio'
  ),
  (
    'lote-estancia-carahuasi-carahuasi-potrero-la-represa',
    'estancia-carahuasi',
    'campo-estancia-carahuasi-carahuasi',
    'Potrero de La Represa'
  ),
  (
    'lote-estancia-carahuasi-carahuasi-sauce-guascho-1',
    'estancia-carahuasi',
    'campo-estancia-carahuasi-carahuasi',
    'Sauce Guascho 1'
  ),
  (
    'lote-estancia-carahuasi-carahuasi-sauce-guascho-2',
    'estancia-carahuasi',
    'campo-estancia-carahuasi-carahuasi',
    'Sauce Guascho 2'
  ),
  (
    'lote-estancia-carahuasi-carahuasi-tabique-1',
    'estancia-carahuasi',
    'campo-estancia-carahuasi-carahuasi',
    'Tabique 1'
  ),
  (
    'lote-estancia-carahuasi-carahuasi-tabique-2',
    'estancia-carahuasi',
    'campo-estancia-carahuasi-carahuasi',
    'Tabique 2'
  ),
  (
    'lote-estancia-carahuasi-carahuasi-alfiteral-1',
    'estancia-carahuasi',
    'campo-estancia-carahuasi-carahuasi',
    'Alfiteral 1'
  ),
  (
    'lote-estancia-carahuasi-carahuasi-alfiteral-2',
    'estancia-carahuasi',
    'campo-estancia-carahuasi-carahuasi',
    'Alfiteral 2'
  ),
  (
    'lote-estancia-carahuasi-carahuasi-potrero-del-hueco',
    'estancia-carahuasi',
    'campo-estancia-carahuasi-carahuasi',
    'Potrero del Hueco'
  ),
  (
    'lote-estancia-carahuasi-carahuasi-potrerio-iglesia',
    'estancia-carahuasi',
    'campo-estancia-carahuasi-carahuasi',
    'Potrerio Iglesia'
  ),
  (
    'lote-estancia-carahuasi-carahuasi-potrero-de-la-casa',
    'estancia-carahuasi',
    'campo-estancia-carahuasi-carahuasi',
    'Potrero de la casa'
  ),
  (
    'lote-estancia-carahuasi-carahuasi-potrero-del-cementerio-1',
    'estancia-carahuasi',
    'campo-estancia-carahuasi-carahuasi',
    'Potrero del cementerio 1'
  ),
  (
    'lote-estancia-carahuasi-carahuasi-potrero-del-cementerio-2',
    'estancia-carahuasi',
    'campo-estancia-carahuasi-carahuasi',
    'Potrero del cementerio 2'
  ),
  (
    'lote-estancia-carahuasi-la-poblacion-01-lado-represa',
    'estancia-carahuasi',
    'campo-estancia-carahuasi-la-poblacion',
    'Lote 1 — lado represa'
  ),
  (
    'lote-estancia-carahuasi-la-poblacion-02-lado-represa',
    'estancia-carahuasi',
    'campo-estancia-carahuasi-la-poblacion',
    'Lote 2 — lado represa'
  ),
  (
    'lote-estancia-carahuasi-la-poblacion-03',
    'estancia-carahuasi',
    'campo-estancia-carahuasi-la-poblacion',
    'Lote 3'
  ),
  (
    'lote-estancia-carahuasi-la-poblacion-04-antes-bebedero-chapa',
    'estancia-carahuasi',
    'campo-estancia-carahuasi-la-poblacion',
    'Lote 4 — antes del bebedero de chapa'
  ),
  (
    'lote-estancia-carahuasi-la-poblacion-05-despues-bebedero-chapa',
    'estancia-carahuasi',
    'campo-estancia-carahuasi-la-poblacion',
    'Lote 5 — después del bebedero de chapa'
  ),
  (
    'lote-estancia-carahuasi-la-poblacion-06-antes-bebedero-cemento',
    'estancia-carahuasi',
    'campo-estancia-carahuasi-la-poblacion',
    'Lote 6 — antes del bebedero de cemento'
  ),
  (
    'lote-estancia-carahuasi-la-poblacion-07-otro-lado-bebedero-cemento',
    'estancia-carahuasi',
    'campo-estancia-carahuasi-la-poblacion',
    'Lote 7 — del otro lado del bebedero de cemento'
  )
ON CONFLICT (id) DO UPDATE
SET cliente_id = EXCLUDED.cliente_id,
    campo_id = EXCLUDED.campo_id,
    nombre = EXCLUDED.nombre;

DO $$
DECLARE
  v_carahuasi integer;
  v_poblacion integer;
BEGIN
  SELECT count(*) INTO v_carahuasi
  FROM public.lotes
  WHERE id = ANY (ARRAY[
    'lote-estancia-carahuasi-carahuasi-potrero-la-cruz',
    'lote-estancia-carahuasi-carahuasi-potrero-del-medio',
    'lote-estancia-carahuasi-carahuasi-potrero-la-represa',
    'lote-estancia-carahuasi-carahuasi-sauce-guascho-1',
    'lote-estancia-carahuasi-carahuasi-sauce-guascho-2',
    'lote-estancia-carahuasi-carahuasi-tabique-1',
    'lote-estancia-carahuasi-carahuasi-tabique-2',
    'lote-estancia-carahuasi-carahuasi-alfiteral-1',
    'lote-estancia-carahuasi-carahuasi-alfiteral-2',
    'lote-estancia-carahuasi-carahuasi-potrero-del-hueco',
    'lote-estancia-carahuasi-carahuasi-potrerio-iglesia',
    'lote-estancia-carahuasi-carahuasi-potrero-de-la-casa',
    'lote-estancia-carahuasi-carahuasi-potrero-del-cementerio-1',
    'lote-estancia-carahuasi-carahuasi-potrero-del-cementerio-2'
  ]);

  SELECT count(*) INTO v_poblacion
  FROM public.lotes
  WHERE id = ANY (ARRAY[
    'lote-estancia-carahuasi-la-poblacion-01-lado-represa',
    'lote-estancia-carahuasi-la-poblacion-02-lado-represa',
    'lote-estancia-carahuasi-la-poblacion-03',
    'lote-estancia-carahuasi-la-poblacion-04-antes-bebedero-chapa',
    'lote-estancia-carahuasi-la-poblacion-05-despues-bebedero-chapa',
    'lote-estancia-carahuasi-la-poblacion-06-antes-bebedero-cemento',
    'lote-estancia-carahuasi-la-poblacion-07-otro-lado-bebedero-cemento'
  ]);

  IF v_carahuasi <> 14 THEN
    RAISE EXCEPTION 'Se esperaban 14 lotes nuevos de Carahuasi y se encontraron %.', v_carahuasi;
  END IF;
  IF v_poblacion <> 7 THEN
    RAISE EXCEPTION 'Se esperaban 7 lotes nuevos de La Población y se encontraron %.', v_poblacion;
  END IF;
END $$;

COMMIT;

SELECT
  c.nombre AS campo,
  l.id,
  l.nombre AS lote
FROM public.lotes l
JOIN public.campos c ON c.id = l.campo_id
WHERE l.cliente_id = 'estancia-carahuasi'
ORDER BY c.nombre, l.nombre;
