// Detalle read-only de una venta con exportación PDF por operación.
//
// Antes tocar una card abría directamente el formulario de edición y Ventas
// no tenía ningún punto desde el cual generar el PDF. Este detalle replica el
// flujo de Compras: card -> detalle -> Exportar PDF / Editar.

import React, { useEffect, useState } from 'react';
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
import type { Campo, Venta, VentaGrupo } from '@/data/types';
import type { RootStackParamList } from '@/navigation/types';
import { exportarPDF, fechaLargaES, type PdfSection } from '@/lib/pdfExport';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';

type Nav = NativeStackNavigationProp<RootStackParamList, 'VentaDetail'>;
type Rt = RouteProp<RootStackParamList, 'VentaDetail'>;

const numero = (n: number, decimales = 2) => n.toLocaleString('es-AR', {
  minimumFractionDigits: decimales,
  maximumFractionDigits: decimales,
});

function filasGrupo(g: VentaGrupo): PdfSection {
  return {
    title: `Categoría ${g.orden}`,
    rows: [
      { label: 'Cantidad / categoría', value: g.cantCabYCat },
      { label: 'Cabezas', value: g.cabezas.toLocaleString('es-AR') },
      { label: 'Kg brutos', value: `${numero(g.kgBrutos)} kg` },
      { label: 'Kg netos (−8%)', value: `${numero(g.kgNetos)} kg` },
      { label: 'Kg promedio', value: `${numero(g.kgPromedio)} kg/cab` },
      { label: 'Precio', value: `$${numero(g.precio)} / kg` },
    ],
  };
}

export function VentaDetailScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const repo = useRepository();
  const ventaId = route.params.ventaId;

  const [venta, setVenta] = useState<Venta | null>(null);
  const [campo, setCampo] = useState<Campo | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const cached = repo.listEventosCached('venta') as Venta[] | undefined;
        const cacheHit = cached?.find(v => v.id === ventaId);
        if (cacheHit && !cancelado) {
          setVenta(cacheHit);
          setLoading(false);
        }

        const [ventas, campos] = await Promise.all([
          repo.listEventos('venta') as Promise<Venta[]>,
          repo.listCampos(),
        ]);
        if (cancelado) return;
        const fresh = ventas.find(v => v.id === ventaId);
        if (!fresh) {
          Alert.alert('Venta no encontrada', 'Puede haber sido eliminada.');
          nav.goBack();
          return;
        }
        setVenta(fresh);
        setCampo(campos.find(c => c.id === fresh.campoId) ?? null);
      } catch (err) {
        if (!cancelado) {
          Alert.alert('Error al cargar la venta', err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, [ventaId, repo, nav]);

  // Si la venta salió instantáneamente del cache, resolver también el campo
  // mientras llega el refresh paralelo.
  useEffect(() => {
    if (!venta || campo) return;
    let cancelado = false;
    repo.listCampos()
      .then(campos => {
        if (!cancelado) setCampo(campos.find(c => c.id === venta.campoId) ?? null);
      })
      .catch(() => undefined);
    return () => { cancelado = true; };
  }, [venta, campo, repo]);

  const onExportarPDF = async () => {
    if (!venta || exportando) return;
    setExportando(true);
    try {
      const secciones: PdfSection[] = [
        {
          title: 'Identificación',
          rows: [
            { label: 'Campo', value: campo?.nombre ?? venta.campoId },
            { label: 'Fecha', value: fechaLargaES(venta.fecha) },
            { label: 'Correlativo / operación', value: venta.correlativo },
            { label: 'Tropa', value: venta.tropa },
            { label: 'Número DTE', value: venta.numeroDte },
          ],
        },
        ...venta.grupos.map(filasGrupo),
        {
          title: 'Comercial',
          rows: [
            { label: 'Consignado', value: venta.consignado },
            { label: 'Titular', value: venta.titular },
            { label: 'Pago', value: venta.pago },
            { label: 'Frigorífico', value: venta.frigorifico },
            {
              label: 'Importe total',
              value: venta.importeTotal != null
                ? `$${numero(venta.importeTotal)}`
                : 'No informado',
            },
          ],
        },
      ];

      const nombreSeguro = venta.correlativo.replace(/[^a-zA-Z0-9_-]+/g, '-');
      await exportarPDF(
        {
          titulo: `Venta ${venta.correlativo}`,
          subtitulo: `${fechaLargaES(venta.fecha)} · ${venta.frigorifico}`,
          cargadoPor: venta.usuarioEmail,
          createdAt: venta.createdAt,
          secciones,
          observaciones: venta.observaciones,
        },
        `venta-${nombreSeguro || venta.id}`,
      );
    } finally {
      setExportando(false);
    }
  };

  if (loading && !venta) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.loading}><ActivityIndicator color={colors.navy} size="large" /></View>
      </SafeAreaView>
    );
  }
  if (!venta) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <View style={styles.opBadge}><Text style={styles.opText}>{venta.correlativo}</Text></View>
          <SyncBadge state={venta.syncState} />
        </View>
        <Text style={styles.title}>{venta.frigorifico}</Text>
        <Text style={styles.subtitle}>{fechaLargaES(venta.fecha)}</Text>

        <Section title="Identificación">
          <Row label="Campo" value={campo?.nombre ?? venta.campoId} />
          <Row label="Tropa" value={venta.tropa} />
          <Row label="Número DTE" value={venta.numeroDte} />
        </Section>

        {venta.grupos.map(g => (
          <Section key={g.orden} title={`Categoría ${g.orden}`}>
            <Row label="Cantidad / categoría" value={g.cantCabYCat} />
            <Row label="Cabezas" value={g.cabezas.toLocaleString('es-AR')} />
            <Row label="Kg brutos" value={`${numero(g.kgBrutos)} kg`} />
            <Row label="Kg netos (−8%)" value={`${numero(g.kgNetos)} kg`} />
            <Row label="Kg promedio" value={`${numero(g.kgPromedio)} kg/cab`} />
            <Row label="Precio" value={`$${numero(g.precio)} / kg`} />
          </Section>
        ))}

        <Section title="Comercial">
          <Row label="Consignado" value={venta.consignado} />
          <Row label="Titular" value={venta.titular} />
          <Row label="Pago" value={venta.pago} />
          {venta.importeTotal != null && (
            <Row label="Importe total" value={`$${numero(venta.importeTotal)}`} highlight />
          )}
        </Section>

        {venta.observaciones ? (
          <Section title="Observaciones">
            <Text style={styles.obs}>{venta.observaciones}</Text>
          </Section>
        ) : null}

        <Section title="Metadata">
          <Row label="Cargado por" value={venta.usuarioEmail} small />
          <Row label="Fecha de carga" value={new Date(venta.createdAt).toLocaleString('es-AR')} small />
        </Section>
      </ScrollView>

      <View style={styles.actionBar}>
        <View style={styles.actionHalf}>
          <PrimaryButton
            label={exportando ? 'Generando…' : 'Exportar PDF'}
            variant="ghost"
            onPress={onExportarPDF}
            loading={exportando}
            disabled={exportando}
          />
        </View>
        <View style={styles.actionHalf}>
          <PrimaryButton
            label="Editar"
            onPress={() => nav.replace('VentaForm', { ventaId: venta.id })}
          />
        </View>
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

function Row({
  label,
  value,
  small,
  highlight,
}: {
  label: string;
  value: string;
  small?: boolean;
  highlight?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[styles.rowValue, small && styles.rowSmall, highlight && styles.rowHighlight]}
        numberOfLines={3}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgLight },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.md, paddingBottom: spacing.xl },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  opBadge: { backgroundColor: colors.orange, borderRadius: radius.round, paddingHorizontal: spacing.md, paddingVertical: 6 },
  opText: { color: colors.navyDeep, fontSize: fontSize.md, fontWeight: fontWeight.bold as '700' },
  title: { color: colors.textDark, fontSize: fontSize.lg, fontWeight: fontWeight.bold as '700', marginTop: spacing.md },
  subtitle: { color: colors.textMuted, fontSize: fontSize.md, marginTop: 2, marginBottom: spacing.lg },
  section: { marginBottom: spacing.lg },
  sectionBody: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs, gap: spacing.md },
  rowLabel: { width: 132, color: colors.textMuted, fontSize: fontSize.sm },
  rowValue: { flex: 1, color: colors.textDark, fontSize: fontSize.sm, fontWeight: fontWeight.medium as '500', textAlign: 'right' },
  rowSmall: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.regular as '400' },
  rowHighlight: { color: colors.navyDeep, fontSize: fontSize.md, fontWeight: fontWeight.bold as '700' },
  obs: { color: colors.textDark, fontSize: fontSize.md, lineHeight: 22 },
  actionBar: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.bgLight, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  actionHalf: { flex: 1 },
});
