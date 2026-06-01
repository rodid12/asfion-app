// Modelo de datos v2 — alineado con el schema de Supabase v0.3.
//
// Importante: los valores de VacasGrupo, EventoParicion, CaravanaColor, etc.
// son SUGERIDOS (alimentan los chips y autocompletes del UI). La DB los
// guarda como `text` libre, respaldados por la tabla `opciones`. El admin
// puede agregar/editar valores desde el panel sin migraciones.
//
// Cada registro que se guarda en cualquier módulo hereda de EventoBase:
// - id, fecha, campo, lote, usuario, gps, sync state, fotos.

import { v4 as uuidv4 } from 'uuid';

/** Identidad del usuario que carga (email es la clave natural, como en AppSheet). */
export interface Usuario {
  email: string;
  nombre?: string;       // ej. "Agustín"
  apellido?: string;     // ej. "Sufi"
  rol: 'administrador' | 'moderador' | 'operario';
  /** Tenant al que pertenece (sale de tabla usuarios.cliente_id). Lo necesita
   *  el SupabaseBackend para incluirlo en cada INSERT, porque las RLS policies
   *  exigen que cliente_id matchee con el del usuario logueado. */
  clienteId?: string;
  campos: string[]; // ids de campos a los que tiene acceso ([] = todos, para admins)
  campoAsignadoId?: string; // el que se preselecciona en los forms
}

/** Campo / establecimiento (Agisot, Carolina, Margarita, Picaflor, Progreso, Quirquincho...). */
export interface Campo {
  id: string;
  nombre: string;
  organizacionId: string;
  /**
   * Stock inicial de vacas preñadas al comienzo de la temporada de parición.
   * Alimenta las métricas "Vacas por parir" y "Terneros en pie".
   * Opcional porque puede no estar configurado aún; las métricas lo omiten si falta.
   * Editable desde el panel admin.
   */
  stockInicialVacas?: number;
}

/** Lote o subdivisión dentro de un campo (ej. "Progreso 3", "Ensenada Lote 15").
 *  Usado por Pariciones y Mortandad. */
export interface Lote {
  id: string;
  campoId: string;
  nombre: string;
}

/** Pluviómetro físico instalado en un campo (ej. "Casco", "Puesto", "D17").
 *  Usado por el módulo Lluvias. Los pluviómetros son distintos de los lotes:
 *  un campo tiene típicamente 1-3 pluviómetros y muchos lotes. Ej: en Picaflor
 *  hay 35 lotes pero solo ~14 pluviómetros (Casco/Puesto/D17/D20/...). */
export interface Pluviometro {
  id: string;
  campoId: string;
  nombre: string;
}

/** Circuito de pastoreo dentro de un campo. Cada circuito tiene una superficie
 *  total en hectáreas y se subdivide en parcelas (ver Parcela). Usado por el
 *  módulo Pastoreo. Ejemplos reales de Ganaderas: "1_3", "2_4", "5", "Lote10". */
export interface Circuito {
  id: string;
  campoId: string;
  nombre: string;
  hectareas: number;          // superficie total del circuito
}

/** Parcela dentro de un circuito. Numeradas 1..N por circuito, cada una con
 *  su propia superficie. Cuando el operario carga un pastoreo, elige
 *  circuito+parcela y la app autocompleta hectáreas. */
export interface Parcela {
  id: string;
  circuitoId: string;
  numero: number;             // 1, 2, 3, ...
  hectareas: number;
}

/** Estado de sincronización de cada evento cargado. */
export type SyncState = 'pending' | 'syncing' | 'synced' | 'failed';

/** Campos transversales a todo evento cargado en campo. */
export interface EventoBase {
  id: string;                 // uuid generado en el device (sirve como idempotency key)
  fecha: string;              // ISO 8601 (YYYY-MM-DD)
  campoId: string;
  loteId?: string;            // usado por Paricion (req) y Mortandad (opt)
  pluviometroId?: string;     // usado por Lluvia (req)
  circuitoId?: string;        // usado por Pastoreo (req)
  parcelaId?: string;         // usado por Pastoreo (req)
  usuarioEmail: string;
  gps?: { lat: number; lon: number; accuracyM?: number };
  createdAt: string;          // ISO datetime — cuándo cargó el operario, aunque sync sea después
  syncState: SyncState;
  syncError?: string;
  fotos?: string[];           // URIs locales (expo-image-picker) o URLs de Storage una vez sincadas
}

// ====== Módulo Pariciones ======

// Valores sugeridos — la DB acepta cualquier string
export type VacasGrupo = 'Vacas cabeza' | 'Vaca cuerpo' | 'Vaca cola';
export type EventoParicion = 'Nacimiento' | 'Muerte' | 'Aborto' | 'Retacto';
export type Sexo = 'Macho' | 'Hembra' | 'Orejano';
export type SiNo = 'Si' | 'No';

// Colores realmente en uso en los datos históricos (AppSheet)
export type CaravanaColor = 'Amarillo' | 'Blanca' | 'Celeste' | 'Naranja';

// Causa de muerte: cascade nivel 1 (tipo enum-corto) + nivel 2 (detalle texto libre)
export type CausaMuerteTipo = 'Muerte Señalado' | 'Nacido Muerto' | 'Desconocido';

export interface Paricion extends EventoBase {
  tipo: 'paricion';
  vacasGrupo: VacasGrupo;
  evento: EventoParicion;
  sexo?: Sexo;                 // no aplica a Aborto
  asistencia?: SiNo;
  caravanaColor?: CaravanaColor;
  caravanaNumero?: string;     // string porque el histórico mezcla formatos (0200, JT764O504)
  causaTipo?: CausaMuerteTipo;  // nivel 1 — solo si evento es Muerte o Aborto
  causaDetalle?: string;        // nivel 2 — texto libre (ej: "insolación", "cayó en canal")
  observaciones?: string;

  /** @deprecated usar causaTipo + causaDetalle */
  causaMuerte?: string;
}

// ====== Módulo Lluvias / Precipitaciones ======

export interface Lluvia extends EventoBase {
  tipo: 'lluvia';
  pluviometro: string;         // "Lote 9", "S", "Ensenada Lote 3"...
  milimetros: number;
  observaciones?: string;      // ej. "granizo al final", "llovizna toda la mañana"
}

// ====== Módulo Mortandad ======

// Categorías legacy (genéricas). Mantenidas para compatibilidad con código que
// las referencia. NUEVO: usar string libre alimentado por el catálogo
// MORT_CATEGORIA del cliente (ej. "Vc Preñ", "TernM", "Vaq 1° Servicio").
export type CategoriaHacienda = 'vaca' | 'ternero' | 'toro' | 'novillo' | 'vaquillona';

// Actividad asociada a la mortandad — campo nuevo del AppSheet de Ganaderas.
// Valores reales: Cria, engorde, Recria P, Invernada, Destete Precoz.
export type ActividadMortandad = string;

export interface Mortandad extends EventoBase {
  tipo: 'mortandad';
  // categoria ahora es string libre (alimentado por catálogo MORT_CATEGORIA
  // por cliente). Antes era el enum CategoriaHacienda — lo dejamos como string
  // para soportar valores como "Vc Preñ", "TernM", "Vaq 1° Servicio".
  categoria: string;
  actividad?: string;          // NUEVO — Cria/engorde/Recria P/Invernada/Destete Precoz
  causaTipo?: CausaMuerteTipo;
  causaDetalle?: string;
  caravanaColor?: CaravanaColor;
  caravanaNumero?: string;
  observaciones?: string;
}

// ====== Módulo Pastoreo (modelo entrada/salida con circuito + parcela) ======
//
// Cada registro representa el movimiento de hacienda hacia un circuito+parcela.
// Tiene fechaEntrada (= fecha de EventoBase) y fechaSalida opcional. Cuando
// fechaSalida está vacía el registro se considera "abierto" (la hacienda
// sigue allí). Editás el mismo registro para agregar fechaSalida cuando termina.
//
// Estructura ALINEADA al AppSheet real de Ganaderas (no más vaquillona/vaca).
// Categoría (Novillito Grande / Vaquilla Meses / etc) y Categoría Animal
// (Toros / TernH / Vaq 1° Serv) son strings libres alimentados por catálogos
// PAST_CATEGORIA y PAST_CAT_ANIMAL. Causa también es texto libre del catálogo.
//
// circuitoId, parcelaId y categoria son OBLIGATORIOS (overrideamos circuitoId
// con Omit + intersection). Sin ellos no podemos exportar al CSV con el orden
// de columnas que pide el cliente.
export interface Pastoreo extends Omit<EventoBase, 'circuitoId' | 'parcelaId'> {
  tipo: 'pastoreo';
  circuitoId: string;             // required en pastoreo
  parcelaId: string;              // required en pastoreo
  parcelaNumero?: number;         // denormalizado para acceso rápido en lists
  // fecha (heredado) = fecha de ENTRADA al circuito+parcela.
  fechaSalida?: string;           // ISO 8601 (YYYY-MM-DD) — undefined = abierto
  categoria: string;              // PAST_CATEGORIA (Novillito Grande, Vaquilla Meses, ...)
  evento?: string;                // PAST_EVENTO (Entrada/Salida/Rotacion/Muerte)
  categoriaAnimal?: string;       // PAST_CAT_ANIMAL (Toros, TernH, Vaq 1° Serv, ...)
  caravanaNumero?: string;        // opcional — el cliente real raramente lo usa
  causa?: string;                 // texto libre cuando aplica
  // Datos productivos (migration 0003) — para los KPIs del dashboard
  // (Animales, KG/Cab, Kg Totales, Carga). Opcionales para no romper la
  // carga de stays viejos sin estos datos.
  animales?: number;              // cantidad de cabezas en el stay
  kgPromedio?: number;            // peso promedio (kg) de las cabezas
}

// ====== Módulo Mediciones (condicion corporal, pesadas, forraje) ======

export interface Medicion extends EventoBase {
  tipo: 'medicion';
  tipoMedicion: 'pesada' | 'condicion_corporal' | 'altura_forraje' | 'otro';
  valor: number;
  unidad: string;              // "kg", "cm", "puntos 1-5", etc.
  caravanaNumero?: string;
  observaciones?: string;
}

// ====== Union type para el repositorio genérico ======

export type Evento = Paricion | Lluvia | Mortandad | Pastoreo | Medicion;
export type TipoEvento = Evento['tipo'];

// Helper para crear el shape base al instanciar un nuevo evento en el form.
export function nuevoEventoBase(partial: Partial<EventoBase> & { campoId: string; usuarioEmail: string }): EventoBase {
  const now = new Date();
  return {
    id: partial.id ?? uuidv4(),
    fecha: partial.fecha ?? now.toISOString().slice(0, 10),
    campoId: partial.campoId,
    loteId: partial.loteId,
    usuarioEmail: partial.usuarioEmail,
    gps: partial.gps,
    createdAt: partial.createdAt ?? now.toISOString(),
    syncState: partial.syncState ?? 'pending',
    syncError: partial.syncError,
    fotos: partial.fotos,
  };
}
