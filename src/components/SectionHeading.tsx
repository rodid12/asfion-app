// SectionHeading — encabezado de sección unificado.
//
// Patrón: texto en mayúsculas chico + bold navy + línea horizontal que se
// extiende a la derecha (mismo que el Home: "CARGAR EVENTO ──────").
// Usar en forms y detail screens para dividir bloques de campos / datos.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { fontWeight } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

interface Props {
  /** Texto del heading (se renderiza en mayúsculas via styling). */
  children: string;
  /** Margin top en spacing units (default: spacing.lg). */
  marginTop?: number;
}

export function SectionHeading({ children, marginTop }: Props) {
  return (
    <View style={[styles.row, marginTop !== undefined && { marginTop }]}>
      <Text style={styles.text}>{children}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  text: {
    fontSize: 11,
    fontWeight: fontWeight.bold as '700',
    color: colors.navy,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderSoft,
  },
});
