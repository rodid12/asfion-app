// CompraListScreen — listado de compras de hacienda agrupadas por campo.
//
// Estructura paralela a las otras 4 listas (Pariciones, Lluvias, Mortandad,
// Pastoreo): SectionList agrupada, search, filtros de fecha + campo, FAB para
// crear nueva, sync de pending.
//
// Diferencias específicas:
//   - Search matchea numero_operacion, titular, consignado y cantCabYCat.
//   - Card grande con N° operación + cant/cat arriba, kg origen/destino + merma
//     debajo. Es la info que el operario necesita ver de un vistazo en lista.
//   - Tap → CompraDetail (read-only), no al form directo. Lo hicimos así porque
//     las compras tienen datos comerciales sensibles (precio, titular) y no
//     queremos que un swipe accidental entre en edit mode.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { DateRangeFilter, type DatePreset } from '@/components/DateRangeFilter';
import { EmptyState } from '@/components/EmptyState';
import { Fab } from '@/components/Fab';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SyncBadge } from '@/components/SyncBadge';
import { useAuth } from '@/auth/context';
import { useRepository } from '@/data';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';
import type { RootStackParamList } from '@/navigation/types';
import type { Campo, Compra } from '@/data/types';
import { useTabNav } from '@/navigation/TabContext';

type Nav = NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;

type RangoFecha = '30d' | '90d' | 'year' | 'todo';
const RANGO_LABEL: Record<RangoFecha, string> = {
  '30d': '30 días',
  '90d': '90 días',
  year: 'Este año',
  todo: 'Todo',
};

const RANGO_PRESETS: readonly DatePreset[] = (['30d', '90d', 'year', 'todo'] as RangoFecha[]).map(
  k => ({ key: k, label: RANGO_LABEL[k] }),
);

function rangoDesde(r: RangoFecha): string | null {
  const d = new Date();
  if (r === '30d') d.setDate(d.getDate() - 30);
  else if (r === '90d') d.setDate(d.getDate() - 90);
  else if (r === 'year') return `${d.getFullYear()}-01-01`;
  else return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fechaCorta(iso: string): string {
  const [, mm, dd] = iso.split('-').map(Number);
  if (!mm || !dd) return iso;
  return `${dd}/${mm}`;
}

function primerNombre(email: string): string {
  const local = email.split('@')[0] ?? email;
  const first = local.split(/[.\-_]/)[0] ?? local;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

// ---------- pantalla ----------

export function CompraListScreen() {
  const nav = useNavigation<Nav>();
  const repo = useRepository();
  const { user } = useAuth();
  const { currentTab } = useTabNav();

  const esAdmin = user?.rol === 'administrador' || user?.rol === 'moderador';

  // Seed inicial con cache para evitar spinner en cada navegación.
  const cachedSeed = (repo.listEventosCached('compra') ?? []) as Compra[];
  const [data, setData] = useState<Compra[]>(cachedSeed);
  const [camposMap, setCamposMap] = useState<Record<string, Campo>>({});
  const [loading, setLoading] = useState(cachedSeed.length === 0);
  const [flushing, setFlushing] = useState(false);
  const [query, setQuery] = useState('');

  const [rango, setRango] = useState<RangoFecha>('year');
  const [desdeCustom, setDesdeCustom] = useState<string | undefined>();
  const [hastaCustom, setHastaCustom] = useState<string | undefined>();
  const [campoFiltro, setCampoFiltro] = useState<string | null>(null);
  const [campoPickerOpen, setCampoPickerOpen] = useState(false);

  // Load: server + cola pending (igual que otros lists).
  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const [evs, cs, pendings] = await Promise.all([
        repo.listEventos('compra'),
        repo.listCampos(),
        repo.listPending(),
      ]);
      const serverIds = new Set((evs as Compra[]).map(c => c.id));
      const pendingCompras = pendings
        .filter(e => e.tipo === 'compra')
        .filter(e => !serverIds.has(e.id)) as Compra[];
      const ordered = [...(evs as Compra[]), ...pendingCompras].sort((a, b) => {
        if (a.fecha !== b.fecha) return a.fecha > b.fecha ? -1 : 1;
        return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
      });
      setData(ordered);
      setCamposMap(Object.fromEntries(cs.map(c => [c.id, c])));
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => {
    const unsub = nav.addListener('focus', () => load({ silent: true }));
    return unsub;
  }, [nav, load]);
  useEffect(() => {
    if (currentTab === 'menu') load({ silent: true });
  }, [currentTab, load]);

  // Scope auto para operario: solo sus compras.
  const scopedData = useMemo(() => {
    if (!esAdmin && user?.email) {
      return data.filter(c => c.usuarioEmail === user.email);
    }
    return data;
  }, [data, esAdmin, user]);

  const camposVisibles = useMemo(() => {
    const userCampos = user?.campos ?? [];
    if (userCampos.length > 0) {
      return userCampos
        .map(id => camposMap[id])
        .filter((c): c is Campo => Boolean(c));
    }
    const ids = Array.from(new Set(scopedData.map(c => c.campoId)));
    return ids.map(id => camposMap[id]).filter((c): c is Campo => Boolean(c));
  }, [user, camposMap, scopedData]);

  // Filtros
  const filtered = useMemo(() => {
    const customActivo = Boolean(desdeCustom || hastaCustom);
    const desde = customActivo ? desdeCustom : rangoDesde(rango);
    const hasta = customActivo ? hastaCustom : undefined;
    const q = query.trim().toLowerCase();
    return scopedData.filter(c => {
      if (desde && c.fecha < desde) return false;
      if (hasta && c.fecha > hasta) return false;
      if (campoFiltro && c.campoId !== campoFiltro) return false;
      if (q) {
        const hay = `${c.numeroOperacion ?? ''} ${c.titular ?? ''} ${c.consignado ?? ''} ${c.cantCabYCat ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [scopedData, rango, desdeCustom, hastaCustom, campoFiltro, query]);

  const pendientes = useMemo(
    () => data.filter(c => c.syncState === 'pending' || c.syncState === 'failed').length,
    [data],
  );

  const activosCount = useMemo(() => {
    let n = 0;
    if (rango !== 'year') n++;
    if (desdeCustom || hastaCustom) n++;
    if (campoFiltro) n++;
    return n;
  }, [rango, desdeCustom, hastaCustom, campoFiltro]);

  const clearFilters = () => {
    setRango('year');
    setDesdeCustom(undefined);
    setHastaCustom(undefined);
    setCampoFiltro(null);
  };

  // Sections — agrupado por campo (igual que otros lists).
  const sections = useMemo(() => {
    const byCampo = new Map<string, { campoNombre: string; items: Compra[]; totalKg: number }>();
    filtered.forEach(c => {
      const campoNombre = camposMap[c.campoId]?.nombre ?? c.campoId;
      const entry = byCampo.get(c.campoId) ?? { campoNombre, items: [], totalKg: 0 };
      entry.items.push(c);
      entry.totalKg += c.kgNetosDestino != null && Number.isFinite(c.kgNetosDestino) ? c.kgNetosDestino : 0;
      byCampo.set(c.campoId, entry);
    });
    byCampo.forEach(e => e.items.sort((a, b) => b.fecha.localeCompare(a.fecha)));
    const keys = Array.from(byCampo.keys()).sort((a, b) =>
      byCampo.get(a)!.campoNombre.localeCompare(byCampo.get(b)!.campoNombre),
    );
    return keys.map(k => ({
      title: byCampo.get(k)!.campoNombre,
      count: byCampo.get(k)!.items.length,
      totalKg: Math.round(byCampo.get(k)!.totalKg),
      data: byCampo.get(k)!.items,
    }));
  }, [filtered, camposMap]);

  const onFlush = async () => {
    setFlushing(true);
    try {
      const r = await repo.flushPending();
      const baseMsg = `Intentados: ${r.intentados}\nExitosos: ${r.exitosos}\nFallidos: ${r.fallidos}`;
      const detalle = r.fallidos > 0 && r.errores.length > 0
        ? `\n\nMotivo: ${r.errores[0]?.error ?? '?'}`
        : '';
      Alert.alert('Sincronización', baseMsg + detalle);
      await load();
    } finally {
      setFlushing(false);
    }
  };

  const onItemPress = (c: Compra) => {
    nav.navigate('CompraDetail', { compraId: c.id });
  };

  const renderItem = ({ item }: { item: Compra }) => {
    const merma = item.mermaPorcentaje;
    const mermaShow = merma != null ? `${merma.toFixed(2)}% merma` : null;

    return (
      <Pressable
        onPress={() => onItemPress(item)}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        accessibilityRole="button"
      >
        {/* Top: N° operación (peach chip) + cant/cat */}
        <View style={styles.topRow}>
          <View style={styles.numOpChip}>
            <Text style={styles.numOp} numberOfLines={1}>
              {item.numeroOperacion ?? '(sin n°)'}
            </Text>
          </View>
          {item.cantCabYCat ? (
            <Text style={styles.cantCat} numberOfLines={1}>{item.cantCabYCat}</Text>
          ) : null}
        </View>

        {/* Middle: kg origen / kg destino / merma */}
        <View style={styles.kgRow}>
          <View style={styles.kgBox}>
            <Text style={styles.kgLabel}>Origen</Text>
            <Text style={styles.kgValue}>
              {Math.round(item.kgNetosOrigen).toLocaleString('es-AR')} kg
            </Text>
          </View>
          <Text style={styles.kgArrow}>→</Text>
          <View style={styles.kgBox}>
            <Text style={styles.kgLabel}>Destino</Text>
            <Text style={styles.kgValue}>
              {item.kgNetosDestino != null
                ? `${Math.round(item.kgNetosDestino).toLocaleString('es-AR')} kg`
                : '—'}
            </Text>
          </View>
          {mermaShow && (
            <View style={styles.mermaBadge}>
              <Text style={styles.mermaTxt}>{mermaShow}</Text>
            </View>
          )}
        </View>

        {/* Footer: fecha + usuario + sync */}
        <View style={styles.footerRow}>
          <Text style={styles.footerIcon}>📅</Text>
          <Text style={styles.footerTxt}>{fechaCorta(item.fecha)}</Text>
          {esAdmin && (
            <>
              <Text style={styles.footerIcon}>👤</Text>
              <Text style={styles.footerTxt} numberOfLines={1}>
                {primerNombre(item.usuarioEmail)}
              </Text>
            </>
          )}
          <View style={{ flex: 1 }} />
          <SyncBadge state={item.syncState} />
        </View>

        {/* Si hay titular o precio, los mostramos como sub-info */}
        {(item.titular || item.precio != null) && (
          <View style={styles.commercialRow}>
            {item.titular ? (
              <Text style={styles.commercialTxt} numberOfLines={1}>👤 {item.titular}</Text>
            ) : null}
            {item.precio != null ? (
              <Text style={styles.commercialTxt}>${item.precio.toLocaleString('es-AR')}/kg</Text>
            ) : null}
          </View>
        )}
      </Pressable>
    );
  };

  const renderSectionHeader = ({ section }: { section: { title: string; count: number; totalKg: number } }) => (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <Text style={styles.sectionSub}>
          {section.count} {section.count === 1 ? 'compra' : 'compras'}
        </Text>
      </View>
      <View style={styles.sectionTotalBox}>
        <Text style={styles.sectionTotalTxt}>
          {section.totalKg.toLocaleString('es-AR')} kg
        </Text>
      </View>
    </View>
  );

  // Sin prefijo "Campo:" — el ícono 📍 ya indica qué tipo de filtro es.
  const campoFiltroLabel = campoFiltro ? camposMap[campoFiltro]?.nombre ?? campoFiltro : 'Todos';

  // Pill: pendientes > compras hoy > esta semana. Las compras son menos
  // frecuentes que pariciones, así que "esta semana" es más útil.
  const today = new Date();
  const isoToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const aWeekAgo = new Date(today); aWeekAgo.setDate(today.getDate() - 6);
  const isoWeekAgo = `${aWeekAgo.getFullYear()}-${String(aWeekAgo.getMonth() + 1).padStart(2, '0')}-${String(aWeekAgo.getDate()).padStart(2, '0')}`;
  const hoy = scopedData.filter(c => c.fecha === isoToday).length;
  const semana = scopedData.filter(c => c.fecha >= isoWeekAgo).length;
  const novedad = pendientes > 0
    ? { emoji: '⚠️', text: `${pendientes} sin sync` }
    : (hoy > 0 ? { emoji: '🛒', text: `${hoy} hoy` }
       : semana > 0 ? { emoji: '🛒', text: `${semana} esta semana` }
       : null);

  const filtersHeader = (
    <>
      {/* Search */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar n° operación, titular..."
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={12} style={styles.clearBtn}>
            <Text style={styles.clearTxt}>×</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.filterBar}>
        {/* Fila 1: Fecha + Campo (chips equitativos). Limpiar abajo si activo. */}
        <View style={styles.filterRow}>
          <DateRangeFilter
            chipStyle={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 }}
            presets={RANGO_PRESETS}
            preset={rango}
            presetTodo="todo"
            desde={desdeCustom}
            hasta={hastaCustom}
            onChangePreset={k => setRango(k as RangoFecha)}
            onChangeCustom={(d, h) => { setDesdeCustom(d); setHastaCustom(h); }}
          />
          {camposVisibles.length > 1 && (
            <Pressable
              onPress={() => setCampoPickerOpen(o => !o)}
              style={[styles.fChipWide, campoFiltro && styles.fChipSel]}
            >
              <Text style={styles.fChipIcon}>📍</Text>
              <Text style={[styles.fChipTxt, campoFiltro && styles.fChipTxtSel]} numberOfLines={1}>
                {campoFiltroLabel}
              </Text>
              <Text style={[styles.fChev, campoFiltro && styles.fChevSel]}>▾</Text>
            </Pressable>
          )}
        </View>

        {activosCount > 0 && (
          <Pressable onPress={clearFilters} style={styles.fClear}>
            <Text style={styles.fClearTxt}>Limpiar filtros</Text>
          </Pressable>
        )}

        {campoPickerOpen && camposVisibles.length > 1 && (
          <View style={styles.subPicker}>
            <Pressable
              onPress={() => { setCampoFiltro(null); setCampoPickerOpen(false); }}
              style={[styles.subChip, !campoFiltro && styles.subChipSel]}
            >
              <Text style={[styles.subChipTxt, !campoFiltro && styles.subChipTxtSel]}>Todos</Text>
            </Pressable>
            {camposVisibles.map(c => (
              <Pressable
                key={c.id}
                onPress={() => { setCampoFiltro(c.id); setCampoPickerOpen(false); }}
                style={[styles.subChip, campoFiltro === c.id && styles.subChipSel]}
              >
                <Text style={[styles.subChipTxt, campoFiltro === c.id && styles.subChipTxtSel]}>
                  {c.nombre}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {pendientes > 0 && (
          <Pressable
            onPress={onFlush}
            disabled={flushing}
            style={({ pressed }) => [styles.pendPill, pressed && { opacity: 0.85 }]}
          >
            <View style={styles.pendDot} />
            <Text style={styles.pendLabel}>
              {pendientes} pendiente{pendientes === 1 ? '' : 's'} de sincronizar
            </Text>
            <Text style={styles.pendAction}>{flushing ? 'Subiendo...' : 'Sincronizar'}</Text>
          </Pressable>
        )}
      </View>
    </>
  );

  return (
    <View style={styles.safe}>
      <ScreenHeader title="Compras" count={scopedData.length} countLabel="operaciones" novedad={novedad} />

      <SectionList
        style={{ flex: 1 }}
        ListHeaderComponent={filtersHeader}
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={c => c.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.navy} />
        }
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          !loading ? (
            scopedData.length === 0 ? (
              <EmptyState
                emoji="🛒"
                title="Todavía no hay compras"
                description="Tocá el botón naranja + para registrar la primera operación."
              />
            ) : (
              <EmptyState
                emoji="🔍"
                title="Sin resultados"
                description="No hay compras que coincidan con los filtros activos."
                cta={activosCount > 0 ? { label: 'Limpiar filtros', onPress: clearFilters } : undefined}
              />
            )
          ) : null
        }
      />

      <Fab onPress={() => nav.navigate('CompraForm', {})} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgLight },

  // Search — sin marginHorizontal: listContent ya pone spacing.base en ambos lados.
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.md, height: 44,
    backgroundColor: colors.white, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  searchIcon: { fontSize: fontSize.md, marginRight: spacing.sm },
  searchInput: { flex: 1, fontSize: fontSize.md, color: colors.textDark, paddingVertical: 0 },
  clearBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  clearTxt: { fontSize: 22, color: colors.textMuted, lineHeight: 22 },

  // Filter bar — sin paddingHorizontal: alineado con cards via listContent.
  filterBar: {
    paddingTop: spacing.md, paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
  filterRow2: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
  fChipIcon: { fontSize: 13 },
  fChipWide: {
    // Padding/minHeight idénticos al mainChip del DateRangeFilter.
    // flexBasis:0 → reparto parejo del ancho con la pildora Fecha.
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 8,
    minHeight: 36,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.white,
  },
  fChipSel: { backgroundColor: colors.navy, borderColor: colors.navy },
  fChipTxt: {
    // flex:1 + minWidth:0 → permite truncar cuando el reparto flex achica el chip.
    flex: 1,
    minWidth: 0,
    fontSize: fontSize.sm,
    color: colors.textDark,
    fontWeight: fontWeight.semibold as '600',
  },
  fChipTxtSel: { color: colors.white },
  fChev: { fontSize: 14, color: colors.textMuted, marginLeft: 2, fontWeight: '700' },
  fChevSel: { color: colors.white },
  // Limpiar outline full-width (consistente con Pariciones/Lluvias/Mortandad).
  fClear: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: 'transparent',
  },
  fClearTxt: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold as '600',
    letterSpacing: 0.2,
  },

  subPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  subChip: {
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: radius.round, borderWidth: 1, borderColor: colors.borderSoft,
    backgroundColor: colors.bgLight,
  },
  subChipSel: { backgroundColor: colors.orange, borderColor: colors.orange },
  subChipTxt: { fontSize: fontSize.sm, color: colors.textDark, fontWeight: fontWeight.semibold as '600' },
  subChipTxtSel: { color: colors.navyDeep, fontWeight: fontWeight.bold as '700' },

  pendPill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.amber, paddingHorizontal: spacing.md, paddingVertical: 10,
    borderRadius: radius.round,
  },
  pendDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.white },
  pendLabel: { flex: 1, color: colors.white, fontSize: fontSize.sm, fontWeight: fontWeight.bold as '700' },
  pendAction: {
    color: colors.white, fontSize: fontSize.sm, fontWeight: fontWeight.bold as '700',
    textDecorationLine: 'underline',
  },

  listContent: { padding: spacing.base, paddingTop: 0, gap: spacing.sm, paddingBottom: spacing.xxxl + 80 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: spacing.lg, marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs, gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.md, fontWeight: fontWeight.bold as '700',
    color: colors.navy, letterSpacing: 0.3,
  },
  sectionSub: {
    fontSize: fontSize.sm, color: colors.textMuted,
    fontWeight: fontWeight.semibold as '600', marginTop: 2,
  },
  sectionTotalBox: {
    paddingHorizontal: spacing.md, paddingVertical: 4,
    borderRadius: radius.round, backgroundColor: colors.orange,
  },
  sectionTotalTxt: { fontSize: fontSize.sm, color: colors.navyDeep, fontWeight: fontWeight.bold as '700' },

  // Card
  card: {
    backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.borderSoft, gap: spacing.sm,
  },
  cardPressed: { opacity: 0.85 },
  topRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  // Peach chip leading consistente con otros listados + Home.
  numOpChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    backgroundColor: colors.orangeSoft,
    borderRadius: radius.md,
    alignSelf: 'flex-start',
  },
  numOp: { fontSize: fontSize.lg, fontWeight: fontWeight.bold as '700', color: colors.navy, letterSpacing: 0.3 },
  cantCat: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: fontWeight.semibold as '600' },

  kgRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  kgBox: { backgroundColor: colors.bgLight, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  kgLabel: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: fontWeight.bold as '700', textTransform: 'uppercase' },
  kgValue: { fontSize: fontSize.md, color: colors.textDark, fontWeight: fontWeight.bold as '700', marginTop: 2 },
  kgArrow: { fontSize: fontSize.lg, color: colors.textMuted, fontWeight: fontWeight.bold as '700' },
  mermaBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.round, backgroundColor: colors.amber + '22' },
  mermaTxt: { fontSize: fontSize.xs, color: colors.amber, fontWeight: fontWeight.bold as '700' },

  footerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  footerIcon: { fontSize: fontSize.sm, marginLeft: spacing.xs },
  footerTxt: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: fontWeight.semibold as '600' },

  commercialRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.borderSoft,
    gap: spacing.sm,
  },
  commercialTxt: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: fontWeight.semibold as '600' },

  empty: { paddingVertical: spacing.xxxl, alignItems: 'center', gap: spacing.md },
  emptyTxt: { fontSize: fontSize.md, color: colors.textMuted, fontStyle: 'italic' },
  emptyBtn: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: radius.round, backgroundColor: colors.navy,
  },
  emptyBtnTxt: { fontSize: fontSize.sm, color: colors.white, fontWeight: fontWeight.bold as '700' },
});
