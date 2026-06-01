// client.ts — capa de compatibilidad.
//
// Antes este archivo era la fuente única de branding (clientBranding). Ahora
// migra a la nueva abstracción ClientConfig (ver types.ts + active.ts).
//
// Mantengo este export `clientBranding` por compatibilidad — muchos imports
// existentes (HomeScreen, LoginScreen) lo usan así. Internamente delega al
// branding del cliente activo.
//
// Para código NUEVO: usá `useClientConfig()` del ClientConfigContext en lugar
// de importar directo de acá. Eso permite tests, mocking, y eventualmente
// override desde Supabase.

import { ACTIVE_CONFIG } from './active';
import type { ClientBranding } from './types';

/** Branding del cliente activo. Equivalente a `useClientConfig().branding`,
 *  pero accesible fuera de componentes React (ej. constantes de seed). */
export const clientBranding: ClientBranding = ACTIVE_CONFIG.branding;

/** Deriva las iniciales del nombre del cliente: "Estancia San Julián" → "SJ". */
export function iniciales(nombre: string): string {
  const palabras = nombre
    .replace(/[\[\]()]/g, '')
    .split(/\s+/)
    .filter(p => p.length > 0 && !['de', 'del', 'la', 'las', 'los', 'y'].includes(p.toLowerCase()));

  const palabrasReales = palabras.filter(
    p => !['estancia', 'campo', 'el', 'los'].includes(p.toLowerCase()),
  );
  const src = palabrasReales.length > 0 ? palabrasReales : palabras;

  if (src.length === 0) return 'C';
  if (src.length === 1) return (src[0] ?? '').slice(0, 2).toUpperCase();
  return ((src[0] ?? '')[0] ?? '').toUpperCase() + ((src[1] ?? '')[0] ?? '').toUpperCase();
}
