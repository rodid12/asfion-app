// Form de Pariciones — versión con campos opcionales restaurados.
//
// Decisiones del rediseño:
//
//   - LOTE en el header (junto a Campo) y es OBLIGATORIO.
//   - Campos REQUIRED visibles arriba: Grupo, Evento, Sexo (cuando aplica).
//   - Campos OPCIONALES visibles debajo (sin la palabra "(opcional)" en el
//     label — el asterisco * marca los required, ausencia de asterisco
//     implica opcional). Los opcionales son: caravana color/número,
//     asistencia (cuando Nacimiento), causa-tipo y causa-detalle (cuando
//     Muerte/Aborto), foto, observaciones.
//   - Esta versión vuelve a tener todo lo del AppSheet original sin sumar
//     fricción visual: queda al ojo del operario decidir qué cargar de los
//     opcionales.

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
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import { v4 as uuidv4 } from 'uuid';

import { ChipGroup } from '@/components/ChipGroup';
import { ColorDots } from '@/components/ColorDots';
import { FaltaHint } from '@/components/FaltaHint';
import { FormField } from '@/components/FormField';
import { NoLotesBanner } from '@/components/NoLotesBanner';
import { PhotoStrip } from '@/components/PhotoStrip';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAuth } from '@/auth/context';
import { useRepository } from '@/data';
import { useClientConfig } from '@/config/ClientConfigContext';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';
import type { RootStackParamList } from '@/navigation/types';
import { useTabNav } from '@/navigation/TabContext';
import type {
  Campo,
  CausaMuerteTipo,
  EventoParicion,
  Lote,
  Paricion,
  Sexo,
  SiNo,
  VacasGrupo,
} from '@/data/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ParicionForm'>;
type Rt = RouteProp<RootStackParamList, 'ParicionForm'>;
type Props = NativeStackScreenProps<RootStackParamList, 'ParicionForm'>;

// Catálogos: antes hardcoded acá; ahora vienen de useClientConfig().
// Mantenemos los casts a las unions (VacasGrupo, etc.) porque para Ganaderas
// los valores matchean. Para clientes con valores distintos (ej. un tambo
// con "Vacas en producción"), o (a) extender las unions en data/types.ts,
// o (b) relajar a string en ese campo.

export function ParicionFormScreen(_p: Props) {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { user } = useAuth();
  const repo = useRepository();
  const { switchTab } = useTabNav();
  // Catálogo de Pariciones del cliente activo
  const catParicion = useClientConfig().catalogos.pariciones;
  const VACAS_GRUPOS = catParicion.vacasGrupos as readonly VacasGrupo[];
  const EVENTOS = catParicion.eventos as readonly EventoParicion[];
  const SEXOS = catParicion.sexos as readonly Sexo[];
  const ASISTENCIA = catParicion.asistencia as readonly SiNo[];
  const CAUSAS_TIPO = catParicion.causaTipos as readonly CausaMuerteTipo[];
  const CAUSAS_FRECUENTES = catParicion.causasFrecuentes;

  const paricionId = route.params?.paricionId;
  const isEdit = Boolean(paricionId);

  // Catálogos
  const [campos, setCampos] = useState<Campo[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);

  const [cargandoExistente, setCargandoExistente] = useState<boolean>(isEdit);
  const [createdAtOriginal, setCreatedAtOriginal] = useState<string | undefined>();
  const [originalRecord, setOriginalRecord] = useState<Paricion | null>(null);

  // Estado del form — todos los campos del modelo
  const [campoId, setCampoId] = useState<string | undefined>(user?.campoAsignadoId);
  const [pickerCampoOpen, setPickerCampoOpen] = useState(false);
  const [loteId, setLoteId] = useState<string | undefined>();
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));

  const [vacasGrupo, setVacasGrupo] = useState<VacasGrupo | undefined>();
  const [evento, setEvento] = useState<EventoParicion | undefined>('Nacimiento');
  const [sexo, setSexo] = useState<Sexo | undefined>();
  const [asistencia, setAsistencia] = useState<SiNo | undefined>();
  const [caravanaColor, setCaravanaColor] = useState<Paricion['caravanaColor']>();
  const [caravanaNumero, setCaravanaNumero] = useState('');
  const [causaTipo, setCausaTipo] = useState<CausaMuerteTipo | undefined>();
  const [causaDetalle, setCausaDetalle] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [fotos, setFotos] = useState<string[]>([]);

  const [gps, setGps] = useState<Paricion['gps']>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    repo.listCampos().then(setCampos);
  }, [repo]);

  useEffect(() => {
    nav.setOptions({ title: isEdit ? 'Editar parición' : 'Nueva parición' });
  }, [nav, isEdit]);

  // Prefill en edit mode
  useEffect(() => {
    if (!isEdit || !paricionId) return;
    (async () => {
      try {
        const list = await repo.listEventos('paricion');
        const existing = list.find(e => e.id === paricionId) as Paricion | undefined;
        if (!existing) {
          Alert.alert('No encontrada', 'Esta parición ya no existe.');
          nav.goBack();
          return;
        }
        setCampoId(existing.campoId);
        setLoteId(existing.loteId);
        setFecha(existing.fecha);
        setVacasGrupo(existing.vacasGrupo);
        setEvento(existing.evento);
        setSexo(existing.sexo);
        setAsistencia(existing.asistencia);
        setCaravanaColor(existing.caravanaColor);
        setCaravanaNumero(existing.caravanaNumero ?? '');
        setCausaTipo(existing.causaTipo);
        setCausaDetalle(existing.causaDetalle ?? '');
        setObservaciones(existing.observaciones ?? '');
        setFotos(existing.fotos ?? []);
        if (existing.gps) setGps(existing.gps);
        setCreatedAtOriginal(existing.createdAt);
        setOriginalRecord(existing);
      } catch (err) {
        Alert.alert('Error', err instanceof Error ? err.message : String(err));
      } finally {
        setCargandoExistente(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, paricionId]);

  // Lotes cuando cambia el campo + auto-select cuando hay uno solo
  useEffect(() => {
    if (!campoId) { setLotes([]); setLoteId(undefined); return; }
    let cancelado = false;
    (async () => {
      const ls = await repo.listLotes(campoId);
      if (cancelado) return;
      setLotes(ls);
      if (loteId && !ls.some(l => l.id === loteId)) {
        setLoteId(undefined);
      }
      if (!loteId && ls.length === 1 && ls[0]) {
        setLoteId(ls[0].id);
      }
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campoId, repo]);

  // GPS silencioso
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracyM: pos.coords.accuracy ?? undefined });
      } catch { /* sin GPS no pasa nada */ }
    })();
  }, []);

  const sexoRequerido = evento === 'Nacimiento' || evento === 'Muerte';
  const causaVisible = evento === 'Muerte' || evento === 'Aborto';
  const asistenciaVisible = evento === 'Nacimiento';
  const caravanaVisible = evento !== 'Retacto'; // sin animal cargado en retacto

  // isDirty: cualquier cambio respecto del original.
  const isDirty = useMemo(() => {
    if (!isEdit || !originalRecord) return true;
    return (
      campoId !== originalRecord.campoId ||
      loteId !== originalRecord.loteId ||
      fecha !== originalRecord.fecha ||
      vacasGrupo !== originalRecord.vacasGrupo ||
      evento !== originalRecord.evento ||
      sexo !== originalRecord.sexo ||
      asistencia !== originalRecord.asistencia ||
      caravanaColor !== originalRecord.caravanaColor ||
      caravanaNumero !== (originalRecord.caravanaNumero ?? '') ||
      causaTipo !== originalRecord.causaTipo ||
      causaDetalle !== (originalRecord.causaDetalle ?? '') ||
      observaciones !== (originalRecord.observaciones ?? '') ||
      JSON.stringify(fotos) !== JSON.stringify(originalRecord.fotos ?? [])
    );
  }, [isEdit, originalRecord, campoId, loteId, fecha, vacasGrupo, evento, sexo, asistencia, caravanaColor, caravanaNumero, causaTipo, causaDetalle, observaciones, fotos]);

  const valid = useMemo(() => {
    if (!campoId) return false;
    if (!loteId) return false;
    if (!vacasGrupo) return false;
    if (!evento) return false;
    if (sexoRequerido && !sexo) return false;
    if (!isDirty) return false;
    return true;
  }, [campoId, loteId, vacasGrupo, evento, sexo, sexoRequerido, isDirty]);

  const camposFaltantes = useMemo(() => {
    const f: string[] = [];
    if (!campoId) f.push('campo');
    if (!loteId) f.push('lote');
    if (!vacasGrupo) f.push('grupo');
    if (!evento) f.push('evento');
    if (sexoRequerido && !sexo) f.push('sexo');
    if (f.length === 0 && isEdit && !isDirty) f.push('cambios');
    return f;
  }, [campoId, loteId, vacasGrupo, evento, sexoRequerido, sexo, isEdit, isDirty]);

  const campoNombre = campos.find(c => c.id === campoId)?.nombre ?? 'Sin campo';
  const loteNombre = lotes.find(l => l.id === loteId)?.nombre ?? 'sin elegir';

  const fechaLabel = useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    const d = new Date(fecha + 'T00:00:00');
    const pretty = d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
    if (fecha === hoy) return `hoy (${pretty})`;
    return pretty;
  }, [fecha]);

  const nombreUsuario = useMemo(() => {
    if (!user) return '—';
    if (user.nombre) return user.nombre;
    const local = user.email.split('@')[0] ?? user.email;
    const first = local.split(/[.\-_]/)[0] ?? local;
    return first.charAt(0).toUpperCase() + first.slice(1);
  }, [user]);

  const onSubmit = async () => {
    if (!user) {
      Alert.alert('Sesión expirada', 'Volvé a iniciar sesión.');
      return;
    }
    if (!valid || !campoId || !loteId || !vacasGrupo || !evento) {
      Alert.alert('Faltan datos', 'Completá los campos obligatorios.');
      return;
    }

    setSubmitting(true);

    const paricion: Paricion = {
      id: paricionId ?? uuidv4(),
      tipo: 'paricion',
      fecha,
      campoId,
      loteId,
      usuarioEmail: user.email,
      gps,
      createdAt: createdAtOriginal ?? new Date().toISOString(),
      syncState: 'pending',
      fotos: fotos.length > 0 ? fotos : undefined,
      vacasGrupo,
      evento,
      sexo: sexoRequerido ? sexo : undefined,
      asistencia: asistenciaVisible ? asistencia : undefined,
      caravanaColor: caravanaVisible ? caravanaColor : undefined,
      caravanaNumero: caravanaVisible && caravanaNumero.trim() ? caravanaNumero.trim() : undefined,
      causaTipo: causaVisible ? causaTipo : undefined,
      causaDetalle: causaVisible ? (causaDetalle.trim() || undefined) : undefined,
      observaciones: observaciones.trim() || undefined,
    };

    try {
      const saved = await repo.saveEvento(paricion);
      const sincronizada = saved.syncState === 'synced';
      const okMsg = sincronizada
        ? (isEdit ? 'Cambios guardados y sincronizados.' : 'Parición guardada y sincronizada.')
        : (isEdit ? 'Cambios guardados offline. Se sincronizan cuando haya señal.' : 'Parición guardada offline. Se sincroniza cuando haya señal.');
      // Cuando NO se sincronizó, mostramos el error real (no genérico) — así
      // si el problema no es "no hay red" (es RLS, FK, schema, etc.) podés
      // verlo y reportarlo en vez de pensar que es offline.
      const detalle = !sincronizada && saved.syncError ? `\n\nDetalle: ${saved.syncError}` : '';
      const msg = okMsg + detalle;

      if (isEdit) {
        Alert.alert(sincronizada ? 'Listo' : 'Guardado offline', msg, [{ text: 'OK', onPress: () => nav.goBack() }]);
      } else {
        Alert.alert(sincronizada ? 'Listo' : 'Guardado offline', msg, [
          { text: 'Ver listado', onPress: () => { switchTab('lista'); nav.goBack(); } },
          { text: 'Cargar otra', onPress: () => resetForm(), style: 'cancel' },
        ]);
      }
    } catch (err) {
      // Errores no recuperables (incluye SessionExpiredError): los mostramos
      // crudos y NO navegamos atrás — el usuario tiene que ver el mensaje
      // y decidir (re-loguearse, intentar de nuevo, etc.).
      const msg = err instanceof Error ? err.message : String(err);
      const esSesion = msg.toLowerCase().includes('sesión') || msg.toLowerCase().includes('jwt');
      Alert.alert(
        esSesion ? 'Sesión expirada' : 'Error al guardar',
        esSesion
          ? `${msg}\n\nVolvé a Menú → Salir y entrá de nuevo.`
          : msg,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setVacasGrupo(undefined);
    setEvento('Nacimiento');
    setSexo(undefined);
    setAsistencia(undefined);
    setCaravanaNumero('');
    // Conservamos caravanaColor (probable misma tanda)
    setCausaTipo(undefined);
    setCausaDetalle('');
    setObservaciones('');
    setFotos([]);
  };

  if (cargandoExistente) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.loadingBox}>
          <Text style={styles.loadingTxt}>Cargando parición…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* InfoCard: Usuario / Campo / Lote / Fecha / GPS */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Usuario</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{nombreUsuario}</Text>
            </View>

            <View style={styles.infoDivider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Campo</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{campoNombre}</Text>
              <Pressable onPress={() => setPickerCampoOpen(o => !o)} hitSlop={10} style={styles.infoCta}>
                <Text style={styles.infoCtaTxt}>{pickerCampoOpen ? 'cerrar' : 'cambiar'}</Text>
              </Pressable>
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

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Lote *</Text>
              <Text
                style={[
                  styles.infoValue,
                  !loteId && { color: colors.textMuted, fontStyle: 'italic' },
                ]}
                numberOfLines={1}
              >
                {loteNombre}
              </Text>
            </View>
            {lotes.length === 0 ? (
              <NoLotesBanner faltaCampo={!campoId} />
            ) : (
              <View style={styles.pickerRow}>
                {lotes.map(l => (
                  <Pressable
                    key={l.id}
                    onPress={() => setLoteId(prev => (prev === l.id ? undefined : l.id))}
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
              <Text style={styles.infoValue}>{fechaLabel}</Text>
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
                  // Auto-colapsa el picker tras seleccionar una fecha (en
                  // ambas plataformas). Antes en iOS quedaba abierto inline
                  // ocupando media pantalla; el feedback fue que se colapse.
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

          {/* === REQUIRED === */}
          <ChipGroup<VacasGrupo>
            label="Grupo *"
            value={vacasGrupo}
            options={VACAS_GRUPOS}
            onChange={setVacasGrupo}
          />

          <ChipGroup<EventoParicion>
            label="Evento *"
            value={evento}
            options={EVENTOS}
            onChange={setEvento}
          />

          {sexoRequerido && (
            <ChipGroup<Sexo>
              label="Sexo *"
              value={sexo}
              options={SEXOS}
              onChange={setSexo}
            />
          )}

          {/* === OPCIONALES (sin la palabra "opcional"; ausencia de * implica no obligatorio) === */}

          {asistenciaVisible && (
            <ChipGroup<SiNo>
              label="Asistencia al parto"
              value={asistencia}
              options={ASISTENCIA}
              onChange={setAsistencia}
            />
          )}

          {caravanaVisible && (
            <>
              <ColorDots
                label="Caravana — color"
                value={caravanaColor}
                onChange={setCaravanaColor}
              />
              <FormField
                label="Caravana — número"
                value={caravanaNumero}
                onChangeText={setCaravanaNumero}
                placeholder="Ej. 0202"
                keyboardType="default"
                autoCapitalize="characters"
              />
            </>
          )}

          {causaVisible && (
            <>
              <ChipGroup<CausaMuerteTipo>
                label="Causa — tipo"
                value={causaTipo}
                options={CAUSAS_TIPO}
                onChange={setCausaTipo}
              />
              {causaTipo === 'Muerte Señalado' && (
                <>
                  <Text style={styles.label}>Causa — detalle</Text>
                  <View style={styles.suggestChipRow}>
                    {CAUSAS_FRECUENTES.map(c => (
                      <Pressable
                        key={c}
                        onPress={() => setCausaDetalle(c)}
                        style={[styles.suggestChip, causaDetalle === c && styles.suggestChipSel]}
                      >
                        <Text style={[styles.suggestChipTxt, causaDetalle === c && styles.suggestChipTxtSel]}>
                          {c}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <FormField
                    label=""
                    value={causaDetalle}
                    onChangeText={setCausaDetalle}
                    placeholder="O escribilo: ej. cayó en el canal"
                  />
                </>
              )}
            </>
          )}

          <PhotoStrip fotos={fotos} onChange={setFotos} />

          <FormField
            label="Observaciones"
            value={observaciones}
            onChangeText={setObservaciones}
            placeholder="Notas adicionales"
            multiline
            numberOfLines={3}
            style={{ minHeight: 96, textAlignVertical: 'top', paddingTop: spacing.md }}
          />

          <View style={{ height: spacing.md }} />

          <FaltaHint campos={camposFaltantes} />

          <PrimaryButton
            label={isEdit ? 'GUARDAR CAMBIOS' : 'GUARDAR PARICIÓN'}
            onPress={onSubmit}
            loading={submitting}
            disabled={!valid}
          />
          <View style={{ height: spacing.sm }} />
          <PrimaryButton
            label="Cancelar"
            variant="ghost"
            onPress={() => nav.goBack()}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgLight },
  scroll: { padding: spacing.base, paddingBottom: spacing.xxxl },

  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingTxt: {
    fontSize: fontSize.base,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold as '600',
  },

  infoCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    marginBottom: spacing.lg,
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
    color: colors.greenDark,
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
    backgroundColor: colors.greenDark,
    borderColor: colors.greenDark,
  },
  pickerChipSelLote: {
    backgroundColor: colors.greenLime,
    borderColor: colors.greenLime,
  },
  pickerChipTxt: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold as '600',
    color: colors.textDark,
  },
  pickerChipTxtSel: { color: colors.white },

  // Causa-detalle: chips de sugerencia + textinput abajo
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as '700',
    color: colors.textMuted,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  suggestChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  suggestChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.white,
  },
  suggestChipSel: {
    backgroundColor: colors.greenLime,
    borderColor: colors.greenLime,
  },
  suggestChipTxt: {
    fontSize: fontSize.sm,
    color: colors.textDark,
    fontWeight: fontWeight.semibold as '600',
  },
  suggestChipTxtSel: {
    color: colors.greenDeep,
    fontWeight: fontWeight.bold as '700',
  },
});
