// Form de Ventas — solo administradores.
//
// Cada operación tiene de 1 a 4 grupos. El usuario escribe la denominación
// completa (sin normalizar separadores), kg brutos y precio. La app muestra:
//   kg netos    = kg brutos × 0,92
//   kg promedio = kg netos / primer número de CANT CAB Y CAT
// La DB repite el cálculo al guardar para blindar importaciones y ediciones.

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, type RouteProp } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionHeading } from '@/components/SectionHeading';
import { useEventoForm } from '@/hooks/useEventoForm';
import type { RootStackParamList } from '@/navigation/types';
import type { Venta, VentaGrupo } from '@/data/types';
import { fechaBonita } from '@/utils/fechas';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';

type Rt = RouteProp<RootStackParamList, 'VentaForm'>;

interface GrupoDraft {
  cantCabYCat: string;
  kgBrutos: string;
  precio: string;
}

const VACIO: GrupoDraft = { cantCabYCat: '', kgBrutos: '', precio: '' };
const MAX_KG = 10_000_000;
const MAX_PRECIO = 1_000_000;

function decimal(texto: string): number {
  return Number(texto.trim().replace(',', '.'));
}

function calcularGrupo(d: GrupoDraft, index: number): VentaGrupo | null {
  const match = /^\s*(\d+)/.exec(d.cantCabYCat);
  const cabezas = match?.[1] ? Number(match[1]) : NaN;
  const kgBrutos = decimal(d.kgBrutos);
  const precio = decimal(d.precio);
  if (!Number.isFinite(cabezas) || cabezas <= 0) return null;
  if (!Number.isFinite(kgBrutos) || kgBrutos <= 0 || kgBrutos > MAX_KG) return null;
  if (!Number.isFinite(precio) || precio <= 0 || precio > MAX_PRECIO) return null;
  const kgNetos = Math.round(kgBrutos * 0.92 * 100) / 100;
  const kgPromedio = Math.round((kgNetos / cabezas) * 100) / 100;
  return {
    orden: (index + 1) as 1 | 2 | 3 | 4,
    cantCabYCat: d.cantCabYCat.trim(),
    cabezas,
    kgBrutos: Math.round(kgBrutos * 100) / 100,
    kgNetos,
    kgPromedio,
    precio: Math.round(precio * 100) / 100,
  };
}

export function VentaFormScreen() {
  const route = useRoute<Rt>();
  const ventaId = route.params?.ventaId;

  const [pickerCampoOpen, setPickerCampoOpen] = useState(false);
  const [showFechaPicker, setShowFechaPicker] = useState(false);
  const [grupos, setGrupos] = useState<GrupoDraft[]>([{ ...VACIO }]);
  const [consignado, setConsignado] = useState('');
  const [titular, setTitular] = useState('');
  const [pago, setPago] = useState('');
  const [frigorifico, setFrigorifico] = useState('');
  const [numeroDte, setNumeroDte] = useState('');
  const [correlativo, setCorrelativo] = useState('');
  const [tropa, setTropa] = useState('');
  const [importe, setImporte] = useState('');
  const [observaciones, setObservaciones] = useState('');

  const gruposCalculados = useMemo(
    () => grupos.map((g, i) => calcularGrupo(g, i)),
    [grupos],
  );

  const ef = useEventoForm<Venta>({
    tipo: 'venta',
    eventoId: ventaId,
    titleNew: 'Nueva venta',
    titleEdit: 'Editar venta',
    // La lista de ventas vive en el Stack. Al volver del form queda visible;
    // detrás dejamos Menú como tab base.
    tabName: 'menu',
    buildEvento: ({ campoId, fecha, usuarioEmail, id, createdAt }) => {
      if (gruposCalculados.some(g => g == null)) return null;
      const importeNum = importe.trim() ? decimal(importe) : undefined;
      return {
        tipo: 'venta',
        id, campoId, fecha, usuarioEmail, createdAt,
        grupos: gruposCalculados as VentaGrupo[],
        consignado: consignado.trim(),
        titular: titular.trim(),
        pago: pago.trim(),
        frigorifico: frigorifico.trim(),
        numeroDte: numeroDte.trim(),
        correlativo: correlativo.trim(),
        tropa: tropa.trim(),
        importeTotal: importeNum != null && Number.isFinite(importeNum) ? importeNum : undefined,
        observaciones: observaciones.trim(),
        syncState: 'pending',
      };
    },
    formatSummary: e => `Venta ${e.correlativo} guardada · ${e.grupos.length} ${e.grupos.length === 1 ? 'categoría' : 'categorías'}`,
    resetEspecifico: () => {
      setGrupos([{ ...VACIO }]);
      setConsignado(''); setTitular(''); setPago(''); setFrigorifico('');
      setNumeroDte(''); setCorrelativo(''); setTropa(''); setImporte(''); setObservaciones('');
    },
  });

  const {
    campoId, setCampoId, fecha, setFecha, campos, campoActual,
    isEdit, cargandoExistente, originalRecord, guardando, onGuardar,
  } = ef;

  useEffect(() => {
    ef.registerPrefill(existing => {
      setGrupos(existing.grupos.map(g => ({
        cantCabYCat: g.cantCabYCat,
        kgBrutos: String(g.kgBrutos),
        precio: String(g.precio),
      })));
      setConsignado(existing.consignado);
      setTitular(existing.titular);
      setPago(existing.pago);
      setFrigorifico(existing.frigorifico);
      setNumeroDte(existing.numeroDte);
      setCorrelativo(existing.correlativo);
      setTropa(existing.tropa);
      setImporte(existing.importeTotal != null ? String(existing.importeTotal) : '');
      setObservaciones(existing.observaciones);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const errores = useMemo(() => {
    const out: string[] = [];
    if (!campoId) out.push('Campo');
    if (!fecha) out.push('Fecha');
    grupos.forEach((g, i) => {
      if (!g.cantCabYCat.trim() || !/^\s*\d+/.test(g.cantCabYCat)) out.push(`Categoría ${i + 1}`);
      const kgNum = decimal(g.kgBrutos);
      if (!g.kgBrutos.trim() || !Number.isFinite(kgNum) || kgNum <= 0 || kgNum > MAX_KG) out.push(`Kg brutos ${i + 1}`);
      const precioNum = decimal(g.precio);
      if (!g.precio.trim() || !Number.isFinite(precioNum) || precioNum <= 0 || precioNum > MAX_PRECIO) out.push(`Precio ${i + 1}`);
    });
    if (!consignado.trim()) out.push('Consignado');
    if (!titular.trim()) out.push('Titular');
    if (!pago.trim()) out.push('Pago');
    if (!frigorifico.trim()) out.push('Frigorífico');
    if (!numeroDte.trim()) out.push('Número DTE');
    if (!correlativo.trim()) out.push('Correlativo');
    if (!tropa.trim()) out.push('Tropa');
    if (!observaciones.trim()) out.push('Observaciones');
    if (importe.trim()) {
      const n = decimal(importe);
      if (!Number.isFinite(n) || n < 0) out.push('Importe');
    }
    return [...new Set(out)];
  }, [campoId, fecha, grupos, consignado, titular, pago, frigorifico, numeroDte, correlativo, tropa, observaciones, importe]);

  const isDirty = useMemo(() => {
    if (!isEdit || !originalRecord) return true;
    const actual = JSON.stringify({
      campoId, fecha, grupos, consignado, titular, pago, frigorifico,
      numeroDte, correlativo, tropa, importe, observaciones,
    });
    const original = JSON.stringify({
      campoId: originalRecord.campoId,
      fecha: originalRecord.fecha,
      grupos: originalRecord.grupos.map(g => ({ cantCabYCat: g.cantCabYCat, kgBrutos: String(g.kgBrutos), precio: String(g.precio) })),
      consignado: originalRecord.consignado,
      titular: originalRecord.titular,
      pago: originalRecord.pago,
      frigorifico: originalRecord.frigorifico,
      numeroDte: originalRecord.numeroDte,
      correlativo: originalRecord.correlativo,
      tropa: originalRecord.tropa,
      importe: originalRecord.importeTotal != null ? String(originalRecord.importeTotal) : '',
      observaciones: originalRecord.observaciones,
    });
    return actual !== original;
  }, [isEdit, originalRecord, campoId, fecha, grupos, consignado, titular, pago, frigorifico, numeroDte, correlativo, tropa, importe, observaciones]);

  const actualizarGrupo = (index: number, patch: Partial<GrupoDraft>) => {
    setGrupos(current => current.map((g, i) => i === index ? { ...g, ...patch } : g));
  };

  const guardar = async () => {
    if (ef.user?.rol !== 'administrador') {
      Alert.alert('Acceso restringido', 'Solo los administradores pueden cargar o editar ventas.');
      return;
    }
    if (errores.length > 0) {
      Alert.alert('Faltan datos', `Completá o corregí: ${errores.join(', ')}.`);
      return;
    }
    await onGuardar();
  };

  if (cargandoExistente) {
    return <SafeAreaView style={styles.safe} edges={['bottom']}><View style={styles.center}><Text>Cargando venta…</Text></View></SafeAreaView>;
  }

  if (ef.user?.rol !== 'administrador') {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.noAccess}>
          <Text style={styles.noAccessEmoji}>🔒</Text>
          <Text style={styles.noAccessTitle}>Ventas es de uso administrativo</Text>
          <Text style={styles.noAccessText}>La carga y edición están reservadas a administradores.</Text>
          <PrimaryButton label="Volver" onPress={() => ef.nav.goBack()} variant="ghost" />
        </View>
      </SafeAreaView>
    );
  }

  const habilitado = errores.length === 0 && !guardando && (!isEdit || isDirty);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.infoBanner}>
            <Text style={styles.infoTitle}>Cálculo físico automático</Text>
            <Text style={styles.infoText}>Se descuenta siempre 8% de los kg brutos. Los identificadores, tropa, precio e importe se escriben manualmente.</Text>
          </View>

          <View style={styles.headerCard}>
            <View style={styles.headerRow}>
              <Text style={styles.headerLabel}>Usuario</Text>
              <Text style={styles.headerValue} numberOfLines={1}>{ef.user?.email ?? '—'}</Text>
            </View>
            <View style={styles.headerRow}>
              <Text style={styles.headerLabel}>Campo *</Text>
              <Pressable style={styles.headerPicker} onPress={() => setPickerCampoOpen(v => !v)}>
                <Text style={[styles.headerValue, !campoId && styles.muted]} numberOfLines={1}>{campoActual?.nombre ?? 'Elegir campo'}</Text>
                <Text style={styles.chev}>▾</Text>
              </Pressable>
            </View>
            {pickerCampoOpen && (
              <View style={styles.options}>
                {campos.map(c => (
                  <Pressable key={c.id} onPress={() => { setCampoId(c.id); setPickerCampoOpen(false); }} style={[styles.option, c.id === campoId && styles.optionSel]}>
                    <Text style={[styles.optionText, c.id === campoId && styles.optionTextSel]}>{c.nombre}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <View style={styles.headerRow}>
              <Text style={styles.headerLabel}>Fecha *</Text>
              <Pressable style={styles.headerPicker} onPress={() => setShowFechaPicker(true)}>
                <Text style={styles.headerValue}>{fechaBonita(fecha)}</Text><Text style={styles.chev}>▾</Text>
              </Pressable>
            </View>
            {showFechaPicker && (
              <DateTimePicker
                value={new Date(`${fecha}T00:00:00`)}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                maximumDate={new Date()}
                onChange={(_event, selected) => {
                  if (Platform.OS !== 'ios') setShowFechaPicker(false);
                  if (selected) setFecha(`${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, '0')}-${String(selected.getDate()).padStart(2, '0')}`);
                }}
              />
            )}
            {Platform.OS === 'ios' && showFechaPicker && (
              <Pressable onPress={() => setShowFechaPicker(false)} style={styles.done}><Text style={styles.doneText}>Listo</Text></Pressable>
            )}
          </View>

          <SectionHeading>Categorías de la venta</SectionHeading>
          {grupos.map((g, index) => {
            const calculado = gruposCalculados[index];
            return (
              <View key={index} style={styles.groupCard}>
                <View style={styles.groupHeader}>
                  <Text style={styles.groupTitle}>Categoría {index + 1}</Text>
                  {index > 0 && (
                    <Pressable onPress={() => setGrupos(current => current.filter((_, i) => i !== index))} hitSlop={8}>
                      <Text style={styles.remove}>Eliminar</Text>
                    </Pressable>
                  )}
                </View>
                <FormField
                  label={`CANT CAB Y CAT${index === 0 ? '' : index + 1} *`}
                  value={g.cantCabYCat}
                  onChangeText={v => actualizarGrupo(index, { cantCabYCat: v })}
                  placeholder="Ej. 50 novillos TM1.1-26 B6"
                  autoCapitalize="sentences"
                />
                <View style={styles.twoCols}>
                  <View style={styles.col}>
                    <FormField label={`Kg brutos${index === 0 ? '' : index + 1} *`} value={g.kgBrutos} onChangeText={v => actualizarGrupo(index, { kgBrutos: v })} keyboardType="decimal-pad" placeholder="0" />
                  </View>
                  <View style={styles.col}>
                    <FormField label={`Precio${index === 0 ? '' : index + 1} ($/kg) *`} value={g.precio} onChangeText={v => actualizarGrupo(index, { precio: v })} keyboardType="decimal-pad" placeholder="0" />
                  </View>
                </View>
                <View style={styles.calcRow}>
                  <Calc label="Cabezas" value={calculado ? calculado.cabezas.toLocaleString('es-AR') : '—'} />
                  <Calc label="Kg netos (−8%)" value={calculado ? calculado.kgNetos.toLocaleString('es-AR', { maximumFractionDigits: 2 }) : '—'} />
                  <Calc label="Kg promedio" value={calculado ? calculado.kgPromedio.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'} />
                </View>
              </View>
            );
          })}

          {grupos.length < 4 && (
            <Pressable onPress={() => setGrupos(current => [...current, { ...VACIO }])} style={styles.addGroup}>
              <Text style={styles.addGroupText}>＋ Agregar otra categoría</Text>
            </Pressable>
          )}

          <SectionHeading>Datos comerciales</SectionHeading>
          <FormField label="Consignado *" value={consignado} onChangeText={setConsignado} placeholder="Nombre del consignado" />
          <FormField label="Titular *" value={titular} onChangeText={setTitular} placeholder="Titular de la venta" />
          <FormField label="Pago *" value={pago} onChangeText={setPago} placeholder="Condición o forma de pago" />
          <FormField label="Frigorífico *" value={frigorifico} onChangeText={setFrigorifico} placeholder="Destino frigorífico" />
          <View style={styles.twoCols}>
            <View style={styles.col}><FormField label="Número DTE *" value={numeroDte} onChangeText={setNumeroDte} placeholder="DTE" /></View>
            <View style={styles.col}><FormField label="Correlativo / operación *" value={correlativo} onChangeText={setCorrelativo} placeholder="Manual" /></View>
          </View>
          <FormField label="Tropa *" value={tropa} onChangeText={setTropa} placeholder="Ingreso manual" />
          <FormField label="Importe total" value={importe} onChangeText={setImporte} keyboardType="decimal-pad" placeholder="Manual; no se calcula" />
          <FormField label="Observaciones *" value={observaciones} onChangeText={setObservaciones} placeholder="Observaciones de la operación" multiline style={styles.multiline} />

          {!habilitado && isEdit && !isDirty ? <Text style={styles.noChanges}>No hay cambios para guardar.</Text> : null}
          <PrimaryButton label={isEdit ? 'Guardar cambios' : 'Guardar venta'} onPress={guardar} loading={guardando} disabled={!habilitado} />
          {errores.length > 0 && <Text style={styles.errorHint}>Falta completar: {errores.slice(0, 5).join(', ')}{errores.length > 5 ? '…' : ''}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Calc({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.calcBox}>
      <Text style={styles.calcLabel}>{label}</Text>
      <Text style={styles.calcValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgLight },
  scroll: { padding: spacing.base, paddingBottom: spacing.xl * 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  infoBanner: { backgroundColor: colors.orangeSoft, borderRadius: radius.lg, padding: spacing.base, marginBottom: spacing.base, borderWidth: 1, borderColor: colors.orange },
  infoTitle: { color: colors.navyDeep, fontWeight: fontWeight.bold as '700', fontSize: fontSize.sm, marginBottom: 3 },
  infoText: { color: colors.textDark, fontSize: fontSize.sm, lineHeight: 19 },
  headerCard: { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.base, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.borderSoft },
  headerRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft, gap: spacing.md },
  headerLabel: { width: 82, color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.bold as '700', textTransform: 'uppercase' },
  headerValue: { flex: 1, color: colors.textDark, fontSize: fontSize.sm, fontWeight: fontWeight.semibold as '600' },
  muted: { color: colors.textMuted },
  headerPicker: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  chev: { color: colors.orange, fontWeight: fontWeight.bold as '700' },
  options: { paddingVertical: spacing.sm, gap: spacing.xs },
  option: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.bgLight },
  optionSel: { backgroundColor: colors.navy },
  optionText: { color: colors.textDark, fontWeight: fontWeight.semibold as '600' },
  optionTextSel: { color: colors.white },
  done: { alignSelf: 'flex-end', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  doneText: { color: colors.orange, fontWeight: fontWeight.bold as '700' },
  groupCard: { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.base, marginBottom: spacing.base, borderWidth: 1, borderColor: colors.borderSoft },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  groupTitle: { color: colors.navyDeep, fontWeight: fontWeight.bold as '700', fontSize: fontSize.md },
  remove: { color: colors.danger, fontWeight: fontWeight.bold as '700', fontSize: fontSize.sm },
  twoCols: { flexDirection: 'row', gap: spacing.md },
  col: { flex: 1, minWidth: 0 },
  calcRow: { flexDirection: 'row', gap: spacing.sm },
  calcBox: { flex: 1, minWidth: 0, backgroundColor: colors.bgLight, borderRadius: radius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.borderSoft },
  calcLabel: { color: colors.textMuted, fontSize: 9, fontWeight: fontWeight.bold as '700', textTransform: 'uppercase', marginBottom: 4 },
  calcValue: { color: colors.navyDeep, fontSize: 18, fontWeight: fontWeight.bold as '700' },
  addGroup: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.orange, borderRadius: radius.lg, padding: spacing.base, alignItems: 'center', marginBottom: spacing.xl },
  addGroupText: { color: colors.orange, fontWeight: fontWeight.bold as '700' },
  multiline: { minHeight: 92, textAlignVertical: 'top', paddingTop: spacing.md },
  noChanges: { color: colors.textMuted, textAlign: 'center', marginBottom: spacing.sm, fontStyle: 'italic' },
  errorHint: { color: colors.danger, fontSize: fontSize.sm, textAlign: 'center', marginTop: spacing.sm },
  noAccess: { flex: 1, padding: spacing.xl, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  noAccessEmoji: { fontSize: 42 },
  noAccessTitle: { color: colors.navyDeep, fontSize: fontSize.lg, fontWeight: fontWeight.bold as '700', textAlign: 'center' },
  noAccessText: { color: colors.textMuted, textAlign: 'center', marginBottom: spacing.md },
});
