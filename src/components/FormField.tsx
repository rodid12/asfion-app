// Campo de texto estándar. Label arriba, input alto, soporte para placeholder/error.

import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight, touchTarget } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';

interface Props extends TextInputProps {
  label: string;
  error?: string;
}

export function FormField({ label, error, style, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        {...rest}
        style={[styles.input, error && styles.inputError, style]}
      />
      {error ? <Text style={styles.err}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as '700',
    color: colors.textMuted,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    minHeight: touchTarget.comfortable,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.base,
    fontSize: fontSize.md,
    color: colors.textDark,
  },
  inputError: { borderColor: colors.danger },
  err: {
    color: colors.danger,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
});
