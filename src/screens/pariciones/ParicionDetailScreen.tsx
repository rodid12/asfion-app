// Detalle read-only de una parición.
//
// Decisión (post-Supabase, feedback Ro):
//   La card de la lista no muestra causa de muerte/aborto ni observaciones
//   por falta de espacio. Antes el tap iba directo al Form en edit mode,
//   lo que era engañoso (parecía que ibas a "ver" pero terminabas editando)
//   y peligroso (un swipe accidental podía modificar datos reales).
//
//   Esta pantalla restaura un "view" intermedio que:
//     - muestra TODOS los campos de la parición en formato legible
//     - tiene un FAB para entrar en edit mode (lleva al Form)
//
// Los otros 3 módulos (Lluvias, Mortandad, Pastoreo) NO tienen Detail
// intermedio porque su info entra completa en la card.

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionHeading } from '@/components/SectionHeading';
import { SyncBadge } from '@/components/SyncBadge';
import { useRepository } from '@/data';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';
import type { RootStackParamList } from '@/navigation/types';
import type { Campo, EventoParicion, Lote, Paricion } from '@/data/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ParicionDetail'>;
type Rt = RouteProp<RootStackParamList, 'ParicionDetail'>;

const COLOR_HEX: Record<string, string> = {
  Celeste: '#7EC4E8',
  Amarillo: '#F5C842',
  Blanca: '#F5F5F0',
  Naranja: '#E07B3C',
};

const EVENTO_PALETTE: Record<EventoParicion, { bg: string; fg: string }> = {
  Nacimiento: { bg: '#E6F4EC', fg: '#1B4332' },
  Muerte:     { bg: '#FBE4E3', fg: '#9B2F2D' },
  Aborto:     { bg: '#F7E6D5', fg: '#8E5A29' },
  Retacto:    { bg: '#F5EAD0', fg: '#8E6321' },
};

function fechaLarga(iso: string): string {
  const [yy, mm, dd] = iso.split('-').map(Number);
  if (!yy || !mm || !dd) return iso;
  const dt = new Date(yy, mm - 1, dd);
  const dow = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][dt.getDay()];
  const mes = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][mm - 1];
  return `${dow} ${dd} de ${mes} de ${yy}`;
}

export function ParicionDetailScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const repo = useRepository();
  const paricionId = route.params.paricionId;

  const [paricion, setParicion] = useState<Paricion | null>(null);
  const [campo, setCampo] = useState<Campo | null>(null);
  const [lote, setLote] = useState<Lote | null>(null);
  const [loading, setLoading] = useState(true);

  // Cargar parición desde el cache primero (instant), luego refresh.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cached = repo.listEventosCached('paricion') as Paricion[] | undefined;
        const fromCache = cached?.find(p => p.id === paricionId);
        if (fromCache && !cancelled) {
          setParicion(fromCache);
          setLoading(false);
        }
        // Refresh igual para asegurar consistencia con el server
        const evs = (await repo.listEventos('paricion')) as Paricion[];
        const fresh = evs.find(p => p.id === paricionId);
        if (cancelled) return;
        if (!fresh) {
          Alert.alert('Parición no encontrada', 'Puede haber sido borrada.');
          nav.goBack();
          return;
        }
        setParicion(fresh);
      } catch (err) {
        if (!cancelled) {
          Alert.alert('Error al cargar', err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [paricionId, repo, nav]);

  // Una vez tengo la parición, resuelvo nombres de campo y lote.
  useEffect(() => {
    if (!paricion) return;
    let cancelled = false;
    (async () => {
      try {
        const campos = await repo.listCampos();
        const c = campos.find(x => x.id === paricion.campoId) ?? null;
        if (!cancelled) setCampo(c);
        if (paricion.loteId) {
          const lotes = await repo.listLotes(paricion.campoId);
          const l = lotes.find(x => x.id === paricion.loteId) ?? null;
          if (!cancelled) setLote(l);
        }
      } catch {
        // silencioso — los nombres son nice-to-have, mostramos ids si falla
      }
    })();
    return () => { cancelled = true; };
  }, [paricion, repo]);

  const evPal = useMemo(
    () => (paricion ? EVENTO_PALETTE[paricion.evento as EventoParicion] : null),
    [paricion],
  );

  if (loading && !paricion) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.navy} size="large" />
        </View>
      </SafeAreaView>
    );
  }
  if (!paricion) return null;

  const causa = paricion.causaDetalle || paricion.causaTipo || paricion.causaMuerte;
  const tieneCaravana = paricion.caravanaColor || paricion.caravanaNumero;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header: evento + fecha */}
        <View style={styles.headerRow}>
          {evPal && (
            <View style={[styles.evBadge, { backgroundColor: evPal.bg }]}>
              <Text style={[styles.evBadgeTxt, { color: evPal.fg }]}>
                {paricion.evento}
              </Text>
            </View>
          )}
          <SyncBadge state={paricion.syncState ?? 'synced'} />
        </View>

        <Text style={styles.fechaTxt}>{fechaLarga(paricion.fecha)}</Text>

        {/* Ubicación */}
        <Section title="Ubicación">
          <Row label="Campo" value={campo?.nombre ?? paricion.campoId} />
          {paricion.loteId && (
            <Row label="Lote" value={lote?.nombre ?? paricion.loteId} />
          )}
        </Section>

        {/* Datos del animal */}
        <Section title="Animal">
          <Row label="Grupo" value={paricion.vacasGrupo ?? '—'} />
          {paricion.sexo && <Row label="Sexo" value={paricion.sexo} />}
          {tieneCaravana && (
            <View style={styles.caravanaRow}>
              <Text style={styles.rowLabel}>Caravana</Text>
              <View style={styles.caravanaVal}>
                {paricion.caravanaColor && (
                  <View style={[styles.swatch, { backgroundColor: COLOR_HEX[paricion.caravanaColor] }]} />
                )}
                <Text style={styles.caravanaTxt}>
                  {paricion.caravanaColor ?? ''}{paricion.caravanaColor && paricion.caravanaNumero ? ' · ' : ''}{paricion.caravanaNumero ?? ''}
                </Text>
              </View>
            </View>
          )}
        </Section>

        {/* Detalle del evento (asistencia, causa) */}
        {(paricion.asistencia || causa) && (
          <Section title="Detalle del evento">
            {paricion.asistencia && (
              <Row label="Asistencia" value={paricion.asistencia} />
            )}
            {causa && (
              <View style={styles.causaBox}>
                <Text style={styles.rowLabel}>Causa</Text>
                <Text style={styles.causaTxt}>{causa}</Text>
              </View>
            )}
          </Section>
        )}

        {/* Observaciones */}
        {paricion.observaciones && (
          <Section title="Observaciones">
            <Text style={styles.obsTxt}>{paricion.observaciones}</Text>
          </Section>
        )}

        {/* Metadata: quién y cuándo */}
        <Section title="Metadata">
          <Row label="Cargado por" value={paricion.usuarioEmail} small />
          {paricion.createdAt && (
            <Row label="Fecha de carga" value={new Date(paricion.createdAt).toLocaleString('es-AR')} small />
          )}
        </Section>

        <View style={{ height: spacing.lg }} />
      </ScrollView>

      {/* Botón fijo abajo: Editar — usa replace para no apilar Detail+Form en el stack */}
      <View style={styles.actionBar}>
        <PrimaryButton
          label="Editar"
          onPress={() => nav.replace('ParicionForm', { paricionId: paricion.id })}
        />
      </View>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <SectionHeading>{title}</SectionHeading>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowVal, small && styles.rowValSmall]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgLight },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: spacing.md, paddingBottom: spacing.xl },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  evBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.round,
  },
  evBadgeTxt: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  fechaTxt: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },

  section: { marginBottom: spacing.lg },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  sectionBody: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
  },

  row: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  rowLabel: {
    width: 110,
    fontSize: fontSize.md,
    color: colors.textMuted,
  },
  rowVal: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.textDark,
  },
  rowValSmall: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: fontWeight.regular,
  },

  caravanaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  caravanaVal: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  caravanaTxt: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.textDark,
  },

  causaBox: { paddingVertical: spacing.xs },
  causaTxt: {
    marginTop: 4,
    fontSize: fontSize.md,
    color: colors.textDark,
    lineHeight: 22,
  },

  obsTxt: {
    fontSize: fontSize.md,
    color: colors.textDark,
    lineHeight: 22,
  },

  actionBar: {
    padding: spacing.md,
    backgroundColor: colors.bgLight,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
});
