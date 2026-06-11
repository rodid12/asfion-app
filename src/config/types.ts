// ClientConfig — el contrato de configuración por cliente.
//
// Cada cliente que use ASFION (Ganaderas, [cliente futuro], etc.) tiene un
// archivo en src/config/clients/ que exporta un ClientConfig. La app entera
// consume esa config vía useClientConfig() — los screens no saben qué cliente
// están corriendo.
//
// Hoy (Fase 1): el cliente activo se elige editando src/config/active.ts.
// Para hacer un build "Ganaderas" cambiás esa línea y rebuildeas.
// Mañana (post-Supabase): la config se carga desde una tabla client_configs
// al iniciar la app, y un panel admin web la edita. El hook no cambia.

import type { ComponentType } from 'react';
import type { ImageSourcePropType } from 'react-native';

/** Identificador único de un módulo del producto. */
export type ModuloKey =
  | 'pariciones'
  | 'lluvias'
  | 'mortandad'
  | 'pastoreo'
  | 'compras'
  | 'mediciones'
  // Módulo en roadmap, todavía no implementado. Aparece como tile "PRÓXIMAMENTE"
  // en el Home (sin navegación) y como tab disabled en el dashboard web.
  | 'ventas';

/** Branding (logo + colores + nombre) que aparecen en login, header, etc. */
export interface ClientBranding {
  /** Nombre visible del cliente (ej. "Ganaderas Valle del Anta"). */
  nombre: string;
  /** Tagline corto opcional (ej. "Gestión integral del campo"). */
  tagline?: string;
  /**
   * Logo del cliente. Puede ser:
   *   - un emoji ("🐄") o iniciales cortas que se renderean como texto
   *   - un require() de imagen local: require('@/assets/clientes/ganaderas.png')
   *   - null → la app deriva iniciales del nombre
   */
  logo?: string | ImageSourcePropType | null;
  /** Color primario para personalizar acentos (opcional). */
  accentColor?: string;
}

/** Catálogos del módulo Pariciones — todos texto libre, los valores
 *  alimentan los dropdowns / chips. */
export interface ParicionCatalogos {
  vacasGrupos: readonly string[];      // ["Vacas cabeza", "Vaca cuerpo", "Vaca cola"]
  eventos: readonly string[];          // ["Nacimiento", "Muerte", "Aborto", "Retacto"]
  sexos: readonly string[];            // ["Macho", "Hembra", "Orejano"]
  asistencia: readonly string[];       // ["Si", "No"]
  caravanaColores: readonly string[];  // ["Celeste", "Amarillo", "Blanca", "Naranja"]
  causaTipos: readonly string[];       // ["Muerte Señalado", "Nacido Muerto", "Desconocido"]
  causasFrecuentes: readonly string[]; // ["Insolación", "Diarrea", "Calor", ...]
}

export interface MortandadCatalogos {
  categorias: readonly string[];       // ["Vc Preñ", "TernM", "TernH", "Vaq 1° Servicio", ...]
  actividades: readonly string[];      // ["Cria", "engorde", "Recria P", "Invernada", "Destete Precoz"]
  causaTipos: readonly string[];       // ["Muerte Señalado", "Nacido Muerto", "Desconocido"]
}

export interface PastoreoCatalogos {
  categorias: readonly string[];       // ["Novillito Grande", "Vaquilla Meses", ...]
  eventos: readonly string[];          // ["Entrada", "Salida", "Rotacion", "Muerte"]
  catAnimal: readonly string[];        // ["Toros", "TernH", "Vaq 1° Serv", ...]
}

export interface CompraCatalogos {
  actividades: readonly string[];      // ["Destete Precoz", "Engorde", "Invernada"]
  plazos: readonly string[];           // ["Contado", "30 días", "60 días", "90 días"]
}

/** Catálogos completos del cliente, indexados por módulo. */
export interface ClientCatalogos {
  pariciones: ParicionCatalogos;
  mortandad: MortandadCatalogos;
  pastoreo: PastoreoCatalogos;
  compras: CompraCatalogos;
  // Lluvias y Mediciones no tienen catálogo (solo números/texto libre)
}

/** Configuración completa del cliente — todo lo que varía por instalación. */
export interface ClientConfig {
  /** Slug único (ej. "ganaderas", "estancia-x"). Sirve para storage keys,
   *  nombre del build, debugging. */
  id: string;

  branding: ClientBranding;

  /** Módulos habilitados — la home, tabs y rutas se renderean condicionalmente.
   *  Cliente A puede tener ['pariciones', 'lluvias'] y cliente B los 4. */
  modulosHabilitados: readonly ModuloKey[];

  /** Catálogos por módulo — alimentan los dropdowns/chips del cliente.
   *  Si un módulo no está habilitado, su catálogo igual debe estar definido
   *  (puede ser un objeto vacío), para no tener tipos opcionales que rompan
   *  el código de los screens. */
  catalogos: ClientCatalogos;
}
