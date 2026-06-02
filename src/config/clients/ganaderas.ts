// Config del cliente Ganaderas (Salta, Argentina).
//
// Branding + módulos + catálogos extraídos del AppSheet real (GVA_F.xlsx).
// Para agregar un cliente nuevo: copiar este archivo, renombrar la export,
// editar valores, y registrar en src/config/active.ts.

import {
  GANADERAS_VACAS_GRUPOS,
  GANADERAS_EVENTOS_PARICION,
  GANADERAS_SEXOS,
  GANADERAS_ASISTENCIA,
  GANADERAS_CARAVANA_COLORES,
  GANADERAS_CAUSAS_PARICION,
  GANADERAS_MORT_ACTIVIDADES,
  GANADERAS_MORT_CATEGORIAS,
  GANADERAS_PAST_CATEGORIAS,
  GANADERAS_PAST_EVENTOS,
  GANADERAS_PAST_CAT_ANIMAL,
} from '@/data/seed/ganaderas';
import type { ClientConfig } from '../types';

// Causas frecuentes del histórico — chips para autorrellenar el detalle de
// muerte. No están en el catálogo del Excel; las inferimos de los datos reales.
const CAUSAS_FRECUENTES_GANADERAS = [
  'Insolación',
  'Diarrea',
  'Calor',
  'Picadura de víbora',
  'Empantanado',
];

export const GANADERAS_CONFIG: ClientConfig = {
  id: 'ganaderas',
  branding: {
    nombre: 'Ganaderas',
    tagline: 'Gestión integral del campo',
    logo: null, // null = se usan iniciales del nombre
  },
  // Los 5 módulos activos (Compras agregado post-AppSheet).
  modulosHabilitados: ['pariciones', 'lluvias', 'mortandad', 'pastoreo', 'compras'],
  catalogos: {
    pariciones: {
      vacasGrupos: GANADERAS_VACAS_GRUPOS,
      eventos: GANADERAS_EVENTOS_PARICION,
      sexos: GANADERAS_SEXOS,
      asistencia: GANADERAS_ASISTENCIA,
      caravanaColores: GANADERAS_CARAVANA_COLORES,
      causaTipos: GANADERAS_CAUSAS_PARICION,
      causasFrecuentes: CAUSAS_FRECUENTES_GANADERAS,
    },
    mortandad: {
      categorias: GANADERAS_MORT_CATEGORIAS,
      actividades: GANADERAS_MORT_ACTIVIDADES,
      causaTipos: ['Muerte Señalado', 'Nacido Muerto', 'Desconocido'],
    },
    pastoreo: {
      categorias: GANADERAS_PAST_CATEGORIAS,
      eventos: GANADERAS_PAST_EVENTOS,
      catAnimal: GANADERAS_PAST_CAT_ANIMAL,
    },
    compras: {
      // Replica del módulo "Compra" del AppSheet de Ganaderas.
      actividades: ['Destete Precoz', 'Engorde', 'Invernada'],
      plazos: ['Contado', '30 días', '60 días', '90 días'],
    },
  },
};
