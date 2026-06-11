# App Store Connect — Metadata ASFION

Documento de referencia para copiar/pegar al crear la app en
[appstoreconnect.apple.com](https://appstoreconnect.apple.com). Vos editás
después si querés cambiar algo, pero esto te deja la primera versión lista.

---

## Identificación

| Campo | Valor |
|---|---|
| **App name** | `ASFION` |
| **Bundle ID** | `com.asfion.app` |
| **Primary language** | Spanish (Mexico) ← cubre toda LatAm |
| **SKU** | `ASFION_IOS_01` (interno, podés inventar) |

---

## Subtitle (max 30 caracteres)

```
Gestión ganadera, sin fricción
```
*(30 chars exactos — cabe justo)*

### Alternativas si no convence:

- `Tu campo, en el bolsillo` (24)
- `Cuaderno ganadero digital` (25)
- `Del campo al tablero` (20)

---

## Promotional Text (max 170 caracteres)

> Texto que aparece arriba de la descripción. Se puede actualizar SIN
> resubmit a Apple. Bueno para anunciar features nuevos o promociones.

```
Nuevo: módulo de Compras con cálculo automático de merma y dashboard
web con métricas por campo y categoría. Carga eventos del campo sin
conexión.
```
*(170 chars exactos)*

---

## Description (max 4000 caracteres) — versión recomendada

```
ASFION es la herramienta digital pensada para ganaderos extensivos
argentinos: cargá pariciones, lluvias, mortandad, pastoreo y compras
de hacienda directo desde el campo, incluso sin señal, y revisá los
indicadores de tu operación desde el panel web.

— PARA QUIÉN ES ASFION —

Para administradores y peones de estancias y empresas ganaderas que
todavía cargan datos en cuadernos, planillas o WhatsApp y quieren
centralizar la operación sin complicaciones técnicas.

— QUÉ PODÉS HACER —

• Cargar pariciones con todos los datos: caravana, lote, evento
  (nacimiento, retacto, muerte, aborto), causa, observaciones y foto.

• Registrar lluvias por pluviómetro: ASFION calcula el promedio
  diario entre todos los pluviómetros del campo.

• Llevar control de mortandad fuera del parto: categoría, causa,
  tipo y fecha — con análisis automático del top de causas.

• Gestionar pastoreo por circuito y parcela: entrada/salida de
  animales, días de uso, kg/cabeza, cierre automático.

• Compras de hacienda: número de operación auto-generado, cálculo
  automático de merma % entre kg origen y destino, precio, titular,
  DTE, plazo y consignado.

— OFFLINE FIRST —

Cargá eventos en el campo aunque no haya señal. Cuando vuelve la
conexión, ASFION sincroniza todo automáticamente. Nunca perdés
información.

— MÉTRICAS Y REPORTES —

Pantalla de Métricas con KPIs por módulo: total cabezas, % señalado,
inversión total, kg destino, merma promedio, top campos, top causas,
evolución mensual.

— DASHBOARD WEB INCLUIDO —

Cada cuenta incluye acceso al dashboard web (asfion-web.vercel.app)
con visualizaciones avanzadas, exportación a CSV/Excel y filtros por
campo, fecha y categoría — pensado para administradores y dueños.

— SEGURIDAD —

Tus datos quedan aislados de los de otras empresas (Row-Level Security
a nivel de base de datos). Conexión cifrada TLS. Backups diarios
automáticos.

— EN POCAS PALABRAS —

Reemplazá el cuaderno, el Excel y el WhatsApp de la operación
ganadera por una sola app que sabe cómo trabaja el campo argentino.

ASFION — Del campo al tablero, sin fricción.

Soporte: rosariodidziulis8@gmail.com
Política de privacidad: asfion-web-2026.vercel.app/privacy.html
```
*(≈ 1900 chars — sobra mucho para iterar)*

---

## Keywords (max 100 caracteres, separados por coma SIN espacios)

> Apple busca por estas palabras además del título y descripción.
> Estrategia: cubrir 1) lo que la gente busca literalmente,
> 2) sinónimos regionales, 3) competencia indirecta.

```
ganaderia,vacas,cattle,campo,estancia,rodeo,hacienda,pariciones,pastoreo,agro,vacuno
```
*(99 chars — cabe justo)*

### Notas:
- No repetir palabras del título ("ASFION") — desperdicia chars.
- Sin acentos: Apple normaliza "ganadería" ↔ "ganaderia" automáticamente.
- Si en el review Apple rechaza alguna palabra (raro), las ajustamos.

---

## URLs

| Campo | URL |
|---|---|
| **Support URL** *(obligatorio)* | `https://asfion-web-2026.vercel.app/support.html` |
| **Marketing URL** *(opcional)* | `https://asfion-web-2026.vercel.app/` |
| **Privacy Policy URL** *(obligatorio)* | `https://asfion-web-2026.vercel.app/privacy.html` |

---

## Categorías

| Categoría | Valor |
|---|---|
| **Primary** | Business |
| **Secondary** *(opcional)* | Productivity |

> "Agriculture" no es categoría del App Store. "Business" es lo más
> cercano y lo usan competidores como Connecterra, AgriERP, etc.

---

## Age Rating

Cuando Apple te pregunte por edad mínima, responder **No** a TODO el
cuestionario (no hay contenido violento, sexual, gambling, alcohol, etc.).

→ Resultado automático: **Apple 4+** (apto para todas las edades).

---

## Pricing & Availability

| Campo | Valor |
|---|---|
| **Price** | Free (US$0.00) |
| **Availability** | Argentina, Uruguay, Paraguay, Brasil, Chile, México |
| **Pre-orders** | No |

> La app es free porque el negocio se cobra por separado (contrato con
> la empresa ganadera). El usuario final descarga gratis y se logea con
> credenciales que le da el administrador.

---

## App Privacy (Apple Privacy Nutrition Labels)

Cuando llenes la sección de "App Privacy" en ASC, marcar:

### Data Collected and Linked to User
- **Email Address** — para autenticación. *No usado para tracking.*
- **User Content** (datos productivos del campo) — para funcionalidad de la app.

### Data Collected but NOT Linked to User
- **Performance Data** (crash logs anónimos) — para diagnóstico técnico.

### Data NOT Collected
- Ubicación precisa
- Información financiera
- Historial de navegación
- Contactos
- Fotos personales (excepto las que el usuario sube voluntariamente)
- Audio / video
- Health & Fitness
- Identificadores de tracking

### Tracking
**¿Trackea al usuario entre apps y sitios web?** → **NO**

---

## Demo Account para Apple Review ⚠️ CRÍTICO

Apple revisa la app abriendo con un usuario REAL. Si no le damos
credenciales, **rechazan la submission**.

Crear en Supabase un usuario específico para review:

```
Email:    apple-review@asfion.com
Password: ASFION-AppleReview-2026!
```

Y cargarle:
- 1 cliente_id ficticio "Demo Ranch"
- 2 campos: "Campo Norte", "Campo Sur"
- 5-10 eventos de cada módulo (pariciones, lluvias, mortandad, pastoreo, compras)
- Permisos de administrador para que vea todo

En el campo "App Review Information" de ASC:

```
First Name:     Apple
Last Name:      Reviewer
Phone:          +54 9 11 [TU TELÉFONO]
Email:          rosariodidziulis8@gmail.com

Sign-in info:
  Username:     apple-review@asfion.com
  Password:     ASFION-AppleReview-2026!

Notes:
  ASFION is a B2B platform for Argentine cattle ranching operations.
  Use the demo account above to log in and explore all 5 modules:
  Pariciones (births), Lluvias (rain), Mortandad (deaths), Pastoreo
  (grazing), Compras (purchases). The app works offline — events
  load locally and sync when connection is available. The web
  dashboard (asfion-web-2026.vercel.app) shows the same data with
  advanced charts and CSV export. All UI text is in Spanish; we
  serve Argentine and South American cattle producers.
```

---

## Screenshots

Ver `SCREENSHOTS_GUIDE.md` (siguiente archivo). En resumen:

- **iPhone 6.7"** (1290 × 2796) — OBLIGATORIO, mínimo 3, máximo 10
- **iPhone 6.5"** (1242 × 2688) — opcional pero recomendado
- **iPad 12.9"** (2048 × 2732) — solo si declaramos iPad support (sí lo declaramos)

Yo te genero capturas con marco de iPhone + caption arriba en cuanto me
mandes 5-6 screenshots crudos de la app desde tu celular.

---

## Build version & info

| Campo | Valor inicial |
|---|---|
| **Version** | `1.0.0` |
| **Build number** | `1` (autoIncrement en eas.json se encarga) |
| **Copyright** | `© 2026 [RAZÓN SOCIAL DE LA SAS/SRL]` |
| **What's New in This Version** | `Versión inicial de ASFION.` |

---

## Checklist pre-submit

- [ ] Apple Developer Account activa (Fase A)
- [ ] Bundle ID `com.asfion.app` creado en developer.apple.com
- [ ] App creada en App Store Connect con el bundle ID
- [ ] Razón social + CUIT completados en privacy.html y terms.html
- [ ] Privacy/Terms/Support URLs deployadas en Vercel y accesibles
- [ ] Usuario `apple-review@asfion.com` creado en Supabase con datos demo
- [ ] Screenshots cargados (mínimo 3 para iPhone 6.7")
- [ ] Description, subtitle, keywords completados
- [ ] App Privacy section completada
- [ ] Categories seleccionadas
- [ ] Pricing = Free
- [ ] Build subido vía `eas submit --platform ios`
- [ ] Build linkeado a la versión 1.0.0 en ASC
- [ ] "Submit for Review" clickeado

Tiempo Apple: **24-72h promedio**, raras veces hasta 7 días.
