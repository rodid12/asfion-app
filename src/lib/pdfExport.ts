// =============================================================================
// pdfExport.ts — Generación y export de PDFs de resumen
// =============================================================================
//
// El cliente pidió que cada carga (Compra, Pastoreo, Parición, etc.) tenga un
// botón "Exportar PDF" en la pantalla de resumen — para que el peón pueda
// compartir el resumen por WhatsApp, archivarlo en Drive, o imprimirlo.
//
// Implementación:
//   • generarHTML()  -> arma el HTML con estilos inline (sin CDN — funciona offline)
//   • exportarPDF()  -> convierte HTML a PDF con expo-print y abre share sheet
//                       con expo-sharing
//
// El HTML que generamos es deliberadamente simple: tabla 2 columnas
// (label, value) por sección, header con logo de texto, footer con email del
// usuario y timestamp. Sin frameworks, sin assets externos — para que el
// PDF se genere sin tocar red (el peón puede estar en el campo sin señal).
//
// Si las deps `expo-print` / `expo-sharing` no están instaladas, las imports
// fallan en runtime y mostramos un Alert con instrucciones. NO crasheamos.

import { Alert, Platform } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ─────────────────────────────────────────────────────────────────────────────

export interface PdfSection {
  /** Título de la sección — "Hacienda", "Comercial", etc. */
  title: string;
  /** Pares label/value. value puede ser '' para esconder la fila. */
  rows: Array<{ label: string; value: string | null | undefined }>;
}

export interface PdfPayload {
  /** Título grande arriba — "Compra Nº 0010-26", "Parición · Carolina", etc. */
  titulo: string;
  /** Subtítulo (opcional) — fecha legible, consignado, etc. */
  subtitulo?: string;
  /** Email del usuario que cargó — sale en el footer. */
  cargadoPor?: string;
  /** Fecha de carga ISO — sale en el footer formateada. */
  createdAt?: string;
  /** Secciones — el orden importa, se renderea verbatim. */
  secciones: PdfSection[];
  /** Observaciones libres — sale como bloque al final, sin tabla. */
  observaciones?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML builder — devuelve string. Se puede inspeccionar / testear sin RN.
// ─────────────────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function generarHTML(p: PdfPayload): string {
  // Colores ASFION inline (sin Tailwind ni CDNs — el PDF debe armarse offline).
  const navy   = '#1E3A5F';
  const orange = '#E07B3F';
  const muted  = '#6B7280';
  const border = '#E5E7EB';

  const seccionesHTML = p.secciones.map(sec => {
    const filas = sec.rows
      .filter(r => r.value != null && String(r.value).trim() !== '')
      .map(r => `
        <tr>
          <td style="padding:6px 12px;color:${muted};font-size:12px;width:160px;border-bottom:1px solid ${border};">${escapeHtml(r.label)}</td>
          <td style="padding:6px 12px;color:#0F172A;font-size:13px;font-weight:600;border-bottom:1px solid ${border};">${escapeHtml(String(r.value ?? ''))}</td>
        </tr>
      `).join('');
    if (!filas) return '';
    return `
      <div style="margin-top:18px;">
        <div style="text-transform:uppercase;font-size:11px;letter-spacing:0.6px;color:${muted};font-weight:700;margin-bottom:6px;">${escapeHtml(sec.title)}</div>
        <table style="width:100%;border-collapse:collapse;border:1px solid ${border};border-radius:8px;overflow:hidden;">
          <tbody>${filas}</tbody>
        </table>
      </div>
    `;
  }).join('');

  const obsBlock = p.observaciones
    ? `
      <div style="margin-top:18px;">
        <div style="text-transform:uppercase;font-size:11px;letter-spacing:0.6px;color:${muted};font-weight:700;margin-bottom:6px;">Observaciones</div>
        <div style="padding:12px;background:#FAF7F2;border:1px solid ${border};border-radius:8px;font-size:13px;line-height:1.55;color:#0F172A;white-space:pre-wrap;">${escapeHtml(p.observaciones)}</div>
      </div>` : '';

  const generadoAt = new Date().toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  const cargaInfo = [
    p.cargadoPor ? `Cargado por ${escapeHtml(p.cargadoPor)}` : null,
    p.createdAt  ? `el ${new Date(p.createdAt).toLocaleString('es-AR')}` : null,
  ].filter(Boolean).join(' ');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(p.titulo)}</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;margin:0;padding:28px;color:#0F172A;background:#FFFFFF;">
  <!-- Header -->
  <div style="border-bottom:3px solid ${orange};padding-bottom:14px;margin-bottom:8px;">
    <div style="display:flex;justify-content:space-between;align-items:baseline;">
      <div>
        <div style="font-size:11px;letter-spacing:1.5px;color:${orange};font-weight:700;">ASFION · GESTIÓN GANADERA</div>
        <div style="font-size:22px;font-weight:800;color:${navy};margin-top:2px;">${escapeHtml(p.titulo)}</div>
        ${p.subtitulo ? `<div style="font-size:13px;color:${muted};margin-top:2px;">${escapeHtml(p.subtitulo)}</div>` : ''}
      </div>
    </div>
  </div>

  <!-- Secciones -->
  ${seccionesHTML}
  ${obsBlock}

  <!-- Footer -->
  <div style="margin-top:32px;padding-top:12px;border-top:1px solid ${border};font-size:10px;color:${muted};display:flex;justify-content:space-between;">
    <div>${cargaInfo}</div>
    <div>Documento generado ${generadoAt}</div>
  </div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF generation + share
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera un PDF a partir del payload y abre el share sheet del sistema.
 * Devuelve true si tuvo éxito, false si las deps no están disponibles o el
 * usuario canceló.
 *
 * Falla blando: si expo-print/expo-sharing no están instalados, no crashea
 * la app — solo muestra Alert. Eso facilita el deploy gradual (build OTA
 * sin requerir un rebuild nativo para deshabilitar el botón).
 */
export async function exportarPDF(payload: PdfPayload, filenameBase: string): Promise<boolean> {
  const html = generarHTML(payload);

  // Imports dinámicos para que el bundle no rompa si las deps no están.
  // El typecheck local sin node_modules tampoco debe explotar — por eso
  // los ts-ignore: las deps se resuelven a las versiones declaradas en
  // package.json (expo-print, expo-sharing) en el build de Expo.
  let Print: any, Sharing: any;
  try {
    // @ts-ignore — resolved at runtime by Metro / Expo
    Print   = await import('expo-print');
    // @ts-ignore — resolved at runtime by Metro / Expo
    Sharing = await import('expo-sharing');
  } catch (err) {
    // Distinguir "deps no instaladas" de "error real de bundler/Hermes/JS"
    // — antes mostrábamos siempre "función no disponible" aunque el error
    // fuera otro (network, syntax, etc), confundiendo al operario que
    // pensaba que era un problema instalable.
    const msg = err instanceof Error ? err.message : String(err);
    const isDepFaltante = /Cannot find module|Unable to resolve|not found in the module map/i.test(msg);
    if (isDepFaltante) {
      Alert.alert(
        'Función no disponible',
        'Para exportar PDFs falta instalar las dependencias de la app (expo-print, expo-sharing). Pedile al admin que actualice la versión.',
      );
    } else {
      Alert.alert(
        'Error al cargar exportador',
        `Ocurrió un error inesperado:\n\n${msg}\n\nMandalo a soporte.`,
      );
    }
    return false;
  }

  try {
    const { uri } = await Print.printToFileAsync({ html, base64: false });

    // Nombre del archivo final — algunos OS no respetan el rename, pero al
    // menos ayuda en iOS Files / Android downloads.
    const ts = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    const filename = `${filenameBase}-${ts}.pdf`;

    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('PDF generado', `Se guardó en:\n${uri}\n\nPero el share del sistema no está disponible en este dispositivo.`);
      return true;
    }

    await Sharing.shareAsync(uri, {
      dialogTitle: filename,
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf', // iOS
    });
    return true;
  } catch (err) {
    // Distinguir errores conocidos para dar mensaje más útil al operario.
    const msg = err instanceof Error ? err.message : String(err);
    const isStorageFull = /ENOSPC|no space left|storage full/i.test(msg);
    if (isStorageFull) {
      Alert.alert(
        'Sin espacio en el celular',
        'No hay espacio para guardar el PDF. Borrá archivos o fotos viejas e intentá de nuevo.',
      );
    } else {
      Alert.alert('Error al exportar PDF', msg);
    }
    return false;
  }
}

// Convenience: fecha legible "Sábado 27 de junio de 2026"
export function fechaLargaES(iso: string): string {
  const [yy, mm, dd] = iso.split('-').map(Number);
  if (!yy || !mm || !dd) return iso;
  const dt = new Date(yy, mm - 1, dd);
  const dow = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][dt.getDay()];
  const mes = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][mm - 1];
  return `${dow} ${dd} de ${mes} de ${yy}`;
}

// Suprime "use Platform" warning si no se usa en builds de prod.
void Platform;
