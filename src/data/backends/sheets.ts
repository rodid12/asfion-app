// GoogleSheetsBackend — esqueleto.
//
// Estrategia:
//  - NO llamamos la Sheets API directo desde el mobile (complica auth y rate limits).
//  - Publicamos una Google Apps Script como Web App (doGet/doPost) que expone endpoints REST
//    y maneja el acceso al spreadsheet internamente.
//  - Este backend llama HTTP a esa Web App.
//
// Esto preserva el comportamiento actual (la data vive en Sheets → PowerBI sigue
// leyendo como hoy) pero desacopla la app del SDK de Sheets. El día que migremos
// a Supabase, solo cambiamos el backend — la URL de Apps Script muere, nace un SUPABASE_URL,
// y los contratos siguen idénticos.
//
// Este archivo es SKELETON. Los métodos retornan "not implemented" por ahora.
// Vamos a llenarlos cuando conectemos con el Apps Script real.

import type { Campo, CaravanaColor, Circuito, Evento, Lote, Parcela, Pluviometro, TipoEvento, Usuario } from '../types';
import type { EventoFilters, FlushResult, IDataBackend, ParicionRef, UltimaCaravana } from '../repository';

export interface SheetsBackendConfig {
  /** URL del despliegue de Google Apps Script como Web App. */
  webAppUrl: string;
  /** Token compartido que el Apps Script valida en cada request. */
  authToken: string;
}

export class GoogleSheetsBackend implements IDataBackend {
  readonly name = 'sheets';

  constructor(private config: SheetsBackendConfig) {}

  private async call<T>(action: string, payload?: unknown): Promise<T> {
    const res = await fetch(this.config.webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        token: this.config.authToken,
        payload,
      }),
    });
    if (!res.ok) throw new Error(`Sheets backend: ${res.status} ${res.statusText}`);
    const data = await res.json();
    if (data.error) throw new Error(`Sheets backend: ${data.error}`);
    return data.result as T;
  }

  login(email: string, password: string): Promise<Usuario> {
    return this.call<Usuario>('login', { email, password });
  }

  getCurrentUser(): Promise<Usuario | null> {
    // Token-based: el caller guarda el usuario en SecureStore tras login. Acá podrías
    // re-validar contra el server, pero no hace falta para MVP.
    throw new Error('GoogleSheetsBackend.getCurrentUser: implementar con SecureStore');
  }

  logout(): Promise<void> {
    return this.call<void>('logout');
  }

  listCampos(): Promise<Campo[]> {
    return this.call<Campo[]>('listCampos');
  }

  ultimaCaravana(campoId: string): Promise<UltimaCaravana | null> {
    return this.call<UltimaCaravana | null>('ultimaCaravana', { campoId });
  }

  contarPariciones(filtros: { desde?: string; usuarioEmail?: string }): Promise<number> {
    return this.call<number>('contarPariciones', filtros);
  }

  buscarCaravana(caravanaColor: CaravanaColor, caravanaNumero: string, excluirId?: string): Promise<ParicionRef | null> {
    return this.call<ParicionRef | null>('buscarCaravana', { caravanaColor, caravanaNumero, excluirId });
  }

  listLotes(campoId: string): Promise<Lote[]> {
    return this.call<Lote[]>('listLotes', { campoId });
  }

  listPluviometros(campoId: string): Promise<Pluviometro[]> {
    return this.call<Pluviometro[]>('listPluviometros', { campoId });
  }

  listCircuitos(campoId: string): Promise<Circuito[]> {
    return this.call<Circuito[]>('listCircuitos', { campoId });
  }

  listParcelas(circuitoId: string): Promise<Parcela[]> {
    return this.call<Parcela[]>('listParcelas', { circuitoId });
  }

  saveEvento(evento: Evento): Promise<Evento> {
    return this.call<Evento>('saveEvento', evento);
  }

  listEventos(tipo: TipoEvento, filters?: EventoFilters): Promise<Evento[]> {
    return this.call<Evento[]>('listEventos', { tipo, filters });
  }

  enqueuePending(_evento: Evento): Promise<void> {
    // El backend remoto no conoce de pending; el queue vive en el device.
    // Este método lo maneja el repository localmente, no el backend.
    throw new Error('enqueuePending no aplica a GoogleSheetsBackend — usar wrapper local');
  }

  listPending(): Promise<Evento[]> {
    throw new Error('listPending no aplica a GoogleSheetsBackend — usar wrapper local');
  }

  flushPending(): Promise<FlushResult> {
    throw new Error('flushPending no aplica a GoogleSheetsBackend — usar wrapper local');
  }
}
