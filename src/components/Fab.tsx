// FAB (Floating Action Button) — el "+" naranja brand abajo a la derecha
// en pantallas tipo lista. Permite cargar una nueva entidad sin volver al
// Home. Naranja porque es la acción primaria de la pantalla (CTA).

import React from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '@/theme/colors';
import { fontWeight } from '@/theme/typography';
import { useSubscription } from '@/subscription';

interface Props {
  onPress: () => void;
  label?: string;
  accessibilityLabel?: string;
}

export function Fab({ onPress, label = '+', accessibilityLabel = 'Nueva carga' }: Props) {
  // El FAB se deshabilita cuando el cliente no puede escribir (status
  // restricted+). Visualmente queda más opaco; al tap muestra un alert
  // explicando por qué. Hacer esto a nivel del FAB compartido evita
  // duplicar lógica en los 5 listados.
  const sub = useSubscription();
  const disabled = !sub.canWrite;

  const handlePress = () => {
    if (disabled) {
      Alert.alert(
        'Carga deshabilitada',
        'La cuenta está en mora. No se pueden cargar eventos nuevos hasta regularizar el pago.',
      );
      return;
    }
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.fab, disabled && styles.disabled, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
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
    backgroundColor: colors.orange,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  // Deshabilitado por mora: bg gris + texto navy desaturado. Sigue tocable
  // para mostrar el alert, no usamos pointerEvents:'none' a propósito.
  disabled: {
    backgroundColor: colors.borderSoft,
    shadowOpacity: 0.08,
  },
  label: {
    fontSize: 32,
    fontWeight: fontWeight.bold as '700',
    color: colors.navyDeep,
    lineHeight: 34,
  },
});
