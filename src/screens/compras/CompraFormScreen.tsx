// CompraFormScreen — registro de compra de hacienda.
//
// Replica el módulo "Compra" del AppSheet de Ganaderas con 14 campos
// distribuidos en 3 secciones lógicas: físico, comercial, logístico.
//
// Comportamientos automáticos:
//   - merma % se calcula auto al cambiar kg_origen o kg_destino:
//       (origen - destino) / origen * 100
//     El operario puede editarlo manualmente si quiere overridear.
//   - numero_operacion se auto-genera al GUARDAR con formato
//       <3 primeras letras del campo>_<secuencial>
//     Ej: "COR_28" para la compra #28 del campo Corrales.
//     Editable antes de guardar si el operario quiere otro formato.
//
// Campos REQUIRED: campo, fecha, kg_origen, kg_destino.
// Resto opcional para permitir cargas parciales y completar después.

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
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import { v4 as uuidv4 } from 'uuid';

import { ChipGroup } from '@/components/ChipGroup';
import { FaltaHint } from '@/components/FaltaHint';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAuth } from '@/auth/context';
import { useRepository } from '@/data';
import { useClientConfig } from '@/config/ClientConfigContext';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';
import { useTabNav } from '@/navigation/TabContext';
import type { RootStackParamList } from '@/navigation/types';
import type { Campo, Compra } from '@/data/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'CompraForm'>;
type Rt = RouteProp<RootStackParamList, 'CompraForm'>;

// ---------- helpers ----------

function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fechaBonita(iso: string): string {
  const [yy, mm, dd] = iso.split('-').map(Number);
  if (!yy || !mm || !dd) return iso;
  const dow = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'][new Date(yy, mm - 1, dd).getDay()];
  return `${dow} ${dd}/${mm}/${yy}`;
}

/**
 * Auto-genera un numero_operacion basado en el campo + un secuencial.
 * Formato: <3 primeras letras del campo en mayúsculas>_<numero>
 *
 * Ejemplos:
 *   - "Corrales" + secuencial 28 → "COR_28"
 *   - "Picaflor" + secuencial 5  → "PIC_5"
 *
 * El secuencial es el count de compras existentes del campo + 1. NO es
 * único cross-clientes pero sí dentro del mismo cliente (RLS filtra).
 */
function generarNumeroOperacion(campoNombre: string, secuencial: number): string {
  const prefix = campoNombre.trim().slice(0, 3).toUpperCase().replace(/[^A-ZÁÉÍÓÚÑ]/g, '');
  return `${prefix || 'CMP'}_${secuencial}`;
}

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
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const compraId = route.params?.compraId;
  const isEdit = Boolean(compraId);

  const { user } = useAuth();
  const repo = useRepository();
  const { switchTab } = useTabNav();
  const clientConfig = useClientConfig();
  const catCompras = clientConfig.catalogos.compras;

  // Estado del form — todos los 14 campos del schema.
  const [campos, setCampos] = useState<Campo[]>([]);
  const [campoId, setCampoId] = useState<string | undefined>();
  const [pickerCampoOpen, setPickerCampoOpen] = useState(false);

  const [fecha, setFecha] = useState<string>(hoyISO());
  const [showFechaPicker, setShowFechaPicker] = useState(false);

  const [actividad, setActividad] = useState<string | undefined>();
  const [cantCabYCat, setCantCabYCat] = useState('');
  const [kgOrigenStr, setKgOrigenStr] = useState('');
  const [kgDestinoStr, setKgDestinoStr] = useState('');
  const [mermaManualStr, setMermaManualStr] = useState(''); // si vacío, usamos auto
  const [kgCorregidosStr, setKgCorregidosStr] = useState('');

  const [precio, setPrecio] = useState('');
  const [consignado, setConsignado] = useState('');
  const [titular, setTitular] = useState('');
  const [plazo, setPlazo] = useState<string | undefined>();

  const [numeroDte, setNumeroDte] = useState('');
  const [numeroOperacion, setNumeroOperacion] = useState(''); // auto-gen al guardar si vacío
  const [kmRecorridoStr, setKmRecorridoStr] = useState('');

  const [observaciones, setObservaciones] = useState('');

  const [createdAtOriginal, setCreatedAtOriginal] = useState<string | undefined>();
  const [originalRecord, setOriginalRecord] = useState<Compra | null>(null);
  const [cargandoExistente, setCargandoExistente] = useState<boolean>(isEdit);
  const [guardando, setGuardando] = useState(false);

  // ---------- cargar campos al montar ----------
  useEffect(() => {
    (async () => {
      try {
        const cs = await repo.listCampos();
        setCampos(cs);
        // Si el usuario tiene asignado un campo, lo pre-seleccionamos.
        if (!isEdit && user?.campoAsignadoId) {
          setCampoId(user.campoAsignadoId);
        }
        // Si solo hay UN campo visible, auto-seleccionarlo.
        if (!isEdit && cs.length === 1) {
          setCampoId(cs[0]!.id);
        }
      } catch (err) {
        Alert.alert('Error', 'No se pudieron cargar los campos.');
      }
    })();
  }, [repo, user, isEdit]);

  // ---------- modo edit: cargar registro existente ----------
  useEffect(() => {
    if (!compraId) return;
    (async () => {
      try {
        const all = (await repo.listEventos('compra')) as Compra[];
        const existing = all.find(c => c.id === compraId);
        if (!existing) {
          Alert.alert('No encontrado', 'No se pudo cargar la compra para editar.');
          nav.goBack();
          return;
        }
        setCampoId(existing.campoId);
        setFecha(existing.fecha);
        setActividad(existing.actividad);
        setCantCabYCat(existing.cantCabYCat ?? '');
        setKgOrigenStr(String(existing.kgNetosOrigen));
        setKgDestinoStr(String(existing.kgNetosDestino));
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
        setCreatedAtOriginal(existing.createdAt);
        setOriginalRecord(existing);
      } catch (err) {
        Alert.alert('Error', err instanceof Error ? err.message : String(err));
      } finally {
        setCargandoExistente(false);
      }
    })();
  }, [compraId, repo, nav]);

  // ---------- merma auto-calculada ----------
  // Si el operario ingresó manual, respetamos. Sino, calculamos.
  const kgOrigenNum = Number(kgOrigenStr.replace(',', '.'));
  const kgDestinoNum = Number(kgDestinoStr.replace(',', '.'));
  const mermaCalculada = useMemo(
    () => calcularMerma(kgOrigenNum, kgDestinoNum),
    [kgOrigenNum, kgDestinoNum],
  );
  const mermaShow = mermaManualStr.trim()
    ? mermaManualStr
    : (mermaCalculada != null ? mermaCalculada.toFixed(2) : '');

  // ---------- validación ----------
  const campoActual = campos.find(c => c.id === campoId);

  const errores: string[] = [];
  if (!campoId) errores.push('Campo');
  if (!fecha) errores.push('Fecha');
  if (!kgOrigenStr.trim() || !Number.isFinite(kgOrigenNum) || kgOrigenNum < 0) errores.push('Kg Origen');
  if (!kgDestinoStr.trim() || !Number.isFinite(kgDestinoNum) || kgDestinoNum < 0) errores.push('Kg Destino');

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
      kgDestinoStr !== String(originalRecord.kgNetosDestino) ||
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

  // ---------- guardar ----------
  const onGuardar = async () => {
    if (!user) {
      Alert.alert('Sesión expirada', 'Volvé a iniciar sesión.');
      return;
    }
    if (!valid || !campoId) {
      Alert.alert('Faltan datos', `Completá: ${errores.join(', ')}`);
      return;
    }

    setGuardando(true);

    try {
      // Auto-generar numero_operacion si está vacío.
      let numeroOpFinal = numeroOperacion.trim();
      if (!numeroOpFinal) {
        const compraExistentes = (await repo.listEventos('compra', { campoId })) as Compra[];
        numeroOpFinal = generarNumeroOperacion(
          campoActual?.nombre ?? 'CMP',
          compraExistentes.length + 1,
        );
      }

      // Merma: usar manual si lo escribió, sino auto.
      const mermaFinal = mermaManualStr.trim()
        ? Number(mermaManualStr.replace(',', '.'))
        : mermaCalculada;

      const kgCorregidosNum = kgCorregidosStr.trim() ? Number(kgCorregidosStr.replace(',', '.')) : undefined;
      const precioNum = precio.trim() ? Number(precio.replace(',', '.')) : undefined;
      const kmNum = kmRecorridoStr.trim() ? Number(kmRecorridoStr.replace(',', '.')) : undefined;

      const compra: Compra = {
        tipo: 'compra',
        id: compraId ?? uuidv4(),
        fecha,
        campoId,
        usuarioEmail: user.email,
        // Físico
        actividad,
        cantCabYCat: cantCabYCat.trim() || undefined,
        kgNetosOrigen: kgOrigenNum,
        kgNetosDestino: kgDestinoNum,
        mermaPorcentaje: mermaFinal != null && Number.isFinite(mermaFinal) ? mermaFinal : undefined,
        kgCorregidos: kgCorregidosNum != null && Number.isFinite(kgCorregidosNum) ? kgCorregidosNum : undefined,
        // Comerciales
        precio: precioNum != null && Number.isFinite(precioNum) ? precioNum : undefined,
        consignado: consignado.trim() || undefined,
        titular: titular.trim() || undefined,
        plazo,
        // Logística
        numeroDte: numeroDte.trim() || undefined,
        numeroOperacion: numeroOpFinal,
        kmRecorrido: kmNum != null && Number.isFinite(kmNum) ? Math.round(kmNum) : undefined,
        observaciones: observaciones.trim() || undefined,
        createdAt: createdAtOriginal ?? new Date().toISOString(),
        syncState: 'pending',
      };

      const saved = await repo.saveEvento(compra);
      const sincronizada = saved.syncState === 'synced';
      const base = `Compra ${numeroOpFinal} guardada${cantCabYCat ? ` · ${cantCabYCat}` : ''}`;
      const detalle = !sincronizada && saved.syncError
        ? `\n\nGuardado offline. Detalle: ${saved.syncError}`
        : (!sincronizada ? '\n\nGuardado offline. Se sincroniza cuando haya señal.' : '');

      Alert.alert(
        sincronizada ? 'Listo' : 'Guardado offline',
        base + detalle,
        isEdit
          ? [{ text: 'OK', onPress: () => nav.goBack() }]
          : [
              { text: 'Ver listado', onPress: () => { switchTab('compras'); nav.goBack(); } },
              { text: 'Cargar otra', onPress: resetForm, style: 'cancel' },
            ],
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const esSesion = msg.toLowerCase().includes('sesión') || msg.toLowerCase().includes('jwt');
      Alert.alert(
        esSesion ? 'Sesión expirada' : 'Error al guardar',
        esSesion ? `${msg}\n\nVolvé a Menú → Salir y entrá de nuevo.` : msg,
      );
    } finally {
      setGuardando(false);
    }
  };

  const resetForm = () => {
    // Conservamos campo + fecha — típico cargar varias compras del mismo día.
    setActividad(undefined);
    setCantCabYCat('');
    setKgOrigenStr('');
    setKgDestinoStr('');
    setMermaManualStr('');
    setKgCorregidosStr('');
    setPrecio('');
    setConsignado('');
    setTitular('');
    setPlazo(undefined);
    setNumeroDte('');
    setNumeroOperacion('');
    setKmRecorridoStr('');
    setObservaciones('');
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
              <Text style={styles.headerValue} numberOfLines={1}>{user?.email ?? '—'}</Text>
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
          <Text style={styles.sectionTitle}>Hacienda</Text>

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
          <Text style={styles.sectionTitle}>Comercial</Text>

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
          <Text style={styles.sectionTitle}>Logística</Text>

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
            placeholder={campoActual ? `auto: ${generarNumeroOperacion(campoActual.nombre, '?' as any)}` : 'auto al guardar'}
          />
          {!numeroOperacion.trim() && (
            <Text style={styles.helperTxt}>
              Se genera automáticamente al guardar: ej. {campoActual ? `${campoActual.nombre.slice(0, 3).toUpperCase()}_N` : 'COR_N'}
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
            onPress={onGuardar}
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
  chev: { fontSize: 12, color: colors.textMuted },

  pickerOptions: { gap: spacing.xs, marginTop: spacing.xs },
  pickerOpt: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.bgLight,
  },
  pickerOptSel: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  pickerOptTxt: { fontSize: fontSize.md, color: colors.textDark, fontWeight: fontWeight.semibold as '600' },
  pickerOptTxtSel: { color: colors.white, fontWeight: fontWeight.bold as '700' },

  pickerDoneBtn: { alignSelf: 'flex-end', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  pickerDoneTxt: { color: colors.greenDark, fontSize: fontSize.md, fontWeight: fontWeight.bold as '700' },

  // Sections
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as '700',
    color: colors.greenDark,
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
  plazoChipSel: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
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
