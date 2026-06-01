-- ASFION — Schema inicial.
--
-- Estructura: 1 base de datos compartida entre todos los clientes (multi-tenant).
-- Cada cliente es un row en `clientes`. Cada usuario pertenece a un cliente.
-- Cada evento (parición, lluvia, mortandad, pastoreo) tiene `cliente_id` para
-- aislar tenants vía Row Level Security (RLS).
--
-- Convenciones:
--   - Todas las tablas tienen id TEXT (no uuid de Supabase) para coincidir con
--     los ids generados por la app móvil (uuidv4 en el device). Esto permite
--     offline-first: la app genera el id antes de hablar con el server.
--   - `created_at` siempre es TIMESTAMPTZ con default now().
--   - Todas las tablas tienen RLS HABILITADA con policies que filtran por
--     cliente_id del usuario actual (resuelto via JWT claim).
--   - Foreign keys ON DELETE CASCADE para tablas dependientes (campos → lotes → etc).
--
-- Para correr esto:
--   1. Crear un proyecto Supabase nuevo (free tier alcanza).
--   2. Ir a SQL Editor en el dashboard.
--   3. Pegar este archivo y ejecutar.
--   4. Después, correr 0002_seed_ganaderas.sql con los datos reales.
--
-- Para iterar el schema:
--   - Crear archivos nuevos como 0003_xxx.sql con ALTER TABLE / CREATE ...
--   - NO editar las migrations ya aplicadas — siempre incremental.

-- =============================================================================
-- TABLA: clientes
-- Multi-tenant: cada cliente es una row. Toda la app filtra por cliente_id.
-- =============================================================================
CREATE TABLE clientes (
  id TEXT PRIMARY KEY,                   -- 'ganaderas', 'tambo-la-trinidad'
  nombre TEXT NOT NULL,                  -- 'Ganaderas'
  tagline TEXT,                          -- 'Gestión integral del campo'
  logo_url TEXT,                         -- URL de Supabase Storage (o null = iniciales)
  accent_color TEXT,                     -- '#1F6FB8' (opcional)
  -- Módulos habilitados: array de strings. App filtra UI por esto.
  modulos_habilitados TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  -- Catálogos: árbol JSONB con los catálogos por módulo. Ver shape en
  -- src/config/types.ts → ClientCatalogos.
  catalogos JSONB NOT NULL DEFAULT '{}'::JSONB,
  -- Stock inicial de vacas preñadas (por campo, opcional).
  -- {"campo-agisot": 520, "campo-carolina": 438, ...}
  stock_inicial JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- TABLA: usuarios
-- Cada usuario pertenece a UN cliente. Linkea con auth.users de Supabase Auth
-- via el email (que matchea auth.email después del signup).
-- =============================================================================
CREATE TABLE usuarios (
  email TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nombre TEXT,                           -- 'Agustín'
  apellido TEXT,                         -- 'Sufi'
  rol TEXT NOT NULL CHECK (rol IN ('administrador', 'moderador', 'operario')),
  -- Campo asignado por default — al abrir el form, preselecciona este campo.
  -- NULL = el usuario tiene que elegir manualmente cada vez.
  campo_asignado_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX usuarios_cliente_idx ON usuarios(cliente_id);

-- =============================================================================
-- TABLA: campos
-- Cada cliente tiene N campos (establecimientos).
-- =============================================================================
CREATE TABLE campos (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  organizacion_id TEXT,                  -- legacy, podría removerse
  stock_inicial_vacas INTEGER,           -- vacas preñadas al comienzo de temporada
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX campos_cliente_idx ON campos(cliente_id);

-- =============================================================================
-- TABLA: lotes — subdivisiones de un campo (usado por Pariciones y Mortandad).
-- =============================================================================
CREATE TABLE lotes (
  id TEXT PRIMARY KEY,
  campo_id TEXT NOT NULL REFERENCES campos(id) ON DELETE CASCADE,
  cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX lotes_campo_idx ON lotes(campo_id);
CREATE INDEX lotes_cliente_idx ON lotes(cliente_id);

-- =============================================================================
-- TABLA: pluviometros — usado por módulo Lluvias.
-- =============================================================================
CREATE TABLE pluviometros (
  id TEXT PRIMARY KEY,
  campo_id TEXT NOT NULL REFERENCES campos(id) ON DELETE CASCADE,
  cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX pluviometros_campo_idx ON pluviometros(campo_id);

-- =============================================================================
-- TABLA: circuitos — usado por módulo Pastoreo.
-- =============================================================================
CREATE TABLE circuitos (
  id TEXT PRIMARY KEY,
  campo_id TEXT NOT NULL REFERENCES campos(id) ON DELETE CASCADE,
  cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  hectareas INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX circuitos_campo_idx ON circuitos(campo_id);

-- =============================================================================
-- TABLA: parcelas — subdivisiones de un circuito.
-- =============================================================================
CREATE TABLE parcelas (
  id TEXT PRIMARY KEY,
  circuito_id TEXT NOT NULL REFERENCES circuitos(id) ON DELETE CASCADE,
  cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  hectareas INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX parcelas_circuito_idx ON parcelas(circuito_id);

-- =============================================================================
-- TABLA: pariciones — eventos del módulo Pariciones.
-- Todos los IDs vienen del device (uuidv4 generado offline-first).
-- =============================================================================
CREATE TABLE pariciones (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  campo_id TEXT NOT NULL REFERENCES campos(id) ON DELETE RESTRICT,
  lote_id TEXT REFERENCES lotes(id) ON DELETE SET NULL,
  usuario_email TEXT NOT NULL,
  fecha DATE NOT NULL,
  vacas_grupo TEXT NOT NULL,             -- texto libre (alimentado por catálogo)
  evento TEXT NOT NULL,                  -- Nacimiento / Muerte / Aborto / Retacto
  sexo TEXT,                             -- Macho / Hembra / Orejano
  asistencia TEXT,                       -- Si / No
  caravana_color TEXT,
  caravana_numero TEXT,
  causa_tipo TEXT,                       -- Muerte Señalado / Nacido Muerto / Desconocido
  causa_detalle TEXT,
  observaciones TEXT,
  gps_lat NUMERIC(10, 7),
  gps_lon NUMERIC(10, 7),
  gps_accuracy_m NUMERIC(8, 2),
  fotos TEXT[],                          -- URLs de Supabase Storage
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX pariciones_cliente_idx ON pariciones(cliente_id);
CREATE INDEX pariciones_campo_fecha_idx ON pariciones(campo_id, fecha DESC);
CREATE INDEX pariciones_caravana_idx ON pariciones(caravana_color, caravana_numero);

-- =============================================================================
-- TABLA: lluvias
-- =============================================================================
CREATE TABLE lluvias (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  campo_id TEXT NOT NULL REFERENCES campos(id) ON DELETE RESTRICT,
  pluviometro_id TEXT REFERENCES pluviometros(id) ON DELETE SET NULL,
  usuario_email TEXT NOT NULL,
  fecha DATE NOT NULL,
  pluviometro_nombre TEXT,               -- denormalizado (para no romper si se borra el master)
  milimetros NUMERIC(6, 2) NOT NULL CHECK (milimetros >= 0 AND milimetros <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX lluvias_cliente_idx ON lluvias(cliente_id);
CREATE INDEX lluvias_campo_fecha_idx ON lluvias(campo_id, fecha DESC);

-- =============================================================================
-- TABLA: mortandad
-- =============================================================================
CREATE TABLE mortandad (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  campo_id TEXT NOT NULL REFERENCES campos(id) ON DELETE RESTRICT,
  lote_id TEXT REFERENCES lotes(id) ON DELETE SET NULL,
  usuario_email TEXT NOT NULL,
  fecha DATE NOT NULL,
  categoria TEXT NOT NULL,               -- texto libre (catálogo MORT_CATEGORIA)
  actividad TEXT,                        -- Cria / engorde / Recria P / etc
  causa_tipo TEXT,                       -- enum chico (catálogo CAUSA)
  causa_detalle TEXT,                    -- texto libre (insolacion, etc)
  caravana_color TEXT,
  caravana_numero TEXT,
  observaciones TEXT,
  gps_lat NUMERIC(10, 7),
  gps_lon NUMERIC(10, 7),
  gps_accuracy_m NUMERIC(8, 2),
  fotos TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX mortandad_cliente_idx ON mortandad(cliente_id);
CREATE INDEX mortandad_campo_fecha_idx ON mortandad(campo_id, fecha DESC);

-- =============================================================================
-- TABLA: pastoreo — modelo "stay log" (entrada + salida en mismo registro)
-- =============================================================================
CREATE TABLE pastoreo (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  campo_id TEXT NOT NULL REFERENCES campos(id) ON DELETE RESTRICT,
  circuito_id TEXT NOT NULL REFERENCES circuitos(id) ON DELETE RESTRICT,
  parcela_id TEXT NOT NULL REFERENCES parcelas(id) ON DELETE RESTRICT,
  parcela_numero INTEGER,                -- denormalizado
  usuario_email TEXT NOT NULL,
  fecha_entrada DATE NOT NULL,
  fecha_salida DATE,                     -- NULL = "abierto" (animal sigue en el lote)
  categoria TEXT NOT NULL,               -- Novillito Grande / Vaquilla Meses / etc
  evento TEXT,                           -- Entrada / Salida / Rotacion / Muerte
  categoria_animal TEXT,                 -- Toros / TernH / Vaq 1° Serv / ...
  caravana_numero TEXT,
  causa TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Constraint: si hay fecha_salida, debe ser >= fecha_entrada
  CHECK (fecha_salida IS NULL OR fecha_salida >= fecha_entrada)
);

CREATE INDEX pastoreo_cliente_idx ON pastoreo(cliente_id);
CREATE INDEX pastoreo_circuito_fecha_idx ON pastoreo(circuito_id, fecha_entrada DESC);
CREATE INDEX pastoreo_abierto_idx ON pastoreo(parcela_id) WHERE fecha_salida IS NULL;

-- =============================================================================
-- TRIGGER: actualizar updated_at en clientes cuando se edita.
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clientes_updated_at BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
-- Helper: resuelve el cliente_id del usuario actual a partir del JWT.
-- Supabase Auth pone el email en auth.jwt() → 'email'. Buscamos en usuarios.
CREATE OR REPLACE FUNCTION current_cliente_id() RETURNS TEXT AS $$
  SELECT cliente_id FROM usuarios WHERE email = auth.jwt() ->> 'email' LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Activar RLS en todas las tablas
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE campos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pluviometros ENABLE ROW LEVEL SECURITY;
ALTER TABLE circuitos ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pariciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE lluvias ENABLE ROW LEVEL SECURITY;
ALTER TABLE mortandad ENABLE ROW LEVEL SECURITY;
ALTER TABLE pastoreo ENABLE ROW LEVEL SECURITY;

-- Policy: cada usuario ve SOLO la data de su cliente.
-- Usamos USING para SELECT/UPDATE/DELETE y WITH CHECK para INSERT.

-- clientes: el usuario solo ve su propio cliente
CREATE POLICY clientes_select ON clientes FOR SELECT
  USING (id = current_cliente_id());

-- usuarios: solo ven los usuarios de su mismo cliente
CREATE POLICY usuarios_select ON usuarios FOR SELECT
  USING (cliente_id = current_cliente_id());

-- Catálogos (campos, lotes, etc) — read all, write solo admins (TODO: añadir
-- check de rol). Por ahora cualquier usuario autenticado puede escribir si es
-- de su mismo cliente.
CREATE POLICY campos_all ON campos FOR ALL
  USING (cliente_id = current_cliente_id())
  WITH CHECK (cliente_id = current_cliente_id());

CREATE POLICY lotes_all ON lotes FOR ALL
  USING (cliente_id = current_cliente_id())
  WITH CHECK (cliente_id = current_cliente_id());

CREATE POLICY pluviometros_all ON pluviometros FOR ALL
  USING (cliente_id = current_cliente_id())
  WITH CHECK (cliente_id = current_cliente_id());

CREATE POLICY circuitos_all ON circuitos FOR ALL
  USING (cliente_id = current_cliente_id())
  WITH CHECK (cliente_id = current_cliente_id());

CREATE POLICY parcelas_all ON parcelas FOR ALL
  USING (cliente_id = current_cliente_id())
  WITH CHECK (cliente_id = current_cliente_id());

-- Eventos transaccionales: insert para todos los usuarios autenticados de
-- su cliente. Para SELECT, además filtramos por usuario si es operario
-- (los admins y moderadores ven todo del cliente). Esto está hardcoded en
-- las queries de la app, pero RLS lo refuerza acá igual.
CREATE POLICY pariciones_all ON pariciones FOR ALL
  USING (cliente_id = current_cliente_id())
  WITH CHECK (cliente_id = current_cliente_id());

CREATE POLICY lluvias_all ON lluvias FOR ALL
  USING (cliente_id = current_cliente_id())
  WITH CHECK (cliente_id = current_cliente_id());

CREATE POLICY mortandad_all ON mortandad FOR ALL
  USING (cliente_id = current_cliente_id())
  WITH CHECK (cliente_id = current_cliente_id());

CREATE POLICY pastoreo_all ON pastoreo FOR ALL
  USING (cliente_id = current_cliente_id())
  WITH CHECK (cliente_id = current_cliente_id());

-- Listo. Próximo paso: 0002_seed_ganaderas.sql con la data real del cliente.
