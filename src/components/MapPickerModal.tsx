// MapPickerModal — selector visual de ubicación GPS sobre un mapa.
//
// Pensado para el form de Mortandad (y eventualmente cualquier otro form
// que necesite GPS). El operario:
//
//   1. Abre el modal desde el form (botón "Elegir en mapa")
//   2. Ve un mapa interactivo centrado en su ubicación actual o en una
//      ubicación pre-seleccionada (si ya tenía coords cargadas)
//   3. Puede arrastrar el pin, tocar en otro lugar para mover el pin,
//      o tocar "Mi ubicación" para centrar y poner el pin donde está
//   4. Confirma → el modal se cierra y devuelve {lat, lon} al form
//
// Decisiones técnicas:
//
// - Usamos `react-native-webview` con HTML inline (Leaflet + tiles de
//   OpenStreetMap). NO react-native-maps porque eso requiere Google
//   Maps API key, build dev de Expo, y romperíamos Expo Go.
// - OpenStreetMap es gratis, sin API key, y los tiles se renderizan
//   bien en la mayoría de zonas rurales argentinas (es el mismo
//   sistema que usamos en el dashboard web).
// - Comunicación HTML ↔ RN vía window.ReactNativeWebView.postMessage.
//
// El HTML está embebido como string (no es un archivo separado) para
// evitar dependencias de bundling. Es ~100 líneas, manejable.

import React, { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore: react-native-webview se instala con `npm install` después
// de agregarlo a package.json. El import dinámico evita warnings cuando
// se levanta el repo por primera vez sin haber corrido install todavía.
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as Location from 'expo-location';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

interface Props {
  /** Coordenadas iniciales del marker. Si no se pasa, intenta usar la
   *  ubicación actual del usuario; si no hay permiso, usa un fallback
   *  regional (centro de Salta / Bermejo aproximado). */
  initialLat?: number;
  initialLon?: number;
  /** Llamado cuando el usuario confirma con un punto válido. */
  onConfirm: (coords: { lat: number; lon: number }) => void;
  /** Llamado si el usuario cancela. */
  onCancel: () => void;
}

// Fallback regional — zona ganadera norte argentino donde está el cliente.
// Mejor que un default global (Greenwich) que descoloca al operario.
const FALLBACK_LAT = -23.5;
const FALLBACK_LON = -64.0;

export function MapPickerModal({ initialLat, initialLon, onConfirm, onCancel }: Props) {
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lon: number } | null>(
    initialLat != null && initialLon != null && Number.isFinite(initialLat) && Number.isFinite(initialLon)
      ? { lat: initialLat, lon: initialLon }
      : null,
  );
  // Ref al WebView para poder inyectar JS (ej: centrar el mapa cuando
  // llega un nuevo fix de GPS automático).
  const webviewRef = useRef<WebView>(null);

  // Latitud/longitud de partida para el render inicial del HTML.
  // Si después el operario pide "Mi ubicación", el JS dentro del WebView
  // pide GPS del lado RN vía postMessage y nosotros mandamos las coords
  // de vuelta para que centre el mapa.
  const startLat = currentCoords?.lat ?? initialLat ?? FALLBACK_LAT;
  const startLon = currentCoords?.lon ?? initialLon ?? FALLBACK_LON;
  const hasInitialPin = currentCoords != null;

  // El HTML es estático — solo se renderea una vez. Los cambios de pin
  // se comunican por postMessage, no re-render. Por eso useMemo.
  const html = useMemo(
    () => buildMapHtml({ startLat, startLon, hasInitialPin }),
    [startLat, startLon, hasInitialPin],
  );

  // Handler de mensajes desde el HTML/Leaflet.
  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data) as
        | { type: 'pinMoved'; lat: number; lon: number }
        | { type: 'requestMyLocation' };
      if (msg.type === 'pinMoved') {
        setCurrentCoords({ lat: msg.lat, lon: msg.lon });
      } else if (msg.type === 'requestMyLocation') {
        capturarYCentrar();
      }
    } catch {
      // mensaje malformado — ignoramos
    }
  };

  // Pide GPS al sistema y, si lo obtiene, manda las coords al WebView
  // para que centre el mapa + mueva el pin.
  const capturarYCentrar = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Sin permiso de ubicación',
          'Activá el permiso de ubicación para ASFION en Ajustes para usar "Mi ubicación".',
        );
        return;
      }
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>(resolve => setTimeout(() => resolve(null), 10000)),
      ]);
      if (!pos) {
        Alert.alert('Sin señal GPS', 'No se pudo obtener la ubicación. Intentá de nuevo en otro lugar o usá el mapa para elegir manualmente.');
        return;
      }
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      setCurrentCoords({ lat, lon });
      // Inyectamos JS para mover el pin y centrar el mapa.
      webviewRef.current?.injectJavaScript(`
        try {
          window.__centerOn(${lat}, ${lon});
        } catch (e) {}
        true;
      `);
    } catch {
      Alert.alert('Error', 'No se pudo obtener la ubicación.');
    }
  };

  return (
    <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onCancel} hitSlop={10} style={styles.headerBtn}>
          <Text style={styles.headerBtnTxt}>Cancelar</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Elegir ubicación</Text>
        <Pressable
          onPress={() => {
            if (!currentCoords) {
              Alert.alert('Sin ubicación seleccionada', 'Tocá en el mapa para elegir un punto o usá "Mi ubicación".');
              return;
            }
            onConfirm(currentCoords);
          }}
          hitSlop={10}
          style={[styles.headerBtn, styles.headerBtnPrimary]}
          disabled={!currentCoords}
        >
          <Text style={[styles.headerBtnTxt, styles.headerBtnPrimaryTxt, !currentCoords && styles.headerBtnDisabled]}>
            Confirmar
          </Text>
        </Pressable>
      </View>

      <WebView
        ref={webviewRef}
        source={{ html }}
        style={styles.webview}
        onMessage={onMessage}
        originWhitelist={['*']}
        // Necesario para que <script> con src CDN funcione.
        javaScriptEnabled
        domStorageEnabled
        // Para que el mapa de Leaflet maneje pinch-zoom bien.
        scalesPageToFit={false}
      />

      <View style={styles.footer}>
        {currentCoords ? (
          <Text style={styles.coordsTxt}>
            📍 {currentCoords.lat.toFixed(5)}, {currentCoords.lon.toFixed(5)}
          </Text>
        ) : (
          <Text style={styles.coordsHint}>Tocá en el mapa o usá "Mi ubicación"</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

// =============================================================================
// HTML del mapa
// =============================================================================

function buildMapHtml({
  startLat,
  startLon,
  hasInitialPin,
}: {
  startLat: number;
  startLon: number;
  hasInitialPin: boolean;
}): string {
  // Truco: estilo viewport para que Leaflet no se pelee con zoom móvil.
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body { margin: 0; padding: 0; height: 100%; font-family: -apple-system, system-ui; }
    #map { width: 100%; height: 100%; }
    .my-location-btn {
      position: absolute;
      bottom: 20px;
      right: 16px;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #fff;
      border: none;
      box-shadow: 0 2px 6px rgba(0,0,0,.2);
      font-size: 22px;
      cursor: pointer;
      z-index: 1000;
      display: grid;
      place-items: center;
    }
    .pin-hint {
      position: absolute;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(8, 28, 40, 0.85);
      color: #fff;
      padding: 8px 14px;
      border-radius: 20px;
      font-size: 12px;
      z-index: 1000;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="pin-hint" id="hint">Tocá el mapa para poner el pin</div>
  <button class="my-location-btn" id="myloc" title="Mi ubicación">📍</button>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map').setView([${startLat}, ${startLon}], ${hasInitialPin ? 15 : 8});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);

    var marker = null;
    var hint = document.getElementById('hint');

    function setMarker(lat, lon) {
      if (marker) {
        marker.setLatLng([lat, lon]);
      } else {
        marker = L.marker([lat, lon], { draggable: true }).addTo(map);
        marker.on('dragend', function() {
          var p = marker.getLatLng();
          notify(p.lat, p.lng);
        });
      }
      notify(lat, lon);
      // Ocultar el hint después de poner el primer pin
      if (hint) { hint.style.display = 'none'; }
    }

    function notify(lat, lon) {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'pinMoved',
          lat: lat,
          lon: lon
        }));
      } catch (e) {}
    }

    // Si arranca con pin (porque ya había coords cargadas), ponerlo.
    if (${hasInitialPin}) {
      setMarker(${startLat}, ${startLon});
    }

    // Tap en el mapa → mover (o crear) el pin.
    map.on('click', function(e) {
      setMarker(e.latlng.lat, e.latlng.lng);
    });

    // Botón "Mi ubicación" — pide al RN que capture GPS y vuelva a
    // llamar window.__centerOn() con las coords obtenidas.
    document.getElementById('myloc').addEventListener('click', function() {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'requestMyLocation'
        }));
      } catch (e) {}
    });

    // Helper expuesta para que RN inyecte JS y centre el mapa cuando
    // obtiene GPS desde el lado nativo (más confiable que navigator.geolocation
    // dentro del WebView).
    window.__centerOn = function(lat, lon) {
      map.setView([lat, lon], 15);
      setMarker(lat, lon);
    };
  </script>
</body>
</html>`;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as '700',
    color: colors.textDark,
  },
  headerBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  headerBtnPrimary: {
    backgroundColor: colors.orange,
  },
  headerBtnTxt: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold as '600',
  },
  headerBtnPrimaryTxt: {
    color: '#fff',
  },
  headerBtnDisabled: {
    opacity: 0.4,
  },
  webview: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  coordsTxt: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold as '600',
    color: colors.textDark,
    fontVariant: ['tabular-nums'],
  },
  coordsHint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});
