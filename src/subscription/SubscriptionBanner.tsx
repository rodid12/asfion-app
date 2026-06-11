// Banner de subscription — se renderea arriba del Home cuando el cliente
// está vencido (past_due o restricted).
//
// Colores y tono escalan con la severidad:
//   - past_due (días 1-7)    → naranja, tono recordatorio cortés
//   - restricted (días 8-19) → rojo, mensaje explícito de read-only
//   - suspended/canceled     → no se muestra acá, eso es el lockout screen
//   - active                 → no se muestra (queda fuera del árbol)

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';
import { bannerMessage } from '@/data/subscription';
import { useSubscription } from './useSubscription';

interface Props {
  /** Acción opcional — típicamente "Cómo regularizar" para abrir info / WhatsApp. */
  onActionPress?: () => void;
}

export function SubscriptionBanner({ onActionPress }: Props) {
  const sub = useSubscription();
  const insets = useSafeAreaInsets();
  if (sub.severity === 'info' || sub.severity === 'block') return null;

  const isWarning = sub.severity === 'warning';
  const bg = isWarning ? colors.orangeSoft : colors.danger;
  const fg = isWarning ? colors.navyDeep : colors.white;
  const msg = bannerMessage(sub.status, sub.data?.daysOverdue ?? 0);

  return (
    // paddingTop = inset del notch para que el bg del banner se extienda
    // hasta el borde superior de la pantalla. Las ScreenHeader internas
    // siguen aportando su propio padding para el título, así el navy del
    // header queda entre el banner y los cards de la lista.
    <View style={[styles.wrap, { backgroundColor: bg, paddingTop: spacing.sm + insets.top }]}>
      <View style={styles.content}>
        <Text style={[styles.icon, { color: fg }]}>{isWarning ? '⚠️' : '⛔'}</Text>
        <Text style={[styles.msg, { color: fg }]} numberOfLines={3}>
          {msg}
        </Text>
      </View>
      {onActionPress && (
        <Pressable
          onPress={onActionPress}
          style={({ pressed }) => [
            styles.cta,
            { borderColor: fg },
            pressed && { opacity: 0.7 },
          ]}
          hitSlop={6}
        >
          <Text style={[styles.ctaTxt, { color: fg }]}>Regularizar</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    // paddingTop dinámico (inset del notch) lo aporta el componente.
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  icon: { fontSize: 18 },
  msg: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold as '600',
    lineHeight: 18,
  },
  cta: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderRadius: radius.round,
  },
  ctaTxt: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold as '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
