# Supabase — Setup paso a paso

Esta carpeta contiene todo lo necesario para tener ASFION corriendo contra
un backend de Supabase real (en lugar del mock InMemoryBackend actual).

## 1. Crear el proyecto Supabase (5 min)

1. Ir a https://supabase.com → "Start your project"
2. Login con GitHub o email
3. Click "New project"
4. Datos:
   - **Name**: `asfion` (o lo que quieras)
   - **Database password**: generá una larga, guardala en un password manager
   - **Region**: South America (Sao Paulo) — más cerca de Argentina = menos latencia
   - **Pricing plan**: Free (alcanza para Ganaderas y los primeros 2-3 clientes)
5. Esperá ~2 minutos a que el proyecto se aprovisione

## 2. Aplicar las migrations (5 min)

1. En el dashboard, ir a "SQL Editor" (sidebar izquierdo)
2. Click "+ New query"
3. Copiar todo el contenido de `0001_init.sql`, pegar, click "Run"
4. Esperar ~5 segundos. Debería decir "Success".
5. Repetir con `0002_seed_ganaderas.sql` (tarda 30-60 segundos por los 3263 inserts).
6. Verificar: ir a "Table Editor" → ves las tablas creadas y la data de Ganaderas.

**Si algo falla** (típico en seed): verás un error como "violates foreign key
constraint". Significa que un evento referencia un campo/lote/circuito que
no se creó. Avisame el ID que está fallando y lo arreglo.

## 3. Obtener las credenciales (1 min)

Ir a "Settings" → "API" en el dashboard. Vas a ver:

- **Project URL**: `https://xxxxx.supabase.co` — esto es público, puede ir en git.
- **anon public key**: una clave JWT larga — **también puede ir en git**.
  Es la clave que usa la app móvil para leer/escribir respetando RLS.
- **service_role secret**: NO compartas esto, NO va en git.
  Solo se usa desde el backend o scripts admin (bypassea RLS).

## 4. Configurar la app móvil

En la carpeta raíz del proyecto, crear `.env.local`:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJI...
```

(Lo mismo en `.env.local.example` ya está versionado con valores vacíos
como guía.)

Después, en `App.tsx`, cambiar:

```tsx
<RepositoryProvider kind="memory">
```

por:

```tsx
<RepositoryProvider kind="supabase">
```

Y reiniciar la app. Ahora lee y escribe directo a Supabase.

## 5. Verificar que funciona

Login con un email de Ganaderas (ej. `agusufi20@gmail.com`). Deberías ver:
- Home con los 4 módulos habilitados
- Pariciones con 2542 registros reales
- Lluvias con 369, Mortandad con 133, Pastoreo con 219

Si todo eso aparece, está funcionando contra Supabase de verdad.

## 6. Agregar un cliente nuevo

Hasta que tengamos el panel admin custom (Fase 3), tu amigo agrega clientes
nuevos directo desde Supabase Studio:

1. "Table Editor" → tabla `clientes` → "Insert row"
2. Completar `id`, `nombre`, `modulos_habilitados` (array de strings),
   `catalogos` (un JSON con la estructura que ves en `0002_seed_ganaderas.sql`)
3. Save
4. Después agregar los campos/lotes/etc del cliente en sus respectivas tablas
5. Después agregar los emails de los usuarios del cliente en tabla `usuarios`
   con `cliente_id` apuntando al nuevo cliente
6. Esos usuarios al loguearse ven SU app, no la de Ganaderas

## Roadmap

- **Ahora**: Supabase configurado y la app móvil leyendo/escribiendo real
- **Siguiente**: Auth real (Supabase Auth en lugar del mock)
- **Después**: Sync offline (queue cuando no hay red)
- **Después**: Admin panel custom para que tu amigo no toque Supabase Studio

## Troubleshooting

**"new row violates row-level security policy"**: el usuario logueado no
tiene `cliente_id` en la tabla `usuarios`, o no coincide con el `cliente_id`
del row que está intentando insertar. Verificá los seeds.

**"PGRST116 — JSON object requested, multiple (or no) rows returned"**:
una query devolvió 0 o N rows cuando esperaba 1. Pasa típicamente con
`usuario.cliente_id` mal asignado.

**Lentitud al cargar listas**: agregar paginación al backend
(`.range(start, end)` en lugar de `.select('*')`). El primer release puede
descargar todo, pero con 10k+ registros conviene paginar.
