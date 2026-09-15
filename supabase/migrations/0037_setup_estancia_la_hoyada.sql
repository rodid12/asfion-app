-- =============================================================================
-- 0037 — Setup inicial Estancia La Hoyada / El Renuevo
-- =============================================================================
-- Fuentes recibidas el 14/09/2026:
--   Datos APP Agustin Suarez.docx
--   Copia de PlanlotesIQG.xlsx
--   4 planillas de tacto 2026
--   60 archivos KMZ y 2 imágenes de referencia
--
-- Modelo territorial adoptado según la hoja `base` de PlanlotesIQG:
--   LHO = La Hoyada (incluye Ranchos/corrales), EMI = El Milagro, BB = Borbollón.
--
-- El script es idempotente. No crea usuarios en auth.users: Google OAuth los
-- crea en su primer ingreso; la tabla usuarios funciona como lista autorizada.
-- =============================================================================

BEGIN;

-- Las fuentes contienen 28,4 ha y corrales de 0,125 ha. NUMBER en app/web ya
-- admite decimales; ampliamos únicamente la precisión de la DB.
ALTER TABLE circuitos
  ALTER COLUMN hectareas TYPE NUMERIC(10,3) USING hectareas::NUMERIC(10,3);
ALTER TABLE parcelas
  ALTER COLUMN hectareas TYPE NUMERIC(10,3) USING hectareas::NUMERIC(10,3);

INSERT INTO clientes (
  id, nombre, tagline, logo_url, accent_color, modulos_habilitados, catalogos,
  subscription_status, period_end_date, billing_notes
) VALUES (
  'el-renuevo', 'Estancia La Hoyada', 'Inversiones El Quebracho Grande S.A.',
  NULL, NULL,
  ARRAY['pariciones','lluvias','mortandad','pastoreo','compras','ventas']::TEXT[],
  '{"pariciones":{"vacasGrupos":["Vacas cabeza","Vacas cuerpo","Vacas cola"],"eventos":["Nacimiento","Muerte","Retacto","Aborto"],"sexos":["Macho","Hembra","Orejano"],"asistencia":["Si","No"],"caravanaColores":["Celeste","Blanca","Amarillo","Naranja"],"causaTipos":["Muerte Señalado","Nacido Muerto"],"causasFrecuentes":["Insolación","Diarrea","Calor","Picadura de víbora","Empantanado"]},"mortandad":{"categorias":["Toros","Toros 2 años","Toritos 1 año","Toros descarte","Vaquillonas 1 año","Vaquillonas descarte","Vaquillonas para invernada","Novillos para invernada","Novillos terminación","Vaquillonas 27 meses","Vacas 1° servicio","Vacas 2° servicio","Vacas descarte","Vacas","Crías macho","Crías hembra"],"actividades":["Cría","Destete Precoz","Invernada","Recría","Engorde"],"causaTipos":["Muerte Señalado","Nacido Muerto","Desconocido"]},"pastoreo":{"categorias":["Novillito Grande","Novillito Mediano","Novillito Chico","Vaquilla Grande","Vaquilla Mediana","Vaquilla Chica","Vaquilla Meses","Vaquilla Reposición"],"eventos":["Muerte","Rotación","Salida","Entrada"],"catAnimal":["Vaca preñada","Toros","Terneros H","Terneros M","Vaquillas 1° servicio","Vaquillas 2° servicio","Novillo","Novillito","Vaca venta","Toro venta","Vaquillas 1","Vaquillas 2","Vaquillas descarte","Vaquillas reposición"]},"compras":{"actividades":["Destete Precoz","Engorde","Invernada","Recepción"],"plazos":["Contado","30 días","60 días","90 días"]}}'::JSONB,
  'active', NULL,
  'Alta inicial. Definir vencimiento al confirmar el inicio de facturación.'
)
ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  tagline = EXCLUDED.tagline,
  modulos_habilitados = EXCLUDED.modulos_habilitados,
  catalogos = EXCLUDED.catalogos,
  subscription_status = EXCLUDED.subscription_status,
  billing_notes = EXCLUDED.billing_notes,
  updated_at = NOW();

INSERT INTO campos (id, cliente_id, nombre, organizacion_id, stock_inicial_vacas) VALUES
  ('campo-el-renuevo-la-hoyada', 'el-renuevo', 'La Hoyada', 'org-el-renuevo', NULL),
  ('campo-el-renuevo-el-milagro', 'el-renuevo', 'El Milagro', 'org-el-renuevo', NULL),
  ('campo-el-renuevo-borbollon', 'el-renuevo', 'Borbollón', 'org-el-renuevo', NULL)
ON CONFLICT (id) DO UPDATE SET
  cliente_id = EXCLUDED.cliente_id,
  nombre = EXCLUDED.nombre,
  organizacion_id = EXCLUDED.organizacion_id;

-- Evita reasignar silenciosamente a un usuario que ya pertenezca a otro tenant.
DO $$
DECLARE v_conflictos TEXT;
BEGIN
  SELECT string_agg(email || ' -> ' || cliente_id, ', ' ORDER BY email)
    INTO v_conflictos
  FROM usuarios
  WHERE lower(email) IN ('facundovidalbecker@gmail.com', 'edurosario555@gmail.com', 'reyesvictor123.orlando@gmail.com', 'mp7260297@gmail.com', 'elviovalderrama542@gmail.com')
    AND cliente_id <> 'el-renuevo';
  IF v_conflictos IS NOT NULL THEN
    RAISE EXCEPTION 'Usuarios ya asociados a otro cliente: %', v_conflictos;
  END IF;
END $$;

INSERT INTO usuarios (email, cliente_id, nombre, apellido, rol, campo_asignado_id) VALUES
  ('facundovidalbecker@gmail.com', 'el-renuevo', 'Facundo', 'Vidal', 'administrador', NULL),
  ('edurosario555@gmail.com', 'el-renuevo', 'Eduardo', 'Lozada', 'administrador', NULL),
  ('reyesvictor123.orlando@gmail.com', 'el-renuevo', 'Victor', 'Reyes', 'operario', 'campo-el-renuevo-el-milagro'),
  ('mp7260297@gmail.com', 'el-renuevo', 'Luciano', 'Peñaloza', 'operario', 'campo-el-renuevo-el-milagro'),
  ('elviovalderrama542@gmail.com', 'el-renuevo', 'Elvio', 'Valderrama', 'operario', 'campo-el-renuevo-borbollon')
ON CONFLICT (email) DO UPDATE SET
  cliente_id = EXCLUDED.cliente_id,
  nombre = EXCLUDED.nombre,
  apellido = EXCLUDED.apellido,
  rol = EXCLUDED.rol,
  campo_asignado_id = EXCLUDED.campo_asignado_id;

INSERT INTO lotes (id, cliente_id, campo_id, nombre) VALUES
  ('lote-el-renuevo-borbollon-bb1a', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB1A'),
  ('lote-el-renuevo-borbollon-bb1b', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB1B'),
  ('lote-el-renuevo-borbollon-bb1c-agri', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB1C AGRI'),
  ('lote-el-renuevo-borbollon-bb1d', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB1D'),
  ('lote-el-renuevo-borbollon-bb2a', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB2A'),
  ('lote-el-renuevo-borbollon-bb2b', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB2B'),
  ('lote-el-renuevo-borbollon-bb2c', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB2C'),
  ('lote-el-renuevo-borbollon-bb3a', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB3A'),
  ('lote-el-renuevo-borbollon-bb3b', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB3B'),
  ('lote-el-renuevo-borbollon-bb4', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB4'),
  ('lote-el-renuevo-borbollon-bb5a', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB5A'),
  ('lote-el-renuevo-borbollon-bb5b', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB5B'),
  ('lote-el-renuevo-borbollon-bb6-agri', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB6 AGRI'),
  ('lote-el-renuevo-borbollon-bb6a', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB6A'),
  ('lote-el-renuevo-borbollon-bb6b', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB6B'),
  ('lote-el-renuevo-borbollon-bb6c', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB6C'),
  ('lote-el-renuevo-borbollon-bb6d', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB6D'),
  ('lote-el-renuevo-borbollon-las-penas', 'el-renuevo', 'campo-el-renuevo-borbollon', 'Las Peñas'),
  ('lote-el-renuevo-el-milagro-m1', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M1'),
  ('lote-el-renuevo-el-milagro-m2', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M2'),
  ('lote-el-renuevo-el-milagro-m3', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M3'),
  ('lote-el-renuevo-el-milagro-m4', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M4'),
  ('lote-el-renuevo-el-milagro-m5', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M5'),
  ('lote-el-renuevo-el-milagro-m6', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M6'),
  ('lote-el-renuevo-el-milagro-m7a', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M7A'),
  ('lote-el-renuevo-el-milagro-m7b', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M7B'),
  ('lote-el-renuevo-el-milagro-m8a', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M8A'),
  ('lote-el-renuevo-el-milagro-m8b', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M8B'),
  ('lote-el-renuevo-el-milagro-m9a', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M9A'),
  ('lote-el-renuevo-el-milagro-m9b', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M9B'),
  ('lote-el-renuevo-el-milagro-m10a', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M10A'),
  ('lote-el-renuevo-el-milagro-m10b', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M10B'),
  ('lote-el-renuevo-el-milagro-m11', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M11'),
  ('lote-el-renuevo-el-milagro-m12-agri', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M12 AGRI'),
  ('lote-el-renuevo-el-milagro-m12-gan', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M12 GAN'),
  ('lote-el-renuevo-el-milagro-m13a', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M13A'),
  ('lote-el-renuevo-el-milagro-m13b', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M13B'),
  ('lote-el-renuevo-el-milagro-m13c', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M13C'),
  ('lote-el-renuevo-el-milagro-m13d', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M13D'),
  ('lote-el-renuevo-el-milagro-m13e', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M13E'),
  ('lote-el-renuevo-el-milagro-m13f', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M13F'),
  ('lote-el-renuevo-el-milagro-m14a', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M14A'),
  ('lote-el-renuevo-el-milagro-m14b', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M14B'),
  ('lote-el-renuevo-el-milagro-m14c', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M14C'),
  ('lote-el-renuevo-el-milagro-m14d', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M14D'),
  ('lote-el-renuevo-el-milagro-m15', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M15'),
  ('lote-el-renuevo-el-milagro-m16', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M16'),
  ('lote-el-renuevo-el-milagro-m17a', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M17A'),
  ('lote-el-renuevo-el-milagro-m17b', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M17B'),
  ('lote-el-renuevo-el-milagro-m17c', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M17C'),
  ('lote-el-renuevo-el-milagro-m18a', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M18A'),
  ('lote-el-renuevo-el-milagro-m18b', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M18B'),
  ('lote-el-renuevo-el-milagro-m18c', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M18C'),
  ('lote-el-renuevo-el-milagro-m18d', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M18D'),
  ('lote-el-renuevo-el-milagro-chanarcito', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'Chañarcito'),
  ('lote-el-renuevo-el-milagro-aguadita-la-tuna', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'Aguadita La Tuna'),
  ('lote-el-renuevo-la-hoyada-corral-1', 'el-renuevo', 'campo-el-renuevo-la-hoyada', 'Corral 1'),
  ('lote-el-renuevo-la-hoyada-corral-2', 'el-renuevo', 'campo-el-renuevo-la-hoyada', 'Corral 2'),
  ('lote-el-renuevo-la-hoyada-corral-3', 'el-renuevo', 'campo-el-renuevo-la-hoyada', 'Corral 3'),
  ('lote-el-renuevo-la-hoyada-corral-4', 'el-renuevo', 'campo-el-renuevo-la-hoyada', 'Corral 4'),
  ('lote-el-renuevo-la-hoyada-corral-5', 'el-renuevo', 'campo-el-renuevo-la-hoyada', 'Corral 5'),
  ('lote-el-renuevo-la-hoyada-corral-6', 'el-renuevo', 'campo-el-renuevo-la-hoyada', 'Corral 6'),
  ('lote-el-renuevo-la-hoyada-corral-7', 'el-renuevo', 'campo-el-renuevo-la-hoyada', 'Corral 7'),
  ('lote-el-renuevo-la-hoyada-corral-8', 'el-renuevo', 'campo-el-renuevo-la-hoyada', 'Corral 8'),
  ('lote-el-renuevo-la-hoyada-corral-9', 'el-renuevo', 'campo-el-renuevo-la-hoyada', 'Corral 9'),
  ('lote-el-renuevo-la-hoyada-corral-10', 'el-renuevo', 'campo-el-renuevo-la-hoyada', 'Corral 10'),
  ('lote-el-renuevo-la-hoyada-corral-11', 'el-renuevo', 'campo-el-renuevo-la-hoyada', 'Corral 11'),
  ('lote-el-renuevo-la-hoyada-corral-12', 'el-renuevo', 'campo-el-renuevo-la-hoyada', 'Corral 12'),
  ('lote-el-renuevo-la-hoyada-corral-13', 'el-renuevo', 'campo-el-renuevo-la-hoyada', 'Corral 13'),
  ('lote-el-renuevo-la-hoyada-corral-14', 'el-renuevo', 'campo-el-renuevo-la-hoyada', 'Corral 14')
ON CONFLICT (id) DO UPDATE SET
  cliente_id = EXCLUDED.cliente_id,
  campo_id = EXCLUDED.campo_id,
  nombre = EXCLUDED.nombre;

-- Como no se informaron circuitos formales, cada lote físico funciona de forma
-- provisoria como circuito con una parcela; Ranchos usa un circuito y 14 parcelas.
INSERT INTO circuitos (id, cliente_id, campo_id, nombre, hectareas) VALUES
  ('circ-el-renuevo-borbollon-bb1a', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB1A', 12),
  ('circ-el-renuevo-borbollon-bb1b', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB1B', 45),
  ('circ-el-renuevo-borbollon-bb1c-agri', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB1C AGRI', 55),
  ('circ-el-renuevo-borbollon-bb1d', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB1D', 81),
  ('circ-el-renuevo-borbollon-bb2a', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB2A', 81),
  ('circ-el-renuevo-borbollon-bb2b', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB2B', 88),
  ('circ-el-renuevo-borbollon-bb2c', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB2C', 66),
  ('circ-el-renuevo-borbollon-bb3a', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB3A', 72),
  ('circ-el-renuevo-borbollon-bb3b', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB3B', 80),
  ('circ-el-renuevo-borbollon-bb4', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB4', 85),
  ('circ-el-renuevo-borbollon-bb5a', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB5A', 80),
  ('circ-el-renuevo-borbollon-bb5b', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB5B', 71),
  ('circ-el-renuevo-borbollon-bb6-agri', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB6 AGRI', 43),
  ('circ-el-renuevo-borbollon-bb6a', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB6A', 97),
  ('circ-el-renuevo-borbollon-bb6b', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB6B', 65),
  ('circ-el-renuevo-borbollon-bb6c', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB6C', 41),
  ('circ-el-renuevo-borbollon-bb6d', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB6D', 46),
  ('circ-el-renuevo-borbollon-las-penas', 'el-renuevo', 'campo-el-renuevo-borbollon', 'Las Peñas', 400),
  ('circ-el-renuevo-el-milagro-m1', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M1', 6),
  ('circ-el-renuevo-el-milagro-m2', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M2', 41),
  ('circ-el-renuevo-el-milagro-m3', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M3', 17),
  ('circ-el-renuevo-el-milagro-m4', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M4', 41),
  ('circ-el-renuevo-el-milagro-m5', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M5', 26),
  ('circ-el-renuevo-el-milagro-m6', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M6', 55),
  ('circ-el-renuevo-el-milagro-m7a', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M7A', 47),
  ('circ-el-renuevo-el-milagro-m7b', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M7B', 100),
  ('circ-el-renuevo-el-milagro-m8a', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M8A', 54),
  ('circ-el-renuevo-el-milagro-m8b', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M8B', 50),
  ('circ-el-renuevo-el-milagro-m9a', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M9A', 35),
  ('circ-el-renuevo-el-milagro-m9b', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M9B', 45),
  ('circ-el-renuevo-el-milagro-m10a', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M10A', 88),
  ('circ-el-renuevo-el-milagro-m10b', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M10B', 60),
  ('circ-el-renuevo-el-milagro-m11', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M11', 61),
  ('circ-el-renuevo-el-milagro-m12-agri', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M12 AGRI', 76),
  ('circ-el-renuevo-el-milagro-m12-gan', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M12 GAN', 28.4),
  ('circ-el-renuevo-el-milagro-m13a', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M13A', 52),
  ('circ-el-renuevo-el-milagro-m13b', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M13B', 46),
  ('circ-el-renuevo-el-milagro-m13c', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M13C', 53),
  ('circ-el-renuevo-el-milagro-m13d', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M13D', 44),
  ('circ-el-renuevo-el-milagro-m13e', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M13E', 54),
  ('circ-el-renuevo-el-milagro-m13f', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M13F', 22),
  ('circ-el-renuevo-el-milagro-m14a', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M14A', 45),
  ('circ-el-renuevo-el-milagro-m14b', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M14B', 38),
  ('circ-el-renuevo-el-milagro-m14c', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M14C', 51),
  ('circ-el-renuevo-el-milagro-m14d', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M14D', 47),
  ('circ-el-renuevo-el-milagro-m15', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M15', 52),
  ('circ-el-renuevo-el-milagro-m16', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M16', 51),
  ('circ-el-renuevo-el-milagro-m17a', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M17A', 62),
  ('circ-el-renuevo-el-milagro-m17b', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M17B', 60),
  ('circ-el-renuevo-el-milagro-m17c', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M17C', 55),
  ('circ-el-renuevo-el-milagro-m18a', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M18A', 58),
  ('circ-el-renuevo-el-milagro-m18b', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M18B', 78),
  ('circ-el-renuevo-el-milagro-m18c', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M18C', 56),
  ('circ-el-renuevo-el-milagro-m18d', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'M18D', 63),
  ('circ-el-renuevo-el-milagro-chanarcito', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'Chañarcito', 100),
  ('circ-el-renuevo-el-milagro-aguadita-la-tuna', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'Aguadita La Tuna', 70),
  ('circ-el-renuevo-la-hoyada-corrales-ranchos', 'el-renuevo', 'campo-el-renuevo-la-hoyada', 'Corrales Ranchos', 1.75)
ON CONFLICT (id) DO UPDATE SET
  cliente_id = EXCLUDED.cliente_id,
  campo_id = EXCLUDED.campo_id,
  nombre = EXCLUDED.nombre,
  hectareas = EXCLUDED.hectareas;

INSERT INTO parcelas (id, cliente_id, circuito_id, numero, hectareas) VALUES
  ('parc-el-renuevo-borbollon-bb1a-p1', 'el-renuevo', 'circ-el-renuevo-borbollon-bb1a', 1, 12),
  ('parc-el-renuevo-borbollon-bb1b-p1', 'el-renuevo', 'circ-el-renuevo-borbollon-bb1b', 1, 45),
  ('parc-el-renuevo-borbollon-bb1c-agri-p1', 'el-renuevo', 'circ-el-renuevo-borbollon-bb1c-agri', 1, 55),
  ('parc-el-renuevo-borbollon-bb1d-p1', 'el-renuevo', 'circ-el-renuevo-borbollon-bb1d', 1, 81),
  ('parc-el-renuevo-borbollon-bb2a-p1', 'el-renuevo', 'circ-el-renuevo-borbollon-bb2a', 1, 81),
  ('parc-el-renuevo-borbollon-bb2b-p1', 'el-renuevo', 'circ-el-renuevo-borbollon-bb2b', 1, 88),
  ('parc-el-renuevo-borbollon-bb2c-p1', 'el-renuevo', 'circ-el-renuevo-borbollon-bb2c', 1, 66),
  ('parc-el-renuevo-borbollon-bb3a-p1', 'el-renuevo', 'circ-el-renuevo-borbollon-bb3a', 1, 72),
  ('parc-el-renuevo-borbollon-bb3b-p1', 'el-renuevo', 'circ-el-renuevo-borbollon-bb3b', 1, 80),
  ('parc-el-renuevo-borbollon-bb4-p1', 'el-renuevo', 'circ-el-renuevo-borbollon-bb4', 1, 85),
  ('parc-el-renuevo-borbollon-bb5a-p1', 'el-renuevo', 'circ-el-renuevo-borbollon-bb5a', 1, 80),
  ('parc-el-renuevo-borbollon-bb5b-p1', 'el-renuevo', 'circ-el-renuevo-borbollon-bb5b', 1, 71),
  ('parc-el-renuevo-borbollon-bb6-agri-p1', 'el-renuevo', 'circ-el-renuevo-borbollon-bb6-agri', 1, 43),
  ('parc-el-renuevo-borbollon-bb6a-p1', 'el-renuevo', 'circ-el-renuevo-borbollon-bb6a', 1, 97),
  ('parc-el-renuevo-borbollon-bb6b-p1', 'el-renuevo', 'circ-el-renuevo-borbollon-bb6b', 1, 65),
  ('parc-el-renuevo-borbollon-bb6c-p1', 'el-renuevo', 'circ-el-renuevo-borbollon-bb6c', 1, 41),
  ('parc-el-renuevo-borbollon-bb6d-p1', 'el-renuevo', 'circ-el-renuevo-borbollon-bb6d', 1, 46),
  ('parc-el-renuevo-borbollon-las-penas-p1', 'el-renuevo', 'circ-el-renuevo-borbollon-las-penas', 1, 400),
  ('parc-el-renuevo-el-milagro-m1-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m1', 1, 6),
  ('parc-el-renuevo-el-milagro-m2-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m2', 1, 41),
  ('parc-el-renuevo-el-milagro-m3-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m3', 1, 17),
  ('parc-el-renuevo-el-milagro-m4-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m4', 1, 41),
  ('parc-el-renuevo-el-milagro-m5-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m5', 1, 26),
  ('parc-el-renuevo-el-milagro-m6-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m6', 1, 55),
  ('parc-el-renuevo-el-milagro-m7a-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m7a', 1, 47),
  ('parc-el-renuevo-el-milagro-m7b-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m7b', 1, 100),
  ('parc-el-renuevo-el-milagro-m8a-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m8a', 1, 54),
  ('parc-el-renuevo-el-milagro-m8b-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m8b', 1, 50),
  ('parc-el-renuevo-el-milagro-m9a-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m9a', 1, 35),
  ('parc-el-renuevo-el-milagro-m9b-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m9b', 1, 45),
  ('parc-el-renuevo-el-milagro-m10a-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m10a', 1, 88),
  ('parc-el-renuevo-el-milagro-m10b-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m10b', 1, 60),
  ('parc-el-renuevo-el-milagro-m11-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m11', 1, 61),
  ('parc-el-renuevo-el-milagro-m12-agri-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m12-agri', 1, 76),
  ('parc-el-renuevo-el-milagro-m12-gan-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m12-gan', 1, 28.4),
  ('parc-el-renuevo-el-milagro-m13a-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m13a', 1, 52),
  ('parc-el-renuevo-el-milagro-m13b-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m13b', 1, 46),
  ('parc-el-renuevo-el-milagro-m13c-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m13c', 1, 53),
  ('parc-el-renuevo-el-milagro-m13d-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m13d', 1, 44),
  ('parc-el-renuevo-el-milagro-m13e-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m13e', 1, 54),
  ('parc-el-renuevo-el-milagro-m13f-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m13f', 1, 22),
  ('parc-el-renuevo-el-milagro-m14a-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m14a', 1, 45),
  ('parc-el-renuevo-el-milagro-m14b-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m14b', 1, 38),
  ('parc-el-renuevo-el-milagro-m14c-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m14c', 1, 51),
  ('parc-el-renuevo-el-milagro-m14d-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m14d', 1, 47),
  ('parc-el-renuevo-el-milagro-m15-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m15', 1, 52),
  ('parc-el-renuevo-el-milagro-m16-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m16', 1, 51),
  ('parc-el-renuevo-el-milagro-m17a-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m17a', 1, 62),
  ('parc-el-renuevo-el-milagro-m17b-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m17b', 1, 60),
  ('parc-el-renuevo-el-milagro-m17c-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m17c', 1, 55),
  ('parc-el-renuevo-el-milagro-m18a-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m18a', 1, 58),
  ('parc-el-renuevo-el-milagro-m18b-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m18b', 1, 78),
  ('parc-el-renuevo-el-milagro-m18c-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m18c', 1, 56),
  ('parc-el-renuevo-el-milagro-m18d-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-m18d', 1, 63),
  ('parc-el-renuevo-el-milagro-chanarcito-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-chanarcito', 1, 100),
  ('parc-el-renuevo-el-milagro-aguadita-la-tuna-p1', 'el-renuevo', 'circ-el-renuevo-el-milagro-aguadita-la-tuna', 1, 70),
  ('parc-el-renuevo-la-hoyada-corral-1', 'el-renuevo', 'circ-el-renuevo-la-hoyada-corrales-ranchos', 1, 0.12),
  ('parc-el-renuevo-la-hoyada-corral-2', 'el-renuevo', 'circ-el-renuevo-la-hoyada-corrales-ranchos', 2, 0.12),
  ('parc-el-renuevo-la-hoyada-corral-3', 'el-renuevo', 'circ-el-renuevo-la-hoyada-corrales-ranchos', 3, 0.12),
  ('parc-el-renuevo-la-hoyada-corral-4', 'el-renuevo', 'circ-el-renuevo-la-hoyada-corrales-ranchos', 4, 0.12),
  ('parc-el-renuevo-la-hoyada-corral-5', 'el-renuevo', 'circ-el-renuevo-la-hoyada-corrales-ranchos', 5, 0.12),
  ('parc-el-renuevo-la-hoyada-corral-6', 'el-renuevo', 'circ-el-renuevo-la-hoyada-corrales-ranchos', 6, 0.12),
  ('parc-el-renuevo-la-hoyada-corral-7', 'el-renuevo', 'circ-el-renuevo-la-hoyada-corrales-ranchos', 7, 0.12),
  ('parc-el-renuevo-la-hoyada-corral-8', 'el-renuevo', 'circ-el-renuevo-la-hoyada-corrales-ranchos', 8, 0.12),
  ('parc-el-renuevo-la-hoyada-corral-9', 'el-renuevo', 'circ-el-renuevo-la-hoyada-corrales-ranchos', 9, 0.12),
  ('parc-el-renuevo-la-hoyada-corral-10', 'el-renuevo', 'circ-el-renuevo-la-hoyada-corrales-ranchos', 10, 0.12),
  ('parc-el-renuevo-la-hoyada-corral-11', 'el-renuevo', 'circ-el-renuevo-la-hoyada-corrales-ranchos', 11, 0.12),
  ('parc-el-renuevo-la-hoyada-corral-12', 'el-renuevo', 'circ-el-renuevo-la-hoyada-corrales-ranchos', 12, 0.12),
  ('parc-el-renuevo-la-hoyada-corral-13', 'el-renuevo', 'circ-el-renuevo-la-hoyada-corrales-ranchos', 13, 0.12),
  ('parc-el-renuevo-la-hoyada-corral-14', 'el-renuevo', 'circ-el-renuevo-la-hoyada-corrales-ranchos', 14, 0.12)
ON CONFLICT (id) DO UPDATE SET
  cliente_id = EXCLUDED.cliente_id,
  circuito_id = EXCLUDED.circuito_id,
  numero = EXCLUDED.numero,
  hectareas = EXCLUDED.hectareas;

INSERT INTO pluviometros (id, cliente_id, campo_id, nombre) VALUES
  ('pluv-el-renuevo-casa-bb', 'el-renuevo', 'campo-el-renuevo-borbollon', 'Casa BB'),
  ('pluv-el-renuevo-corral-bb', 'el-renuevo', 'campo-el-renuevo-borbollon', 'Corral BB'),
  ('pluv-el-renuevo-bb-5', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB 5'),
  ('pluv-el-renuevo-bb6', 'el-renuevo', 'campo-el-renuevo-borbollon', 'BB6'),
  ('pluv-el-renuevo-aguadita', 'el-renuevo', 'campo-el-renuevo-la-hoyada', 'Aguadita'),
  ('pluv-el-renuevo-tajamar', 'el-renuevo', 'campo-el-renuevo-la-hoyada', 'Tajamar'),
  ('pluv-el-renuevo-adm', 'el-renuevo', 'campo-el-renuevo-la-hoyada', 'ADM'),
  ('pluv-el-renuevo-p-gde', 'el-renuevo', 'campo-el-renuevo-la-hoyada', 'P Gde'),
  ('pluv-el-renuevo-rancho', 'el-renuevo', 'campo-el-renuevo-la-hoyada', 'Rancho'),
  ('pluv-el-renuevo-mil-manga-1', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'Mil Manga 1'),
  ('pluv-el-renuevo-mil-manga-2', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'Mil Manga 2'),
  ('pluv-el-renuevo-mil-galpon', 'el-renuevo', 'campo-el-renuevo-el-milagro', 'MIL Galpón')
ON CONFLICT (id) DO UPDATE SET
  cliente_id = EXCLUDED.cliente_id,
  campo_id = EXCLUDED.campo_id,
  nombre = EXCLUDED.nombre;

-- Campañas operativas: historia preservada y 2026/27 activa por defecto.
UPDATE campanias_operativas
SET activa = FALSE, updated_at = NOW()
WHERE cliente_id = 'el-renuevo'
  AND id <> 'campania-operativa-el-renuevo-2026-2027'
  AND activa = TRUE;

INSERT INTO campanias_operativas
  (id, cliente_id, nombre, fecha_inicio, fecha_fin, activa, observaciones)
VALUES
  ('campania-operativa-el-renuevo-2024-2025', 'el-renuevo', 'Campaña 2024/25', DATE '2024-09-01', DATE '2025-08-31', FALSE, 'Histórica; contiene lluvias importadas.'),
  ('campania-operativa-el-renuevo-2025-2026', 'el-renuevo', 'Campaña 2025/26', DATE '2025-09-01', DATE '2026-08-31', FALSE, 'Histórica; contiene lluvias y tactos base.'),
  ('campania-operativa-el-renuevo-2026-2027', 'el-renuevo', 'Campaña 2026/27', DATE '2026-09-01', DATE '2027-08-31', TRUE, 'Campaña operativa vigente.')
ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  fecha_inicio = EXCLUDED.fecha_inicio,
  fecha_fin = EXCLUDED.fecha_fin,
  activa = EXCLUDED.activa,
  observaciones = EXCLUDED.observaciones,
  updated_at = NOW();

UPDATE campanias_reproductivas
SET activa = FALSE, updated_at = NOW()
WHERE cliente_id = 'el-renuevo'
  AND id <> 'campania-reproductiva-el-renuevo-2026-2027'
  AND activa = TRUE;

INSERT INTO campanias_reproductivas
  (id, cliente_id, nombre, servicio_anio, fecha_inicio, fecha_fin, activa, observaciones)
VALUES (
  'campania-reproductiva-el-renuevo-2026-2027', 'el-renuevo', 'Pariciones 2026/27',
  2026, DATE '2026-09-01', DATE '2027-03-31', TRUE,
  'Preñez 2026 es el punto inicial inmutable para Pariciones 2026/27.'
)
ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  servicio_anio = EXCLUDED.servicio_anio,
  fecha_inicio = EXCLUDED.fecha_inicio,
  fecha_fin = EXCLUDED.fecha_fin,
  activa = EXCLUDED.activa,
  observaciones = EXCLUDED.observaciones,
  updated_at = NOW();

INSERT INTO tactos (
  id, cliente_id, rodeo, campo, fecha, origen_total,
  prenez_cabeza, prenez_cuerpo, prenez_cola, vacias, perdon, descarte, feed_lot,
  campo_id, campania_id, observaciones, usuario_email
) VALUES
  ('tacto-el-renuevo-borbollon-rodeo-general-2026', 'el-renuevo', 'Rodeo general', 'Borbollón', '2026-05-29', 692, 391, 156, 63, 82, 0, 0, 0, 'campo-el-renuevo-borbollon', 'campania-reproductiva-el-renuevo-2026-2027', 'Importado desde planilla de tacto 2026; Grande=Cabeza, Medio=Cuerpo, Chica=Cola.', 'importacion.historica@asfion.app'),
  ('tacto-el-renuevo-milagro-rodeo-general-2026', 'el-renuevo', 'Rodeo general', 'El Milagro', '2026-06-04', 441, 189, 145, 36, 71, 0, 0, 0, 'campo-el-renuevo-el-milagro', 'campania-reproductiva-el-renuevo-2026-2027', 'Importado desde planilla de tacto 2026; Grande=Cabeza, Medio=Cuerpo, Chica=Cola.', 'importacion.historica@asfion.app'),
  ('tacto-el-renuevo-milagro-segundo-servicio-2026', 'el-renuevo', 'Segundo servicio', 'El Milagro', '2026-06-04', 331, 110, 64, 19, 138, 0, 0, 0, 'campo-el-renuevo-el-milagro', 'campania-reproductiva-el-renuevo-2026-2027', 'Importado desde planilla de tacto 2026; Grande=Cabeza, Medio=Cuerpo, Chica=Cola.', 'importacion.historica@asfion.app'),
  ('tacto-el-renuevo-milagro-vaquillas-primer-servicio-2026', 'el-renuevo', 'Vaquillas primer servicio', 'El Milagro', '2026-06-04', 156, 83, 43, 7, 23, 0, 0, 0, 'campo-el-renuevo-el-milagro', 'campania-reproductiva-el-renuevo-2026-2027', 'Importado desde planilla de tacto 2026; Grande=Cabeza, Medio=Cuerpo, Chica=Cola.', 'importacion.historica@asfion.app')
ON CONFLICT (id) DO UPDATE SET
  cliente_id = EXCLUDED.cliente_id,
  rodeo = EXCLUDED.rodeo,
  campo = EXCLUDED.campo,
  fecha = EXCLUDED.fecha,
  origen_total = EXCLUDED.origen_total,
  prenez_cabeza = EXCLUDED.prenez_cabeza,
  prenez_cuerpo = EXCLUDED.prenez_cuerpo,
  prenez_cola = EXCLUDED.prenez_cola,
  vacias = EXCLUDED.vacias,
  perdon = EXCLUDED.perdon,
  descarte = EXCLUDED.descarte,
  feed_lot = EXCLUDED.feed_lot,
  campo_id = EXCLUDED.campo_id,
  campania_id = EXCLUDED.campania_id,
  observaciones = EXCLUDED.observaciones,
  usuario_email = EXCLUDED.usuario_email,
  updated_at = NOW();

SELECT _refrescar_stock_prenez_activa('el-renuevo');

COMMIT;

-- =============================================================================
-- VERIFICACIÓN
-- Esperado: 1 cliente, 3 campos, 70 lotes, 57 circuitos, 70 parcelas,
-- 12 pluviómetros, 5 usuarios autorizados, 4 tactos, 1 campaña activa.
-- Stock preñado inicial: El Milagro 696; Borbollón 610; La Hoyada 0.
-- =============================================================================
SELECT 'clientes' AS entidad, COUNT(*) AS filas FROM clientes WHERE id = 'el-renuevo'
UNION ALL SELECT 'campos', COUNT(*) FROM campos WHERE cliente_id = 'el-renuevo'
UNION ALL SELECT 'lotes', COUNT(*) FROM lotes WHERE cliente_id = 'el-renuevo'
UNION ALL SELECT 'circuitos', COUNT(*) FROM circuitos WHERE cliente_id = 'el-renuevo'
UNION ALL SELECT 'parcelas', COUNT(*) FROM parcelas WHERE cliente_id = 'el-renuevo'
UNION ALL SELECT 'pluviometros', COUNT(*) FROM pluviometros WHERE cliente_id = 'el-renuevo'
UNION ALL SELECT 'usuarios', COUNT(*) FROM usuarios WHERE cliente_id = 'el-renuevo'
UNION ALL SELECT 'tactos', COUNT(*) FROM tactos WHERE cliente_id = 'el-renuevo';

SELECT c.nombre AS campo, c.stock_inicial_vacas AS prenadas_iniciales
FROM campos c
WHERE c.cliente_id = 'el-renuevo'
ORDER BY c.nombre;

SELECT campo, rodeo, origen_total,
       prenez_cabeza + prenez_cuerpo + prenez_cola AS prenadas,
       vacias,
       ROUND(100.0 * (prenez_cabeza + prenez_cuerpo + prenez_cola) / NULLIF(origen_total, 0), 2) AS porcentaje_prenez
FROM tactos
WHERE cliente_id = 'el-renuevo'
ORDER BY campo, rodeo;

SELECT u.email, u.rol, c.nombre AS campo_asignado,
       (au.id IS NOT NULL) AS ya_ingreso_a_auth
FROM usuarios u
LEFT JOIN campos c ON c.id = u.campo_asignado_id
LEFT JOIN auth.users au ON lower(au.email) = lower(u.email)
WHERE u.cliente_id = 'el-renuevo'
ORDER BY u.rol, u.email;
