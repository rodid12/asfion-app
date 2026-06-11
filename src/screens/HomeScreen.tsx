// Home v6 — rediseñado para la paleta oficial naranja+navy.
//
// Cambios:
//   - HEADER bg navyDeep ASIMÉTRICO: bottom-left muy curvado (radius 56),
//     bottom-right apenas (radius 12). Da sensación de flujo/dirección
//     que recuerda al swoosh del logo, sin necesidad de SVG.
//   - PILL DE NOVEDADES overlapping en el borde inferior del header
//     (left side). Naranja brand. Contenido dinámico:
//       1. Si hay pendientes de sync > 0 → "X sin sincronizar" (tappable, va al listado)
//       2. Si hubo pariciones hoy → "🐮 X hoy"
//       3. Si hubo pariciones esta semana → "🐮 X esta semana"
//       4. Si no hay nada → hide (no se renderiza)
//   - STATS ROW con strip lateral.
//   - 5 TILES NAVY iguales con bubble orange (no hero, igualdad).
//   - Footer ASFION con dots a los lados.
//
// Filosofía de color: NAVY dominante (60%) + WHITE neutral (30%) +
// ORANGE accent (10%) solo para CTAs y elementos primarios.

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
  /**
   * Si true, el tile se muestra SIEMPRE (independiente de clientConfig.modulosHabilitados)
   * con badge "PRÓXIMAMENTE". Útil para teasear módulos del roadmap que todavía
   * no están implementados. Una vez que se habilita el módulo, se quita este flag
   * y se enchufan el go + el config.
   */
  tease?: boolean;
}

const TODOS_LOS_MODULOS: Modulo[] = [
  { key: 'pariciones', label: 'Pariciones', emoji: '🐮', descripcion: 'Nacimientos, muertes, abortos, retactos', go: nav => nav.navigate('ParicionForm', {}) },
  { key: 'lluvias',    label: 'Lluvias',    emoji: '🌧️', descripcion: 'Milímetros por pluviómetro',           go: nav => nav.navigate('LluviaForm', {}) },
  { key: 'mortandad',  label: 'Mortandad',  emoji: '⚠️', descripcion: 'Hacienda muerta (no parto)',           go: nav => nav.navigate('MortandadForm', {}) },
  { key: 'pastoreo',   label: 'Pastoreo',   emoji: '🌾', descripcion: 'Movimiento de hacienda',                go: nav => nav.navigate('PastoreoForm', {}) },
  { key: 'compras',    label: 'Compras',    emoji: '🛒', descripcion: 'Compra de hacienda',                    go: nav => nav.navigate('CompraForm', {}) },
  { key: 'mediciones', label: 'Mediciones', emoji: '📏', descripcion: 'Pesadas, condición, forraje' },
  // Teaser: aparece en el Home con badge PRÓXIMAMENTE para todos los clientes,
  // sin requerir entrada en modulosHabilitados. Cuando se implemente Ventas,
  // borrar el tease, agregar el `go` y dar de alta en config de cada cliente.
  { key: 'ventas',     label: 'Ventas',     emoji: '💰', descripcion: 'Operaciones de venta de hacienda',     tease: true },
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

  const modulos = useMemo(
    () => TODOS_LOS_MODULOS
      // Tease modules se muestran siempre, independiente del clientConfig.
      // Los demás solo si están en modulosHabilitados.
      .filter(m => m.tease || clientConfig.modulosHabilitados.includes(m.key))
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

  useEffect(() => {
    const unsub = nav.addListener('focus', refresh);
    return unsub;
  }, [nav, refresh]);
  useEffect(() => {
    if (currentTab === 'menu') refresh();
  }, [currentTab, refresh]);

  const nombreUsuario = primerNombre(user?.email, user?.nombre);

  // Pill de "novedades" overlapping en el bottom del header.
  // Mostramos la info más relevante: pendientes > pariciones hoy > semana.
  // Si no hay nada que destacar, el componente no se renderiza.
  const novedad = useMemo<null | { emoji: string; text: string; onPress?: () => void }>(() => {
    if (pendientes > 0) {
      return {
        emoji: '⚠️',
        text: `${pendientes} sin sincronizar`,
        onPress: () => switchTab('lista'),
      };
    }
    if (paricionesHoy > 0) {
      return {
        emoji: '🐮',
        text: `${paricionesHoy} ${paricionesHoy === 1 ? 'parición' : 'pariciones'} hoy`,
      };
    }
    if (paricionesSemana > 0) {
      return {
        emoji: '🐮',
        text: `${paricionesSemana} esta semana`,
      };
    }
    return null;
  }, [pendientes, paricionesHoy, paricionesSemana, switchTab]);

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
    <View style={styles.safe}>
      {/* HEADER FULL-BLEED navy deep.
          IMPORTANTE: el bg navy va en un <View> que envuelve al SafeAreaView,
          NO en el SafeAreaView mismo. Algunas versiones de
          react-native-safe-area-context añaden un wrapper interno que no toma
          el backgroundColor, dejando ver el cream del parent. Esta estructura
          garantiza navy en toda la zona del header (incluida la del notch). */}
      <View style={styles.headerWrap}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerInner}>{/* avatar + saludo + salir */}
          <View style={styles.avatar}>
            <Text style={styles.avatarTxt}>
              {(nombreUsuario || user?.email || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.clientTop} numberOfLines={1}>
              {clientConfig.branding.nombre}
            </Text>
            <Text style={styles.hello} numberOfLines={1}>
              Hola{nombreUsuario ? `, ${nombreUsuario}` : ''}
            </Text>
            <Text style={styles.rol} numberOfLines={1}>
              <Text>{user?.rol ?? '—'}</Text>
              {user?.email ? (
                <Text style={styles.emailInline}> · {user.email}</Text>
              ) : null}
            </Text>
          </View>
          <Pressable
            onPress={logout}
            style={styles.logoutBtn}
            accessibilityRole="button"
            accessibilityLabel="Salir de la sesión"
            hitSlop={8}
          >
            <Text style={styles.logoutTxt}>Salir</Text>
          </Pressable>
        </View>
        </SafeAreaView>
      </View>

      {/* Pill de novedades COLGANDO del borde inferior del header navy.
          Va afuera del headerWrap para que pueda overlapear la transición
          navy → cream con sombra propia. */}
      {novedad && (
        <View style={styles.novedadesWrap}>
          {novedad.onPress ? (
            <Pressable
              onPress={novedad.onPress}
              style={({ pressed }) => [styles.novedadesPill, pressed && styles.novedadesPillPressed]}
              accessibilityRole="button"
            >
              <Text style={styles.novedadesEmoji}>{novedad.emoji}</Text>
              <Text style={styles.novedadesText}>{novedad.text}</Text>
            </Pressable>
          ) : (
            <View style={styles.novedadesPill}>
              <Text style={styles.novedadesEmoji}>{novedad.emoji}</Text>
              <Text style={styles.novedadesText}>{novedad.text}</Text>
            </View>
          )}
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Stats */}
        <View style={styles.statsRow}>
          <StatCard
            value={paricionesHoy}
            label="HOY"
            variant={paricionesHoy > 0 ? 'lime' : 'default'}
          />
          <StatCard value={paricionesSemana} label="SEMANA" />
          <StatCard
            value={pendientes}
            label="SIN SYNC"
            variant={pendientes > 0 ? 'warn' : 'default'}
            onPress={pendientes > 0 ? () => switchTab('lista') : undefined}
          />
        </View>

        {/* Sección */}
        <View style={styles.sectionRow}>
          <Text style={styles.section}>CARGAR EVENTO</Text>
          <View style={styles.sectionLine} />
        </View>

        {/* GRID uniforme: 5 tiles del mismo tamaño en 2 columnas.
            Si la cantidad es impar, el último tile se centra en su fila
            (vs. quedar pegado a la izquierda). */}
        <View style={styles.modulesGrid}>
          {modulos.map((m, idx) => {
            const isLastOdd = modulos.length % 2 === 1 && idx === modulos.length - 1;
            return (
            <Pressable
              key={m.key}
              onPress={() => onModuloPress(m)}
              style={({ pressed }) => [
                styles.tile,
                isLastOdd && styles.tileCentered,
                pressed && styles.tilePressed,
                !m.enabled && styles.tileDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel={m.label}
            >
              <View style={styles.tileTopRow}>
                <View style={[
                  styles.tileEmojiBubble,
                  !m.enabled && styles.tileEmojiBubbleDisabled,
                ]}>
                  <Text style={styles.tileEmojiTxt}>{m.emoji}</Text>
                </View>
                {!m.enabled && (
                  <View style={styles.soonBadge}>
                    <Text style={styles.soonBadgeTxt}>PRÓXIMAMENTE</Text>
                  </View>
                )}
              </View>
              <Text style={[
                styles.tileLabel,
                !m.enabled && styles.tileLabelDisabled,
              ]} numberOfLines={1}>
                {m.label}
              </Text>
              <Text style={[
                styles.tileDesc,
                !m.enabled && styles.tileDescDisabled,
              ]} numberOfLines={2}>
                {m.descripcion}
              </Text>
            </Pressable>
            );
          })}
        </View>

        {/* Footer ASFION */}
        <View style={styles.asfionFooter}>
          <View style={styles.asfionDot} />
          <Text style={styles.asfionTxt}>Powered by ASFiON</Text>
          <View style={styles.asfionDot} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgLight },

  // ---- HEADER full-bleed navy ----
  // Sin ningún borderRadius: el navy termina con una línea horizontal
  // recta que se conecta directo con el cream del body. Sin "rectángulo
  // fantasma" del color del fondo asomando por ningún lado.
  headerWrap: {
    backgroundColor: colors.navyDeep,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg + spacing.sm, // espacio extra para que la pill cuelgue
  },

  // ---- PILL de novedades (colgando bottom-right del header) ----
  // marginTop negativo para que overlapee el borde inferior del header navy.
  novedadesWrap: {
    marginTop: -16,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.base,
    alignItems: 'flex-end',
  },
  novedadesPill: {
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
  novedadesPillPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  novedadesEmoji: {
    fontSize: 14,
  },
  novedadesText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: fontWeight.bold as '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.orange,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: {
    fontSize: 20,
    fontWeight: fontWeight.bold as '700',
    color: colors.navyDeep,
  },
  clientTop: {
    fontSize: 10,
    color: colors.orange,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    fontWeight: fontWeight.bold as '700',
    marginBottom: 2,
  },
  hello: {
    fontSize: 20,
    fontWeight: fontWeight.bold as '700',
    color: colors.white,
    lineHeight: 24,
  },
  rol: {
    fontSize: 11,
    color: colors.textOnDarkMuted,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  emailInline: { textTransform: 'none' },
  logoutBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.orange,
    backgroundColor: 'transparent',
  },
  logoutTxt: {
    color: colors.orange,
    fontWeight: fontWeight.bold as '700',
    fontSize: fontSize.sm,
  },

  // ---- BODY scroll ----
  scroll: {
    paddingHorizontal: spacing.base,
    paddingTop: 0,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },

  // ---- Stats ----
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },

  // ---- Section heading ----
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  section: {
    fontSize: 11,
    fontWeight: fontWeight.bold as '700',
    color: colors.navy,
    letterSpacing: 1.4,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderSoft,
  },

  // ---- TILES grid uniforme (2 columnas, todos navy con orange) ----
  // Filosofía: cada tile = mini-hero card. Navy bg + bubble naranja
  // grande + label blanco + desc en gris claro. Da color y "peso visual"
  // a los 5 módulos por igual. Más memorable que 5 tiles blancos.
  modulesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  tile: {
    // Sin flexGrow: si el tile queda solo en su fila no debe estirarse al 100%.
    // Ancho fijo en 48% para que se vea igual estando solo o acompañado.
    width: '48%',
    minHeight: 150,
    backgroundColor: colors.navy,
    borderRadius: radius.lg,
    padding: spacing.base,
    gap: spacing.sm,
    justifyContent: 'space-between',
    shadowColor: colors.navyDeep,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  tilePressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
  },
  tileDisabled: { opacity: 0.55 },
  // Cuando la cantidad de módulos es impar, el último queda solo en su fila.
  // Lo centramos con margin auto en ambos lados (en vez de quedar pegado a la izquierda).
  tileCentered: {
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  tileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Bubble del emoji con orangeTile (#FFB97A) — variante un poco más vivida
  // del peach orangeSoft (#FFCB95) que se usa en las etiquetas de caravana.
  // El bump compensa el "chromatic adaptation": rodeado de navy oscuro, el
  // peach claro se ve más pálido. Con orangeTile sobre navy el ojo lo
  // percibe como el mismo tono que el orangeSoft sobre las cards blancas.
  tileEmojiBubble: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.orangeTile,
    alignItems: 'center', justifyContent: 'center',
  },
  tileEmojiBubbleDisabled: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tileEmojiTxt: { fontSize: 28 },
  tileLabel: {
    fontSize: 20,
    fontWeight: fontWeight.bold as '700',
    color: colors.white,
    letterSpacing: 0.2,
  },
  tileLabelDisabled: { color: colors.textOnDarkMuted },
  tileDesc: {
    fontSize: 12,
    color: colors.textOnDarkMuted,
    lineHeight: 16,
    marginTop: 2,
  },
  tileDescDisabled: { color: colors.textOnDarkMuted },

  soonBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
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

  // ---- Footer ----
  asfionFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  asfionDot: {
    width: 5, height: 5, borderRadius: 2.5,
    backgroundColor: colors.orange,
    opacity: 0.5,
  },
  asfionTxt: {
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    fontWeight: fontWeight.semibold as '600',
  },
});
