// ASFION palette — alineada con el deck comercial y el one-pager.
// Un cambio acá se refleja en toda la app.

export const colors = {
  greenDeep: '#0F1F16',   // fondo oscuro premium
  greenDark: '#1B4332',   // dominante
  greenLime: '#52B788',   // acento / CTAs / lo que hay que mirar
  terracota: '#C9823F',   // atención / errores / alertas
  amber: '#B8802E',       // parcial / en progreso

  bgLight: '#F8F9F6',
  white: '#FFFFFF',

  textDark: '#1A1A1A',
  textMuted: '#6B7280',
  textOnDark: '#FFFFFF',
  textOnDarkMuted: '#CFDAD2',

  borderSoft: '#E2E8E0',
  danger: '#C9423F',
  success: '#52B788',
} as const;

export type ColorName = keyof typeof colors;
