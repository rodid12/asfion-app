-- Ganaderas: habilita la actividad Recepción exclusivamente en Corrales.
-- No requiere cambios de esquema; causa_detalle y numero_corral ya existen.

UPDATE public.clientes
SET catalogos = jsonb_set(
      jsonb_set(
        jsonb_set(
          COALESCE(catalogos, '{}'::jsonb),
          '{mortandad,actividades}',
          '["Cria","Recria P","Recepción","engorde","Invernada","Destete Precoz"]'::jsonb,
          true
        ),
        '{mortandad,actividadesPorCampo,Corrales}',
        '["Recepción","engorde","Invernada","Destete Precoz"]'::jsonb,
        true
      ),
      '{mortandad,causaLibre}',
      'true'::jsonb,
      true
    ),
    updated_at = NOW()
WHERE id = 'ganaderas';

SELECT
  id,
  catalogos #> '{mortandad,actividades}' AS actividades,
  catalogos #> '{mortandad,actividadesPorCampo,Corrales}' AS actividades_corrales,
  catalogos #> '{mortandad,causaLibre}' AS causa_libre
FROM public.clientes
WHERE id = 'ganaderas';
