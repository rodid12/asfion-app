# ASFION App

App mobile (React Native + Expo) que reemplaza la versión actual de AppSheet.
Pensada para que un peón cargue datos en el campo, con o sin señal, y que un
encargado/admin después pueda visualizarlos.

> **Estado**: scaffold + módulo Pariciones funcional con backend en memoria.
> Los otros 4 módulos (Lluvias, Mortandad, Pastoreo, Mediciones) tienen el
> modelo de datos definido pero aún no UI. Se hacen copiando el template de
> Pariciones — tipo 1 día por módulo.

---

## Cómo correrla

Necesitás Node 18+ y la app **Expo Go** instalada en tu celular
(iOS App Store / Google Play). Tu compu y tu celu deben estar en la misma red Wi-Fi.

```bash
cd asfion-app
npm install
npx expo start
```

Vas a ver un QR en la terminal. Escaneálo:

- **iOS**: con la cámara nativa.
- **Android**: desde la app Expo Go (pestaña "Scan QR Code").

La app abre en el celular. Cualquier cambio en el código se refresca solo (Fast Refresh).

### Login de demo

Cualquier email/contraseña funciona. El **rol se infiere del email**:

- Email contiene `admin` → rol `admin`
- Email contiene `encargado` → rol `encargado`
- Cualquier otra cosa → rol `peon`

(Esto es solo para que en la demo se vea cómo cambia la UI según el rol;
en producción el login será real contra Sheets / Supabase.)

---

## Qué se puede hacer hoy

1. **Login** (demo, cualquier email).
2. **Ver el grid de 5 módulos** en el Home.
3. **Cargar una parición**:
   - Seleccionar campo + lote
   - Grupo de vacas, evento (Nacimiento / Muerte / Retacto / Aborto)
   - Sexo, asistencia, caravana (color + número)
   - Causa (si aplica), observaciones
   - Captura automática de GPS si el usuario da permiso
   - Guarda en local; si hay backend online, sincroniza
4. **Ver lista** de pariciones cargadas, con el estado de sync (OK / pendiente / error).
5. **Sincronizar pendientes** manualmente desde la lista.

Todo persiste en `AsyncStorage` así que sobrevive a cerrar y reabrir la app.

---

## Arquitectura

```
App.tsx
  └── SafeAreaProvider
       └── RepositoryProvider (kind="memory")
            └── AuthProvider
                 └── RootNavigator
                      ├── LoginScreen
                      └── Home / ParicionForm / ParicionList
```

### Capa de datos

Lo más importante de este scaffold es el **patrón Repository**: ningún screen
habla directo con Sheets / Supabase / lo que sea. Toda la app pasa por
`useRepository()`. Cuando cambiemos el backend (de memoria a Sheets a Supabase),
no se toca un solo screen.

```
src/data/
  types.ts            ← modelo de datos (Paricion, Lluvia, ...)
  repository.ts       ← interface IDataBackend + clase Repository
  index.ts            ← RepositoryProvider + useRepository
  backends/
    memory.ts         ← In-memory + AsyncStorage. ✅ funciona
    sheets.ts         ← skeleton para Google Apps Script Web App. 🚧 pendiente
```

Para activar Sheets cuando esté listo: cambiar `kind="memory"` por
`kind="sheets"` en `App.tsx` y configurar el endpoint del Web App.

### Sync queue

Cuando `repo.saveEvento(...)` se llama:

1. Marca el evento como `syncing` y trata de subirlo al backend.
2. Si funciona → estado `synced`.
3. Si falla por red → estado `pending`, lo encola, y devuelve OK al usuario.

El usuario nunca espera la red. La barra superior del Home muestra el contador
de pendientes; el botón "Sincronizar pendientes" en la lista intenta el flush.

### UI / componentes

```
src/components/
  ChipGroup.tsx       ← grupos de opciones tipo radio (Nacimiento|Muerte|...)
  FormField.tsx       ← inputs de texto con label
  PrimaryButton.tsx   ← CTAs grandes (mín 72pt — pulgar con guante)
  Tile.tsx            ← cuadros grandes del grid del Home
  SyncBadge.tsx       ← badge visual del estado de sync
```

Todos respetan los **touch targets para campo con guantes** (mín 56pt) y la
paleta del deck (`src/theme/colors.ts`).

---

## Cómo agregar un módulo nuevo (ej. Lluvias)

1. **Tipos**: el shape `Lluvia` ya existe en `src/data/types.ts`.
2. **Pantallas**: copiar
   `src/screens/pariciones/ParicionFormScreen.tsx` →
   `src/screens/lluvias/LluviaFormScreen.tsx`.
   Cambiar:
   - el `Paricion` por `Lluvia`
   - los `ChipGroup` por los inputs propios (pluviómetro + milímetros)
   - el botón guarda usa el mismo `repo.saveEvento(...)` — no cambia nada
3. **Navegación**: agregar `LluviaForm` y `LluviaList` a
   `src/navigation/types.ts` y registrarlas en `RootNavigator.tsx`.
4. **Home**: en `HomeScreen.tsx`, marcar `enabled: true` en el módulo Lluvias y
   apuntar `go` al nuevo screen.

Tiempo estimado: ~half a day por módulo si seguís el patrón.

---

## Lo que falta (próximos pasos)

- [ ] Implementar `GoogleSheetsBackend` real (Apps Script Web App)
- [ ] Módulos Lluvias, Mortandad, Pastoreo, Mediciones (template copiado)
- [ ] DateTimePicker (hoy la fecha es siempre hoy)
- [ ] Sync automático cuando vuelve la conexión (escuchar `expo-network`)
- [ ] Pantallas de admin (alta de campos / lotes / usuarios)
- [ ] Reportes — equivalente al Power BI actual (puede ser web separado)
- [ ] Build de producción (EAS Build) y publicación a TestFlight + Play Store

---

## Comandos útiles

```bash
npm run typecheck    # chequea TypeScript
npm start            # = expo start
npm run android      # abre en Android directo (con emulador o cable)
npm run ios          # abre en iOS Simulator (solo Mac)
```
