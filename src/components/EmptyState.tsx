// EmptyState — placeholder consistente cuando un listado está vacío o
// no tiene resultados con los filtros aplicados.
//
// Anatomía:
//   - Bubble grande con emoji (orange-soft bg, igual estilo que los
//     tile bubbles del Home — consistencia visual)
//   - Título navy bold
//   - Descripción/hint en gris
//   - CTA opcional (botón orange filled) — usar para "Limpiar filtros"
//     o "Cargar el primero".
//
// Uso:
//   <EmptyState
//     emoji="🐮"
//     title="Todavía no hay pariciones cargadas"
//     description="Tocá el botón naranja + para cargar la primera."
//   />
//
//   <EmptyState
//     emoji="🔍"
//     title="Sin resultados"
//     description="No hay registros con los filtros activos."
//     cta={{ label: 'Limpiar filtros', onPress: clearFilters }}
//   />

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';

interface Cta {
  label: string;
  onPress: () => void;
}

interface Props {
  emoji: string;
  title: string;
  description?: string;
  cta?: Cta;
}

export function EmptyState({ emoji, title, description, cta }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.bubble}>
        <Text style={styles.emoji}>{emoji}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.desc}>{description}</Text> : null}
      {cta ? (
        <Pressable
          onPress={cta.onPress}
          style={({ pressed }) => [styles.ctaBtn, pressed && styles.ctaBtnPressed]}
          accessibilityRole="button"
        >
          <Text style={styles.ctaTxt}>{cta.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  bubble: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: colors.orangeSoft,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emoji: { fontSize: 44 },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold as '700',
    color: colors.navy,
    textAlign: 'center',
  },
  desc: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  ctaBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.round,
    backgroundColor: colors.orange,
    shadowColor: colors.orange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  ctaBtnPressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  ctaTxt: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
