// useSubscription — hook que devuelve el estado de cobranza del cliente.
//
// Se usa en el shell de la app para:
//   - Decidir si mostrar SubscriptionBanner arriba de las pantallas.
//   - Reemplazar Home con SubscriptionLockoutScreen cuando isLocked.
//   - Deshabilitar el FAB y los botones de "Guardar" en los Forms cuando !canWrite.
//
// Hace fetch al login y refresca silenciosamente al volver al foreground del
// device. No es un polling agresivo — el server tiene la fuente de verdad,
// y el cron mueve los estados a las 3am, así que con refresh ocasional alcanza.

import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useRepository } from '@/data';
import type { Subscription, SubscriptionStatus } from '@/data/types';
import { bannerSeverity, canWrite, isLockedOut } from '@/data/subscription';

export interface SubscriptionView {
  /** Datos crudos de la subscription (status, fechas, días vencidos). */
  data: Subscription | null;
  loading: boolean;
  error: string | null;
  /** Refresca manualmente (ej: después de un retry del cron). */
  refresh: () => Promise<void>;

  // Helpers ya derivados para que las pantallas no calculen lo mismo en cada render.
  status: SubscriptionStatus;
  /** ¿Se pueden cargar eventos nuevos? (active o past_due). */
  canWrite: boolean;
  /** ¿La app debe mostrar el lockout screen en vez del Home? (suspended o canceled). */
  isLocked: boolean;
  /** Severidad para el banner — info / warning / error / block. */
  severity: ReturnType<typeof bannerSeverity>;
}

export function useSubscription(): SubscriptionView {
  const repo = useRepository();
  const [data, setData] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const sub = await repo.getSubscription();
      setData(sub);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refrescamos cuando la app vuelve al foreground. Cubre el caso típico:
  // el cliente paga, el admin marca pago en el dashboard a las 14h; el peón
  // tiene la app abierta en background; al volver a abrirla, el banner
  // desaparece sin requerir logout.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  // Defaults defensivos: si todavía no cargó, tratamos como activo (no
  // mostramos banner ni bloqueamos). Mejor falso negativo que falso positivo
  // — preferimos que un cliente vencido vea su app un segundo más antes del
  // banner, que que un cliente al día vea un banner por glitch de red.
  const status: SubscriptionStatus = data?.status ?? 'active';

  return {
    data,
    loading,
    error,
    refresh,
    status,
    canWrite: canWrite(status),
    isLocked: isLockedOut(status),
    severity: bannerSeverity(status),
  };
}
