// Tile grande para el grid del Home.
// Reemplaza las celdas turquesa del AppSheet actual con algo más designed.

import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';

interface Props {
  label: string;
  emoji?: string;     // placeholder por ahora; en v1.1 reemplazar por SVG icon
  onPress: () => void;
  variant?: 'dark' | 'lime' | 'light';
}

export function Tile({ label, emoji, onPress, variant = 'dark' }: Props) {
  const bg =
    variant === 'dark' ? colors.greenDark :
    variant === 'lime' ? colors.greenLime :
                         colors.white;        // antes era bgLight → invisible sobre el fondo
  const fg =
    variant === 'light' ? colors.greenDark : colors.white;
  const borderColor =
    variant === 'light' ? colors.greenDark : 'transparent';
  const borderWidth = variant === 'light' ? 2 : 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: bg, borderColor, borderWidth },
        pressed && { opacity: 0.85 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {emoji ? <Text style={[styles.emoji, { color: fg }]}>{emoji}</Text> : null}
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
    justifyContent: 'space-between',
    minHeight: 140,
  },
  emoji: { fontSize: 36 },
  label: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold as '700',
    letterSpacing: 0.2,
  },
});
