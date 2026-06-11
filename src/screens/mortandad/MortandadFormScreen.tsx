// MortandadFormScreen — versión simplificada al mínimo (post-feedback Ro).
//
// Filosofía consistente con Parición y Pastoreo: "mientras menos cargue el
// peón, mejor". Quedan solo los campos estructuralmente necesarios.
//
// Antes había: caravana color/número, causa detalle (chips + texto libre),
// fotos, observaciones — todo opcional. Ro pidió sacarlo todo.
//
// Quedan:
//
//   - Header card: Usuario / Campo / LOTE (NUEVO, required) / Fecha / GPS
//   - Body: Categoría * (vaca/ternero/...) y Causa — tipo (Muerte Señalado /
//     Nacido Muerto / Desconocido). Categoría es required, causa-tipo no.
//
// Si más adelante queremos volver a habilitar caravana / fotos / observaciones,
// los tipos siguen aceptándolos — solo hay que volver a pintarlos en el form.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import { v4 as uuidv4 } from 'uuid';

import { ChipGroup } from '@/components/ChipGroup';
import { FaltaHint } from '@/components/FaltaHint';
import { NoLotesBanner } from '@/components/NoLotesBanner';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAuth } from '@/auth/context';
import { useRepository } from '@/data';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';
import { useTabNav } from '@/navigation/TabContext';
import type { RootStackParamList } from '@/navigation/types';
import type {
  Campo,
  CausaMuerteTipo,
  Lote,
  Mortandad,
} from '@/data/types';
import { useClientConfig } from '@/config/ClientConfigContext';

type Nav = NativeStackNavigationProp<RootStackParamList, 'MortandadForm'>;
type Rt = RouteProp<RootStackParamList, 'MortandadForm'>;

// Catálogos ahora vienen de useClientConfig() — ver el hook adentro del
// componente. Por cliente las categorías y actividades cambian.

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

// ---------- pantalla ----------

export function MortandadFormScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const repo = useRepository();
  const { user } = useAuth();
  const { switchTab } = useTabNav();

  const mortandadId = route.params?.mortandadId;
  const isEdit = Boolean(mortandadId);

  // Catálogos del cliente activo
  const catMort = useClientConfig().catalogos.mortandad;
  const CATEGORIAS = catMort.categorias;
  const ACTIVIDADES = catMort.actividades;
  const CAUSAS_TIPO = catMort.causaTipos as readonly CausaMuerteTipo[];

  // Form state — mucho más chico que la versión anterior
  const [campoId, setCampoId] = useState<string>(user?.campoAsignadoId ?? '');
  const [loteId, setLoteId] = useState<string>('');
  const [fecha, setFecha] = useState<string>(hoyISO());
  const [categoria, setCategoria] = useState<string | undefined>();
  const [actividad, setActividad] = useState<string | undefined>();
  const [causaTipo, setCausaTipo] = useState<CausaMuerteTipo | undefined>();
  const [gps, setGps] = useState<Mortandad['gps']>(undefined);

  // UI state
  const [campos, setCampos] = useState<Campo[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [pickerCampoOpen, setPickerCampoOpen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [cargandoExistente, setCargandoExistente] = useState<boolean>(isEdit);
  const [createdAtOriginal, setCreatedAtOriginal] = useState<string | undefined>();
  // Snapshot original — alimenta el isDirty check.
  const [originalRecord, setOriginalRecord] = useState<Mortandad | null>(null);

  // ---------- títulos dinámicos ----------
  useEffect(() => {
    nav.setOptions({ title: isEdit ? 'Editar mortandad' : 'Nueva mortandad' });
  }, [nav, isEdit]);

  // ---------- cargar campos ----------
  const loadCampos = useCallback(async () => {
    const cs = await repo.listCampos();
    setCampos(cs);
    if (!campoId && cs.length === 1 && cs[0]) {
      setCampoId(cs[0].id);
    }
  }, [repo, campoId]);

  useEffect(() => { loadCampos(); }, [loadCampos]);

  // ---------- cargar lotes del campo ----------
  // Auto-select cuando hay un solo lote — alineado con los otros 3 forms.
  useEffect(() => {
    if (!campoId) { setLotes([]); return; }
    let cancelado = false;
    (async () => {
      const ls = await repo.listLotes(campoId);
      if (cancelado) return;
      setLotes(ls);
      if (loteId && !ls.some(l => l.id === loteId)) {
        setLoteId('');
      }
      if (!loteId && ls.length === 1 && ls[0]) {
        setLoteId(ls[0].id);
      }
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campoId, repo]);

  // ---------- prefill en edit mode ----------
  useEffect(() => {
    if (!isEdit || !mortandadId) return;
    (async () => {
      const list = await repo.listEventos('mortandad');
      const existing = list.find(e => e.id === mortandadId) as Mortandad | undefined;
      if (!existing) {
        Alert.alert('No encontrada', 'Esta mortandad ya no existe.');
        nav.goBack();
        return;
      }
      setCampoId(existing.campoId);
      // Mortandad pre-rediseño puede no tener loteId — queda vacío y obligamos
      // a elegir uno antes de re-guardar.
      setLoteId(existing.loteId ?? '');
      setFecha(existing.fecha);
      setCategoria(existing.categoria);
      setActividad(existing.actividad);
      setCausaTipo(existing.causaTipo);
      if (existing.gps) setGps(existing.gps);
      setCreatedAtOriginal(existing.createdAt);
      setOriginalRecord(existing);
      setCargandoExistente(false);
    })();
  }, [isEdit, mortandadId, repo, nav]);

  // ---------- GPS silencioso al fondo (solo en alta nueva) ----------
  useEffect(() => {
    if (isEdit) return;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setGps({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracyM: pos.coords.accuracy ?? undefined,
        });
      } catch { /* sin GPS no pasa nada */ }
    })();
  }, [isEdit]);

  // ---------- validación live ----------
  // isDirty: comparamos contra el snapshot original en edit mode.
  const isDirty = useMemo(() => {
    if (!isEdit || !originalRecord) return true;
    return (
      campoId !== originalRecord.campoId ||
      loteId !== (originalRecord.loteId ?? '') ||
      fecha !== originalRecord.fecha ||
      categoria !== originalRecord.categoria ||
      actividad !== originalRecord.actividad ||
      causaTipo !== originalRecord.causaTipo
    );
  }, [isEdit, originalRecord, campoId, loteId, fecha, categoria, actividad, causaTipo]);

  const puedeGuardar = useMemo(() => {
    if (!campoId) return false;
    if (!loteId) return false; // ahora REQUIRED
    if (!categoria) return false;
    if (!isDirty) return false; // edit mode sin cambios
    return true;
  }, [campoId, loteId, categoria, isDirty]);

  // Lista de obligatorios pendientes para el FaltaHint.
  const camposFaltantes = useMemo(() => {
    const f: string[] = [];
    if (!campoId) f.push('campo');
    if (!loteId) f.push('lote');
    if (!categoria) f.push('categoría');
    if (f.length === 0 && isEdit && !isDirty) f.push('cambios');
    return f;
  }, [campoId, loteId, categoria, isEdit, isDirty]);

  const campoActual = useMemo(() => campos.find(c => c.id === campoId), [campos, campoId]);
  const loteActual = useMemo(() => lotes.find(l => l.id === loteId), [lotes, loteId]);

  const nombreUsuario = useMemo(() => {
    if (!user) return '—';
    if (user.nombre) return user.nombre;
    const local = user.email.split('@')[0] ?? user.email;
    const first = local.split(/[.\-_]/)[0] ?? local;
    return first.charAt(0).toUpperCase() + first.slice(1);
  }, [user]);

  // ---------- guardar ----------
  const onGuardar = async () => {
    if (!campoId || !loteId || !user?.email || !categoria) {
      Alert.alert('Faltan datos', 'Completá campo, lote y categoría.');
      return;
    }

    setGuardando(true);
    try {
      const mortandad: Mortandad = {
        tipo: 'mortandad',
        id: mortandadId ?? uuidv4(),
        fecha,
        campoId,
        loteId,
        usuarioEmail: user.email,
        gps,
        categoria,
        actividad,
        causaTipo,
        createdAt: createdAtOriginal ?? new Date().toISOString(),
        syncState: 'pending',
      };
      const saved = await repo.saveEvento(mortandad);
      const sincronizada = saved.syncState === 'synced';
      const base = `${mortandad.categoria}${mortandad.causaTipo ? ' · ' + mortandad.causaTipo : ''}`;
      const detalle = !sincronizada && saved.syncError
        ? `\n\nGuardado offline. Detalle: ${saved.syncError}`
        : (!sincronizada ? '\n\nGuardado offline. Se sincroniza cuando haya señal.' : '');
      const msg = base + detalle;

      if (isEdit) {
        Alert.alert(sincronizada ? 'Listo' : 'Guardado offline', msg, [{ text: 'OK', onPress: () => nav.goBack() }]);
      } else {
        Alert.alert(sincronizada ? 'Listo' : 'Guardado offline', msg, [
          { text: 'Ver listado', onPress: () => { switchTab('mortandad'); nav.goBack(); } },
          { text: 'Cargar otra', onPress: resetForm, style: 'cancel' },
        ]);
      }
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
    // Conservamos campo, lote y fecha — uso típico es cargar varias muertes
    // del mismo campo el mismo día.
    setCategoria(undefined);
    setCausaTipo(undefined);
  };

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

  // ---------- render ----------
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Header card: Usuario / Campo / Lote (required) / Fecha / GPS */}
          <View style={styles.header}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Usuario</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{nombreUsuario}</Text>
            </View>

            <View style={styles.infoDivider} />

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

            {/* Lote required */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Lote *</Text>
              <Text
                style={[
                  styles.infoValue,
                  !loteId && { color: colors.textMuted, fontStyle: 'italic' },
                ]}
                numberOfLines={1}
              >
                {loteActual?.nombre ?? 'sin elegir'}
              </Text>
            </View>
            {lotes.length === 0 ? (
              <NoLotesBanner faltaCampo={!campoId} />
            ) : (
              <View style={styles.pickerRow}>
                {lotes.map(l => (
                  <Pressable
                    key={l.id}
                    onPress={() => setLoteId(prev => (prev === l.id ? '' : l.id))}
                    style={[styles.pickerChip, loteId === l.id && styles.pickerChipSelLote]}
                  >
                    <Text style={[styles.pickerChipTxt, loteId === l.id && styles.pickerChipTxtSel]}>
                      {l.nombre}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

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

            <View style={styles.infoDivider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>GPS</Text>
              <Text style={[styles.infoValue, !gps && styles.infoValueMuted]}>
                {gps ? `📍 ${gps.lat.toFixed(4)}, ${gps.lon.toFixed(4)}` : 'sin señal'}
              </Text>
            </View>
          </View>

          {/* Body — Categoría (required), Actividad y Causa-tipo opcionales.
              "Opcional" en la UI = sin asterisco. La palabra explícita
              fue removida por feedback del cliente. */}
          <Text style={styles.label}>Categoría *</Text>
          <View style={styles.catRow}>
            {CATEGORIAS.map(c => {
              const sel = c === categoria;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCategoria(c)}
                  style={[styles.catChip, sel && styles.catChipSel]}
                >
                  <Text style={[styles.catChipTxt, sel && styles.catChipTxtSel]}>
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Actividad</Text>
          <View style={styles.catRow}>
            {ACTIVIDADES.map(a => {
              const sel = a === actividad;
              return (
                <Pressable
                  key={a}
                  onPress={() => setActividad(prev => (prev === a ? undefined : a))}
                  style={[styles.catChip, sel && styles.catChipSel]}
                >
                  <Text style={[styles.catChipTxt, sel && styles.catChipTxtSel]}>{a}</Text>
                </Pressable>
              );
            })}
          </View>

          <ChipGroup<CausaMuerteTipo>
            label="Causa — tipo"
            value={causaTipo}
            options={CAUSAS_TIPO}
            onChange={setCausaTipo}
          />

          <FaltaHint campos={camposFaltantes} />

          <PrimaryButton
            label={isEdit ? 'GUARDAR CAMBIOS' : 'GUARDAR MORTANDAD'}
            onPress={onGuardar}
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

  // Header card
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
    width: 64,
  },
  infoValue: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold as '600',
    color: colors.textDark,
  },
  infoValueMuted: {
    color: colors.textMuted,
    fontStyle: 'italic',
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
    paddingBottom: spacing.sm,
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

  // Categoría (chips manuales — más compactos que ChipGroup)
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as '700',
    color: colors.textMuted,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  catRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
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
