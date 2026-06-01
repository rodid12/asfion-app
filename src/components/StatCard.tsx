// StatCard: tarjeta chiquita con un número grande y una etiqueta abajo.
// Pensada para el grid de stats del Home (hoy / semana / sin sync).

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';

interface Props {
  value: string | number;
  label: string;
  /** Cambia el énfasis visual cuando hay que prestar atención (ej: pendientes > 0). */
  variant?: 'default' | 'warn' | 'lime';
  onPress?: () => void;
}

export function StatCard({ value, label, variant = 'default', onPress }: Props) {
  const v = String(value);
  const Wrap: any = onPress ? Pressable : View;
  return (
    <Wrap onPress={onPress} style={[styles.card, variant === 'warn' && styles.warn, variant === 'lime' && styles.lime]}>
      <Text style={[styles.value, variant === 'warn' && styles.valueWarn, variant === 'lime' && styles.valueLime]}>
        {v}
      </Text>
      <Text style={[styles.label, variant === 'warn' && styles.labelWarn, variant === 'lime' && styles.labelLime]}>
        {label}
      </Text>
    </Wrap>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.md,
    minHeight: 76,
    justifyContent: 'center',
  },
  warn: {
    backgroundColor: colors.amber,
    borderColor: colors.amber,
  },
  lime: {
    backgroundColor: colors.greenLime,
    borderColor: colors.greenLime,
  },
  value: {
    fontSize: 28,
    fontWeight: fontWeight.bold as '700',
    color: colors.textDark,
    lineHeight: 30,
  },
  valueWarn: { color: colors.white },
  valueLime: { color: colors.greenDeep },
  label: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold as '600',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  labelWarn: { color: colors.white },
  labelLime: { color: colors.greenDeep },
});
