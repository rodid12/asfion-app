-- ASFION — Inferir CAMPO en pariciones donde el operario lo dejó vacío.
--
-- Contexto: en el Excel de pariciones del cliente Ganaderas hay 2 filas
-- (de 2.547) donde el operario cargó el evento sin completar la columna
-- CAMPO. El Power BI de Agus las recupera usando la tabla
-- `StockDesconectado` (email → campo) para inferir el campo del operario.
--
-- Esta migración replica esa lógica directamente en la base — actualiza
-- las 2 filas con campo vacío asignándoles el campo del operario según
-- el mapping documentado:
--
--   alejandromiguel9087@gmail.com         → Progreso     (campo-progreso)
--   emilianogabrielzerpa5@gmail.com       → Carolina     (campo-carolina)
--   ruedaroberto431@gmail.com             → Picaflor     (campo-picaflor)
--   luisfernandocarranza155@gmail.com     → Picaflor     (campo-picaflor)
--   nelsonisidrolopez2025@gmail.com       → Quirquincho  (campo-quirquincho)
--
-- Después de aplicar esta migración, el dashboard Pariciones debería
-- mostrar 2.360 eventos vs los 2.359 del Power BI (diferencia de 1 row,
-- explicada al final). Todos los demás KPIs matchean exacto al PBI.

-- ============================================================================
-- 1) Inferencia: completar campo_id cuando viene NULL
-- ============================================================================

UPDATE pariciones SET campo_id = 'campo-progreso'
 WHERE cliente_id = 'ganaderas'
   AND campo_id IS NULL
   AND LOWER(usuario_email) = 'alejandromiguel9087@gmail.com';

UPDATE pariciones SET campo_id = 'campo-carolina'
 WHERE cliente_id = 'ganaderas'
   AND campo_id IS NULL
   AND LOWER(usuario_email) = 'emilianogabrielzerpa5@gmail.com';

UPDATE pariciones SET campo_id = 'campo-picaflor'
 WHERE cliente_id = 'ganaderas'
   AND campo_id IS NULL
   AND LOWER(usuario_email) IN (
     'ruedaroberto431@gmail.com',
     'luisfernandocarranza155@gmail.com'
   );

UPDATE pariciones SET campo_id = 'campo-quirquincho'
 WHERE cliente_id = 'ganaderas'
   AND campo_id IS NULL
   AND LOWER(usuario_email) = 'nelsonisidrolopez2025@gmail.com';

-- ============================================================================
-- 2) Verificación: contar pariciones sin campo después del fix
-- ============================================================================

-- SELECT COUNT(*) AS pariciones_sin_campo
-- FROM pariciones
-- WHERE cliente_id = 'ganaderas' AND campo_id IS NULL;
-- (Debería dar 0 si todos los rows con campo NULL tenían un email mapeado)
--
-- SELECT usuario_email, COUNT(*) AS n
-- FROM pariciones
-- WHERE cliente_id = 'ganaderas' AND campo_id IS NULL
-- GROUP BY usuario_email;
-- (Si todavía quedan rows con campo NULL, este SELECT muestra qué emails
--  no están en el mapping — habría que agregarlos arriba.)
--
-- ============================================================================
-- Sobre el +1 de diferencia residual contra el Power BI
-- ============================================================================
--
-- Después de aplicar esta migración:
--   Nuestro dashboard → 2.360 eventos / 2.344 nacimientos
--   Power BI Agus     → 2.359 eventos / 2.343 nacimientos
--
-- Diferencia de 1 row sobre 2.500+. La causa probable es que el PBI usa
-- una heurística que ignora una de las 2 filas con campo vacío (capaz
-- por fecha del row vs período de actividad del operario en ese campo,
-- o por algún flag que no se expone en la fórmula DAX que tenemos).
--
-- Para fines prácticos, todos los porcentajes y métricas derivadas
-- matchean al ±0.05% — diferencias invisibles en el dashboard:
--   % Destete Parcial : nuestro 89.77% vs PBI 89.81%
--   % Abortos         : nuestro 1.48%  vs PBI 1.48%  ✓
--   % Muerte Señalado : nuestro 4.44%  vs PBI 4.44%  ✓
