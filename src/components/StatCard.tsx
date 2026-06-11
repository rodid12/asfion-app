// StatCard: tarjeta chiquita con un número grande y una etiqueta abajo.
// Pensada para el grid de stats del Home (hoy / semana / sin sync).
//
// Rediseño post-rebrand (naranja/navy):
//   - Card blanca limpia con strip lateral de 4px de color
//   - Strip orange si hay actividad positiva (variant=lime)
//   - Strip amber si requiere atención (variant=warn)
//   - Strip gris tenue cuando no hay highlight
//   - Número en color del strip (orange/amber/navy); label muted minúsculas
//
// La idea: el strip lateral es la "firma" visual de la card — más sutil que
// pintar todo el fondo, mantiene legibilidad incluso con 3 cards en fila.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { fontWeight } from '@/theme/typography';
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
  const stripColor =
    variant === 'warn' ? colors.amber :
    variant === 'lime' ? colors.orange :
                          colors.borderSoft;
  const valueColor =
    variant === 'warn' ? colors.amber :
    variant === 'lime' ? colors.orange :
                          colors.navy;
  return (
    <Wrap onPress={onPress} style={styles.card}>
      <View style={[styles.strip, { backgroundColor: stripColor }]} />
      <View style={styles.content}>
        <Text style={[styles.value, { color: valueColor }]}>{v}</Text>
        <Text style={styles.label}>{label}</Text>
      </View>
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
    minHeight: 76,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: colors.navyDeep,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  strip: {
    width: 4,
  },
  content: {
    flex: 1,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  value: {
    fontSize: 26,
    fontWeight: fontWeight.bold as '700',
    lineHeight: 30,
  },
  label: {
    fontSize: 10,
    fontWeight: fontWeight.bold as '700',
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 2,
  },
});
