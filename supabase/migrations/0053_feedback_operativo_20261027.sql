-- =============================================================================
-- 0053 — Feedback operativo 27/10/2026
-- =============================================================================
-- 1) Observaciones en Lluvias y Pastoreo (Pariciones, Mortandad, Compras y
--    Ventas ya contaban con ese dato).
-- 2) Catálogos condicionados de Mortandad para Ganaderas, causa libre y
--    actividad Recepción en Corrales.
-- 3) Circuito/parcela provisoria para los dos campos de Estancia Carahuasi,
--    de modo que Pastoreo sea utilizable mientras el cliente envía el detalle
--    territorial definitivo.
--
-- Script idempotente: puede ejecutarse más de una vez.
-- =============================================================================

BEGIN;

ALTER TABLE public.lluvias
  ADD COLUMN IF NOT EXISTS observaciones TEXT;

ALTER TABLE public.pastoreo
  ADD COLUMN IF NOT EXISTS observaciones TEXT;

COMMENT ON COLUMN public.lluvias.observaciones IS
  'Detalle libre informado por el operario al cargar la precipitación.';
COMMENT ON COLUMN public.pastoreo.observaciones IS
  'Detalle libre informado por el operario para el movimiento de pastoreo.';

-- Se vuelve a declarar la configuración completa para evitar que una versión
-- parcial o cacheada del catálogo deje visibles categorías incorrectas.
UPDATE public.clientes
SET catalogos = jsonb_set(
      COALESCE(catalogos, '{}'::jsonb),
      '{mortandad}',
      '{
        "categorias": ["Novillito","Novillo","TernH","TernM","Toro Venta","Toros","Vac Descarte","Vac Repos","Vaq 1","Vaq 1° Servicio","Vaq 2","Vaq 2° Servicio","Vc Preñ","Vc Venta"],
        "actividades": ["Cria","Recria P","Recepción","engorde","Invernada","Destete Precoz"],
        "causaTipos": ["Muerte Señalado","Nacido Muerto","Desconocido"],
        "causaLibre": true,
        "actividadesPorCampo": {
          "Corrales": ["Recepción","engorde","Invernada","Destete Precoz"],
          "__otros__": ["Cria","Recria P"]
        },
        "categoriasPorActividad": {
          "Cria": ["Vc Preñ","Vc Venta","Toros","Toro Venta","TernH","TernM","Vaq 1° Servicio","Vaq 2° Servicio"],
          "Recria P": ["Vaq 2","Novillo","Vaq 1","Novillito"],
          "engorde": ["Vc Venta","Novillo","Vaq 2"],
          "Invernada": ["Vaq 1","Novillito"],
          "Destete Precoz": ["TernH","TernM"]
        },
        "etiquetas": {
          "Cria": "Cría",
          "Recria P": "Recría a pasto",
          "engorde": "Engorde",
          "Vc Preñ": "Vacas preñadas",
          "Vc Venta": "Vaca venta",
          "TernH": "Ternero H",
          "TernM": "Ternero M",
          "Vaq 1° Servicio": "Vaquilla 15M",
          "Vaq 2° Servicio": "Vaquilla 27M",
          "Vaq 1": "Vaquilla 1",
          "Vaq 2": "Vaquilla 2"
        }
      }'::jsonb,
      true
    ),
    updated_at = NOW()
WHERE id = 'ganaderas';

-- Catálogo provisorio de Pastoreo para Carahuasi. Al recibir circuitos,
-- parcelas y superficies reales, se reemplazan estos dos registros sin tocar
-- los eventos históricos que ya se hayan cargado.
INSERT INTO public.circuitos (id, cliente_id, campo_id, nombre, hectareas)
VALUES
  (
    'circ-estancia-carahuasi-carahuasi-general',
    'estancia-carahuasi',
    'campo-estancia-carahuasi-carahuasi',
    'General (provisorio)',
    0
  ),
  (
    'circ-estancia-carahuasi-la-poblacion-general',
    'estancia-carahuasi',
    'campo-estancia-carahuasi-la-poblacion',
    'General (provisorio)',
    0
  )
ON CONFLICT (id) DO UPDATE SET
  cliente_id = EXCLUDED.cliente_id,
  campo_id = EXCLUDED.campo_id,
  nombre = EXCLUDED.nombre;

INSERT INTO public.parcelas (id, cliente_id, circuito_id, numero, hectareas)
VALUES
  (
    'parc-estancia-carahuasi-carahuasi-general-1',
    'estancia-carahuasi',
    'circ-estancia-carahuasi-carahuasi-general',
    1,
    0
  ),
  (
    'parc-estancia-carahuasi-la-poblacion-general-1',
    'estancia-carahuasi',
    'circ-estancia-carahuasi-la-poblacion-general',
    1,
    0
  )
ON CONFLICT (id) DO UPDATE SET
  cliente_id = EXCLUDED.cliente_id,
  circuito_id = EXCLUDED.circuito_id,
  numero = EXCLUDED.numero;

COMMIT;

-- Verificación: 2 filas, una por cada campo de Carahuasi.
SELECT
  c.nombre AS campo,
  ci.nombre AS circuito,
  p.numero AS parcela,
  ci.hectareas AS hectareas_circuito,
  p.hectareas AS hectareas_parcela
FROM public.circuitos ci
JOIN public.campos c ON c.id = ci.campo_id
JOIN public.parcelas p ON p.circuito_id = ci.id
WHERE ci.cliente_id = 'estancia-carahuasi'
ORDER BY c.nombre, ci.nombre, p.numero;
