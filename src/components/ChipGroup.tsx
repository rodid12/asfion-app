// Grupo de chips mutuamente excluyentes — equivalente a los botones de opción del AppSheet actual
// ("Nacimiento | Muerte | Retacto", "Macho | Hembra | Orejano", etc.).
// Optimizado para pulgar con guante: chips altas (56pt), separación generosa, contraste alto.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight, touchTarget } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';

interface Props<T extends string> {
  label?: string;
  value: T | undefined;
  options: readonly T[];
  onChange: (v: T) => void;
  disabled?: boolean;
}

export function ChipGroup<T extends string>({ label, value, options, onChange, disabled }: Props<T>) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        {options.map(opt => {
          const selected = opt === value;
          return (
            <Pressable
              key={opt}
              onPress={() => !disabled && onChange(opt)}
              style={[
                styles.chip,
                selected && styles.chipSelected,
                disabled && styles.chipDisabled,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
            >
              <Text style={[styles.text, selected && styles.textSelected]}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
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
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: touchTarget.comfortable,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    // flexGrow: 0 (default) — antes estaba en 1 para que los chips llenaran
    // el ancho de la fila. El problema: cuando wrappea (ej. 3 chips, 2 en
    // la primera fila + 1 en la segunda), el chip solo se estiraba a TODO
    // el ancho, quedando enorme y desproporcionado.
    // Con flexGrow:0 cada chip queda en su tamaño natural (con minWidth como
    // tap target mínimo). Si todos entran en una fila, quedan alineados a
    // la izquierda con su gap natural — más consistente que la versión
    // estirada anterior.
    flexGrow: 0,
    flexShrink: 1,
    minWidth: 96,
  },
  chipSelected: {
    borderColor: colors.greenDark,
    backgroundColor: colors.greenDark,
  },
  chipDisabled: { opacity: 0.5 },
  text: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold as '600',
    color: colors.textDark,
  },
  textSelected: { color: colors.white },
});
