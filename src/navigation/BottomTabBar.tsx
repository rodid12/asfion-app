// Bottom tab bar custom. Muestra 6 tabs:
//   Menú / Pariciones / Lluvias / Mortandad / Pastoreo / Métricas
//
// Métricas queda al final (drill-down al final del flujo de carga, no en medio).
//
// Diseño:
//  - 6 tabs no caben cómodas con labels completas → labels cortas de 1-2 líneas.
//  - Tab activo: color orange + línea superior de acento (ASFION verde).
//  - Tab inactivo pero "próximamente": opacidad reducida, no clickable.
//  - Tabs iconográficos: usamos emoji + texto, como hace el AppSheet. Más adelante
//    migramos a iconos SVG propios (ASFION) cuando tengamos el set.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import type { TabKey } from './TabContext';

export interface TabDef {
  key: TabKey;
  label: string;
  emoji: string;
  enabled: boolean;
}

// Catálogo completo de tabs que conoce la app. La lista REAL que se
// muestra al usuario sale del ClientConfig (ver MainTabsScreen) — esto
// es solo el "diccionario" de tabs posibles.
export const TABS_CATALOGO: TabDef[] = [
  { key: 'menu',      label: 'Menú',          emoji: '🏠', enabled: true },
  { key: 'lista',     label: 'Pariciones',    emoji: '📋', enabled: true },
  { key: 'lluvias',   label: 'Lluvias',       emoji: '🌧️', enabled: true },
  { key: 'mortandad', label: 'Mortandad',     emoji: '⚠️', enabled: true },
  { key: 'pastoreo',  label: 'Pastoreo',      emoji: '🌾', enabled: true },
  { key: 'compras',   label: 'Compras',       emoji: '🛒', enabled: true },
  { key: 'metricas',  label: 'Métricas',      emoji: '📊', enabled: true },
];

// Alias por compat con código viejo que importaba TABS.
export const TABS = TABS_CATALOGO;

interface Props {
  active: TabKey;
  onChange: (k: TabKey) => void;
  /** Tabs a mostrar (filtradas por ClientConfig en MainTabsScreen). Si no se
   *  pasa, usa TABS_CATALOGO completo. */
  tabs?: readonly TabDef[];
}

export function BottomTabBar({ active, onChange, tabs }: Props) {
  const tabsToShow = tabs ?? TABS_CATALOGO;
  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <View style={styles.bar}>
        {tabsToShow.map(t => {
          const isActive = t.key === active;
          const isDisabled = !t.enabled;
          return (
            <Pressable
              key={t.key}
              onPress={() => t.enabled && onChange(t.key)}
              disabled={isDisabled}
              accessibilityRole="button"
              accessibilityLabel={`Tab ${t.label}`}
              accessibilityState={{ selected: isActive, disabled: isDisabled }}
              style={({ pressed }) => [
                styles.tab,
                pressed && t.enabled && styles.tabPressed,
              ]}
            >
              {/* Indicador de activo */}
              <View style={[styles.indicator, isActive && styles.indicatorOn]} />
              <Text
                style={[
                  styles.emoji,
                  isDisabled && styles.emojiDisabled,
                ]}
              >
                {t.emoji}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  isActive && styles.labelActive,
                  isDisabled && styles.labelDisabled,
                ]}
              >
                {t.label}
              </Text>
              {isDisabled && <View style={styles.lockDot} />}
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  bar: {
    flexDirection: 'row',
    minHeight: 60,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    gap: 2,
    position: 'relative',
  },
  tabPressed: {
    backgroundColor: colors.bgLight,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: 3,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: 'transparent',
  },
  indicatorOn: {
    backgroundColor: colors.orange,
  },
  emoji: {
    fontSize: 20,
    lineHeight: 22,
  },
  emojiDisabled: {
    opacity: 0.35,
  },
  label: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold as '600',
    letterSpacing: 0.2,
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  labelActive: {
    color: colors.navy,
    fontWeight: fontWeight.bold as '700',
  },
  labelDisabled: {
    color: colors.textMuted,
    opacity: 0.55,
  },
  lockDot: {
    position: 'absolute',
    top: 6,
    right: '28%',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderSoft,
  },
});

// Exported for screen-level guards (ej: mostrar alerta al tocar placeholder).
export function tabDef(k: TabKey): TabDef {
  return TABS.find(t => t.key === k)!;
}
