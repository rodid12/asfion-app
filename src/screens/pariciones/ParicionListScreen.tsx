// Listado de pariciones con filtros por rol.
//
// Reglas:
//  - Operario: auto-scope a SU email (solo ve lo que él cargó).
//    Filtra por campo (de los suyos) y fecha.
//  - Administrador / moderador: puede filtrar por usuario (chip "Todos" por default).
//    Filtra por campo y fecha.
//
// Filtros disponibles:
//  - Rango de fecha: Hoy / 7d / 30d / Todo (default: Todo)
//  - Campo: Todos / <campo específico> (los visibles al usuario)
//  - Usuario: solo admin/mod — Todos / <email>
//
// Además se mantiene: search por caravana, FAB +, pill de pendientes, SectionList agrupada.

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
import type { Campo, CaravanaColor, EventoParicion, Paricion } from '@/data/types';
import { useTabNav } from '@/navigation/TabContext';

type Nav = NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;

// ---------- helpers ----------

function dayLabel(fechaISO: string): { label: string; order: string } {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  const todayISO = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const yesterday = new Date(y, m, d - 1);
  const yesterdayISO = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  if (fechaISO === todayISO) return { label: 'HOY', order: fechaISO };
  if (fechaISO === yesterdayISO) return { label: 'AYER', order: fechaISO };

  const [yy, mm, dd] = fechaISO.split('-').map(Number);
  if (!yy || !mm || !dd) return { label: fechaISO, order: fechaISO };
  const dt = new Date(yy, mm - 1, dd);
  const dow = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'][dt.getDay()];
  return { label: `${dow} ${dd}/${mm}`, order: fechaISO };
}

// Feedback Ro: peones de campo son gente grande que quiere leer palabras,
// no símbolos esotéricos (♂/♀ se confunden a simple vista). Usamos texto completo.
function sexoLabel(sexo?: string) {
  if (!sexo) return '';
  return sexo; // 'Macho' | 'Hembra' | 'Orejano'
}

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function primerNombre(email: string): string {
  const local = email.split('@')[0] ?? email;
  const first = local.split(/[.\-_]/)[0] ?? local;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

const COLOR_HEX: Record<string, string> = {
  Celeste: '#7EC4E8',
  Amarillo: '#F5C842',
  Blanca: '#F5F5F0',
  Naranja: '#E07B3C',
};

// Los 4 colores reales en uso (orden como en el AppSheet original).
// Mantenemos la constante exportable aunque hayamos ocultado el picker visual
// de caravana en UI (ver comentario en el render). Si en el futuro reactivamos
// el filtro por color, está todo listo: state, lógica de filtro, COLOR_HEX,
// estilos de swatch, etc. Solo hay que volver a renderizar el bloque.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const COLORES_CARAVANA: CaravanaColor[] = ['Celeste', 'Amarillo', 'Blanca', 'Naranja'];

// Eventos de parición — mismo orden que en el form.
const EVENTOS_FILTRO: EventoParicion[] = ['Nacimiento', 'Muerte', 'Aborto', 'Retacto'];

// Paleta del badge de evento — bg tint + texto fuerte.
// Inspirada en los chips del form, consistente con MetricasScreen.
// Así de un vistazo el peón ve: verde = nacimiento OK, rojo = muerte.
const EVENTO_PALETTE: Record<EventoParicion, { bg: string; fg: string }> = {
  Nacimiento: { bg: '#E6F4EC', fg: '#1B4332' }, // verde pastel / greenDark
  Muerte:     { bg: '#FBE4E3', fg: '#9B2F2D' }, // rojo pastel / danger dark
  Aborto:     { bg: '#F7E6D5', fg: '#8E5A29' }, // terracota pastel
  Retacto:    { bg: '#F5EAD0', fg: '#8E6321' }, // amber pastel
};

// Filtro de rango de fecha
type RangoFecha = 'hoy' | '7d' | '30d' | 'todo';
const RANGO_LABEL: Record<RangoFecha, string> = {
  hoy: 'Hoy',
  '7d': '7 días',
  '30d': '30 días',
  todo: 'Todo',
};

function rangoDesde(r: RangoFecha): string | null {
  if (r === 'hoy') return isoDaysAgo(0);
  if (r === '7d') return isoDaysAgo(6);
  if (r === '30d') return isoDaysAgo(29);
  return null;
}

// ---------- pantalla ----------

export function ParicionListScreen() {
  const nav = useNavigation<Nav>();
  const repo = useRepository();
  const { user } = useAuth();
  const { currentTab } = useTabNav();

  const esAdmin = user?.rol === 'administrador' || user?.rol === 'moderador';

  // Seed inicial: la última copia cacheada en el repository (sobrevive a
  // unmounts/remounts). Si nunca cargó, array vacío + spinner como antes.
  const cachedSeed = (repo.listEventosCached('paricion') ?? []) as Paricion[];
  const [data, setData] = useState<Paricion[]>(cachedSeed);
  const [camposMap, setCamposMap] = useState<Record<string, Campo>>({});
  // Spinner SOLO si no había cache previo. Con cache, refrescamos en silencio.
  const [loading, setLoading] = useState(cachedSeed.length === 0);
  const [flushing, setFlushing] = useState(false);
  const [query, setQuery] = useState('');

  // Filtros activos
  const [rango, setRango] = useState<RangoFecha>('todo');
  // Rango custom (desde/hasta) — alternativa al preset Hoy/7d/30d/Todo.
  // Cuando alguno está set, OVERRIDE el preset.
  const [desdeCustom, setDesdeCustom] = useState<string | undefined>();
  const [hastaCustom, setHastaCustom] = useState<string | undefined>();
  const [campoFiltro, setCampoFiltro] = useState<string | null>(null); // null = todos
  const [usuarioFiltro, setUsuarioFiltro] = useState<string | null>(null); // null = todos (solo admin/mod)
  // Filtro por color de caravana — la lógica sigue acá pero el picker visual
  // está OCULTO en UI por feedback del cliente. Se mantiene el state porque:
  //  (a) el setter se sigue exportando vía clearFilters;
  //  (b) si reactivamos el picker más adelante, no hay que refactorizar nada.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [colorFiltro, setColorFiltro] = useState<CaravanaColor | null>(null);
  // Filtro por tipo de evento — REEMPLAZA al picker de caravana en UI.
  const [eventoFiltro, setEventoFiltro] = useState<EventoParicion | null>(null);
  const [expandedFilter, setExpandedFilter] = useState<'campo' | 'usuario' | null>(null);

  // load() acepta { silent } para no mostrar el spinner cuando es un refresh
  // de background (focus de tab). Antes mostraba spinner CADA vez que abrías
  // la tab, con Supabase remoto se veía constantemente.
  //
  // IMPORTANTE: además de los eventos del SERVER, mergeamos los PENDING
  // locales (cola en AsyncStorage que no se pudo subir). Si un save falló
  // (red caída, JWT vencido, RLS, FK, lo que sea), el evento sigue acá con
  // su badge PENDIENTE — antes simplemente desaparecía hasta que sincronice
  // y al usuario le parecía que "no se guardó nada".
  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const [evs, cs, pendings] = await Promise.all([
        repo.listEventos('paricion'),
        repo.listCampos(),
        repo.listPending(),
      ]);
      // Dedup: si el id ya está en server, gana el server (puede haberse
      // sincronizado pero la cola todavía no se limpió).
      const serverIds = new Set((evs as Paricion[]).map(p => p.id));
      const pendingDePariciones = pendings
        .filter(e => e.tipo === 'paricion')
        .filter(e => !serverIds.has(e.id)) as Paricion[];
      const merged = [...(evs as Paricion[]), ...pendingDePariciones];
      const ordered = merged.sort((a, b) => {
        if (a.fecha !== b.fecha) return a.fecha > b.fecha ? -1 : 1;
        return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
      });
      setData(ordered);
      setCamposMap(Object.fromEntries(cs.map(c => [c.id, c])));
    } finally {
      setLoading(false);
    }
  }, [repo]);

  // Refrescar al volver al stack (post-Form) y al entrar al tab — silent
  // (sin spinner) para no romper la UX cada vez que navegás.
  useEffect(() => {
    const unsub = nav.addListener('focus', () => load({ silent: true }));
    return unsub;
  }, [nav, load]);
  useEffect(() => {
    if (currentTab === 'lista') load({ silent: true });
  }, [currentTab, load]);

  // Campos visibles: los del usuario (si tiene lista) o los presentes en la data.
  const camposVisibles = useMemo(() => {
    const userCampos = user?.campos ?? [];
    if (userCampos.length > 0) {
      return userCampos
        .map(id => camposMap[id])
        .filter((c): c is Campo => Boolean(c));
    }
    // fallback: inferir de la data
    const ids = Array.from(new Set(data.map(p => p.campoId)));
    return ids.map(id => camposMap[id]).filter((c): c is Campo => Boolean(c));
  }, [user, camposMap, data]);

  // Usuarios presentes en la data (solo para admin/mod).
  const usuariosVisibles = useMemo(() => {
    return Array.from(new Set(data.map(p => p.usuarioEmail))).sort();
  }, [data]);

  // Auto-scope para operario: solo sus pariciones.
  const scopedData = useMemo(() => {
    if (!esAdmin && user?.email) {
      return data.filter(p => p.usuarioEmail === user.email);
    }
    return data;
  }, [data, esAdmin, user]);

  // Aplicar filtros (rango, campo, usuario, color, query).
  // El buscador ahora SOLO matchea número de caravana — el color se filtra
  // con el picker visual de swatches (feedback Ro).
  const filtered = useMemo(() => {
    // Custom range gana sobre preset si alguno de los dos está activo.
    const customActivo = Boolean(desdeCustom || hastaCustom);
    const desde = customActivo ? desdeCustom : rangoDesde(rango);
    const hasta = customActivo ? hastaCustom : undefined;
    const q = query.trim().toLowerCase();
    return scopedData.filter(p => {
      if (desde && p.fecha < desde) return false;
      if (hasta && p.fecha > hasta) return false;
      if (campoFiltro && p.campoId !== campoFiltro) return false;
      if (esAdmin && usuarioFiltro && p.usuarioEmail !== usuarioFiltro) return false;
      if (colorFiltro && p.caravanaColor !== colorFiltro) return false;
      if (eventoFiltro && p.evento !== eventoFiltro) return false;
      if (q) {
        const num = (p.caravanaNumero ?? '').toLowerCase();
        if (!num.includes(q)) return false;
      }
      return true;
    });
  }, [scopedData, rango, desdeCustom, hastaCustom, campoFiltro, usuarioFiltro, colorFiltro, eventoFiltro, query, esAdmin]);

  const pendientes = useMemo(
    () => data.filter(p => p.syncState === 'pending' || p.syncState === 'failed').length,
    [data],
  );

  const activosCount = useMemo(() => {
    let n = 0;
    if (rango !== 'todo') n++;
    if (desdeCustom || hastaCustom) n++;
    if (campoFiltro) n++;
    if (esAdmin && usuarioFiltro) n++;
    if (colorFiltro) n++;
    if (eventoFiltro) n++;
    return n;
  }, [rango, desdeCustom, hastaCustom, campoFiltro, usuarioFiltro, colorFiltro, eventoFiltro, esAdmin]);

  const clearFilters = () => {
    setRango('todo');
    setDesdeCustom(undefined);
    setHastaCustom(undefined);
    setCampoFiltro(null);
    setUsuarioFiltro(null);
    setColorFiltro(null);
    setEventoFiltro(null);
    setExpandedFilter(null);
  };

  // Agrupar por CAMPO (feedback Ro: "primero por campo, luego por fecha").
  // Dentro de cada campo, items ordenados por fecha desc.
  const sections = useMemo(() => {
    const byCampo = new Map<string, { campoNombre: string; items: Paricion[] }>();
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
      const baseMsg = `Intentados: ${r.intentados}\nExitosos: ${r.exitosos}\nFallidos: ${r.fallidos}`;
      const detalle = r.fallidos > 0 && r.errores.length > 0
        ? `\n\nMotivo: ${r.errores[0]?.error ?? '?'}`
        : '';
      // Si hay fallidos persistentes, ofrecemos borrarlos. Útil cuando los
      // items de la cola son inválidos (FK rota, schema viejo, etc.) y
      // reintentarlos no va a servir nunca.
      if (r.fallidos > 0) {
        Alert.alert(
          'Sincronización con errores',
          baseMsg + detalle + '\n\nSi el error no se resuelve solo, podés descartar los items que siguen fallando.',
          [
            { text: 'Descartar los que fallan', style: 'destructive', onPress: descartarFallidos },
            { text: 'Reintentar más tarde', style: 'cancel' },
          ],
        );
      } else {
        Alert.alert('Sincronización', baseMsg);
      }
      await load();
    } catch (err) {
      Alert.alert(
        'Error al sincronizar',
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setFlushing(false);
    }
  };

  // Borra los items pending de tipo 'paricion' que siguen fallando.
  // Conserva los pendings de OTROS módulos (lluvia, mortandad, pastoreo).
  const descartarFallidos = async () => {
    try {
      const all = await repo.listPending();
      const keep = all.filter(e => e.tipo !== 'paricion');
      // Truco: limpiamos AsyncStorage usando enqueuePending con todos los que
      // queremos mantener. La forma "oficial" sería un método del backend,
      // pero esto es seguro porque enqueuePending hace dedupe por id.
      // Si la cola estaba toda de pariciones, queda vacía.
      // (Si en el futuro tenemos un método clearPending, usar ese.)
      // Reescribimos toda la cola descartando los de tipo paricion.
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.setItem('asfion.supabase.pending.v1', JSON.stringify(keep));
      await load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : String(err));
    }
  };

  // Tap en card → Detail (read-only). El Detail tiene un FAB "Editar" que
  // lleva al Form. Decisión post-Supabase (feedback Ro): la card no muestra
  // causa de muerte/aborto ni observaciones por espacio, y abrir el Form
  // directo era engañoso ("ver" terminaba en "editar") + arriesgado
  // (modificaciones accidentales sobre datos reales). Los otros 3 módulos
  // siguen sin Detail porque su info entra completa en la card.
  const onItemPress = (p: Paricion) => {
    nav.navigate('ParicionDetail', { paricionId: p.id });
  };

  const renderItem = ({ item }: { item: Paricion }) => {
    const campoNom = camposMap[item.campoId]?.nombre ?? item.campoId;
    const tieneCaravana = item.caravanaColor || item.caravanaNumero;
    const sexo = sexoLabel(item.sexo);
    const dotColor = item.caravanaColor ? COLOR_HEX[item.caravanaColor] : colors.borderSoft;
    const evPal = EVENTO_PALETTE[item.evento];
    const causa = item.causaDetalle || item.causaTipo || item.causaMuerte;
    const showCausaBadge = (item.evento === 'Muerte' || item.evento === 'Aborto') && !!causa;

    return (
      <Pressable
        onPress={() => onItemPress(item)}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        accessibilityRole="button"
      >
        {/* Fila 1: caravana (prominente) + badge evento colorizado + chevron */}
        <View style={styles.rowTop}>
          {tieneCaravana ? (
            <View style={styles.caravanaRow}>
              <View style={[styles.colorDot, { backgroundColor: dotColor }]} />
              <Text style={styles.caravanaNum} numberOfLines={1}>
                {item.caravanaNumero ?? '—'}
              </Text>
            </View>
          ) : (
            <View style={styles.caravanaRow}>
              <View style={[styles.colorDot, styles.colorDotEmpty]} />
              <Text style={styles.noCaravana}>sin caravana</Text>
            </View>
          )}

          <View style={[styles.eventoBadge, { backgroundColor: evPal.bg }]}>
            <Text style={[styles.eventoBadgeTxt, { color: evPal.fg }]}>
              {item.evento.toUpperCase()}
            </Text>
          </View>

          <Text style={styles.chev}>›</Text>
        </View>

        {/* Fila 2: atributos del animal */}
        {(sexo || item.vacasGrupo) && (
          <Text style={styles.attrLine} numberOfLines={1}>
            {[sexo, item.vacasGrupo].filter(Boolean).join('  ·  ')}
          </Text>
        )}

        {/* Fila 3: footer con FECHA + usuario (metadata).
            Antes mostraba campo, pero ahora la lista está agrupada por campo
            (section header), así que sale repetido — lo reemplazamos por la
            fecha que es más útil dentro de un grupo de campo. */}
        <View style={styles.footer}>
          <View style={styles.footerItem}>
            <Text style={styles.footerIcon}>📅</Text>
            <Text style={styles.footerTxt} numberOfLines={1}>
              {dayLabel(item.fecha).label}
            </Text>
          </View>
          {esAdmin && (
            <View style={styles.footerItem}>
              <Text style={styles.footerIcon}>👤</Text>
              <Text style={styles.footerTxt} numberOfLines={1}>
                {primerNombre(item.usuarioEmail)}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          <SyncBadge state={item.syncState} />
        </View>

        {/* Badge de causa — solo si hay muerte/aborto con detalle */}
        {showCausaBadge && (
          <View style={styles.causaBadge}>
            <Text style={styles.causaBadgeTxt} numberOfLines={2}>
              ⚠️ {causa}
            </Text>
          </View>
        )}
      </Pressable>
    );
  };

  const renderSectionHeader = ({ section }: { section: { title: string; count: number } }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <Text style={styles.sectionCount}>
        {section.count} {section.count === 1 ? 'parición' : 'pariciones'}
      </Text>
    </View>
  );

  const campoFiltroLabel = campoFiltro ? camposMap[campoFiltro]?.nombre ?? campoFiltro : 'Campo: todos';
  const usuarioFiltroLabel = usuarioFiltro ? primerNombre(usuarioFiltro) : 'Usuario: todos';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Buscador */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar número de caravana..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="characters"
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
            presets={(['hoy', '7d', '30d', 'todo'] as RangoFecha[]).map(r => ({ key: r, label: RANGO_LABEL[r] }))}
            preset={rango}
            presetTodo="todo"
            desde={desdeCustom}
            hasta={hastaCustom}
            onChangePreset={k => setRango(k as RangoFecha)}
            onChangeCustom={(d, h) => { setDesdeCustom(d); setHastaCustom(h); }}
          />
        </View>

        {/* Filtro por TIPO DE EVENTO.
            Reemplaza al picker visual de color de caravana, que está oculto
            por feedback del cliente: "los filtros deberían ser por evento".
            Mantenemos la lógica del filtro por color (ver state colorFiltro)
            por si querés re-habilitarlo más adelante.
            UX: chips horizontales con la paleta del evento — verde nacimiento,
            rojo muerte, terracota aborto, ámbar retacto. Tap toggle. */}
        <Text style={styles.swatchLabel}>EVENTO</Text>
        <View style={styles.swatchRow}>
          {EVENTOS_FILTRO.map(ev => {
            const sel = eventoFiltro === ev;
            const pal = EVENTO_PALETTE[ev];
            return (
              <Pressable
                key={ev}
                onPress={() => setEventoFiltro(sel ? null : ev)}
                style={[
                  styles.swatch,
                  sel && { backgroundColor: pal.bg, borderColor: pal.fg },
                ]}
                hitSlop={4}
                accessibilityLabel={`Filtrar por evento ${ev}`}
                accessibilityState={{ selected: sel }}
              >
                <Text
                  style={[
                    styles.swatchTxt,
                    sel && { color: pal.fg, fontWeight: '700' },
                  ]}
                  numberOfLines={1}
                >
                  {ev}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Segunda fila: Campo + Usuario + Limpiar (solo si aplican) */}
        {(camposVisibles.length > 1 || (esAdmin && usuariosVisibles.length > 1) || activosCount > 0) && (
          <View style={styles.filterRow2}>
            {camposVisibles.length > 1 && (
              <Pressable
                onPress={() => setExpandedFilter(e => (e === 'campo' ? null : 'campo'))}
                style={[styles.fChipWide, campoFiltro && styles.fChipSel]}
              >
                <Text style={[styles.fChipTxt, campoFiltro && styles.fChipTxtSel]} numberOfLines={1}>
                  {campoFiltroLabel}
                </Text>
                <Text style={[styles.fChev, campoFiltro && styles.fChevSel]}>▾</Text>
              </Pressable>
            )}

            {esAdmin && usuariosVisibles.length > 1 && (
              <Pressable
                onPress={() => setExpandedFilter(e => (e === 'usuario' ? null : 'usuario'))}
                style={[styles.fChipWide, usuarioFiltro && styles.fChipSel]}
              >
                <Text style={[styles.fChipTxt, usuarioFiltro && styles.fChipTxtSel]} numberOfLines={1}>
                  {usuarioFiltroLabel}
                </Text>
                <Text style={[styles.fChev, usuarioFiltro && styles.fChevSel]}>▾</Text>
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

      {/* Sub-picker expandible (campo o usuario) */}
      {expandedFilter === 'campo' && camposVisibles.length > 1 && (
        <View style={styles.subPicker}>
          <Pressable
            onPress={() => { setCampoFiltro(null); setExpandedFilter(null); }}
            style={[styles.subChip, !campoFiltro && styles.subChipSel]}
          >
            <Text style={[styles.subChipTxt, !campoFiltro && styles.subChipTxtSel]}>Todos</Text>
          </Pressable>
          {camposVisibles.map(c => (
            <Pressable
              key={c.id}
              onPress={() => { setCampoFiltro(c.id); setExpandedFilter(null); }}
              style={[styles.subChip, campoFiltro === c.id && styles.subChipSel]}
            >
              <Text style={[styles.subChipTxt, campoFiltro === c.id && styles.subChipTxtSel]}>
                {c.nombre}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {expandedFilter === 'usuario' && esAdmin && (
        <View style={styles.subPicker}>
          <Pressable
            onPress={() => { setUsuarioFiltro(null); setExpandedFilter(null); }}
            style={[styles.subChip, !usuarioFiltro && styles.subChipSel]}
          >
            <Text style={[styles.subChipTxt, !usuarioFiltro && styles.subChipTxtSel]}>Todos</Text>
          </Pressable>
          {usuariosVisibles.map(email => (
            <Pressable
              key={email}
              onPress={() => { setUsuarioFiltro(email); setExpandedFilter(null); }}
              style={[styles.subChip, usuarioFiltro === email && styles.subChipSel]}
            >
              <Text style={[styles.subChipTxt, usuarioFiltro === email && styles.subChipTxtSel]} numberOfLines={1}>
                {primerNombre(email)}  ·  {email}
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
        // Perf con +2000 items: limitamos cuánto renderea inicialmente y por
        // batch, achicamos la window virtualizada y dejamos que clipee los
        // que están fuera de pantalla. El warning "large list slow to update"
        // venía de aplicar todos los 2500 pariciones de una.
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
              <Text style={styles.emptyTxt}>
                Sin resultados con los filtros activos.
              </Text>
              <Pressable onPress={clearFilters} style={styles.emptyBtn}>
                <Text style={styles.emptyBtnTxt}>Limpiar filtros</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTxt}>Todavía no hay pariciones cargadas.</Text>
              <Text style={styles.emptyHint}>
                Tocá el botón <Text style={styles.emptyPlus}>+</Text> para cargar la primera.
              </Text>
            </View>
          )
        }
      />

      <Fab
        onPress={() => nav.navigate('ParicionForm', {})}
        accessibilityLabel="Nueva parición"
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

  // Filter bar (2 filas: rango en la primera, campo/usuario en la segunda).
  // Cambiado de horizontal scroll a wrap — Ro reportó chips cortados en iPhone 15 Pro.
  filterBar: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
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
  // chips equitativos (rango fecha — 4 en una fila, reparten ancho)
  fChipEq: {
    flex: 1,
    paddingHorizontal: spacing.xs,
  },
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
  // "Limpiar" — antes era rojo subrayado (parecía un botón de borrar
  // todo / acción peligrosa). Es solo un reset de filtros, así que lo
  // bajamos a textMuted sin subrayado, alineado al estilo "ghost link".
  fClear: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  fClearTxt: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold as '600',
  },

  // Sub-picker (cuando tocás Campo o Usuario)
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
  subChipTxt: {
    fontSize: fontSize.sm,
    color: colors.textDark,
  },
  subChipTxtSel: {
    color: colors.greenDeep,
    fontWeight: fontWeight.bold as '700',
  },

  // Swatch row — picker visual de color de caravana (feedback Ro: mejor que escribir).
  // Layout: label como header, 4 swatches abajo con flex:1 para repartir ancho.
  swatchLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold as '700',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginTop: spacing.xs,
    marginBottom: 2,
  },
  swatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  swatch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: spacing.xs,
    paddingVertical: 7,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.white,
    minHeight: 34,
  },
  swatchSel: {
    borderColor: colors.greenDark,
    borderWidth: 2,
    // Compensamos el extra 1px de border para que no salte el layout vertical.
    paddingVertical: 6,
    backgroundColor: '#F0F6EE',
  },
  swatchDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  swatchTxt: {
    fontSize: fontSize.xs,
    color: colors.textDark,
    fontWeight: fontWeight.semibold as '600',
    flexShrink: 1,
  },
  swatchTxtSel: {
    color: colors.greenDark,
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

  // Section headers — un poco más prominentes para que se diferencien
  // visualmente de los chips de filtro y de las cards. Antes eran del mismo
  // tamaño que el texto de un chip, perdían jerarquía.
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
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
  },

  // Card — jerarquía visual fuerte (feedback Ro):
  //   1. Caravana grande + badge evento colorizado (arriba, dominante)
  //   2. Atributos del animal (medio, peso medio)
  //   3. Footer con metadata (abajo, texto muted)
  //   4. Badge de causa (si aplica, rojo-suave, opcional)
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.base,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: spacing.sm,
    // Sombra sutil para que la card "flote" sobre el fondo.
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

  // Fila 1: caravana + badge evento + chevron
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  caravanaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    minWidth: 0, // permite que numberOfLines haga truncate sin romper flex
  },
  colorDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
  },
  colorDotEmpty: {
    backgroundColor: colors.bgLight,
    borderStyle: 'dashed',
  },
  caravanaNum: {
    fontSize: fontSize.xl, // 24pt — dominante en la card
    fontWeight: fontWeight.bold as '700',
    color: colors.textDark,
    lineHeight: 28,
    letterSpacing: 0.3,
  },
  noCaravana: {
    fontSize: fontSize.base,
    color: colors.textMuted,
    fontStyle: 'italic',
  },

  // Badge del evento — bg pastel + texto oscuro, color según tipo
  eventoBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.round,
    minHeight: 26,
    justifyContent: 'center',
  },
  eventoBadgeTxt: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold as '700',
    letterSpacing: 0.7,
  },

  chev: {
    fontSize: 28,
    color: colors.textMuted,
    lineHeight: 28,
    fontWeight: fontWeight.semibold as '600',
    marginLeft: 2,
  },

  // Fila 2: atributos del animal (sexo · grupo)
  attrLine: {
    fontSize: fontSize.base, // 15pt — legible, peso medio
    color: colors.textDark,
    fontWeight: fontWeight.medium as '500',
    lineHeight: 20,
    paddingLeft: 34, // alineado con el número de caravana (dot + gap)
  },

  // Footer: campo + usuario + sync badge
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingLeft: 34,
    paddingTop: 2,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerIcon: {
    fontSize: 12,
  },
  footerTxt: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: fontWeight.medium as '500',
  },

  // Badge de causa — señal de alarma para muerte/aborto
  causaBadge: {
    marginTop: 2,
    marginLeft: 34,
    backgroundColor: '#FBE4E3',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
    alignSelf: 'flex-start',
    maxWidth: '92%',
  },
  causaBadgeTxt: {
    fontSize: fontSize.sm,
    color: '#9B2F2D',
    fontWeight: fontWeight.semibold as '600',
    lineHeight: 18,
  },

  // Empty state
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  emptyTxt: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
  },
  emptyHint: {
    marginTop: spacing.md,
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
