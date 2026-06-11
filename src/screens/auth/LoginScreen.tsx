// LoginScreen con branding del cliente.
//
// El cliente (la empresa ganadera) quiere ver SU marca al entrar — no la de
// ASFION. Por eso mostramos el nombre del cliente prominente arriba, con un
// "badge" de iniciales como logo placeholder. ASFION queda como footer
// discreto al pie para que se entienda de dónde viene la herramienta.
//
// El branding se edita en src/config/client.ts.

import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAuth } from '@/auth/context';
import { clientBranding } from '@/config/client';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Email requerido');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err) {
      Alert.alert('No pudimos iniciar sesión', err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };


  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Branding del cliente + logo oficial ASFION arriba */}
          <View style={styles.clientBrand}>
            <Image
              source={require('../../../assets/icon.png')}
              style={styles.logoImg}
              resizeMode="contain"
            />
            <Text style={styles.clientName}>{clientBranding.nombre}</Text>
            {clientBranding.tagline ? (
              <Text style={styles.clientTagline}>{clientBranding.tagline}</Text>
            ) : null}
          </View>

          <View style={{ height: spacing.xxl }} />

          <FormField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="tu@empresa.com"
          />
          <FormField
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
          />

          <PrimaryButton label="ENTRAR" onPress={onSubmit} loading={loading} />

          <Text style={styles.hint}>
            Demo: cualquier email funciona. "admin" → administrador,
            "moderador" → moderador, otro → operario.
          </Text>
        </ScrollView>

        {/* Footer ASFION discreto */}
        <View style={styles.asfionFooter}>
          <View style={styles.asfionDot} />
          <Text style={styles.asfionTxt}>Powered by ASFION</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navyDeep },
  scroll: {
    padding: spacing.xl,
    justifyContent: 'center',
    flexGrow: 1,
  },

  // Client brand block
  clientBrand: {
    alignItems: 'center',
    gap: spacing.md,
  },
  // El icon.png oficial es cuadrado (1024x1024) con el wordmark dentro.
  // Lo mostramos a 140x140 con bordes redondeados, como una "app icon preview"
  // — replica el aspecto que va a tener en el home screen del iPhone.
  logoImg: {
    width: 140,
    height: 140,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  clientName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.black as '900',
    color: colors.white,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginTop: spacing.sm,
  },
  clientTagline: {
    fontSize: fontSize.sm,
    color: colors.textOnDarkMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  hint: {
    color: colors.textOnDarkMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.xl,
    fontStyle: 'italic',
    textAlign: 'center',
  },

  // ASFION footer
  asfionFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  asfionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.orange,
    opacity: 0.7,
  },
  asfionTxt: {
    fontSize: fontSize.xs,
    color: colors.textOnDarkMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    opacity: 0.6,
    fontWeight: fontWeight.semibold as '600',
  },
});
