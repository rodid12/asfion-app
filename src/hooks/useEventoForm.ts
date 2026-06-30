// =============================================================================
// useEventoForm — Hook genérico para los 5 form screens de eventos
// =============================================================================
//
// Antes (audit A3): cada form repetía 95% del mismo esqueleto — campo/lote
// loading, edit-mode prefill con flag cancelado, isDirty, validación,
// guardar con manejo de sesión expirada, alerts de éxito. Total: ~3.847
// líneas combinadas en 5 forms casi clones.
//
// Después: este hook centraliza la parte ESQUELETO (state común, effects,
// helpers de guardado). Cada form mantiene:
//   - Su state específico (pluviometroId/mm en Lluvia; muchos campos en Paricion)
//   - Su build del evento (a partir de su state)
//   - Su UI (selectores, inputs, layout)
//
// El hook nunca "decide" qué campos son required ni cómo se ven en pantalla —
// solo orquesta el flow común.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuth } from '@/auth/context';
import { useRepository } from '@/data';
import { useTabNav, type TabKey } from '@/navigation/TabContext';
import { hoyISO } from '@/utils/fechas';
import type { Campo, Evento, TipoEvento } from '@/data/types';
import type { RootStackParamList } from '@/navigation/types';

/**
 * Resultado de `onGuardar()` — el form puede usarlo para customizar alerts
 * o decidir qué hacer después (volver, resetear, etc).
 */
export interface GuardarResult {
  /** El evento que terminó persistido (con syncState actualizado). */
  saved: Evento;
  /** true si Supabase devolvió OK; false si quedó en cola offline. */
  sincronizada: boolean;
  /** Mensaje de error de sync (si hubo) para mostrar al operario. */
  syncError?: string;
}

/**
 * Opciones del hook. Cada form pasa su específico.
 */
export interface UseEventoFormOpts<T extends Evento> {
  /** Tipo del evento — para `repo.listEventos(tipo)` en edit mode. */
  tipo: TipoEvento;

  /** ID del evento a editar (route param). Si está, isEdit = true. */
  eventoId?: string;

  /** Para el título de la pantalla. */
  titleNew: string;
  titleEdit: string;

  /**
   * Build del objeto evento listo para `repo.saveEvento()`.
   *
   * El hook pasa por contexto los campos comunes (campoId, fecha,
   * usuarioEmail, id, createdAt). El resto sale del CLOSURE del caller —
   * típicamente lee `useState` que el form tiene (pluviometroId, kgOrigen,
   * categoría, etc.). Devuelve `null` si el evento no se puede armar
   * (validación específica falla).
   *
   * ⚠️ CONTRATO IMPORTANTE — auto-derivados ANTES del save:
   *
   *   `buildEvento` lee del closure. Si en tu `handleGuardar()` calculás
   *   un valor con `await` (ej. siguiente numero_operacion correlativo) y
   *   lo seteás con `setX(...)`, NO está disponible cuando `onGuardar()`
   *   invoca `buildEvento` — React no propaga el state al closure hasta el
   *   próximo render. Hay 2 patrones para esto:
   *
   *   A) **useRef** (workaround simple usado en CompraFormScreen.tsx:140):
   *      ```ts
   *      const valorRef = useRef<string>('');
   *      // En handleGuardar:
   *      const generado = await calcularAsync();
   *      valorRef.current = generado;
   *      setValor(generado);    // para UI
   *      await onGuardar();     // buildEvento lee valorRef.current (sync)
   *      ```
   *      Después del save: `valorRef.current = ''` para próximas cargas.
   *
   *   B) **Pasar el dato explícitamente** (futuro, requiere extender API):
   *      Agregar `beforeSave?: () => Promise<Partial<T>>` al hook que se
   *      ejecute antes de buildEvento y merge sus campos al evento final.
   *
   *   La opción B es más limpia pero hoy no está implementada. Mientras
   *   tanto, usar A para campos auto-derivados (correlativos, GPS, etc).
   */
  buildEvento: (ctx: { campoId: string; fecha: string; usuarioEmail: string;
                       id: string; createdAt: string; }) => T | null;

  /** Tab a la que volver tras guardar exitoso (para "Ver listado"). Si el
   *  evento no tiene una tab dedicada (ej. pariciones), pasar 'lista'. */
  tabName: TabKey;

  /** Resumen humano del evento para el Alert de éxito. Ej "5mm en Casco". */
  formatSummary: (e: T) => string;

  /** Reset del state específico del form tras guardar exitoso (modo "cargar otra").
   *  El hook hace su parte (limpiar errores, etc), el caller limpia lo suyo. */
  resetEspecifico?: () => void;
}

/**
 * Hook genérico. El form solo necesita pasar `buildEvento` y manejar su
 * state específico (pluviometroId, etc.). Todo lo demás vive acá.
 */
export function useEventoForm<T extends Evento>(opts: UseEventoFormOpts<T>) {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const repo = useRepository();
  const { user } = useAuth();
  const { switchTab } = useTabNav();

  const isEdit = Boolean(opts.eventoId);

  // ─────────────────────────────────────────────────────────────────────────
  // State común (campoId, fecha, campos[], edit flow)
  // ─────────────────────────────────────────────────────────────────────────
  const [campoId, setCampoId] = useState<string>(user?.campoAsignadoId ?? '');
  const [fecha, setFecha] = useState<string>(hoyISO());
  const [campos, setCampos] = useState<Campo[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [cargandoExistente, setCargandoExistente] = useState<boolean>(isEdit);
  const [createdAtOriginal, setCreatedAtOriginal] = useState<string | undefined>();
  const [originalRecord, setOriginalRecord] = useState<T | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Título de la pantalla — se actualiza si isEdit cambia
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    nav.setOptions({ title: isEdit ? opts.titleEdit : opts.titleNew });
  }, [nav, isEdit, opts.titleEdit, opts.titleNew]);

  // ─────────────────────────────────────────────────────────────────────────
  // Cargar lista de campos + auto-select si hay 1 solo
  // ─────────────────────────────────────────────────────────────────────────
  const loadCampos = useCallback(async () => {
    const cs = await repo.listCampos();
    setCampos(cs);
    if (!campoId && cs.length === 1 && cs[0]) {
      setCampoId(cs[0].id);
    }
  }, [repo, campoId]);

  useEffect(() => { loadCampos(); }, [loadCampos]);

  // ─────────────────────────────────────────────────────────────────────────
  // Prefill en edit mode — busca el evento por ID y devuelve el record al
  // caller para que pueda hidratar su state específico. Maneja el flag
  // `cancelado` para evitar setState tras unmount.
  //
  // CONTRATO: el caller registra un onPrefill que recibe el evento y
  // hidrata el state específico (pluviometroId, etc.). El hook hidrata
  // lo común (campoId, fecha, createdAtOriginal, originalRecord).
  //
  // ⚠️ Usamos `useRef` (NO `useState`) para el callback porque:
  //   1. El `useEffect` del hook que dispara el fetch del prefill corre
  //      ANTES del `useEffect` del caller (orden de declaración de hooks
  //      vs efectos del componente). Con `useState`, la IIFE async del
  //      hook capturaba `prefillCb = null` en su closure inicial — el
  //      `setPrefillCb(cb)` del caller llegaba tarde y el effect ya
  //      había corrido con el null capturado.
  //   2. El effect del hook NO se re-dispara cuando el caller actualiza
  //      el callback (deps inmutables), así que aún si el caller
  //      registraba a tiempo, la siguiente vez que isEdit/eventoId
  //      cambiaba quedaba pegado al callback viejo.
  //   3. Con `useRef`, el callback se lee FRESH cada vez que el await
  //      resuelve — `.current` es siempre el último registrado.
  //
  // Bug confirmado en audit #3 (29-jun-2026): rompía edit-mode en TODOS
  // los 5 forms — los campos específicos quedaban vacíos al editar.
  // ─────────────────────────────────────────────────────────────────────────
  const prefillCbRef = useRef<((evt: T) => void) | null>(null);

  useEffect(() => {
    if (!isEdit || !opts.eventoId) return;
    let cancelado = false;
    (async () => {
      const list = await repo.listEventos(opts.tipo);
      if (cancelado) return;
      const existing = list.find(e => e.id === opts.eventoId) as T | undefined;
      if (!existing) {
        Alert.alert('No encontrada', 'Esta carga ya no existe.');
        nav.goBack();
        return;
      }
      // Common: campoId + fecha + metadata
      setCampoId(existing.campoId);
      setFecha(existing.fecha);
      setCreatedAtOriginal(existing.createdAt);
      setOriginalRecord(existing);
      // Specific: el caller hidrata su state — leemos del ref para tener
      // el callback más reciente, no el capturado al primer render.
      if (prefillCbRef.current) prefillCbRef.current(existing);
      setCargandoExistente(false);
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, opts.eventoId, opts.tipo]);

  // ─────────────────────────────────────────────────────────────────────────
  // Guardar — orquesta build + save + alerts. Devuelve true si guardó OK.
  // ─────────────────────────────────────────────────────────────────────────
  const onGuardar = async (): Promise<GuardarResult | null> => {
    if (!user?.email) {
      Alert.alert('Sesión expirada', 'Volvé a entrar.');
      return null;
    }
    if (!campoId) {
      Alert.alert('Falta campo', 'Elegí un campo antes de guardar.');
      return null;
    }
    const idDelEvento = opts.eventoId ?? cryptoRandomId();
    const createdAt = createdAtOriginal ?? new Date().toISOString();
    const evento = opts.buildEvento({
      campoId, fecha, usuarioEmail: user.email,
      id: idDelEvento, createdAt,
    });
    if (!evento) return null; // el caller no pudo armar el objeto (validación)

    setGuardando(true);
    try {
      const saved = await repo.saveEvento(evento);
      const sincronizada = saved.syncState === 'synced';
      const base = opts.formatSummary(evento);
      const detalle = !sincronizada && saved.syncError
        ? `\n\nGuardado offline. Detalle: ${saved.syncError}`
        : (!sincronizada ? '\n\nGuardado offline. Se sincroniza cuando haya señal.' : '');
      const msg = base + detalle;

      if (isEdit) {
        Alert.alert(sincronizada ? 'Listo' : 'Guardado offline', msg,
          [{ text: 'OK', onPress: () => nav.goBack() }]);
      } else {
        Alert.alert(sincronizada ? 'Listo' : 'Guardado offline', msg, [
          { text: 'Ver listado', onPress: () => { switchTab(opts.tabName); nav.goBack(); } },
          { text: 'Cargar otra', onPress: () => opts.resetEspecifico?.(), style: 'cancel' },
        ]);
      }
      return { saved: saved as Evento, sincronizada, syncError: saved.syncError };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const esSesion = msg.toLowerCase().includes('sesión') || msg.toLowerCase().includes('jwt');
      Alert.alert(
        esSesion ? 'Sesión expirada' : 'Error al guardar',
        esSesion ? `${msg}\n\nVolvé a Menú → Salir y entrá de nuevo.` : msg,
      );
      return null;
    } finally {
      setGuardando(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Resolver el campo actual para mostrar nombre en UI sin re-find en cada render
  // ─────────────────────────────────────────────────────────────────────────
  const campoActual = useMemo(
    () => campos.find(c => c.id === campoId),
    [campos, campoId],
  );

  return {
    // Auth + repo refs
    user, repo, nav, switchTab,

    // Common state
    isEdit, eventoId: opts.eventoId,
    campoId, setCampoId,
    fecha, setFecha,
    campos, campoActual,
    cargandoExistente,
    createdAtOriginal,
    originalRecord,

    // Save flow
    guardando, onGuardar,

    // Specific-state prefill hook — el form llama `registerPrefill(cb)` para
    // que en edit mode se invoque con el record cargado y pueda hidratar su
    // state local (pluviometroId, etc). Ahora vía useRef — el ref se actualiza
    // sincrónicamente y el effect prefill lee `.current` al resolver el await
    // (siempre el callback más reciente, sin race de orden de mount).
    registerPrefill: (cb: (evt: T) => void) => {
      prefillCbRef.current = cb;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// cryptoRandomId — UUID v4 generado en device (sin depender de uuid lib).
// React Native sin polyfill no tiene crypto.randomUUID; el polyfill ya está
// importado en App.tsx (`react-native-get-random-values`). Si por algún caso
// esa importación falla, hay un fallback Math.random pseudo-único.
// ─────────────────────────────────────────────────────────────────────────────
function cryptoRandomId(): string {
  try {
    // @ts-ignore — el polyfill expone crypto en RN
    return (globalThis.crypto as any).randomUUID();
  } catch {
    return 'evt-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
}
