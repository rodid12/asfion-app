# Screenshots — Guía paso a paso

## Por qué importa tanto

Los screenshots son **el principal factor de conversión en App Store**.
Apple además los usa en el review: si las capturas no muestran las
features descritas, te pueden rechazar por "Misleading Marketing".

---

## Specs técnicos exigidos por Apple

### iPhone 6.7" — **OBLIGATORIO**
- Tamaño: **1290 × 2796** píxeles
- Devices que matchean: iPhone 14/15/16 Pro Max, iPhone 15/16 Plus
- Mínimo: **3 screenshots**, máximo 10

### iPhone 6.5" — **opcional pero recomendado**
- Tamaño: **1242 × 2688** píxeles
- Devices: iPhone 11 Pro Max, XS Max, XR
- Si lo cargás, mejora cobertura visual en App Store

### iPad 12.9" — **OBLIGATORIO si declaramos iPad support**
- Tamaño: **2048 × 2732** píxeles
- En `app.json` tenemos `supportsTablet: true`, así que Apple lo va a pedir
- Mínimo: 3 screenshots de iPad

**Nota:** si NO querés subir screenshots de iPad ahora, hay que cambiar
`supportsTablet` a `false` en `app.json`. Recomiendo dejarlo en `true`
para no perder mercado, y subir 3 screenshots simples de iPad.

---

## Qué pantallas capturar — orden recomendado (story-driven)

Apple muestra los screenshots EN ORDEN. El primero es el más importante
(es el que se ve en search results). Estrategia:

| # | Pantalla | Caption sugerido arriba |
|---|---|---|
| 1 | **Home** con tiles de los 5 módulos | "Tu campo, en el bolsillo" |
| 2 | **Lista de pariciones** con datos | "Cada parición, registrada al instante" |
| 3 | **Form de parición** con caravana llena | "Carga rápida, hasta sin señal" |
| 4 | **Métricas — Resumen** con KPIs y charts | "Indicadores en tiempo real" |
| 5 | **Detalle de compra** | "Compras con merma automática" |
| 6 | **Dashboard web** (opcional, screenshot del navegador) | "Panel web para administradores" |

3-6 capturas es el sweet spot. Más de 6 se vuelven invisibles.

---

## Cómo sacar los screenshots

### Opción 1: desde tu iPhone real (RECOMENDADO)

1. Abrí ASFION en tu iPhone (build EAS preview que ya tenés instalado).
2. Logeate con el usuario admin de Ganaderas (así se ve data real).
3. Navegá a la pantalla que querés capturar.
4. **Botón lateral derecho + Volumen UP simultáneamente** → screenshot.
5. La imagen queda en Fotos. Resolución: 1290×2796 si es iPhone Pro Max.

⚠️ **Antes de capturar, asegurate de:**
- Status bar limpio: poné el celular en modo avión + WiFi + 9:41 AM
  (Apple "exige" 9:41 pero en la práctica no rechazan por la hora)
- Batería al 100% si se puede
- Sin notificaciones tapando contenido
- Modo claro (light), no oscuro

### Opción 2: desde el simulator de iOS (necesita Mac)

```bash
# Si tenés Mac:
cd asfion-app
npx expo start
# Tocar 'i' para abrir iOS simulator
# Elegir "iPhone 15 Pro Max" para tamaño 6.7"
# Cmd+S para guardar screenshot
```

### Opción 3: yo te genero "marketing screenshots"

Mandame los screenshots crudos (los .PNG que sacaste con el celular) y
yo les agrego:
- Marco de iPhone alrededor (más prosumer)
- Background gradient navy/orange
- Caption arriba ("Tu campo, en el bolsillo")
- Tamaño exacto 1290×2796

Es lo que ves en App Store de apps profesionales (Notion, Linear,
Things, etc.). Mucho mejor conversión que screenshots pelados.

---

## Errores comunes a evitar

| Error | Por qué |
|---|---|
| Cargar screenshots de tamaño incorrecto | Apple los rechaza |
| Datos personales sensibles a la vista | Privacy issue + rejection |
| Logo de otra empresa visible | Trademark issue |
| Texto en inglés cuando declaramos español | "Misleading metadata" |
| Mockups artísticos sin pantallas reales | "Misleading marketing" |
| Status bar con WiFi débil + batería baja | Se ve no profesional |

---

## ¿Qué te pido AHORA?

Mandame **6 screenshots crudos del iPhone** (los .PNG del celular,
sin editar) con las pantallas:

1. ✅ Home con los 5 módulos visibles
2. ✅ Lista de Pariciones (con bastantes items)
3. ✅ Form de Parición (con datos cargados)
4. ✅ Métricas → tab Resumen
5. ✅ Detalle de Compra (con consignado destacado arriba)
6. ✅ (Opcional) Dashboard web abierto desde iPhone Safari

Con eso te armo las 6 versiones marketing — listas para subir a App
Store Connect. Si querés capturas más simples (sin marco ni captions),
las usamos tal cual y listo.

---

## Bonus: para el dashboard web (Vercel)

Mientras estés en eso, también te recomiendo sacar screenshots del
dashboard web abierto en una PC (1920×1080) para usar en:
- El sitio marketing
- LinkedIn post de lanzamiento
- Material comercial

Eso ya no es para App Store, es para Marketing general.
