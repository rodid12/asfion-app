// CompraFormScreen — registro de compra de hacienda.
//
// Replica el módulo "Compra" del AppSheet de Ganaderas con 14 campos
// distribuidos en 3 secciones lógicas: físico, comercial, logístico.
//
// REFACTORIZADO con useEventoForm (A3 del audit) — el boilerplate común
// (campoId/fecha/edit-mode/save flow/alerts) vive en el hook. Acá queda
// solo lo específico de Compra: 14 campos del schema + lógica de
// auto-generar numero_operacion + cálculo merma + límites de cordura.
//
// Campos REQUIRED: campo, fecha, kg_origen, kg_destino.
// Resto opcional para permitir cargas parciales y completar después.

import React, { useEffect, useMemo, useRef, useState } from 'react';
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

import { ChipGroup } from '@/components/ChipGroup';
import { FaltaHint } from '@/components/FaltaHint';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionHeading } from '@/components/SectionHeading';
import { useClientConfig } from '@/config/ClientConfigContext';
import { useEventoForm } from '@/hooks/useEventoForm';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';
import type { RootStackParamList } from '@/navigation/types';
import type { Compra } from '@/data/types';
import { fechaBonita } from '@/utils/fechas';

type Rt = RouteProp<RootStackParamList, 'CompraForm'>;

/**
 * Auto-genera un numero_operacion con el formato del cliente:
 *
 *   NN_YY
 *
 * Donde:
 *   - YY = año de la fecha de la compra (2 dígitos: 2026 → "26")
 *   - NN = correlativo ascendente del mismo año (sin padding)
 *
 * Ejemplos:
 *   - Compra en 2026, ya hay 16 cargadas ese año → "17_26"
 *   - Primera compra del 2027                   → "1_27"
 *
 * El secuencial es UNO MÁS que el máximo correlativo encontrado en las
 * compras del año dado. NO es count() — eso falla si hay huecos (ej.
 * compras eliminadas o números cargados a mano fuera de orden).
 */
function generarNumeroOperacion(fechaISO: string, maxCorrelativo: number): string {
  const año = fechaISO.slice(2, 4); // "2026-06-25" → "26"
  return `${maxCorrelativo + 1}_${año}`;
}

/**
 * Dado un array de compras y un año, devuelve el correlativo más alto
 * encontrado (parseando el prefijo numérico antes del "_"). Si no hay
 * compras matching, devuelve 0.
 */
function maxCorrelativoDelAño(compras: Array<{ numeroOperacion?: string }>, añoYY: string): number {
  let max = 0;
  for (const c of compras) {
    const op = c.numeroOperacion?.trim();
    if (!op) continue;
    // Matchea solo el formato N_YY (rechaza "COR_28" del formato viejo)
    const m = /^(\d+)_(\d{2})$/.exec(op);
    if (!m || !m[1] || !m[2]) continue;
    if (m[2] !== añoYY) continue;
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

// ─────────────────────────────────────────────────────────────────────────────
// Límites de cordura — defensa contra typos / dedo gordo del operario.
// Calibrados con datos reales del cliente (las jaulas Ganaderas históricas
// rondan kg origen 1.500-23.000, precio 4.000-6.000, km 100-1.000).
// Multiplicamos por ~3-5x los máximos observados para tener margen sin
// dejar pasar valores absurdos tipo "999999".
// ─────────────────────────────────────────────────────────────────────────────
const MAX_KG_NETOS    = 3_000_000;  // 3000 toneladas — varias jaulas en una operación
const MAX_PRECIO_KG   = 50_000;     // pesos por kg — 10x el precio actual da margen para inflación
const MAX_KM          = 5_000;      // km recorridos — cualquier punto de Argentina a otro

/**
 * Calcula merma % desde kg origen y destino. Devuelve number con 2 decimales
 * o undefined si los inputs no son válidos / origen es 0.
 */
function calcularMerma(kgOrigen: number, kgDestino: number): number | undefined {
  if (!Number.isFinite(kgOrigen) || !Number.isFinite(kgDestino)) return undefined;
  if (kgOrigen <= 0) return undefined;
  const merma = ((kgOrigen - kgDestino) / kgOrigen) * 100;
  return Math.round(merma * 100) / 100; // 2 decimales
}

// ---------- pantalla ----------

export function CompraFormScreen() {
  const route = useRoute<Rt>();
  const compraId = route.params?.compraId;

  const clientConfig = useClientConfig();
  const catCompras = clientConfig.catalogos.compras;

  // ─── State específico de Compra (14 campos) ───
  const [pickerCampoOpen, setPickerCampoOpen] = useState(false);
  const [showFechaPicker, setShowFechaPicker] = useState(false);

  const [actividad, setActividad] = useState<string | undefined>();
  const [cantCabYCat, setCantCabYCat] = useState('');
  const [kgOrigenStr, setKgOrigenStr] = useState('');
  const [kgDestinoStr, setKgDestinoStr] = useState('');
  const [mermaManualStr, setMermaManualStr] = useState('');     // si vacío, usamos auto
  const [kgCorregidosStr, setKgCorregidosStr] = useState('');
  const [precio, setPrecio] = useState('');
  const [consignado, setConsignado] = useState('');
  const [titular, setTitular] = useState('');
  const [plazo, setPlazo] = useState<string | undefined>();
  const [numeroDte, setNumeroDte] = useState('');
  const [numeroOperacion, setNumeroOperacion] = useState('');  // auto-gen al guardar si vacío
  const [kmRecorridoStr, setKmRecorridoStr] = useState('');
  const [observaciones, setObservaciones] = useState('');

  // Ref para que `buildEvento` vea el numero_operacion auto-generado sin
  // depender del state async de setNumeroOperacion (que toma 1 render extra
  // para propagarse al closure).
  const numeroOpRef = useRef<string>('');

  // ─── Parses + validación específica (necesarios ANTES del hook ─
  //     porque buildEvento del hook los lee del closure) ───
  const kgOrigenNum    = Number(kgOrigenStr.replace(',', '.'));
  const kgDestinoNum   = Number(kgDestinoStr.replace(',', '.'));
  const mermaCalculada = useMemo(
    () => calcularMerma(kgOrigenNum, kgDestinoNum),
    [kgOrigenNum, kgDestinoNum],
  );
  const mermaShow = mermaManualStr.trim()
    ? mermaManualStr
    : (mermaCalculada != null ? mermaCalculada.toFixed(2) : '');

  // ─── State común vía useEventoForm ───
  const ef = useEventoForm<Compra>({
    tipo: 'compra',
    eventoId: compraId,
    titleNew: 'Nueva compra',
    titleEdit: 'Editar compra',
    tabName: 'compras',
    buildEvento: ({ campoId, fecha, usuarioEmail, id, createdAt }) => {
      if (!campoId || !Number.isFinite(kgOrigenNum) || !Number.isFinite(kgDestinoNum)) return null;
      // numero_operacion se completa después (necesita listEventos), por ahora
      // dejamos lo que tipeó el usuario; el handleGuardar lo completa al final.
      const mermaFinal = mermaManualStr.trim()
        ? Number(mermaManualStr.replace(',', '.'))
        : mermaCalculada;
      const kgCorregidosNum = kgCorregidosStr.trim() ? Number(kgCorregidosStr.replace(',', '.')) : undefined;
      const precioNum       = precio.trim() ? Number(precio.replace(',', '.')) : undefined;
      const kmNum           = kmRecorridoStr.trim() ? Number(kmRecorridoStr.replace(',', '.')) : undefined;
      return {
        tipo: 'compra',
        id, campoId, fecha, usuarioEmail, createdAt,
        actividad,
        cantCabYCat: cantCabYCat.trim() || undefined,
        kgNetosOrigen: kgOrigenNum,
        kgNetosDestino: kgDestinoNum,
        mermaPorcentaje: mermaFinal != null && Number.isFinite(mermaFinal) ? mermaFinal : undefined,
        kgCorregidos: kgCorregidosNum != null && Number.isFinite(kgCorregidosNum) ? kgCorregidosNum : undefined,
        precio: precioNum != null && Number.isFinite(precioNum) ? precioNum : undefined,
        consignado: consignado.trim() || undefined,
        titular: titular.trim() || undefined,
        plazo,
        numeroDte: numeroDte.trim() || undefined,
        // Prioridad: ref (auto-generado en handleGuardar) > state (lo que tipeó el operario)
        numeroOperacion: (numeroOpRef.current || numeroOperacion.trim()) || undefined,
        kmRecorrido: kmNum != null && Number.isFinite(kmNum) ? Math.round(kmNum) : undefined,
        observaciones: observaciones.trim() || undefined,
        syncState: 'pending',
      };
    },
    formatSummary: (e) => `Compra ${e.numeroOperacion ?? '(sin n°)'} guardada${e.cantCabYCat ? ` · ${e.cantCabYCat}` : ''}`,
    resetEspecifico: () => {
      // Conservamos campo + fecha — típico cargar varias compras del mismo día
      setActividad(undefined); setCantCabYCat(''); setKgOrigenStr(''); setKgDestinoStr('');
      setMermaManualStr(''); setKgCorregidosStr(''); setPrecio(''); setConsignado('');
      setTitular(''); setPlazo(undefined); setNumeroDte(''); setNumeroOperacion('');
      setKmRecorridoStr(''); setObservaciones('');
    },
  });
  const { campoId, setCampoId, fecha, setFecha, campos, campoActual,
          isEdit, cargandoExistente, originalRecord,
          guardando, onGuardar, nav, repo } = ef;

  // ─── Hidratación específica en edit mode ───
  useEffect(() => {
    ef.registerPrefill((existing) => {
      setActividad(existing.actividad);
      setCantCabYCat(existing.cantCabYCat ?? '');
      setKgOrigenStr(String(existing.kgNetosOrigen));
      // Post mig 0021 kgNetosDestino puede ser null. String(null)='null' rompe UI.
      setKgDestinoStr(existing.kgNetosDestino != null ? String(existing.kgNetosDestino) : '');
      setMermaManualStr(existing.mermaPorcentaje != null ? String(existing.mermaPorcentaje) : '');
      setKgCorregidosStr(existing.kgCorregidos != null ? String(existing.kgCorregidos) : '');
      setPrecio(existing.precio != null ? String(existing.precio) : '');
      setConsignado(existing.consignado ?? '');
      setTitular(existing.titular ?? '');
      setPlazo(existing.plazo);
      setNumeroDte(existing.numeroDte ?? '');
      setNumeroOperacion(existing.numeroOperacion ?? '');
      setKmRecorridoStr(existing.kmRecorrido != null ? String(existing.kmRecorrido) : '');
      setObservaciones(existing.observaciones ?? '');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- validación de cordura específica de Compra ----------
  const precioNumVal = precio.trim() ? Number(precio.replace(',', '.')) : NaN;
  const kmNumVal     = kmRecorridoStr.trim() ? Number(kmRecorridoStr.replace(',', '.')) : NaN;

  const errores: string[] = [];
  if (!campoId) errores.push('Campo');
  if (!fecha) errores.push('Fecha');
  if (!kgOrigenStr.trim() || !Number.isFinite(kgOrigenNum) || kgOrigenNum < 0) errores.push('Kg Origen');
  else if (kgOrigenNum > MAX_KG_NETOS) errores.push(`Kg Origen (máx ${MAX_KG_NETOS.toLocaleString('es-AR')})`);
  if (!kgDestinoStr.trim() || !Number.isFinite(kgDestinoNum) || kgDestinoNum < 0) errores.push('Kg Destino');
  else if (kgDestinoNum > MAX_KG_NETOS) errores.push(`Kg Destino (máx ${MAX_KG_NETOS.toLocaleString('es-AR')})`);
  if (precio.trim() && (!Number.isFinite(precioNumVal) || precioNumVal < 0 || precioNumVal > MAX_PRECIO_KG)) {
    errores.push(`Precio (máx ${MAX_PRECIO_KG.toLocaleString('es-AR')}/kg)`);
  }
  if (kmRecorridoStr.trim() && (!Number.isFinite(kmNumVal) || kmNumVal < 0 || kmNumVal > MAX_KM)) {
    errores.push(`Km Recorrido (máx ${MAX_KM.toLocaleString('es-AR')})`);
  }

  const valid = errores.length === 0;

  // ---------- isDirty (solo en edit) ----------
  const isDirty = useMemo(() => {
    if (!isEdit || !originalRecord) return true;
    return (
      campoId !== originalRecord.campoId ||
      fecha !== originalRecord.fecha ||
      actividad !== originalRecord.actividad ||
      cantCabYCat !== (originalRecord.cantCabYCat ?? '') ||
      kgOrigenStr !== String(originalRecord.kgNetosOrigen) ||
      kgDestinoStr !== (originalRecord.kgNetosDestino != null ? String(originalRecord.kgNetosDestino) : '') ||
      mermaManualStr !== (originalRecord.mermaPorcentaje != null ? String(originalRecord.mermaPorcentaje) : '') ||
      kgCorregidosStr !== (originalRecord.kgCorregidos != null ? String(originalRecord.kgCorregidos) : '') ||
      precio !== (originalRecord.precio != null ? String(originalRecord.precio) : '') ||
      consignado !== (originalRecord.consignado ?? '') ||
      titular !== (originalRecord.titular ?? '') ||
      plazo !== originalRecord.plazo ||
      numeroDte !== (originalRecord.numeroDte ?? '') ||
      numeroOperacion !== (originalRecord.numeroOperacion ?? '') ||
      kmRecorridoStr !== (originalRecord.kmRecorrido != null ? String(originalRecord.kmRecorrido) : '') ||
      observaciones !== (originalRecord.observaciones ?? '')
    );
  }, [isEdit, originalRecord, campoId, fecha, actividad, cantCabYCat, kgOrigenStr, kgDestinoStr, mermaManualStr, kgCorregidosStr, precio, consignado, titular, plazo, numeroDte, numeroOperacion, kmRecorridoStr, observaciones]);

  // ─── Guardar — validación específica primero, después delega al hook ───
  // El hook arma el evento con buildEvento (que está arriba) y maneja el flow
  // común (save + alerts + reset). Lo único que necesita "saber" Compra acá
  // es el numero_operacion auto-generado: como necesita un listEventos para
  // calcular el correlativo, lo hacemos antes del onGuardar y seteamos el
  // state local (que buildEvento ya va a leer).
  const handleGuardar = async () => {
    if (!valid || !campoId) {
      Alert.alert('Faltan datos', `Completá: ${errores.join(', ')}`);
      return;
    }
    // Auto-gen numero_operacion si está vacío — patrón cliente "NN_YY".
    // Lo guardamos en ref (síncrono) para que buildEvento del hook lo vea,
    // y también lo seteamos en state para que la UI lo refleje en el textbox.
    if (!numeroOperacion.trim()) {
      const compraExistentes = (await repo.listEventos('compra')) as Compra[];
      const añoYY = fecha.slice(2, 4);
      const max = maxCorrelativoDelAño(compraExistentes, añoYY);
      const generado = generarNumeroOperacion(fecha, max);
      numeroOpRef.current = generado;
      setNumeroOperacion(generado);
    } else {
      numeroOpRef.current = numeroOperacion.trim();
    }
    const result = await onGuardar();
    // Reset del ref tras guardado (para "cargar otra" si el operario continúa)
    if (result) numeroOpRef.current = '';
  };

  if (cargandoExistente) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderTxt}>Cargando compra...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const guardarHabilitado = valid && !guardando && (!isEdit || isDirty);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* ============ HEADER: usuario + campo + fecha ============ */}
          <View style={styles.headerCard}>
            <View style={styles.headerRow}>
              <Text style={styles.headerLabel}>Usuario</Text>
              <Text style={styles.headerValue} numberOfLines={1}>{ef.user?.email ?? '—'}</Text>
            </View>

            {/* Campo — required */}
            <View style={styles.headerRow}>
              <Text style={styles.headerLabel}>Campo *</Text>
              <Pressable
                style={styles.headerPicker}
                onPress={() => setPickerCampoOpen(o => !o)}
              >
                <Text style={[styles.headerValue, !campoId && styles.headerValueEmpty]} numberOfLines={1}>
                  {campoActual?.nombre ?? 'Elegir campo'}
                </Text>
                <Text style={styles.chev}>▾</Text>
              </Pressable>
            </View>
            {pickerCampoOpen && (
              <View style={styles.pickerOptions}>
                {campos.map(c => {
                  const sel = c.id === campoId;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => { setCampoId(c.id); setPickerCampoOpen(false); }}
                      style={[styles.pickerOpt, sel && styles.pickerOptSel]}
                    >
                      <Text style={[styles.pickerOptTxt, sel && styles.pickerOptTxtSel]}>{c.nombre}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Fecha */}
            <View style={styles.headerRow}>
              <Text style={styles.headerLabel}>Fecha</Text>
              <Pressable style={styles.headerPicker} onPress={() => setShowFechaPicker(true)}>
                <Text style={styles.headerValue}>{fechaBonita(fecha)}</Text>
                <Text style={styles.chev}>▾</Text>
              </Pressable>
            </View>
            {showFechaPicker && (
              <DateTimePicker
                value={new Date(fecha + 'T00:00:00')}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                maximumDate={new Date()}
                onChange={(_e, sel) => {
                  if (Platform.OS !== 'ios') setShowFechaPicker(false);
                  if (sel) {
                    setFecha(`${sel.getFullYear()}-${String(sel.getMonth() + 1).padStart(2, '0')}-${String(sel.getDate()).padStart(2, '0')}`);
                  }
                }}
              />
            )}
            {Platform.OS === 'ios' && showFechaPicker && (
              <Pressable onPress={() => setShowFechaPicker(false)} style={styles.pickerDoneBtn}>
                <Text style={styles.pickerDoneTxt}>Listo</Text>
              </Pressable>
            )}
          </View>

          {/* ============ SECCIÓN: HACIENDA ============ */}
          <SectionHeading>Hacienda</SectionHeading>

          {/* Actividad — chips */}
          {catCompras.actividades.length > 0 && (
            <>
              <Text style={styles.label}>Actividad</Text>
              <ChipGroup
                options={catCompras.actividades as string[]}
                value={actividad}
                onChange={setActividad as (v: string | undefined) => void}
              />
            </>
          )}

          {/* Cantidad y categoría — texto libre como AppSheet */}
          <FormField
            label="Cantidad y categoría"
            value={cantCabYCat}
            onChangeText={setCantCabYCat}
            placeholder="Ej. 83 machos. 27 hembras"
          />

          {/* Kg Origen + Kg Destino en 2 columnas */}
          <View style={styles.dosColumnas}>
            <View style={styles.col}>
              <FormField
                label="Kg netos origen *"
                value={kgOrigenStr}
                onChangeText={setKgOrigenStr}
                placeholder="0"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.col}>
              <FormField
                label="Kg netos destino *"
                value={kgDestinoStr}
                onChangeText={setKgDestinoStr}
                placeholder="0"
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* Merma % (auto-calculada, editable) + Kg corregidos (manual) */}
          <View style={styles.dosColumnas}>
            <View style={styles.col}>
              <FormField
                label="Merma %"
                value={mermaShow}
                onChangeText={setMermaManualStr}
                placeholder="auto"
                keyboardType="decimal-pad"
              />
              {!mermaManualStr.trim() && mermaCalculada != null && (
                <Text style={styles.helperTxt}>
                  Auto: (origen − destino) / origen × 100
                </Text>
              )}
            </View>
            <View style={styles.col}>
              <FormField
                label="Kg corregidos"
                value={kgCorregidosStr}
                onChangeText={setKgCorregidosStr}
                placeholder="manual"
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* ============ SECCIÓN: COMERCIAL ============ */}
          <SectionHeading>Comercial</SectionHeading>

          <View style={styles.dosColumnas}>
            <View style={styles.col}>
              <FormField
                label="Precio (ARS/kg)"
                value={precio}
                onChangeText={setPrecio}
                placeholder="0"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.col}>
              {catCompras.plazos.length > 0 ? (
                <>
                  <Text style={styles.label}>Plazo</Text>
                  <View style={styles.plazoRow}>
                    {catCompras.plazos.map(p => {
                      const sel = plazo === p;
                      return (
                        <Pressable
                          key={p}
                          onPress={() => setPlazo(sel ? undefined : p)}
                          style={[styles.plazoChip, sel && styles.plazoChipSel]}
                        >
                          <Text style={[styles.plazoChipTxt, sel && styles.plazoChipTxtSel]}>
                            {p}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : (
                <FormField
                  label="Plazo"
                  value={plazo ?? ''}
                  onChangeText={setPlazo}
                  placeholder="Ej. Contado"
                />
              )}
            </View>
          </View>

          <FormField
            label="Consignado"
            value={consignado}
            onChangeText={setConsignado}
            placeholder="Nombre del consignatario"
          />

          <FormField
            label="Titular"
            value={titular}
            onChangeText={setTitular}
            placeholder="Nombre y/o dirección del vendedor"
          />

          {/* ============ SECCIÓN: LOGÍSTICA ============ */}
          <SectionHeading>Logística</SectionHeading>

          <View style={styles.dosColumnas}>
            <View style={styles.col}>
              <FormField
                label="N° DTE"
                value={numeroDte}
                onChangeText={setNumeroDte}
                placeholder="318444587"
              />
            </View>
            <View style={styles.col}>
              <FormField
                label="Km recorrido"
                value={kmRecorridoStr}
                onChangeText={setKmRecorridoStr}
                placeholder="0"
                keyboardType="number-pad"
              />
            </View>
          </View>

          <FormField
            label="N° Operación"
            value={numeroOperacion}
            onChangeText={setNumeroOperacion}
            placeholder={`auto: N_${fecha.slice(2, 4)} al guardar`}
          />
          {!numeroOperacion.trim() && (
            <Text style={styles.helperTxt}>
              Se genera al guardar: correlativo del año (ej. 17_{fecha.slice(2, 4)}).
              Si querés ponerlo a mano, escribilo y se respeta.
            </Text>
          )}

          <FormField
            label="Observaciones"
            value={observaciones}
            onChangeText={setObservaciones}
            placeholder="Notas adicionales sobre la compra"
            multiline
          />

          {/* ============ BOTÓN ============ */}
          {!valid && (
            <FaltaHint campos={errores} />
          )}
          {isEdit && !isDirty && (
            <Text style={styles.noChangesHint}>Sin cambios para guardar.</Text>
          )}

          <PrimaryButton
            label={guardando ? 'Guardando...' : (isEdit ? 'Guardar cambios' : 'Guardar compra')}
            onPress={handleGuardar}
            disabled={!guardarHabilitado}
            loading={guardando}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgLight },
  scroll: { padding: spacing.base, gap: spacing.md, paddingBottom: spacing.xxxl },

  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholderTxt: { fontSize: fontSize.md, color: colors.textMuted, fontStyle: 'italic' },

  // Header card
  headerCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: spacing.sm,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  headerLabel: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: fontWeight.semibold as '600' },
  headerValue: { flex: 1, fontSize: fontSize.md, color: colors.textDark, fontWeight: fontWeight.semibold as '600', textAlign: 'right' },
  headerValueEmpty: { color: colors.textMuted, fontStyle: 'italic' },
  headerPicker: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1, justifyContent: 'flex-end' },
  // Flecha dropdown más grande (14) para mejor visibilidad — consistente con los chips de filtro.
  chev: { fontSize: 14, color: colors.textMuted, fontWeight: '700' },

  pickerOptions: { gap: spacing.xs, marginTop: spacing.xs },
  pickerOpt: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.bgLight,
  },
  pickerOptSel: { backgroundColor: colors.navy, borderColor: colors.navy },
  pickerOptTxt: { fontSize: fontSize.md, color: colors.textDark, fontWeight: fontWeight.semibold as '600' },
  pickerOptTxtSel: { color: colors.white, fontWeight: fontWeight.bold as '700' },

  pickerDoneBtn: { alignSelf: 'flex-end', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  pickerDoneTxt: { color: colors.navy, fontSize: fontSize.md, fontWeight: fontWeight.bold as '700' },

  // Sections
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as '700',
    color: colors.navy,
    marginTop: spacing.md,
    letterSpacing: 0.4,
  },

  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as '700',
    color: colors.textMuted,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Layout 2 columnas — Kg origen + Kg destino, etc.
  dosColumnas: { flexDirection: 'row', gap: spacing.sm },
  col: { flex: 1 },

  helperTxt: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: -spacing.xs,
    marginBottom: spacing.xs,
  },

  // Plazo chips
  plazoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  plazoChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.white,
  },
  plazoChipSel: { backgroundColor: colors.navy, borderColor: colors.navy },
  plazoChipTxt: { fontSize: fontSize.sm, color: colors.textDark, fontWeight: fontWeight.semibold as '600' },
  plazoChipTxtSel: { color: colors.white, fontWeight: fontWeight.bold as '700' },

  noChangesHint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
});
