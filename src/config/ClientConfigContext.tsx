// ClientConfigContext — provee la config del cliente activo al árbol de
// componentes. Los screens consumen vía useClientConfig().
//
// Implementación (runtime, post-0014):
//
//   1. Al boot, intentamos leer cache de AsyncStorage (`asfion:cliente-config:<id>`).
//      Si hay, lo usamos inmediatamente para que la UI no muestre la fallback.
//   2. En paralelo, hacemos fetch al row `clientes` del usuario logueado.
//      Cuando llega, actualizamos el state y persistimos el cache.
//   3. Si el fetch falla (offline / sin sesión / tabla no existe), fallback
//      al `ACTIVE_CONFIG` compile-time. Esto garantiza que la app no se
//      rompe nunca por config — siempre tiene algo razonable.
//
// El AuthProvider llama `refreshClienteConfig()` al login para forzar un
// re-fetch (el usuario puede haber cambiado de tenant entre logins).

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ACTIVE_CONFIG } from './active';
import type {
  ClientConfig,
  ClientCatalogos,
  ModuloKey,
  ParicionCatalogos,
  MortandadCatalogos,
  PastoreoCatalogos,
  CompraCatalogos,
} from './types';
import { useRepository } from '@/data';

const CACHE_PREFIX = 'asfion:cliente-config:';

interface ContextValue {
  config: ClientConfig;
  loading: boolean;
  error: string | null;
  /** Re-fetch desde Supabase. Lo llama AuthProvider al login. */
  refresh: () => Promise<void>;
}

const ClientConfigCtx = createContext<ContextValue>({
  config: ACTIVE_CONFIG,
  loading: false,
  error: null,
  refresh: async () => {},
});

interface ProviderProps {
  /** Override para tests / storybook. Si está, ignora el fetch. */
  config?: ClientConfig;
  children: React.ReactNode;
}

export function ClientConfigProvider({ config: override, children }: ProviderProps) {
  const repo = useRepository();
  const [config, setConfig] = useState<ClientConfig>(override ?? ACTIVE_CONFIG);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    if (override) return; // tests: nunca tocar el fetch
    setLoading(true);
    setError(null);
    try {
      // 1) Cache primero — paint rápido con la última config conocida.
      const user = await repo.getCurrentUser();
      const clienteId = user?.clienteId;
      if (clienteId) {
        try {
          const cached = await AsyncStorage.getItem(CACHE_PREFIX + clienteId);
          if (cached) {
            const parsed = JSON.parse(cached) as ClientConfig;
            setConfig(parsed);
          }
        } catch {
          // cache corrupto — lo ignoramos, fetch lo va a reemplazar
        }
      }

      // 2) Fetch fresco. El backend Supabase implementa getClienteConfig;
      //    backends viejos (Memory para dev) no, así que devolvemos null
      //    y el fallback es ACTIVE_CONFIG.
      const row = repo.getClienteConfig ? await repo.getClienteConfig() : null;
      if (!row) {
        // Sin row → quedamos con cache o ACTIVE_CONFIG. No es error.
        return;
      }

      const next = mapRowToClientConfig(row);
      setConfig(next);

      // 3) Persistir cache para el próximo boot.
      try {
        await AsyncStorage.setItem(CACHE_PREFIX + row.id, JSON.stringify(next));
      } catch {
        // best-effort, no es crítico
      }
    } catch (e: any) {
      setError(e?.message ?? 'Error al cargar config del cliente');
    } finally {
      setLoading(false);
    }
  }, [repo, override]);

  // Boot: trigger del fetch una vez al montar.
  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  const value = useMemo<ContextValue>(
    () => ({ config: override ?? config, loading, error, refresh: fetchConfig }),
    [config, loading, error, fetchConfig, override],
  );

  return <ClientConfigCtx.Provider value={value}>{children}</ClientConfigCtx.Provider>;
}

/** Hook principal — devuelve la config completa (igual contrato que antes). */
export function useClientConfig(): ClientConfig {
  return useContext(ClientConfigCtx).config;
}

/** Hook extendido — útil para mostrar spinners o errors a nivel app. */
export function useClientConfigState(): ContextValue {
  return useContext(ClientConfigCtx);
}

/** Helper para preguntar rápidamente si un módulo está habilitado. */
export function useModuloHabilitado(key: ModuloKey): boolean {
  const cfg = useClientConfig();
  return cfg.modulosHabilitados.includes(key);
}

// =============================================================================
// Mapping: row de Supabase → ClientConfig tipado
// =============================================================================

/** Toma el row crudo de `clientes` y lo mapea al tipo ClientConfig que
 *  espera el resto de la app. Si algún catálogo viene incompleto en el
 *  JSONB, completamos con valores razonables del ACTIVE_CONFIG fallback. */
function mapRowToClientConfig(row: {
  id: string;
  nombre: string;
  tagline?: string;
  logoUrl?: string;
  accentColor?: string;
  modulosHabilitados: string[];
  catalogos: Record<string, any>;
}): ClientConfig {
  const fallback = ACTIVE_CONFIG.catalogos;
  const c = row.catalogos ?? {};

  const catalogos: ClientCatalogos = {
    pariciones: pickParicionesCatalogo(c.pariciones, fallback.pariciones),
    mortandad:  pickMortandadCatalogo(c.mortandad,   fallback.mortandad),
    pastoreo:   pickPastoreoCatalogo(c.pastoreo,     fallback.pastoreo),
    compras:    pickComprasCatalogo(c.compras,       fallback.compras),
  };

  // El tipo ModuloKey es estricto; filtramos solo los valores conocidos
  // para que un módulo nuevo en la DB no rompa el typed contract acá.
  const MODULOS_VALIDOS: readonly ModuloKey[] = [
    'pariciones', 'lluvias', 'mortandad', 'pastoreo', 'compras', 'mediciones', 'ventas',
  ];
  const modulos: ModuloKey[] = row.modulosHabilitados
    .filter((m): m is ModuloKey => MODULOS_VALIDOS.includes(m as ModuloKey));

  return {
    id: row.id,
    branding: {
      nombre: row.nombre,
      tagline: row.tagline,
      logo: row.logoUrl ?? null,
      accentColor: row.accentColor,
    },
    modulosHabilitados: modulos,
    catalogos,
  };
}

function pickParicionesCatalogo(raw: any, fallback: ParicionCatalogos): ParicionCatalogos {
  return {
    vacasGrupos:      arrOr(raw?.vacasGrupos,      fallback.vacasGrupos),
    eventos:          arrOr(raw?.eventos,          fallback.eventos),
    sexos:            arrOr(raw?.sexos,            fallback.sexos),
    asistencia:       arrOr(raw?.asistencia,       fallback.asistencia),
    caravanaColores:  arrOr(raw?.caravanaColores,  fallback.caravanaColores),
    causaTipos:       arrOr(raw?.causaTipos,       fallback.causaTipos),
    causasFrecuentes: arrOr(raw?.causasFrecuentes, fallback.causasFrecuentes),
  };
}
function pickMortandadCatalogo(raw: any, fallback: MortandadCatalogos): MortandadCatalogos {
  return {
    categorias:  arrOr(raw?.categorias,  fallback.categorias),
    actividades: arrOr(raw?.actividades, fallback.actividades),
    causaTipos:  arrOr(raw?.causaTipos,  fallback.causaTipos),
  };
}
function pickPastoreoCatalogo(raw: any, fallback: PastoreoCatalogos): PastoreoCatalogos {
  return {
    categorias: arrOr(raw?.categorias, fallback.categorias),
    eventos:    arrOr(raw?.eventos,    fallback.eventos),
    catAnimal:  arrOr(raw?.catAnimal,  fallback.catAnimal),
  };
}
function pickComprasCatalogo(raw: any, fallback: CompraCatalogos): CompraCatalogos {
  return {
    actividades: arrOr(raw?.actividades, fallback.actividades),
    plazos:      arrOr(raw?.plazos,      fallback.plazos),
  };
}

/** Helper: devuelve el array `raw` si es un array de strings no vacío,
 *  o el `fallback`. Evita catálogos rotos cuando la DB tiene gaps. */
function arrOr(raw: any, fallback: readonly string[]): readonly string[] {
  return Array.isArray(raw) && raw.length > 0 && raw.every(x => typeof x === 'string')
    ? raw
    : fallback;
}
