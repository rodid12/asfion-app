// Listado administrativo de ventas. Vive en el Stack (no agrega un octavo
// ítem a la barra inferior, que quedaría ilegible en teléfonos angostos).
// Tocar una card abre el detalle read-only, desde donde se exporta el PDF o
// se entra explícitamente a editar.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { EmptyState } from '@/components/EmptyState';
import { Fab } from '@/components/Fab';
import { SyncBadge } from '@/components/SyncBadge';
import { useAuth } from '@/auth/context';
import { useRepository } from '@/data';
import type { Venta } from '@/data/types';
import type { RootStackParamList } from '@/navigation/types';
import { fechaBonita } from '@/utils/fechas';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';

type Nav = NativeStackNavigationProp<RootStackParamList, 'VentaList'>;

export function VentaListScreen() {
  const nav = useNavigation<Nav>();
  const repo = useRepository();
  const { user } = useAuth();
  const cached = (repo.listEventosCached('venta') ?? []) as Venta[];
  const [data, setData] = useState<Venta[]>(cached);
  const [loading, setLoading] = useState(cached.length === 0);
  const [query, setQuery] = useState('');
  const [flushing, setFlushing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [server, pending] = await Promise.all([repo.listEventos('venta'), repo.listPending()]);
      const ventasServer = server as Venta[];
      const ids = new Set(ventasServer.map(v => v.id));
      const ventasPending = pending.filter(e => e.tipo === 'venta' && !ids.has(e.id)) as Venta[];
      setData([...ventasServer, ...ventasPending].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.createdAt.localeCompare(a.createdAt)));
    } catch (err) {
      if (!silent) Alert.alert('No se pudieron cargar las ventas', err instanceof Error ? err.message : 'Revisá la conexión.');
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => {
    void load(true);
    return nav.addListener('focus', () => { void load(true); });
  }, [nav, load]);

  const filtradas = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter(v => [
      v.correlativo, v.numeroDte, v.tropa, v.consignado, v.titular,
      v.frigorifico, ...v.grupos.map(g => g.cantCabYCat),
    ].join(' ').toLowerCase().includes(q));
  }, [data, query]);

  const pendientes = useMemo(
    () => data.filter(v => v.syncState === 'pending' || v.syncState === 'failed').length,
    [data],
  );

  const flush = async () => {
    setFlushing(true);
    try {
      const result = await repo.flushPending();
      Alert.alert('Sincronización', `Exitosos: ${result.exitosos}\nFallidos: ${result.fallidos}`);
      await load();
    } finally {
      setFlushing(false);
    }
  };

  if (user?.rol !== 'administrador') {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.noAccess}><Text style={styles.lock}>🔒</Text><Text style={styles.noAccessTitle}>Solo administradores</Text><Text style={styles.noAccessText}>Las ventas contienen información comercial sensible.</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.top}>
        <View style={styles.search}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar correlativo, DTE, tropa…"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            autoCorrect={false}
          />
          {query ? <Pressable onPress={() => setQuery('')} hitSlop={10}><Text style={styles.clear}>×</Text></Pressable> : null}
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summary}>{filtradas.length} {filtradas.length === 1 ? 'venta' : 'ventas'}</Text>
          {pendientes > 0 && (
            <Pressable onPress={flush} disabled={flushing} style={styles.pendingBtn}>
              <Text style={styles.pendingText}>{flushing ? 'Sincronizando…' : `${pendientes} sin sync · Subir`}</Text>
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={filtradas}
        keyExtractor={v => v.id}
        contentContainerStyle={[styles.list, filtradas.length === 0 && styles.listEmpty]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load()} tintColor={colors.navy} />}
        ListEmptyComponent={<EmptyState emoji="💰" title="Sin ventas" description={query ? 'No hay resultados para la búsqueda.' : 'Todavía no hay operaciones cargadas.'} />}
        renderItem={({ item }) => (
          <Pressable onPress={() => nav.navigate('VentaDetail', { ventaId: item.id })} style={({ pressed }) => [styles.card, pressed && { opacity: 0.82 }]}>
            <View style={styles.cardTop}>
              <View style={styles.opBadge}><Text style={styles.opText}>{item.correlativo}</Text></View>
              <Text style={styles.date}>{fechaBonita(item.fecha)}</Text>
              <View style={{ flex: 1 }} />
              <SyncBadge state={item.syncState} />
            </View>
            <View style={styles.groups}>
              {item.grupos.map(g => (
                <View key={g.orden} style={styles.groupRow}>
                  <Text style={styles.groupNumber}>{g.orden}</Text>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.groupName} numberOfLines={1}>{g.cantCabYCat}</Text>
                    <Text style={styles.groupMeta}>{g.kgNetos.toLocaleString('es-AR', { maximumFractionDigits: 2 })} kg netos · {g.kgPromedio.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg/cab</Text>
                  </View>
                </View>
              ))}
            </View>
            <View style={styles.commercial}>
              <Text style={styles.commercialText} numberOfLines={1}>🏭 {item.frigorifico}</Text>
              <Text style={styles.commercialText} numberOfLines={1}>👤 {item.consignado}</Text>
              <Text style={styles.chevron}>›</Text>
            </View>
          </Pressable>
        )}
      />
      <Fab onPress={() => nav.navigate('VentaForm', {})} accessibilityLabel="Nueva venta" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgLight },
  top: { padding: spacing.base, paddingBottom: spacing.sm, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgLight, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderSoft, paddingHorizontal: spacing.md },
  searchIcon: { marginRight: spacing.sm },
  searchInput: { flex: 1, minHeight: 46, color: colors.textDark, fontSize: fontSize.md },
  clear: { color: colors.textMuted, fontSize: 25, lineHeight: 28 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  summary: { flex: 1, color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.semibold as '600' },
  pendingBtn: { backgroundColor: colors.orangeSoft, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6 },
  pendingText: { color: colors.navyDeep, fontSize: 11, fontWeight: fontWeight.bold as '700' },
  list: { padding: spacing.base, paddingBottom: 110 },
  listEmpty: { flexGrow: 1 },
  card: { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.base, borderWidth: 1, borderColor: colors.borderSoft, marginBottom: spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  opBadge: { backgroundColor: colors.orangeSoft, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  opText: { color: colors.navyDeep, fontWeight: fontWeight.bold as '700' },
  date: { color: colors.textMuted, fontSize: fontSize.sm },
  groups: { gap: spacing.sm },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  groupNumber: { width: 24, height: 24, borderRadius: 12, textAlign: 'center', lineHeight: 24, backgroundColor: colors.navy, color: colors.white, fontSize: 11, fontWeight: fontWeight.bold as '700' },
  groupName: { color: colors.navyDeep, fontWeight: fontWeight.bold as '700', fontSize: fontSize.sm },
  groupMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  commercial: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  commercialText: { flex: 1, minWidth: 0, color: colors.textMuted, fontSize: 11 },
  chevron: { color: colors.orange, fontSize: 26, lineHeight: 26 },
  noAccess: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  lock: { fontSize: 42, marginBottom: spacing.md },
  noAccessTitle: { color: colors.navyDeep, fontSize: fontSize.lg, fontWeight: fontWeight.bold as '700', marginBottom: spacing.sm },
  noAccessText: { color: colors.textMuted, textAlign: 'center' },
});
