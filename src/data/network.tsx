// Network status + auto-flush de la cola pending.
//
// El SupabaseBackend ya guarda en una cola local cuando un save falla por
// red. Pero alguien tiene que detectar "volvió la red" y disparar el flush
// — eso es lo que hace este componente.
//
// Uso:
//   1. Envolver el árbol con <NetworkProvider /> (en App.tsx, dentro del
//      RepositoryProvider).
//   2. El provider escucha cambios de connectivity con expo-network.
//   3. Cuando detecta transición offline → online, llama a repo.flushPending()
//      automáticamente.
//   4. Cualquier componente puede leer el estado con useNetworkStatus().
//
// Notas:
//   - El flush corre en background, sin bloquear la UI.
//   - Si falla algún item, queda en la cola y se reintenta el próximo cambio
//     de red (o cuando el usuario tappea "Sincronizar" manualmente).

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import * as Network from 'expo-network';
import { useRepository } from './index';

export type NetworkState = 'online' | 'offline' | 'unknown';

interface NetworkContextValue {
  state: NetworkState;
  /** Conteo de pending events (refresca cada vez que flushea). */
  pendingCount: number;
  /** Forzar un flush manual. Útil para botones "Sincronizar ahora". */
  flushNow: () => Promise<void>;
}

const Ctx = createContext<NetworkContextValue>({
  state: 'unknown',
  pendingCount: 0,
  flushNow: async () => {},
});

export function useNetworkStatus(): NetworkContextValue {
  return useContext(Ctx);
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const repo = useRepository();
  const [state, setState] = useState<NetworkState>('unknown');
  const [pendingCount, setPendingCount] = useState(0);
  // Guardamos el último estado para detectar transiciones.
  const lastState = useRef<NetworkState>('unknown');
  // Flag para evitar dos flushes paralelos.
  const flushing = useRef(false);

  const refreshPending = useCallback(async () => {
    try {
      const list = await repo.listPending();
      setPendingCount(list.length);
    } catch {
      // ignore
    }
  }, [repo]);

  const flushNow = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      await repo.flushPending();
    } catch {
      // ignore — los errores se acumulan en la cola para el próximo intento
    } finally {
      flushing.current = false;
      await refreshPending();
    }
  }, [repo, refreshPending]);

  // Refresh pending al montar (para mostrar el contador apenas abrís la app)
  useEffect(() => {
    refreshPending();
  }, [refreshPending]);

  // Poll de network state cada 5s. expo-network NO tiene API de "listener" en
  // todos los devices, así que polling es la opción más confiable cross-
  // platform. 5s es un balance razonable entre responsividad y batería.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const status = await Network.getNetworkStateAsync();
        const next: NetworkState = status.isConnected && status.isInternetReachable !== false
          ? 'online'
          : 'offline';
        if (cancelled) return;
        if (next !== lastState.current) {
          lastState.current = next;
          setState(next);
          // Transición a online → intentar flush
          if (next === 'online') {
            flushNow();
          }
        }
      } catch {
        // Si falla la consulta de network, asumimos online para no bloquear.
        if (!cancelled && lastState.current !== 'online') {
          lastState.current = 'online';
          setState('online');
        }
      }
    };
    tick(); // primera lectura inmediata
    const id = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [flushNow]);

  return (
    <Ctx.Provider value={{ state, pendingCount, flushNow }}>
      {children}
    </Ctx.Provider>
  );
}
