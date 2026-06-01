// LineChart pure-RN sin dependencias externas.
//
// Problema: queremos gráficos de líneas en la app pero no tenemos
// react-native-svg ni librerías de charts instaladas. Para evitar agregar
// deps que requieran rebuild de EAS, dibujamos el polyline usando solo
// componentes View con position absolute, rotados al ángulo del segmento.
//
// Cada segmento entre puntos (i, i+1) se renderea como un View de:
//   - width = distancia entre puntos
//   - height = STROKE
//   - rotación = atan2(dy, dx)
//   - posición = (x_i, y_i)
//   - origin = "left center" (default de React Native)
//
// Limitaciones:
//   - No hay curvas suaves (Bezier) — solo polyline.
//   - Ejes y grilla son views planos, no SVG.
//   - Si hay >~80 puntos, se ve apretado en pantallas chicas.
//
// Si el cliente quiere curvas suaves, agregamos react-native-svg al
// próximo build EAS y cambiamos a <Path d="M... C..."/>.

import React, { useMemo } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

export interface LinePoint {
  /** Etiqueta X (corta — '15/03', no la fecha completa). */
  x: string;
  /** Valor numérico (mm, cantidad, etc.). */
  y: number;
}

interface Props {
  points: LinePoint[];
  /** Color de la línea. */
  color?: string;
  /** Alto total del chart (incluye ejes). */
  height?: number;
  /** Cantidad máxima de etiquetas X a mostrar (sampling). */
  maxXLabels?: number;
  /** Unidad para el tooltip / fallback del eje Y (ej. "mm"). */
  yUnit?: string;
}

export function LineChart({
  points,
  color = '#3E8AB4',
  height = 220,
  maxXLabels = 6,
  yUnit = '',
}: Props) {
  const [width, setWidth] = React.useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  // Padding interno: dejamos espacio para etiquetas del eje Y (izq) y
  // etiquetas del eje X (abajo). El chart en sí ocupa el rectángulo interior.
  const PAD_LEFT = 36;
  const PAD_RIGHT = 12;
  const PAD_TOP = 14;
  const PAD_BOTTOM = 24;

  const innerW = Math.max(0, width - PAD_LEFT - PAD_RIGHT);
  const innerH = Math.max(0, height - PAD_TOP - PAD_BOTTOM);

  const { maxY, yTicks } = useMemo(() => {
    const max = points.reduce((m, p) => Math.max(m, p.y), 0);
    // Redondeamos hacia arriba a un múltiplo "lindo" para el eje Y.
    let nice = 1;
    if (max <= 10) nice = 10;
    else if (max <= 50) nice = 50;
    else if (max <= 100) nice = 100;
    else if (max <= 200) nice = 200;
    else if (max <= 500) nice = 500;
    else nice = Math.ceil(max / 100) * 100;
    return {
      maxY: nice,
      yTicks: [0, nice / 2, nice],
    };
  }, [points]);

  // Coords de cada punto en píxeles dentro del chart.
  const pts = useMemo(() => {
    if (points.length === 0 || innerW <= 0 || innerH <= 0) return [];
    if (points.length === 1) {
      return [{ x: innerW / 2, y: innerH - (points[0]!.y / maxY) * innerH, raw: points[0]! }];
    }
    const step = innerW / (points.length - 1);
    return points.map((p, i) => ({
      x: i * step,
      y: innerH - (p.y / maxY) * innerH,
      raw: p,
    }));
  }, [points, innerW, innerH, maxY]);

  // Subset de etiquetas X — si hay 30 puntos no podemos mostrar las 30.
  // Mostramos primera, última, y N-2 intermedias equiespaciadas.
  const xLabelIdxs = useMemo(() => {
    const n = points.length;
    if (n === 0) return [];
    const target = Math.min(maxXLabels, n);
    if (target <= 1) return [0];
    if (target >= n) return points.map((_, i) => i);
    const step = (n - 1) / (target - 1);
    const set = new Set<number>();
    for (let i = 0; i < target; i++) set.add(Math.round(i * step));
    return Array.from(set).sort((a, b) => a - b);
  }, [points.length, maxXLabels]);

  if (points.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyTxt}>Sin datos en el rango</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { height }]} onLayout={onLayout}>
      {/* Eje Y: ticks horizontales + labels */}
      {yTicks.map((t, i) => {
        const y = PAD_TOP + innerH - (t / maxY) * innerH;
        return (
          <View key={`yt${i}`}>
            <View style={[styles.gridLine, { top: y, left: PAD_LEFT, width: innerW }]} />
            <Text style={[styles.yLabel, { top: y - 7, width: PAD_LEFT - 4 }]} numberOfLines={1}>
              {Math.round(t)}
            </Text>
          </View>
        );
      })}

      {/* Etiqueta de la unidad arriba a la izquierda */}
      {yUnit ? (
        <Text style={styles.yUnit} numberOfLines={1}>
          {yUnit}
        </Text>
      ) : null}

      {/* Línea: segmentos rotados. Cada segmento conecta puntos i e i+1. */}
      {pts.map((p, i) => {
        if (i === 0) return null;
        const prev = pts[i - 1]!;
        const dx = p.x - prev.x;
        const dy = p.y - prev.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angleRad = Math.atan2(dy, dx);
        const angleDeg = (angleRad * 180) / Math.PI;
        return (
          <View
            key={`seg${i}`}
            style={{
              position: 'absolute',
              left: PAD_LEFT + prev.x,
              top: PAD_TOP + prev.y - 1, // -1 para centrar el stroke verticalmente
              width: length,
              height: 2,
              backgroundColor: color,
              transform: [{ translateY: 0 }, { rotate: `${angleDeg}deg` }],
              transformOrigin: '0% 50%' as any, // RN 0.74+; fallback graciosamente abajo si no soporta
            }}
          />
        );
      })}

      {/* Dots de cada punto — sirven como marcas visuales y refuerzan
          la posición exacta cuando hay un valor pico. */}
      {pts.map((p, i) => (
        <View
          key={`dot${i}`}
          style={{
            position: 'absolute',
            left: PAD_LEFT + p.x - 3,
            top: PAD_TOP + p.y - 3,
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: color,
            borderWidth: 1.5,
            borderColor: colors.white,
          }}
        />
      ))}

      {/* Etiquetas eje X (subset) */}
      {xLabelIdxs.map(i => {
        const p = pts[i];
        if (!p) return null;
        return (
          <Text
            key={`xl${i}`}
            style={[
              styles.xLabel,
              {
                left: PAD_LEFT + p.x - 22,
                top: PAD_TOP + innerH + 6,
                width: 44,
              },
            ]}
            numberOfLines={1}
          >
            {p.raw.x}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', position: 'relative' },
  empty: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTxt: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  gridLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: colors.borderSoft,
  },
  yLabel: {
    position: 'absolute',
    left: 0,
    textAlign: 'right',
    paddingRight: 4,
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold as '600',
  },
  yUnit: {
    position: 'absolute',
    left: 0,
    top: 0,
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: fontWeight.bold as '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  xLabel: {
    position: 'absolute',
    textAlign: 'center',
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold as '600',
  },
});
