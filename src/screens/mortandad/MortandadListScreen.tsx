// MortandadListScreen: listado de mortandad cargada.
//
// Decisiones de diseño:
//  - Misma estructura que LluviaList (agrupación por mes, search, filtros, FAB).
//  - El badge del section header muestra el TOTAL DE ANIMALES MUERTOS del mes
//    (en vez del total de mm como en lluvias) — métrica clave para el productor.
//  - Card: bloque izquierdo con tinte terracota/danger (no azul como lluvia)
//    porque es un evento negativo y queremos que visualmente "duela" un poco.
//  - Search: matchea categoría, causaDetalle, observaciones, número de caravana.
//  - Filtros: rango fecha (default 'year' como lluvias) + campo.
//  - Tap en card → MortandadForm en edit mode (no hay Detail aún).

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

import { DateRangeFilter } from '@/components/DateRangeFilter';
import { Fab } from '@/components/Fab';
import { SyncBadge } from '@/components/SyncBadge';
import { useAuth } from '@/auth/context';
import { useRepository } from '@/data';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';
import type { RootStackParamList } from '@/navigation/types';
import type { Campo, Mortandad } from '@/data/types';
import { useTabNav } from '@/navigation/TabContext';

type Nav = NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;

// ---------- helpers ----------

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function mesLabel(isoDate: string): { key: string; label: string } {
  const [yy, mm] = isoDate.split('-').map(Number);
  if (!yy || !mm) return { key: isoDate.slice(0, 7), label: isoDate.slice(0, 7) };
  const key = `${yy}-${String(mm).padStart(2, '0')}`;
  return { key, label: `${MESES[mm - 1]} ${yy}` };
}

function fechaCorta(iso: string): string {
  const [, mm, dd] = iso.split('-').map(Number);
  if (!mm || !dd) return iso;
  return `${dd}/${mm}`;
}

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isoStartOfYear(): string {
  return `${new Date().getFullYear()}-01-01`;
}

function primerNombre(email: string): string {
  const local = email.split('@')[0] ?? email;
  const first = local.split(/[.\-_]/)[0] ?? local;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function capFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Rangos pensados para mortandad (escala mensual/anual, igual que lluvias).
type RangoFecha = '30d' | '90d' | 'year' | 'todo';
const RANGO_LABEL: Record<RangoFecha, string> = {
  '30d': '30 días',
  '90d': '3 meses',
  year: 'Este año',
  todo: 'Todo',
};

function rangoDesde(r: RangoFecha): string | null {
  if (r === '30d') return isoDaysAgo(29);
  if (r === '90d') return isoDaysAgo(89);
  if (r === 'year') return isoStartOfYear();
  return null;
}

// ---------- pantalla ----------

export function MortandadListScreen() {
  const nav = useNavigation<Nav>();
  const repo = useRepository();
  const { user } = useAuth();
  const { currentTab } = useTabNav();

  const esAdmin = user?.rol === 'administrador' || user?.rol === 'moderador';

  const cachedSeed = (repo.listEventosCached('mortandad') ?? []) as Mortandad[];
  const [data, setData] = useState<Mortandad[]>(cachedSeed);
  const [camposMap, setCamposMap] = useState<Record<string, Campo>>({});
  const [loading, setLoading] = useState(cachedSeed.length === 0);
  const [flushing, setFlushing] = useState(false);
  const [query, setQuery] = useState('');

  const [rango, setRango] = useState<RangoFecha>('year');
  const [desdeCustom, setDesdeCustom] = useState<string | undefined>();
  const [hastaCustom, setHastaCustom] = useState<string | undefined>();
  const [campoFiltro, setCampoFiltro] = useState<string | null>(null);
  const [campoPickerOpen, setCampoPickerOpen] = useState(false);

  // Silent flag para refresh en background sin spinner.
  // Merge: server + cola pending local (deduped por id, gana server).
  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const [evs, cs, pendings] = await Promise.all([
        repo.listEventos('mortandad'),
        repo.listCampos(),
        repo.listPending(),
      ]);
      const serverIds = new Set((evs as Mortandad[]).map(m => m.id));
      const pendingMortandad = pendings
        .filter(e => e.tipo === 'mortandad')
        .filter(e => !serverIds.has(e.id)) as Mortandad[];
      const ordered = [...(evs as Mortandad[]), ...pendingMortandad].sort((a, b) => {
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
    if (currentTab === 'mortandad') load({ silent: true });
  }, [currentTab, load]);

  // Campos visibles al usuario
  const camposVisibles = useMemo(() => {
    const userCampos = user?.campos ?? [];
    if (userCampos.length > 0) {
      return userCampos
        .map(id => camposMap[id])
        .filter((c): c is Campo => Boolean(c));
    }
    const ids = Array.from(new Set(data.map(p => p.campoId)));
    return ids.map(id => camposMap[id]).filter((c): c is Campo => Boolean(c));
  }, [user, camposMap, data]);

  // Para operarios, auto-scope por email. Para admins, ven todo.
  const scopedData = useMemo(() => {
    if (!esAdmin && user?.email) {
      return data.filter(p => p.usuarioEmail === user.email);
    }
    return data;
  }, [data, esAdmin, user]);

  const filtered = useMemo(() => {
    const customActivo = Boolean(desdeCustom || hastaCustom);
    const desde = customActivo ? desdeCustom : rangoDesde(rango);
    const hasta = customActivo ? hastaCustom : undefined;
    const q = query.trim().toLowerCase();
    return scopedData.filter(p => {
      if (desde && p.fecha < desde) return false;
      if (hasta && p.fecha > hasta) return false;
      if (campoFiltro && p.campoId !== campoFiltro) return false;
      if (q) {
        const haystack = [
          p.categoria,
          p.causaDetalle ?? '',
          p.observaciones ?? '',
          p.caravanaNumero ?? '',
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [scopedData, rango, desdeCustom, hastaCustom, campoFiltro, query]);

  const pendientes = useMemo(
    () => data.filter(p => p.syncState === 'pending' || p.syncState === 'failed').length,
    [data],
  );

  const activosCount = useMemo(() => {
    let n = 0;
    if (rango !== 'todo') n++;
    if (desdeCustom || hastaCustom) n++;
    if (campoFiltro) n++;
    return n;
  }, [rango, desdeCustom, hastaCustom, campoFiltro]);

  const clearFilters = () => {
    setRango('todo');
    setDesdeCustom(undefined);
    setHastaCustom(undefined);
    setCampoFiltro(null);
    setCampoPickerOpen(false);
  };

  // Agrupar por CAMPO (feedback Ro: "primero por campo, luego por fecha").
  // Items dentro de cada campo: fecha desc.
  const sections = useMemo(() => {
    const byCampo = new Map<string, { campoNombre: string; items: Mortandad[] }>();
    filtered.forEach(p => {
      const campoNombre = camposMap[p.campoId]?.nombre ?? p.campoId;
      const entry = byCampo.get(p.campoId) ?? { campoNombre, items: [] };
      entry.items.push(p);
      byCampo.set(p.campoId, entry);
    });
    byCampo.forEach(e => e.items.sort((a, b) => b.fecha.localeCompare(a.fecha)));
    const keys = Array.from(byCampo.keys()).sort((a, b) =>
      byCampo.get(a)!.campoNombre.localeCompare(byCampo.get(b)!.campoNombre),
    );
    return keys.map(k => ({
      title: byCampo.get(k)!.campoNombre,
      count: byCampo.get(k)!.items.length,
      data: byCampo.get(k)!.items,
    }));
  }, [filtered, camposMap]);

  const onFlush = async () => {
    setFlushing(true);
    try {
      const r = await repo.flushPending();
      Alert.alert(
        'Sincronización',
        `Intentados: ${r.intentados}\nExitosos: ${r.exitosos}\nFallidos: ${r.fallidos}`,
      );
      await load();
    } finally {
      setFlushing(false);
    }
  };

  // Tap en card → abre form en edit mode. Cuando hagamos Detail, cambiar.
  const onItemPress = (p: Mortandad) => {
    nav.navigate('MortandadForm', { mortandadId: p.id });
  };

  const renderItem = ({ item }: { item: Mortandad }) => {
    const campoNom = camposMap[item.campoId]?.nombre ?? item.campoId;
    const caravanaTxt = item.caravanaColor || item.caravanaNumero
      ? `${item.caravanaColor ?? ''} ${item.caravanaNumero ?? ''}`.trim()
      : null;
    return (
      <Pressable
        onPress={() => onItemPress(item)}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        accessibilityRole="button"
      >
        {/* Columna izq: emoji + categoría */}
        <View style={styles.catBlock}>
          <Text style={styles.catEmoji}>⚠️</Text>
          <Text style={styles.catTxt} numberOfLines={1}>
            {capFirst(item.categoria)}
          </Text>
        </View>

        {/* Columna centro: causa + meta */}
        <View style={styles.cardRight}>
          {item.causaTipo ? (
            <Text style={styles.causa} numberOfLines={1}>{item.causaTipo}</Text>
          ) : (
            <Text style={[styles.causa, styles.causaMuted]} numberOfLines={1}>Sin causa</Text>
          )}
          <View style={styles.metaRow}>
            <Text style={styles.metaIcon}>📍</Text>
            <Text style={styles.metaTxt} numberOfLines={1}>{campoNom}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaTxt}>{fechaCorta(item.fecha)}</Text>
          </View>
          {caravanaTxt && (
            <View style={styles.metaRow}>
              <Text style={styles.metaIcon}>🏷️</Text>
              <Text style={styles.metaTxt} numberOfLines={1}>{caravanaTxt}</Text>
            </View>
          )}
          {esAdmin && (
            <View style={styles.metaRow}>
              <Text style={styles.metaIcon}>👤</Text>
              <Text style={styles.metaTxt} numberOfLines={1}>
                {primerNombre(item.usuarioEmail)}
              </Text>
            </View>
          )}
          {item.causaDetalle && (
            <Text style={styles.obs} numberOfLines={1}>"{item.causaDetalle}"</Text>
          )}
          {item.observaciones && (
            <Text style={styles.obs} numberOfLines={2}>"{item.observaciones}"</Text>
          )}
        </View>

        <View style={styles.cardEnd}>
          <SyncBadge state={item.syncState} />
          <Text style={styles.chev}>›</Text>
        </View>
      </Pressable>
    );
  };

  const renderSectionHeader = ({ section }: {
    section: { title: string; count: number };
  }) => (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
        <Text style={styles.sectionCount}>
          {section.count} {section.count === 1 ? 'registro' : 'registros'}
        </Text>
      </View>
      <View style={styles.sectionTotalBox}>
        <Text style={styles.sectionTotalNum}>{section.count}</Text>
        <Text style={styles.sectionTotalUnit}>
          {section.count === 1 ? 'animal' : 'animales'}
        </Text>
      </View>
    </View>
  );

  const campoFiltroLabel = campoFiltro
    ? camposMap[campoFiltro]?.nombre ?? campoFiltro
    : 'Campo: todos';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Buscador */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar categoría, causa, caravana..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={12} style={styles.clearBtn}>
            <Text style={styles.clearTxt}>×</Text>
          </Pressable>
        )}
      </View>

      {/* Filtros — UN solo chip de fecha que abre modal con presets + custom. */}
      <View style={styles.filterBar}>
        <View style={styles.filterRow}>
          <DateRangeFilter
            presets={(['30d', '90d', 'year', 'todo'] as RangoFecha[]).map(r => ({ key: r, label: RANGO_LABEL[r] }))}
            preset={rango}
            presetTodo="todo"
            desde={desdeCustom}
            hasta={hastaCustom}
            onChangePreset={k => setRango(k as RangoFecha)}
            onChangeCustom={(d, h) => { setDesdeCustom(d); setHastaCustom(h); }}
          />
        </View>

        {(camposVisibles.length > 1 || activosCount > 0) && (
          <View style={styles.filterRow2}>
            {camposVisibles.length > 1 && (
              <Pressable
                onPress={() => setCampoPickerOpen(o => !o)}
                style={[styles.fChipWide, campoFiltro && styles.fChipSel]}
              >
                <Text style={[styles.fChipTxt, campoFiltro && styles.fChipTxtSel]} numberOfLines={1}>
                  {campoFiltroLabel}
                </Text>
                <Text style={[styles.fChev, campoFiltro && styles.fChevSel]}>▾</Text>
              </Pressable>
            )}
            {activosCount > 0 && (
              <Pressable onPress={clearFilters} style={styles.fClear}>
                <Text style={styles.fClearTxt}>Limpiar</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

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

      {/* Pending pill */}
      {pendientes > 0 && (
        <Pressable
          onPress={onFlush}
          disabled={flushing}
          style={({ pressed }) => [styles.pendPill, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
        >
          <View style={styles.pendDot} />
          <Text style={styles.pendLabel}>
            {pendientes} pendiente{pendientes === 1 ? '' : 's'} de sincronizar
          </Text>
          <Text style={styles.pendAction}>{flushing ? 'Subiendo...' : 'Sincronizar'}</Text>
        </Pressable>
      )}

      <SectionList
        sections={sections}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        // Perf con listas grandes.
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.greenDark} />
        }
        ListEmptyComponent={
          query.length > 0 || activosCount > 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTxt}>Sin resultados con los filtros activos.</Text>
              <Pressable onPress={clearFilters} style={styles.emptyBtn}>
                <Text style={styles.emptyBtnTxt}>Limpiar filtros</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>⚠️</Text>
              <Text style={styles.emptyTxt}>Todavía no hay mortandad cargada.</Text>
              <Text style={styles.emptyHint}>
                Tocá <Text style={styles.emptyPlus}>+</Text> para registrar la primera.
              </Text>
            </View>
          )
        }
      />

      <Fab
        onPress={() => nav.navigate('MortandadForm', {})}
        accessibilityLabel="Nueva mortandad"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgLight },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.base,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    height: 44,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  searchIcon: { fontSize: fontSize.md, marginRight: spacing.sm },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textDark,
    paddingVertical: 0,
  },
  clearBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.borderSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearTxt: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: fontWeight.bold as '700',
    lineHeight: 16,
  },

  // Filter bar
  filterBar: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  filterRow: { flexDirection: 'row', gap: spacing.xs },
  filterRow2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    alignItems: 'center',
  },
  fChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.white,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fChipEq: { flex: 1, paddingHorizontal: spacing.xs },
  fChipWide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    paddingVertical: 10,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.white,
    maxWidth: 200,
    minHeight: 36,
  },
  fChipSel: {
    backgroundColor: colors.greenDark,
    borderColor: colors.greenDark,
  },
  fChipTxt: {
    fontSize: fontSize.sm,
    color: colors.textDark,
    fontWeight: fontWeight.semibold as '600',
  },
  fChipTxtSel: { color: colors.white },
  fChev: { fontSize: 10, color: colors.textMuted, marginLeft: 2 },
  fChevSel: { color: colors.white },
  fClear: { paddingHorizontal: spacing.sm, paddingVertical: 6 },
  // "Limpiar" como ghost link suave (ver ParicionListScreen).
  fClearTxt: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold as '600',
  },

  subPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
  },
  subChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.bgLight,
  },
  subChipSel: {
    backgroundColor: colors.greenLime,
    borderColor: colors.greenLime,
  },
  subChipTxt: { fontSize: fontSize.sm, color: colors.textDark },
  subChipTxtSel: {
    color: colors.greenDeep,
    fontWeight: fontWeight.bold as '700',
  },

  // Pending pill
  pendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.amber,
    gap: spacing.sm,
  },
  pendDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.white },
  pendLabel: {
    flex: 1,
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold as '600',
  },
  pendAction: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as '700',
    textDecorationLine: 'underline',
  },

  // List
  list: {
    padding: spacing.base,
    paddingTop: 0,
    paddingBottom: spacing.xxxl * 2,
    flexGrow: 1,
  },

  // Section headers (mes + total de animales)
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  // Más prominente (ver ParicionListScreen).
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as '700',
    color: colors.greenDark,
    letterSpacing: 0.3,
  },
  sectionCount: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold as '600',
    marginTop: 2,
  },
  sectionTotalBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.round,
    backgroundColor: '#FBE9E7',
  },
  sectionTotalNum: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as '700',
    color: colors.danger,
  },
  sectionTotalUnit: {
    fontSize: fontSize.xs,
    color: colors.danger,
    fontWeight: fontWeight.semibold as '600',
  },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardPressed: {
    opacity: 0.75,
    backgroundColor: colors.bgLight,
  },

  // Bloque izq: emoji + categoría con tinte terracota/danger
  catBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 86,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: '#FBE9E7',
    borderRadius: radius.md,
    gap: 2,
  },
  catEmoji: { fontSize: 18 },
  catTxt: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as '700',
    color: colors.danger,
    letterSpacing: 0.3,
  },

  // Bloque centro: causa + meta
  cardRight: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  causa: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as '700',
    color: colors.textDark,
    lineHeight: 18,
  },
  causaMuted: {
    color: colors.textMuted,
    fontStyle: 'italic',
    fontWeight: fontWeight.regular as '400',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaIcon: { fontSize: 11 },
  metaTxt: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: fontWeight.medium as '500',
  },
  metaDot: { color: colors.textMuted, marginHorizontal: 2 },
  obs: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },

  // Bloque der: sync + chevron
  cardEnd: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  chev: {
    fontSize: 24,
    color: colors.textMuted,
    lineHeight: 24,
    fontWeight: fontWeight.semibold as '600',
  },

  // Empty state
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
    gap: spacing.sm,
  },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.sm },
  emptyTxt: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
  },
  emptyHint: {
    marginTop: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  emptyPlus: {
    fontWeight: fontWeight.bold as '700',
    color: colors.greenDark,
  },
  emptyBtn: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.greenDark,
  },
  emptyBtnTxt: {
    color: colors.greenDark,
    fontWeight: fontWeight.bold as '700',
  },
});
