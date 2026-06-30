-- ============================================================================
-- Tactos preñez — completar 3 rodeos que estaban en 0
-- ============================================================================
--
-- Contexto: el seed inicial de la migración 0012 cargó los 7 rodeos del
-- piloto Ganaderas, pero 3 quedaron en cero porque al momento de cargar
-- los datos del Excel original todavía no se habían hecho los tactos:
--   - Vaquillas 2° Serv C  (id: tacto-gva-003)
--   - Vacas Picaflor IATF  (id: tacto-gva-006)
--   - Vacas Picaflor Toro  (id: tacto-gva-007)
--
-- En el dashboard estos rodeos aparecían como "0 / 0" sin % de preñez,
-- haciendo que el KPI global "% Rodeo Evaluado" diera 52.6% en vez del
-- 99.2% real (3.048 tactadas / 3.072 origen).
--
-- Esta migración carga los datos reales del último tacto enviado por Agus
-- (archivo "prenez.xlsx", junio 2026). Los otros 4 rodeos siguen igual
-- porque sus valores coinciden con el Excel.
--
-- Idempotente: UPDATE por ID, se puede correr varias veces sin efecto.
--
-- Resultado esperado en el dashboard:
--   Origen Total      = 3.072  (sin cambios)
--   Preñadas Totales  = 2.715  (antes: 1.453)
--   Vacías Totales    =   333  (antes:   162)
--   % Preñez General  = 89.07% (antes:  90.0% — el % subió artificialmente
--                               porque solo se promediaban 4 de 7 rodeos)
--   Faltan Tactar     =    24  (antes: 1.457)
--   % Rodeo Evaluado  = 99.2%  (antes: 52.6%)

-- ============================================================================
-- 1) Vaquillas 2° Serv C
-- ============================================================================
UPDATE tactos
SET prenez_cabeza = 235,
    prenez_cuerpo = 153,
    prenez_cola   = 71,
    vacias        = 73,
    updated_at    = now()
WHERE id = 'tacto-gva-003'
  AND cliente_id = 'ganaderas';

-- ============================================================================
-- 2) Vacas Picaflor IATF
-- ============================================================================
UPDATE tactos
SET prenez_cabeza = 299,
    prenez_cuerpo = 171,
    prenez_cola   = 45,
    vacias        = 41,
    updated_at    = now()
WHERE id = 'tacto-gva-006'
  AND cliente_id = 'ganaderas';

-- ============================================================================
-- 3) Vacas Picaflor Toro
-- ============================================================================
UPDATE tactos
SET prenez_cabeza = 84,
    prenez_cuerpo = 161,
    prenez_cola   = 43,
    vacias        = 57,
    updated_at    = now()
WHERE id = 'tacto-gva-007'
  AND cliente_id = 'ganaderas';

-- ============================================================================
-- 4) Verificación post-update — corré este SELECT después de aplicar
-- ============================================================================
-- SELECT
--   rodeo,
--   origen_total,
--   prenez_cabeza + prenez_cuerpo + prenez_cola AS total_prenadas,
--   vacias,
--   (prenez_cabeza + prenez_cuerpo + prenez_cola + vacias) AS tactadas,
--   origen_total - (prenez_cabeza + prenez_cuerpo + prenez_cola + vacias) AS faltan_tactar,
--   ROUND(100.0 * (prenez_cabeza + prenez_cuerpo + prenez_cola)
--         / NULLIF((prenez_cabeza + prenez_cuerpo + prenez_cola + vacias), 0), 2)
--     AS pct_prenez
-- FROM tactos
-- WHERE cliente_id = 'ganaderas'
-- ORDER BY rodeo;
--
-- Esperado: ningún rodeo con tactadas = 0. Total faltan = 24 (= 1+8+13+1+0+1+0)
