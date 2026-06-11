// ASFION palette — derivada del logo oficial (naranja + navy).
// Un cambio acá se refleja en toda la app.
//
// Brand reference:
//   - Navy   #163349 (UI) — derivado del #0D2939 del SVG, softeneado para pantalla
//   - Orange #FF8409 (UI) — IDÉNTICO al SVG oficial (sin alterar)
//   - El logo en sí (icon.png / splash.png) mantiene los HEX originales del SVG
//
// El `success` queda con un verde aparte para que los badges de sync OK
// no se confundan con CTAs.

export const colors = {
  // Brand — HEX del SVG oficial del diseñador (orange queda igual al brand).
  // Solo el navy se mantiene softeneado (#163349 en vez de #0D2939) para
  // reducir el "casi negro" del SVG, que cansaba la vista contra el cream.
  navyDeep:   '#0F2535',   // fondo oscuro premium (login, header dashboard)
  navy:       '#163349',   // dominante (botones, títulos, body strong)
  orange:     '#FF8409',   // accent / CTAs (fiel al SVG)
  orangeSoft: '#FFCB95',   // peach (chips de caravana, parcela, badges sobre bg blanco)
  // Variante un poquito más saturada/oscura del peach, SOLO para uso sobre
  // navy oscuro (tiles del Home). Compensa el efecto óptico de "chromatic
  // adaptation" que hace ver el peach más pálido cuando está rodeado de navy.
  // Sobre bg blanco se vería más naranja; sobre navy se ve como el orangeSoft
  // de las cards. Si necesitás peach sobre bg claro, usá orangeSoft.
  orangeTile: '#FFB97A',

  // Neutrales
  bgLight:        '#F7F5F1',   // crema neutro cálido (combina con orange)
  white:          '#FFFFFF',
  textDark:       '#1A1A1A',
  textMuted:      '#6B7280',
  textOnDark:     '#FFFFFF',
  textOnDarkMuted:'#C7D0DA',
  borderSoft:     '#E5E2DD',

  // Status (independientes del brand)
  success:    '#3FAE5A',   // verde para sync OK (separado de orange)
  danger:     '#C9423F',
  amber:      '#D89425',   // estado parcial / en progreso
  terracota:  '#C9823F',   // alerta / warning suave
} as const;

export type ColorName = keyof typeof colors;
