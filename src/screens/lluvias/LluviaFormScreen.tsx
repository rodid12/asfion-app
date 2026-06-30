// LluviaFormScreen — modelo simplificado, alineado al AppSheet real.
//
// REFACTORIZADO con useEventoForm (A3 del audit). Lo que era boilerplate
// común con los otros 4 forms (campoId/fecha state, edit-mode prefill con
// flag cancelado, save flow con alerts, etc.) vive ahora en el hook.
// Este file mantiene SOLO lo específico de Lluvia: pluviómetros y mm.

import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, type RouteProp } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { FaltaHint } from '@/components/FaltaHint';
import { NoLotesBanner } from '@/components/NoLotesBanner';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';
import { useEventoForm } from '@/hooks/useEventoForm';
import type { RootStackParamList } from '@/navigation/types';
import type { Lluvia, Pluviometro } from '@/data/types';
import { fechaBonita } from '@/utils/fechas';

type Rt = RouteProp<RootStackParamList, 'LluviaForm'>;

// ---------- pantalla ----------

export function LluviaFormScreen() {
  const route = useRoute<Rt>();
  const lluviaId = route.params?.lluviaId;

  // ─── State específico de Lluvia ───
  const [pluviometroId, setPluviometroId] = useState<string>('');
  const [milimetrosStr, setMilimetrosStr] = useState<string>('');
  const [pluviometros, setPluviometros] = useState<Pluviometro[]>([]);
  const [pickerCampoOpen, setPickerCampoOpen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [errores, setErrores] = useState<{ pluv?: string; mm?: string }>({});

  // ─── State común vía useEventoForm ───
  const ef = useEventoForm<Lluvia>({
    tipo: 'lluvia',
    eventoId: lluviaId,
    titleNew: 'Nueva lluvia',
    titleEdit: 'Editar lluvia',
    tabName: 'lluvias',
    buildEvento: ({ campoId, fecha, usuarioEmail, id, createdAt }) => {
      const mmNum = parseFloat(milimetrosStr.replace(',', '.'));
      if (!campoId || !pluviometroId || !Number.isFinite(mmNum)) return null;
      const pluvActual = pluviometros.find(p => p.id === pluviometroId);
      return {
        tipo: 'lluvia',
        id, campoId, fecha, usuarioEmail, createdAt,
        pluviometroId,
        pluviometro: pluvActual?.nombre ?? '',
        milimetros: mmNum,
        syncState: 'pending',
      };
    },
    formatSummary: (e) => `${e.milimetros} mm en ${e.pluviometro}`,
    resetEspecifico: () => {
      setMilimetrosStr('');
      setErrores({});
      // Mantenemos campo/pluviómetro/fecha — patrón "cargar otra del mismo día"
    },
  });
  // Aliases para no romper los handlers de UI con nombres largos
  const { campoId, setCampoId, fecha, setFecha, campos, campoActual,
          isEdit, cargandoExistente, originalRecord,
          guardando, onGuardar, nav, repo } = ef;

  // ─── Hidratación específica en edit mode ───
  useEffect(() => {
    ef.registerPrefill((existing) => {
      // Lluvias nuevas tienen pluviometroId; las legacy guardaban en loteId.
      setPluviometroId(existing.pluviometroId ?? existing.loteId ?? '');
      setMilimetrosStr(String(existing.milimetros));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Cargar pluviómetros del campo + auto-select cuando hay 1 ───
  useEffect(() => {
    if (!campoId) { setPluviometros([]); return; }
    let cancelado = false;
    (async () => {
      const ps = await repo.listPluviometros(campoId);
      if (cancelado) return;
      setPluviometros(ps);
      if (pluviometroId && !ps.some(p => p.id === pluviometroId)) {
        setPluviometroId('');
      }
      if (!pluviometroId && ps.length === 1 && ps[0]) {
        setPluviometroId(ps[0].id);
      }
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campoId, repo]);

  // ─── Validación live ───
  const mm = useMemo(() => {
    const parsed = parseFloat(milimetrosStr.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : NaN;
  }, [milimetrosStr]);

  const isDirty = useMemo(() => {
    if (!isEdit || !originalRecord) return true;
    return (
      campoId !== originalRecord.campoId ||
      pluviometroId !== (originalRecord.pluviometroId ?? originalRecord.loteId ?? '') ||
      fecha !== originalRecord.fecha ||
      mm !== originalRecord.milimetros
    );
  }, [isEdit, originalRecord, campoId, pluviometroId, fecha, mm]);

  const puedeGuardar = useMemo(() => {
    if (!campoId) return false;
    if (!pluviometroId) return false;
    if (!Number.isFinite(mm)) return false;
    if (mm < 0 || mm > 500) return false;
    if (!isDirty) return false;
    return true;
  }, [campoId, pluviometroId, mm, isDirty]);

  const camposFaltantes = useMemo(() => {
    const f: string[] = [];
    if (!campoId) f.push('campo');
    if (!pluviometroId) f.push('pluviómetro');
    if (!milimetrosStr.trim()) f.push('milímetros');
    else if (!Number.isFinite(mm) || mm < 0 || mm > 500) f.push('milímetros válidos');
    if (f.length === 0 && isEdit && !isDirty) f.push('cambios');
    return f;
  }, [campoId, pluviometroId, milimetrosStr, mm, isEdit, isDirty]);

  const pluvActual = useMemo(() => pluviometros.find(p => p.id === pluviometroId), [pluviometros, pluviometroId]);

  // ─── Guardar — validación específica primero, después delega al hook ───
  const handleGuardar = async () => {
    const errs: { pluv?: string; mm?: string } = {};
    if (!pluviometroId) errs.pluv = 'Elegí un pluviómetro';
    if (!milimetrosStr.trim()) {
      errs.mm = 'Falta milímetros';
    } else if (!Number.isFinite(mm)) {
      errs.mm = 'Número inválido';
    } else if (mm < 0 || mm > 500) {
      errs.mm = 'Fuera de rango (0 a 500 mm)';
    }
    setErrores(errs);
    if (Object.keys(errs).length > 0) return;
    await onGuardar();
  };

  if (cargandoExistente) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderTxt}>Cargando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Header: Campo + Pluviómetro + Fecha */}
          <View style={styles.header}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Campo</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {campoActual?.nombre ?? '—'}
              </Text>
              {campos.length > 1 && (
                <Pressable
                  onPress={() => setPickerCampoOpen(o => !o)}
                  hitSlop={10}
                  style={styles.infoCta}
                >
                  <Text style={styles.infoCtaTxt}>{pickerCampoOpen ? 'cerrar' : 'cambiar'}</Text>
                </Pressable>
              )}
            </View>

            {pickerCampoOpen && (
              <View style={styles.pickerRow}>
                {campos.map(c => (
                  <Pressable
                    key={c.id}
                    onPress={() => { setCampoId(c.id); setPickerCampoOpen(false); }}
                    style={[styles.pickerChip, campoId === c.id && styles.pickerChipSel]}
                  >
                    <Text style={[styles.pickerChipTxt, campoId === c.id && styles.pickerChipTxtSel]}>
                      {c.nombre}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            <View style={styles.infoDivider} />

            {/* PLUVIÓMETRO (antes era "Lote"). Required. Catálogo real del cliente. */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Pluviómetro *</Text>
              <Text
                style={[
                  styles.infoValue,
                  !pluviometroId && { color: colors.textMuted, fontStyle: 'italic' },
                ]}
                numberOfLines={1}
              >
                {pluvActual?.nombre ?? 'sin elegir'}
              </Text>
            </View>
            {pluviometros.length === 0 ? (
              <NoLotesBanner faltaCampo={!campoId} />
            ) : (
              <View style={styles.pickerRow}>
                {pluviometros.map(p => (
                  <Pressable
                    key={p.id}
                    onPress={() => {
                      setPluviometroId(prev => (prev === p.id ? '' : p.id));
                      if (errores.pluv) setErrores(e => ({ ...e, pluv: undefined }));
                    }}
                    style={[styles.pickerChip, pluviometroId === p.id && styles.pickerChipSelLote]}
                  >
                    <Text style={[styles.pickerChipTxt, pluviometroId === p.id && styles.pickerChipTxtSel]}>
                      {p.nombre}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
            {errores.pluv && <Text style={styles.err}>{errores.pluv}</Text>}

            <View style={styles.infoDivider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Fecha</Text>
              <Text style={styles.infoValue}>{fechaBonita(fecha)}</Text>
              <Pressable onPress={() => setShowDatePicker(true)} hitSlop={10} style={styles.infoCta}>
                <Text style={styles.infoCtaTxt}>cambiar</Text>
              </Pressable>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={new Date(fecha + 'T00:00:00')}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                maximumDate={new Date()}
                onChange={(_e, selected) => {
                  // Auto-colapsa el picker tras seleccionar (también iOS).
                  setShowDatePicker(false);
                  if (selected) {
                    const y = selected.getFullYear();
                    const m = String(selected.getMonth() + 1).padStart(2, '0');
                    const d = String(selected.getDate()).padStart(2, '0');
                    setFecha(`${y}-${m}-${d}`);
                  }
                }}
              />
            )}
          </View>

          {/* Milímetros — input grande */}
          <View style={styles.mmWrap}>
            <Text style={styles.label}>Milímetros *</Text>
            <View
              style={[
                styles.mmInputRow,
                errores.mm && styles.mmInputRowErr,
              ]}
            >
              <TextInput
                value={milimetrosStr}
                onChangeText={t => {
                  const clean = t.replace(/[^0-9.,]/g, '').replace(/([.,]).*?([.,])/g, '$1');
                  setMilimetrosStr(clean);
                  if (errores.mm) setErrores(e => ({ ...e, mm: undefined }));
                }}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                style={styles.mmInput}
                returnKeyType="done"
                maxLength={5}
              />
              <Text style={styles.mmUnit}>mm</Text>
            </View>
            {errores.mm && <Text style={styles.err}>{errores.mm}</Text>}
            <Text style={styles.hint}>Rango: 0 a 500 mm</Text>
          </View>

          <FaltaHint campos={camposFaltantes} />

          <PrimaryButton
            label={isEdit ? 'GUARDAR CAMBIOS' : 'GUARDAR LLUVIA'}
            onPress={handleGuardar}
            disabled={!puedeGuardar}
            loading={guardando}
          />

          <Pressable onPress={() => nav.goBack()} style={styles.cancelBtn} hitSlop={8}>
            <Text style={styles.cancelTxt}>Cancelar</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgLight },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholderTxt: { color: colors.textMuted, fontSize: fontSize.md },

  scroll: {
    padding: spacing.base,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },

  header: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.base,
    marginBottom: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  infoLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold as '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    width: 96,
  },
  infoValue: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold as '600',
    color: colors.textDark,
  },
  infoCta: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  infoCtaTxt: {
    fontSize: fontSize.sm,
    color: colors.navy,
    fontWeight: fontWeight.bold as '700',
    textDecorationLine: 'underline',
  },
  infoDivider: {
    height: 1,
    backgroundColor: colors.borderSoft,
  },

  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  pickerChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.bgLight,
  },
  pickerChipSel: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  pickerChipSelLote: {
    backgroundColor: colors.orange,
    borderColor: colors.orange,
  },
  pickerChipTxt: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold as '600',
    color: colors.textDark,
  },
  pickerChipTxtSel: { color: colors.white },

  // Milímetros
  mmWrap: { marginBottom: spacing.lg },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as '700',
    color: colors.textMuted,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mmInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.base,
    minHeight: 56,
  },
  mmInputRowErr: { borderColor: colors.danger },
  mmInput: {
    flex: 1,
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold as '700',
    color: colors.textDark,
    paddingVertical: 0,
  },
  mmUnit: {
    fontSize: fontSize.lg,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold as '600',
    marginLeft: spacing.sm,
  },
  hint: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  err: {
    color: colors.danger,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    fontWeight: fontWeight.semibold as '600',
  },

  cancelBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  cancelTxt: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold as '600',
  },
});
