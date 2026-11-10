import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { useAuth } from '@/auth/context';
import { useRepository } from '@/data';
import type { Tarea, TareaEstado, TareaHistorial, Usuario } from '@/data/types';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';
import { fechaBonita } from '@/utils/fechas';

type Nav = NativeStackNavigationProp<RootStackParamList, 'TareaForm'>;
type Route = RouteProp<RootStackParamList, 'TareaForm'>;

function isoLocal(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateFromIso(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y ?? new Date().getFullYear(), (m ?? 1) - 1, d ?? 1, 12, 0, 0);
}

function persona(u: Usuario): string {
  return [u.nombre, u.apellido].filter(Boolean).join(' ') || u.email;
}

export function TareaFormScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const repo = useRepository();
  const { user } = useAuth();
  const tareaId = route.params?.tareaId;
  const esAdmin = user?.rol === 'administrador';
  const [tarea, setTarea] = useState<Tarea | null>(null);
  const [operarios, setOperarios] = useState<Usuario[]>([]);
  const [historial, setHistorial] = useState<TareaHistorial[]>([]);
  const [fecha, setFecha] = useState(isoLocal());
  const [asignadoEmail, setAsignadoEmail] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [estado, setEstado] = useState<TareaEstado>('pendiente');
  const [observacionesAdmin, setObservacionesAdmin] = useState('');
  const [observacionesOperario, setObservacionesOperario] = useState('');
  const [showDate, setShowDate] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    nav.setOptions({ title: esAdmin ? (tareaId ? 'Editar tarea' : 'Asignar tarea') : 'Informar tarea' });
    (async () => {
      try {
        const [tareas, personas] = await Promise.all([
          tareaId ? repo.listTareas() : Promise.resolve([]),
          esAdmin ? repo.listOperariosTareas() : Promise.resolve([]),
        ]);
        setOperarios(personas);
        const found = tareaId ? tareas.find(t => t.id === tareaId) : undefined;
        if (tareaId && !found) throw new Error('La tarea ya no está disponible.');
        if (found) {
          setTarea(found);
          setFecha(found.fecha);
          setAsignadoEmail(found.asignadoEmail);
          setDescripcion(found.descripcion);
          setEstado(found.estado);
          setObservacionesAdmin(found.observacionesAdmin ?? '');
          setObservacionesOperario(found.observacionesOperario ?? '');
          if (esAdmin) setHistorial(await repo.listTareaHistorial(found.id));
        } else if (personas.length === 1) {
          setAsignadoEmail(personas[0]!.email);
        }
      } catch (error) {
        Alert.alert('No se pudo abrir la tarea', error instanceof Error ? error.message : 'Error inesperado.', [{ text: 'Volver', onPress: () => nav.goBack() }]);
      }
    })();
  }, [nav, repo, tareaId, esAdmin]);

  const puedeGuardar = useMemo(() => esAdmin
    ? Boolean(fecha && asignadoEmail && descripcion.trim())
    : Boolean(tarea && estado !== 'pendiente' && (estado !== 'no_completada' || observacionesOperario.trim())),
  [esAdmin, fecha, asignadoEmail, descripcion, tarea, estado, observacionesOperario]);

  const save = async () => {
    if (!puedeGuardar) {
      Alert.alert('Faltan datos', esAdmin ? 'Elegí fecha, operario y escribí la tarea.' : 'Si no se completó, explicá el motivo en observaciones.');
      return;
    }
    setSaving(true);
    try {
      if (esAdmin) {
        await repo.saveTareaAdmin({ id: tareaId, fecha, asignadoEmail, descripcion: descripcion.trim(), estado, observacionesAdmin: observacionesAdmin.trim() || undefined });
      } else if (tarea) {
        await repo.informarTarea(tarea.id, estado as Exclude<TareaEstado, 'pendiente'>, observacionesOperario.trim() || undefined);
      }
      Alert.alert('Listo', esAdmin ? 'La tarea quedó guardada.' : 'El resultado quedó informado.', [{ text: 'Aceptar', onPress: () => nav.goBack() }]);
    } catch (error) {
      Alert.alert('No se pudo guardar', error instanceof Error ? error.message : 'Revisá la conexión e intentá nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  const eliminar = () => {
    if (!tareaId) return;
    Alert.alert('Eliminar tarea', 'La tarea dejará de mostrarse, pero el cambio quedará guardado en el historial.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try { await repo.eliminarTarea(tareaId); nav.goBack(); }
        catch (error) { Alert.alert('No se pudo eliminar', error instanceof Error ? error.message : 'Error inesperado.'); }
      } },
    ]);
  };

  if (!esAdmin && !tarea) return <SafeAreaView style={styles.safe} edges={['bottom']} />;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={96}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {esAdmin ? (
            <>
              <Field label="FECHA">
                <Pressable onPress={() => setShowDate(true)} style={styles.selector}><Text style={styles.selectorText}>📅 {fechaBonita(fecha)}</Text></Pressable>
                {showDate && <DateTimePicker value={dateFromIso(fecha)} mode="date" onChange={(_, value) => { setShowDate(Platform.OS === 'ios'); if (value) setFecha(isoLocal(value)); }} />}
              </Field>

              <Field label="OPERARIO ASIGNADO">
                <View style={styles.options}>
                  {operarios.map(u => <Option key={u.email} active={asignadoEmail === u.email} label={persona(u)} onPress={() => setAsignadoEmail(u.email)} />)}
                </View>
              </Field>

              <Field label="DESCRIPCIÓN DE LA TAREA">
                <TextInput value={descripcion} onChangeText={setDescripcion} style={[styles.input, styles.multiline]} multiline placeholder="Detallá claramente el trabajo solicitado" placeholderTextColor={colors.textMuted} />
              </Field>

              <Field label="ESTADO">
                <View style={styles.options}>
                  <Option active={estado === 'pendiente'} label="Pendiente" onPress={() => setEstado('pendiente')} />
                  <Option active={estado === 'completada'} label="Completada" onPress={() => setEstado('completada')} />
                  <Option active={estado === 'no_completada'} label="No completada" onPress={() => setEstado('no_completada')} />
                </View>
              </Field>

              <Field label="OBSERVACIONES DEL ADMINISTRADOR · OPCIONAL">
                <TextInput value={observacionesAdmin} onChangeText={setObservacionesAdmin} style={[styles.input, styles.multilineSmall]} multiline placeholder="Información adicional para el operario" placeholderTextColor={colors.textMuted} />
              </Field>

              {tarea?.observacionesOperario ? <Info title="RESPUESTA DEL OPERARIO" text={tarea.observacionesOperario} /> : null}
            </>
          ) : tarea ? (
            <>
              <View style={styles.taskBox}>
                <Text style={styles.taskDate}>{fechaBonita(tarea.fecha)}</Text>
                <Text style={styles.taskDescription}>{tarea.descripcion}</Text>
                {tarea.observacionesAdmin ? <Text style={styles.adminNote}>Nota: {tarea.observacionesAdmin}</Text> : null}
              </View>
              <Field label="RESULTADO">
                <View style={styles.resultOptions}>
                  <Option active={estado === 'completada'} label="✓ Completada" onPress={() => setEstado('completada')} />
                  <Option active={estado === 'no_completada'} label="✕ No completada" onPress={() => setEstado('no_completada')} />
                </View>
              </Field>
              <Field label={estado === 'no_completada' ? 'OBSERVACIONES · OBLIGATORIAS' : 'OBSERVACIONES · OPCIONALES'}>
                <TextInput value={observacionesOperario} onChangeText={setObservacionesOperario} style={[styles.input, styles.multiline]} multiline placeholder={estado === 'no_completada' ? 'Explicá por qué no se pudo realizar' : 'Contá cómo se realizó o agregá un detalle'} placeholderTextColor={colors.textMuted} />
              </Field>
              {tarea.respondidaAt ? <Text style={styles.previous}>Último informe: {new Date(tarea.respondidaAt).toLocaleString('es-AR')}. Podés corregirlo; el cambio quedará en el historial.</Text> : null}
            </>
          ) : null}

          <Pressable disabled={saving || !puedeGuardar} onPress={save} style={[styles.save, (saving || !puedeGuardar) && styles.saveDisabled]}><Text style={styles.saveText}>{saving ? 'GUARDANDO…' : esAdmin ? 'GUARDAR TAREA' : 'INFORMAR RESULTADO'}</Text></Pressable>
          {esAdmin && tareaId ? <Pressable onPress={eliminar} style={styles.delete}><Text style={styles.deleteText}>Eliminar tarea</Text></Pressable> : null}

          {esAdmin && historial.length > 0 && (
            <View style={styles.history}>
              <Text style={styles.historyTitle}>HISTORIAL DE CAMBIOS</Text>
              {historial.map(h => <View key={h.id} style={styles.historyRow}><View style={styles.dot} /><View style={{ flex: 1 }}><Text style={styles.historyAction}>{h.accion.replaceAll('_', ' ')}</Text><Text style={styles.historyMeta}>{h.actorEmail} · {new Date(h.createdAt).toLocaleString('es-AR')}</Text></View></View>)}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text>{children}</View>;
}
function Option({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.option, active && styles.optionActive]}><Text style={[styles.optionText, active && styles.optionTextActive]}>{label}</Text></Pressable>;
}
function Info({ title, text }: { title: string; text: string }) {
  return <View style={styles.info}><Text style={styles.infoTitle}>{title}</Text><Text style={styles.infoText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgLight },
  content: { padding: spacing.base, paddingBottom: spacing.xxxl },
  field: { marginBottom: spacing.lg },
  label: { color: colors.navyDeep, fontSize: fontSize.xs, fontWeight: fontWeight.bold as '700', letterSpacing: 1.2, marginBottom: spacing.sm },
  selector: { minHeight: 52, justifyContent: 'center', paddingHorizontal: spacing.base, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.lg },
  selectorText: { color: colors.navyDeep, fontSize: fontSize.base, fontWeight: fontWeight.semibold as '600' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  resultOptions: { flexDirection: 'row', gap: spacing.sm },
  option: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.white },
  optionActive: { backgroundColor: colors.navyDeep, borderColor: colors.navyDeep },
  optionText: { color: colors.navyDeep, fontSize: fontSize.sm, fontWeight: fontWeight.semibold as '600' },
  optionTextActive: { color: colors.white },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.lg, padding: spacing.base, color: colors.textDark, fontSize: fontSize.base },
  multiline: { minHeight: 125, textAlignVertical: 'top' },
  multilineSmall: { minHeight: 90, textAlignVertical: 'top' },
  taskBox: { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.borderSoft, marginBottom: spacing.xl },
  taskDate: { color: colors.orange, fontWeight: fontWeight.bold as '700', fontSize: fontSize.sm },
  taskDescription: { color: colors.navyDeep, fontSize: fontSize.lg, fontWeight: fontWeight.semibold as '600', lineHeight: 29, marginTop: spacing.md },
  adminNote: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  previous: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20, marginTop: -spacing.sm, marginBottom: spacing.lg },
  info: { backgroundColor: '#FFF4E8', borderRadius: radius.lg, padding: spacing.base, marginBottom: spacing.lg },
  infoTitle: { color: colors.orange, fontSize: fontSize.xs, fontWeight: fontWeight.bold as '700', letterSpacing: 1 },
  infoText: { color: colors.textDark, marginTop: spacing.sm, lineHeight: 21 },
  save: { minHeight: 58, borderRadius: radius.lg, backgroundColor: colors.navyDeep, alignItems: 'center', justifyContent: 'center' },
  saveDisabled: { opacity: 0.45 },
  saveText: { color: colors.white, fontSize: fontSize.base, fontWeight: fontWeight.bold as '700', letterSpacing: 1 },
  delete: { minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  deleteText: { color: colors.danger, fontWeight: fontWeight.semibold as '600' },
  history: { marginTop: spacing.xl, backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.base, borderWidth: 1, borderColor: colors.borderSoft },
  historyTitle: { color: colors.navyDeep, fontSize: fontSize.xs, fontWeight: fontWeight.bold as '700', letterSpacing: 1.1, marginBottom: spacing.md },
  historyRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.orange, marginTop: 4 },
  historyAction: { color: colors.navyDeep, fontSize: fontSize.sm, fontWeight: fontWeight.semibold as '600', textTransform: 'capitalize' },
  historyMeta: { color: colors.textMuted, fontSize: 10, marginTop: 3 },
});

