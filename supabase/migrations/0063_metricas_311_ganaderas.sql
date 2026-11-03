-- =============================================================================
-- 0063 · Correcciones de métricas Ganaderas informadas el 03/11/2026
-- =============================================================================
-- 1) Corrige un Aborto marcado erróneamente como Orejano.
-- 2) Vincula los Retactos del 04/08/2026 con la campaña 2026/27. El evento
--    ocurrió antes de la ventana Sep–Mar, pero pertenece operativamente al
--    mismo ciclo y debe aparecer en Mermas.
-- 3) Estandariza variantes simples de causas sin borrar detalles descriptivos.
-- Script idempotente.
-- =============================================================================

BEGIN;

UPDATE public.pariciones
SET sexo = NULL
WHERE id = 'd0a6ea85'
  AND cliente_id = 'ganaderas'
  AND evento = 'Aborto'
  AND UPPER(BTRIM(COALESCE(sexo, ''))) = 'OREJANO';

UPDATE public.pariciones
SET campania_id = 'campania-ganaderas-2026-2027'
WHERE cliente_id = 'ganaderas'
  AND evento = 'Retacto'
  AND fecha = DATE '2026-08-04'
  AND campo_id = 'campo-quirquincho'
  AND usuario_email = 'nelsonisidrolopez2025@gmail.com';

UPDATE public.mortandad
SET causa_detalle = 'Desconocida'
WHERE cliente_id = 'ganaderas'
  AND LOWER(BTRIM(COALESCE(causa_detalle, ''))) IN (
    'desconocida', 'desconocido', 'desconicida',
    'desconocida.', 'desconocida .', 'sin especificar', 'sin identificar'
  );

UPDATE public.mortandad
SET causa_tipo = 'Desconocida'
WHERE cliente_id = 'ganaderas'
  AND LOWER(BTRIM(COALESCE(causa_tipo, ''))) IN (
    'desconocida', 'desconocido', 'desconicida',
    'desconocida.', 'desconocida .', 'sin especificar', 'sin identificar'
  );

UPDATE public.mortandad
SET causa_detalle = 'Infección'
WHERE cliente_id = 'ganaderas'
  AND LOWER(BTRIM(COALESCE(causa_detalle, ''))) IN (
    'infección', 'infeccion', 'infecion', 'infección.', 'infeccion.', 'infecion.'
  );

UPDATE public.mortandad
SET causa_tipo = 'Infección'
WHERE cliente_id = 'ganaderas'
  AND LOWER(BTRIM(COALESCE(causa_tipo, ''))) IN (
    'infección', 'infeccion', 'infecion', 'infección.', 'infeccion.', 'infecion.'
  );

COMMIT;

-- Verificaciones finales.
SELECT id, evento, sexo, campania_id
FROM public.pariciones
WHERE id = 'd0a6ea85' AND cliente_id = 'ganaderas';

SELECT campania_id, campo_id, evento, COUNT(*) AS cantidad
FROM public.pariciones
WHERE cliente_id = 'ganaderas'
  AND evento = 'Retacto'
  AND fecha = DATE '2026-08-04'
GROUP BY campania_id, campo_id, evento;

SELECT COALESCE(causa_detalle, causa_tipo, 'Sin especificar') AS causa, COUNT(*) AS cantidad
FROM public.mortandad
WHERE cliente_id = 'ganaderas'
GROUP BY COALESCE(causa_detalle, causa_tipo, 'Sin especificar')
ORDER BY cantidad DESC, causa;
