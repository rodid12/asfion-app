// Utilidades de manejo de fechas — TZ safe (espejo del helper del dashboard).
//
// Bug que motivó este archivo: `new Date().toISOString().slice(0, 10)` siempre
// devuelve la fecha UTC. Un operario abriendo el form a las 22:00 ART (UTC-3)
// ve un default de mañana, no de hoy — el evento queda registrado un día
// corrido.
//
// Hasta este archivo, cada Form de la app reimplementaba inline su propia
// `hoyISO()` con `getFullYear/getMonth/getDate`. Centralizamos acá para que
// no haya 6 copias del mismo helper (audit del 27-jun-2026, item TZ).

/** Fecha de HOY como ISO `YYYY-MM-DD` en la zona local del device. */
export function hoyISO(): string {
  return dateAISO(new Date());
}

/** Convierte un Date a string ISO `YYYY-MM-DD` usando la zona LOCAL (no UTC).
 *  Esto es lo que reemplaza al `toISOString().slice(0, 10)` que tenía el bug. */
export function dateAISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Convierte una fecha ISO `YYYY-MM-DD` en un Date local midnight. */
export function fechaISOaLocal(iso: string): Date {
  return new Date(iso + 'T00:00:00');
}

/** Suma N días a una fecha ISO `YYYY-MM-DD` y devuelve la nueva fecha ISO. */
export function sumarDiasISO(iso: string, dias: number): string {
  const d = fechaISOaLocal(iso);
  d.setDate(d.getDate() + dias);
  return dateAISO(d);
}

/** Formato corto "VIE 27/06/2026" para chips/headers de forms.
 *  Era un helper inline duplicado en 4 forms (Compra/Lluvia/Pastoreo/Mortandad).
 *  Centralizado por A3 (audit deuda arquitectónica). */
export function fechaBonita(iso: string): string {
  const [yy, mm, dd] = iso.split('-').map(Number);
  if (!yy || !mm || !dd) return iso;
  const dow = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'][new Date(yy, mm - 1, dd).getDay()];
  return `${dow} ${dd}/${mm}/${yy}`;
}
