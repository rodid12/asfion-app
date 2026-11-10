import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { EmptyState } from '@/components/EmptyState';
import { Fab } from '@/components/Fab';
import { useAuth } from '@/auth/context';
import { useRepository } from '@/data';
import type { Tarea, TareaEstado, Usuario } from '@/data/types';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';
import { fechaBonita } from '@/utils/fechas';

type Nav = NativeStackNavigationProp<RootStackParamList, 'TareaList'>;
type Periodo = 'hoy' | 'fecha' | '7d' | '30d' | 'todo';
type EstadoFiltro = TareaEstado | 'todos';

const ESTADOS: Array<{ value: EstadoFiltro; label: string }> = [
  { value: 'todos', label: 'Todas' },
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'completada', label: 'Completadas' },
  { value: 'no_completada', label: 'No completadas' },
];

function isoLocal(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function desdePeriodo(periodo: Periodo): string | undefined {
  if (periodo === 'todo' || periodo === 'fecha') return undefined;
  const d = new Date();
  if (periodo === '7d') d.setDate(d.getDate() - 6);
  if (periodo === '30d') d.setDate(d.getDate() - 29);
  return isoLocal(d);
}

function dateFromIso(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y ?? new Date().getFullYear(), (m ?? 1) - 1, d ?? 1, 12, 0, 0);
}

function nombreUsuario(u?: Usuario): string {
  if (!u) return '';
  return [u.nombre, u.apellido].filter(Boolean).join(' ') || u.email;
}

function estadoLabel(estado: TareaEstado): string {
  if (estado === 'completada') return 'Completada';
  if (estado === 'no_completada') return 'No completada';
  return 'Pendiente';
}

export function TareaListScreen() {
  const nav = useNavigation<Nav>();
  const repo = useRepository();
  const { user } = useAuth();
  const esAdmin = user?.rol === 'administrador';
  const [data, setData] = useState<Tarea[]>([]);
  const [operarios, setOperarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<Periodo>('hoy');
  const [fechaFiltro, setFechaFiltro] = useState(isoLocal());
  const [showFechaFiltro, setShowFechaFiltro] = useState(false);
  const [estado, setEstado] = useState<EstadoFiltro>('todos');
  const [operario, setOperario] = useState('todos');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [tareas, personas] = await Promise.all([
        repo.listTareas(),
        esAdmin ? repo.listOperariosTareas() : Promise.resolve([]),
      ]);
      setData(tareas);
      setOperarios(personas);
    } catch (error) {
      if (!silent) Alert.alert('No se pudieron cargar las tareas', error instanceof Error ? error.message : 'Revisá la conexión.');
    } finally {
      setLoading(false);
    }
  }, [repo, esAdmin]);

  useEffect(() => {
    nav.setOptions({ title: esAdmin ? 'Seguimiento de tareas' : 'Mis tareas' });
    void load();
    const focus = nav.addListener('focus', () => { void load(true); });
    const realtime = repo.subscribeTareas(() => { void load(true); });
    return () => { focus(); realtime(); };
  }, [nav, esAdmin, load, repo]);

  const filtradas = useMemo(() => {
    const desde = periodo === 'fecha' ? fechaFiltro : desdePeriodo(periodo);
    const hasta = periodo === 'todo' ? undefined : periodo === 'fecha' ? fechaFiltro : isoLocal();
    return data.filter(t => (
      (!desde || t.fecha >= desde)
      && (!hasta || t.fecha <= hasta)
      && (estado === 'todos' || t.estado === estado)
      && (operario === 'todos' || t.asignadoEmail === operario)
    ));
  }, [data, periodo, fechaFiltro, estado, operario]);

  const metricas = useMemo(() => {
    const total = filtradas.length;
    const completadas = filtradas.filter(t => t.estado === 'completada').length;
    const noCompletadas = filtradas.filter(t => t.estado === 'no_completada').length;
    const pendientes = filtradas.filter(t => t.estado === 'pendiente').length;
    return { total, completadas, noCompletadas, pendientes, porcentaje: total ? Math.round(completadas / total * 100) : 0 };
  }, [filtradas]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {(['hoy', 'fecha', '7d', '30d', 'todo'] as Periodo[]).map(value => (
            <FilterChip key={value} active={periodo === value} label={{ hoy: 'Hoy', fecha: periodo === 'fecha' ? fechaBonita(fechaFiltro) : 'Otra fecha', '7d': '7 días', '30d': '30 días', todo: 'Todo' }[value]} onPress={() => { if (value === 'fecha') setShowFechaFiltro(true); else setPeriodo(value); }} />
          ))}
        </ScrollView>
        {showFechaFiltro && <DateTimePicker value={dateFromIso(fechaFiltro)} mode="date" onChange={(_, value) => { setShowFechaFiltro(Platform.OS === 'ios'); if (value) { setFechaFiltro(isoLocal(value)); setPeriodo('fecha'); } }} />}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {ESTADOS.map(item => <FilterChip key={item.value} active={estado === item.value} label={item.label} onPress={() => setEstado(item.value)} />)}
        </ScrollView>
        {esAdmin && operarios.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <FilterChip active={operario === 'todos'} label="Todos los operarios" onPress={() => setOperario('todos')} />
            {operarios.map(u => <FilterChip key={u.email} active={operario === u.email} label={nombreUsuario(u)} onPress={() => setOperario(u.email)} />)}
          </ScrollView>
        )}
      </View>

      <View style={styles.metrics}>
        <Metric value={metricas.total} label="TOTAL" />
        <Metric value={metricas.completadas} label="HECHAS" accent={colors.success} />
        <Metric value={metricas.noCompletadas} label="NO HECHAS" accent={colors.danger} />
        <Metric value={metricas.pendientes} label="PENDIENTES" accent={colors.amber} />
        <Metric value={`${metricas.porcentaje}%`} label="CUMPLIMIENTO" accent={colors.orange} />
      </View>

      <FlatList
        data={filtradas}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.list, filtradas.length === 0 && styles.listEmpty]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load()} tintColor={colors.navy} />}
        ListEmptyComponent={<EmptyState emoji="✅" title="Sin tareas" description={periodo === 'hoy' ? 'No hay tareas para hoy con estos filtros.' : 'No hay resultados para los filtros seleccionados.'} />}
        renderItem={({ item }) => (
          <Pressable onPress={() => nav.navigate('TareaForm', { tareaId: item.id })} style={({ pressed }) => [styles.card, pressed && { opacity: 0.82 }]}>
            <View style={styles.cardTop}>
              <Text style={styles.date}>{fechaBonita(item.fecha)}</Text>
              <EstadoBadge estado={item.estado} />
            </View>
            {esAdmin && <Text style={styles.person}>👤 {item.asignadoNombre || item.asignadoEmail}</Text>}
            <Text style={styles.description}>{item.descripcion}</Text>
            {item.observacionesOperario ? <Text style={styles.observation}>“{item.observacionesOperario}”</Text> : null}
            <View style={styles.cardBottom}>
              <Text style={styles.updated}>{item.respondidaAt ? `Informada ${new Date(item.respondidaAt).toLocaleString('es-AR')}` : 'Sin respuesta todavía'}</Text>
              <Text style={styles.chevron}>›</Text>
            </View>
          </Pressable>
        )}
      />
      {esAdmin && <Fab onPress={() => nav.navigate('TareaForm', {})} accessibilityLabel="Asignar nueva tarea" />}
    </SafeAreaView>
  );
}

function FilterChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

function Metric({ value, label, accent = colors.navyDeep }: { value: number | string; label: string; accent?: string }) {
  return <View style={styles.metric}><Text style={[styles.metricValue, { color: accent }]}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function EstadoBadge({ estado }: { estado: TareaEstado }) {
  return <View style={[styles.badge, estado === 'completada' && styles.badgeDone, estado === 'no_completada' && styles.badgeFailed]}><Text style={[styles.badgeText, estado === 'completada' && { color: colors.success }, estado === 'no_completada' && { color: colors.danger }]}>{estadoLabel(estado)}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgLight },
  filters: { backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.borderSoft, paddingVertical: spacing.sm, gap: spacing.sm },
  chips: { paddingHorizontal: spacing.base, gap: spacing.sm },
  chip: { minHeight: 38, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 999, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.navyDeep, borderColor: colors.navyDeep },
  chipText: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.semibold as '600' },
  chipTextActive: { color: colors.white },
  metrics: { flexDirection: 'row', padding: spacing.sm, gap: 6, backgroundColor: colors.bgLight },
  metric: { flex: 1, minWidth: 0, backgroundColor: colors.white, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: 4, alignItems: 'center', borderWidth: 1, borderColor: colors.borderSoft },
  metricValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold as '700' },
  metricLabel: { marginTop: 2, color: colors.textMuted, fontSize: 8, fontWeight: fontWeight.bold as '700', textAlign: 'center' },
  list: { padding: spacing.base, paddingBottom: 110 },
  listEmpty: { flexGrow: 1 },
  card: { backgroundColor: colors.white, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.base, marginBottom: spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  date: { color: colors.navyDeep, fontWeight: fontWeight.bold as '700', fontSize: fontSize.sm },
  badge: { backgroundColor: '#FFF4DF', borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  badgeDone: { backgroundColor: '#E8F6EC' },
  badgeFailed: { backgroundColor: '#FBEAEA' },
  badgeText: { color: colors.amber, fontSize: 10, fontWeight: fontWeight.bold as '700', textTransform: 'uppercase' },
  person: { marginTop: spacing.sm, color: colors.orange, fontSize: fontSize.sm, fontWeight: fontWeight.semibold as '600' },
  description: { marginTop: spacing.sm, color: colors.textDark, fontSize: fontSize.base, lineHeight: 22 },
  observation: { marginTop: spacing.sm, color: colors.textMuted, fontStyle: 'italic', fontSize: fontSize.sm },
  cardBottom: { marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderSoft, flexDirection: 'row', alignItems: 'center' },
  updated: { flex: 1, color: colors.textMuted, fontSize: 10 },
  chevron: { color: colors.orange, fontSize: 25 },
});

