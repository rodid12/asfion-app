-- ASFION — Fix Stock Inicial de Ganaderas.
--
-- Bug: el dashboard muestra Stock Base = 1972, pero el valor real (según el
-- GVA de Agus) es 2493. La diferencia es Picaflor, que tiene DOS operarios
-- cargando con stocks distintos (ruedaroberto 521 + luisfernandocarranza 480
-- = 1001 totales). Hoy `campos.stock_inicial_vacas` toma solo 480.
--
-- Fix simple: actualizar el valor de stock_inicial_vacas para que refleje la
-- suma per-campo. Si en el futuro un campo gana o pierde operarios, hay que
-- volver a ajustar a mano. Por ahora alcanza para corregir el dashboard.
--
-- Para una solución más permanente (tracking per-operario), se podría crear
-- una tabla `stock_inicial(cliente_id, campo_id, usuario_email, stock)` y
-- sumar, pero implica cambios en app y dashboard. Lo dejamos para una
-- iteración posterior.

UPDATE campos
SET stock_inicial_vacas = CASE id
  WHEN 'campo-picaflor'    THEN 1001  -- 521 + 480 (dos operarios)
  WHEN 'campo-progreso'    THEN 433
  WHEN 'campo-carolina'    THEN 438
  WHEN 'campo-quirquincho' THEN 621
  WHEN 'campo-agisot'      THEN 0     -- sin parición todavía, ajustar cuando aplique
  WHEN 'campo-margarita'   THEN 0     -- idem
  ELSE stock_inicial_vacas
END
WHERE cliente_id = 'ganaderas';

-- Verificación: el siguiente SELECT debería devolver 2493.
-- Correr a mano después de aplicar la migración para confirmar.
--
-- SELECT SUM(stock_inicial_vacas) AS stock_base_total
-- FROM campos
-- WHERE cliente_id = 'ganaderas';
