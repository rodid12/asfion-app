// PhotoStrip: tira de fotos opcional para asociar a un evento.
// Foto = OPCIONAL: el operario puede guardar sin foto.
// Hasta 3 fotos por evento (suficiente para mostrar caravana + animal + contexto).
//
// Las fotos se guardan como URIs locales (file://...) que después el sync
// sube al Supabase Storage y reemplaza por URLs públicas.
//
// Si expo-image-picker no está instalado (porque alguien actualizó la app sin
// correr npm install), mostramos un alert en vez de crashear.

import React, { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';

interface Props {
  fotos: string[];
  onChange: (fotos: string[]) => void;
  max?: number;
}

const MAX_DEFAULT = 3;

async function loadPicker() {
  try {
    // @ts-ignore - expo-image-picker es opcional; si falta el paquete, devolvemos null.
    return await import('expo-image-picker');
  } catch {
    return null;
  }
}

export function PhotoStrip({ fotos, onChange, max = MAX_DEFAULT }: Props) {
  const [busy, setBusy] = useState(false);

  const onAdd = async () => {
    if (fotos.length >= max) {
      Alert.alert('Máximo de fotos', `Hasta ${max} fotos por evento.`);
      return;
    }
    setBusy(true);
    try {
      const ImagePicker = await loadPicker();
      if (!ImagePicker) {
        Alert.alert(
          'Foto no disponible',
          'Falta instalar expo-image-picker. Ejecutá npm install y reiniciá.',
        );
        return;
      }
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permiso de cámara', 'Habilitá el acceso a la cámara desde Ajustes.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.6,           // suficiente para ver caravana, ahorra ancho de banda
        allowsEditing: false,
        exif: false,
      });
      if (!result.canceled && result.assets?.[0]) {
        onChange([...fotos, result.assets[0].uri]);
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const onRemove = (idx: number) => {
    Alert.alert('Eliminar foto', '¿Seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => onChange(fotos.filter((_, i) => i !== idx)) },
    ]);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        Fotos <Text style={styles.optional}>· opcional</Text>
      </Text>
      <View style={styles.strip}>
        {fotos.map((uri, i) => (
          <Pressable key={uri + i} onPress={() => onRemove(i)} style={styles.thumbWrap}>
            <Image source={{ uri }} style={styles.thumb} />
            <View style={styles.removeBadge}>
              <Text style={styles.removeBadgeTxt}>×</Text>
            </View>
          </Pressable>
        ))}
        {fotos.length < max ? (
          <Pressable
            onPress={onAdd}
            style={[styles.addBtn, busy && { opacity: 0.5 }]}
            disabled={busy}
            accessibilityRole="button"
          >
            <Text style={styles.addPlus}>+</Text>
            <Text style={styles.addLabel}>Foto</Text>
          </Pressable>
        ) : null}
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
  optional: {
    fontWeight: fontWeight.regular as '400',
    color: colors.textMuted,
    textTransform: 'none',
    letterSpacing: 0,
    fontStyle: 'italic',
  },
  strip: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  thumbWrap: {
    width: 80,
    height: 80,
    position: 'relative',
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    backgroundColor: colors.borderSoft,
  },
  removeBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  removeBadgeTxt: {
    color: colors.white,
    fontSize: 14,
    fontWeight: fontWeight.bold as '700',
    lineHeight: 14,
  },
  addBtn: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.greenDark,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgLight,
  },
  addPlus: {
    fontSize: 22,
    color: colors.greenDark,
    fontWeight: fontWeight.bold as '700',
    lineHeight: 22,
  },
  addLabel: {
    fontSize: fontSize.xs,
    color: colors.greenDark,
    fontWeight: fontWeight.semibold as '600',
    marginTop: 2,
  },
});
