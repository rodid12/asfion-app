// SupabaseBackend — implementación de IDataBackend que habla con Supabase.
//
// Reemplaza al InMemoryBackend en producción. Mismo contrato (IDataBackend),
// los screens no se enteran del cambio.
//
// Setup:
//   1. Crear proyecto Supabase, correr supabase/migrations/0001 y 0002.
//   2. Definir env vars EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY.
//   3. En App.tsx cambiar <RepositoryProvider kind="memory"> → kind="supabase".
//
// El RLS de Supabase se encarga de filtrar por cliente_id automáticamente:
// si un usuario de Ganaderas hace SELECT en pariciones, solo recibe los de
// Ganaderas. La app no tiene que pasar cliente_id en queries — viene del JWT.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  Campo,
  CaravanaColor,
  Circuito,
  ClienteConfigRow,
  Evento,
  Lote,
  Parcela,
  Paricion,
  Pluviometro,
  Subscription,
  SubscriptionStatus,
  TipoEvento,
  Usuario,
} from '../types';
import type {
  EventoFilters,
  FlushResult,
  IDataBackend,
  ParicionRef,
  UltimaCaravana,
} from '../repository';
import { computeDaysOverdue } from '../subscription';
import { uploadFotosSiHaceFalta } from './photoUpload';
import {
  mapRow,
  CAMPO_SCHEMA,
  LOTE_SCHEMA,
  PLUVIOMETRO_SCHEMA,
  CIRCUITO_SCHEMA,
  PARCELA_SCHEMA,
  PARICION_SCHEMA,
  LLUVIA_SCHEMA,
  MORTANDAD_SCHEMA,
  PASTOREO_SCHEMA,
  COMPRA_SCHEMA,
} from '../mapRow.canonical';
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
} from '../types.canonical';

// =============================================================================
// Config
// =============================================================================

export interface SupabaseBackendConfig {
  url: string;
  anonKey: string;
}

const PENDING_KEY = 'asfion.supabase.pending.v1';

// =============================================================================
// Error tipado: sesión expirada / problemas de auth
// =============================================================================
//
// El Repository normalmente cachetea cualquier error de saveEvento y encola
// el evento como pending — comportamiento correcto si el problema es de red
// (la próxima vez que haya conexión se reintenta). PERO si el problema es
// que la sesión JWT venció, la cola crece para siempre porque el reintento
// también va a fallar.
//
// SessionExpiredError es la señal para que el caller (Repository) NO encole
// y en su lugar informe a la UI que hay que re-loguearse.
export class SessionExpiredError extends Error {
  readonly isSessionExpired = true;
  constructor(message: string) {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

export function isSessionExpiredError(err: unknown): err is SessionExpiredError {
  return Boolean(err) && typeof err === 'object' && (err as any).isSessionExpired === true;
}

// SubscriptionBlockedError: levantado cuando un INSERT/UPDATE falla por la
// policy RLS de subscription (current_cliente_can_write() devolvió false).
// Igual que SessionExpired: NO encolar como pending, porque el reintento
// también va a fallar hasta que regularicen el pago.
//
// Postgres devuelve un error 42501 ("new row violates row-level security
// policy") cuando WITH CHECK falla. Lo detectamos heurísticamente porque el
// mensaje en supabase-js no incluye el code en formato fácil.
export class SubscriptionBlockedError extends Error {
  readonly isSubscriptionBlocked = true;
  constructor(message: string) {
    super(message);
    this.name = 'SubscriptionBlockedError';
  }
}

export function isSubscriptionBlockedError(err: unknown): err is SubscriptionBlockedError {
  return Boolean(err) && typeof err === 'object' && (err as any).isSubscriptionBlocked === true;
}

/** Devuelve true si el error de supabase-js parece ser un block de RLS. */
export function looksLikeRlsBlock(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('row-level security') ||
    m.includes('violates row level security') ||
    m.includes('new row violates') ||
    m.includes('rls')
  );
}

// =============================================================================
// Helpers de mapeo DB <-> TS (snake_case <-> camelCase)
// =============================================================================
// Postgres usa snake_case por convención; TS usa camelCase. Mapeamos a mano
// (no usamos un ORM porque el shape es chico y queremos control total).

// Mappers de catálogos. SCHEMAs declarativos en mapRow.canonical.ts —
// agregás una columna ahí y el mapper se actualiza solo.

function rowToCampo(r: any): Campo        { return mapRow<Campo>(r, CAMPO_SCHEMA); }
function rowToLote(r: any): Lote          { return mapRow<Lote>(r, LOTE_SCHEMA); }
function rowToPluviometro(r: any): Pluviometro { return mapRow<Pluviometro>(r, PLUVIOMETRO_SCHEMA); }
function rowToCircuito(r: any): Circuito  { return mapRow<Circuito>(r, CIRCUITO_SCHEMA); }
function rowToParcela(r: any): Parcela    { return mapRow<Parcela>(r, PARCELA_SCHEMA); }

function rowToUsuario(r: any): Usuario {
  return {
    email: r.email,
    nombre: r.nombre ?? undefined,
    apellido: r.apellido ?? undefined,
    rol: r.rol,
    clienteId: r.cliente_id,
    campos: [], // no se popula desde server por ahora
    campoAsignadoId: r.campo_asignado_id ?? undefined,
  };
}

function gpsFromRow(r: any): Evento['gps'] {
  if (r.gps_lat == null || r.gps_lon == null) return undefined;
  return {
    lat: Number(r.gps_lat),
    lon: Number(r.gps_lon),
    accuracyM: r.gps_accuracy_m != null ? Number(r.gps_accuracy_m) : undefined,
  };
}

// Mappers de eventos. La parte canónica (campos compartidos con dashboard)
// se calcula con mapRow + SCHEMA; los EXTRAS específicos de la app móvil
// (tipo discriminado, gps anidado, fotos, syncState) se agregan con spread.
//
// SYNC STATE: el backend siempre devuelve rows YA sincronizados → 'synced'.
// El estado 'pending'/'syncing'/'failed' solo vive en la cola local de
// AsyncStorage hasta que el flush exitoso los borra de ahí.

function rowToParicion(r: any): Paricion {
  return {
    ...mapRow<ParicionCanonical>(r, PARICION_SCHEMA),
    tipo: 'paricion',
    gps: gpsFromRow(r),
    fotos: r.fotos ?? undefined,
    syncState: 'synced',
  };
}

function rowToLluvia(r: any): Evento {
  return {
    ...mapRow<LluviaCanonical>(
      { ...r, pluviometro: r.pluviometro_nombre ?? r.pluviometro ?? '' },
      LLUVIA_SCHEMA,
    ),
    tipo: 'lluvia',
    loteId: undefined,
    gps: gpsFromRow(r),
    fotos: r.fotos ?? undefined,
    syncState: 'synced',
  };
}

function rowToMortandad(r: any): Evento {
  return {
    ...mapRow<MortandadCanonical>(r, MORTANDAD_SCHEMA),
    tipo: 'mortandad',
    gps: gpsFromRow(r),
    fotos: r.fotos ?? undefined,
    syncState: 'synced',
  };
}

function rowToPastoreo(r: any): Evento {
  return {
    ...mapRow<PastoreoCanonical>(r, PASTOREO_SCHEMA),
    tipo: 'pastoreo',
    gps: gpsFromRow(r),
    fotos: r.fotos ?? undefined,
    syncState: 'synced',
  };
}

// Mappers inversos: TS → DB row (para INSERT/UPDATE).
// IMPORTANTE: incluyen cliente_id (lo agrega saveEvento desde el currentUser).
// La política RLS verifica que ese cliente_id matchee con el del usuario
// logueado — si no coincide, el INSERT falla con "violates RLS".

function paricionToRow(p: Paricion, clienteId: string) {
  return {
    id: p.id,
    cliente_id: clienteId,
    campo_id: p.campoId,
    lote_id: p.loteId ?? null,
    usuario_email: p.usuarioEmail,
    fecha: p.fecha,
    vacas_grupo: p.vacasGrupo,
    evento: p.evento,
    sexo: p.sexo ?? null,
    asistencia: p.asistencia ?? null,
    caravana_color: p.caravanaColor ?? null,
    caravana_numero: p.caravanaNumero ?? null,
    causa_tipo: p.causaTipo ?? null,
    causa_detalle: p.causaDetalle ?? null,
    observaciones: p.observaciones ?? null,
    gps_lat: p.gps?.lat ?? null,
    gps_lon: p.gps?.lon ?? null,
    gps_accuracy_m: p.gps?.accuracyM ?? null,
    fotos: p.fotos ?? null,
  };
}

function lluviaToRow(l: any, clienteId: string) {
  return {
    id: l.id,
    cliente_id: clienteId,
    campo_id: l.campoId,
    pluviometro_id: l.pluviometroId ?? null,
    usuario_email: l.usuarioEmail,
    fecha: l.fecha,
    pluviometro_nombre: l.pluviometro ?? null,
    milimetros: l.milimetros,
  };
}

function mortandadToRow(m: any, clienteId: string) {
  return {
    id: m.id,
    cliente_id: clienteId,
    campo_id: m.campoId,
    lote_id: m.loteId ?? null,
    usuario_email: m.usuarioEmail,
    fecha: m.fecha,
    categoria: m.categoria,
    actividad: m.actividad ?? null,
    causa_tipo: m.causaTipo ?? null,
    causa_detalle: m.causaDetalle ?? null,
    caravana_color: m.caravanaColor ?? null,
    caravana_numero: m.caravanaNumero ?? null,
    observaciones: m.observaciones ?? null,
    gps_lat: m.gps?.lat ?? null,
    gps_lon: m.gps?.lon ?? null,
    gps_accuracy_m: m.gps?.accuracyM ?? null,
    fotos: m.fotos ?? null,
  };
}

function pastoreoToRow(p: any, clienteId: string) {
  return {
    id: p.id,
    cliente_id: clienteId,
    campo_id: p.campoId,
    circuito_id: p.circuitoId,
    parcela_id: p.parcelaId,
    parcela_numero: p.parcelaNumero ?? null,
    usuario_email: p.usuarioEmail,
    fecha_entrada: p.fecha,
    fecha_salida: p.fechaSalida ?? null,
    categoria: p.categoria,
    evento: p.evento ?? null,
    categoria_animal: p.categoriaAnimal ?? null,
    caravana_numero: p.caravanaNumero ?? null,
    causa: p.causa ?? null,
    // Migration 0003 — datos productivos
    animales:    p.animales    ?? null,
    kg_promedio: p.kgPromedio  ?? null,
  };
}

// ====== Compras (migration 0004) ======
//
// Replica el módulo "Compra" del AppSheet del cliente. Captura entrada de
// hacienda (no nacimiento) con datos físicos, comerciales y logísticos.

function rowToCompra(r: any): Evento {
  return {
    ...mapRow<CompraCanonical>(r, COMPRA_SCHEMA),
    tipo: 'compra',
    gps: gpsFromRow(r),
    fotos: r.fotos ?? undefined,
    syncState: 'synced',
  };
}

function compraToRow(c: any, clienteId: string) {
  return {
    id: c.id,
    cliente_id: clienteId,
    campo_id: c.campoId,
    usuario_email: c.usuarioEmail,
    fecha: c.fecha,
    actividad:        c.actividad ?? null,
    cant_cab_y_cat:   c.cantCabYCat ?? null,
    kg_netos_origen:  c.kgNetosOrigen,
    kg_netos_destino: c.kgNetosDestino,
    merma_porcentaje: c.mermaPorcentaje ?? null,
    kg_corregidos:    c.kgCorregidos ?? null,
    precio:           c.precio ?? null,
    consignado:       c.consignado ?? null,
    titular:          c.titular ?? null,
    plazo:            c.plazo ?? null,
    numero_dte:       c.numeroDte ?? null,
    numero_operacion: c.numeroOperacion ?? null,
    km_recorrido:     c.kmRecorrido ?? null,
    observaciones:    c.observaciones ?? null,
  };
}

// =============================================================================
// SupabaseBackend
// =============================================================================

export class SupabaseBackend implements IDataBackend {
  readonly name = 'supabase';
  private supabase: SupabaseClient;
  private currentUserCache: Usuario | null = null;

  constructor(config: SupabaseBackendConfig) {
    this.supabase = createClient(config.url, config.anonKey, {
      auth: {
        // Usamos AsyncStorage como el storage de sesión (Supabase Auth lo
        // necesita para persistir el JWT entre cierres de app).
        storage: AsyncStorage as any,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // mobile, no hay URL
      },
    });
  }

  // ---------- Auth ----------

  async login(email: string, password: string): Promise<Usuario> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    if (!data.user?.email) throw new Error('Sin email en el usuario auth');

    // Resolver el perfil desde tabla usuarios (cliente_id, rol, nombre, apellido)
    const profile = await this.fetchUserProfile(data.user.email);
    this.currentUserCache = profile;
    return profile;
  }

  async getCurrentUser(): Promise<Usuario | null> {
    if (this.currentUserCache) return this.currentUserCache;
    const { data } = await this.supabase.auth.getUser();
    if (!data.user?.email) return null;
    try {
      const profile = await this.fetchUserProfile(data.user.email);
      this.currentUserCache = profile;
      return profile;
    } catch {
      return null;
    }
  }

  /**
   * Prime el cache de usuario sin hacer round-trip a Supabase. Lo usa
   * AuthProvider al bootear desde AsyncStorage. Sin esto, el primer
   * saveEvento tras un cold-start tira "usuario sin clienteId" si la
   * sesión JWT existe pero todavía no se resolvió el perfil.
   */
  setCurrentUser(user: Usuario | null): void {
    this.currentUserCache = user;
  }

  async logout(): Promise<void> {
    await this.supabase.auth.signOut();
    this.currentUserCache = null;
  }

  private async fetchUserProfile(email: string): Promise<Usuario> {
    const { data, error } = await this.supabase
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .single();
    if (error) throw new Error(`Perfil no encontrado para ${email}: ${error.message}`);
    return rowToUsuario(data);
  }

  // ---------- Subscription / billing ----------

  /**
   * Lee el row del cliente actual y devuelve su estado de subscription.
   * El RLS de SELECT en `clientes` ya filtra por current_cliente_id, así que
   * con un select sin WHERE alcanza — solo devuelve el row del tenant logueado.
   *
   * Si el cliente no tiene billing configurado (period_end_date null), tratamos
   * el caso como 'active' con daysOverdue 0 para no romper la UX. El admin
   * sabe que hay clientes en trial / sin facturar y los maneja desde el panel.
   */
  async getSubscription(): Promise<Subscription> {
    // .eq('id', currentClienteId) explícito — antes la query era un
    // `select…limit(1)` que confiaba en que RLS filtrara. Con 1 cliente
    // funcionaba pero con 50 clientes hace full-table scan antes del
    // limit. El filter explícito usa el índice de PK (O(1)).
    const user = await this.getCurrentUser();
    const clienteId = user?.clienteId;
    if (!clienteId) {
      return { status: 'active', periodEndDate: null, lastPaymentDate: null, daysOverdue: 0 };
    }
    const { data, error } = await this.supabase
      .from('clientes')
      .select('subscription_status, period_end_date, last_payment_date')
      .eq('id', clienteId)
      .maybeSingle();
    if (error) throw new Error(`getSubscription: ${error.message}`);
    if (!data) {
      // Fallback defensivo (no debería pasar si el JWT está OK).
      return { status: 'active', periodEndDate: null, lastPaymentDate: null, daysOverdue: 0 };
    }
    const status = (data.subscription_status ?? 'active') as SubscriptionStatus;
    const periodEndDate = data.period_end_date as string | null;
    const lastPaymentDate = data.last_payment_date as string | null;
    return {
      status,
      periodEndDate,
      lastPaymentDate,
      daysOverdue: computeDaysOverdue(periodEndDate),
    };
  }

  /**
   * Trae la configuración runtime del cliente actual.
   * Reemplaza el ACTIVE_CONFIG compile-time. RLS filtra automáticamente
   * por el cliente del usuario logueado, así que esta query devuelve
   * a lo sumo 1 row.
   */
  async getClienteConfig(): Promise<ClienteConfigRow | null> {
    // Mismo razonamiento que getSubscription: .eq('id', ...) explícito
    // para usar el índice de PK en vez de full-table scan + RLS filter.
    const user = await this.getCurrentUser();
    const clienteId = user?.clienteId;
    if (!clienteId) return null;
    const { data, error } = await this.supabase
      .from('clientes')
      .select('id, nombre, tagline, logo_url, accent_color, modulos_habilitados, catalogos')
      .eq('id', clienteId)
      .maybeSingle();
    if (error) {
      // Si la migración 0014 no aplicó todavía (algunos campos NULL), igual
      // devolvemos lo que tengamos en lugar de tirar excepción.
      console.warn('[getClienteConfig] error:', error.message);
      return null;
    }
    if (!data) return null;
    return {
      id: data.id,
      nombre: data.nombre,
      tagline: data.tagline ?? undefined,
      logoUrl: data.logo_url ?? undefined,
      accentColor: data.accent_color ?? undefined,
      modulosHabilitados: Array.isArray(data.modulos_habilitados) ? data.modulos_habilitados : [],
      catalogos: (data.catalogos ?? {}) as Record<string, any>,
    };
  }

  // ---------- Catálogos ----------

  async listCampos(): Promise<Campo[]> {
    const { data, error } = await this.supabase
      .from('campos')
      .select('*')
      .order('nombre');
    if (error) throw new Error(error.message);
    return (data ?? []).map(rowToCampo);
  }

  // Q2 audit: cambio de select('*') a columnas explícitas. Ahorra bytes
  // en transit en cada login mobile y deja el query plan más predecible.
  async listLotes(campoId: string): Promise<Lote[]> {
    const { data, error } = await this.supabase
      .from('lotes')
      .select('id, campo_id, nombre')
      .eq('campo_id', campoId)
      .order('nombre');
    if (error) throw new Error(error.message);
    return (data ?? []).map(rowToLote);
  }

  async listPluviometros(campoId: string): Promise<Pluviometro[]> {
    const { data, error } = await this.supabase
      .from('pluviometros')
      .select('id, campo_id, nombre')
      .eq('campo_id', campoId)
      .order('nombre');
    if (error) throw new Error(error.message);
    return (data ?? []).map(rowToPluviometro);
  }

  async listCircuitos(campoId: string): Promise<Circuito[]> {
    const { data, error } = await this.supabase
      .from('circuitos')
      .select('id, campo_id, nombre, hectareas')
      .eq('campo_id', campoId)
      .order('nombre');
    if (error) throw new Error(error.message);
    return (data ?? []).map(rowToCircuito);
  }

  async listParcelas(circuitoId: string): Promise<Parcela[]> {
    const { data, error } = await this.supabase
      .from('parcelas')
      .select('id, circuito_id, numero, hectareas')
      .eq('circuito_id', circuitoId)
      .order('numero');
    if (error) throw new Error(error.message);
    return (data ?? []).map(rowToParcela);
  }

  // ---------- Helpers para el form ----------

  async ultimaCaravana(campoId: string): Promise<UltimaCaravana | null> {
    const { data, error } = await this.supabase
      .from('pariciones')
      .select('caravana_color, caravana_numero')
      .eq('campo_id', campoId)
      .not('caravana_numero', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    const row = data?.[0];
    if (!row) return null;
    return {
      color: row.caravana_color ?? undefined,
      numero: row.caravana_numero ?? undefined,
      proximoSugerido: incrementarCaravana(row.caravana_numero),
    };
  }

  async contarPariciones(filtros: { desde?: string; usuarioEmail?: string }): Promise<number> {
    let q = this.supabase.from('pariciones').select('*', { count: 'exact', head: true });
    if (filtros.desde) q = q.gte('fecha', filtros.desde);
    if (filtros.usuarioEmail) q = q.eq('usuario_email', filtros.usuarioEmail);
    const { count, error } = await q;
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  async buscarCaravana(
    color: CaravanaColor,
    numero: string,
    excluirId?: string,
  ): Promise<ParicionRef | null> {
    let q = this.supabase
      .from('pariciones')
      .select('id, fecha, campo_id, usuario_email, evento')
      .eq('caravana_color', color)
      .eq('caravana_numero', numero);
    if (excluirId) q = q.neq('id', excluirId);
    const { data, error } = await q.limit(1);
    if (error) throw new Error(error.message);
    const row = data?.[0];
    if (!row) return null;
    return {
      id: row.id,
      fecha: row.fecha,
      campoId: row.campo_id,
      usuarioEmail: row.usuario_email,
      evento: row.evento,
    };
  }

  // ---------- Eventos (genérico) ----------

  async saveEvento(evento: Evento): Promise<Evento> {
    // PASO 1: validar que haya una sesión REAL de Supabase, no solo el cache
    // local del user. El cache lo populamos desde AsyncStorage al boot (para
    // evitar el bug del "cliente_id en saves"), pero eso NO garantiza JWT
    // válido. Si el JWT venció (default 1h, auto-refresh dura ~30 días),
    // el upsert falla con "JWT expired" y el caller piensa "ah, sin red".
    //
    // Acá fallamos rápido con un error tipado para que el caller pueda
    // ofrecer re-login en lugar de encolar como pending para siempre.
    const { data: sessionData } = await this.supabase.auth.getSession();
    if (!sessionData.session) {
      throw new SessionExpiredError('Tu sesión venció — volvé a iniciar sesión.');
    }

    // PASO 2: cliente_id requerido por las RLS policies — lo sacamos del usuario
    // logueado en cache (poblado al login o al boot).
    const user = await this.getCurrentUser();
    if (!user?.clienteId) {
      throw new SessionExpiredError('No se pudo resolver tu cliente — re-iniciá sesión.');
    }
    const table = tablaDeEvento(evento.tipo);

    // PASO 3: subir fotos al bucket fotos-eventos (migration 0013) y
    // reemplazar las URIs locales (file://...) por URLs públicas. Si
    // alguna foto falla, la URI local queda — el evento se guarda igual
    // y la foto se reintenta en el próximo save. Pariciones, Mortandad,
    // Pastoreo, Lluvias y Compras tienen `fotos?: string[]` opcional.
    let eventoConFotos = evento;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eventoCualquiera = evento as any;
    if (Array.isArray(eventoCualquiera.fotos) && eventoCualquiera.fotos.length > 0) {
      const tablaPhoto = table as 'pariciones' | 'mortandad' | 'pastoreo' | 'lluvias' | 'compras';
      const fotosSubidas = await uploadFotosSiHaceFalta(
        this.supabase,
        user.clienteId,
        tablaPhoto,
        evento.id,
        eventoCualquiera.fotos,
      );
      eventoConFotos = { ...evento, fotos: fotosSubidas } as Evento;
    }

    const row = eventoToRow(eventoConFotos, user.clienteId);
    const { error } = await this.supabase.from(table).upsert(row, { onConflict: 'id' });
    if (error) {
      // Errores de auth/RLS: marcamos como SessionExpired para que el caller
      // pueda ofrecer re-login en vez de quedarse colgado en pending.
      const msg = error.message || '';
      if (
        msg.toLowerCase().includes('jwt') ||
        msg.toLowerCase().includes('expired') ||
        msg.toLowerCase().includes('row-level security')
      ) {
        throw new SessionExpiredError(`Problema de sesión: ${msg}`);
      }
      throw new Error(`saveEvento(${evento.tipo}): ${msg}`);
    }
    return { ...eventoConFotos, syncState: 'synced' };
  }

  async listEventos(tipo: TipoEvento, filters: EventoFilters = {}): Promise<Evento[]> {
    const table = tablaDeEvento(tipo);
    // Pastoreo usa fecha_entrada en lugar de fecha
    const fechaCol = tipo === 'pastoreo' ? 'fecha_entrada' : 'fecha';

    // Función que arma la query con todos los filtros aplicados — la
    // llamamos por cada página para mantener los predicados.
    const buildQuery = () => {
      let q = this.supabase.from(table).select('*');
      if (filters.campoId) q = q.eq('campo_id', filters.campoId);
      if (filters.loteId) q = q.eq('lote_id', filters.loteId);
      if (filters.usuarioEmail) q = q.eq('usuario_email', filters.usuarioEmail);
      if (filters.desde) q = q.gte(fechaCol, filters.desde);
      if (filters.hasta) q = q.lte(fechaCol, filters.hasta);
      return q.order(fechaCol, { ascending: false });
    };

    // Si el caller pidió un limit explícito (ej. "últimos 50"), una sola
    // query alcanza — no necesitamos paginar.
    if (filters.limit) {
      const { data, error } = await buildQuery().limit(filters.limit);
      if (error) throw new Error(`listEventos(${tipo}): ${error.message}`);
      return (data ?? []).map((r: any) => rowParser(tipo)(r));
    }

    // PAGINACIÓN REAL:
    // Supabase aplica un límite por defecto de 1000 rows en .select(). Si la
    // tabla supera ese tamaño (Ganaderas tiene 2.5k+ pariciones), el query
    // truncaba silenciosamente y la app mostraba data parcial. El workaround
    // viejo de .range(0, 49999) NO funciona en todas las versiones del cliente
    // JS — sólo es respetado a veces. La forma confiable es iterar con
    // .range() por páginas hasta que llega menos del page size.
    const PAGE_SIZE = 1000;
    const out: any[] = [];
    let from = 0;
    // Tope de seguridad: 100k rows. Si alguna tabla llega a eso, tenemos un
    // problema de schema; mejor lanzar warning explícito.
    while (out.length < 100_000) {
      const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(`listEventos(${tipo}): ${error.message}`);
      if (!data || data.length === 0) break;
      out.push(...data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return out.map((r: any) => rowParser(tipo)(r));
  }

  // ---------- Pending queue (offline) ----------
  //
  // Cuando saveEvento falla por red, el Repository llama enqueuePending. Se
  // guarda en AsyncStorage local. Al volver la red, flushPending intenta
  // sincronizar todo.

  async enqueuePending(evento: Evento): Promise<void> {
    const pending = await this.listPending();
    // Reemplazar si el id ya estaba pendiente (re-edit antes de sincronizar)
    const next = [...pending.filter(e => e.id !== evento.id), evento];
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(next));
  }

  async listPending(): Promise<Evento[]> {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  }

  async flushPending(): Promise<FlushResult> {
    const pending = await this.listPending();
    const errors: Array<{ id: string; error: string }> = [];
    let exitosos = 0;
    let fallidos = 0;
    const remaining: Evento[] = [];

    // Q4 audit: chunks de 8 en paralelo en lugar de iteración secuencial.
    // Antes con 50 eventos pending hacíamos 50 round-trips uno detrás de
    // otro — ahora son 7 round-trips de hasta 8 en paralelo. El límite de
    // 8 lo elegimos para no saturar la conexión móvil del operario; podemos
    // subirlo en wifi/lan pero no detectamos eso desde RN.
    const CHUNK = 8;
    for (let i = 0; i < pending.length; i += CHUNK) {
      const slice = pending.slice(i, i + CHUNK);
      const results = await Promise.allSettled(slice.map(e => this.saveEvento(e)));
      results.forEach((r, idx) => {
        const e = slice[idx]!; // length matches — siempre definido
        if (r.status === 'fulfilled') {
          exitosos++;
        } else {
          fallidos++;
          const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
          errors.push({ id: e.id, error: msg });
          remaining.push(e);
        }
      });
    }
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(remaining));
    return { intentados: pending.length, exitosos, fallidos, errores: errors };
  }
}

// =============================================================================
// Utilidades internas
// =============================================================================

function tablaDeEvento(tipo: TipoEvento): string {
  switch (tipo) {
    case 'paricion':  return 'pariciones';
    case 'lluvia':    return 'lluvias';
    case 'mortandad': return 'mortandad';
    case 'pastoreo':  return 'pastoreo';
    case 'compra':    return 'compras';
    case 'medicion':  return 'mediciones';  // FUTURO
  }
}

function rowParser(tipo: TipoEvento): (r: any) => Evento {
  switch (tipo) {
    case 'paricion':  return rowToParicion;
    case 'lluvia':    return rowToLluvia;
    case 'mortandad': return rowToMortandad;
    case 'pastoreo':  return rowToPastoreo;
    case 'compra':    return rowToCompra;
    case 'medicion':  return (r) => r as Evento;  // FUTURO
  }
}

function eventoToRow(e: Evento, clienteId: string): any {
  switch (e.tipo) {
    case 'paricion':  return paricionToRow(e as Paricion, clienteId);
    case 'lluvia':    return lluviaToRow(e, clienteId);
    case 'mortandad': return mortandadToRow(e, clienteId);
    case 'pastoreo':  return pastoreoToRow(e, clienteId);
    case 'compra':    return compraToRow(e, clienteId);
    case 'medicion':  return { ...e, cliente_id: clienteId };
  }
}

function incrementarCaravana(num?: string | null): string | undefined {
  if (!num || !/^\d+$/.test(num)) return undefined;
  const n = parseInt(num, 10) + 1;
  return String(n).padStart(num.length, '0');
}
