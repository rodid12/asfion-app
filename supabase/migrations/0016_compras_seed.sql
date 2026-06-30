-- ASFION — Carga de las compras reales del Excel del cliente Ganaderas.
--
-- Sheet "Compra" del GVA_F(7).xlsx — 7 operaciones cargadas por
-- robustianoasaravia@ entre 2/6/2026 y 9/6/2026.
--
-- Todas en el campo Corrales (= feedlot) con actividad Invernada.
--
-- Limpieza aplicada vs el Excel crudo:
--   - precio (NUMERIC): cuando viene "5200/5500" o similar (operación
--     con 2 precios distintos), conservamos el PRIMERO en la columna
--     numérica para que cuadre el cálculo de Inversión, y dejamos la
--     nota completa en observaciones (donde el operario ya la cargó).
--   - km_recorrido (NUMERIC): castean los strings tipo '131.4' a número.
--   - numero_dte: queda como TEXT (acepta múltiples DTEs separados por /).
--
-- ON CONFLICT por ID — idempotente si Agus actualiza el Excel.

INSERT INTO compras (id, cliente_id, campo_id, usuario_email, fecha, actividad, cant_cab_y_cat, kg_netos_origen, kg_netos_destino, merma_porcentaje, kg_corregidos, precio, consignado, titular, plazo, numero_dte, numero_operacion, km_recorrido, observaciones) VALUES
  ('2a9bb778', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-06-02', 'Invernada', '82 machos. 33 hembras', 22658.0, 21227.0, 6.32, NULL, 5300.0, 'Ganacor', 'Acevedo claudio', 'Contado', '0318975744', '10_26', 581.0, '1 ternera renga'),
  ('f8194997', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-06-04', 'Invernada', '85 machos. 37 hembras', 20715.0, 18780.0, 9.34, NULL, 5000.0, 'Abelardo usandivaras', 'Carneiro lobo braian. Rancho JR. Irigoyen. Misiones', 'Contado', '0319269442', '11_26', 1317.0, NULL),
  ('aea28ba2', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-06-05', 'Invernada', '84 machos. 34 hembras', 21627.0, 20520.0, 5.12, NULL, 5200.0, 'Pérez Alsina', 'Tomasella Carlos/Suárez Matías/gauna julio. Goya corrientes', 'Contado', '0319330879/31410/88370/30607', '12_26', 979.0, '1 macho rengo. Veremos como sigue'),
  ('3147ccd3', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-06-05', 'Invernada', '65 machos. 1 hembra', 13375.0, 13240.0, 1.01, NULL, 5200.0, 'Eduardo rueda', 'Cisneros Walter/ Elias Martin. Taco pozo. Chaco', 'Contado/30y60', '0319431985/0319234255', '13_26', 131.4, '5200 contado lo de cisneros Walter. 5500 a 30/60 días los de Elías martin'),
  ('8e6eb597', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-06-05', 'Invernada', '65 machos. 56 hembras', 21303.0, 19980.0, 6.21, NULL, 5000.0, 'Abelardo usandivaras', 'Carneiro lobo. Rancho JR . Irigoyen. Misiones', 'Contado', '0319397159/97000/57599', '14_26', 1291.0, '1 ternera muerta. Se descuentan kg prom al transporte'),
  ('97cf0c30', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-06-06', 'Invernada', '52 machos. 27 hembras', 13680.0, 14090.0, -3.0, NULL, 5250.0, 'Abelardo usandivaras', 'De Jesús victoria MB. Victoria. San Martin. Chaco', 'Contado', '0319483055', '15_26', 316.0, 'Se devolvieron 27 machos livianos'),
  ('9a95120f', 'ganaderas', 'campo-corrales', 'robustianoasaravia@gmail.com', '2026-06-09', 'Invernada', '99 machos', 21563.0, 21060.0, 2.33, NULL, 5100.0, 'Juan calderoni', 'Torres Jorge. Lamcruz. Corrientes', 'Contado', '0319561609', '16_26', 1070.0, 'Se bajaron en margaritas hasta que mejore el camino')
ON CONFLICT (id) DO UPDATE SET
  campo_id          = EXCLUDED.campo_id,
  actividad         = EXCLUDED.actividad,
  fecha             = EXCLUDED.fecha,
  cant_cab_y_cat    = EXCLUDED.cant_cab_y_cat,
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
  observaciones     = EXCLUDED.observaciones;

-- Verificación:
-- SELECT numero_operacion, fecha, cant_cab_y_cat, kg_netos_destino, precio, titular
-- FROM compras WHERE cliente_id = 'ganaderas' ORDER BY fecha DESC, numero_operacion DESC;
