// Accordion: header tappable que colapsa/expande contenido. Lo usamos en el form
// de Pariciones para esconder los campos "raros" (asistencia, observaciones,
// fecha override, GPS info) detrás de un "Más detalles".
//
// Optimizado para que el primer estado sea COLAPSADO — el operario común no lo abre.

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';

interface Props {
  label: string;
  defaultOpen?: boolean;
  /** Texto opcional al lado derecho del header (ej: "3 campos") */
  hint?: string;
  children: React.ReactNode;
}

export function Accordion({ label, defaultOpen = false, hint, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => setOpen(o => !o)} style={styles.header} accessibilityRole="button">
        <Text style={styles.label}>{label}</Text>
        <View style={styles.right}>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
          <Text style={styles.chev}>{open ? '▴' : '▾'}</Text>
        </View>
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.white,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  label: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold as '600',
    color: colors.textDark,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  hint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  chev: {
    fontSize: fontSize.md,
    color: colors.greenDark,
    fontWeight: fontWeight.bold as '700',
  },
  body: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    gap: spacing.md,
  },
});
