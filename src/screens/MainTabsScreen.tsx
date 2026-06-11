// MainTabsScreen: contenedor de los 6 tabs. Reemplaza a Home como root
// autenticado en el Stack. Los sub-screens quedan montados todos a la vez
// (con display:none en los inactivos) para preservar estado interno — scroll,
// filtros, texto tipeado — al alternar entre tabs.
//
// ParicionForm (y más adelante ParicionDetail) siguen viviendo en el Stack,
// se abren _por encima_ de los tabs con push(), y al cerrar el stack-focus
// fuerza refresh en los tabs activos.

import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { BottomTabBar, TABS_CATALOGO } from '@/navigation/BottomTabBar';
import { useTabNav, type TabKey } from '@/navigation/TabContext';
import { useClientConfig } from '@/config/ClientConfigContext';
import type { ModuloKey } from '@/config/types';
import { HomeScreen } from '@/screens/HomeScreen';
import { ParicionListScreen } from '@/screens/pariciones/ParicionListScreen';
import { MetricasScreen } from '@/screens/metricas/MetricasScreen';
import { LluviaListScreen } from '@/screens/lluvias/LluviaListScreen';
import { MortandadListScreen } from '@/screens/mortandad/MortandadListScreen';
import { PastoreoListScreen } from '@/screens/pastoreo/PastoreoListScreen';
import { CompraListScreen } from '@/screens/compras/CompraListScreen';
import { colors } from '@/theme/colors';
import { SubscriptionBanner, SubscriptionLockoutScreen, useSubscription } from '@/subscription';

// Mapping: cada tab pertenece a un módulo (o no, si es transversal).
// "menu" (Home) y "metricas" no están atados a un módulo específico —
// siempre se muestran. Los demás se muestran solo si el módulo está
// en config.modulosHabilitados.
const TAB_TO_MODULO: Partial<Record<TabKey, ModuloKey>> = {
  lista:     'pariciones',
  lluvias:   'lluvias',
  mortandad: 'mortandad',
  pastoreo:  'pastoreo',
  compras:   'compras',
};

export function MainTabsScreen() {
  const { currentTab, switchTab } = useTabNav();
  const clientConfig = useClientConfig();
  // Estado de subscription: si el cliente está suspended/canceled, reemplazamos
  // el shell de tabs por la pantalla de lockout (con CTA a WhatsApp). Si está
  // past_due/restricted, mostramos un banner arriba pero los tabs siguen
  // funcionando (cuando es restricted los Form quedan disabled vía RLS).
  const sub = useSubscription();

  // Filtramos el catálogo de tabs por los módulos habilitados del cliente.
  // 'menu' y 'metricas' (sin entry en TAB_TO_MODULO) siempre pasan.
  const tabsVisibles = useMemo(
    () => TABS_CATALOGO.filter(t => {
      const modulo = TAB_TO_MODULO[t.key];
      return !modulo || clientConfig.modulosHabilitados.includes(modulo);
    }),
    [clientConfig],
  );

  // Helpers para saber si un tab está habilitado (no rendereamos el subtree
  // si su módulo no está habilitado — ahorra memoria y evita state stale).
  const enabled = (k: TabKey) => tabsVisibles.some(t => t.key === k);

  // Lockout total: reemplaza COMPLETAMENTE el shell. El usuario solo ve la
  // pantalla de mora y un CTA para hablar con ASFION. El logout funciona
  // normal por si quieren cambiar de cuenta o probar re-login post-pago.
  if (sub.isLocked) {
    return <SubscriptionLockoutScreen />;
  }

  return (
    <View style={styles.safe}>
      <SubscriptionBanner />
      <View style={styles.body}>
        <TabPane active={currentTab === 'menu'}>
          <HomeScreen />
        </TabPane>
        {enabled('lista') && (
          <TabPane active={currentTab === 'lista'}>
            <ParicionListScreen />
          </TabPane>
        )}
        <TabPane active={currentTab === 'metricas'}>
          <MetricasScreen />
        </TabPane>
        {enabled('mortandad') && (
          <TabPane active={currentTab === 'mortandad'}>
            <MortandadListScreen />
          </TabPane>
        )}
        {enabled('pastoreo') && (
          <TabPane active={currentTab === 'pastoreo'}>
            <PastoreoListScreen />
          </TabPane>
        )}
        {enabled('lluvias') && (
          <TabPane active={currentTab === 'lluvias'}>
            <LluviaListScreen />
          </TabPane>
        )}
        {enabled('compras') && (
          <TabPane active={currentTab === 'compras'}>
            <CompraListScreen />
          </TabPane>
        )}
      </View>
      <BottomTabBar
        active={currentTab}
        onChange={(k: TabKey) => switchTab(k)}
        tabs={tabsVisibles}
      />
    </View>
  );
}

// Mantiene el subtree montado — solo lo oculta visualmente cuando no es el tab activo.
// Así no se pierde scroll/estado al cambiar de tab.
function TabPane({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        !active && styles.hidden,
      ]}
      pointerEvents={active ? 'auto' : 'none'}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'yes' : 'no-hide-descendants'}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgLight },
  body: { flex: 1, position: 'relative' },
  hidden: {
    opacity: 0,
    // Keep mounted but non-interactive. Avoids display:'none' quirks on RN.
  },
});
