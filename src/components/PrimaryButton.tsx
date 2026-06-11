// Botón primario — CTA grande, pulgar-friendly.
// Soporta variante "ghost" para acciones secundarias.

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight, touchTarget } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
}

export function PrimaryButton({ label, onPress, variant = 'primary', loading, disabled }: Props) {
  const bg =
    variant === 'primary' ? colors.navy :
    variant === 'danger'  ? colors.terracota :
                            'transparent';
  const fg =
    variant === 'ghost' ? colors.navy : colors.white;
  const border =
    variant === 'ghost' ? colors.navy : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, borderColor: border },
        (disabled || loading) && styles.disabled,
        pressed && { opacity: 0.75 },
      ]}
      accessibilityRole="button"
    >
      {loading
        ? <ActivityIndicator color={fg} />
        : <Text style={[styles.label, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: touchTarget.large,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as '700',
    letterSpacing: 0.3,
  },
  disabled: { opacity: 0.5 },
});
