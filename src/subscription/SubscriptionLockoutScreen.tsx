// SubscriptionLockoutScreen — pantalla que reemplaza el Home cuando el cliente
// está suspended (días 20+) o canceled.
//
// Filosofía: NUNCA tomamos los datos del cliente como rehenes. El lockout
// permite:
//   - Ver la app en read-only (con un banner explicando la situación).
//   - Logout normal (para que prueben re-login si recién pagaron).
//   - Acción de "Hablar con ASFION" (deeplink a WhatsApp / email).
//
// Lo que NO permite:
//   - Cargar eventos nuevos (RLS lo bloquearía igual a nivel DB).
//   - Acceso al resto de la app por defecto (menos confuso que mostrar tabs
//     que no funcionan).

import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';
import { bannerMessage } from '@/data/subscription';
import { useSubscription } from './useSubscription';
import { useAuth } from '@/auth/context';

// Formato wa.me: código país (54) + 9 para móvil ARG + código de área sin 0
// (387 = Salta) + número (4159482). Sin espacios, sin guiones, sin +.
const SOPORTE_WHATSAPP = '5493874159482';
const SOPORTE_EMAIL = 'soporte@asfion.com';

interface Props {
  onSeeData?: () => void;
}

export function SubscriptionLockoutScreen({ onSeeData }: Props) {
  const sub = useSubscription();
  const { logout } = useAuth();

  const msg = bannerMessage(sub.status, sub.data?.daysOverdue ?? 0);

  const openWhatsApp = () => {
    const url = `https://wa.me/${SOPORTE_WHATSAPP}?text=Hola,%20necesito%20regularizar%20el%20pago%20de%20mi%20cuenta.`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`mailto:${SOPORTE_EMAIL}`);
    });
  };

  return (
    <View style={styles.safe}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>⛔</Text>
        </View>

        <Text style={styles.title}>
          {sub.status === 'canceled' ? 'Cuenta cancelada' : 'Cuenta suspendida'}
        </Text>
        <Text style={styles.body}>{msg}</Text>

        <View style={styles.actions}>
          <Pressable
            onPress={openWhatsApp}
            style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.btnPrimaryTxt}>Hablar con ASFION</Text>
          </Pressable>

          {onSeeData && sub.status !== 'canceled' && (
            <Pressable
              onPress={onSeeData}
              style={({ pressed }) => [styles.btnSecondary, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.btnSecondaryTxt}>Ver mis datos (sin cargar nuevos)</Text>
            </Pressable>
          )}

          <Pressable
            onPress={logout}
            style={({ pressed }) => [styles.btnGhost, pressed && { opacity: 0.7 }]}
            hitSlop={8}
          >
            <Text style={styles.btnGhostTxt}>Cerrar sesión</Text>
          </Pressable>
        </View>

        <Text style={styles.footnote}>
          Tus datos están seguros. Una vez que regularices el pago, todo vuelve
          a la normalidad sin pérdida de información.
        </Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navyDeep },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.orangeSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  icon: { fontSize: 48 },
  title: {
    fontSize: 28,
    fontWeight: fontWeight.bold as '700',
    color: colors.white,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: fontSize.md,
    color: colors.textOnDarkMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  actions: {
    width: '100%',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  btnPrimary: {
    backgroundColor: colors.orange,
    paddingVertical: 14,
    borderRadius: radius.round,
    alignItems: 'center',
  },
  btnPrimaryTxt: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as '700',
    letterSpacing: 0.3,
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.white,
    alignItems: 'center',
  },
  btnSecondaryTxt: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold as '600',
  },
  btnGhost: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  btnGhostTxt: {
    color: colors.textOnDarkMuted,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold as '600',
    textDecorationLine: 'underline',
  },
  footnote: {
    fontSize: fontSize.xs,
    color: colors.textOnDarkMuted,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: spacing.md,
  },
});
