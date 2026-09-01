// Auth context. Envuelve la app y expone usuario actual + login/logout.
//
// Persistencia: SecureStore (Keychain en iOS, Keystore en Android — ambos
// encriptados con la clave del device). Migración hecha post-audit
// 27-jun-2026: antes se usaba AsyncStorage que es sandboxed pero plano,
// y un device rooteado/jailbroken puede leer el blob de session.
//
// Migración invisible para el usuario: si hay data vieja en AsyncStorage
// la lee una vez, la copia a SecureStore y borra de AsyncStorage. Después
// de la primera ejecución, SecureStore es el único storage.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
// @ts-ignore — expo-secure-store viene con Expo 54 + ya está en deps
import * as SecureStore from 'expo-secure-store';
import type { Usuario } from '@/data/types';
import { useRepository } from '@/data';

interface AuthState {
  user: Usuario | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const USER_KEY = 'asfion.auth.user';

// Wrapper de SecureStore con fallback transparente a AsyncStorage si
// SecureStore no está disponible (ej. web). En mobile siempre va a
// SecureStore.
async function storageGet(key: string): Promise<string | null> {
  try {
    const v = await SecureStore.getItemAsync(key);
    if (v != null) return v;
  } catch { /* fallback */ }
  // Migración silenciosa: si todavía tenemos data en AsyncStorage,
  // copiarla a SecureStore y borrar el origen.
  const legacy = await AsyncStorage.getItem(key);
  if (legacy) {
    try { await SecureStore.setItemAsync(key, legacy); } catch { /* ignore */ }
    try { await AsyncStorage.removeItem(key); } catch { /* ignore */ }
  }
  return legacy;
}

async function storageSet(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Si SecureStore no está (web), caer a AsyncStorage como último recurso.
    await AsyncStorage.setItem(key, value);
  }
}

async function storageRemove(key: string): Promise<void> {
  try { await SecureStore.deleteItemAsync(key); } catch { /* ignore */ }
  try { await AsyncStorage.removeItem(key); } catch { /* ignore */ }
}

function esErrorDeRed(error: unknown): boolean {
  const msg = error instanceof Error
    ? error.message
    : String((error as any)?.message ?? error ?? '');
  const t = msg.toLowerCase();
  return t.includes('network request failed')
    || t.includes('failed to fetch')
    || t.includes('fetch failed')
    || t.includes('network error')
    || t.includes('timeout')
    || t.includes('timed out')
    || t.includes('connection');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const repo = useRepository();
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const raw = await storageGet(USER_KEY);
        if (cancelado) return;
        if (raw) {
          const persistido: Usuario = JSON.parse(raw);
          try {
            // Validar primero la sesión REAL de Supabase. Si el refresh token
            // fue revocado/no existe, el backend lo limpia y devuelve null.
            // Si estamos offline lanza: en ese caso conservamos el perfil
            // local para que la app siga permitiendo carga en cola.
            const vigente = await repo.getCurrentUser();
            if (cancelado) return;
            if (vigente) {
              await storageSet(USER_KEY, JSON.stringify(vigente));
              repo.setCurrentUser(vigente);
              setUser(vigente);
            } else {
              await storageRemove(USER_KEY);
              repo.setCurrentUser(null);
              setUser(null);
            }
          } catch (error) {
            if (esErrorDeRed(error)) {
              // Solo una falla inequívocamente de red habilita modo offline.
              repo.setCurrentUser(persistido);
              setUser(persistido);
            } else {
              // Error de Auth/perfil: nunca entrar con un perfil local sin
              // JWT, porque RLS respondería 0 filas en todos los módulos.
              try { await repo.logout(); } catch { /* ya se limpia local */ }
              await storageRemove(USER_KEY);
              repo.setCurrentUser(null);
              setUser(null);
            }
          }
        } else {
          // Puede existir una sesión Supabase válida aunque se haya perdido
          // solo nuestro perfil local (p. ej. tras actualizar la app).
          try {
            const vigente = await repo.getCurrentUser();
            if (!cancelado && vigente) {
              await storageSet(USER_KEY, JSON.stringify(vigente));
              repo.setCurrentUser(vigente);
              setUser(vigente);
            }
          } catch {
            // Sin sesión o sin red y sin perfil local: mostrar Login.
          }
        }
      } catch {
        // Perfil local corrupto: limpiarlo en lugar de bloquear el arranque.
        await storageRemove(USER_KEY);
        repo.setCurrentUser(null);
        if (!cancelado) setUser(null);
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, [repo]);

  const login = useCallback(async (email: string, password: string) => {
    const u = await repo.login(email, password);
    await storageSet(USER_KEY, JSON.stringify(u));
    repo.setCurrentUser(u);
    setUser(u);
  }, [repo]);

  const loginWithGoogle = useCallback(async (): Promise<boolean> => {
    const u = await repo.loginWithGoogle();
    if (!u) return false; // la persona cerró/canceló el navegador
    await storageSet(USER_KEY, JSON.stringify(u));
    repo.setCurrentUser(u);
    setUser(u);
    return true;
  }, [repo]);

  const logout = useCallback(async () => {
    await repo.logout();
    await storageRemove(USER_KEY);
    repo.setCurrentUser(null);
    setUser(null);
  }, [repo]);

  const value = useMemo(
    () => ({ user, loading, login, loginWithGoogle, logout }),
    [user, loading, login, loginWithGoogle, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth: falta <AuthProvider>');
  return ctx;
}
