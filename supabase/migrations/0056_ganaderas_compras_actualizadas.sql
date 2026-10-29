-- =============================================================================
-- 0056 — Ganaderas: compras actualizadas y correlativo automático NN-YY
-- =============================================================================
-- Fuente: Compra_actualizada.xlsx, hoja Compra, recibida el 29/10/2026.
--
-- - Reemplaza el histórico anterior por las 25 operaciones oficiales del Excel.
-- - Conserva la compra nueva ya cargada y corrige su número a 26-26.
-- - La próxima compra de 2026 será generada por la app como 27-26.
-- - Conserva los kilómetros decimales presentes en la fuente.
--
-- Seguridad: si no se encuentra exactamente una compra nueva posterior al Excel,
-- la transacción se cancela para no renumerar un registro incorrecto.
-- Script idempotente.
-- =============================================================================

BEGIN;

ALTER TABLE public.compras
  ALTER COLUMN km_recorrido TYPE NUMERIC(10,2)
  USING km_recorrido::NUMERIC;

-- Identificar la única compra nueva que no forma parte de las 25 filas oficiales.
DO $$
DECLARE
  v_id TEXT;
  v_cantidad INTEGER;
BEGIN
  SELECT COUNT(*), MAX(id)
  INTO v_cantidad, v_id
  FROM public.compras
  WHERE cliente_id = 'ganaderas'
    AND id NOT IN (
      '845af867',
      '49cac26d',
      'cbf8ae5a',
      '45af0bb2',
      '996f93df',
      '68d62ea6',
      '2d2efebd',
      '7f5ff68a',
      'c6139ac7',
      '2a9bb778',
      'f8194997',
      'aea28ba2',
      '3147ccd3',
      '8e6eb597',
      '97cf0c30',
      '9a95120f',
      '8c3042b3',
      'c0896340',
      '1ad4b310',
      '23eab457',
      '969c5463',
      '4d595099',
      'e3af7b6e',
      'fcba561d',
      '261ec7ec'
    )
    AND id NOT LIKE 'compra-2026-%'
    AND (
      fecha > DATE '2026-10-23'
      OR created_at::date > DATE '2026-10-23'
    );

  IF v_cantidad <> 1 THEN
    RAISE EXCEPTION
      'Se esperaba exactamente 1 compra nueva para asignarle 26-26, pero se encontraron %.',
      v_cantidad;
  END IF;

  UPDATE public.compras
  SET numero_operacion = '26-26'
  WHERE id = v_id;
END $$;

-- Quitar cualquier histórico anterior que no pertenezca al Excel oficial.
-- La única fila externa preservada es la compra nueva, ya corregida a 26-26.
DELETE FROM public.compras
WHERE cliente_id = 'ganaderas'
  AND id NOT IN (
    '845af867','49cac26d','cbf8ae5a','45af0bb2','996f93df',
    '68d62ea6','2d2efebd','7f5ff68a','c6139ac7','2a9bb778',
    'f8194997','aea28ba2','3147ccd3','8e6eb597','97cf0c30',
    '9a95120f','8c3042b3','c0896340','1ad4b310','23eab457',
    '969c5463','4d595099','e3af7b6e','fcba561d','261ec7ec'
  )
  AND numero_operacion IS DISTINCT FROM '26-26';

INSERT INTO public.compras (
  id, cliente_id, campo_id, usuario_email, fecha, actividad,
  cant_cab_y_cat, total_machos, total_hembras,
  kg_netos_origen, kg_netos_destino, merma_porcentaje, kg_corregidos,
  precio, consignado, titular, plazo, numero_dte, numero_operacion,
  km_recorrido, flete, observaciones, created_at
) VALUES
  ('845af867', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-05-07', 'Invernada', '64 machos. 60 hembras', 64, 60, 22184, 21400, 3.5, NULL, 5300, 'Pérez Alsina caro', 'Galván Jorge Rubén. Bruner. Las Breñas. Chaco', 'Contado', '0317078175', '1-26', 465, 'La huella', 'No coincide la cantidad de machos y hembras pactados.', '2026-05-07 12:00:01-03'),
  ('49cac26d', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-05-07', 'Invernada', '70 machos. 40 hembras', 70, 40, 20448, 20770, NULL, NULL, 5500, 'BGL', 'Mattes Carlos Walter. Cerro 60. El Dorado. Misiones', '30/60', '0317028180', '2-26', 1240, 'Ñangapiry SA', 'Un ternero caído a alambrado, camina con mano doblada. Algunos animales lastimados en la vacuna.', '2026-05-07 12:00:02-03'),
  ('cbf8ae5a', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-05-14', 'Invernada', '83 machos. 39 hembras', 83, 39, 23765, 23260, 2.1, NULL, 5800, 'Eduardo rueda', 'Villar/el yugo. Resistencia. Chaco', '30/60', '031760978/0317662696', '3-26', 786, 'L y M', NULL, '2026-05-14 12:00:03-03'),
  ('45af0bb2', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-05-15', 'Invernada', '90 machos. 40 hembras', 90, 40, 19350, 18920, 2.2, NULL, 6000, 'BGL', 'Agrocomercial yuquery SRL. Agro comercial albiach. San Martín. Chaco', '30/60', '0317738684', '4-26', 645, 'Amalfi SAS', NULL, '2026-05-15 12:00:04-03'),
  ('996f93df', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-05-15', 'Invernada', '87 machos. 33 hembras', 87, 33, 22034, 20800, 5.6, NULL, 5800, 'Eduardo rueda', 'El yugo SAS. Los norteños. Reconquista. Santa Fe', '30/60', '0317762186', '5-26', 729, 'Transporte Luciano', NULL, '2026-05-15 12:00:05-03'),
  ('68d62ea6', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-05-15', 'Invernada', '74 machos. 46 hembras', 74, 46, 22776, 21290, 6.5, NULL, 5100, 'A. Usandivaras', 'Carneiro lobo. CN. Irigoyen. Misiones', 'Contado', '0317756321', '6-26', 1113, 'Dellamea juan', '38 % hembras', '2026-05-15 12:00:06-03'),
  ('2d2efebd', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-05-23', 'Invernada', '83 machos. 27 hembras', 83, 27, 19995, 19040, 4.7, NULL, 5200, 'Teo', 'Serial Ojeda Leandro. Timboy. Saladas. Corrientes', 'Contado', '0318444587', '7-26', 873, 'TBS SAS', NULL, '2026-05-23 12:00:07-03'),
  ('7f5ff68a', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-05-26', 'Invernada', '81 machos. 29 hembras', 81, 29, 19526, 19160, 1.87, NULL, 5300, 'Ganacor', 'Díaz Eric Javier. Doño Griselda. Colonia Elisa. Chaco', 'Contado', '0318487316', '8-26', 571, 'Amcu', NULL, '2026-05-26 12:00:08-03'),
  ('c6139ac7', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-05-28', 'Invernada', '71 machos. 29 hembras', 71, 29, 17014, 16760, 1.49, NULL, 5300, 'Ganacor', 'Juárez Marcelo Alberto. Santa marina. Laguna blanca. Formosa', 'Contado', '0318649435', '9-26', 872, 'Amcu', '3 terneros más chicos que el resto, débiles. Veremos como siguen.', '2026-05-28 12:00:09-03'),
  ('2a9bb778', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-06-02', 'Invernada', '82 machos. 33 hembras', 82, 33, 22658, 21227, 6.32, NULL, 5300, 'Ganacor', 'Acevedo claudio', 'Contado', '0318975744', '10-26', 581, NULL, '1 ternera renga', '2026-06-02 12:00:10-03'),
  ('f8194997', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-06-04', 'Invernada', '85 machos. 37 hembras', 85, 37, 20715, 18780, 9.34, NULL, 5000, 'Abelardo usandivaras', 'Carneiro lobo braian. Rancho JR. Irigoyen. Misiones', 'Contado', '0319269442', '11-26', 1317, NULL, NULL, '2026-06-04 12:00:11-03'),
  ('aea28ba2', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-06-05', 'Invernada', '84 machos. 34 hembras', 84, 34, 21627, 20520, 5.12, NULL, 5200, 'Pérez Alsina', 'Tomasella Carlos/Suárez Matías/gauna julio. Goya corrientes', 'Contado', '0319330879/31410/88370/30607', '12-26', 979, NULL, '1 macho rengo. Veremos como sigue', '2026-06-05 12:00:12-03'),
  ('3147ccd3', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-06-05', 'Invernada', '65 machos. 1 hembra', 65, 1, 13375, 13240, 1.01, NULL, 5200, 'Eduardo rueda', 'Cisneros Walter/ Elias Martin. Taco pozo. Chaco', 'Contado / 30/60', '0319431985/0319234255', '13-26', 131.4, NULL, '5200 contado lo de cisneros Walter. 5500 a 30/60 días los de Elías martin', '2026-06-05 12:00:13-03'),
  ('8e6eb597', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-06-05', 'Invernada', '65 machos. 56 hembras', 65, 56, 21303, 19980, 6.21, NULL, 5000, 'Abelardo usandivaras', 'Carneiro lobo. Rancho JR . Irigoyen. Misiones', 'Contado', '0319397159/97000/57599', '14-26', 1291, 'SCH', '1 ternera muerta. Se descuentan kg prom al transporte', '2026-06-05 12:00:14-03'),
  ('97cf0c30', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-06-06', 'Invernada', '52 machos. 27 hembras', 52, 27, 13680, 14090, -3, NULL, 5250, 'Abelardo usandivaras', 'De Jesús victoria MB. Victoria. San Martin. Chaco', 'Contado', '0319483055', '15-26', 316, 'Marce live', 'Se devolvieron 27 machos livianos', '2026-06-06 12:00:15-03'),
  ('9a95120f', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-06-09', 'Invernada', '99 machos', 99, NULL, 21563, 21060, 2.33, NULL, 5100, 'Juan calderoni', 'Torres Jorge. Lamcruz. Corrientes', 'Contado', '0319561609', '16-26', 1070, 'TD', 'Se bajaron en margaritas hasta que mejore el camino', '2026-06-09 12:00:16-03'),
  ('8c3042b3', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-07-07', 'Invernada', '121 terneros', NULL, NULL, 20951, 19700, 5.97, NULL, 5400, 'Pérez Alsina caro', 'De bortolini Néstor y otros', NULL, '0321325351', '17-26', 897, 'TD', '1 caído pero bajo bien', '2026-07-07 12:00:17-03'),
  ('c0896340', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-07-07', 'Invernada', '165 terneros', NULL, NULL, 30240, 30240, 0, NULL, 5300, 'Nicolás aguirre', 'Sastre fernando', 'Contado', NULL, '18-26', 12, 'TD', NULL, '2026-07-07 12:00:18-03'),
  ('1ad4b310', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-09-11', 'Recepción', '38 novillitos 15 vaq 1', NULL, NULL, 10071, 10000, 0.7, NULL, 5300, 'Eduardo rueda', 'Miguel Elias martin', '30', '0325720921', '19-26', 130, 'TD', NULL, '2026-09-11 12:00:19-03'),
  ('23eab457', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-10-02', 'Recepción', '83 machos 40 hembras', 83, 40, 21560, 20340, 5.66, NULL, 5200, 'Pérez Alsina caro', 'ZZ consignataria de hacienda y otros', NULL, '0327127926 y otros', '20-26', 956, 'TD', '29 M y 16H en mal estado. Quedan en observación', '2026-10-02 12:00:20-03'),
  ('969c5463', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-10-06', 'Recepción', '58 machos. 42 hembras', 58, 42, 18199, 17557, 3.53, NULL, 5500, 'Eduardo rueda', 'Torino rodolfo', '30/60', '03227418467', '21-26', 40.5, 'TD', NULL, '2026-10-06 12:00:21-03'),
  ('4d595099', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-10-06', 'Recepción', '67 machos. 27 hembras', 67, 27, 17071, 16600, 2.76, NULL, 5500, 'Eduardo rueda', 'Rodolfo torino', '30/60', '0327417711', '22-26', 40.5, 'TD', NULL, '2026-10-06 12:00:22-03'),
  ('e3af7b6e', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-10-07', 'Recepción', '82 machos 30 hembras', 82, 30, 21940, 20640, 5.93, NULL, 5200, 'Pérez Alsina caro', 'ZZ consignataria y otros', 'Contado', '0327413260 y otros', '23-26', 905, 'TD', '1 ternera chica y golpeada. 1 torito manco', '2026-10-07 12:00:23-03'),
  ('fcba561d', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-10-17', 'Recepción', '77 machos 28 hembras', 77, 28, 22756, 22280, 2.09, NULL, 5200, 'Santiago scofano', 'Acevedo Claudio. San Martin chaco', '30', '0328040935/0328041146', '24-26', 587, 'Amcu', '1 ternera sin pezuña descarte', '2026-10-17 12:00:24-03'),
  ('261ec7ec', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-10-23', 'Recepción', '45 machos. 13 hembras', 45, 13, 11986, 11120, 7.22, 11830, 5500, 'Ignacio freytes', 'Boner. Molinos. Salta', '30/60', '0328432919', '25-26', 610, 'AMCU', NULL, '2026-10-23 12:00:25-03')
ON CONFLICT (id) DO UPDATE SET
  cliente_id        = EXCLUDED.cliente_id,
  campo_id          = EXCLUDED.campo_id,
  usuario_email     = EXCLUDED.usuario_email,
  fecha             = EXCLUDED.fecha,
  actividad         = EXCLUDED.actividad,
  cant_cab_y_cat    = EXCLUDED.cant_cab_y_cat,
  total_machos      = EXCLUDED.total_machos,
  total_hembras     = EXCLUDED.total_hembras,
  kg_netos_origen   = EXCLUDED.kg_netos_origen,
  kg_netos_destino  = EXCLUDED.kg_netos_destino,
  merma_porcentaje  = EXCLUDED.merma_porcentaje,
  kg_corregidos     = EXCLUDED.kg_corregidos,
  precio            = EXCLUDED.precio,
  consignado        = EXCLUDED.consignado,
  titular           = EXCLUDED.titular,
  plazo             = EXCLUDED.plazo,
  numero_dte        = EXCLUDED.numero_dte,
  numero_operacion  = EXCLUDED.numero_operacion,
  km_recorrido      = EXCLUDED.km_recorrido,
  flete              = EXCLUDED.flete,
  observaciones     = EXCLUDED.observaciones,
  created_at        = EXCLUDED.created_at;

-- La base de datos también protege el correlativo cuando dos dispositivos
-- sincronizan a la vez. Si el número propuesto ya existe, asigna el siguiente
-- dentro del mismo año. El lock evita que dos inserts simultáneos reciban el
-- mismo número.
CREATE OR REPLACE FUNCTION public.asignar_numero_operacion_compra()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_anio TEXT;
  v_solicitado INTEGER;
  v_maximo INTEGER;
BEGIN
  IF NEW.cliente_id <> 'ganaderas' THEN
    RETURN NEW;
  END IF;

  v_anio := to_char(NEW.fecha, 'YY');
  PERFORM pg_advisory_xact_lock(hashtext('compras:' || NEW.cliente_id || ':' || v_anio));

  IF COALESCE(NEW.numero_operacion, '') ~ '^[0-9]+[-_][0-9]{2}$'
     AND right(NEW.numero_operacion, 2) = v_anio THEN
    v_solicitado := split_part(replace(NEW.numero_operacion, '_', '-'), '-', 1)::INTEGER;
  ELSE
    v_solicitado := NULL;
  END IF;

  IF v_solicitado IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.compras c
       WHERE c.cliente_id = NEW.cliente_id
         AND c.numero_operacion = v_solicitado::TEXT || '-' || v_anio
         AND c.id <> NEW.id
     ) THEN
    NEW.numero_operacion := v_solicitado::TEXT || '-' || v_anio;
    RETURN NEW;
  END IF;

  SELECT COALESCE(MAX(
    CASE
      WHEN c.numero_operacion ~ '^[0-9]+[-_][0-9]{2}$'
       AND right(c.numero_operacion, 2) = v_anio
      THEN split_part(replace(c.numero_operacion, '_', '-'), '-', 1)::INTEGER
      ELSE 0
    END
  ), 0)
  INTO v_maximo
  FROM public.compras c
  WHERE c.cliente_id = NEW.cliente_id;

  NEW.numero_operacion := (v_maximo + 1)::TEXT || '-' || v_anio;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS compras_numero_operacion_automatico ON public.compras;
CREATE TRIGGER compras_numero_operacion_automatico
BEFORE INSERT ON public.compras
FOR EACH ROW
EXECUTE FUNCTION public.asignar_numero_operacion_compra();

CREATE UNIQUE INDEX IF NOT EXISTS compras_ganaderas_numero_operacion_unico_idx
  ON public.compras (cliente_id, numero_operacion)
  WHERE cliente_id = 'ganaderas' AND numero_operacion IS NOT NULL;

COMMIT;

-- Verificación esperada: 26 operaciones numeradas consecutivamente, 1-26.
SELECT
  COUNT(DISTINCT numero_operacion) AS operaciones,
  MIN(fecha) AS primera_fecha,
  MAX(fecha) AS ultima_fecha,
  SUM(kg_netos_origen) FILTER (WHERE numero_operacion <> '26-26') AS kg_origen_excel,
  SUM(kg_netos_destino) FILTER (WHERE numero_operacion <> '26-26') AS kg_destino_excel
FROM public.compras
WHERE cliente_id = 'ganaderas'
  AND numero_operacion ~ '^[0-9]+-26$';

SELECT
  numero_operacion,
  fecha,
  cant_cab_y_cat,
  actividad,
  plazo,
  flete
FROM public.compras
WHERE cliente_id = 'ganaderas'
  AND numero_operacion ~ '^[0-9]+-[0-9]{2}$'
ORDER BY
  split_part(numero_operacion, '-', 2)::INTEGER DESC,
  split_part(numero_operacion, '-', 1)::INTEGER DESC;
