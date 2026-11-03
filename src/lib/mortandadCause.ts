const normalizarBase = (value?: string | null) => (value ?? '')
  .trim()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

/**
 * Agrupa variantes, género y errores frecuentes sin perder las causas
 * específicas. Se usa al guardar nuevas cargas y al calcular métricas, para
 * que "Desconocida", "Desconocido" y typos equivalentes no aparezcan como
 * categorías diferentes.
 */
export function canonicalizarCausaMortandad(value?: string | null): string {
  const original = (value ?? '').trim();
  const base = normalizarBase(value);
  if (!base || base === '.' || base === ',' || base === '-') return 'Sin especificar';

  if (
    base.includes('desconoc') || base.includes('desconic') ||
    base.includes('no se sabe') || base.includes('sin identificar') ||
    base.includes('sin especificar') || base === 's/d' || base === 'nd'
  ) return 'Desconocida';

  if (base.includes('infec')) return 'Infección';
  if (base.includes('neumon')) return 'Neumonía';
  if (base.includes('trancad')) return 'Trancada';
  if (base.includes('castrad')) return 'Castración';
  if (base.includes('distoc') || base.includes('problema de parto')) return 'Distocia';
  if (base.includes('respiratori')) return 'Problema respiratorio';
  if (base.startsWith('tristeza')) return 'Tristeza';
  if (base.includes('mal yuyo')) return 'Mal yuyo';

  return original.charAt(0).toUpperCase() + original.slice(1);
}

export const CAUSAS_MORTANDAD_SUGERIDAS = [
  'Desconocida',
  'Infección',
  'Neumonía',
  'Trancada',
  'Castración',
  'Distocia',
  'Problema respiratorio',
  'Tristeza',
  'Mal yuyo',
] as const;
