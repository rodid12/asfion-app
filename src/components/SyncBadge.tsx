// Badge que muestra estado de sincronización de un evento.
//
// Diseño revisitado (feedback Ro): cuando el evento está SYNCED (estado
// normal y mayoritario), mostramos solo un pequeño dot verde, sin texto
// — no necesitamos gritar "OK" en cada card; sería ruido visual.
//
// Cuando está pendiente, subiendo o falló, mostramos pill prominente con
// el copy explícito, así el peón nota inmediatamente que hay algo que
// requiere atención.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';
import type { SyncState } from '@/data/types';

interface PillCopy {
  label: string;
  bg: string;
  fg: string;
}

const PILL: Record<Exclude<SyncState, 'synced'>, PillCopy> = {
  pending: { label: 'PENDIENTE', bg: colors.amber,     fg: colors.white },
  syncing: { label: 'SUBIENDO',  bg: colors.textMuted, fg: colors.white },
  failed:  { label: 'FALLÓ',     bg: colors.terracota, fg: colors.white },
};

export function SyncBadge({ state }: { state: SyncState }) {
  // Estado normal: dot chico y discreto. No agrega ruido textual.
  if (state === 'synced') {
    return (
      <View style={styles.dotWrap} accessibilityLabel="Sincronizado">
        <View style={styles.dot} />
      </View>
    );
  }
  const { label, bg, fg } = PILL[state];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Pill para estados que requieren atención
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold as '700',
    letterSpacing: 0.5,
  },
  // Dot para estado synced — agrupado en un wrap pequeño para mantener
  // el espacio reservado parecido al de la pill y evitar saltos de layout
  // cuando un item cambia de pending → synced.
  dotWrap: {
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.greenLime,
  },
});
