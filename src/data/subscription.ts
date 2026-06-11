// Helpers de subscription / billing — fórmulas puras que decide qué muestra
// la UI según el estado del cliente. Sin side-effects, fáciles de testear.
//
// La fuente de verdad SIEMPRE es el server (subscription_status en la tabla
// clientes). Acá solo derivamos métricas de UI a partir del periodEndDate.

import type { SubscriptionStatus } from './types';

/**
 * Días desde el vencimiento del período. 0 cuando está al día o adelantado.
 * Calculado en local time del device — para el banner alcanza, no necesita
 * timezone-aware exact math.
 *
 * Ejemplo: periodEndDate = '2026-06-01', today = 2026-06-08 → 7
 */
export function computeDaysOverdue(
  periodEndDate: string | null | undefined,
  today: Date = new Date(),
): number {
  if (!periodEndDate) return 0;
  const end = new Date(periodEndDate + 'T23:59:59');
  const diffMs = today.getTime() - end.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/** ¿La app debe permitir cargar eventos nuevos? */
export function canWrite(status: SubscriptionStatus): boolean {
  return status === 'active' || status === 'past_due';
}

/** ¿La app debe mostrar el lockout screen en vez del Home? */
export function isLockedOut(status: SubscriptionStatus): boolean {
  return status === 'suspended' || status === 'canceled';
}

/**
 * Severidad visual para el banner. Decide color / iconografía / tono del copy.
 *   - 'info'    → al día (no se muestra banner)
 *   - 'warning' → past_due (banner naranja, app sigue operativa)
 *   - 'error'   → restricted (banner rojo, app en read-only)
 *   - 'block'   → suspended / canceled (lockout full screen, no banner)
 */
export type BannerSeverity = 'info' | 'warning' | 'error' | 'block';

export function bannerSeverity(status: SubscriptionStatus): BannerSeverity {
  switch (status) {
    case 'active':     return 'info';
    case 'past_due':   return 'warning';
    case 'restricted': return 'error';
    case 'suspended':  return 'block';
    case 'canceled':   return 'block';
  }
}

/** Mensaje principal del banner según estado + días vencidos. */
export function bannerMessage(status: SubscriptionStatus, daysOverdue: number): string {
  switch (status) {
    case 'past_due':
      // Días 1-7: tono recordatorio.
      return daysOverdue === 1
        ? 'Tu pago venció ayer. Regularizá para seguir cargando datos.'
        : `Tu pago venció hace ${daysOverdue} días. Regularizá para evitar interrupciones.`;
    case 'restricted':
      // Días 8-19: tono más fuerte, ya hay restricción.
      return `Cuenta en mora hace ${daysOverdue} días. No podés cargar eventos nuevos hasta regularizar el pago.`;
    case 'suspended':
      return `Cuenta suspendida hace ${daysOverdue} días. Comunicate con el equipo de ASFION para reactivarla.`;
    case 'canceled':
      return 'Cuenta cancelada. Tus datos están disponibles para export por 90 días.';
    case 'active':
      return '';
  }
}
