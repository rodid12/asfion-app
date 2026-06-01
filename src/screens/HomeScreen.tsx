// Home: todos los módulos visibles + stats + CTA directa a cada uno.
//
// Evolución tras feedback:
//   - Los 5 módulos aparecen como tiles equivalentes (antes 4 estaban escondidos).
//   - Pariciones tiene tratamiento "destacado" (está activo); los demás muestran
//     "Próximamente" como badge en vez de desaparecer.
//   - El nombre del cliente y el rol del usuario aparecen arriba.
//   - Stats row se mantiene — el operario necesita ver "hoy cargué 3".

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { StatCard } from '@/components/StatCard';
import { useAuth } from '@/auth/context';
import { useRepository } from '@/data';
import { useClientConfig } from '@/config/ClientConfigContext';
import type { ModuloKey } from '@/config/types';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';
import type { RootStackParamList } from '@/navigation/types';
import { useTabNav } from '@/navigation/TabContext';

type Nav = NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;

interface Modulo {
  key: ModuloKey;
  label: string;
  emoji: string;
  descripcion: string;
  go?: (nav: Nav) => void;
}

// Catálogo COMPLETO de módulos del producto — todos los que ASFION sabe
// renderear. La home filtra por config.modulosHabilitados antes de mostrar
// los tiles, así que para un cliente que tiene solo Pariciones+Lluvias,
// solo se ven esos dos. La lógica de qué módulos existen vive acá; la lógica
// de qué módulos se habilitan vive en el ClientConfig.
const TODOS_LOS_MODULOS: Modulo[] = [
  {
    key: 'pariciones',
    label: 'Pariciones',
    emoji: '🐮',
    descripcion: 'Nacimientos, muertes, abortos, retactos',
    go: nav => nav.navigate('ParicionForm', {}),
  },
  {
    key: 'lluvias',
    label: 'Lluvias',
    emoji: '🌧️',
    descripcion: 'Milímetros por pluviómetro',
    go: nav => nav.navigate('LluviaForm', {}),
  },
  {
    key: 'mortandad',
    label: 'Mortandad',
    emoji: '⚠️',
    descripcion: 'Hacienda muerta (no parto)',
    go: nav => nav.navigate('MortandadForm', {}),
  },
  {
    key: 'pastoreo',
    label: 'Pastoreo',
    emoji: '🌾',
    descripcion: 'Movimiento de hacienda',
    go: nav => nav.navigate('PastoreoForm', {}),
  },
  {
    key: 'mediciones',
    label: 'Mediciones',
    emoji: '📏',
    descripcion: 'Pesadas, condición, forraje',
    // Sin "go" porque la ruta no existe todavía — si un cliente lo habilita
    // antes de implementarlo, va a mostrar un alert "próximamente".
  },
];

// ---------- helpers ----------

function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function primerNombre(email?: string, nombre?: string): string {
  if (nombre) return nombre.split(' ')[0] ?? '';
  if (!email) return '';
  const user = email.split('@')[0] ?? '';
  const first = user.split(/[.\-_]/)[0] ?? user;
  if (!first) return '';
  return first.charAt(0).toUpperCase() + first.slice(1);
}

// ---------- pantalla ----------

export function HomeScreen() {
  const nav = useNavigation<Nav>();
  const { user, logout } = useAuth();
  const repo = useRepository();
  const { switchTab, currentTab } = useTabNav();
  const clientConfig = useClientConfig();

  // Solo mostramos los módulos habilitados en la config del cliente. Si el
  // cliente solo tiene Pariciones+Lluvias, la grilla muestra 2 tiles.
  const modulos = useMemo(
    () => TODOS_LOS_MODULOS
      .filter(m => clientConfig.modulosHabilitados.includes(m.key))
      .map(m => ({ ...m, enabled: Boolean(m.go) })),
    [clientConfig],
  );

  const [pendientes, setPendientes] = useState(0);
  const [paricionesHoy, setParicionesHoy] = useState(0);
  const [paricionesSemana, setParicionesSemana] = useState(0);

  const refresh = useCallback(async () => {
    const [pendings, hoy, semana] = await Promise.all([
      repo.listPending(),
      repo.contarPariciones({ desde: isoToday() }),
      repo.contarPariciones({ desde: isoDaysAgo(6) }),
    ]);
    setPendientes(pendings.length);
    setParicionesHoy(hoy);
    setParicionesSemana(semana);
  }, [repo]);

  // Refrescar al volver al stack (ej: back desde ParicionForm) y al entrar al tab Menú.
  useEffect(() => {
    const unsub = nav.addListener('focus', refresh);
    return unsub;
  }, [nav, refresh]);
  useEffect(() => {
    if (currentTab === 'menu') refresh();
  }, [currentTab, refresh]);

  const nombreUsuario = primerNombre(user?.email, user?.nombre);

  // El tipo enriquecido viene del useMemo de arriba — cada módulo se enriquece
  // con un `enabled: Boolean(m.go)` (que indica si la ruta está implementada).
  // Un módulo habilitado en config pero sin "go" cae en "próximamente".
  const onModuloPress = (m: Modulo & { enabled: boolean }) => {
    if (!m.enabled) {
      Alert.alert(
        `${m.label} · Próximamente`,
        `Este módulo se va a habilitar en la próxima versión.\n\n${m.descripcion}.`,
      );
      return;
    }
    m.go?.(nav);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header: avatar + cliente + usuario + salir.
            Diseño revisitado (feedback Ro): jerarquía clara con avatar
            circular a la izquierda (iniciales del nombre o el primer char
            del email), nombre del cliente como eyebrow chico arriba, saludo
            grande y bold, rol+email en una línea sutil debajo. El botón
            Salir queda como icon button (chico, no robando el ojo). */}
        <View style={styles.headerRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTxt}>{(nombreUsuario || user?.email || '?').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.clientTop} numberOfLines={1}>
              {clientConfig.branding.nombre}
            </Text>
            <Text style={styles.hello} numberOfLines={1}>
              Hola{nombreUsuario ? `, ${nombreUsuario}` : ''}
            </Text>
            {/* Separamos rol y email en dos Text porque el `textTransform:
                capitalize` del style 'rol' aplicaba tambien al email y
                lo mostraba como "Agusufi20@Gmail.Com". Ahora el capitalize
                solo afecta al rol; el email queda en lowercase real. */}
            <Text style={styles.rol} numberOfLines={1}>
              <Text>{user?.rol ?? '—'}</Text>
              {user?.email ? (
                <Text style={styles.emailInline}> · {user.email}</Text>
              ) : null}
            </Text>
          </View>
          <Pressable onPress={logout} style={styles.logoutBtn} accessibilityRole="button" accessibilityLabel="Salir de la sesión">
            <Text style={styles.logoutTxt}>Salir</Text>
          </Pressable>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatCard
            value={paricionesHoy}
            label="HOY"
            variant={paricionesHoy > 0 ? 'lime' : 'default'}
          />
          <StatCard value={paricionesSemana} label="ESTA SEMANA" />
          <StatCard
            value={pendientes}
            label="SIN SYNC"
            variant={pendientes > 0 ? 'warn' : 'default'}
            onPress={pendientes > 0 ? () => switchTab('lista') : undefined}
          />
        </View>

        {/* Módulos */}
        <Text style={styles.section}>Cargar evento</Text>
        <View style={styles.modulesGrid}>
          {modulos.map(m => (
            <Pressable
              key={m.key}
              onPress={() => onModuloPress(m)}
              style={({ pressed }) => [
                styles.moduleTile,
                m.enabled ? styles.moduleActive : styles.moduleDisabled,
                pressed && styles.moduleTilePressed,
                // Antes Pariciones tenía tratamiento "hero" (ocupaba 2 columnas)
                // porque era el único módulo activo. Ahora que los 4 están
                // funcionales, todos los tiles son del mismo tamaño.
              ]}
              accessibilityRole="button"
              accessibilityLabel={m.label}
            >
              <View style={styles.moduleTopRow}>
                <View
                  style={[
                    styles.emojiBubble,
                    m.enabled ? styles.emojiBubbleActive : styles.emojiBubbleDisabled,
                  ]}
                >
                  <Text style={styles.emojiTxt}>{m.emoji}</Text>
                </View>
                {!m.enabled && (
                  <View style={styles.soonBadge}>
                    <Text style={styles.soonBadgeTxt}>PRÓXIMAMENTE</Text>
                  </View>
                )}
              </View>
              <Text
                style={[styles.moduleLabel, m.enabled ? styles.moduleLabelActive : styles.moduleLabelDisabled]}
              >
                {m.label}
              </Text>
              <Text
                style={[
                  styles.moduleDesc,
                  m.enabled ? styles.moduleDescActive : styles.moduleDescDisabled,
                ]}
                numberOfLines={2}
              >
                {m.descripcion}
              </Text>
            </Pressable>
          ))}
        </View>

        {/*
          Acá había un link standalone "Ver pariciones cargadas" leftover de
          cuando Pariciones era el único módulo de la app. Lo sacamos porque:
          (a) los otros 3 módulos no tienen un link equivalente — quedaba
              asimétrico.
          (b) el usuario ya tiene 2 vías mejores para ver el listado: la tab
              "Pariciones" en la bottom tab bar y el card "Pariciones" del
              grid de arriba (que abre el form, y desde Home → Métricas se
              ve el listado por tab).
          Si en algún momento queremos un "ver listado" rápido por módulo,
          conviene hacerlo CONSISTENTE para los 4 — no solo pariciones.
        */}

        {/* Footer ASFION */}
        <View style={styles.asfionFooter}>
          <View style={styles.asfionDot} />
          <Text style={styles.asfionTxt}>Powered by ASFION</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgLight },
  scroll: {
    padding: spacing.base,
    gap: spacing.lg,
    paddingBottom: spacing.xxxl,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  // Avatar circular: lima sobre fondo blanco con borde. Usa la primera
  // letra del nombre o email — bajita y robusta. Si tuviéramos foto del
  // usuario en perfil iría acá; mientras tanto inicial alcanza.
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.greenLime,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.greenDeep,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarTxt: {
    fontSize: 20,
    fontWeight: fontWeight.bold as '700',
    color: colors.greenDeep,
  },
  clientTop: {
    fontSize: 11,
    color: colors.greenDark,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    fontWeight: fontWeight.bold as '700',
    marginBottom: 2,
    opacity: 0.85,
  },
  hello: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold as '700',
    color: colors.textDark,
    lineHeight: 26,
  },
  rol: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  // Override para que el email NO se capitalice (era "Agusufi20@Gmail.Com"
  // por el textTransform heredado del style 'rol').
  emailInline: {
    textTransform: 'none',
  },
  logoutBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.greenDark,
    backgroundColor: colors.white,
  },
  logoutTxt: {
    color: colors.greenDark,
    fontWeight: fontWeight.bold as '700',
    fontSize: fontSize.sm,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },

  // Section
  section: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold as '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginTop: spacing.sm,
  },

  // Modules grid
  modulesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  moduleTile: {
    width: '48%',
    minHeight: 140,
    flexGrow: 1,
    borderRadius: radius.xl,
    padding: spacing.base,
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  moduleHero: {
    // Pariciones en la primera fila ocupa todo el ancho.
    width: '100%',
    minHeight: 120,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  moduleActive: {
    backgroundColor: colors.greenDark,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 4,
  },
  moduleDisabled: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  moduleTilePressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },

  moduleTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  emojiBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiBubbleActive: {
    backgroundColor: colors.greenLime,
  },
  emojiBubbleDisabled: {
    backgroundColor: colors.bgLight,
  },
  emojiTxt: { fontSize: 24 },

  soonBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    backgroundColor: colors.bgLight,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  soonBadgeTxt: {
    fontSize: 9,
    fontWeight: fontWeight.bold as '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },

  moduleLabel: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold as '700',
  },
  moduleLabelActive: { color: colors.white },
  moduleLabelDisabled: { color: colors.textDark },
  moduleDesc: {
    fontSize: fontSize.xs,
    lineHeight: 15,
  },
  moduleDescActive: { color: colors.textOnDarkMuted },
  moduleDescDisabled: { color: colors.textMuted },

  // Footer ASFION
  asfionFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  asfionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.greenLime,
    opacity: 0.6,
  },
  asfionTxt: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    opacity: 0.7,
    fontWeight: fontWeight.semibold as '600',
  },
});
