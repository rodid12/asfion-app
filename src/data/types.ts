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
import { dateAISO } from '@/utils/fechas';

/** Row crudo de la tabla `clientes` — usado por el ClientConfigContext
 *  para reemplazar el ACTIVE_CONFIG compile-time. El mapping al tipo
 *  ClientConfig final lo hace el provider. */
export interface ClienteConfigRow {
  id: string;
  nombre: string;
  tagline?: string;
  logoUrl?: string;
  accentColor?: string;
  modulosHabilitados: string[];
  /** JSONB con los catálogos por módulo (pariciones, mortandad, pastoreo, compras).
   *  El shape se valida cuando se mapea a ClientConfig en el provider. */
  catalogos: Record<string, any>;
}

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

// Catálogos compartidos — vienen del canonical (sincronizado con dashboard).
// La app usa estos types EXACTOS para los selects de campo/lote/circuito en
// los forms y para resolver nombres en las cards de lista.
export type { CampoCanonical as Campo,
              LoteCanonical as Lote,
              PluviometroCanonical as Pluviometro,
              CircuitoCanonical as Circuito,
              ParcelaCanonical as Parcela } from './types.canonical';

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

// Tipos compartidos — vienen del canonical (sincronizado con dashboard).
// Import + re-export para que se puedan usar TANTO acá adentro (ej.
// interface Mortandad usa CausaMuerteTipo) COMO desde otros archivos
// que importan de '@/data/types'.
import type {
  VacasGrupo,
  EventoParicion,
  Sexo,
  SiNo,
  CaravanaColor,
  CausaMuerteTipo,
  ParicionCanonical,
  LluviaCanonical,
  MortandadCanonical,
  PastoreoCanonical,
} from './types.canonical';
export type {
  VacasGrupo,
  EventoParicion,
  Sexo,
  SiNo,
  CaravanaColor,
  CausaMuerteTipo,
};

export interface Paricion extends EventoBase, Omit<ParicionCanonical, keyof EventoBase> {
  tipo: 'paricion';

  /** @deprecated usar causaTipo + causaDetalle (mantiene compat con data histórica) */
  causaMuerte?: string;
}

// ====== Módulo Lluvias / Precipitaciones ======
// Lluvia = LluviaCanonical (compartido) + EventoBase (gps/fotos/sync) + tipo
export interface Lluvia extends EventoBase, Omit<LluviaCanonical, keyof EventoBase> {
  tipo: 'lluvia';
}

// ====== Módulo Mortandad ======

// Categorías legacy (genéricas). Mantenidas para compatibilidad con código que
// las referencia. NUEVO: usar string libre alimentado por el catálogo
// MORT_CATEGORIA del cliente (ej. "Vc Preñ", "TernM", "Vaq 1° Servicio").
export type CategoriaHacienda = 'vaca' | 'ternero' | 'toro' | 'novillo' | 'vaquillona';

// Actividad asociada a la mortandad — campo nuevo del AppSheet de Ganaderas.
// Valores reales: Cria, engorde, Recria P, Invernada, Destete Precoz.
export type ActividadMortandad = string;

// Mortandad = MortandadCanonical (sin GPS — lo aporta EventoBase como
// `gps: {lat, lon}` anidado). El dashboard tiene gpsLat/gpsLon aplanados.
export interface Mortandad extends EventoBase, Omit<MortandadCanonical, keyof EventoBase> {
  tipo: 'mortandad';
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
// Pastoreo = PastoreoCanonical + EventoBase + tipo.
// Tricky: circuitoId y parcelaId existen en AMBOS — opcionales en EventoBase
// y obligatorios en PastoreoCanonical. Queremos los del canonical (required).
// Si usáramos `Omit<PastoreoCanonical, keyof EventoBase>` se omitirían
// también esos dos, quedando undefined en Pastoreo. Por eso el Omit es
// explícito (solo los campos REALMENTE duplicados sin override): id, fecha,
// campoId, loteId, usuarioEmail, createdAt, cliente_id.
export interface Pastoreo extends Omit<EventoBase, 'circuitoId' | 'parcelaId'>,
                                  Omit<PastoreoCanonical,
                                    'id' | 'fecha' | 'campoId' | 'loteId' |
                                    'usuarioEmail' | 'createdAt' | 'cliente_id'
                                  > {
  tipo: 'pastoreo';
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

// ====== Módulo Compras (compra de hacienda) ======
//
// Replica el módulo "Compra" del AppSheet del cliente.
// Se carga cuando el campo COMPRA hacienda (entrada al sistema, no nacimiento).
//
// Campos compartidos (actividad, kgNetosOrigen, kgNetosDestino, etc) vienen
// de CompraCanonical en types.canonical.ts (compartido con el dashboard).
// Acá los EXTENDEMOS con lo específico del app móvil:
//   - extiende EventoBase → suma gps, fotos, syncState, syncError
//   - tipo: 'compra' → para que el union Evento sea discriminado
import type { CompraCanonical } from './types.canonical';

export interface Compra extends EventoBase, Omit<CompraCanonical, keyof EventoBase> {
  tipo: 'compra';
}

// ====== Union type para el repositorio genérico ======

export type Evento = Paricion | Lluvia | Mortandad | Pastoreo | Medicion | Compra;
export type TipoEvento = Evento['tipo'];

// ====== Subscription / billing state ======
//
// Mirror del enum en clientes.subscription_status (migración 0005). El cliente
// nunca pierde acceso a sus datos pero la fricción aumenta a medida que pasa
// el vencimiento. El detalle de qué pasa en cada estado lo decide la UI vía
// SubscriptionBanner / SubscriptionLockoutScreen.
export type SubscriptionStatus =
  | 'active'      // pago al día, todo normal
  | 'past_due'    // días 1-7 vencido, banner naranja + app operativa
  | 'restricted'  // días 8-19 vencido, read-only (no se cargan eventos)
  | 'suspended'   // días 20+ vencido, login bloqueado salvo para export
  | 'canceled';   // cuenta cerrada, sin login

export interface Subscription {
  status: SubscriptionStatus;
  /** Fecha hasta la cual está pagado (ISO YYYY-MM-DD). Null = no billing setup. */
  periodEndDate: string | null;
  /** Última transferencia confirmada (ISO datetime). */
  lastPaymentDate: string | null;
  /**
   * Días desde el vencimiento. 0 cuando está al día (o adelantado). Calculado
   * en la app a partir de periodEndDate y la fecha actual; el cron del server
   * mueve el status discretamente, esto es la métrica continua para el UI.
   */
  daysOverdue: number;
}

// Helper para crear el shape base al instanciar un nuevo evento en el form.
export function nuevoEventoBase(partial: Partial<EventoBase> & { campoId: string; usuarioEmail: string }): EventoBase {
  const now = new Date();
  return {
    id: partial.id ?? uuidv4(),
    // dateAISO usa zona LOCAL; toISOString() devuelve UTC y corre la fecha
    // un día cuando se llama de noche en ART (bug TZ del audit 27-jun-2026).
    fecha: partial.fecha ?? dateAISO(now),
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
