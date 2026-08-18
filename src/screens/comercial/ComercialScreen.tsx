// Acceso comercial unificado para no saturar la barra inferior.
// Compras y Ventas son dos flujos distintos, pero comparten un único tab
// "Comercial" y se alternan con un selector interno grande y legible.

import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/context';
import { useClientConfig } from '@/config/ClientConfigContext';
import { CompraListScreen } from '@/screens/compras/CompraListScreen';
import { VentaListScreen } from '@/screens/ventas/VentaListScreen';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';

type Seccion = 'compras' | 'ventas';

export function ComercialScreen() {
  const { user } = useAuth();
  const config = useClientConfig();
  const puedeCompras = config.modulosHabilitados.includes('compras');
  const puedeVentas = config.modulosHabilitados.includes('ventas') && user?.rol === 'administrador';
  const opciones = useMemo<Seccion[]>(() => [
    ...(puedeCompras ? ['compras' as const] : []),
    ...(puedeVentas ? ['ventas' as const] : []),
  ], [puedeCompras, puedeVentas]);
  const [seccion, setSeccion] = useState<Seccion>(puedeCompras ? 'compras' : 'ventas');

  useEffect(() => {
    if (!opciones.includes(seccion) && opciones[0]) setSeccion(opciones[0]);
  }, [opciones, seccion]);

  return (
    <View style={styles.root}>
      {opciones.length > 1 && (
        <View style={styles.switchWrap}>
          <View style={styles.switcher} accessibilityRole="tablist">
            <Opcion
              label="Compras"
              emoji="🛒"
              activa={seccion === 'compras'}
              onPress={() => setSeccion('compras')}
            />
            <Opcion
              label="Ventas"
              emoji="💰"
              activa={seccion === 'ventas'}
              onPress={() => setSeccion('ventas')}
            />
          </View>
        </View>
      )}

      <View style={styles.body}>
        {seccion === 'ventas' && puedeVentas
          ? <VentaListScreen />
          : <CompraListScreen />}
      </View>
    </View>
  );
}

function Opcion({
  label, emoji, activa, onPress,
}: {
  label: string;
  emoji: string;
  activa: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: activa }}
      style={({ pressed }) => [
        styles.option,
        activa && styles.optionActive,
        pressed && styles.optionPressed,
      ]}
    >
      <Text style={styles.optionEmoji}>{emoji}</Text>
      <Text style={[styles.optionLabel, activa && styles.optionLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgLight },
  switchWrap: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    backgroundColor: colors.white,
  },
  switcher: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.bgLight,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  option: {
    flex: 1,
    minHeight: 42,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  optionActive: { backgroundColor: colors.navyDeep },
  optionPressed: { opacity: 0.82 },
  optionEmoji: { fontSize: 16 },
  optionLabel: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as '700',
  },
  optionLabelActive: { color: colors.white },
  body: { flex: 1 },
});
