// Stub de @supabase/realtime-js — usado por el alias de metro.config.js.
//
// Por qué existe:
//
// La versión real de @supabase/realtime-js (que viene como transitive dep
// de @supabase/supabase-js) tiene este código:
//
//   const OTEL_PKG = '@opentelemetry/api';
//   private _initOTel(): void {
//     const oTelPromise = import(
//       /* webpackIgnore: true */
//       /* turbopackIgnore: true */
//       /* @vite-ignore */
//       OTEL_PKG
//     ).catch(...);
//   }
//
// Esos magic comments son para Webpack/Vite/Turbopack — les dicen "ignorá
// este import, dejalo runtime". Metro (bundler de RN) NO los entiende y
// serializa el código literal en el bundle. Hermes (engine de Android) no
// puede parsear el `import(VARIABLE)` (solo soporta strings literales) y
// el build falla con:
//
//   error: Invalid expression encountered
//   import(... /* @vite-ignore */ OTEL_PKG).catch...
//
// Como ASFION NO usa Realtime subscriptions (solo Auth + Postgrest), este
// stub provee la API mínima que supabase-js consume en el constructor
// y nunca llegamos a invocar nada que requiera el código real.
//
// Si en el futuro queremos Realtime, hay que:
//   1. Borrar el alias en metro.config.js
//   2. Usar patch-package para parchear @supabase/realtime-js
//   3. O esperar que supabase fixee el dynamic import (tracking issue en
//      github.com/supabase/realtime-js)

// ----- Constantes que supabase-js puede re-exportar -----

const REALTIME_CHANNEL_STATES = {
  closed: 'closed',
  errored: 'errored',
  joined: 'joined',
  joining: 'joining',
  leaving: 'leaving',
};

const REALTIME_LISTEN_TYPES = {
  BROADCAST: 'broadcast',
  PRESENCE: 'presence',
  POSTGRES_CHANGES: 'postgres_changes',
  SYSTEM: 'system',
};

const REALTIME_PRESENCE_LISTEN_EVENTS = {
  SYNC: 'sync',
  JOIN: 'join',
  LEAVE: 'leave',
};

const REALTIME_POSTGRES_CHANGES_LISTEN_EVENT = {
  ALL: '*',
  INSERT: 'INSERT',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
};

const REALTIME_SUBSCRIBE_STATES = {
  SUBSCRIBED: 'SUBSCRIBED',
  TIMED_OUT: 'TIMED_OUT',
  CLOSED: 'CLOSED',
  CHANNEL_ERROR: 'CHANNEL_ERROR',
};

// ----- Clases stub -----

class RealtimeChannel {
  constructor(topic, params, socket) {
    this.topic = topic;
    this.params = params;
    this.socket = socket;
    this.state = REALTIME_CHANNEL_STATES.closed;
    this.bindings = {};
  }
  on() { return this; }
  send() { return Promise.resolve('ok'); }
  subscribe(callback) {
    if (callback) callback(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED, undefined);
    return this;
  }
  unsubscribe() { return Promise.resolve('ok'); }
  presenceState() { return {}; }
  track() { return Promise.resolve('ok'); }
  untrack() { return Promise.resolve('ok'); }
}

class RealtimeClient {
  constructor(endPoint, options) {
    this.endPoint = endPoint;
    this.options = options || {};
    this.channels = [];
    this.accessToken = null;
  }
  channel(topic, params) {
    const ch = new RealtimeChannel(topic, params, this);
    this.channels.push(ch);
    return ch;
  }
  removeChannel() { return Promise.resolve('ok'); }
  removeAllChannels() { return Promise.resolve(['ok']); }
  getChannels() { return this.channels; }
  setAuth(token) { this.accessToken = token; }
  connect() {}
  disconnect() {}
  isConnected() { return false; }
  log() {}
}

// ----- Exports compatibles con realtime-js real -----

module.exports = {
  RealtimeClient,
  RealtimeChannel,
  REALTIME_CHANNEL_STATES,
  REALTIME_LISTEN_TYPES,
  REALTIME_PRESENCE_LISTEN_EVENTS,
  REALTIME_POSTGRES_CHANGES_LISTEN_EVENT,
  REALTIME_SUBSCRIBE_STATES,
  // Default export por las dudas (algunos consumers usan default)
  default: { RealtimeClient, RealtimeChannel },
};
