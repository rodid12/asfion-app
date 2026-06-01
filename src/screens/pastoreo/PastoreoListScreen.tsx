// PastoreoListScreen — modelo circuito + parcela.
//
// Sectioning: por circuito (siguiendo el feedback de Ro: "primero por circuito,
// luego por fecha"). Dentro de cada sección los items van por fecha desc.
// Estado abierto/cerrado se muestra con badge en cada card.
//
// Card layout:
//  - Izquierda: número de parcela en chip grande
//  - Centro: categoría + categoría animal + caravana (si hay) + fechas
//  - Derecha: badge ABIERTO/CERRADO + sync + chevron

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
import type { Campo, Circuito, Pastoreo } from '@/data/types';
import { useTabNav } from '@/navigation/TabContext';

type Nav = NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;

// ---------- helpers ----------

function fechaCortaConAnio(iso: string): string {
  const [yy, mm, dd] = iso.split('-').map(Number);
  if (!yy || !mm || !dd) return iso;
  return `${dd}/${mm}/${String(yy).slice(2)}`;
}

function diasEntre(desdeISO: string, hastaISO: string | undefined): number {
  const desde = new Date(desdeISO + 'T00:00:00');
  const hasta = hastaISO ? new Date(hastaISO + 'T00:00:00') : new Date();
  const ms = hasta.getTime() - desde.getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
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

// ---------- filtros ----------

type EstadoFilter = 'abiertos' | 'cerrados' | 'todos';
const ESTADO_LABEL: Record<EstadoFilter, string> = {
  abiertos: 'Abiertos',
  cerrados: 'Cerrados',
  todos: 'Todos',
};

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

export function PastoreoListScreen() {
  const nav = useNavigation<Nav>();
  const repo = useRepository();
  const { user } = useAuth();
  const { currentTab } = useTabNav();

  const esAdmin = user?.rol === 'administrador' || user?.rol === 'moderador';

  const cachedSeed = (repo.listEventosCached('pastoreo') ?? []) as Pastoreo[];
  const [data, setData] = useState<Pastoreo[]>(cachedSeed);
  const [camposMap, setCamposMap] = useState<Record<string, Campo>>({});
  const [circuitosMap, setCircuitosMap] = useState<Record<string, Circuito>>({});
  const [loading, setLoading] = useState(cachedSeed.length === 0);
  const [flushing, setFlushing] = useState(false);
  const [query, setQuery] = useState('');

  const [estado, setEstado] = useState<EstadoFilter>('todos');
  const [rango, setRango] = useState<RangoFecha>('todo');
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
        repo.listEventos('pastoreo'),
        repo.listCampos(),
        repo.listPending(),
      ]);
      const serverIds = new Set((evs as Pastoreo[]).map(p => p.id));
      const pendingPastoreo = pendings
        .filter(e => e.tipo === 'pastoreo')
        .filter(e => !serverIds.has(e.id)) as Pastoreo[];
      const ordered = [...(evs as Pastoreo[]), ...pendingPastoreo].sort((a, b) => {
        if (!a.fechaSalida && b.fechaSalida) return -1;
        if (a.fechaSalida && !b.fechaSalida) return 1;
        if (a.fecha !== b.fecha) return a.fecha > b.fecha ? -1 : 1;
        return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
      });
      setData(ordered);
      setCamposMap(Object.fromEntries(cs.map(c => [c.id, c])));

      // Cargar circuitos de todos los campos visibles para mappear circuitoId → nombre
      const campoIds = Array.from(new Set(cs.map(c => c.id)));
      const circs = await Promise.all(campoIds.map(id => repo.listCircuitos(id)));
      const allCircs = circs.flat();
      setCircuitosMap(Object.fromEntries(allCircs.map(c => [c.id, c])));
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => {
    const unsub = nav.addListener('focus', () => load({ silent: true }));
    return unsub;
  }, [nav, load]);
  useEffect(() => {
    if (currentTab === 'pastoreo') load({ silent: true });
  }, [currentTab, load]);

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
      if (estado === 'abiertos' && p.fechaSalida) return false;
      if (estado === 'cerrados' && !p.fechaSalida) return false;
      if (desde && p.fecha < desde) return false;
      if (hasta && p.fecha > hasta) return false;
      if (campoFiltro && p.campoId !== campoFiltro) return false;
      if (q) {
        const cir = p.circuitoId ? (circuitosMap[p.circuitoId]?.nombre ?? '') : '';
        const haystack = [
          p.categoria ?? '',
          p.categoriaAnimal ?? '',
          p.caravanaNumero ?? '',
          cir,
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [scopedData, estado, rango, desdeCustom, hastaCustom, campoFiltro, query, circuitosMap]);

  const pendientes = useMemo(
    () => data.filter(p => p.syncState === 'pending' || p.syncState === 'failed').length,
    [data],
  );

  const activosCount = useMemo(() => {
    let n = 0;
    if (estado !== 'todos') n++;
    if (rango !== 'todo') n++;
    if (desdeCustom || hastaCustom) n++;
    if (campoFiltro) n++;
    return n;
  }, [estado, rango, desdeCustom, hastaCustom, campoFiltro]);

  const clearFilters = () => {
    setEstado('todos');
    setRango('todo');
    setDesdeCustom(undefined);
    setHastaCustom(undefined);
    setCampoFiltro(null);
    setCampoPickerOpen(false);
  };

  // Sectioning POR CIRCUITO (feedback Ro: "primero por circuito, luego fecha").
  // Dentro de cada sección, items ordenados por fecha desc.
  const sections = useMemo(() => {
    const byCircuito = new Map<string, Pastoreo[]>();
    filtered.forEach(p => {
      const key = p.circuitoId ?? '_sin_circuito';
      const arr = byCircuito.get(key) ?? [];
      arr.push(p);
      byCircuito.set(key, arr);
    });
    // Ordenar circuitos por nombre
    const keys = Array.from(byCircuito.keys()).sort((a, b) => {
      const na = circuitosMap[a]?.nombre ?? '';
      const nb = circuitosMap[b]?.nombre ?? '';
      return na.localeCompare(nb);
    });
    return keys.map(k => {
      const circuito = circuitosMap[k];
      const items = byCircuito.get(k)!;
      const campoNom = items[0]?.campoId
        ? (camposMap[items[0].campoId]?.nombre ?? '')
        : '';
      return {
        title: circuito?.nombre ?? '(sin circuito)',
        campo: campoNom,
        hectareas: circuito?.hectareas,
        count: items.length,
        data: items,
      };
    });
  }, [filtered, circuitosMap, camposMap]);

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

  const onItemPress = (p: Pastoreo) => {
    nav.navigate('PastoreoForm', { pastoreoId: p.id });
  };

  const renderItem = ({ item }: { item: Pastoreo }) => {
    const abierto = !item.fechaSalida;
    const dias = diasEntre(item.fecha, item.fechaSalida);

    return (
      <Pressable
        onPress={() => onItemPress(item)}
        style={({ pressed }) => [
          styles.card,
          abierto && styles.cardAbierto,
          pressed && styles.cardPressed,
        ]}
        accessibilityRole="button"
      >
        {/* Parcela: número grande a la izquierda */}
        <View style={styles.parcelaBlock}>
          <Text style={styles.parcelaNum}>{item.parcelaNumero ?? '—'}</Text>
          <Text style={styles.parcelaLbl}>parcela</Text>
        </View>

        {/* Centro: categoría + categoría animal + caravana + fechas */}
        <View style={styles.cardRight}>
          <Text style={styles.categoria} numberOfLines={1}>
            {item.categoria || 'Sin categoría'}
          </Text>
          {item.categoriaAnimal && (
            <Text style={styles.catAnimal} numberOfLines={1}>{item.categoriaAnimal}</Text>
          )}
          {item.caravanaNumero && (
            <Text style={styles.caravana} numberOfLines={1}>
              Caravana {item.caravanaNumero}
            </Text>
          )}
          {abierto ? (
            <Text style={styles.fechaTxtBold}>
              desde {fechaCortaConAnio(item.fecha)} · hace {dias} {dias === 1 ? 'día' : 'días'}
            </Text>
          ) : (
            <Text style={styles.fechaTxt}>
              {fechaCortaConAnio(item.fecha)} → {fechaCortaConAnio(item.fechaSalida!)} · {dias} {dias === 1 ? 'día' : 'días'}
            </Text>
          )}
          {esAdmin && (
            <Text style={styles.metaTxt} numberOfLines={1}>
              👤 {primerNombre(item.usuarioEmail)}
            </Text>
          )}
        </View>

        <View style={styles.cardEnd}>
          {abierto && (
            <View style={styles.badgeAbierto}>
              <Text style={styles.badgeAbiertoTxt}>ABIERTO</Text>
            </View>
          )}
          <SyncBadge state={item.syncState} />
          <Text style={styles.chev}>›</Text>
        </View>
      </Pressable>
    );
  };

  const renderSectionHeader = ({ section }: {
    section: { title: string; campo: string; hectareas?: number; count: number; data: Pastoreo[] };
  }) => (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <Text style={styles.sectionSub}>
          {section.campo}{section.hectareas ? ` · ${section.hectareas} ha` : ''}
        </Text>
      </View>
      <Text style={styles.sectionCount}>
        {section.count} {section.count === 1 ? 'registro' : 'registros'}
      </Text>
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
          placeholder="Buscar circuito, categoría, caravana..."
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

      <View style={styles.filterBar}>
        <View style={styles.filterRow}>
          {(['abiertos', 'cerrados', 'todos'] as EstadoFilter[]).map(e => (
            <Pressable
              key={e}
              onPress={() => setEstado(e)}
              style={[styles.fChip, styles.fChipEq, estado === e && styles.fChipSel]}
              hitSlop={6}
            >
              <Text style={[styles.fChipTxt, estado === e && styles.fChipTxtSel]}>
                {ESTADO_LABEL[e]}
              </Text>
            </Pressable>
          ))}
        </View>

        <DateRangeFilter
          presets={(['30d', '90d', 'year', 'todo'] as RangoFecha[]).map(r => ({ key: r, label: RANGO_LABEL[r] }))}
          preset={rango}
          presetTodo="todo"
          desde={desdeCustom}
          hasta={hastaCustom}
          onChangePreset={k => setRango(k as RangoFecha)}
          onChangeCustom={(d, h) => { setDesdeCustom(d); setHastaCustom(h); }}
        />

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
              <Text style={styles.emptyEmoji}>🌾</Text>
              <Text style={styles.emptyTxt}>Todavía no hay pastoreos cargados.</Text>
              <Text style={styles.emptyHint}>
                Tocá <Text style={styles.emptyPlus}>+</Text> para registrar el primero.
              </Text>
            </View>
          )
        }
      />

      <Fab
        onPress={() => nav.navigate('PastoreoForm', {})}
        accessibilityLabel="Nuevo pastoreo"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgLight },

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
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.borderSoft,
    justifyContent: 'center', alignItems: 'center',
  },
  clearTxt: {
    color: colors.textMuted, fontSize: 16,
    fontWeight: fontWeight.bold as '700', lineHeight: 16,
  },

  filterBar: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  filterRow: { flexDirection: 'row', gap: spacing.xs },
  filterRow2: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: spacing.xs, alignItems: 'center',
  },
  fChip: {
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderRadius: radius.round, borderWidth: 1,
    borderColor: colors.borderSoft, backgroundColor: colors.white,
    minHeight: 36, justifyContent: 'center', alignItems: 'center',
  },
  fChipEq: { flex: 1, paddingHorizontal: spacing.xs },
  fChipSecondary: {
    backgroundColor: colors.bgLight, minHeight: 32, paddingVertical: 6,
  },
  fChipWide: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingLeft: spacing.md, paddingRight: spacing.sm, paddingVertical: 10,
    borderRadius: radius.round, borderWidth: 1, borderColor: colors.borderSoft,
    backgroundColor: colors.white, maxWidth: 200, minHeight: 36,
  },
  fChipSel: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  fChipSelSecondary: { backgroundColor: colors.greenLime, borderColor: colors.greenLime },
  fChipTxt: { fontSize: fontSize.sm, color: colors.textDark, fontWeight: fontWeight.semibold as '600' },
  fChipTxtSel: { color: colors.white },
  fChipTxtSelSecondary: { color: colors.greenDeep, fontWeight: fontWeight.bold as '700' },
  fChev: { fontSize: 10, color: colors.textMuted, marginLeft: 2 },
  fChevSel: { color: colors.white },
  fClear: { paddingHorizontal: spacing.sm, paddingVertical: 6 },
  // "Limpiar" como ghost link suave (ver ParicionListScreen).
  fClearTxt: {
    fontSize: fontSize.sm, color: colors.textMuted,
    fontWeight: fontWeight.semibold as '600',
  },

  subPicker: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs,
    paddingHorizontal: spacing.base, paddingBottom: spacing.md,
  },
  subChip: {
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.borderSoft, backgroundColor: colors.bgLight,
  },
  subChipSel: { backgroundColor: colors.greenLime, borderColor: colors.greenLime },
  subChipTxt: { fontSize: fontSize.sm, color: colors.textDark },
  subChipTxtSel: { color: colors.greenDeep, fontWeight: fontWeight.bold as '700' },

  pendPill: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: spacing.base, marginBottom: spacing.md,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    borderRadius: radius.lg, backgroundColor: colors.amber, gap: spacing.sm,
  },
  pendDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.white },
  pendLabel: { flex: 1, color: colors.white, fontSize: fontSize.sm, fontWeight: fontWeight.semibold as '600' },
  pendAction: { color: colors.white, fontSize: fontSize.sm, fontWeight: fontWeight.bold as '700', textDecorationLine: 'underline' },

  list: {
    padding: spacing.base, paddingTop: 0,
    paddingBottom: spacing.xxxl * 2, flexGrow: 1,
  },

  // Section header (por circuito)
  sectionHeader: {
    flexDirection: 'row', alignItems: 'baseline',
    marginTop: spacing.lg, marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs, gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.md, fontWeight: fontWeight.bold as '700',
    color: colors.greenDark, letterSpacing: 0.3,
  },
  sectionSub: {
    fontSize: fontSize.xs, color: colors.textMuted,
    fontWeight: fontWeight.semibold as '600', marginTop: 2,
  },
  sectionCount: {
    fontSize: fontSize.sm, color: colors.textMuted,
    fontWeight: fontWeight.semibold as '600',
  },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.base,
    backgroundColor: colors.white, borderRadius: radius.lg,
    padding: spacing.base, borderWidth: 1, borderColor: colors.borderSoft,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  cardAbierto: { borderColor: colors.greenLime, borderWidth: 1.5 },
  cardPressed: { opacity: 0.75, backgroundColor: colors.bgLight },

  parcelaBlock: {
    minWidth: 56, alignItems: 'center',
    paddingVertical: spacing.xs, paddingHorizontal: spacing.sm,
    backgroundColor: colors.bgLight, borderRadius: radius.md,
  },
  parcelaNum: {
    fontSize: fontSize.xl, fontWeight: fontWeight.bold as '700',
    color: colors.greenDark, lineHeight: 26,
  },
  parcelaLbl: {
    fontSize: 9, color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6,
    fontWeight: fontWeight.bold as '700',
  },

  cardRight: { flex: 1, gap: 2, minWidth: 0 },
  categoria: {
    fontSize: fontSize.md, fontWeight: fontWeight.bold as '700',
    color: colors.textDark, lineHeight: 20,
  },
  catAnimal: {
    fontSize: fontSize.sm, color: colors.greenDark,
    fontWeight: fontWeight.semibold as '600',
  },
  caravana: {
    fontSize: fontSize.sm, color: colors.textMuted,
    fontWeight: fontWeight.medium as '500', marginTop: 2,
  },
  fechaTxt: {
    fontSize: fontSize.sm, color: colors.textMuted,
    fontWeight: fontWeight.medium as '500', marginTop: 2,
  },
  fechaTxtBold: {
    fontSize: fontSize.sm, color: colors.greenDark,
    fontWeight: fontWeight.bold as '700', marginTop: 2,
  },
  metaTxt: {
    fontSize: fontSize.xs, color: colors.textMuted,
    fontWeight: fontWeight.medium as '500', marginTop: 2,
  },

  cardEnd: { alignItems: 'flex-end', gap: spacing.xs },
  badgeAbierto: {
    backgroundColor: colors.greenLime,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderRadius: radius.round,
  },
  badgeAbiertoTxt: {
    color: colors.greenDeep, fontSize: 10,
    fontWeight: fontWeight.bold as '700', letterSpacing: 0.8,
  },
  chev: {
    fontSize: 24, color: colors.textMuted,
    lineHeight: 24, fontWeight: fontWeight.semibold as '600',
  },

  empty: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: spacing.xxl, gap: spacing.sm,
  },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.sm },
  emptyTxt: { fontSize: fontSize.md, color: colors.textMuted, textAlign: 'center' },
  emptyHint: { marginTop: spacing.sm, fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center' },
  emptyPlus: { fontWeight: fontWeight.bold as '700', color: colors.greenDark },
  emptyBtn: {
    marginTop: spacing.lg, paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.greenDark,
  },
  emptyBtnTxt: { color: colors.greenDark, fontWeight: fontWeight.bold as '700' },
});
