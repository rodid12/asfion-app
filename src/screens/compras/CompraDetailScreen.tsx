// CompraDetailScreen — vista read-only de una compra registrada.
//
// Igual que ParicionDetail: panel con todos los campos en formato legible
// agrupados por sección (Hacienda / Comercial / Logística) y un botón
// "Editar" abajo que abre el CompraForm en modo edición (con nav.replace
// para que back vaya directo al listado, no al detail).

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionHeading } from '@/components/SectionHeading';
import { SyncBadge } from '@/components/SyncBadge';
import { useRepository } from '@/data';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';
import type { RootStackParamList } from '@/navigation/types';
import type { Campo, Compra } from '@/data/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'CompraDetail'>;
type Rt = RouteProp<RootStackParamList, 'CompraDetail'>;

function fechaLarga(iso: string): string {
  const [yy, mm, dd] = iso.split('-').map(Number);
  if (!yy || !mm || !dd) return iso;
  const dt = new Date(yy, mm - 1, dd);
  const dow = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][dt.getDay()];
  const mes = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][mm - 1];
  return `${dow} ${dd} de ${mes} de ${yy}`;
}

export function CompraDetailScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const repo = useRepository();
  const compraId = route.params.compraId;

  const [compra, setCompra] = useState<Compra | null>(null);
  const [campo, setCampo] = useState<Campo | null>(null);
  const [loading, setLoading] = useState(true);

  // Cargar compra: cache primero (instant), después refresh.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cached = repo.listEventosCached('compra') as Compra[] | undefined;
        const fromCache = cached?.find(c => c.id === compraId);
        if (fromCache && !cancelled) {
          setCompra(fromCache);
          setLoading(false);
        }
        const all = (await repo.listEventos('compra')) as Compra[];
        const fresh = all.find(c => c.id === compraId);
        if (cancelled) return;
        if (!fresh) {
          Alert.alert('Compra no encontrada', 'Puede haber sido borrada.');
          nav.goBack();
          return;
        }
        setCompra(fresh);
      } catch (err) {
        if (!cancelled) {
          Alert.alert('Error', err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [compraId, repo, nav]);

  // Resolver nombre del campo.
  useEffect(() => {
    if (!compra) return;
    let cancelled = false;
    (async () => {
      try {
        const campos = await repo.listCampos();
        const c = campos.find(x => x.id === compra.campoId) ?? null;
        if (!cancelled) setCampo(c);
      } catch {
        // silencioso — id como fallback
      }
    })();
    return () => { cancelled = true; };
  }, [compra, repo]);

  // Total compra calculado (precio × kg destino — si ambos están)
  const total = useMemo(() => {
    if (!compra) return null;
    if (compra.precio == null || !Number.isFinite(compra.kgNetosDestino)) return null;
    return compra.precio * compra.kgNetosDestino;
  }, [compra]);

  if (loading && !compra) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.navy} size="large" />
        </View>
      </SafeAreaView>
    );
  }
  if (!compra) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header: N° operación + sync */}
        <View style={styles.headerRow}>
          <View style={styles.numBadge}>
            <Text style={styles.numTxt}>{compra.numeroOperacion ?? '(sin n°)'}</Text>
          </View>
          <SyncBadge state={compra.syncState ?? 'synced'} />
        </View>

        {/* Consignado destacado (siguiendo el orden de AppSheet del cliente:
            N° op → Consignado → Fecha → ...). */}
        {compra.consignado && (
          <Text style={styles.consignadoTxt}>{compra.consignado}</Text>
        )}

        <Text style={styles.fechaTxt}>{fechaLarga(compra.fecha)}</Text>

        {/* SECCIÓN: Hacienda (orden AppSheet: Cant → Kg origen → Kg destino → Merma) */}
        <Section title="Hacienda">
          <Row label="Campo" value={campo?.nombre ?? compra.campoId} />
          {compra.actividad && <Row label="Actividad" value={compra.actividad} />}
          {compra.cantCabYCat && (
            <Row label="Cantidad / categoría" value={compra.cantCabYCat} />
          )}
          <Row
            label="Kg origen"
            value={`${compra.kgNetosOrigen.toLocaleString('es-AR')} kg`}
          />
          <Row
            label="Kg destino"
            value={`${compra.kgNetosDestino.toLocaleString('es-AR')} kg`}
          />
          {compra.mermaPorcentaje != null && (
            <Row label="Merma %" value={`${compra.mermaPorcentaje.toFixed(2)} %`} />
          )}
          {compra.kgCorregidos != null && (
            <Row
              label="Kg corregidos"
              value={`${compra.kgCorregidos.toLocaleString('es-AR')} kg`}
            />
          )}
        </Section>

        {/* SECCIÓN: Logística (orden AppSheet: Km → DTE, antes de Comercial) */}
        {(compra.numeroDte || compra.kmRecorrido != null) && (
          <Section title="Logística">
            {compra.kmRecorrido != null && (
              <Row
                label="Km recorrido"
                value={`${compra.kmRecorrido.toLocaleString('es-AR')} km`}
              />
            )}
            {compra.numeroDte && <Row label="N° DTE" value={compra.numeroDte} />}
          </Section>
        )}

        {/* SECCIÓN: Comercial (Consignado ya está arriba) */}
        {(compra.precio != null || compra.titular || compra.plazo) && (
          <Section title="Comercial">
            {compra.precio != null && (
              <Row
                label="Precio"
                value={`$${compra.precio.toLocaleString('es-AR')} / kg`}
              />
            )}
            {total != null && (
              <Row
                label="Total estimado"
                value={`$${Math.round(total).toLocaleString('es-AR')}`}
                highlight
              />
            )}
            {compra.titular && <Row label="Titular" value={compra.titular} />}
            {compra.plazo && <Row label="Plazo" value={compra.plazo} />}
          </Section>
        )}

        {/* Observaciones */}
        {compra.observaciones && (
          <Section title="Observaciones">
            <Text style={styles.obsTxt}>{compra.observaciones}</Text>
          </Section>
        )}

        {/* Metadata */}
        <Section title="Metadata">
          <Row label="Cargado por" value={compra.usuarioEmail} small />
          {compra.createdAt && (
            <Row
              label="Fecha de carga"
              value={new Date(compra.createdAt).toLocaleString('es-AR')}
              small
            />
          )}
        </Section>

        <View style={{ height: spacing.lg }} />
      </ScrollView>

      {/* Action bar fijo abajo con botón Editar */}
      <View style={styles.actionBar}>
        <PrimaryButton
          label="Editar"
          onPress={() => nav.replace('CompraForm', { compraId: compra.id })}
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

function Row({ label, value, small, highlight }: { label: string; value: string; small?: boolean; highlight?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[styles.rowVal, small && styles.rowValSmall, highlight && styles.rowValHighlight]}
        numberOfLines={2}
      >
        {value}
      </Text>
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
  numBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.round,
    backgroundColor: colors.orange,
  },
  numTxt: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as '700',
    color: colors.navyDeep,
    letterSpacing: 0.5,
  },
  consignadoTxt: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold as '700',
    color: colors.textDark,
    marginTop: spacing.sm,
  },
  fechaTxt: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    marginBottom: spacing.lg,
    marginTop: 2,
  },

  section: { marginBottom: spacing.lg },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as '700',
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

  row: { flexDirection: 'row', paddingVertical: spacing.xs, alignItems: 'center' },
  rowLabel: { width: 130, fontSize: fontSize.md, color: colors.textMuted },
  rowVal: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium as '500',
    color: colors.textDark,
    textAlign: 'right',
  },
  rowValSmall: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: fontWeight.regular as '400' },
  rowValHighlight: {
    color: colors.navyDeep,
    fontWeight: fontWeight.bold as '700',
    fontSize: fontSize.lg,
  },

  obsTxt: { fontSize: fontSize.md, color: colors.textDark, lineHeight: 22 },

  actionBar: {
    padding: spacing.md,
    backgroundColor: colors.bgLight,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
});
