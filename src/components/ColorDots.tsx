// ColorDots: selector de color tipo "círculos coloreados".
// Reemplaza los chips largos de color de caravana ("Celeste / Amarilla / Blanca / Naranja")
// por dots tappables — más rápido de identificar visualmente y ocupa menos espacio.
//
// Tap en un dot ya seleccionado lo deselecciona (caravana sin color).

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import type { CaravanaColor } from '@/data/types';

interface Props {
  label?: string;
  value?: CaravanaColor;
  onChange: (v: CaravanaColor | undefined) => void;
}

// Mapeo color → hex visual. No es el theme ASFION, son los colores REALES
// de las caravanas físicas (lo que el operario ve en el animal).
const COLOR_HEX: Record<CaravanaColor, string> = {
  Celeste:  '#7EC4E8',
  Amarillo: '#F5C842',
  Blanca:   '#F5F5F0',
  Naranja:  '#E07B3C',
};

const ORDEN: CaravanaColor[] = ['Celeste', 'Amarillo', 'Blanca', 'Naranja'];

export function ColorDots({ label, value, onChange }: Props) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        {ORDEN.map(c => {
          const selected = c === value;
          return (
            <Pressable
              key={c}
              onPress={() => onChange(selected ? undefined : c)}
              style={styles.dotWrap}
              accessibilityRole="button"
              accessibilityLabel={`Color ${c}${selected ? ', seleccionado' : ''}`}
              accessibilityState={{ selected }}
            >
              <View
                style={[
                  styles.dot,
                  { backgroundColor: COLOR_HEX[c] },
                  selected && styles.dotSelected,
                ]}
              />
              <Text style={[styles.dotLabel, selected && styles.dotLabelSelected]}>{c}</Text>
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
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  dotWrap: {
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 64,
  },
  dot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.borderSoft,
  },
  dotSelected: {
    borderColor: colors.greenDark,
    borderWidth: 4,
  },
  dotLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold as '600',
  },
  dotLabelSelected: {
    color: colors.greenDark,
    fontWeight: fontWeight.bold as '700',
  },
});
