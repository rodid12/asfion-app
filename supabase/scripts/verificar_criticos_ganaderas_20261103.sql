-- ASFION · Verificación de correcciones críticas de Ganaderas
-- Solo lectura: este archivo NO modifica ni elimina datos.

-- 1) Catálogo operativo de Recepción.
SELECT
  id,
  catalogos #> '{mortandad,categoriasPorActividad,Recepción}' AS categorias_recepcion,
  catalogos #> '{mortandad,actividadesPorCampo,Corrales}' AS actividades_corrales,
  catalogos #> '{mortandad,causaLibre}' AS causa_libre
FROM public.clientes
WHERE id = 'ganaderas';

-- 2) Retactos realmente persistidos en la tabla pariciones.
SELECT
  COALESCE(p.campania_id, 'sin-campania') AS campania_id,
  c.nombre AS campo,
  COUNT(DISTINCT p.id) AS retactos,
  MIN(p.fecha) AS primera_fecha,
  MAX(p.fecha) AS ultima_fecha
FROM public.pariciones p
JOIN public.campos c ON c.id = p.campo_id AND c.cliente_id = p.cliente_id
WHERE p.cliente_id = 'ganaderas'
  AND UPPER(BTRIM(p.evento)) = 'RETACTO'
GROUP BY COALESCE(p.campania_id, 'sin-campania'), c.nombre
ORDER BY campania_id DESC, c.nombre;

-- 3) Desglose de mermas de la campaña reproductiva activa.
WITH campania AS (
  SELECT fecha_inicio, fecha_fin
  FROM public.campanias_reproductivas
  WHERE cliente_id = 'ganaderas' AND activa = TRUE
  ORDER BY fecha_inicio DESC
  LIMIT 1
)
SELECT
  c.nombre AS campo,
  COUNT(DISTINCT p.id) FILTER (WHERE UPPER(BTRIM(p.evento)) = 'RETACTO') AS retactos,
  COUNT(DISTINCT p.id) FILTER (
    WHERE UPPER(BTRIM(COALESCE(p.causa_tipo, ''))) = 'NACIDO MUERTO'
       OR UPPER(BTRIM(p.evento)) = 'NACIDO MUERTO'
  ) AS nacidos_muertos,
  COUNT(DISTINCT p.id) FILTER (WHERE UPPER(BTRIM(p.evento)) = 'ABORTO') AS abortos,
  COUNT(DISTINCT p.id) FILTER (
    WHERE UPPER(BTRIM(p.evento)) = 'MUERTE'
      AND UPPER(BTRIM(COALESCE(p.causa_tipo, ''))) IN ('MUERTE SEÑALADO', 'MUERTE SENALADO')
  ) AS muertes_senaladas,
  COUNT(DISTINCT p.id) FILTER (WHERE UPPER(BTRIM(COALESCE(p.sexo, ''))) = 'OREJANO') AS orejanos_registrados
FROM public.campos c
CROSS JOIN campania ca
LEFT JOIN public.pariciones p
  ON p.cliente_id = c.cliente_id
 AND p.campo_id = c.id
 AND p.fecha BETWEEN ca.fecha_inicio AND ca.fecha_fin
WHERE c.cliente_id = 'ganaderas'
GROUP BY c.nombre
ORDER BY c.nombre;

-- 4) Auditoría del cálculo "Vacas sin parir" usado por app y dashboard.
WITH campania AS (
  SELECT fecha_inicio, fecha_fin
  FROM public.campanias_reproductivas
  WHERE cliente_id = 'ganaderas' AND activa = TRUE
  ORDER BY fecha_inicio DESC
  LIMIT 1
), eventos AS (
  SELECT
    c.id AS campo_id,
    c.nombre AS campo,
    COALESCE(c.stock_inicial_vacas, 0) AS stock_base,
    COUNT(DISTINCT p.id) FILTER (WHERE UPPER(BTRIM(p.evento)) = 'NACIMIENTO') AS nacimientos,
    COUNT(DISTINCT p.id) FILTER (WHERE UPPER(BTRIM(p.evento)) = 'MUERTE') AS muertes_pariciones,
    COUNT(DISTINCT p.id) FILTER (WHERE UPPER(BTRIM(p.evento)) = 'ABORTO') AS abortos
  FROM public.campos c
  CROSS JOIN campania ca
  LEFT JOIN public.pariciones p
    ON p.cliente_id = c.cliente_id
   AND p.campo_id = c.id
   AND p.fecha BETWEEN ca.fecha_inicio AND ca.fecha_fin
  WHERE c.cliente_id = 'ganaderas'
  GROUP BY c.id, c.nombre, c.stock_inicial_vacas
), vientres AS (
  SELECT
    m.campo_id,
    COUNT(DISTINCT m.id) AS mortandad_vientres
  FROM public.mortandad m
  CROSS JOIN campania ca
  WHERE m.cliente_id = 'ganaderas'
    AND m.fecha BETWEEN ca.fecha_inicio AND ca.fecha_fin
    AND UPPER(BTRIM(COALESCE(m.categoria, ''))) IN (
      'VAQ 1° SERVICIO', 'VAQ 1 SERVICIO',
      'VAQ 2° SERVICIO', 'VAQ 2 SERVICIO',
      'VC PREÑ', 'VC PREN'
    )
  GROUP BY m.campo_id
)
SELECT
  e.campo,
  e.stock_base,
  e.nacimientos,
  e.muertes_pariciones,
  COALESCE(v.mortandad_vientres, 0) AS mortandad_vientres,
  e.abortos,
  GREATEST(
    e.stock_base - e.nacimientos - e.muertes_pariciones
    - COALESCE(v.mortandad_vientres, 0) - e.abortos,
    0
  ) AS vacas_sin_parir
FROM eventos e
LEFT JOIN vientres v ON v.campo_id = e.campo_id
ORDER BY e.campo;
