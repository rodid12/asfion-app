// PastoreoFormScreen — modelo "circuito + parcela" alineado al AppSheet real
// de Ganaderas.
//
// Estructura del form (en orden, igual al CSV final del cliente para que pueda
// hacer copy+paste directo a su sistema de gestión):
//
//   1. Campo            (chip group)         REQUIRED
//   2. Circuito         (chip group)          REQUIRED — auto-fills Has Circuito
//   3. Has Circuito     (read-only, derivado del catálogo)
//   4. Parcela          (chip group de números)  REQUIRED — auto-fills Has Parcela
//   5. Has Parcela      (read-only, derivado del catálogo)
//   6. Evento           (chip group)          opcional — Entrada/Salida/Rotacion/Muerte
//   7. Fecha Entrada    (date picker)         REQUIRED
//   8. Fecha Salida     (date picker)         opcional — el registro queda "abierto" hasta cargarla
//   9. Categoría        (chip)                REQUIRED — Novillito/Vaquilla/etc
//  10. N° Caravana      (text input)          opcional
//  11. Categoría Animal (chip)                opcional
//
// Ediciones posteriores: el operario puede volver a la entrada para agregar
// fechaSalida cuando termine la rotación (mismo patrón que el modelo anterior).

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

import { FaltaHint } from '@/components/FaltaHint';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useClientConfig } from '@/config/ClientConfigContext';
import { useEventoForm } from '@/hooks/useEventoForm';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';
import type { RootStackParamList } from '@/navigation/types';
import type { Circuito, Parcela, Pastoreo } from '@/data/types';
import { fechaBonita, hoyISO } from '@/utils/fechas';

type Rt = RouteProp<RootStackParamList, 'PastoreoForm'>;

// ---------- pantalla ----------

export function PastoreoFormScreen() {
  const route = useRoute<Rt>();
  const pastoreoId = route.params?.pastoreoId;

  const catPast = useClientConfig().catalogos.pastoreo;
  const PAST_CATEGORIAS = catPast.categorias;
  const PAST_EVENTOS = catPast.eventos;
  const PAST_CAT_ANIMAL = catPast.catAnimal;

  // ─── State específico de Pastoreo (circuito + parcela en lugar de lote) ───
  const [circuitoId, setCircuitoId] = useState<string>('');
  const [parcelaId, setParcelaId] = useState<string>('');
  const [parcelaNumero, setParcelaNumero] = useState<number | undefined>();
  const [fechaSalida, setFechaSalida] = useState<string | undefined>();
  const [evento, setEvento] = useState<string | undefined>('Entrada');
  const [categoria, setCategoria] = useState<string | undefined>();
  const [categoriaAnimal, setCategoriaAnimal] = useState<string | undefined>();
  const [caravanaNumero, setCaravanaNumero] = useState('');
  // Datos productivos (migration 0003) — alimentan KPIs del dashboard
  const [animales, setAnimales] = useState('');
  const [kgPromedio, setKgPromedio] = useState('');

  // UI-only state
  const [circuitos, setCircuitos] = useState<Circuito[]>([]);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [pickerCampoOpen, setPickerCampoOpen] = useState(false);
  const [showPickerEntrada, setShowPickerEntrada] = useState(false);
  const [showPickerSalida, setShowPickerSalida] = useState(false);

  // ─── State común vía useEventoForm ───
  // Tricky: Pastoreo usa `fecha` como "fecha de entrada" — el hook llama
  // setFecha/fecha igual, pero acá lo aliaseamos como `fechaEntrada` para
  // mantener el naming local. fechaSalida queda específico del form.
  const ef = useEventoForm<Pastoreo>({
    tipo: 'pastoreo',
    eventoId: pastoreoId,
    titleNew: 'Nuevo pastoreo',
    titleEdit: 'Editar pastoreo',
    tabName: 'pastoreo',
    buildEvento: ({ campoId, fecha, usuarioEmail, id, createdAt }) => {
      if (!campoId || !circuitoId || !parcelaId || !categoria) return null;
      const animalesNum = animales.trim() ? Number(animales.trim()) : undefined;
      const kgNum       = kgPromedio.trim() ? Number(kgPromedio.trim()) : undefined;
      return {
        id, campoId, fecha, usuarioEmail, createdAt,
        tipo: 'pastoreo',
        fechaSalida: fechaSalida || undefined,
        circuitoId,
        parcelaId,
        parcelaNumero,
        categoria,
        evento,
        categoriaAnimal,
        caravanaNumero: caravanaNumero.trim() || undefined,
        animales: animalesNum != null && Number.isFinite(animalesNum) ? animalesNum : undefined,
        kgPromedio: kgNum != null && Number.isFinite(kgNum) ? kgNum : undefined,
        syncState: 'pending',
      };
    },
    formatSummary: (p) => {
      const cir = circuitos.find(c => c.id === p.circuitoId)?.nombre ?? '';
      return `Cargado: ${p.categoria} en ${cir} parcela ${p.parcelaNumero ?? ''}`;
    },
    resetEspecifico: () => {
      // Mantenemos campo/circuito/fecha — uso típico es cargar varias cargas
      // a la misma parcela el mismo día.
      setCategoria(undefined);
      setCategoriaAnimal(undefined);
      setCaravanaNumero('');
      setFechaSalida(undefined);
      setEvento('Entrada');
      setAnimales('');
      setKgPromedio('');
    },
  });
  // Aliases — fecha es "fechaEntrada" conceptualmente en este form
  const { user, repo, campoId, setCampoId, fecha: fechaEntrada, setFecha: setFechaEntrada,
          campos, campoActual, isEdit, cargandoExistente, originalRecord,
          guardando, onGuardar, nav } = ef;

  // ─── Hidratación específica en edit mode ───
  useEffect(() => {
    ef.registerPrefill((existing) => {
      setCircuitoId(existing.circuitoId ?? '');
      setParcelaId(existing.parcelaId ?? '');
      setParcelaNumero(existing.parcelaNumero);
      setFechaSalida(existing.fechaSalida);
      setEvento(existing.evento);
      setCategoria(existing.categoria);
      setCategoriaAnimal(existing.categoriaAnimal);
      setCaravanaNumero(existing.caravanaNumero ?? '');
      setAnimales(existing.animales != null ? String(existing.animales) : '');
      setKgPromedio(existing.kgPromedio != null ? String(existing.kgPromedio) : '');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Cargar circuitos del campo + auto-select cuando hay 1 ───
  useEffect(() => {
    if (!campoId) { setCircuitos([]); setCircuitoId(''); return; }
    let cancelado = false;
    (async () => {
      const cs = await repo.listCircuitos(campoId);
      if (cancelado) return;
      setCircuitos(cs);
      if (circuitoId && !cs.some(c => c.id === circuitoId)) {
        setCircuitoId('');
        setParcelaId('');
      }
      if (!circuitoId && cs.length === 1 && cs[0]) {
        setCircuitoId(cs[0].id);
      }
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campoId, repo]);

  // ─── Cargar parcelas del circuito ───
  useEffect(() => {
    if (!circuitoId) { setParcelas([]); setParcelaId(''); return; }
    let cancelado = false;
    (async () => {
      const ps = await repo.listParcelas(circuitoId);
      if (cancelado) return;
      setParcelas(ps);
      if (parcelaId && !ps.some(p => p.id === parcelaId)) {
        setParcelaId('');
        setParcelaNumero(undefined);
      }
      if (!parcelaId && ps.length === 1 && ps[0]) {
        setParcelaId(ps[0].id);
        setParcelaNumero(ps[0].numero);
      }
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circuitoId, repo]);

  // ---------- valores derivados ----------
  const circuitoActual = useMemo(() => circuitos.find(c => c.id === circuitoId), [circuitos, circuitoId]);
  const parcelaActual = useMemo(() => parcelas.find(p => p.id === parcelaId), [parcelas, parcelaId]);

  // isDirty
  const isDirty = useMemo(() => {
    if (!isEdit || !originalRecord) return true;
    return (
      campoId !== originalRecord.campoId ||
      circuitoId !== originalRecord.circuitoId ||
      parcelaId !== originalRecord.parcelaId ||
      fechaEntrada !== originalRecord.fecha ||
      fechaSalida !== originalRecord.fechaSalida ||
      evento !== originalRecord.evento ||
      categoria !== originalRecord.categoria ||
      categoriaAnimal !== originalRecord.categoriaAnimal ||
      caravanaNumero !== (originalRecord.caravanaNumero ?? '') ||
      animales !== (originalRecord.animales != null ? String(originalRecord.animales) : '') ||
      kgPromedio !== (originalRecord.kgPromedio != null ? String(originalRecord.kgPromedio) : '')
    );
  }, [isEdit, originalRecord, campoId, circuitoId, parcelaId, fechaEntrada, fechaSalida, evento, categoria, categoriaAnimal, caravanaNumero, animales, kgPromedio]);

  const puedeGuardar = useMemo(() => {
    if (!campoId) return false;
    if (!circuitoId) return false;
    if (!parcelaId) return false;
    if (!categoria) return false;
    if (fechaSalida && fechaSalida < fechaEntrada) return false;
    if (!isDirty) return false;
    return true;
  }, [campoId, circuitoId, parcelaId, categoria, fechaEntrada, fechaSalida, isDirty]);

  const camposFaltantes = useMemo(() => {
    const f: string[] = [];
    if (!campoId) f.push('campo');
    if (!circuitoId) f.push('circuito');
    if (!parcelaId) f.push('parcela');
    if (!categoria) f.push('categoría');
    if (fechaSalida && fechaSalida < fechaEntrada) f.push('fecha salida válida');
    if (f.length === 0 && isEdit && !isDirty) f.push('cambios');
    return f;
  }, [campoId, circuitoId, parcelaId, categoria, fechaEntrada, fechaSalida, isEdit, isDirty]);

  // ─── Guardar — valida campos específicos + rangos productivos, luego hook ───
  const handleGuardar = async () => {
    if (!campoId || !circuitoId || !parcelaId || !categoria) {
      Alert.alert('Faltan datos', 'Completá los campos obligatorios.');
      return;
    }
    // Validación de cordura de datos productivos (rangos)
    if (animales.trim()) {
      const n = Number(animales.trim());
      if (!Number.isFinite(n) || n < 0) {
        Alert.alert('Animales inválido', 'Cantidad de cabezas tiene que ser un número positivo.');
        return;
      }
    }
    if (kgPromedio.trim()) {
      const k = Number(kgPromedio.trim());
      if (!Number.isFinite(k) || k < 0 || k > 2000) {
        Alert.alert('Kg promedio inválido', 'Tiene que ser un número entre 0 y 2000.');
        return;
      }
    }
    await onGuardar();
  };

  const marcarSalidaHoy = () => setFechaSalida(hoyISO());

  // ---------- loading state ----------
  if (cargandoExistente) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderTxt}>Cargando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isAbierto = !fechaSalida;

  // ---------- render ----------
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* === Header: Campo === */}
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
          </View>

          {/* === Circuito + Has Circuito === */}
          <Text style={styles.label}>Circuito *</Text>
          {circuitos.length === 0 ? (
            <Text style={styles.hintInfo}>
              {campoId ? 'Este campo no tiene circuitos cargados.' : 'Elegí un campo primero.'}
            </Text>
          ) : (
            <View style={styles.pickerRow}>
              {circuitos.map(c => (
                <Pressable
                  key={c.id}
                  onPress={() => setCircuitoId(prev => (prev === c.id ? '' : c.id))}
                  style={[styles.pickerChip, circuitoId === c.id && styles.pickerChipSelLote]}
                >
                  <Text style={[styles.pickerChipTxt, circuitoId === c.id && styles.pickerChipTxtSel]}>
                    {c.nombre}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          {circuitoActual && (
            <View style={styles.autoFillBox}>
              <Text style={styles.autoFillLabel}>Has circuito</Text>
              <Text style={styles.autoFillValue}>{circuitoActual.hectareas} ha</Text>
            </View>
          )}

          {/* === Parcela + Has Parcela === */}
          {circuitoActual && (
            <>
              <Text style={styles.label}>Parcela *</Text>
              {parcelas.length === 0 ? (
                <Text style={styles.hintInfo}>Este circuito no tiene parcelas cargadas.</Text>
              ) : (
                <View style={styles.parcelaRow}>
                  {parcelas.map(p => {
                    const sel = parcelaId === p.id;
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => {
                          setParcelaId(prev => (prev === p.id ? '' : p.id));
                          setParcelaNumero(prev => (sel ? undefined : p.numero));
                        }}
                        style={[styles.parcelaChip, sel && styles.parcelaChipSel]}
                      >
                        <Text style={[styles.parcelaChipTxt, sel && styles.parcelaChipTxtSel]}>
                          {p.numero}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
              {parcelaActual && (
                <View style={styles.autoFillBox}>
                  <Text style={styles.autoFillLabel}>Has parcela</Text>
                  <Text style={styles.autoFillValue}>{parcelaActual.hectareas} ha</Text>
                </View>
              )}
            </>
          )}

          {/* === Evento === */}
          <Text style={styles.label}>Evento</Text>
          <View style={styles.pickerRow}>
            {PAST_EVENTOS.map(ev => {
              const sel = evento === ev;
              return (
                <Pressable
                  key={ev}
                  onPress={() => setEvento(prev => (prev === ev ? undefined : ev))}
                  style={[styles.pickerChip, sel && styles.pickerChipSel]}
                >
                  <Text style={[styles.pickerChipTxt, sel && styles.pickerChipTxtSel]}>{ev}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* === Fechas === */}
          <View style={styles.fechaCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Entrada</Text>
              <Text style={styles.infoValue}>{fechaBonita(fechaEntrada)}</Text>
              <Pressable onPress={() => setShowPickerEntrada(true)} hitSlop={10} style={styles.infoCta}>
                <Text style={styles.infoCtaTxt}>cambiar</Text>
              </Pressable>
            </View>
            {showPickerEntrada && (
              <DateTimePicker
                value={new Date(fechaEntrada + 'T00:00:00')}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                maximumDate={new Date()}
                onChange={(_e, selected) => {
                  // Auto-colapsa también en iOS (ocupaba mucho espacio).
                  setShowPickerEntrada(false);
                  if (selected) {
                    const y = selected.getFullYear();
                    const m = String(selected.getMonth() + 1).padStart(2, '0');
                    const d = String(selected.getDate()).padStart(2, '0');
                    setFechaEntrada(`${y}-${m}-${d}`);
                  }
                }}
              />
            )}

            <View style={styles.infoDivider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Salida</Text>
              <Text
                style={[
                  styles.infoValue,
                  !fechaSalida && { color: colors.textMuted, fontStyle: 'italic' },
                ]}
              >
                {fechaSalida ? fechaBonita(fechaSalida) : (isAbierto ? 'sin marcar (abierto)' : '—')}
              </Text>
              <Pressable onPress={() => setShowPickerSalida(true)} hitSlop={10} style={styles.infoCta}>
                <Text style={styles.infoCtaTxt}>cambiar</Text>
              </Pressable>
              {fechaSalida && (
                <Pressable onPress={() => setFechaSalida(undefined)} hitSlop={10} style={styles.infoCta}>
                  <Text style={[styles.infoCtaTxt, { color: colors.danger }]}>quitar</Text>
                </Pressable>
              )}
            </View>
            {!fechaSalida && (
              <Pressable onPress={marcarSalidaHoy} style={styles.salidaHoyBtn}>
                <Text style={styles.salidaHoyTxt}>Marcar salida HOY</Text>
              </Pressable>
            )}
            {showPickerSalida && (
              <DateTimePicker
                value={new Date((fechaSalida ?? hoyISO()) + 'T00:00:00')}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                minimumDate={new Date(fechaEntrada + 'T00:00:00')}
                maximumDate={new Date()}
                onChange={(_e, selected) => {
                  setShowPickerSalida(false);
                  if (selected) {
                    const y = selected.getFullYear();
                    const m = String(selected.getMonth() + 1).padStart(2, '0');
                    const d = String(selected.getDate()).padStart(2, '0');
                    setFechaSalida(`${y}-${m}-${d}`);
                  }
                }}
              />
            )}
          </View>

          {/* === Categoría * === */}
          <Text style={styles.label}>Categoría *</Text>
          <View style={styles.pickerRow}>
            {PAST_CATEGORIAS.map(c => {
              const sel = categoria === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCategoria(prev => (prev === c ? undefined : c))}
                  style={[styles.catChip, sel && styles.catChipSel]}
                >
                  <Text style={[styles.catChipTxt, sel && styles.catChipTxtSel]}>{c}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* === Datos productivos (opcionales) ===
              Alimentan los KPIs Animales / KG/Cab / Kg Totales / Carga del
              dashboard. Si quedan vacíos, el stay se guarda igual sin
              datos productivos — no rompe nada. */}
          <View style={styles.dosColumnas}>
            <View style={styles.col}>
              <FormField
                label="Animales"
                value={animales}
                onChangeText={setAnimales}
                placeholder="cabezas"
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.col}>
              <FormField
                label="Kg promedio"
                value={kgPromedio}
                onChangeText={setKgPromedio}
                placeholder="kg / cab"
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* === N° Caravana === */}
          <FormField
            label="N° Caravana"
            value={caravanaNumero}
            onChangeText={setCaravanaNumero}
            placeholder="Ej. 0202"
            autoCapitalize="characters"
          />

          {/* === Categoría Animal === */}
          <Text style={styles.label}>Categoría animal</Text>
          <View style={styles.pickerRow}>
            {PAST_CAT_ANIMAL.map(c => {
              const sel = categoriaAnimal === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCategoriaAnimal(prev => (prev === c ? undefined : c))}
                  style={[styles.catChip, sel && styles.catChipSel]}
                >
                  <Text style={[styles.catChipTxt, sel && styles.catChipTxtSel]}>{c}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ height: spacing.md }} />

          <FaltaHint campos={camposFaltantes} />

          <PrimaryButton
            label={isEdit ? 'GUARDAR CAMBIOS' : 'GUARDAR PASTOREO'}
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
    gap: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold as '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    width: 70,
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
  hintInfo: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
  },

  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as '700',
    color: colors.textMuted,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Layout 2 columnas para Animales + Kg promedio en la misma fila —
  // ahorra scroll y refuerza visualmente que van juntos.
  dosColumnas: { flexDirection: 'row', gap: spacing.sm },
  col: { flex: 1 },

  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
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

  // Auto-fill (Has circuito / Has parcela)
  autoFillBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgLight,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  autoFillLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold as '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  autoFillValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as '700',
    color: colors.navy,
  },

  // Parcelas: chips con números grandes (más fáciles de tocar con guantes)
  parcelaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  parcelaChip: {
    minWidth: 56,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  parcelaChipSel: {
    backgroundColor: colors.orange,
    borderColor: colors.orange,
  },
  parcelaChipTxt: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold as '700',
    color: colors.textDark,
  },
  parcelaChipTxtSel: { color: colors.white },

  // Categoría chips (más anchos para mostrar texto largo "Vaquilla Reposicion")
  catChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.round,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    backgroundColor: colors.white,
    minHeight: 40,
    justifyContent: 'center',
  },
  catChipSel: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  catChipTxt: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold as '600',
    color: colors.textDark,
  },
  catChipTxtSel: {
    color: colors.white,
    fontWeight: fontWeight.bold as '700',
  },

  // Fecha card (entrada + salida)
  fechaCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.base,
    gap: spacing.sm,
  },
  salidaHoyBtn: {
    backgroundColor: colors.navy,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  salidaHoyTxt: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as '700',
    letterSpacing: 0.5,
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
