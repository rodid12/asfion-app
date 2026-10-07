// Auth context. Además de la sesión, resuelve el tenant activo.
//
// Usuarios normales: entran directamente a su único cliente.
// Superadministradores: primero eligen un cliente y todas las consultas quedan
// limitadas a ese tenant mediante el header `asfion-tenant`, validado por RLS.
// La selección se persiste para que el modo offline siga abriendo exactamente
// el mismo cliente; nunca se combinan cachés ni colas entre clientes.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
// @ts-ignore — expo-secure-store viene con Expo 54 + ya está en deps
import * as SecureStore from 'expo-secure-store';
import type { ClienteDisponible, Usuario } from '@/data/types';
import { useRepository } from '@/data';

interface AuthState {
  user: Usuario | null;
  loading: boolean;
  isSuperAdmin: boolean;
  clientesDisponibles: ClienteDisponible[];
  clienteSeleccionadoId: string | null;
  seleccionandoCliente: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<boolean>;
  seleccionarCliente: (clienteId: string) => Promise<void>;
  mostrarSelectorClientes: () => Promise<void>;
  logout: () => Promise<void>;
}

interface PersistedAuthV3 {
  version: 3;
  user: Usuario;
  isSuperAdmin: boolean;
  clientesDisponibles: ClienteDisponible[];
  clienteSeleccionadoId: string | null;
  savedAt: string;
}

const AuthContext = createContext<AuthState | null>(null);
const USER_KEY = 'asfion.auth.user';

async function storageGet(key: string): Promise<string | null> {
  try {
    const v = await SecureStore.getItemAsync(key);
    if (v != null) return v;
  } catch { /* fallback */ }
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

function parsePersisted(raw: string | null): PersistedAuthV3 | null {
  if (!raw) return null;
  const parsed = JSON.parse(raw) as PersistedAuthV3 | Usuario;
  if ((parsed as PersistedAuthV3).version === 3) {
    const v3 = parsed as PersistedAuthV3;
    if (!v3.user?.email) return null;
    return {
      ...v3,
      clientesDisponibles: Array.isArray(v3.clientesDisponibles) ? v3.clientesDisponibles : [],
      clienteSeleccionadoId: v3.clienteSeleccionadoId ?? null,
    };
  }
  // Compatibilidad con instalaciones que guardaban solamente Usuario.
  const legacy = parsed as Usuario;
  if (!legacy?.email) return null;
  return {
    version: 3,
    user: legacy,
    isSuperAdmin: false,
    clientesDisponibles: [],
    clienteSeleccionadoId: legacy.clienteId ?? null,
    savedAt: new Date().toISOString(),
  };
}

function usuarioSuperAdmin(base: Usuario, clienteId?: string): Usuario {
  return {
    ...base,
    rol: 'administrador',
    clienteId,
    campos: [],
    campoAsignadoId: undefined,
    isSuperAdmin: true,
  };
}

async function persistirAuth(
  user: Usuario,
  isSuperAdmin: boolean,
  clientesDisponibles: ClienteDisponible[],
  clienteSeleccionadoId: string | null,
): Promise<void> {
  const payload: PersistedAuthV3 = {
    version: 3,
    user,
    isSuperAdmin,
    clientesDisponibles,
    clienteSeleccionadoId,
    savedAt: new Date().toISOString(),
  };
  await storageSet(USER_KEY, JSON.stringify(payload));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const repo = useRepository();
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [clientesDisponibles, setClientesDisponibles] = useState<ClienteDisponible[]>([]);
  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState<string | null>(null);
  const [seleccionandoCliente, setSeleccionandoCliente] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      let persistido: PersistedAuthV3 | null = null;
      try {
        persistido = parsePersisted(await storageGet(USER_KEY));
        const scopePersistido = persistido?.isSuperAdmin
          ? persistido.clienteSeleccionadoId
          : null;
        repo.setAdminClienteScope(scopePersistido);

        const vigente = await repo.getCurrentUser();
        if (cancelado) return;
        if (!vigente) {
          await storageRemove(USER_KEY);
          repo.setAdminClienteScope(null);
          repo.setCurrentUser(null);
          return;
        }

        const superAdmin = await repo.isSuperAdmin();
        if (superAdmin) {
          const clientes = await repo.listClientesDisponibles();
          const selected = persistido?.clienteSeleccionadoId
            && clientes.some(c => c.id === persistido?.clienteSeleccionadoId)
            ? persistido.clienteSeleccionadoId
            : null;
          const resolved = usuarioSuperAdmin(vigente, selected ?? undefined);
          repo.setAdminClienteScope(selected);
          repo.setCurrentUser(resolved);
          await persistirAuth(resolved, true, clientes, selected);
          if (cancelado) return;
          setIsSuperAdmin(true);
          setClientesDisponibles(clientes);
          setClienteSeleccionadoId(selected);
          setUser(resolved);
        } else {
          const resolved = { ...vigente, isSuperAdmin: false };
          repo.setAdminClienteScope(null);
          repo.setCurrentUser(resolved);
          await persistirAuth(resolved, false, [], resolved.clienteId ?? null);
          if (cancelado) return;
          setIsSuperAdmin(false);
          setClientesDisponibles([]);
          setClienteSeleccionadoId(resolved.clienteId ?? null);
          setUser(resolved);
        }
      } catch (error) {
        if (esErrorDeRed(error) && persistido) {
          // Modo offline: solo restauramos el tenant guardado previamente.
          // Nunca elegimos otro tenant ni mezclamos cachés sin validación.
          const selected = persistido.isSuperAdmin
            ? persistido.clienteSeleccionadoId
            : persistido.user.clienteId ?? null;
          repo.setAdminClienteScope(persistido.isSuperAdmin ? selected : null);
          repo.setCurrentUser(persistido.user);
          if (!cancelado) {
            setIsSuperAdmin(persistido.isSuperAdmin);
            setClientesDisponibles(persistido.clientesDisponibles);
            setClienteSeleccionadoId(selected);
            setUser(persistido.user);
          }
        } else {
          try { await repo.logout(); } catch { /* la limpieza local sigue */ }
          await storageRemove(USER_KEY);
          repo.setAdminClienteScope(null);
          repo.setCurrentUser(null);
          if (!cancelado) {
            setIsSuperAdmin(false);
            setClientesDisponibles([]);
            setClienteSeleccionadoId(null);
            setUser(null);
          }
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, [repo]);

  const completarLogin = useCallback(async (base: Usuario) => {
    repo.setAdminClienteScope(null);
    const superAdmin = await repo.isSuperAdmin();
    if (!superAdmin) {
      const resolved = { ...base, isSuperAdmin: false };
      repo.setCurrentUser(resolved);
      await persistirAuth(resolved, false, [], resolved.clienteId ?? null);
      setIsSuperAdmin(false);
      setClientesDisponibles([]);
      setClienteSeleccionadoId(resolved.clienteId ?? null);
      setUser(resolved);
      return;
    }

    const clientes = await repo.listClientesDisponibles();
    if (clientes.length === 0) {
      throw new Error('No hay clientes disponibles para esta cuenta de superadministrador.');
    }
    const resolved = usuarioSuperAdmin(base);
    repo.setCurrentUser(resolved);
    await persistirAuth(resolved, true, clientes, null);
    setIsSuperAdmin(true);
    setClientesDisponibles(clientes);
    setClienteSeleccionadoId(null);
    setUser(resolved);
  }, [repo]);

  const login = useCallback(async (email: string, password: string) => {
    const u = await repo.login(email, password);
    await completarLogin(u);
  }, [repo, completarLogin]);

  const loginWithGoogle = useCallback(async (): Promise<boolean> => {
    const u = await repo.loginWithGoogle();
    if (!u) return false;
    await completarLogin(u);
    return true;
  }, [repo, completarLogin]);

  const seleccionarCliente = useCallback(async (clienteId: string) => {
    if (!user || !isSuperAdmin) throw new Error('Esta cuenta no puede cambiar de cliente.');
    const cliente = clientesDisponibles.find(c => c.id === clienteId);
    if (!cliente) throw new Error('El cliente seleccionado no está disponible.');

    setSeleccionandoCliente(true);
    try {
      repo.setAdminClienteScope(cliente.id);
      const scopedUser = usuarioSuperAdmin(user, cliente.id);
      repo.setCurrentUser(scopedUser);
      await persistirAuth(scopedUser, true, clientesDisponibles, cliente.id);
      setUser(scopedUser);
      setClienteSeleccionadoId(cliente.id);
    } catch (error) {
      repo.setAdminClienteScope(clienteSeleccionadoId);
      repo.setCurrentUser(user);
      throw error;
    } finally {
      setSeleccionandoCliente(false);
    }
  }, [user, isSuperAdmin, clientesDisponibles, clienteSeleccionadoId, repo]);

  const mostrarSelectorClientes = useCallback(async () => {
    if (!user || !isSuperAdmin) return;
    const neutralUser = usuarioSuperAdmin(user);
    // Ocultamos el tenant actual en UI en el mismo tick en que retiramos el
    // scope del backend; no dejamos la pantalla anterior viva mientras
    // SecureStore termina de persistir el cambio.
    setUser(neutralUser);
    setClienteSeleccionadoId(null);
    repo.setAdminClienteScope(null);
    repo.setCurrentUser(neutralUser);
    try {
      await persistirAuth(neutralUser, true, clientesDisponibles, null);
    } catch {
      // La selección visual sigue siendo segura; en el peor caso, al reiniciar
      // se restaura el último tenant persistido.
    }
  }, [user, isSuperAdmin, clientesDisponibles, repo]);

  const logout = useCallback(async () => {
    await repo.logout();
    await storageRemove(USER_KEY);
    repo.setAdminClienteScope(null);
    repo.setCurrentUser(null);
    setIsSuperAdmin(false);
    setClientesDisponibles([]);
    setClienteSeleccionadoId(null);
    setUser(null);
  }, [repo]);

  const value = useMemo<AuthState>(() => ({
    user,
    loading,
    isSuperAdmin,
    clientesDisponibles,
    clienteSeleccionadoId,
    seleccionandoCliente,
    login,
    loginWithGoogle,
    seleccionarCliente,
    mostrarSelectorClientes,
    logout,
  }), [
    user,
    loading,
    isSuperAdmin,
    clientesDisponibles,
    clienteSeleccionadoId,
    seleccionandoCliente,
    login,
    loginWithGoogle,
    seleccionarCliente,
    mostrarSelectorClientes,
    logout,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth: falta <AuthProvider>');
  return ctx;
}
