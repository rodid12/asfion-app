// Metro config para ASFION.
//
// Resuelve 2 problemas con paquetes de Supabase:
//
// 1) @supabase/realtime-js usa `import(VAR_NAME)` con magic comments
//    para cargar OpenTelemetry opcional. Metro no entiende los comments
//    y serializa el código literal; Hermes (Android) no puede parsear
//    `import(variable)` y falla con "Invalid expression encountered".
//
//    Como ASFION no usa Realtime subscriptions (solo Auth + Postgrest),
//    aliaseamos el package entero a un stub que provee la API mínima.
//    Ver: src/lib/metro-stubs/realtime-js.js
//
// 2) @opentelemetry/api / @opentelemetry/* — el código real de realtime-js
//    intenta cargarlos vía dynamic import. Como ahora el stub reemplaza
//    realtime-js entero, este ya no es necesario, pero lo dejamos por las
//    dudas (otros paquetes también podrían importar OTel y romper).

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const REALTIME_STUB = path.resolve(__dirname, 'src/lib/metro-stubs/realtime-js.js');

const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // 1) Stub completo de @supabase/realtime-js
  if (moduleName === '@supabase/realtime-js') {
    return {
      filePath: REALTIME_STUB,
      type: 'sourceFile',
    };
  }
  // 2) Empty module para cualquier @opentelemetry/* (preventivo)
  if (
    moduleName === '@opentelemetry/api' ||
    moduleName.startsWith('@opentelemetry/')
  ) {
    return { type: 'empty' };
  }
  // Default: delegar al resolver de Expo / Metro
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
