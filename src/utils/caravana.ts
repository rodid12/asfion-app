import type { CaravanaColor, Paricion } from '@/data/types';

/**
 * Clave estable para comparar caravanas sin confundir diferencias de carga.
 *
 * - Ignora mayúsculas y espacios accidentales.
 * - En números puramente numéricos, "001" y "1" representan el mismo animal.
 * - Conserva letras y signos porque forman parte de caravanas históricas.
 */
export function normalizarNumeroCaravana(numero?: string | null): string {
  const compacto = (numero ?? '').trim().toUpperCase().replace(/\s+/g, '');
  if (!compacto) return '';
  if (/^\d+$/.test(compacto)) return compacto.replace(/^0+(?=\d)/, '');
  return compacto;
}

export function esMismaCaravana(
  paricion: Pick<Paricion, 'caravanaColor' | 'caravanaNumero'>,
  color: CaravanaColor,
  numero: string,
): boolean {
  return (
    paricion.caravanaColor?.trim().toLowerCase() === color.trim().toLowerCase() &&
    normalizarNumeroCaravana(paricion.caravanaNumero) === normalizarNumeroCaravana(numero)
  );
}
