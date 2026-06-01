// Factory + contexto del repositorio. Los screens consumen `useRepository()`.

import React, { createContext, useContext, useMemo } from 'react';
import { InMemoryBackend } from './backends/memory';
import { SupabaseBackend } from './backends/supabase';
import { Repository } from './repository';
import type { IDataBackend } from './repository';

type BackendKind = 'memory' | 'supabase' | 'sheets';

/** Factoría — lee de env / config qué backend usar. Por defecto memoria. */
export function buildBackend(kind: BackendKind = 'memory'): IDataBackend {
  switch (kind) {
    case 'memory':
      return new InMemoryBackend();
    case 'supabase': {
      const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !anonKey) {
        throw new Error(
          'SupabaseBackend: faltan EXPO_PUBLIC_SUPABASE_URL y/o EXPO_PUBLIC_SUPABASE_ANON_KEY ' +
          'en tu .env.local. Ver supabase/README.md para el setup.',
        );
      }
      return new SupabaseBackend({ url, anonKey });
    }
    case 'sheets':
      throw new Error('GoogleSheetsBackend deprecado. Usar "supabase" o "memory".');
    default:
      throw new Error(`Backend desconocido: ${kind}`);
  }
}

const RepositoryContext = createContext<Repository | null>(null);

export function RepositoryProvider({ children, kind = 'memory' }: { children: React.ReactNode; kind?: BackendKind }) {
  const repo = useMemo(() => new Repository(buildBackend(kind)), [kind]);
  return React.createElement(RepositoryContext.Provider, { value: repo }, children);
}

export function useRepository(): Repository {
  const repo = useContext(RepositoryContext);
  if (!repo) throw new Error('useRepository: falta envolver el árbol en <RepositoryProvider>');
  return repo;
}
