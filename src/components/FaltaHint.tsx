// FaltaHint — hint chiquito ámbar que muestra qué campos obligatorios faltan
// para poder guardar. Se renderiza arriba del botón Guardar cuando éste está
// deshabilitado.
//
// Antes el botón se quedaba gris sin contexto y el usuario no entendía por
// qué no funcionaba (típico: "ya cargué todo y sigue gris" → resulta que
// faltaba tappear el chip de lote). Este hint le dice exactamente qué falta.
//
// Si la lista de campos faltantes está vacía, no se renderiza nada.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';

interface Props {
  /** Lista de campos faltantes en lenguaje natural (ej: ["lote", "categoría"]). */
  campos: string[];
}

export function FaltaHint({ campos }: Props) {
  if (campos.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>!</Text>
      <Text style={styles.txt}>
        <Text style={styles.bold}>Falta: </Text>
        {campos.join(', ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#FFF4DD',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  icon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.amber,
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as '700',
    textAlign: 'center',
    lineHeight: 20,
    overflow: 'hidden',
  },
  txt: {
    flex: 1,
    fontSize: fontSize.sm,
    color: '#6B4400',
    lineHeight: 18,
  },
  bold: {
    fontWeight: fontWeight.bold as '700',
    color: '#8B5A00',
  },
});
