// Config DEMO — cliente ficticio diseñado intencionalmente distinto a
// Ganaderas, para validar que la abstracción ClientConfig realmente soporta
// variaciones por cliente.
//
// Diferencias clave respecto a Ganaderas:
//
//   - Branding distinto (nombre, tagline)
//   - Solo 2 módulos habilitados (Pariciones + Lluvias) — sin Mortandad
//     ni Pastoreo. La home debe mostrar solo 2 tiles, los tabs solo los
//     correspondientes, y el navigator no debe registrar las rutas no usadas.
//   - Categorías propias (un tambo lechero tiene categorías distintas
//     a una cría de carne)
//   - Colores de caravana distintos (Rojo y Verde, no Celeste/Naranja)
//   - Sin "Aborto" como evento de parición — algunos tambos no lo trackean
//
// Útil para hacer "npm run build:demo" y mostrarle a un cliente potencial
// "mirá, así se vería tu app con tu config".

import type { ClientConfig } from '../types';

export const DEMO_CONFIG: ClientConfig = {
  id: 'demo-tambo',
  branding: {
    nombre: 'Tambo La Trinidad',
    tagline: 'Producción lechera',
    logo: null,
    accentColor: '#1F6FB8',
  },
  // Solo dos módulos. La home, los tabs y las rutas se filtran.
  modulosHabilitados: ['pariciones', 'lluvias'],
  catalogos: {
    pariciones: {
      vacasGrupos: ['Vacas en producción', 'Vacas secas', 'Vaquillonas'],
      eventos: ['Nacimiento', 'Muerte'],  // un tambo no trackea aborto
      sexos: ['Macho', 'Hembra'],          // sin "Orejano"
      asistencia: ['Si', 'No'],
      caravanaColores: ['Rojo', 'Verde', 'Blanca'],
      causaTipos: ['Nacido Muerto', 'Desconocido'],
      causasFrecuentes: ['Frío', 'Distocia', 'Madre primeriza'],
    },
    mortandad: {
      // No se usa pero debe existir para no romper tipos.
      categorias: [],
      actividades: [],
      causaTipos: [],
    },
    pastoreo: {
      categorias: [],
      eventos: [],
      catAnimal: [],
    },
  },
};
