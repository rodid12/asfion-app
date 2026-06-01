// active.ts — selector del cliente que se compila en este build.
//
// EN FASE 1: para cambiar de cliente, editás el import de abajo y
// rebuildeás. Ej:
//
//   import { GANADERAS_CONFIG as ACTIVE_CONFIG } from './clients/ganaderas';
//   import { DEMO_CONFIG as ACTIVE_CONFIG } from './clients/demo';
//
// En el futuro (cuando enchufemos Supabase), este archivo se elimina y la
// config viene de un endpoint en runtime. Mientras tanto, este es el único
// archivo que cambia entre builds de distintos clientes.
//
// PARA AGREGAR UN NUEVO CLIENTE:
//   1. Copiá src/config/clients/ganaderas.ts → mi-cliente.ts
//   2. Editá los valores (branding, módulos, catálogos)
//   3. Cambiá el import de abajo
//   4. npm run build:ios (o android)

import { GANADERAS_CONFIG } from './clients/ganaderas';

export const ACTIVE_CONFIG = GANADERAS_CONFIG;
