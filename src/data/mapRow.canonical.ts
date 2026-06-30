// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║                                                                           ║
// ║   ⚠️  ARCHIVO GENERADO AUTOMÁTICAMENTE — NO EDITAR                          ║
// ║                                                                           ║
// ║   Fuente: asfion-web/src/data/mapRow.canonical.ts
// ║   Sync con: cd ../asfion-web && npm run sync-types                        ║
// ║                                                                           ║
// ║   Si tocás este archivo a mano, el próximo sync lo pisa sin avisar.       ║
// ║   Editá el original en asfion-web y volvé a correr el sync.               ║
// ║                                                                           ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

// =============================================================================
// mapRow.canonical.ts — Helper declarativo para mappers DB ↔ TS
// =============================================================================
//
// ⚠️ ESTE ARCHIVO ES LA FUENTE DE VERDAD. Está duplicado en:
//   - asfion-web/src/data/mapRow.canonical.ts    ← SE EDITA ACÁ
//   - asfion-app/src/data/mapRow.canonical.ts    ← copia automática (vía sync-types)
//
// Para sincronizar: `npm run sync-types` desde el repo web.
//
// QUÉ HACE:
//   - `mapRow<T>(row, schema)` — toma un row de Supabase (snake_case) y lo
//     convierte al tipo canónico (camelCase). Reemplaza las 15+ funciones
//     `rowToX` que tenían patrones idénticos copy-pasteados.
//   - SCHEMAs declarativos: 1 spec por entidad canónica. Cuando agregás una
//     columna a la DB, agregás 1 línea acá y se aplica a ambos repos.
//
// POR QUÉ:
//   Antes: cada repo tenía 15 funciones imperativas con el patrón
//     `kgNetosOrigen: r.kg_netos_origen != null ? Number(r.kg_netos_origen) : undefined,`
//   Ahora: declarás `{ from: 'kg_netos_origen', type: 'number?' }` y mapRow
//   hace lo mismo en 1 línea. Cuando agregás una columna, agregás 1 línea
//   acá (en lugar de 2 funciones idénticas en 2 repos).

import type {
  CampoCanonical,
  LoteCanonical,
  PluviometroCanonical,
  CircuitoCanonical,
  ParcelaCanonical,
  ParicionCanonical,
  LluviaCanonical,
  MortandadCanonical,
  PastoreoCanonical,
  CompraCanonical,
} from './types.canonical';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de campo soportados — cubren los patterns que vemos en la práctica
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Una spec por campo del tipo canónico. `from` es el nombre snake_case en DB;
 * `type` define cómo parsear / qué hacer con NULL.
 *
 *   'string'        →  passthrough (requerido)
 *   'string?'       →  passthrough, NULL → undefined
 *   'number'        →  Number(v) (requerido)
 *   'number?'       →  Number(v) si != null, sino undefined
 *   'number|null'   →  Number(v) si != null, sino null  (refleja DB nullable)
 *   'as-is'         →  pass directo, sin transformar  (para arrays, JSON, etc.)
 */
export type FieldSpec =
  | { from: string; type: 'string' }
  | { from: string; type: 'string?' }
  | { from: string; type: 'number' }
  | { from: string; type: 'number?' }
  | { from: string; type: 'number|null' }
  | { from: string; type: 'as-is' };

export type Schema<T> = { [K in keyof T]: FieldSpec };

// ─────────────────────────────────────────────────────────────────────────────
// Cache de entries — Object.entries(schema) en CADA llamada alocaba un array
// nuevo (Compra schema = 23 fields × 2.500 rows = ~57k entries por fetch).
// Con WeakMap el array se calcula una sola vez por SCHEMA referenciado.
// Beneficio medido: ~400-800ms en el initial load del dashboard (audit #3 N19).
// ─────────────────────────────────────────────────────────────────────────────
type Entry = readonly [string, FieldSpec];
const SCHEMA_ENTRIES_CACHE = new WeakMap<object, Entry[]>();

function entriesOf<T>(schema: Schema<T>): Entry[] {
  // WeakMap requiere object key — Schema<T> es un object literal, OK.
  const cached = SCHEMA_ENTRIES_CACHE.get(schema as unknown as object);
  if (cached) return cached;
  const entries = Object.entries(schema) as Entry[];
  SCHEMA_ENTRIES_CACHE.set(schema as unknown as object, entries);
  return entries;
}

// ─────────────────────────────────────────────────────────────────────────────
// La función mágica — recibe row + schema, devuelve objeto del tipo T
// ─────────────────────────────────────────────────────────────────────────────

export function mapRow<T>(row: Record<string, any>, schema: Schema<T>): T {
  const out: Record<string, any> = {};
  for (const [key, spec] of entriesOf(schema)) {
    const raw = row[spec.from];
    switch (spec.type) {
      case 'string':
        out[key] = raw;
        break;
      case 'string?':
        out[key] = raw ?? undefined;
        break;
      case 'number':
        out[key] = Number(raw);
        break;
      case 'number?':
        out[key] = raw != null ? Number(raw) : undefined;
        break;
      case 'number|null':
        out[key] = raw != null ? Number(raw) : null;
        break;
      case 'as-is':
        out[key] = raw;
        break;
    }
  }
  return out as T;
}

// =============================================================================
// SCHEMAs CANÓNICOS — uno por cada interface en types.canonical.ts
// =============================================================================
//
// Convención de nombres: `<ENTIDAD>_SCHEMA`. Si en algún momento agregás un
// campo nuevo a la interface, agregalo TAMBIÉN acá, sino mapRow lo va a
// ignorar al parsear (queda undefined silencioso).

// ─────────────────────────────────────────────────────────────────────────────
// Catálogos
// ─────────────────────────────────────────────────────────────────────────────

export const CAMPO_SCHEMA: Schema<CampoCanonical> = {
  id:                { from: 'id',                 type: 'string'  },
  nombre:            { from: 'nombre',             type: 'string'  },
  organizacionId:    { from: 'organizacion_id',    type: 'string?' },
  stockInicialVacas: { from: 'stock_inicial_vacas',type: 'number?' },
};

export const LOTE_SCHEMA: Schema<LoteCanonical> = {
  id:      { from: 'id',       type: 'string' },
  campoId: { from: 'campo_id', type: 'string' },
  nombre:  { from: 'nombre',   type: 'string' },
};

export const PLUVIOMETRO_SCHEMA: Schema<PluviometroCanonical> = {
  id:      { from: 'id',       type: 'string' },
  campoId: { from: 'campo_id', type: 'string' },
  nombre:  { from: 'nombre',   type: 'string' },
};

export const CIRCUITO_SCHEMA: Schema<CircuitoCanonical> = {
  id:        { from: 'id',        type: 'string' },
  campoId:   { from: 'campo_id',  type: 'string' },
  nombre:    { from: 'nombre',    type: 'string' },
  hectareas: { from: 'hectareas', type: 'number' },
};

export const PARCELA_SCHEMA: Schema<ParcelaCanonical> = {
  id:          { from: 'id',          type: 'string' },
  circuitoId:  { from: 'circuito_id', type: 'string' },
  numero:      { from: 'numero',      type: 'number' },
  hectareas:   { from: 'hectareas',   type: 'number' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Eventos
// ─────────────────────────────────────────────────────────────────────────────

export const PARICION_SCHEMA: Schema<ParicionCanonical> = {
  id:             { from: 'id',              type: 'string'  },
  cliente_id:     { from: 'cliente_id',      type: 'string?' },
  fecha:          { from: 'fecha',           type: 'string'  },
  campoId:        { from: 'campo_id',        type: 'string'  },
  loteId:         { from: 'lote_id',         type: 'string?' },
  usuarioEmail:   { from: 'usuario_email',   type: 'string'  },
  vacasGrupo:     { from: 'vacas_grupo',     type: 'as-is'   },
  evento:         { from: 'evento',          type: 'as-is'   },
  sexo:           { from: 'sexo',            type: 'as-is'   },
  asistencia:     { from: 'asistencia',      type: 'as-is'   },
  caravanaColor:  { from: 'caravana_color',  type: 'as-is'   },
  caravanaNumero: { from: 'caravana_numero', type: 'string?' },
  causaTipo:      { from: 'causa_tipo',      type: 'as-is'   },
  causaDetalle:   { from: 'causa_detalle',   type: 'string?' },
  observaciones:  { from: 'observaciones',   type: 'string?' },
  createdAt:      { from: 'created_at',      type: 'string'  },
};

export const LLUVIA_SCHEMA: Schema<LluviaCanonical> = {
  id:            { from: 'id',             type: 'string'  },
  cliente_id:    { from: 'cliente_id',     type: 'string?' },
  fecha:         { from: 'fecha',          type: 'string'  },
  campoId:       { from: 'campo_id',       type: 'string'  },
  usuarioEmail:  { from: 'usuario_email',  type: 'string'  },
  pluviometro:   { from: 'pluviometro',    type: 'string'  },
  pluviometroId: { from: 'pluviometro_id', type: 'string?' },
  milimetros:    { from: 'milimetros',     type: 'number'  },
  observaciones: { from: 'observaciones',  type: 'string?' },
  createdAt:     { from: 'created_at',     type: 'string'  },
};

export const MORTANDAD_SCHEMA: Schema<MortandadCanonical> = {
  id:             { from: 'id',              type: 'string'  },
  cliente_id:     { from: 'cliente_id',      type: 'string?' },
  fecha:          { from: 'fecha',           type: 'string'  },
  campoId:        { from: 'campo_id',        type: 'string'  },
  loteId:         { from: 'lote_id',         type: 'string?' },
  usuarioEmail:   { from: 'usuario_email',   type: 'string'  },
  categoria:      { from: 'categoria',       type: 'string'  },
  actividad:      { from: 'actividad',       type: 'string?' },
  causaTipo:      { from: 'causa_tipo',      type: 'as-is'   },
  causaDetalle:   { from: 'causa_detalle',   type: 'string?' },
  caravanaColor:  { from: 'caravana_color',  type: 'as-is'   },
  caravanaNumero: { from: 'caravana_numero', type: 'string?' },
  observaciones:  { from: 'observaciones',   type: 'string?' },
  createdAt:      { from: 'created_at',      type: 'string'  },
};

export const PASTOREO_SCHEMA: Schema<PastoreoCanonical> = {
  id:               { from: 'id',                type: 'string'  },
  cliente_id:       { from: 'cliente_id',        type: 'string?' },
  fecha:            { from: 'fecha_entrada',     type: 'string'  },
  fechaSalida:      { from: 'fecha_salida',      type: 'string?' },
  campoId:          { from: 'campo_id',          type: 'string'  },
  circuitoId:       { from: 'circuito_id',       type: 'string'  },
  parcelaId:        { from: 'parcela_id',        type: 'string'  },
  parcelaNumero:    { from: 'parcela_numero',    type: 'number?' },
  usuarioEmail:     { from: 'usuario_email',     type: 'string'  },
  categoria:        { from: 'categoria',         type: 'string'  },
  categoriaAnimal:  { from: 'categoria_animal',  type: 'string?' },
  evento:           { from: 'evento',            type: 'string?' },
  caravanaNumero:   { from: 'caravana_numero',   type: 'string?' },
  causa:            { from: 'causa',             type: 'string?' },
  animales:         { from: 'animales',          type: 'number?' },
  kgPromedio:       { from: 'kg_promedio',       type: 'number?' },
  createdAt:        { from: 'created_at',        type: 'string'  },
};

export const COMPRA_SCHEMA: Schema<CompraCanonical> = {
  id:              { from: 'id',                type: 'string'      },
  cliente_id:      { from: 'cliente_id',        type: 'string?'     },
  fecha:           { from: 'fecha',             type: 'string'      },
  campoId:         { from: 'campo_id',          type: 'string'      },
  usuarioEmail:    { from: 'usuario_email',     type: 'string'      },
  actividad:       { from: 'actividad',         type: 'string?'     },
  cantCabYCat:     { from: 'cant_cab_y_cat',    type: 'string?'     },
  totalMachos:     { from: 'total_machos',      type: 'number?'     },
  totalHembras:    { from: 'total_hembras',     type: 'number?'     },
  kgNetosOrigen:   { from: 'kg_netos_origen',   type: 'number'      },
  kgNetosDestino:  { from: 'kg_netos_destino',  type: 'number|null' },
  mermaPorcentaje: { from: 'merma_porcentaje',  type: 'number?'     },
  kgCorregidos:    { from: 'kg_corregidos',     type: 'number?'     },
  precio:          { from: 'precio',            type: 'number?'     },
  consignado:      { from: 'consignado',        type: 'string?'     },
  titular:         { from: 'titular',           type: 'string?'     },
  plazo:           { from: 'plazo',             type: 'string?'     },
  numeroDte:       { from: 'numero_dte',        type: 'string?'     },
  numeroOperacion: { from: 'numero_operacion',  type: 'string?'     },
  kmRecorrido:     { from: 'km_recorrido',      type: 'number?'     },
  observaciones:   { from: 'observaciones',     type: 'string?'     },
  createdAt:       { from: 'created_at',        type: 'string'      },
};
