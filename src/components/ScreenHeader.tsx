// ScreenHeader — header navy unificado para todas las pantallas de listado
// (y eventualmente forms y detalles).
//
// Estructura:
//   - SafeAreaView ENVUELTA en un <View> con bg navyDeep — garantiza que
//     el cream del parent no se filtre por el padding-top del notch.
//   - Título grande blanco + count chico en orange a su lado
//   - Pill de novedades opcional overlapping bottom-right (estilo Home)
//
// Uso:
//   <ScreenHeader title="Pariciones" count={142} />
//   <ScreenHeader title="Compras" count={47} novedad={{ emoji: '📦', text: '5 esta semana' }} />

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { fontWeight } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

export interface Novedad {
  emoji: string;
  text: string;
  onPress?: () => void;
}

interface Props {
  title: string;
  /** Contador opcional (ej: cantidad de eventos). Se muestra a la derecha del título en orange. */
  count?: number;
  /** Etiqueta del contador (default: "registros"). */
  countLabel?: string;
  /** Subtítulo opcional (ej: "Granja Norte · Lote 12"). Reemplaza al count cuando ambos están. */
  subtitle?: string;
  /** Si pasás onBack, se muestra un chevron izquierda como botón. */
  onBack?: () => void;
  /** Pill de novedades overlapping en el borde inferior derecho. */
  novedad?: Novedad | null;
}

export function ScreenHeader({ title, count, countLabel = 'registros', subtitle, onBack, novedad }: Props) {
  return (
    <>
      <View style={styles.headerWrap}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerInner}>
            {onBack && (
              <Pressable
                onPress={onBack}
                hitSlop={12}
                style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
                accessibilityRole="button"
                accessibilityLabel="Volver"
              >
                <Text style={styles.backTxt}>‹</Text>
              </Pressable>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
              {subtitle ? (
                <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
              ) : typeof count === 'number' ? (
                <Text style={styles.countLine}>
                  <Text style={styles.countNum}>{count.toLocaleString('es-AR')}</Text>
                  <Text style={styles.countLabel}> {countLabel}</Text>
                </Text>
              ) : null}
            </View>
          </View>
        </SafeAreaView>
      </View>

      {/* Pill overlapping el borde inferior. Va FUERA del header wrapper
          para no expandir la altura del header. */}
      {novedad && (
        <View style={styles.novedadesWrap}>
          {novedad.onPress ? (
            <Pressable
              onPress={novedad.onPress}
              style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
              accessibilityRole="button"
            >
              <Text style={styles.pillEmoji}>{novedad.emoji}</Text>
              <Text style={styles.pillText}>{novedad.text}</Text>
            </Pressable>
          ) : (
            <View style={styles.pill}>
              <Text style={styles.pillEmoji}>{novedad.emoji}</Text>
              <Text style={styles.pillText}>{novedad.text}</Text>
            </View>
          )}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    backgroundColor: colors.navyDeep,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  backBtn: {
    width: 36, height: 36,
    marginLeft: -8,
    marginRight: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnPressed: { opacity: 0.55 },
  backTxt: {
    color: colors.white,
    fontSize: 34,
    lineHeight: 36,
    fontWeight: fontWeight.regular as '400',
  },
  title: {
    fontSize: 32,
    fontWeight: fontWeight.bold as '700',
    color: colors.white,
    letterSpacing: 0.2,
    lineHeight: 36,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: colors.textOnDarkMuted,
    fontWeight: fontWeight.medium as '500',
  },
  countLine: {
    marginTop: 4,
  },
  countNum: {
    fontSize: 15,
    color: colors.orange,
    fontWeight: fontWeight.bold as '700',
  },
  countLabel: {
    fontSize: 15,
    color: colors.textOnDarkMuted,
    fontWeight: fontWeight.medium as '500',
  },

  // ---- Pill de novedades ----
  novedadesWrap: {
    marginTop: -16,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.base,
    alignItems: 'flex-end',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.orange,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 999,
    shadowColor: colors.orange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  pillPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  pillEmoji: { fontSize: 14 },
  pillText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: fontWeight.bold as '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
