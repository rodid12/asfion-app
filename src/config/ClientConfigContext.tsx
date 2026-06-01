// ClientConfigContext — provee la config del cliente activo al árbol de
// componentes. Los screens consumen vía useClientConfig().
//
// Implementación actual: lee de ACTIVE_CONFIG estática. Cuando enchufemos
// Supabase, este provider va a hacer un fetch al boot y exponer también un
// estado "loading" y "error". Los screens no se enteran del cambio porque
// el contrato (ClientConfig) es el mismo.

import React, { createContext, useContext } from 'react';
import { ACTIVE_CONFIG } from './active';
import type { ClientConfig, ModuloKey } from './types';

const ClientConfigCtx = createContext<ClientConfig>(ACTIVE_CONFIG);

interface ProviderProps {
  /** Override opcional — útil para tests o storybook que quieran simular otro cliente. */
  config?: ClientConfig;
  children: React.ReactNode;
}

export function ClientConfigProvider({ config, children }: ProviderProps) {
  return (
    <ClientConfigCtx.Provider value={config ?? ACTIVE_CONFIG}>
      {children}
    </ClientConfigCtx.Provider>
  );
}

/** Hook principal — devuelve la config completa. */
export function useClientConfig(): ClientConfig {
  return useContext(ClientConfigCtx);
}

/** Helper para preguntar rápidamente si un módulo está habilitado. */
export function useModuloHabilitado(key: ModuloKey): boolean {
  const cfg = useClientConfig();
  return cfg.modulosHabilitados.includes(key);
}
