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
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
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
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';

import { ChipGroup } from '@/components/ChipGroup';
import { FaltaHint } from '@/components/FaltaHint';
import { MapPickerModal } from '@/components/MapPickerModal';
import { NoLotesBanner } from '@/components/NoLotesBanner';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useClientConfig } from '@/config/ClientConfigContext';
import { useEventoForm } from '@/hooks/useEventoForm';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';
import type { RootStackParamList } from '@/navigation/types';
import type { CausaMuerteTipo, Lote, Mortandad } from '@/data/types';
import { fechaBonita } from '@/utils/fechas';

type Rt = RouteProp<RootStackParamList, 'MortandadForm'>;

// ---------- pantalla ----------

export function MortandadFormScreen() {
  const route = useRoute<Rt>();
  const mortandadId = route.params?.mortandadId;

  // Catálogos del cliente activo
  const catMort = useClientConfig().catalogos.mortandad;
  const CATEGORIAS = catMort.categorias;
  const ACTIVIDADES = catMort.actividades;
  const CAUSAS_TIPO = catMort.causaTipos as readonly CausaMuerteTipo[];

  // ─── State específico de Mortandad ───
  const [loteId, setLoteId] = useState<string>('');
  const [categoria, setCategoria] = useState<string | undefined>();
  const [actividad, setActividad] = useState<string | undefined>();
  const [causaTipo, setCausaTipo] = useState<CausaMuerteTipo | undefined>();
  const [gps, setGps] = useState<Mortandad['gps']>(undefined);
  // Estado de la captura de GPS — para que el operario sepa qué está pasando
  // en vez de quedarse mirando "sin señal" sin saber por qué.
  //   idle      → recién montado, antes de pedir nada
  //   buscando  → pidiendo permiso o esperando fix del GPS
  //   denegado  → el sistema no dio permiso (hay que abrir Ajustes)
  //   sin-fix   → permiso OK pero no encontró señal (típico en monte denso)
  //   ok        → con fix válido
  type GpsEstado = 'idle' | 'buscando' | 'denegado' | 'sin-fix' | 'ok' | 'manual';
  const [gpsEstado, setGpsEstado] = useState<GpsEstado>('idle');
  // Modal de edición manual de coordenadas. El operario lo abre cuando
  // necesita corregir el GPS — por ejemplo, si encontró el animal pero
  // cargó después en otro lugar, o si el GPS automático tomó mal el fix.
  const [showGpsManual, setShowGpsManual] = useState(false);
  const [gpsLatInput, setGpsLatInput] = useState('');
  const [gpsLonInput, setGpsLonInput] = useState('');
  // Selector visual de mapa — alternativa al input manual, para que el
  // operario marque dónde fue el evento sin tener que conocer coordenadas.
  const [showMapPicker, setShowMapPicker] = useState(false);

  // UI state específico
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [pickerCampoOpen, setPickerCampoOpen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // ─── State común vía useEventoForm ───
  const ef = useEventoForm<Mortandad>({
    tipo: 'mortandad',
    eventoId: mortandadId,
    titleNew: 'Nueva mortandad',
    titleEdit: 'Editar mortandad',
    tabName: 'mortandad',
    buildEvento: ({ campoId, fecha, usuarioEmail, id, createdAt }) => {
      if (!campoId || !loteId || !categoria) return null;
      return {
        id, campoId, fecha, usuarioEmail, createdAt,
        tipo: 'mortandad',
        loteId,
        gps,
        categoria,
        actividad,
        causaTipo,
        syncState: 'pending',
      };
    },
    formatSummary: (e) => `${e.categoria}${e.causaTipo ? ' · ' + e.causaTipo : ''}`,
    resetEspecifico: () => {
      // Conservamos campo, lote y fecha — uso típico es cargar varias muertes
      // del mismo campo el mismo día.
      setCategoria(undefined);
      setCausaTipo(undefined);
    },
  });
  const { user, repo, campoId, setCampoId, fecha, setFecha, campos, campoActual,
          isEdit, cargandoExistente, originalRecord, guardando, onGuardar, nav } = ef;

  // ─── Hidratación específica en edit mode ───
  useEffect(() => {
    ef.registerPrefill((existing) => {
      // Mortandad pre-rediseño puede no tener loteId — queda vacío y obligamos
      // a elegir uno antes de re-guardar.
      setLoteId(existing.loteId ?? '');
      setCategoria(existing.categoria);
      setActividad(existing.actividad);
      setCausaTipo(existing.causaTipo);
      if (existing.gps) setGps(existing.gps);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Cargar lotes del campo + auto-select cuando hay 1 ───
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

  // ---------- Captura de GPS con feedback explícito ----------
  //
  // Antes esto era silencioso: si fallaba (permiso denegado / sin señal /
  // timeout) el campo se quedaba en "sin señal" y el operario no podía
  // saber por qué ni cómo arreglar. Ahora seteamos un estado explícito y
  // exponemos la función `capturarGps` para que el operario pueda
  // reintentar al tocar el row del GPS.
  //
  // Importante: timeout corto (10s) — si no agarró fix rápido, devolvemos
  // sin-fix para que el operario decida si reintenta o sigue sin GPS.
  // Sin timeout, getCurrentPositionAsync se cuelga hasta encontrar fix y
  // bloquea al usuario.
  const capturarGps = useCallback(async () => {
    if (isEdit) return;
    setGpsEstado('buscando');
    try {
      // Primero pedimos permiso. Si el operario lo denegó previamente,
      // status va a ser 'denied' y no abre el diálogo del sistema otra
      // vez — hay que mandarlo a Ajustes.
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsEstado('denegado');
        if (!canAskAgain) {
          // El usuario eligió "no preguntar más". Le explicamos cómo abrir
          // Ajustes y darle permiso de ubicación.
          Alert.alert(
            'Sin permiso de ubicación',
            'Para guardar dónde fue la muerte, ASFION necesita permiso de ubicación.\n\n' +
            'Andá a Ajustes del celular → ASFION → Permisos → Ubicación y elegí "Mientras se usa la app".',
            [{ text: 'Abrir Ajustes', onPress: () => Linking.openSettings() }, { text: 'Cancelar', style: 'cancel' }],
          );
        }
        return;
      }
      // getCurrentPositionAsync con timeout — si el GPS no agarra señal
      // en 10s (monte denso, dentro de un galpón), devolvemos sin-fix.
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>(resolve => setTimeout(() => resolve(null), 10000)),
      ]);
      if (!pos) {
        setGpsEstado('sin-fix');
        return;
      }
      setGps({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracyM: pos.coords.accuracy ?? undefined,
      });
      setGpsEstado('ok');
    } catch (err: any) {
      // Cualquier error genérico (servicio de localización apagado,
      // problema de hardware) → sin-fix con opción a reintentar.
      setGpsEstado('sin-fix');
    }
  }, [isEdit]);

  // Primera captura al montar — silenciosa para no molestar si el flow
  // del operario ya pasó por el form sin necesitar GPS.
  useEffect(() => {
    capturarGps();
  }, [capturarGps]);

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

  const loteActual = useMemo(() => lotes.find(l => l.id === loteId), [lotes, loteId]);

  const nombreUsuario = useMemo(() => {
    if (!user) return '—';
    if (user.nombre) return user.nombre;
    const local = user.email.split('@')[0] ?? user.email;
    const first = local.split(/[.\-_]/)[0] ?? local;
    return first.charAt(0).toUpperCase() + first.slice(1);
  }, [user]);

  // ─── Guardar — validación específica + delegate al hook ───
  const handleGuardar = async () => {
    if (!campoId || !loteId || !categoria) {
      Alert.alert('Faltan datos', 'Completá campo, lote y categoría.');
      return;
    }
    await onGuardar();
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

            {/* Row del GPS — interactivo. Tocando en el VALOR reintenta
                capturar automático. El botón "Editar" abre un input manual
                para que el operario pueda corregir coordenadas o ingresarlas
                a mano si el GPS no agarra (útil cuando carga después o
                desde otra ubicación). */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>GPS</Text>
              <Pressable
                style={styles.gpsBusy}
                onPress={capturarGps}
                disabled={isEdit || gpsEstado === 'buscando'}
              >
                {gpsEstado === 'buscando' ? (
                  <View style={styles.gpsBusy}>
                    <ActivityIndicator size="small" color="#FF8409" />
                    <Text style={[styles.infoValue, styles.infoValueMuted]}>Buscando…</Text>
                  </View>
                ) : gps && (gpsEstado === 'ok' || gpsEstado === 'manual') ? (
                  <View style={styles.gpsBusy}>
                    <Text style={styles.infoValue}>
                      📍 {gps.lat.toFixed(4)}, {gps.lon.toFixed(4)}
                    </Text>
                    {gpsEstado === 'manual' ? (
                      <Text style={[styles.infoValueMuted, styles.gpsAccuracy]}>manual</Text>
                    ) : gps.accuracyM != null ? (
                      <Text style={[styles.infoValueMuted, styles.gpsAccuracy]}>±{Math.round(gps.accuracyM)}m</Text>
                    ) : null}
                  </View>
                ) : gpsEstado === 'denegado' ? (
                  <Text style={[styles.infoValue, styles.infoValueMuted, styles.gpsActionable]}>
                    Sin permiso · tocá
                  </Text>
                ) : (
                  <Text style={[styles.infoValue, styles.infoValueMuted, styles.gpsActionable]}>
                    Sin señal · tocá para reintentar
                  </Text>
                )}
              </Pressable>
              <Pressable
                onPress={() => setShowMapPicker(true)}
                hitSlop={8}
                style={styles.infoCta}
                disabled={isEdit}
              >
                <Text style={styles.infoCtaTxt}>mapa</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setGpsLatInput(gps?.lat != null ? String(gps.lat) : '');
                  setGpsLonInput(gps?.lon != null ? String(gps.lon) : '');
                  setShowGpsManual(true);
                }}
                hitSlop={8}
                style={styles.infoCta}
                disabled={isEdit}
              >
                <Text style={styles.infoCtaTxt}>editar</Text>
              </Pressable>
            </View>

            {/* Modal del mapa picker — visual, con tap o drag para mover
                el pin, botón "Mi ubicación" para centrar con GPS nativo. */}
            {showMapPicker && (
              <View style={styles.mapPickerOverlay}>
                <MapPickerModal
                  initialLat={gps?.lat}
                  initialLon={gps?.lon}
                  onConfirm={(coords) => {
                    setGps({ lat: coords.lat, lon: coords.lon, accuracyM: undefined });
                    setGpsEstado('manual');
                    setShowMapPicker(false);
                  }}
                  onCancel={() => setShowMapPicker(false)}
                />
              </View>
            )}

            {/* Modal de edición manual de coordenadas */}
            {showGpsManual && (
              <View style={styles.gpsManualOverlay}>
                <View style={styles.gpsManualCard}>
                  <Text style={styles.gpsManualTitle}>Coordenadas GPS</Text>
                  <Text style={styles.gpsManualHelp}>
                    Ingresá lat/lon manualmente. Si dejás en blanco, se borra
                    el GPS de este registro. Usá . o , como separador decimal.
                  </Text>
                  <View style={styles.gpsManualField}>
                    <Text style={styles.gpsManualLabel}>Latitud</Text>
                    <TextInput
                      style={styles.gpsManualInput}
                      value={gpsLatInput}
                      onChangeText={setGpsLatInput}
                      placeholder="ej: -23.5481"
                      keyboardType="numbers-and-punctuation"
                      autoCapitalize="none"
                    />
                  </View>
                  <View style={styles.gpsManualField}>
                    <Text style={styles.gpsManualLabel}>Longitud</Text>
                    <TextInput
                      style={styles.gpsManualInput}
                      value={gpsLonInput}
                      onChangeText={setGpsLonInput}
                      placeholder="ej: -64.0719"
                      keyboardType="numbers-and-punctuation"
                      autoCapitalize="none"
                    />
                  </View>
                  <View style={styles.gpsManualBtns}>
                    <Pressable
                      onPress={() => setShowGpsManual(false)}
                      style={[styles.gpsManualBtn, styles.gpsManualBtnGhost]}
                    >
                      <Text style={styles.gpsManualBtnGhostTxt}>Cancelar</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        // Parsear con tolerancia a coma o punto como decimal.
                        const lat = parseFloat(gpsLatInput.replace(',', '.'));
                        const lon = parseFloat(gpsLonInput.replace(',', '.'));
                        // Ambos vacíos → borrar GPS.
                        if (gpsLatInput.trim() === '' && gpsLonInput.trim() === '') {
                          setGps(undefined);
                          setGpsEstado('idle');
                          setShowGpsManual(false);
                          return;
                        }
                        // Validar rangos válidos (lat -90..90, lon -180..180).
                        if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
                          Alert.alert('Latitud inválida', 'Debe ser un número entre -90 y 90.');
                          return;
                        }
                        if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
                          Alert.alert('Longitud inválida', 'Debe ser un número entre -180 y 180.');
                          return;
                        }
                        setGps({ lat, lon, accuracyM: undefined });
                        setGpsEstado('manual');
                        setShowGpsManual(false);
                      }}
                      style={[styles.gpsManualBtn, styles.gpsManualBtnPrimary]}
                    >
                      <Text style={styles.gpsManualBtnPrimaryTxt}>Guardar</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}
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
  // Estados del GPS row
  gpsBusy: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  gpsAccuracy: {
    fontSize: fontSize.xs,
    fontStyle: 'normal',
  },
  gpsActionable: {
    // Subraya implícito vía color para indicar que es tappable.
    color: colors.orange,
    fontStyle: 'normal',
    fontWeight: fontWeight.semibold as '600',
  },
  // Modal de edición manual de GPS
  gpsManualOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(8, 28, 40, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    zIndex: 100,
  },
  gpsManualCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  gpsManualTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold as '700',
    color: colors.textDark,
    marginBottom: spacing.sm,
  },
  gpsManualHelp: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  gpsManualField: {
    marginBottom: spacing.sm,
  },
  gpsManualLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold as '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  gpsManualInput: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    fontSize: fontSize.md,
    color: colors.textDark,
  },
  gpsManualBtns: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  gpsManualBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  gpsManualBtnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  gpsManualBtnGhostTxt: {
    color: colors.textMuted,
    fontWeight: fontWeight.semibold as '600',
  },
  gpsManualBtnPrimary: {
    backgroundColor: colors.orange,
  },
  gpsManualBtnPrimaryTxt: {
    color: '#fff',
    fontWeight: fontWeight.bold as '700',
  },
  // Overlay del map picker — ocupa toda la pantalla.
  mapPickerOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#fff',
    zIndex: 200,
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
