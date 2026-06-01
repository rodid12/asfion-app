// Metro config para ASFION.
//
// Por qué existe este archivo (y no usamos solo el default de Expo):
//
// `@supabase/realtime-js` (transitive dep de `@supabase/supabase-js`)
// hace `import(/* webpackIgnore: true */ ... OTEL_PKG)` para cargar
// OpenTelemetry de forma opcional. Esos comments mágicos son para
// Webpack/Vite/Turbopack, pero Metro (bundler de RN) no los entiende
// y serializa el código literal en el bundle. Después Hermes (engine
// JS de Android) falla al parsearlo porque `OTEL_PKG` queda como una
// variable sin resolver:
//
//   error: Invalid expression encountered
//   import(... /* @vite-ignore */ OTEL_PKG).catch...
//
// En iOS no aparece (usa JSC). En Android sí (usa Hermes por default
// en Expo SDK 50+).
//
// Fix: aliasamos @opentelemetry/api a un módulo vacío. No usamos OTel
// en la app, así que stub-earlo es seguro. Si en el futuro queremos
// observabilidad real, instalamos @opentelemetry/api en serio y
// borramos este alias.

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Stub para @opentelemetry/api — ver comment de arriba.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === '@opentelemetry/api' ||
    moduleName.startsWith('@opentelemetry/')
  ) {
    return { type: 'empty' };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
