// FAB (Floating Action Button) — el "+" verde lima abajo a la derecha en
// pantallas tipo lista. Permite cargar una nueva entidad sin volver al Home.

import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '@/theme/colors';
import { fontWeight } from '@/theme/typography';

interface Props {
  onPress: () => void;
  label?: string;
  accessibilityLabel?: string;
}

export function Fab({ onPress, label = '+', accessibilityLabel = 'Nueva carga' }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.greenLime,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  label: {
    fontSize: 32,
    fontWeight: fontWeight.bold as '700',
    color: colors.greenDeep,
    lineHeight: 34,
  },
});
