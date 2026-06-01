# Configuración por cliente

ASFION es multi-cliente. Cada cliente que usa la app tiene su propia
configuración: branding, módulos habilitados, catálogos. Los screens leen
esa configuración vía un hook (`useClientConfig`), no de constantes
hardcodeadas. Esto permite hacer un build por cliente sin tocar el código
de las pantallas.

## Cómo está organizado

```
src/config/
├── types.ts                  → Define ClientConfig (el contrato)
├── ClientConfigContext.tsx   → Provider + useClientConfig() hook
├── active.ts                 → Selecciona qué cliente compilamos
├── client.ts                 → Capa de compat con código viejo
└── clients/
    ├── ganaderas.ts          → Cliente real (Ganaderas, Salta)
    └── demo.ts               → Cliente de prueba (tambo lechero)
```

## Cómo agregar un cliente nuevo

1. **Copiá el template** más cercano:
   ```bash
   cp src/config/clients/ganaderas.ts src/config/clients/mi-cliente.ts
   ```

2. **Editá los valores** en `mi-cliente.ts`:
   - `id`: slug único (ej. `'estancia-san-julian'`)
   - `branding`: nombre, tagline, logo, color primario
   - `modulosHabilitados`: array con los módulos que el cliente va a usar.
     Opciones: `'pariciones'`, `'lluvias'`, `'mortandad'`, `'pastoreo'`,
     `'mediciones'`. Solo los que estén en la lista aparecen en la home,
     en los tabs y en el navigator.
   - `catalogos`: los valores de cada dropdown/chip por módulo. Si un
     módulo NO está habilitado, igual tenés que poner un objeto con
     arrays vacíos (no podés omitir la key).

3. **Cambiá el cliente activo** en `src/config/active.ts`:
   ```ts
   import { MI_CLIENTE_CONFIG } from './clients/mi-cliente';
   export const ACTIVE_CONFIG = MI_CLIENTE_CONFIG;
   ```

4. **Rebuildeá** la app:
   ```bash
   npm run start              # dev — para probar en Expo Go
   eas build --platform ios   # build de producción
   eas build --platform android
   ```

## Ejemplo: cliente con solo Lluvias

```ts
// src/config/clients/tambo-x.ts
import type { ClientConfig } from '../types';

export const TAMBO_X_CONFIG: ClientConfig = {
  id: 'tambo-x',
  branding: {
    nombre: 'Tambo X',
    tagline: 'Producción lechera',
  },
  modulosHabilitados: ['lluvias'],  // solo lluvias
  catalogos: {
    pariciones: {  // requerido por tipo, pero no se usa
      vacasGrupos: [],
      eventos: [],
      sexos: [],
      asistencia: [],
      caravanaColores: [],
      causaTipos: [],
      causasFrecuentes: [],
    },
    mortandad: { categorias: [], actividades: [], causaTipos: [] },
    pastoreo: { categorias: [], eventos: [], catAnimal: [] },
  },
};
```

Al cambiar `active.ts` a esto y rebuildear, la home muestra UN solo
tile (Lluvias), los tabs son Menú + Lluvias + Métricas, y las rutas
de los otros módulos ni siquiera existen.

## Limitaciones actuales (Fase 1)

- **Un cliente por build.** Si tu amigo tiene 5 clientes, hace 5 builds.
  Esto se va a resolver con Supabase (Fase 2): el cliente activo se
  detecta al login y la config se baja del backend.
- **Catálogos con valores que no matchean las uniones de tipos.** Si un
  cliente nuevo quiere `vacasGrupos: ['Vacas en producción']` en lugar
  de los valores de Ganaderas, el TS va a quejarse (porque `VacasGrupo`
  es una union estricta en `data/types.ts`). Solución temporal: castear
  con `as`. Solución permanente: relajar las unions a `string` o
  generarlas desde el config.
- **Custom fields (campos extras por cliente)** todavía NO están
  soportados. Hoy solo se pueden cambiar los catálogos de campos
  existentes. Para campos COMPLETAMENTE nuevos por cliente (ej. cliente
  Y quiere agregar un campo "Peso al nacer"), necesitamos un sistema de
  custom fields runtime. Fase 3.

## Roadmap

- **Fase 1** ✅ (actual) — Modularidad en código. Un cliente por build.
- **Fase 2** — Supabase backend + persistencia real. La config se baja
  del backend al login en lugar de leerse de un archivo TS.
- **Fase 3** — Admin panel web. Tu amigo edita configs de clientes desde
  un browser, sin necesidad de pedirte un build.
- **Fase 4** — Custom fields runtime. Cada cliente puede agregar campos
  extras a cualquier módulo desde el admin panel.
