// Pantalla Métricas — dashboard resumen de los 4 módulos productivos.
//
// Gráficos (inspirados en las pantallas del AppSheet original):
//   PARICIONES
//   1. Eventos por campo      — cuántas pariciones cargadas por establecimiento
//   2. Eventos totales        — desglose por tipo (Nacimiento / Muerte / Aborto / Retacto)
//   3. Vacas por parir        — stockInicial - nacimientos, por campo
//   4. Terneros en pie        — tabla campo × stock × paridas × vivas (aprox.)
//   LLUVIAS
//   5. Lluvias por campo      — mm acumulados por establecimiento en el rango (réplica AppSheet)
//   6. Lluvias por mes        — serie temporal de mm acumulados por mes
//   MORTANDAD
//   7. Mortandad por campo    — animales muertos (no parto) por establecimiento
//   8. Mortandad por categoría — vaca / ternero / toro / novillo / vaquillona
//   9. Mortandad por causa    — Muerte Señalado / Nacido Muerto / Desconocido
//   PASTOREO
//  10. Movimientos por campo  — cantidad de movimientos por establecimiento
//  11. Cabezas movidas        — total de cabezas (cuando se contó) por campo
//
// Implementación sin librerías de charting: barras con <View> puro —
// el volumen de datos es chico (9 campos, 4 eventos, ~12 meses) y así mantenemos
// el bundle liviano. Si crece, migramos a Victory o Recharts en web.
//
// Scope de datos:
//  - Administrador/moderador: todos los eventos del cliente.
//  - Operario: solo lo que él cargó (consistente con la Lista).
//
// Filtro disponible: rango de fecha (hoy / 7d / 30d / todo).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/context';
import { LineChart } from '@/components/LineChart';
import { useRepository } from '@/data';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';
import type {
  Campo,
  CategoriaHacienda,
  CausaMuerteTipo,
  Compra,
  EventoParicion,
  Lluvia,
  Mortandad,
  Paricion,
  Pastoreo,
} from '@/data/types';
import { useTabNav } from '@/navigation/TabContext';

type Rango = 'hoy' | '7d' | '30d' | 'todo';
const RANGO_LABEL: Record<Rango, string> = {
  hoy: 'Hoy',
  '7d': '7 días',
  '30d': '30 días',
  todo: 'Todo',
};

// Sub-tab del dashboard. "resumen" muestra KPIs + cards con CTAs a cada módulo;
// los demás muestran los gráficos detallados de ese módulo. Cuando sumemos
// Medición, agregamos la key acá y la envolvemos igual.
type MetricaTab = 'resumen' | 'pariciones' | 'lluvias' | 'mortandad' | 'pastoreo' | 'compras';
const METRICA_TABS: MetricaTab[] = ['resumen', 'pariciones', 'lluvias', 'mortandad', 'pastoreo', 'compras'];
const METRICA_LABEL: Record<MetricaTab, string> = {
  resumen: 'Resumen',
  pariciones: 'Pariciones',
  lluvias: 'Lluvias',
  mortandad: 'Mortandad',
  pastoreo: 'Pastoreo',
  compras: 'Compras',
};

// Paletas accent por módulo — alineadas con las pantallas List de cada uno.
const MORTANDAD_ACCENT = colors.danger;
const LLUVIAS_ACCENT = '#1F4E6A';
const PASTOREO_ACCENT = colors.amber;
const COMPRAS_ACCENT = colors.navy;

// Categorías de hacienda en orden estable.
const CATEGORIA_ORDEN: CategoriaHacienda[] = ['vaca', 'ternero', 'toro', 'novillo', 'vaquillona'];
const CATEGORIA_LABEL: Record<CategoriaHacienda, string> = {
  vaca: 'Vacas',
  ternero: 'Terneros',
  toro: 'Toros',
  novillo: 'Novillos',
  vaquillona: 'Vaquillonas',
};

// Causas de muerte en orden estable + bucket "Sin especificar" para registros viejos.
const CAUSA_ORDEN: (CausaMuerteTipo | 'Sin especificar')[] = [
  'Muerte Señalado',
  'Nacido Muerto',
  'Desconocido',
  'Sin especificar',
];

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function rangoDesde(r: Rango): string | null {
  if (r === 'hoy') return isoDaysAgo(0);
  if (r === '7d') return isoDaysAgo(6);
  if (r === '30d') return isoDaysAgo(29);
  return null;
}

// Paleta por tipo de evento (consistente con los chips del form).
const EVENTO_COLOR: Record<EventoParicion, string> = {
  Nacimiento: colors.orange,
  Muerte:     colors.danger,
  Aborto:     colors.terracota,
  Retacto:    colors.amber,
};
const EVENTO_ORDEN: EventoParicion[] = ['Nacimiento', 'Muerte', 'Aborto', 'Retacto'];

// ---------- pantalla ----------

export function MetricasScreen() {
  const repo = useRepository();
  const { user } = useAuth();
  const { currentTab } = useTabNav();

  const esAdmin = user?.rol === 'administrador' || user?.rol === 'moderador';

  const [data, setData] = useState<Paricion[]>([]);
  const [lluvias, setLluvias] = useState<Lluvia[]>([]);
  const [mortandad, setMortandad] = useState<Mortandad[]>([]);
  const [pastoreo, setPastoreo] = useState<Pastoreo[]>([]);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [campos, setCampos] = useState<Campo[]>([]);
  // Map circuitoId → {nombre, campoId} para los charts de pastoreo.
  // Cargamos circuitos de TODOS los campos visibles al entrar al tab.
  const [circuitosMap, setCircuitosMap] = useState<Record<string, { nombre: string; campoId: string; hectareas: number }>>({});
  const [loading, setLoading] = useState(false);
  const [rango, setRango] = useState<Rango>('todo');
  const [metricaTab, setMetricaTab] = useState<MetricaTab>('resumen');

  // Patrón `cancelado` (audit 27-jun-2026): si el usuario navega fuera del
  // tab antes de que terminen los 6 fetches en paralelo, abortamos los
  // setState. Sin esto el spinner se queda colgado y se mezclan datos
  // viejos con la próxima entrada al tab.
  const load = useCallback(async (cancelado: () => boolean = () => false) => {
    setLoading(true);
    try {
      const [evs, lls, ms, ps, cps, cs] = await Promise.all([
        repo.listEventos('paricion'),
        repo.listEventos('lluvia'),
        repo.listEventos('mortandad'),
        repo.listEventos('pastoreo'),
        repo.listEventos('compra'),
        repo.listCampos(),
      ]);
      if (cancelado()) return;
      setData(evs as Paricion[]);
      setLluvias(lls as Lluvia[]);
      setMortandad(ms as Mortandad[]);
      setPastoreo(ps as Pastoreo[]);
      setCompras(cps as Compra[]);
      setCampos(cs);
      // Cargar todos los circuitos (un fetch por campo) — necesario para
      // mappear circuitoId → nombre en el chart "Movimientos por circuito".
      const allCircs = await Promise.all(cs.map(c => repo.listCircuitos(c.id)));
      if (cancelado()) return;
      const map: Record<string, { nombre: string; campoId: string; hectareas: number }> = {};
      allCircs.flat().forEach(c => {
        map[c.id] = { nombre: c.nombre, campoId: c.campoId, hectareas: c.hectareas };
      });
      setCircuitosMap(map);
    } finally {
      if (!cancelado()) setLoading(false);
    }
  }, [repo]);

  // Cargar al entrar al tab y al montarse.
  useEffect(() => {
    if (currentTab !== 'metricas') return;
    let cancelado = false;
    load(() => cancelado);
    return () => { cancelado = true; };
  }, [currentTab, load]);

  // Scope por rol (operario solo ve lo suyo).
  const scoped = useMemo(() => {
    if (!esAdmin && user?.email) return data.filter(p => p.usuarioEmail === user.email);
    return data;
  }, [data, esAdmin, user]);

  // Aplicar rango.
  const filtered = useMemo(() => {
    const desde = rangoDesde(rango);
    if (!desde) return scoped;
    return scoped.filter(p => p.fecha >= desde);
  }, [scoped, rango]);

  // Scope + rango para lluvias (mismo criterio que pariciones).
  const scopedLluvias = useMemo(() => {
    if (!esAdmin && user?.email) return lluvias.filter(l => l.usuarioEmail === user.email);
    return lluvias;
  }, [lluvias, esAdmin, user]);

  const filteredLluviasRango = useMemo(() => {
    const desde = rangoDesde(rango);
    if (!desde) return scopedLluvias;
    return scopedLluvias.filter(l => l.fecha >= desde);
  }, [scopedLluvias, rango]);

  // Filtro adicional del sub-tab Lluvias: por campo (chips wrap).
  // Decisión: por simplicidad mantenemos UI común (chips) con pastoreoCircuito,
  // pero el state es independiente.
  const [lluviasCampo, setLluviasCampo] = useState<string | null>(null); // null = todos

  const filteredLluvias = useMemo(() => {
    if (!lluviasCampo) return filteredLluviasRango;
    return filteredLluviasRango.filter(l => l.campoId === lluviasCampo);
  }, [filteredLluviasRango, lluviasCampo]);

  // Campos disponibles para el chip-row de lluvias: los que aparecen en el
  // rango filtrado (sin aplicar el filtro de campo en sí, para no quedarnos
  // sin opciones después de elegir uno).
  const camposDisponiblesLluvias = useMemo(() => {
    const ids = Array.from(new Set(filteredLluviasRango.map(l => l.campoId)));
    return ids
      .map(id => campos.find(c => c.id === id))
      .filter((c): c is Campo => Boolean(c))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [filteredLluviasRango, campos]);

  // PROMEDIO entre pluviómetros por (campo, fecha).
  //
  // Cliente final: un campo puede tener varios pluviómetros (3+) y cae lluvia
  // DISTINTA en cada uno. Sumar todas las lecturas como hacíamos antes triple-
  // contaba la misma lluvia. Acá colapsamos a un valor por (campo, día):
  // el PROMEDIO entre todos los pluviómetros que reportaron ese día en ese
  // campo. Es una aproximación razonable de "qué llovió en el campo" cuando
  // no tenemos un "pluviómetro principal" marcado.
  //
  // Futuro: agregar un flag `es_principal` en pluviometros y, si está
  // seteado, usar ese único valor en vez del promedio. Por ahora, promedio.
  const lluviaPorCampoFecha = useMemo(() => {
    // bucket: campoId|fecha → [mm, mm, ...]
    const buckets = new Map<string, number[]>();
    filteredLluvias.forEach(l => {
      if (!Number.isFinite(l.milimetros)) return;
      const key = `${l.campoId}|${l.fecha}`;
      const arr = buckets.get(key) ?? [];
      arr.push(l.milimetros);
      buckets.set(key, arr);
    });
    const out: Array<{ campoId: string; fecha: string; mm: number }> = [];
    buckets.forEach((mms, key) => {
      const [campoId, fecha] = key.split('|');
      if (!campoId || !fecha) return;
      const avg = mms.reduce((s, n) => s + n, 0) / mms.length;
      out.push({ campoId, fecha, mm: avg });
    });
    return out;
  }, [filteredLluvias]);

  // Scope + rango para mortandad.
  const scopedMortandad = useMemo(() => {
    if (!esAdmin && user?.email) return mortandad.filter(m => m.usuarioEmail === user.email);
    return mortandad;
  }, [mortandad, esAdmin, user]);

  const filteredMortandad = useMemo(() => {
    const desde = rangoDesde(rango);
    if (!desde) return scopedMortandad;
    return scopedMortandad.filter(m => m.fecha >= desde);
  }, [scopedMortandad, rango]);

  // Scope + rango para pastoreo.
  const scopedPastoreo = useMemo(() => {
    if (!esAdmin && user?.email) return pastoreo.filter(p => p.usuarioEmail === user.email);
    return pastoreo;
  }, [pastoreo, esAdmin, user]);

  const filteredPastoreoRango = useMemo(() => {
    const desde = rangoDesde(rango);
    if (!desde) return scopedPastoreo;
    return scopedPastoreo.filter(p => p.fecha >= desde);
  }, [scopedPastoreo, rango]);

  // Filtros específicos del sub-tab Pastoreo (feedback Ro):
  //  - Estado abiertos/cerrados/todos: idéntico al de PastoreoListScreen.
  //    Por defecto "todos" para que el resumen muestre toda la actividad.
  //  - Circuito: chip "Todos" + uno por cada circuito que tenga al menos
  //    1 movimiento en el rango. Sin scroll horizontal (chips wrap).
  //
  // Los filtros se ocultan visualmente cuando el sub-tab NO es pastoreo,
  // pero el state vive en el screen — al volver a pastoreo recuperás
  // tu filtro elegido (no se resetea).
  const [pastoreoEstado, setPastoreoEstado] = useState<'abiertos' | 'cerrados' | 'todos'>('todos');
  const [pastoreoCircuito, setPastoreoCircuito] = useState<string | null>(null); // null = todos

  const filteredPastoreo = useMemo(() => {
    let out = filteredPastoreoRango;
    if (pastoreoEstado === 'abiertos') out = out.filter(p => !p.fechaSalida);
    else if (pastoreoEstado === 'cerrados') out = out.filter(p => !!p.fechaSalida);
    if (pastoreoCircuito) out = out.filter(p => p.circuitoId === pastoreoCircuito);
    return out;
  }, [filteredPastoreoRango, pastoreoEstado, pastoreoCircuito]);

  // Lista de circuitos disponibles para el chip-row: los que aparecen en el
  // pastoreo del rango (no en pastoreoEstado/circuito filtrados — sino el
  // filtro de circuito se auto-cerraría al elegir "abiertos" si no hay
  // abiertos en el circuito seleccionado). Tomamos del rango + estado.
  const circuitosDisponibles = useMemo(() => {
    const base = pastoreoEstado === 'abiertos'
      ? filteredPastoreoRango.filter(p => !p.fechaSalida)
      : pastoreoEstado === 'cerrados'
        ? filteredPastoreoRango.filter(p => !!p.fechaSalida)
        : filteredPastoreoRango;
    const ids = Array.from(new Set(base.map(p => p.circuitoId).filter(Boolean))) as string[];
    return ids
      .map(id => {
        const meta = circuitosMap[id];
        const campoNombre = meta ? (campos.find(c => c.id === meta.campoId)?.nombre ?? '') : '';
        return { id, nombre: meta?.nombre ?? id, campoNombre };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [filteredPastoreoRango, pastoreoEstado, circuitosMap, campos]);

  // ---------- 1. Eventos por campo ----------
  const eventosPorCampo = useMemo(() => {
    const counts = new Map<string, number>();
    filtered.forEach(p => counts.set(p.campoId, (counts.get(p.campoId) ?? 0) + 1));
    return campos
      .map(c => ({ campo: c, count: counts.get(c.id) ?? 0 }))
      .filter(r => r.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [filtered, campos]);

  const maxEventosCampo = useMemo(
    () => eventosPorCampo.reduce((m, r) => Math.max(m, r.count), 0),
    [eventosPorCampo],
  );

  // ---------- 2. Eventos totales por tipo ----------
  const eventosPorTipo = useMemo(() => {
    const counts = new Map<EventoParicion, number>();
    filtered.forEach(p => {
      counts.set(p.evento, (counts.get(p.evento) ?? 0) + 1);
    });
    return EVENTO_ORDEN.map(e => ({ evento: e, count: counts.get(e) ?? 0 }));
  }, [filtered]);

  const maxEventosTipo = useMemo(
    () => eventosPorTipo.reduce((m, r) => Math.max(m, r.count), 0),
    [eventosPorTipo],
  );

  // ---------- 3. Vacas por parir ----------
  // Por campo = stockInicial - nacimientos (no otros eventos).
  // Usamos scope sin filtro de fecha porque la temporada es acumulativa,
  // no depende del "Hoy/7d/30d" que es para la actividad reciente.
  const vacasPorParir = useMemo(() => {
    const nacimientosPorCampo = new Map<string, number>();
    scoped.forEach(p => {
      if (p.evento !== 'Nacimiento') return;
      nacimientosPorCampo.set(p.campoId, (nacimientosPorCampo.get(p.campoId) ?? 0) + 1);
    });
    return campos
      .map(c => {
        const stock = c.stockInicialVacas ?? 0;
        const paridas = nacimientosPorCampo.get(c.id) ?? 0;
        const restan = Math.max(0, stock - paridas);
        return { campo: c, stock, paridas, restan };
      })
      .filter(r => r.stock > 0)
      .sort((a, b) => b.restan - a.restan);
  }, [scoped, campos]);

  const maxRestan = useMemo(
    () => vacasPorParir.reduce((m, r) => Math.max(m, r.restan), 0),
    [vacasPorParir],
  );

  // ---------- 4. Terneros en pie ----------
  // Aproximación: paridas - muertes de terneros (eventos Muerte).
  const ternerosEnPie = useMemo(() => {
    const paridasPorCampo = new Map<string, number>();
    const muertesPorCampo = new Map<string, number>();
    scoped.forEach(p => {
      if (p.evento === 'Nacimiento') {
        paridasPorCampo.set(p.campoId, (paridasPorCampo.get(p.campoId) ?? 0) + 1);
      } else if (p.evento === 'Muerte') {
        muertesPorCampo.set(p.campoId, (muertesPorCampo.get(p.campoId) ?? 0) + 1);
      }
    });
    return campos
      .map(c => {
        const stock = c.stockInicialVacas ?? 0;
        const paridas = paridasPorCampo.get(c.id) ?? 0;
        const muertes = muertesPorCampo.get(c.id) ?? 0;
        const enPie = Math.max(0, paridas - muertes);
        return { campo: c, stock, paridas, muertes, enPie };
      })
      .filter(r => r.stock > 0 || r.paridas > 0);
  }, [scoped, campos]);

  // ---------- 5. Lluvias por campo ----------
  // mm acumulados por establecimiento dentro del rango filtrado.
  // Usamos lluviaPorCampoFecha (promedio entre pluviómetros) en vez de
  // sumar lecturas crudas — sino un campo con 3 pluvs se vería 3x más
  // lluvioso de lo que realmente es.
  const lluviasPorCampo = useMemo(() => {
    const mmPorCampo = new Map<string, number>();
    lluviaPorCampoFecha.forEach(r => {
      mmPorCampo.set(r.campoId, (mmPorCampo.get(r.campoId) ?? 0) + r.mm);
    });
    return campos
      .map(c => ({ campo: c, mm: Math.round(mmPorCampo.get(c.id) ?? 0) }))
      .filter(r => r.mm > 0)
      .sort((a, b) => b.mm - a.mm);
  }, [lluviaPorCampoFecha, campos]);

  const maxMMCampo = useMemo(
    () => lluviasPorCampo.reduce((m, r) => Math.max(m, r.mm), 0),
    [lluviasPorCampo],
  );

  // ---------- 6. Lluvias por mes ----------
  // Serie temporal agrupada por YYYY-MM del campo `fecha`. Siempre ordenada
  // cronológica (más viejo arriba), muestra últimos 12 meses disponibles.
  // Suma de los promedios diarios por campo (no de lecturas crudas).
  const lluviasPorMes = useMemo(() => {
    const mmPorMes = new Map<string, number>();
    lluviaPorCampoFecha.forEach(r => {
      const key = r.fecha.slice(0, 7); // YYYY-MM
      mmPorMes.set(key, (mmPorMes.get(key) ?? 0) + r.mm);
    });
    const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return Array.from(mmPorMes.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([key, mm]) => {
        const parts = key.split('-');
        const y = parts[0] ?? '';
        const m = parts[1] ?? '01';
        const mesIdx = Math.max(0, Math.min(11, parseInt(m, 10) - 1));
        const label = `${MESES[mesIdx]} ${y.slice(2)}`;
        return { key, label, mm: Math.round(mm) };
      });
  }, [lluviaPorCampoFecha]);

  const maxMMMes = useMemo(
    () => lluviasPorMes.reduce((m, r) => Math.max(m, r.mm), 0),
    [lluviasPorMes],
  );

  // ---------- 6.b Lluvias por fecha (feedback Ro) ----------
  // Serie temporal por día — alimenta tanto la lista de bullets como el
  // line chart "mm por día". mm = suma de los promedios entre pluviómetros
  // de cada campo que reportó ese día (= cero double-counting).
  // Orden ASC para el line chart (eje X izquierda→derecha = más viejo→más
  // nuevo); la lista detallada hace su propio reverse para mostrar más
  // reciente arriba.
  const lluviasPorFechaAsc = useMemo(() => {
    const mmPorDia = new Map<string, number>();
    lluviaPorCampoFecha.forEach(r => {
      mmPorDia.set(r.fecha, (mmPorDia.get(r.fecha) ?? 0) + r.mm);
    });
    const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return Array.from(mmPorDia.entries())
      .sort(([a], [b]) => a.localeCompare(b)) // ASC para line chart
      .map(([fecha, mm]) => {
        const [yy, mmStr, dd] = fecha.split('-').map(Number);
        let label = fecha;
        let labelShort = fecha;
        if (yy && mmStr && dd) {
          const dt = new Date(yy, mmStr - 1, dd);
          label = `${DOW[dt.getDay()]} ${String(dd).padStart(2, '0')}/${String(mmStr).padStart(2, '0')}`;
          labelShort = `${String(dd).padStart(2, '0')}/${String(mmStr).padStart(2, '0')}`;
        }
        return { fecha, label, labelShort, mm: Math.round(mm) };
      });
  }, [lluviaPorCampoFecha]);

  // Lista detallada (más reciente arriba, top 30 días) — alimenta el
  // resumen de bullets que ya teníamos antes del line chart.
  const lluviasPorFecha = useMemo(
    () => [...lluviasPorFechaAsc].reverse().slice(0, 30),
    [lluviasPorFechaAsc],
  );

  const maxMMDia = useMemo(
    () => lluviasPorFecha.reduce((m, r) => Math.max(m, r.mm), 0),
    [lluviasPorFecha],
  );

  const totalEventos = filtered.length;
  const totalNacimientos = eventosPorTipo.find(e => e.evento === 'Nacimiento')?.count ?? 0;
  const totalMuertes = eventosPorTipo.find(e => e.evento === 'Muerte')?.count ?? 0;
  // totalMM = suma de promedios diarios por campo (no de lecturas crudas).
  // Si el cliente tiene N campos y M pluviómetros, ese número refleja la
  // lluvia REAL recibida, no inflada por la cantidad de pluviómetros.
  const totalMM = useMemo(
    () => Math.round(lluviaPorCampoFecha.reduce((acc, r) => acc + r.mm, 0)),
    [lluviaPorCampoFecha],
  );

  // ---------- 7. Mortandad por campo ----------
  const mortandadPorCampo = useMemo(() => {
    const counts = new Map<string, number>();
    filteredMortandad.forEach(m => counts.set(m.campoId, (counts.get(m.campoId) ?? 0) + 1));
    return campos
      .map(c => ({ campo: c, count: counts.get(c.id) ?? 0 }))
      .filter(r => r.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [filteredMortandad, campos]);

  const maxMortandadCampo = useMemo(
    () => mortandadPorCampo.reduce((m, r) => Math.max(m, r.count), 0),
    [mortandadPorCampo],
  );

  // ---------- 8. Mortandad por categoría ----------
  // Mortandad.categoria ahora es string libre (catálogo MORT_CATEGORIA real:
  // Vc Preñ, TernM, TernH, etc.) — agregamos dinámicamente en lugar de usar
  // el enum chico de antes.
  const mortandadPorCategoria = useMemo(() => {
    const counts = new Map<string, number>();
    filteredMortandad.forEach(m => {
      const cat = m.categoria || 'Sin categoría';
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([categoria, count]) => ({ categoria, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredMortandad]);

  const maxMortandadCategoria = useMemo(
    () => mortandadPorCategoria.reduce((m, r) => Math.max(m, r.count), 0),
    [mortandadPorCategoria],
  );

  // ---------- 9. Mortandad por causa ----------
  const mortandadPorCausa = useMemo(() => {
    const counts = new Map<CausaMuerteTipo | 'Sin especificar', number>();
    filteredMortandad.forEach(m => {
      const key = m.causaTipo ?? 'Sin especificar';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return CAUSA_ORDEN.map(c => ({ causa: c, count: counts.get(c) ?? 0 })).filter(r => r.count > 0);
  }, [filteredMortandad]);

  const maxMortandadCausa = useMemo(
    () => mortandadPorCausa.reduce((m, r) => Math.max(m, r.count), 0),
    [mortandadPorCausa],
  );

  // Categoría más afectada — para KPI tile.
  const categoriaTop = useMemo(() => {
    const top = [...mortandadPorCategoria].sort((a, b) => b.count - a.count)[0];
    if (!top || top.count === 0) return null;
    return top;
  }, [mortandadPorCategoria]);

  // ---------- 10. Movimientos de pastoreo por campo ----------
  const movimientosPorCampo = useMemo(() => {
    const counts = new Map<string, number>();
    filteredPastoreo.forEach(p => counts.set(p.campoId, (counts.get(p.campoId) ?? 0) + 1));
    return campos
      .map(c => ({ campo: c, count: counts.get(c.id) ?? 0 }))
      .filter(r => r.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [filteredPastoreo, campos]);

  const maxMovimientosCampo = useMemo(
    () => movimientosPorCampo.reduce((m, r) => Math.max(m, r.count), 0),
    [movimientosPorCampo],
  );

  // ---------- Pastoreo por circuito ----------
  // Drill por Campo → Circuito → Fecha (feedback Ro). Listamos circuitos con
  // sus movimientos, ordenados de más a menos. Si campoFiltro está activo,
  // sería filtrar por campo — por ahora mostramos todos pero anotamos el
  // campo del circuito en el label para distinguir circuitos con mismo nombre.
  const pastoreoPorCircuito = useMemo(() => {
    const counts = new Map<string, { circuitoId: string; nombre: string; campoNombre: string; hectareas: number; count: number; abiertos: number }>();
    filteredPastoreo.forEach(p => {
      const cid = p.circuitoId;
      if (!cid) return;
      const meta = circuitosMap[cid];
      const campoNombre = meta ? (campos.find(c => c.id === meta.campoId)?.nombre ?? '') : '';
      const entry = counts.get(cid) ?? {
        circuitoId: cid,
        nombre: meta?.nombre ?? cid,
        campoNombre,
        hectareas: meta?.hectareas ?? 0,
        count: 0,
        abiertos: 0,
      };
      entry.count += 1;
      if (!p.fechaSalida) entry.abiertos += 1;
      counts.set(cid, entry);
    });
    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 12); // top 12 para que el chart no sea kilométrico
  }, [filteredPastoreo, circuitosMap, campos]);

  const maxPastoreoCircuito = useMemo(
    () => pastoreoPorCircuito.reduce((m, r) => Math.max(m, r.count), 0),
    [pastoreoPorCircuito],
  );

  // ---------- 11. Pastoreo por categoría ----------
  // Pastoreo.categoria es string libre del catálogo PAST_CATEGORIA
  // (Novillito Grande, Vaquilla Meses, etc.). Agregamos dinámicamente.
  const pastoreoPorCategoria = useMemo(() => {
    const counts = new Map<string, number>();
    filteredPastoreo.forEach(p => {
      const cat = p.categoria || 'Sin categoría';
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([categoria, count]) => ({ categoria, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredPastoreo]);

  const maxPastoreoCategoria = useMemo(
    () => pastoreoPorCategoria.reduce((m, r) => Math.max(m, r.count), 0),
    [pastoreoPorCategoria],
  );

  // ====== COMPRAS ======
  // Scope + rango paralelos a los otros módulos.
  const scopedCompras = useMemo(() => {
    if (!esAdmin && user?.email) return compras.filter(c => c.usuarioEmail === user.email);
    return compras;
  }, [compras, esAdmin, user]);

  const filteredCompras = useMemo(() => {
    const desde = rangoDesde(rango);
    if (!desde) return scopedCompras;
    return scopedCompras.filter(c => c.fecha >= desde);
  }, [scopedCompras, rango]);

  // Aggregations: por campo (count + kg destino total).
  // El campo "inversión" (precio × kg) se removió a pedido del cliente —
  // expone precios sensibles a usuarios fuera del equipo comercial.
  const comprasPorCampo = useMemo(() => {
    const map = new Map<string, { campoId: string; count: number; kgDestino: number }>();
    filteredCompras.forEach(c => {
      const entry = map.get(c.campoId) ?? { campoId: c.campoId, count: 0, kgDestino: 0 };
      entry.count++;
      // kgNetosDestino es nullable post mig 0021 — compras "en tránsito"
      // sin pesaje destino no suman a totales (no son data real).
      const kgDest = c.kgNetosDestino != null && Number.isFinite(c.kgNetosDestino) ? c.kgNetosDestino : 0;
      entry.kgDestino += kgDest;
      map.set(c.campoId, entry);
    });
    return campos
      .map(cmp => {
        const e = map.get(cmp.id);
        return e ? { campo: cmp, count: e.count, kgDestino: Math.round(e.kgDestino) } : null;
      })
      .filter((r): r is { campo: Campo; count: number; kgDestino: number } => Boolean(r))
      .sort((a, b) => b.count - a.count);
  }, [filteredCompras, campos]);

  const maxComprasCount = useMemo(
    () => comprasPorCampo.reduce((m, r) => Math.max(m, r.count), 0),
    [comprasPorCampo],
  );
  const maxComprasKg = useMemo(
    () => comprasPorCampo.reduce((m, r) => Math.max(m, r.kgDestino), 0),
    [comprasPorCampo],
  );

  // KPIs globales del sub-tab Compras.
  const totalCompras = filteredCompras.length;
  const totalKgCompras = useMemo(
    () => Math.round(filteredCompras.reduce(
      (acc, c) => acc + (c.kgNetosDestino != null && Number.isFinite(c.kgNetosDestino) ? c.kgNetosDestino : 0),
      0,
    )),
    [filteredCompras],
  );
  // Reemplazo del antiguo `totalInversion` — % machos / hembras del rango
  // filtrado. Usa las columnas totalMachos/totalHembras (mig 0017) y cae
  // a parsear cantCabYCat cuando no están.
  const composicionMH = useMemo(() => {
    let machos = 0, hembras = 0;
    filteredCompras.forEach(c => {
      const tm = c.totalMachos ?? 0;
      const th = c.totalHembras ?? 0;
      if (tm > 0 || th > 0) {
        machos += tm;
        hembras += th;
      } else {
        // Fallback al texto libre — "83 machos · 27 hembras"
        const txt = c.cantCabYCat ?? '';
        const matchM = txt.match(/(\d+)\s*macho/i);
        const matchH = txt.match(/(\d+)\s*hembra/i);
        if (matchM?.[1]) machos += parseInt(matchM[1], 10) || 0;
        if (matchH?.[1]) hembras += parseInt(matchH[1], 10) || 0;
      }
    });
    const total = machos + hembras;
    return {
      machos, hembras, total,
      pctMachos:  total > 0 ? Math.round((machos / total) * 100) : 0,
      pctHembras: total > 0 ? Math.round((hembras / total) * 100) : 0,
    };
  }, [filteredCompras]);
  // Estimación gruesa de cabezas compradas — parseamos cantCabYCat buscando
  // números enteros y los sumamos. "83 machos. 27 hembras" → 110.
  const totalCabezasEstimadas = useMemo(() => {
    let total = 0;
    filteredCompras.forEach(c => {
      const txt = c.cantCabYCat ?? '';
      const matches = txt.match(/\d+/g);
      if (matches) {
        matches.forEach(n => { total += parseInt(n, 10) || 0; });
      }
    });
    return total;
  }, [filteredCompras]);

  const totalMortandad = filteredMortandad.length;
  const totalMovimientos = filteredPastoreo.length;
  // Animales "abiertos" = todavía en el lote (sin fechaSalida). Es el número
  // operativamente más útil del módulo: dice cuántos animales hay activamente
  // en lotes ahora mismo.
  const totalAbiertos = useMemo(
    () => filteredPastoreo.filter(p => !p.fechaSalida).length,
    [filteredPastoreo],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hTitle}>Métricas</Text>
          <Text style={styles.hSub}>
            {esAdmin ? 'Resumen del cliente' : 'Tus registros'}
          </Text>
        </View>
        <View style={styles.headerStatWrap}>
          <Text style={styles.headerStat}>
            {headerStatValue(metricaTab, {
              totalEventos,
              totalMM,
              totalMortandad,
              totalMovimientos,
              totalCompras,
              // En Resumen sumamos los conteos crudos de cada módulo (no los
              // KPIs de "mm" o equivalentes que son magnitudes distintas).
              totalLluvias: filteredLluvias.length,
            })}
          </Text>
          <Text style={styles.headerStatLbl}>
            {headerStatLabel(metricaTab)}
          </Text>
        </View>
      </View>

      {/* Sub-tab: qué módulo estás viendo.
          Antes era ScrollView horizontal — pero al tener "Pariciones" y
          "Mortandad" largos, los chips se solapaban con la posición de scroll
          y "Resumen" quedaba cortado a "men" en el borde izquierdo.
          Pasamos a un row flex:1 con padding tight y font 13: los 5 chips
          siempre se ven completos en cualquier iPhone (incluso SE/Mini),
          sin scroll. shrink + numberOfLines + adjustsFontSizeToFit blindan
          el caso de un device extra-angosto o usuario con accessibility
          font scale alto. */}
      {/* Sub-tabs en 2 filas (feedback Ro):
            Fila 1: "Resumen" full-width — es la vista por default y la más
                    importante (resumen ejecutivo), merece su propia fila.
            Fila 2: los 5 módulos (Pariciones / Lluvias / Mortandad /
                    Pastoreo / Compras) reparten el ancho parejo.
          Esta separación da:
            (a) más ancho a cada chip de módulo (era apretado con 6 chips)
            (b) jerarquía visual: Resumen es "primero entre iguales"
            (c) píldoras más grandes / legibles */}
      <View style={styles.subTabBarCol}>
        <Pressable
          onPress={() => setMetricaTab('resumen')}
          style={[styles.subTabBig, metricaTab === 'resumen' && styles.subTabBigSel]}
          hitSlop={6}
        >
          <Text
            style={[styles.subTabBigTxt, metricaTab === 'resumen' && styles.subTabBigTxtSel]}
          >
            {METRICA_LABEL.resumen}
          </Text>
        </Pressable>
        <View style={styles.subTabModuleRow}>
          {METRICA_TABS.filter(t => t !== 'resumen').map(t => (
            <Pressable
              key={t}
              onPress={() => setMetricaTab(t)}
              style={[styles.subTab, metricaTab === t && styles.subTabSel]}
              hitSlop={6}
            >
              <Text
                style={[styles.subTabTxt, metricaTab === t && styles.subTabTxtSel]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {METRICA_LABEL[t]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Filtro rango — row sin scroll, 4 chips caben cómodos en iPhone.
          Evitamos horizontal ScrollView que cortaba visualmente los chips
          en iPhone 15 Pro (bug reportado por Ro). */}
      <View style={styles.filterBar}>
        {(['hoy', '7d', '30d', 'todo'] as Rango[]).map(r => (
          <Pressable
            key={r}
            onPress={() => setRango(r)}
            style={[styles.fChip, rango === r && styles.fChipSel]}
            hitSlop={6}
          >
            <Text style={[styles.fChipTxt, rango === r && styles.fChipTxtSel]}>
              {RANGO_LABEL[r]}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.navy} />
        }
      >
        {/* ============ RESUMEN ============ */}
        {metricaTab === 'resumen' && (
          <>
            {/* KPI tiles — mix de los 4 módulos. 2 filas de 2 para que entren
                cómodas en iPhone sin que las cifras grandes se corten. */}
            <View style={styles.kpiRow}>
              <Kpi value={totalNacimientos} label="NACIMIENTOS" color={colors.orange} />
              <Kpi value={totalMM} label="MM LLUVIA" color={LLUVIAS_ACCENT} />
            </View>
            <View style={styles.kpiRow}>
              <Kpi value={totalMortandad} label="MUERTES" color={MORTANDAD_ACCENT} />
              {/* En el nuevo modelo "stay log" no existe cabezas movidas;
                  el conteo natural es animales con pastoreo abierto AHORA
                  (todavía en un lote). Es lo más operativamente útil. */}
              <Kpi value={totalAbiertos} label="EN LOTE AHORA" color={PASTOREO_ACCENT} />
            </View>

            {/* Card Pariciones — preview con top 3 campos + CTA */}
            <SummaryCard
              title="Pariciones"
              stat={totalEventos}
              statLabel={totalEventos === 1 ? 'evento' : 'eventos'}
              accent={colors.navy}
              rows={eventosPorCampo.slice(0, 3).map(r => ({
                label: r.campo.nombre,
                value: r.count,
                max: maxEventosCampo,
                valueLabel: String(r.count),
              }))}
              empty={eventosPorCampo.length === 0 ? 'Sin eventos en el rango' : undefined}
              ctaLabel="Ver detalle de pariciones →"
              onCta={() => setMetricaTab('pariciones')}
            />

            {/* Card Lluvias — preview con top 3 campos + CTA */}
            <SummaryCard
              title="Lluvias"
              stat={totalMM}
              statLabel="mm"
              accent={LLUVIAS_ACCENT}
              rows={lluviasPorCampo.slice(0, 3).map(r => ({
                label: r.campo.nombre,
                value: r.mm,
                max: maxMMCampo,
                valueLabel: `${r.mm} mm`,
              }))}
              empty={lluviasPorCampo.length === 0 ? 'Sin registros en el rango' : undefined}
              ctaLabel="Ver detalle de lluvias →"
              onCta={() => setMetricaTab('lluvias')}
            />

            {/* Card Mortandad — top 3 campos con más muertes */}
            <SummaryCard
              title="Mortandad"
              stat={totalMortandad}
              statLabel={totalMortandad === 1 ? 'muerte' : 'muertes'}
              accent={MORTANDAD_ACCENT}
              rows={mortandadPorCampo.slice(0, 3).map(r => ({
                label: r.campo.nombre,
                value: r.count,
                max: maxMortandadCampo,
                valueLabel: String(r.count),
              }))}
              empty={mortandadPorCampo.length === 0 ? 'Sin registros en el rango' : undefined}
              ctaLabel="Ver detalle de mortandad →"
              onCta={() => setMetricaTab('mortandad')}
            />

            {/* Card Pastoreo — top 3 campos por cantidad de movimientos.
                En el nuevo modelo cada registro = un animal entrando a un lote,
                así que el conteo natural es "movimientos" (registros). */}
            <SummaryCard
              title="Pastoreo"
              stat={totalMovimientos}
              statLabel={totalMovimientos === 1 ? 'movimiento' : 'movimientos'}
              accent={PASTOREO_ACCENT}
              rows={movimientosPorCampo.slice(0, 3).map(r => ({
                label: r.campo.nombre,
                value: r.count,
                max: maxMovimientosCampo,
                valueLabel: String(r.count),
              }))}
              empty={movimientosPorCampo.length === 0 ? 'Sin movimientos en el rango' : undefined}
              ctaLabel="Ver detalle de pastoreo →"
              onCta={() => setMetricaTab('pastoreo')}
            />

            {/* Card Compras — top 3 campos por cantidad de compras registradas. */}
            <SummaryCard
              title="Compras"
              stat={totalCompras}
              statLabel={totalCompras === 1 ? 'compra' : 'compras'}
              accent={COMPRAS_ACCENT}
              rows={comprasPorCampo.slice(0, 3).map(r => ({
                label: r.campo.nombre,
                value: r.count,
                max: maxComprasCount,
                valueLabel: String(r.count),
              }))}
              empty={comprasPorCampo.length === 0 ? 'Sin compras en el rango' : undefined}
              ctaLabel="Ver detalle de compras →"
              onCta={() => setMetricaTab('compras')}
            />
          </>
        )}

        {/* ============ PARICIONES ============ */}
        {metricaTab === 'pariciones' && (
          <>
            <View style={styles.kpiRow}>
              <Kpi value={totalNacimientos} label="NACIMIENTOS" color={colors.orange} />
              <Kpi value={totalMuertes} label="MUERTES" color={colors.danger} />
            </View>

            {/* 1. Eventos por campo
                Subtítulo estable: "Por establecimiento" describe qué se está
                viendo en vez de un conteo que cuando es 0 se duplica con el
                Empty body. */}
            <Section title="Eventos por campo" subtitle="Por establecimiento">
              {eventosPorCampo.length === 0 ? (
                <Empty msg="Sin eventos en el rango seleccionado" />
              ) : (
                <View style={styles.chartBody}>
                  {eventosPorCampo.map(r => (
                    <HBar
                      key={r.campo.id}
                      label={r.campo.nombre}
                      value={r.count}
                      max={maxEventosCampo}
                      color={colors.navy}
                    />
                  ))}
                </View>
              )}
            </Section>

            {/* 2. Eventos totales por tipo */}
            <Section title="Eventos totales" subtitle="Por tipo de evento">
              {totalEventos === 0 ? (
                <Empty msg="Sin eventos en el rango seleccionado" />
              ) : (
                <View style={styles.chartBody}>
                  {eventosPorTipo.map(r => (
                    <HBar
                      key={r.evento}
                      label={r.evento}
                      value={r.count}
                      max={maxEventosTipo}
                      color={EVENTO_COLOR[r.evento]}
                    />
                  ))}
                </View>
              )}
            </Section>

            {/* 3. Vacas por parir */}
            <Section
              title="Vacas por parir"
              subtitle="Stock inicial menos nacimientos"
              footer="Estimación. Editable desde admin cuando el panel esté habilitado."
            >
              {vacasPorParir.length === 0 ? (
                <Empty msg="Sin stock inicial configurado" />
              ) : (
                <View style={styles.chartBody}>
                  {vacasPorParir.map(r => (
                    <HBar
                      key={r.campo.id}
                      label={r.campo.nombre}
                      value={r.restan}
                      max={maxRestan}
                      color={colors.orange}
                      valueLabel={`${r.restan} / ${r.stock}`}
                    />
                  ))}
                </View>
              )}
            </Section>

            {/* 4. Terneros en pie */}
            <Section
              title="Terneros en pie"
              subtitle="Por campo"
              footer="Aproximado: nacimientos − muertes. El conteo real requiere el módulo Mortandad."
            >
              {ternerosEnPie.length === 0 ? (
                <Empty msg="Sin datos" />
              ) : (
                <View style={styles.table}>
                  <View style={[styles.tRow, styles.tHeadRow]}>
                    <Text style={[styles.tCellCampo, styles.tHeadCell]}>CAMPO</Text>
                    <Text style={[styles.tCellNum, styles.tHeadCell]}>STOCK</Text>
                    <Text style={[styles.tCellNum, styles.tHeadCell]}>PARIDAS</Text>
                    <Text style={[styles.tCellNum, styles.tHeadCell]}>EN PIE</Text>
                  </View>
                  {ternerosEnPie.map((r, i) => (
                    <View
                      key={r.campo.id}
                      style={[styles.tRow, i % 2 === 1 && styles.tRowAlt]}
                    >
                      <Text style={styles.tCellCampo} numberOfLines={1}>{r.campo.nombre}</Text>
                      <Text style={styles.tCellNum}>{r.stock || '—'}</Text>
                      <Text style={styles.tCellNum}>{r.paridas}</Text>
                      <Text style={[styles.tCellNum, styles.tCellStrong]}>{r.enPie}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Section>
          </>
        )}

        {/* ============ LLUVIAS ============ */}
        {metricaTab === 'lluvias' && (
          <>
            {/* Filtros de Lluvias (feedback Ro):
                  - Chips por campo (wrap, sin scroll). Filtra todos los charts.
                "Mientras menos escriban mejor" — todo a un tap. */}
            {camposDisponiblesLluvias.length > 1 && (
              <View style={styles.pasFilterCol}>
                <View style={styles.pasCircuitoWrap}>
                  <Pressable
                    onPress={() => setLluviasCampo(null)}
                    style={[styles.fChip, styles.pasChipSm, lluviasCampo === null && styles.fChipSel]}
                    hitSlop={4}
                  >
                    <Text style={[styles.fChipTxt, lluviasCampo === null && styles.fChipTxtSel]}>
                      Todos campos
                    </Text>
                  </Pressable>
                  {camposDisponiblesLluvias.map(c => {
                    const sel = lluviasCampo === c.id;
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => setLluviasCampo(c.id)}
                        style={[styles.fChip, styles.pasChipSm, sel && styles.fChipSel]}
                        hitSlop={4}
                      >
                        <Text style={[styles.fChipTxt, sel && styles.fChipTxtSel]} numberOfLines={1}>
                          {c.nombre}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={styles.kpiRow}>
              <Kpi value={totalMM} label="MM TOTALES" color="#1F4E6A" />
              <Kpi value={filteredLluvias.length} label="REGISTROS" color="#3E8AB4" />
              <Kpi value={lluviasPorCampo.length} label="CAMPOS" color={colors.navy} />
            </View>

            {/* Line chart de mm por día (eje X fecha, eje Y mm) — feedback
                cliente: necesitan ver la curva, no solo barras o lista.
                Construido con react-native Views (sin react-native-svg) —
                ver components/LineChart.tsx. */}
            <Section
              title={lluviasCampo ? `Lluvias en ${campos.find(c => c.id === lluviasCampo)?.nombre ?? '?'}` : 'Lluvias por fecha'}
              subtitle="mm por día — eje X: fecha, eje Y: mm"
              footer={lluviasCampo
                ? 'Promedio entre pluviómetros del campo seleccionado, por día.'
                : 'Suma de los promedios diarios de cada campo (cero double-counting).'}
            >
              {lluviasPorFechaAsc.length === 0 ? (
                <Empty msg="Sin lluvias cargadas" />
              ) : (
                <LineChart
                  points={lluviasPorFechaAsc.map(r => ({ x: r.labelShort, y: r.mm }))}
                  color="#1F4E6A"
                  yUnit="mm"
                  height={220}
                />
              )}
            </Section>

            {/* 5. Lluvias por campo — solo mostrar si NO hay filtro de campo
                activo (con uno solo selecccionado pierde sentido el ranking) */}
            {!lluviasCampo && (
              <Section
                title="Lluvias por campo"
                subtitle="Acumulado por establecimiento"
                footer="Promedio entre pluviómetros del campo, sumado en el rango."
              >
                {lluviasPorCampo.length === 0 ? (
                  <Empty msg="Sin lluvias cargadas" />
                ) : (
                  <View style={styles.chartBody}>
                    {lluviasPorCampo.map(r => (
                      <HBar
                        key={r.campo.id}
                        label={r.campo.nombre}
                        value={r.mm}
                        max={maxMMCampo}
                        color="#1F4E6A"
                        valueLabel={`${r.mm} mm`}
                      />
                    ))}
                  </View>
                )}
              </Section>
            )}

            {/* 6. Lluvias por mes */}
            <Section
              title="Lluvias por mes"
              subtitle="Serie temporal — últimos 12 meses con registros"
            >
              {lluviasPorMes.length === 0 ? (
                <Empty msg="Sin lluvias cargadas" />
              ) : (
                <View style={styles.chartBody}>
                  {lluviasPorMes.map(r => (
                    <HBar
                      key={r.key}
                      label={r.label}
                      value={r.mm}
                      max={maxMMMes}
                      color="#3E8AB4"
                      valueLabel={`${r.mm} mm`}
                    />
                  ))}
                </View>
              )}
            </Section>

            {/* 6.b Detalle día x día (texto + bar). Complementa el line chart
                de arriba — útil para ver los números exactos sin ojo de
                pixel. Más reciente arriba, top 30 días. */}
            <Section
              title="Detalle por día"
              subtitle="Lista de los últimos 30 días con registros"
            >
              {lluviasPorFecha.length === 0 ? (
                <Empty msg="Sin lluvias cargadas" />
              ) : (
                <View style={styles.chartBody}>
                  {lluviasPorFecha.map(r => (
                    <HBar
                      key={r.fecha}
                      label={r.label}
                      value={r.mm}
                      max={maxMMDia}
                      color="#65A5C8"
                      valueLabel={`${r.mm} mm`}
                    />
                  ))}
                </View>
              )}
            </Section>
          </>
        )}

        {/* ============ MORTANDAD ============ */}
        {metricaTab === 'mortandad' && (
          <>
            <View style={styles.kpiRow}>
              <Kpi value={totalMortandad} label="MUERTES" color={MORTANDAD_ACCENT} />
              <Kpi value={mortandadPorCampo.length} label="CAMPOS" color={colors.navy} />
              {/* Top categoría: cuando no hay datos, el label "TOP CATEG."
                  + value 0 era confuso. Pasamos un value > 0 solo si existe
                  una categoría líder; si no, dejamos que Kpi renderice "—". */}
              <Kpi
                value={categoriaTop?.count ?? 0}
                label={
                  categoriaTop
                    ? categoriaTop.categoria.toUpperCase()
                    : 'TOP CATEGORÍA'
                }
                color={colors.terracota}
              />
            </View>

            {/* 7. Mortandad por campo
                Subtítulo estable (no cambia con vacío): así no duplicamos
                el mensaje del Empty body. El subtítulo describe QUÉ hay,
                el Empty describe POR QUÉ está vacío. */}
            <Section
              title="Mortandad por campo"
              subtitle="Por establecimiento"
            >
              {mortandadPorCampo.length === 0 ? (
                <Empty msg="Sin registros en el rango seleccionado" />
              ) : (
                <View style={styles.chartBody}>
                  {mortandadPorCampo.map(r => (
                    <HBar
                      key={r.campo.id}
                      label={r.campo.nombre}
                      value={r.count}
                      max={maxMortandadCampo}
                      color={MORTANDAD_ACCENT}
                    />
                  ))}
                </View>
              )}
            </Section>

            {/* 8. Mortandad por categoría */}
            <Section title="Mortandad por categoría" subtitle="Por tipo de hacienda">
              {totalMortandad === 0 ? (
                <Empty msg="Sin registros en el rango seleccionado" />
              ) : (
                <View style={styles.chartBody}>
                  {mortandadPorCategoria.map(r => (
                    <HBar
                      key={r.categoria}
                      label={r.categoria}
                      value={r.count}
                      max={maxMortandadCategoria}
                      color={colors.terracota}
                    />
                  ))}
                </View>
              )}
            </Section>

            {/* 9. Mortandad por causa */}
            <Section
              title="Mortandad por causa"
              subtitle="Causa primaria registrada"
              footer="El detalle textual (síntomas, contexto) queda en el listado de mortandad."
            >
              {mortandadPorCausa.length === 0 ? (
                <Empty msg="Sin registros en el rango seleccionado" />
              ) : (
                <View style={styles.chartBody}>
                  {mortandadPorCausa.map(r => (
                    <HBar
                      key={r.causa}
                      label={r.causa}
                      value={r.count}
                      max={maxMortandadCausa}
                      color={colors.amber}
                    />
                  ))}
                </View>
              )}
            </Section>
          </>
        )}

        {/* ============ PASTOREO ============ */}
        {metricaTab === 'pastoreo' && (
          <>
            {/* Filtros específicos de Pastoreo (feedback Ro):
                  - Chips abiertos/cerrados/todos
                  - Chips de circuito (wrap, no scroll horizontal)
                "Mientras menos escriban mejor" — todo a un tap. */}
            <View style={styles.pasFilterCol}>
              {/* Fila 1: estado */}
              <View style={styles.pasFilterRow}>
                {(['abiertos', 'cerrados', 'todos'] as const).map(e => (
                  <Pressable
                    key={e}
                    onPress={() => setPastoreoEstado(e)}
                    style={[styles.fChip, styles.pasChipEq, pastoreoEstado === e && styles.fChipSel]}
                    hitSlop={6}
                  >
                    <Text style={[styles.fChipTxt, pastoreoEstado === e && styles.fChipTxtSel]}>
                      {e === 'abiertos' ? 'Abiertos' : e === 'cerrados' ? 'Cerrados' : 'Todos'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Fila 2: circuito (wrap) — solo si hay más de uno disponible */}
              {circuitosDisponibles.length > 1 && (
                <View style={styles.pasCircuitoWrap}>
                  <Pressable
                    onPress={() => setPastoreoCircuito(null)}
                    style={[styles.fChip, styles.pasChipSm, pastoreoCircuito === null && styles.fChipSel]}
                    hitSlop={4}
                  >
                    <Text style={[styles.fChipTxt, pastoreoCircuito === null && styles.fChipTxtSel]}>
                      Todos circuitos
                    </Text>
                  </Pressable>
                  {circuitosDisponibles.map(c => {
                    const sel = pastoreoCircuito === c.id;
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => setPastoreoCircuito(c.id)}
                        style={[styles.fChip, styles.pasChipSm, sel && styles.fChipSel]}
                        hitSlop={4}
                      >
                        <Text
                          style={[styles.fChipTxt, sel && styles.fChipTxtSel]}
                          numberOfLines={1}
                        >
                          {c.campoNombre ? `${c.nombre} · ${c.campoNombre}` : c.nombre}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={styles.kpiRow}>
              <Kpi value={totalMovimientos} label="MOVIMIENTOS" color={PASTOREO_ACCENT} />
              <Kpi value={totalAbiertos} label="EN LOTE AHORA" color={colors.navy} />
              <Kpi value={movimientosPorCampo.length} label="CAMPOS" color={colors.terracota} />
            </View>

            {/* 10. Movimientos por campo */}
            <Section
              title="Movimientos por campo"
              subtitle="Por establecimiento"
            >
              {movimientosPorCampo.length === 0 ? (
                <Empty msg="Sin registros en el rango seleccionado" />
              ) : (
                <View style={styles.chartBody}>
                  {movimientosPorCampo.map(r => (
                    <HBar
                      key={r.campo.id}
                      label={r.campo.nombre}
                      value={r.count}
                      max={maxMovimientosCampo}
                      color={PASTOREO_ACCENT}
                    />
                  ))}
                </View>
              )}
            </Section>

            {/* Drill por circuito (Campo → Circuito → Fecha).
                Top 12 circuitos con más movimientos en el rango. El label
                muestra "Circuito · Campo" porque distintos campos pueden
                tener nombres de circuito iguales (ej: "5" en Agisot vs "5"
                en otro campo).
                valueLabel incluye registros y abiertos: "10 (3 abiertos)". */}
            <Section
              title="Movimientos por circuito"
              subtitle="Top 12 circuitos por actividad"
              footer="Tappear el listado de Pastoreo para ver el detalle por circuito."
            >
              {pastoreoPorCircuito.length === 0 ? (
                <Empty msg="Sin registros en el rango seleccionado" />
              ) : (
                <View style={styles.chartBody}>
                  {pastoreoPorCircuito.map(r => (
                    <HBar
                      key={r.circuitoId}
                      label={r.campoNombre ? `${r.nombre} · ${r.campoNombre}` : r.nombre}
                      value={r.count}
                      max={maxPastoreoCircuito}
                      color={colors.amber}
                      valueLabel={r.abiertos > 0 ? `${r.count} (${r.abiertos} abiertos)` : String(r.count)}
                    />
                  ))}
                </View>
              )}
            </Section>

            {/* 11. Distribución por categoría */}
            <Section
              title="Movimientos por categoría"
              subtitle="Distribución de animales registrados"
            >
              {pastoreoPorCategoria.length === 0 ? (
                <Empty msg="Sin registros en el rango seleccionado" />
              ) : (
                <View style={styles.chartBody}>
                  {pastoreoPorCategoria.map(r => (
                    <HBar
                      key={r.categoria}
                      label={r.categoria}
                      value={r.count}
                      max={maxPastoreoCategoria}
                      color={colors.navy}
                      valueLabel={String(r.count)}
                    />
                  ))}
                </View>
              )}
            </Section>
          </>
        )}

        {/* ============ COMPRAS ============ */}
        {metricaTab === 'compras' && (
          <>
            <View style={styles.kpiRow}>
              <Kpi value={totalCompras} label="COMPRAS" color={COMPRAS_ACCENT} />
              <Kpi
                value={totalCabezasEstimadas}
                label="CABEZAS APROX"
                color={colors.navy}
              />
              <Kpi
                value={totalKgCompras}
                label="KG TOTALES"
                color={colors.amber}
              />
            </View>

            {/* Composición machos/hembras — reemplazo del antiguo
                "Inversión total ($)" que exponía precios. */}
            {composicionMH.total > 0 && (
              <View style={styles.kpiRow}>
                <Kpi
                  value={`${composicionMH.pctMachos}% / ${composicionMH.pctHembras}%`}
                  label="MACHOS / HEMBRAS"
                  color={colors.orange}
                />
                <Kpi
                  value={composicionMH.machos}
                  label="MACHOS"
                  color={colors.navy}
                />
                <Kpi
                  value={composicionMH.hembras}
                  label="HEMBRAS"
                  color={colors.navy}
                />
              </View>
            )}

            <Section
              title="Compras por campo"
              subtitle="Cantidad de operaciones registradas"
            >
              {comprasPorCampo.length === 0 ? (
                <Empty msg="Sin compras cargadas" />
              ) : (
                <View style={styles.chartBody}>
                  {comprasPorCampo.map(r => (
                    <HBar
                      key={r.campo.id}
                      label={r.campo.nombre}
                      value={r.count}
                      max={maxComprasCount}
                      color={COMPRAS_ACCENT}
                      valueLabel={String(r.count)}
                    />
                  ))}
                </View>
              )}
            </Section>

            <Section
              title="Kg comprados por campo"
              subtitle="Suma de kg netos de destino"
            >
              {comprasPorCampo.length === 0 ? (
                <Empty msg="Sin compras cargadas" />
              ) : (
                <View style={styles.chartBody}>
                  {comprasPorCampo.map(r => (
                    <HBar
                      key={r.campo.id}
                      label={r.campo.nombre}
                      value={r.kgDestino}
                      max={maxComprasKg}
                      color={colors.amber}
                      valueLabel={`${r.kgDestino.toLocaleString('es-AR')} kg`}
                    />
                  ))}
                </View>
              )}
            </Section>
          </>
        )}

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------- subcomponentes ----------

// Helper: cifra grande del header según el sub-tab activo. Cambia de contexto
// para que el "stat principal" sea siempre relevante al módulo elegido.
//
// IMPORTANTE: en modo "resumen" sumamos los registros de los 4 módulos
// (pariciones + lluvias + mortandad + pastoreo). Antes mostrábamos solo
// totalEventos (= pariciones), lo que era confuso: el header decía "13
// EVENTOS" pero ignoraba lluvias/mortandad/pastoreo. Ahora el número refleja
// TODO lo cargado en el rango, y el label cambia a "REGISTROS" para no
// confundirlo con "eventos de parición".
function headerStatValue(
  tab: MetricaTab,
  totals: {
    totalEventos: number;
    totalMM: number;
    totalMortandad: number;
    totalLluvias: number;
    totalMovimientos: number;
    totalCompras: number;
  },
): number {
  switch (tab) {
    case 'pariciones': return totals.totalEventos;
    case 'lluvias':    return totals.totalMM;
    case 'mortandad':  return totals.totalMortandad;
    // En el modelo entrada/salida cada registro = 1 animal — "movimientos"
    // es el conteo natural (cabezas movidas ya no existe).
    case 'pastoreo':   return totals.totalMovimientos;
    case 'compras':    return totals.totalCompras;
    case 'resumen':
      return (
        totals.totalEventos +
        totals.totalLluvias +
        totals.totalMortandad +
        totals.totalMovimientos +
        totals.totalCompras
      );
  }
}

function headerStatLabel(tab: MetricaTab): string {
  switch (tab) {
    case 'pariciones': return 'eventos';
    case 'lluvias':    return 'mm';
    case 'mortandad':  return 'muertes';
    case 'pastoreo':   return 'movimientos';
    case 'compras':    return 'compras';
    // En "Resumen" usamos "registros" porque sumamos eventos de TODOS los
    // módulos — no son solo pariciones. "Registros" es genérico y honesto.
    case 'resumen':    return 'registros';
  }
}

function Section({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  footer?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionSub}>{subtitle}</Text>}
      </View>
      {children}
      {footer && <Text style={styles.sectionFoot}>{footer}</Text>}
    </View>
  );
}

// SummaryCard — card compacta del tab Resumen. Muestra el total del módulo
// como cifra grande, un preview con top 3 filas (bar chart mini) y un CTA
// que cambia al sub-tab correspondiente. Permite tener un vistazo rápido
// y drill-down a demanda.
function SummaryCard({
  title,
  stat,
  statLabel,
  accent,
  rows,
  empty,
  ctaLabel,
  onCta,
}: {
  title: string;
  stat: number;
  statLabel: string;
  accent: string;
  rows: { label: string; value: number; max: number; valueLabel: string }[];
  empty?: string;
  ctaLabel: string;
  onCta: () => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.summaryHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSub}>Top 3 campos en el rango</Text>
        </View>
        <View style={styles.summaryStatWrap}>
          <Text style={[styles.summaryStat, { color: accent }]}>{stat}</Text>
          <Text style={styles.summaryStatLbl}>{statLabel}</Text>
        </View>
      </View>

      {empty ? (
        <Empty msg={empty} />
      ) : (
        <View style={styles.chartBody}>
          {rows.map(r => (
            <HBar
              key={r.label}
              label={r.label}
              value={r.value}
              max={r.max}
              color={accent}
              valueLabel={r.valueLabel}
            />
          ))}
        </View>
      )}

      <Pressable onPress={onCta} style={styles.ctaBtn} hitSlop={6}>
        <Text style={[styles.ctaTxt, { color: accent }]}>{ctaLabel}</Text>
      </Pressable>
    </View>
  );
}

// Kpi — tile compacto con número + label.
//
// Cuando value === 0 mostramos "—" en lugar del cero literal: visualmente
// "0 MUERTES" o "0 CABEZAS MOV." se leían como "valor faltante / sin datos"
// y al peón le pesaba más que la ausencia. El guión largo es el patrón
// estándar de "no aplica / aún no hay" y deja claro que no es un error.
// Si más adelante queremos forzar el cero literal en algún caso, agregamos
// un prop `showZero` y listo.
function Kpi({ value, label, color }: { value: number | string; label: string; color: string }) {
  // Rediseño post-rebrand: card blanca + strip lateral 4px del color del KPI,
  // mismo patrón que StatCard del Home — da consistencia visual entre las
  // dos pantallas principales de la app.
  //
  // value acepta number o string — string para KPIs derivados (ej. "62% / 38%"
  // de Machos/Hembras en Compras). Empty = 0 numérico o string vacío.
  const isEmpty = value === 0 || value === '';
  const stripColor = isEmpty ? colors.borderSoft : color;
  const valueColor = isEmpty ? colors.textMuted : color;
  return (
    <View style={styles.kpi}>
      <View style={[styles.kpiStrip, { backgroundColor: stripColor }]} />
      <View style={styles.kpiBody}>
        <Text style={[styles.kpiVal, { color: valueColor }]}>
          {isEmpty ? '—' : value}
        </Text>
        <Text style={styles.kpiLbl}>{label}</Text>
      </View>
    </View>
  );
}

function HBar({
  label,
  value,
  max,
  color,
  valueLabel,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  valueLabel?: string;
}) {
  // Ancho relativo, mínimo 2% para que siempre se vea algo si hay count > 0.
  const pct = max > 0 ? Math.max(value / max, value > 0 ? 0.02 : 0) : 0;
  return (
    <View style={styles.hbarRow}>
      <Text style={styles.hbarLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.hbarTrack}>
        <View
          style={[
            styles.hbarFill,
            { width: `${pct * 100}%`, backgroundColor: color },
          ]}
        />
      </View>
      <Text style={styles.hbarValue}>{valueLabel ?? String(value)}</Text>
    </View>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTxt}>{msg}</Text>
    </View>
  );
}

// ---------- estilos ----------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgLight },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  hTitle: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold as '700',
    color: colors.textDark,
  },
  hSub: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  headerStatWrap: {
    alignItems: 'flex-end',
  },
  headerStat: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold as '700',
    color: colors.navy,
    lineHeight: 32,
  },
  headerStatLbl: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Sub-tab bar — segmented (sin scroll), 5 chips con flex:1.
  //
  // Cambio respecto del approach anterior (ScrollView horizontal): los chips
  // se solapaban porque "Pariciones" y "Mortandad" son largos y al
  // entrar a la pantalla el scroll quedaba desplazado mostrando "men"
  // (cortando "Resumen"). Con flex:1 los 5 chips siempre se ven completos
  // y reparten el ancho disponible parejito. El padding horizontal lo bajamos
  // a 4 para que las palabras largas no se compriman, y la fuente se autoajusta
  // hasta 85% si el device es muy angosto.
  // Layout en 2 filas: Resumen (full-width arriba) + 5 chips de módulos abajo.
  // Da más ancho a cada módulo y jerarquía visual al Resumen.
  subTabBarCol: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },

  // "Resumen" — pildora grande arriba que ocupa toda la fila.
  subTabBig: {
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.round,
    backgroundColor: colors.bgLight,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    minHeight: 48,
  },
  subTabBigSel: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  subTabBigTxt: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    fontWeight: fontWeight.bold as '700',
    letterSpacing: 0.3,
  },
  subTabBigTxtSel: {
    color: colors.white,
  },

  // Fila de 5 chips: Pariciones / Lluvias / Mortandad / Pastoreo / Compras.
  subTabModuleRow: {
    flexDirection: 'row',
    gap: 6,
  },
  subTab: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.round,
    minHeight: 42,
    backgroundColor: colors.bgLight,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  subTabSel: {
    backgroundColor: colors.white,
    borderColor: colors.navy,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  subTabTxt: {
    // Subido a 14pt — antes era 13 para que entraran 6 chips. Con la
    // separación de Resumen en su propia fila, los 5 módulos restantes
    // tienen más ancho y caben con texto más grande / legible.
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold as '600',
  },
  subTabTxtSel: {
    color: colors.navy,
    fontWeight: fontWeight.bold as '700',
  },

  // Filter bar — row horizontal simple (NO ScrollView).
  // Los chips son flex:1 para que repartan el ancho disponible en partes iguales,
  // así se ven parejos y nunca se cortan en pantallas angostas.
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  fChip: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  fChipSel: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  fChipTxt: {
    fontSize: fontSize.sm,
    color: colors.textDark,
    fontWeight: fontWeight.semibold as '600',
  },
  fChipTxtSel: { color: colors.white },

  // Filtros específicos del sub-tab Pastoreo. Misma paleta que los del rango
  // (chips redondeados con borde suave) pero con layout distinto:
  //   - pasFilterCol: columna que apila la fila de estado y la wrap de circuitos.
  //   - pasFilterRow: fila de 3 chips equi-anchos (abiertos/cerrados/todos).
  //   - pasCircuitoWrap: wrap horizontal con padding/gap consistente.
  //   - pasChipSm: chip más compacto para que entren varios circuitos por fila.
  pasFilterCol: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  pasFilterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  pasChipEq: { flex: 1, paddingHorizontal: spacing.xs },
  pasCircuitoWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  pasChipSm: {
    flex: 0,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    minHeight: 32,
    maxWidth: 220,
  },

  scroll: {
    padding: spacing.base,
    paddingTop: 0,
    gap: spacing.base,
  },

  // KPIs
  kpiRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  // Card blanca con strip lateral de 4px del color del KPI.
  // Misma anatomía que StatCard del Home (consistencia visual).
  kpi: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    flexDirection: 'row',
    overflow: 'hidden',
    minHeight: 90,
  },
  kpiStrip: {
    width: 4,
  },
  kpiBody: {
    flex: 1,
    padding: spacing.base,
    gap: 2,
    justifyContent: 'center',
  },
  kpiVal: {
    fontSize: 32,
    fontWeight: fontWeight.bold as '700',
    lineHeight: 36,
  },
  kpiLbl: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: fontWeight.bold as '700',
    marginTop: 2,
  },

  // Section
  section: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.base,
    gap: spacing.sm,
  },
  sectionHead: {
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as '700',
    color: colors.textDark,
  },
  sectionSub: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  sectionFoot: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.xs,
    lineHeight: 16,
  },

  chartBody: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },

  // Summary card (tab Resumen)
  summaryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  summaryStatWrap: {
    alignItems: 'flex-end',
  },
  summaryStat: {
    fontSize: 28,
    fontWeight: fontWeight.bold as '700',
    lineHeight: 30,
    fontVariant: ['tabular-nums'],
  },
  summaryStatLbl: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: fontWeight.bold as '700',
  },
  ctaBtn: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  ctaTxt: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as '700',
  },

  // Horizontal bar
  hbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  hbarLabel: {
    width: 86,
    fontSize: fontSize.sm,
    color: colors.textDark,
    fontWeight: fontWeight.semibold as '600',
  },
  hbarTrack: {
    flex: 1,
    height: 14,
    backgroundColor: colors.bgLight,
    borderRadius: 7,
    overflow: 'hidden',
  },
  hbarFill: {
    height: '100%',
    borderRadius: 7,
    minWidth: 2,
  },
  hbarValue: {
    minWidth: 52,
    textAlign: 'right',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as '700',
    color: colors.textDark,
    fontVariant: ['tabular-nums'],
  },

  // Empty
  empty: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  emptyTxt: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontStyle: 'italic',
  },

  // Tabla
  table: {
    marginTop: spacing.xs,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  tRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  tRowAlt: {
    backgroundColor: colors.bgLight,
  },
  tHeadRow: {
    backgroundColor: colors.navy,
  },
  tHeadCell: {
    color: colors.white,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold as '700',
    letterSpacing: 0.6,
  },
  tCellCampo: {
    flex: 1.6,
    fontSize: fontSize.sm,
    color: colors.textDark,
    fontWeight: fontWeight.semibold as '600',
  },
  tCellNum: {
    flex: 1,
    textAlign: 'right',
    fontSize: fontSize.sm,
    color: colors.textDark,
    fontVariant: ['tabular-nums'],
  },
  tCellStrong: {
    fontWeight: fontWeight.bold as '700',
    color: colors.navy,
  },
});
