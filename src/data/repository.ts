// Repository pattern. Los screens NUNCA hablan con Sheets ni con Supabase directo.
// Siempre pasan por acá. Eso nos permite cambiar el backend sin tocar la UI.

import type { CaravanaColor, Campo, Circuito, Evento, Lote, Parcela, Pastoreo, Pluviometro, Subscription, TipoEvento, Usuario } from './types';
import { isSessionExpiredError, looksLikeRlsBlock, SubscriptionBlockedError } from './backends/supabase';

/** Última caravana cargada en un campo — alimenta el autocomplete del form. */
export interface UltimaCaravana {
  color?: CaravanaColor;
  numero?: string;
  /** Próximo número sugerido (ej: si la última fue "0201" → "0202"). */
  proximoSugerido?: string;
}

/** Referencia mínima a una parición existente — para la alerta de duplicado. */
export interface ParicionRef {
  id: string;
  fecha: string;
  campoId: string;
  usuarioEmail: string;
  evento: string;
}

/**
 * Contrato que debe implementar cualquier backend (Sheets, Supabase, memoria).
 * Si aparece un nuevo backend, implementa esta interface y listo.
 */
export interface IDataBackend {
  readonly name: string;

  // Auth / usuarios
  login(email: string, password: string): Promise<Usuario>;
  getCurrentUser(): Promise<Usuario | null>;
  logout(): Promise<void>;
  /**
   * Prime el cache de usuario en el backend (opcional).
   * Necesario en Supabase: el saveEvento lee cliente_id del cache. Si la app
   * arranca con un user persistido en AsyncStorage pero el backend nunca
   * ejecutó login() ni getCurrentUser(), el cache está vacío y el primer save
   * tira "usuario sin clienteId". AuthProvider llama esto al bootstrap.
   */
  setCurrentUser?(user: Usuario | null): void;

  // Subscription / billing — estado del cliente para enforcement de cobranza.
  getSubscription(): Promise<Subscription>;

  // Catálogos
  listCampos(): Promise<Campo[]>;
  listLotes(campoId: string): Promise<Lote[]>;
  listPluviometros(campoId: string): Promise<Pluviometro[]>;
  listCircuitos(campoId: string): Promise<Circuito[]>;
  listParcelas(circuitoId: string): Promise<Parcela[]>;

  // Helpers para el form
  ultimaCaravana(campoId: string): Promise<UltimaCaravana | null>;
  contarPariciones(filtros: { desde?: string; usuarioEmail?: string }): Promise<number>;
  /**
   * Busca si ya existe una parición con esta combinación (color, número).
   * Scope: global dentro de los campos visibles al usuario actual.
   * Devuelve null si no hay colisión. Si hay, devuelve el registro previo
   * para que el UI pueda mostrar "ya cargada el día X por Y".
   */
  buscarCaravana(caravanaColor: CaravanaColor, caravanaNumero: string, excluirId?: string): Promise<ParicionRef | null>;

  // Eventos (genérico)
  saveEvento(evento: Evento): Promise<Evento>;
  listEventos(tipo: TipoEvento, filters?: EventoFilters): Promise<Evento[]>;

  // Sync queue — para eventos cargados offline
  enqueuePending(evento: Evento): Promise<void>;
  listPending(): Promise<Evento[]>;
  flushPending(): Promise<FlushResult>;
}

export interface EventoFilters {
  campoId?: string;
  loteId?: string;
  desde?: string;  // ISO date
  hasta?: string;
  usuarioEmail?: string;
  limit?: number;
}

export interface FlushResult {
  intentados: number;
  exitosos: number;
  fallidos: number;
  errores: Array<{ id: string; error: string }>;
}

/**
 * Repository: wrapper fino sobre el backend.
 * Lugar donde vive la lógica de negocio que no depende del storage concreto:
 * - validaciones previas al save
 * - encolar offline
 * - intentar sync en segundo plano
 * - métricas y logging
 *
 * Los screens instancian UNA copia del repository (via contexto) y le llaman acá.
 */
export class Repository {
  constructor(private backend: IDataBackend) {}

  get backendName() {
    return this.backend.name;
  }

  // Cache in-memory para listEventos. Sobrevive a unmounts/remounts de los
  // screens (vive en el Repository singleton que está en el contexto raíz).
  //
  // Uso: la lista llama listEventosCached() en useState() para mostrar la
  // última copia conocida inmediatamente, y dispara listEventos() en
  // background para refrescar. Resultado: no se ve más el spinner cada
  // vez que volvés a la tab, salvo en el primer arranque del día.
  private listCache = new Map<string, Evento[]>();

  private cacheKey(tipo: TipoEvento, filters?: EventoFilters): string {
    return JSON.stringify([tipo, filters ?? {}]);
  }

  /** Devuelve la última copia cacheada (sincrónico, sin red). undefined si nunca cargó. */
  listEventosCached(tipo: TipoEvento, filters?: EventoFilters): Evento[] | undefined {
    return this.listCache.get(this.cacheKey(tipo, filters));
  }

  /** Invalida el cache de un tipo de evento (todos los filtros). Útil post-save. */
  invalidateEventoCache(tipo: TipoEvento) {
    const prefix = `["${tipo}"`;
    for (const k of this.listCache.keys()) {
      if (k.startsWith(prefix)) this.listCache.delete(k);
    }
  }

  // Auth passthroughs
  login = (email: string, password: string) => this.backend.login(email, password);
  getCurrentUser = () => this.backend.getCurrentUser();
  logout = () => this.backend.logout();
  setCurrentUser = (user: Usuario | null) => this.backend.setCurrentUser?.(user);

  // Subscription / billing
  getSubscription = () => this.backend.getSubscription();

  // Catálogos
  listCampos = () => this.backend.listCampos();
  listLotes = (campoId: string) => this.backend.listLotes(campoId);
  listPluviometros = (campoId: string) => this.backend.listPluviometros(campoId);
  listCircuitos = (campoId: string) => this.backend.listCircuitos(campoId);
  listParcelas = (circuitoId: string) => this.backend.listParcelas(circuitoId);

  // Helpers para el form
  ultimaCaravana = (campoId: string) => this.backend.ultimaCaravana(campoId);
  contarPariciones = (filtros: { desde?: string; usuarioEmail?: string }) =>
    this.backend.contarPariciones(filtros);
  buscarCaravana = (color: CaravanaColor, numero: string, excluirId?: string) =>
    this.backend.buscarCaravana(color, numero, excluirId);

  /**
   * Intenta guardar el evento online. Si falla por red, lo encola.
   * El caller siempre recibe una respuesta rápida — la app nunca bloquea al peón.
   */
  async saveEvento(evento: Evento): Promise<Evento> {
    validar(evento);
    try {
      const saved = await this.backend.saveEvento({ ...evento, syncState: 'syncing' });
      // Invalidamos el cache del tipo guardado — la próxima lista refleja
      // el cambio sin esperar al refresh background.
      this.invalidateEventoCache(evento.tipo);
      return { ...saved, syncState: 'synced' };
    } catch (err) {
      // Si la sesión venció, NO encolamos — la cola crece infinita porque
      // cada reintento va a tirar el mismo error. Devolvemos al caller para
      // que ofrezca re-login.
      if (isSessionExpiredError(err)) {
        throw err;
      }
      // Si fue un bloqueo de RLS (típicamente: subscription en mora), tampoco
      // encolamos — el reintento va a fallar hasta que regularicen el pago.
      // Lo elevamos como SubscriptionBlockedError para que la UI muestre un
      // mensaje claro en vez del "pending" típico de errores de red.
      const msg = err instanceof Error ? err.message : String(err);
      if (looksLikeRlsBlock(msg)) {
        throw new SubscriptionBlockedError(
          'No se puede cargar este evento: la cuenta está en mora. Regularizá el pago para volver a cargar datos.',
        );
      }
      const pending: Evento = {
        ...evento,
        syncState: 'pending',
        syncError: err instanceof Error ? err.message : String(err),
      };
      await this.backend.enqueuePending(pending);
      this.invalidateEventoCache(evento.tipo);
      return pending;
    }
  }

  listEventos = async (tipo: TipoEvento, filters?: EventoFilters): Promise<Evento[]> => {
    const evs = await this.backend.listEventos(tipo, filters);
    this.listCache.set(this.cacheKey(tipo, filters), evs);
    return evs;
  };

  /**
   * Pastoreo: auto-cierra el "stay" abierto previo cuando se carga uno nuevo
   * en la MISMA parcela.
   *
   * Cambio respecto del modelo anterior: antes el match era por caravana
   * (caravanaColor + caravanaNumero). Ahora el match es por parcela (parcelaId)
   * porque en el modelo real del cliente la caravana es opcional y casi nunca
   * se carga — el "lugar físico" es la unidad básica.
   *
   * Se llama desde el form solo en CREATE (no edit) — el caller decide.
   */
  async cerrarPastoreoAbiertoEnParcela(
    parcelaId: string,
    fechaSalida: string,
    exceptId?: string,
  ): Promise<Pastoreo | null> {
    const eventos = (await this.backend.listEventos('pastoreo')) as Pastoreo[];
    const abierto = eventos.find(p =>
      !p.fechaSalida &&
      p.parcelaId === parcelaId &&
      p.id !== exceptId,
    );
    if (!abierto) return null;
    const cerrado: Pastoreo = { ...abierto, fechaSalida, syncState: 'pending' };
    await this.backend.saveEvento(cerrado);
    return cerrado;
  }

  listPending = () => this.backend.listPending();
  flushPending = () => this.backend.flushPending();
}

/** Validaciones mínimas. Acá agregamos reglas de negocio que apliquen a cualquier backend. */
function validar(e: Evento) {
  if (!e.id) throw new Error('Evento sin id');
  if (!e.fecha) throw new Error('Evento sin fecha');
  if (!e.campoId) throw new Error('Evento sin campo');
  if (!e.usuarioEmail) throw new Error('Evento sin usuario');

  if (e.tipo === 'lluvia') {
    if (e.milimetros < 0 || e.milimetros > 500) {
      throw new Error('Milímetros fuera de rango razonable (0-500)');
    }
    if (!e.pluviometro) throw new Error('Falta pluviómetro');
  }

  if (e.tipo === 'pastoreo') {
    // Modelo nuevo: identificado por circuito+parcela, no por caravana.
    if (!e.circuitoId) throw new Error('Falta circuito (pastoreo)');
    if (!e.parcelaId) throw new Error('Falta parcela (pastoreo)');
    if (!e.categoria) throw new Error('Falta categoría (pastoreo)');
    if (e.fechaSalida && e.fechaSalida < e.fecha) {
      throw new Error('Fecha de salida anterior a la de entrada');
    }
  }

  if (e.tipo === 'paricion') {
    // causa: opcional, warning suave, no bloqueamos. Schema v0.3 usa causaTipo + causaDetalle.
    // Sexo: obligatorio salvo para Aborto y Retacto (Retacto = re-chequeo de preñez, no parto).
    if (e.evento === 'Nacimiento' && !e.sexo) {
      throw new Error('Falta sexo para nacimiento');
    }
    if (e.evento === 'Muerte' && !e.sexo) {
      throw new Error('Falta sexo para muerte');
    }
  }
}
