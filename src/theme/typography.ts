// Tipografías y tamaños base. Mobile-first: tamaños pensados para pulgares con guantes.

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 32,
  display: 42,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  black: '900',
} as const;

// Mínimos de "touch target" recomendados por Apple (44x44pt) y Google (48x48dp).
// En campo con guantes, apuntamos más alto.
export const touchTarget = {
  min: 48,
  comfortable: 56,
  large: 72,
} as const;
