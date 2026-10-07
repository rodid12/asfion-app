import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/context';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';

export function ClienteSelectorScreen() {
  const {
    user,
    clientesDisponibles,
    seleccionarCliente,
    seleccionandoCliente,
    logout,
  } = useAuth();
  const [clienteEnProceso, setClienteEnProceso] = useState<string | null>(null);

  const elegir = async (clienteId: string) => {
    if (seleccionandoCliente) return;
    setClienteEnProceso(clienteId);
    try {
      await seleccionarCliente(clienteId);
    } catch (error) {
      Alert.alert(
        'No pudimos abrir el cliente',
        error instanceof Error ? error.message : String(error),
      );
      setClienteEnProceso(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Image
          source={require('../../../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>VISTA DE SUPERADMINISTRADOR</Text>
          <Text style={styles.title}>Seleccioná un cliente</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{user?.email}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.help}>
          La app mostrará solamente los campos, módulos y eventos del cliente elegido.
        </Text>

        <View style={styles.list}>
          {clientesDisponibles.map(cliente => {
            const loading = seleccionandoCliente && clienteEnProceso === cliente.id;
            const modulos = cliente.modulosHabilitados.length;
            return (
              <Pressable
                key={cliente.id}
                onPress={() => elegir(cliente.id)}
                disabled={seleccionandoCliente}
                accessibilityRole="button"
                accessibilityLabel={`Abrir ${cliente.nombre}`}
                style={({ pressed }) => [
                  styles.card,
                  pressed && styles.cardPressed,
                  seleccionandoCliente && !loading && styles.cardDisabled,
                ]}
              >
                <View style={styles.initialCircle}>
                  <Text style={styles.initial}>{cliente.nombre.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.clientName}>{cliente.nombre}</Text>
                  {cliente.tagline ? (
                    <Text style={styles.tagline} numberOfLines={1}>{cliente.tagline}</Text>
                  ) : null}
                  <Text style={styles.modules}>
                    {modulos} {modulos === 1 ? 'módulo habilitado' : 'módulos habilitados'}
                  </Text>
                </View>
                {loading ? (
                  <ActivityIndicator color={colors.orange} />
                ) : (
                  <Text style={styles.arrow}>›</Text>
                )}
              </Pressable>
            );
          })}
        </View>

        {clientesDisponibles.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No hay clientes disponibles</Text>
            <Text style={styles.emptyText}>Revisá la configuración de la cuenta en el panel web.</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={logout} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.logout}>Cerrar sesión</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgLight },
  header: {
    backgroundColor: colors.navyDeep,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  logo: { width: 62, height: 62, borderRadius: radius.lg },
  headerText: { flex: 1 },
  eyebrow: {
    color: colors.orange,
    fontSize: 10,
    fontWeight: fontWeight.bold as '700',
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.white,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.black as '900',
  },
  subtitle: { color: colors.textOnDarkMuted, fontSize: fontSize.sm, marginTop: 2 },
  content: { padding: spacing.lg, gap: spacing.lg },
  help: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20 },
  list: { gap: spacing.md },
  card: {
    minHeight: 92,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.xl,
    padding: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    shadowColor: colors.navyDeep,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  cardPressed: { transform: [{ scale: 0.985 }], opacity: 0.9 },
  cardDisabled: { opacity: 0.55 },
  initialCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.orangeSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: colors.navyDeep,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.black as '900',
  },
  cardBody: { flex: 1 },
  clientName: {
    color: colors.navy,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold as '700',
  },
  tagline: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 },
  modules: { color: colors.orange, fontSize: fontSize.xs, fontWeight: fontWeight.semibold as '600', marginTop: 5 },
  arrow: { color: colors.orange, fontSize: 34, lineHeight: 36 },
  empty: { padding: spacing.xl, alignItems: 'center' },
  emptyTitle: { color: colors.navy, fontWeight: fontWeight.bold as '700' },
  emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
  footer: { alignItems: 'center', padding: spacing.lg },
  logout: { color: colors.danger, fontSize: fontSize.sm, fontWeight: fontWeight.semibold as '600' },
});
