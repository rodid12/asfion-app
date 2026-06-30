-- =============================================================================
-- 0020 — Resumen Mermas Servicio 2024 (tabla agregada por tropa)
-- =============================================================================
--
-- Contexto: el Excel "cierre pastoreo 26(2).xlsx" Hoja 3 trae el resumen
-- ANUAL por tropa (6 tropas) con métricas DISTINTAS a las que tenemos en la
-- tabla `pariciones` actual (que guarda eventos individuales).
--
-- Las métricas clave son:
--   • Preñadas al retacto
--   • Mortandad de vientres durante servicio (CORREGIDO — antes
--     confundíamos con muertes de terneros)
--   • NPT y Abortos al retacto
--   • Terneros Nacidos
--   • Terneros Vivos          ← MÉTRICA CLAVE (en verde en el Excel)
--   • % Destete sobre Preñado = Terneros Vivos / Preñadas
--
-- Esto NO reemplaza la tabla `pariciones` — la convive. `pariciones` sigue
-- siendo el log de eventos individuales (cargados por la app móvil),
-- mientras `pariciones_resumen_servicio` es el cierre agregado por tropa
-- que arma Agus al final de cada temporada de servicio.
--
-- Cómo aplicar:
--   1. Supabase Dashboard → SQL Editor
--   2. Pegar y RUN
--   3. Verificar:
--        SELECT campo, tropa, prenadas, mortandad_vientres, terneros_vivos
--        FROM pariciones_resumen_servicio
--        WHERE cliente_id='ganaderas' ORDER BY campo;
-- =============================================================================

CREATE TABLE IF NOT EXISTS pariciones_resumen_servicio (
  id                          TEXT PRIMARY KEY,
  cliente_id                  TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,

  -- Identificación de la tropa dentro del campo
  servicio_anio               INTEGER NOT NULL,        -- ej 2024
  campo                       TEXT NOT NULL,
  tropa                       TEXT NOT NULL,           -- "Vacas/Vaq 2 Parto", "Vaq 27M 1er Paricion", etc.

  -- Datos al servicio
  prenadas                    INTEGER,                 -- preñadas al servicio (incluye retacto)
  vacias_retacto              INTEGER,                 -- vacías al retacto
  prenadas_retacto            INTEGER,                 -- diagnóstico final
  npt_abortos_retacto         INTEGER,                 -- NPT y abortos detectados al retacto-DIC

  -- Mortandad (CORREGIDA — son vientres, no terneros)
  mortandad_vientres          INTEGER,                 -- vientres muertos durante servicio

  -- Terneros
  terneros_senalados          INTEGER,
  terneros_sin_senalar        INTEGER,
  recuento_salida_terneros    INTEGER,

  -- Resultados (las claves)
  vacas_durante_servicio      INTEGER,                 -- = prenadas - mortandad
  terneros_nacidos            INTEGER,
  terneros_vivos              INTEGER,                 -- *** MÉTRICA CLAVE ***

  -- Mermas y porcentajes (calculados ex-ante, los guardamos para auditar)
  merma_tr_paricion           NUMERIC(6,4),
  merma_tr_destete            NUMERIC(6,4),
  pct_abortos_npt             NUMERIC(6,4),
  pct_mort_vientres           NUMERIC(6,4),
  pct_mort_tern_senalados     NUMERIC(6,4),
  pct_mort_tern_sin_senal     NUMERIC(6,4),
  pct_destete_sobre_prenado   NUMERIC(6,4),            -- = terneros_vivos / prenadas

  observaciones               TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_par_resumen_cliente ON pariciones_resumen_servicio(cliente_id);
CREATE INDEX IF NOT EXISTS idx_par_resumen_anio    ON pariciones_resumen_servicio(cliente_id, servicio_anio);
CREATE INDEX IF NOT EXISTS idx_par_resumen_campo   ON pariciones_resumen_servicio(cliente_id, campo);

-- RLS
ALTER TABLE pariciones_resumen_servicio ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS par_resumen_select ON pariciones_resumen_servicio;
DROP POLICY IF EXISTS par_resumen_modify ON pariciones_resumen_servicio;
CREATE POLICY par_resumen_select ON pariciones_resumen_servicio
  FOR SELECT TO authenticated
  USING (cliente_id = current_cliente_id() OR is_super_admin());
CREATE POLICY par_resumen_modify ON pariciones_resumen_servicio
  FOR ALL TO authenticated
  USING (cliente_id = current_cliente_id() OR is_super_admin())
  WITH CHECK (cliente_id = current_cliente_id() OR is_super_admin());

-- =============================================================================
-- Seed: 6 tropas del Servicio 2024 (Excel Hoja 3)
-- =============================================================================

INSERT INTO pariciones_resumen_servicio (
  id, cliente_id, servicio_anio, campo, tropa,
  prenadas, vacias_retacto, prenadas_retacto, npt_abortos_retacto,
  mortandad_vientres,
  terneros_senalados, terneros_sin_senalar, recuento_salida_terneros,
  vacas_durante_servicio, terneros_nacidos, terneros_vivos,
  merma_tr_paricion, merma_tr_destete,
  pct_abortos_npt, pct_mort_vientres, pct_mort_tern_senalados,
  pct_mort_tern_sin_senal, pct_destete_sobre_prenado
) VALUES
  -- 1: Carolina · Vacas/Vaq 2 Parto
  ('par-res-2024-01','ganaderas',2024,'Carolina','Vacas/Vaq 2 Parto',
   438, NULL, 438, 7, 3,
   26, 21, 1,
   435, 423, 396,
   0.0365, 0.0897,
   0.0160, 0.0068, 0.0616, 0.0504, 0.9041),

  -- 2: Quirquincho · Vaq 27M 1er Paricion
  ('par-res-2024-02','ganaderas',2024,'Quirquincho','Vaq 27 Meses 1er Paricion',
   621, 37, 621, 48, 32,
   43, 31, NULL,
   589, 564, 521,
   0.0918, 0.1677,
   0.0729, 0.0486, 0.0762, 0.0562, 0.8390),

  -- 3: Picaflor · Vacas Rueda
  ('par-res-2024-03','ganaderas',2024,'Picaflor','Vacas Rueda',
   481, NULL, 481, 12, 3,
   11, 12, NULL,
   478, 468, 457,
   0.0270, 0.0439,
   0.0249, 0.0062, 0.0235, 0.0256, 0.9501),

  -- 4: Picaflor · Vacas L Carranza
  ('par-res-2024-04','ganaderas',2024,'Picaflor','Vacas L carranza',
   480, NULL, 480, 19, 4,
   20, 18, 7,
   476, 447, 420,
   0.0833, 0.1176,
   0.0396, 0.0083, 0.0455, 0.0411, 0.8750),

  -- 5: Picaflor · Vaca Cut
  ('par-res-2024-05','ganaderas',2024,'Picaflor','Vaca Cut',
   40, NULL, 40, 6, 2,
   2, 1, NULL,
   38, 32, 30,
   0.2000, 0.2105,
   0.1500, 0.0500, 0.0625, 0.0323, 0.7500),

  -- 6: Progreso · Vacas 3 Parto
  ('par-res-2024-06','ganaderas',2024,'Progreso','Vacas 3 Parto',
   433, NULL, 433, 12, 5,
   24, 8, NULL,
   428, 414, 390,
   0.0439, 0.0888,
   0.0277, 0.0115, 0.0580, 0.0201, 0.9007)

ON CONFLICT (id) DO UPDATE SET
  prenadas                  = EXCLUDED.prenadas,
  vacias_retacto            = EXCLUDED.vacias_retacto,
  prenadas_retacto          = EXCLUDED.prenadas_retacto,
  npt_abortos_retacto       = EXCLUDED.npt_abortos_retacto,
  mortandad_vientres        = EXCLUDED.mortandad_vientres,
  terneros_senalados        = EXCLUDED.terneros_senalados,
  terneros_sin_senalar      = EXCLUDED.terneros_sin_senalar,
  recuento_salida_terneros  = EXCLUDED.recuento_salida_terneros,
  vacas_durante_servicio    = EXCLUDED.vacas_durante_servicio,
  terneros_nacidos          = EXCLUDED.terneros_nacidos,
  terneros_vivos            = EXCLUDED.terneros_vivos,
  merma_tr_paricion         = EXCLUDED.merma_tr_paricion,
  merma_tr_destete          = EXCLUDED.merma_tr_destete,
  pct_abortos_npt           = EXCLUDED.pct_abortos_npt,
  pct_mort_vientres         = EXCLUDED.pct_mort_vientres,
  pct_mort_tern_senalados   = EXCLUDED.pct_mort_tern_senalados,
  pct_mort_tern_sin_senal   = EXCLUDED.pct_mort_tern_sin_senal,
  pct_destete_sobre_prenado = EXCLUDED.pct_destete_sobre_prenado,
  updated_at                = NOW();

-- =============================================================================
-- Totales esperados (para sanity check):
--   Preñadas:           2.493  (en realidad 2.530 si se cuentan también las
--                                vacías al retacto + las vacas no retactadas
--                                — 37 + 2493 = 2530, ver columnas E vs G)
--   Mortandad vientres:    49
--   Terneros Nacidos:   2.348
--   Terneros Vivos:     2.214
--   % Destete promedio: 88.81%
-- =============================================================================
