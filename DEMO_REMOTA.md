# Demo remota a un iPhone — Paso a paso

Esta guía es para mostrarle ASFION a alguien que está en otra ciudad / red wifi,
usando **Expo Go** (gratis, sin cuenta de Apple Developer). Requiere que tu compu
esté prendida con el dev server corriendo durante la demo.

## Pre-requisitos en TU compu (Mac o Windows)

1. **Node.js 18 o superior**. Verificá con:
   ```bash
   node --version
   ```
   Si no lo tenés, descargalo de https://nodejs.org (versión LTS).

2. **Conexión estable a internet**. El tunnel pasa por servidores de Expo en EEUU,
   así que latencia decente ayuda.

## Pre-requisitos en el iPhone de tu amigo

1. Instalar **Expo Go** desde la App Store (es gratis, app oficial de Expo).
   Link directo: https://apps.apple.com/app/expo-go/id982107779

## Setup local — UNA sola vez

Desde la terminal, en la carpeta del proyecto:

```bash
npm install
```

Esto baja todas las dependencias (~5-10 minutos la primera vez, después es
instantáneo). Genera la carpeta `node_modules` que pesa ~330MB.

## Arrancar el dev server con tunnel

```bash
npx expo start --tunnel
```

La primera vez te va a pedir instalar `@expo/ngrok` — decile que sí (Y).

Después de unos segundos vas a ver en la terminal:
- Un **QR code** grande
- Una URL tipo `exp://xxxx-xxxx.exp.direct` (si es tunnel) o
  `exp://192.168.x.x:8081` (si es local — esto NO sirve para tu amigo).
- **Importante**: tiene que decir `Tunnel ready` antes de pasar el link, si no
  todavía está bootstrapeando.

## Pasarle el link a tu amigo

Tenés dos formas:

**Forma A — Mandarle la URL por mensaje:**
1. Copiá la URL `exp://xxxx-xxxx.exp.direct` que aparece en la terminal.
2. Mandásela por WhatsApp / mail / lo que sea.
3. Tu amigo la abre desde su iPhone. iOS le va a preguntar si quiere abrir
   en Expo Go — decile que sí.

**Forma B — Mandarle el QR:**
1. Sacá foto de la pantalla con el QR.
2. Mandásela por WhatsApp.
3. Tu amigo abre Expo Go en su iPhone, va a la pestaña "Home" y toca
   "Scan QR code". Apunta la cámara al QR (en otra pantalla) y listo.

## Lo que va a pasar en su iPhone

- Primer launch: **15-30 segundos** bajando el bundle de JavaScript.
- A partir de ahí, abre rápido.
- Va a verse exactamente como la app real, pero adentro del "envoltorio" de
  Expo Go (vas a ver una barrita arriba con un menú de developer — para
  cerrarla decile que la oculte, o reiniciar Expo Go).
- Login con cualquier email/password — aclarale que es demo. "admin@..." → rol
  administrador, "moderador@..." → rol moderador, cualquier otro → operario.

## Mientras dura la demo

- Tu compu tiene que seguir prendida con el dev server corriendo.
- Si cerrás la terminal o suspendés la laptop, la app deja de funcionar para él.
- Si actualizás código en tu compu, la app se actualiza automáticamente en el
  iPhone (Fast Refresh) — es magia.

## Troubleshooting

| Síntoma | Qué hacer |
|---------|-----------|
| "Tunnel connection failed" en la terminal | Reintentar. A veces el tunnel tarda. |
| Tu amigo abre Expo Go pero no carga la app | Confirmar que la URL empieza con `exp://` y NO con `http://`. |
| App carga pero crashea apenas entra | Probablemente versión de Expo Go vieja. Que actualice desde la App Store. |
| "Network error" al abrir | Tu amigo tiene firewall corporativo. Que pruebe con datos móviles. |
| Va lento | Latencia del tunnel. Andá con paciencia o probá `--lan` si están en la misma red. |

## Limitaciones de la demo via Expo Go

- Algunos features pueden andar levemente distinto que en una app instalada
  (por ejemplo: notificaciones push no funcionan, el splash screen es el de
  Expo Go).
- Tu amigo no la puede dejar instalada como app independiente — solo abrirla
  desde adentro de Expo Go cada vez.
- Para una experiencia "instalada de verdad" en iPhone, necesitamos cuenta de
  Apple Developer + TestFlight.

## Cuando estés listo para algo más serio

Cuando saques la cuenta de Apple Developer, podemos:
1. Buildear con `eas build --platform ios --profile preview`.
2. Subir a TestFlight con `eas submit`.
3. Tu amigo se invita por email, la instala como app real (sin Expo Go), la
   tenés siempre disponible (no depende de tu compu prendida).
