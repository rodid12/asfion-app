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
  Evento,
  Lote,
  Parcela,
  Paricion,
  Pluviometro,
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

// =============================================================================
// Helpers de mapeo DB <-> TS (snake_case <-> camelCase)
// =============================================================================
// Postgres usa snake_case por convención; TS usa camelCase. Mapeamos a mano
// (no usamos un ORM porque el shape es chico y queremos control total).

function rowToCampo(r: any): Campo {
  return {
    id: r.id,
    nombre: r.nombre,
    organizacionId: r.organizacion_id ?? '',
    stockInicialVacas: r.stock_inicial_vacas ?? undefined,
  };
}

function rowToLote(r: any): Lote {
  return { id: r.id, campoId: r.campo_id, nombre: r.nombre };
}

function rowToPluviometro(r: any): Pluviometro {
  return { id: r.id, campoId: r.campo_id, nombre: r.nombre };
}

function rowToCircuito(r: any): Circuito {
  return { id: r.id, campoId: r.campo_id, nombre: r.nombre, hectareas: r.hectareas };
}

function rowToParcela(r: any): Parcela {
  return { id: r.id, circuitoId: r.circuito_id, numero: r.numero, hectareas: r.hectareas };
}

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

function rowToParicion(r: any): Paricion {
  return {
    tipo: 'paricion',
    id: r.id,
    fecha: r.fecha,
    campoId: r.campo_id,
    loteId: r.lote_id ?? undefined,
    usuarioEmail: r.usuario_email,
    vacasGrupo: r.vacas_grupo,
    evento: r.evento,
    sexo: r.sexo ?? undefined,
    asistencia: r.asistencia ?? undefined,
    caravanaColor: r.caravana_color ?? undefined,
    caravanaNumero: r.caravana_numero ?? undefined,
    causaTipo: r.causa_tipo ?? undefined,
    causaDetalle: r.causa_detalle ?? undefined,
    observaciones: r.observaciones ?? undefined,
    gps: gpsFromRow(r),
    fotos: r.fotos ?? undefined,
    createdAt: r.created_at,
    syncState: 'synced',
  };
}

function rowToLluvia(r: any): Evento {
  return {
    tipo: 'lluvia',
    id: r.id,
    fecha: r.fecha,
    campoId: r.campo_id,
    pluviometroId: r.pluviometro_id ?? undefined,
    loteId: undefined,
    usuarioEmail: r.usuario_email,
    pluviometro: r.pluviometro_nombre ?? '',
    milimetros: Number(r.milimetros),
    createdAt: r.created_at,
    syncState: 'synced',
  };
}

function rowToMortandad(r: any): Evento {
  return {
    tipo: 'mortandad',
    id: r.id,
    fecha: r.fecha,
    campoId: r.campo_id,
    loteId: r.lote_id ?? undefined,
    usuarioEmail: r.usuario_email,
    categoria: r.categoria,
    actividad: r.actividad ?? undefined,
    causaTipo: r.causa_tipo ?? undefined,
    causaDetalle: r.causa_detalle ?? undefined,
    caravanaColor: r.caravana_color ?? undefined,
    caravanaNumero: r.caravana_numero ?? undefined,
    observaciones: r.observaciones ?? undefined,
    gps: gpsFromRow(r),
    fotos: r.fotos ?? undefined,
    createdAt: r.created_at,
    syncState: 'synced',
  };
}

function rowToPastoreo(r: any): Evento {
  return {
    tipo: 'pastoreo',
    id: r.id,
    fecha: r.fecha_entrada,
    fechaSalida: r.fecha_salida ?? undefined,
    campoId: r.campo_id,
    circuitoId: r.circuito_id,
    parcelaId: r.parcela_id,
    parcelaNumero: r.parcela_numero ?? undefined,
    usuarioEmail: r.usuario_email,
    categoria: r.categoria,
    evento: r.evento ?? undefined,
    categoriaAnimal: r.categoria_animal ?? undefined,
    caravanaNumero: r.caravana_numero ?? undefined,
    causa: r.causa ?? undefined,
    // Migration 0003 — datos productivos
    animales:   r.animales    != null ? Number(r.animales)    : undefined,
    kgPromedio: r.kg_promedio != null ? Number(r.kg_promedio) : undefined,
    createdAt: r.created_at,
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

  // ---------- Catálogos ----------

  async listCampos(): Promise<Campo[]> {
    const { data, error } = await this.supabase
      .from('campos')
      .select('*')
      .order('nombre');
    if (error) throw new Error(error.message);
    return (data ?? []).map(rowToCampo);
  }

  async listLotes(campoId: string): Promise<Lote[]> {
    const { data, error } = await this.supabase
      .from('lotes')
      .select('*')
      .eq('campo_id', campoId)
      .order('nombre');
    if (error) throw new Error(error.message);
    return (data ?? []).map(rowToLote);
  }

  async listPluviometros(campoId: string): Promise<Pluviometro[]> {
    const { data, error } = await this.supabase
      .from('pluviometros')
      .select('*')
      .eq('campo_id', campoId)
      .order('nombre');
    if (error) throw new Error(error.message);
    return (data ?? []).map(rowToPluviometro);
  }

  async listCircuitos(campoId: string): Promise<Circuito[]> {
    const { data, error } = await this.supabase
      .from('circuitos')
      .select('*')
      .eq('campo_id', campoId)
      .order('nombre');
    if (error) throw new Error(error.message);
    return (data ?? []).map(rowToCircuito);
  }

  async listParcelas(circuitoId: string): Promise<Parcela[]> {
    const { data, error } = await this.supabase
      .from('parcelas')
      .select('*')
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
    const row = eventoToRow(evento, user.clienteId);
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
    return { ...evento, syncState: 'synced' };
  }

  async listEventos(tipo: TipoEvento, filters: EventoFilters = {}): Promise<Evento[]> {
    const table = tablaDeEvento(tipo);
    let q = this.supabase.from(table).select('*');
    if (filters.campoId) q = q.eq('campo_id', filters.campoId);
    if (filters.loteId) q = q.eq('lote_id', filters.loteId);
    if (filters.usuarioEmail) q = q.eq('usuario_email', filters.usuarioEmail);
    // Pastoreo usa fecha_entrada en lugar de fecha
    const fechaCol = tipo === 'pastoreo' ? 'fecha_entrada' : 'fecha';
    if (filters.desde) q = q.gte(fechaCol, filters.desde);
    if (filters.hasta) q = q.lte(fechaCol, filters.hasta);
    q = q.order(fechaCol, { ascending: false });
    if (filters.limit) q = q.limit(filters.limit);
    const { data, error } = await q;
    if (error) throw new Error(`listEventos(${tipo}): ${error.message}`);
    return (data ?? []).map((r: any) => rowParser(tipo)(r));
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
    for (const e of pending) {
      try {
        await this.saveEvento(e);
        exitosos++;
      } catch (err) {
        fallidos++;
        errors.push({ id: e.id, error: err instanceof Error ? err.message : String(err) });
        remaining.push(e);
      }
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
    case 'medicion':  return 'mediciones';  // FUTURO
  }
}

function rowParser(tipo: TipoEvento): (r: any) => Evento {
  switch (tipo) {
    case 'paricion':  return rowToParicion;
    case 'lluvia':    return rowToLluvia;
    case 'mortandad': return rowToMortandad;
    case 'pastoreo':  return rowToPastoreo;
    case 'medicion':  return (r) => r as Evento;  // FUTURO
  }
}

function eventoToRow(e: Evento, clienteId: string): any {
  switch (e.tipo) {
    case 'paricion':  return paricionToRow(e as Paricion, clienteId);
    case 'lluvia':    return lluviaToRow(e, clienteId);
    case 'mortandad': return mortandadToRow(e, clienteId);
    case 'pastoreo':  return pastoreoToRow(e, clienteId);
    case 'medicion':  return { ...e, cliente_id: clienteId };
  }
}

function incrementarCaravana(num?: string | null): string | undefined {
  if (!num || !/^\d+$/.test(num)) return undefined;
  const n = parseInt(num, 10) + 1;
  return String(n).padStart(num.length, '0');
}
