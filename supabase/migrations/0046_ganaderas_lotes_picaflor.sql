-- Nuevos lotes solicitados para el campo Picaflor (Ganaderas).
-- Idempotente: puede ejecutarse más de una vez sin duplicar filas.

BEGIN;

INSERT INTO lotes (id, cliente_id, campo_id, nombre)
VALUES
  ('lote-picaflor-pic-b7',   'ganaderas', 'campo-picaflor', 'PIC B7'),
  ('lote-picaflor-pic-c18a', 'ganaderas', 'campo-picaflor', 'PIC C18A'),
  ('lote-picaflor-pic-c18b', 'ganaderas', 'campo-picaflor', 'PIC C18B'),
  ('lote-picaflor-pic-d17a', 'ganaderas', 'campo-picaflor', 'PIC D17A'),
  ('lote-picaflor-pic-d17b', 'ganaderas', 'campo-picaflor', 'PIC D17B')
ON CONFLICT (id) DO UPDATE SET
  cliente_id = EXCLUDED.cliente_id,
  campo_id   = EXCLUDED.campo_id,
  nombre     = EXCLUDED.nombre;

COMMIT;

SELECT id, nombre
FROM lotes
WHERE cliente_id = 'ganaderas'
  AND campo_id = 'campo-picaflor'
  AND nombre IN ('PIC B7', 'PIC C18A', 'PIC C18B', 'PIC D17A', 'PIC D17B')
ORDER BY nombre;
