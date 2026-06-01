// InMemoryBackend: implementación que vive en RAM.
// Sirve para:
//  - dev local sin configurar nada
//  - tests unitarios
//  - demo rápida en la notebook sin backend real
//
// Persiste a AsyncStorage para que los datos sobrevivan a un reload de la app.

import AsyncStorage from '@react-native-async-storage/async-storage';
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
  UltimaCaravana,
} from '../repository';
import {
  GANADERAS_CAMPOS,
  GANADERAS_LOTES,
  GANADERAS_PLUVIOMETROS,
  GANADERAS_CIRCUITOS,
  GANADERAS_PARCELAS,
  GANADERAS_PARICIONES,
  GANADERAS_LLUVIAS,
  GANADERAS_PASTOREOS,
  GANADERAS_MORTANDADES,
} from '../seed/ganaderas';

// v2: bumpamos la key de storage cuando cambia el shape del DB para que la
// app borre el cache viejo y reseed con datos reales del cliente.
const STORAGE_KEY = 'asfion.memory.v2';

/**
 * Dado un número de caravana como "0201", devuelve "0202".
 * Si no es numérico (ej "JT764O504"), devuelve undefined — no sugerimos.
 */
function incrementarCaravana(num?: string): string | undefined {
  if (!num) return undefined;
  if (!/^\d+$/.test(num)) return undefined;
  const n = parseInt(num, 10) + 1;
  return String(n).padStart(num.length, '0');
}

interface DBShape {
  currentUser: Usuario | null;
  campos: Campo[];
  lotes: Lote[];
  pluviometros: Pluviometro[];
  circuitos: Circuito[];
  parcelas: Parcela[];
  eventos: Evento[];
  pending: Evento[];
}

// emptyDB ahora seedea con datos REALES del cliente Ganaderas (extraídos
// del Excel del AppSheet). 9 campos, 101 lotes, 34 pluviómetros, 28
// circuitos, 82 parcelas, ~3260 eventos transaccionales históricos.
//
// Cuando cambiemos a Supabase, este seed se mueve al backend de Supabase
// como "data inicial" para el cliente Ganaderas y los demás backends quedan
// vacíos.
const emptyDB = (): DBShape => ({
  currentUser: null,
  campos: GANADERAS_CAMPOS,
  lotes: GANADERAS_LOTES,
  pluviometros: GANADERAS_PLUVIOMETROS,
  circuitos: GANADERAS_CIRCUITOS,
  parcelas: GANADERAS_PARCELAS,
  eventos: [
    ...GANADERAS_PARICIONES,
    ...GANADERAS_LLUVIAS,
    ...GANADERAS_PASTOREOS,
    ...GANADERAS_MORTANDADES,
  ],
  pending: [],
});

// Mapa email → campo asignado (extraído de los datos reales del xlsx).
// Sirve para preseleccionar el campo del operario cuando entra al form.
const USUARIO_CAMPO: Record<string, string> = {
  'nelsonisidrolopez2025@gmail.com':   'campo-quirquincho',
  'alejandromiguel9087@gmail.com':     'campo-progreso',
  'emilianogabrielzerpa5@gmail.com':   'campo-carolina',
  'ruedaroberto431@gmail.com':         'campo-picaflor',
  'luisfernandocarranza155@gmail.com': 'campo-picaflor',
  'armandocollante15@gmail.com':       'campo-quirquincho',
};

// Mapa email → {nombre, apellido} para mostrar nombre real en HomeScreen
// y en las cards de listado (en lugar del prefijo del email).
//
// En producción esto vendría de la tabla usuarios en Supabase. Acá es seed
// con los nombres reales del cliente Ganaderas.
const USUARIO_PERFIL: Record<string, { nombre: string; apellido: string }> = {
  'agusufi20@gmail.com':               { nombre: 'Agustín',  apellido: 'Sufi' },
  'nelsonisidrolopez2025@gmail.com':   { nombre: 'Nelson',   apellido: 'López' },
  'alejandromiguel9087@gmail.com':     { nombre: 'Alejandro', apellido: 'Miguel' },
  'emilianogabrielzerpa5@gmail.com':   { nombre: 'Emiliano', apellido: 'Zerpa' },
  'ruedaroberto431@gmail.com':         { nombre: 'Roberto',  apellido: 'Rueda' },
  'luisfernandocarranza155@gmail.com': { nombre: 'Luis',     apellido: 'Carranza' },
  'armandocollante15@gmail.com':       { nombre: 'Armando',  apellido: 'Collante' },
};

/**
 * Para emails que no estén en USUARIO_PERFIL, deriva un nombre razonable a
 * partir del prefijo del email (capitalizado). Mejor que mostrar "agusufi20".
 */
function nombreFallback(email: string): string {
  const local = email.split('@')[0] ?? email;
  const first = local.split(/[.\-_]/)[0] ?? local;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

// seedLotes() removida — los lotes ahora vienen del seed real de Ganaderas
// (GANADERAS_LOTES en src/data/seed/ganaderas.ts).

export class InMemoryBackend implements IDataBackend {
  readonly name = 'memory';
  private db: DBShape = emptyDB();
  private loaded = false;

  private async load() {
    if (this.loaded) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) this.db = JSON.parse(raw);
    } catch {
      this.db = emptyDB();
    }
    this.loaded = true;
  }

  private async persist() {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.db));
  }

  async login(email: string, _password: string): Promise<Usuario> {
    await this.load();
    // demo: cualquier email/password funciona; rol se infiere
    const rol: Usuario['rol'] =
      email.includes('admin')     ? 'administrador'
      : email.includes('moderador') ? 'moderador'
      : 'operario';
    // Si el email matchea uno conocido del xlsx, usamos su campo asignado.
    // Si no, el operario va a tener que seleccionar manualmente la primera vez.
    const campoAsignadoId = USUARIO_CAMPO[email];
    // Nombre real desde el catálogo USUARIO_PERFIL (ej. "Agustín" para
    // agusufi20@gmail.com). Si no está en el catálogo, derivamos del email.
    const perfil = USUARIO_PERFIL[email];
    const nombre = perfil?.nombre ?? nombreFallback(email);
    const apellido = perfil?.apellido;
    // En el mock InMemory todos los usuarios son del mismo cliente (Ganaderas).
    // En SupabaseBackend, el clienteId viene de la tabla usuarios.cliente_id.
    const user: Usuario = { email, rol, nombre, apellido, clienteId: 'ganaderas', campos: [], campoAsignadoId };
    this.db.currentUser = user;
    await this.persist();
    return user;
  }

  async getCurrentUser() {
    await this.load();
    return this.db.currentUser;
  }

  async logout() {
    await this.load();
    this.db.currentUser = null;
    await this.persist();
  }

  async listCampos() {
    await this.load();
    return [...this.db.campos];
  }

  async listLotes(campoId: string) {
    await this.load();
    return this.db.lotes.filter(l => l.campoId === campoId);
  }

  async listPluviometros(campoId: string) {
    await this.load();
    return this.db.pluviometros.filter(p => p.campoId === campoId);
  }

  async listCircuitos(campoId: string) {
    await this.load();
    return this.db.circuitos.filter(c => c.campoId === campoId);
  }

  async listParcelas(circuitoId: string) {
    await this.load();
    return this.db.parcelas
      .filter(p => p.circuitoId === circuitoId)
      .sort((a, b) => a.numero - b.numero);
  }

  async ultimaCaravana(campoId: string): Promise<UltimaCaravana | null> {
    await this.load();
    // Buscar la última parición con caravana en ese campo (lo más reciente
    // por createdAt, que es cuando se cargó — más confiable que la fecha del evento).
    const pariciones = this.db.eventos
      .filter((e): e is Paricion => e.tipo === 'paricion' && e.campoId === campoId)
      .filter(p => p.caravanaNumero || p.caravanaColor)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const ultima = pariciones[0];
    if (!ultima) return null;
    return {
      color: ultima.caravanaColor,
      numero: ultima.caravanaNumero,
      proximoSugerido: incrementarCaravana(ultima.caravanaNumero),
    };
  }

  async buscarCaravana(color: CaravanaColor, numero: string, excluirId?: string) {
    await this.load();
    // Búsqueda case-sensitive en número (porque "0200" ≠ "JT764O504"),
    // pero color es enum estricto.
    const match = this.db.eventos
      .filter((e): e is Paricion => e.tipo === 'paricion')
      .filter(p => p.id !== excluirId)
      .find(p => p.caravanaColor === color && p.caravanaNumero === numero);
    if (!match) return null;
    return {
      id: match.id,
      fecha: match.fecha,
      campoId: match.campoId,
      usuarioEmail: match.usuarioEmail,
      evento: match.evento,
    };
  }

  async contarPariciones(filtros: { desde?: string; usuarioEmail?: string }): Promise<number> {
    await this.load();
    return this.db.eventos.filter(e => {
      if (e.tipo !== 'paricion') return false;
      if (filtros.desde && e.fecha < filtros.desde) return false;
      if (filtros.usuarioEmail && e.usuarioEmail !== filtros.usuarioEmail) return false;
      return true;
    }).length;
  }

  async saveEvento(evento: Evento): Promise<Evento> {
    await this.load();
    // upsert por id
    const idx = this.db.eventos.findIndex(e => e.id === evento.id);
    const stored: Evento = { ...evento, syncState: 'synced' };
    if (idx >= 0) this.db.eventos[idx] = stored;
    else this.db.eventos.push(stored);
    // si estaba en pending, sacarlo
    this.db.pending = this.db.pending.filter(e => e.id !== evento.id);
    await this.persist();
    return stored;
  }

  async listEventos(tipo: TipoEvento, f: EventoFilters = {}): Promise<Evento[]> {
    await this.load();
    let result = this.db.eventos.filter(e => e.tipo === tipo);
    if (f.campoId) result = result.filter(e => e.campoId === f.campoId);
    if (f.loteId) result = result.filter(e => e.loteId === f.loteId);
    if (f.usuarioEmail) result = result.filter(e => e.usuarioEmail === f.usuarioEmail);
    if (f.desde) result = result.filter(e => e.fecha >= f.desde!);
    if (f.hasta) result = result.filter(e => e.fecha <= f.hasta!);
    result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (f.limit) result = result.slice(0, f.limit);
    return result;
  }

  async enqueuePending(evento: Evento) {
    await this.load();
    const idx = this.db.pending.findIndex(e => e.id === evento.id);
    if (idx >= 0) this.db.pending[idx] = evento;
    else this.db.pending.push(evento);
    await this.persist();
  }

  async listPending() {
    await this.load();
    return [...this.db.pending];
  }

  async flushPending(): Promise<FlushResult> {
    await this.load();
    const pending = [...this.db.pending];
    const errores: FlushResult['errores'] = [];
    let exitosos = 0;
    for (const ev of pending) {
      try {
        await this.saveEvento(ev);
        exitosos++;
      } catch (err) {
        errores.push({ id: ev.id, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return {
      intentados: pending.length,
      exitosos,
      fallidos: errores.length,
      errores,
    };
  }
}
