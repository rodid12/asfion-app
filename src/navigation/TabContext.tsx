// Tabs custom. No usamos @react-navigation/bottom-tabs para:
//  1) control total del estilo (matchear AppSheet sin depender del theme de RN-navigation)
//  2) no agregar otra dependencia pesada al bundle
//  3) evitar el drama de configurar nested navigators
//
// El contexto expone el tab activo + un switcher. Cualquier screen adentro puede
// llamar switchTab('lista') para saltar a otro tab programáticamente (ej:
// "Ver pariciones" desde el Home).
//
// Si en el futuro queremos deep-linking real, migramos a @react-navigation/bottom-tabs
// y esto queda como shim.

import React, { createContext, useContext, useMemo, useState } from 'react';

export type TabKey = 'menu' | 'lista' | 'lluvias' | 'mortandad' | 'pastoreo' | 'compras' | 'metricas';

export const TAB_KEYS: TabKey[] = ['menu', 'lista', 'lluvias', 'mortandad', 'pastoreo', 'compras', 'metricas'];

interface TabCtx {
  currentTab: TabKey;
  switchTab: (t: TabKey) => void;
}

const TabContext = createContext<TabCtx | null>(null);

export function TabProvider({
  children,
  initial = 'menu',
}: {
  children: React.ReactNode;
  initial?: TabKey;
}) {
  const [currentTab, setCurrentTab] = useState<TabKey>(initial);
  const value = useMemo<TabCtx>(
    () => ({ currentTab, switchTab: setCurrentTab }),
    [currentTab],
  );
  return <TabContext.Provider value={value}>{children}</TabContext.Provider>;
}

export function useTabNav(): TabCtx {
  const ctx = useContext(TabContext);
  if (!ctx) {
    throw new Error('useTabNav fuera de <TabProvider>');
  }
  return ctx;
}
