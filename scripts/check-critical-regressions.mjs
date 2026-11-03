import { readFile } from 'node:fs/promises';

const files = {
  compra: new URL('../src/screens/compras/CompraDetailScreen.tsx', import.meta.url),
  pdf: new URL('../src/lib/pdfExport.ts', import.meta.url),
  paricion: new URL('../src/screens/pariciones/ParicionFormScreen.tsx', import.meta.url),
  mortandad: new URL('../src/screens/mortandad/MortandadFormScreen.tsx', import.meta.url),
  ganaderas: new URL('../src/config/clients/ganaderas.ts', import.meta.url),
  clientConfig: new URL('../src/config/ClientConfigContext.tsx', import.meta.url),
  paricionList: new URL('../src/screens/pariciones/ParicionListScreen.tsx', import.meta.url),
  mapa: new URL('../src/components/MapPickerModal.tsx', import.meta.url),
  compraForm: new URL('../src/screens/compras/CompraFormScreen.tsx', import.meta.url),
  metricas: new URL('../src/screens/metricas/MetricasScreen.tsx', import.meta.url),
  migracionDelete: new URL('../supabase/migrations/0059_bloquear_borrado_total_pariciones.sql', import.meta.url),
  migracion: new URL('../supabase/migrations/0061_hotfix_caravana_unica_por_campania.sql', import.meta.url),
  migracionRecepcion: new URL('../supabase/migrations/0062_urgencias_recepcion_ganaderas.sql', import.meta.url),
};

const [compra, pdf, paricion, mortandad, ganaderas, clientConfig, paricionList, mapa, compraForm, metricas, migracionDelete, migracion, migracionRecepcion] = await Promise.all(
  Object.values(files).map(file => readFile(file, 'utf8')),
);

const checks = [
  {
    ok: !/Total estimado|precio\s*\*\s*compra\.kgNetosDestino/i.test(compra),
    message: 'Compras volvió a mostrar o calcular el total estimado.',
  },
  {
    ok: /Print\.printToFileAsync\(\{ html, base64: false \}\)/.test(pdf) &&
      /await compartirPDF\(Sharing, uri,/.test(pdf) &&
      !/Print\.printAsync\(\{ uri \}\)/.test(pdf),
    message: 'El PDF volvió a enviarse al diálogo de impresión vacío en vez de abrir el selector para compartir.',
  },
  {
    ok: /repo\.buscarCaravana\([\s\S]*caravanaColor,[\s\S]*numero,[\s\S]*evento,[\s\S]*fecha,[\s\S]*paricionId/.test(paricion),
    message: 'El formulario dejó de validar caravanas repetidas.',
  },
  {
    ok: /CREATE TRIGGER pariciones_caravana_unica_trigger/.test(migracion) &&
      /evento_normalizado/.test(migracion) &&
      /campania_scope/.test(migracion) &&
      /p\.campania_id/.test(migracion),
    message: 'Falta la protección correctamente acotada de caravanas repetidas en la base de datos.',
  },
  {
    ok: /evento === ['"]Muerte['"] && sexo !== ['"]Orejano['"]/.test(paricion) &&
      /if \(!causaVisible\)/.test(paricion),
    message: 'Orejano volvió a mostrar o conservar una causa de muerte oculta.',
  },
  {
    ok: /Recepción:\s*\[['"]Novillito['"],\s*['"]Vaq 1['"],\s*['"]TernH['"],\s*['"]TernM['"]\]/.test(ganaderas) &&
      /!esRecepcion/.test(mortandad) &&
      /Color de caravana/.test(mortandad) &&
      /N° de caravana/.test(mortandad),
    message: 'Se perdió el flujo específico de Recepción en Corrales.',
  },
  {
    ok: /row\.id === ACTIVE_CONFIG\.id[\s\S]*EMPTY_CATALOGOS/.test(clientConfig),
    message: 'Un tenant desconocido puede volver a heredar catálogos de Ganaderas.',
  },
  {
    ok: /!isSuperAdmin && clienteId !== ACTIVE_CONFIG\.id[\s\S]*catalogos:\s*\{\}/.test(clientConfig) &&
      /mergeStringArrayRecords\([\s\S]*fallback\.categoriasPorActividad/.test(clientConfig),
    message: 'El arranque o un cache antiguo puede volver a filtrar catálogos entre clientes.',
  },
  {
    ok: /categoriasPorActividad,Recepción/.test(migracionRecepcion) &&
      /Novillito/.test(migracionRecepcion) && /Vaq 1/.test(migracionRecepcion),
    message: 'Falta la migración de categorías de Recepción en Supabase.',
  },
  {
    ok: /b\.fecha\.localeCompare\(a\.fecha\)/.test(paricionList) &&
      /b\.createdAt[\s\S]*localeCompare\(a\.createdAt/.test(paricionList) &&
      /colorFiltro[\s\S]*caravanaColor/.test(paricionList) &&
      /sexoFiltro[\s\S]*p\.sexo/.test(paricionList),
    message: 'El listado de pariciones perdió el orden por carga o sus filtros de sexo/color.',
  },
  {
    ok: /NO regeneran el WebView/.test(mapa) &&
      /setBaseLayer\(['"]satellite['"]\)/.test(mapa) &&
      /marker\.setLatLng/.test(mapa),
    message: 'El mapa puede volver a cambiar de capa al mover el pin.',
  },
  {
    ok: /maxCorrelativoDelAño/.test(compraForm) && /generarNumeroOperacion\(fecha, max\)/.test(compraForm),
    message: 'Compras perdió la numeración correlativa automática.',
  },
  {
    ok: /pariciones_delete/.test(migracionDelete) &&
      /FOR DELETE TO authenticated[\s\S]*USING \(false\)/.test(migracionDelete),
    message: 'Pariciones dejó de bloquear el borrado de registros.',
  },
  {
    ok: /const campoIdsVisibles = useMemo/.test(metricas) &&
      /data\.filter\(p => campoIdsVisibles\.has\(p\.campoId\)\)/.test(metricas) &&
      !/data\.filter\(p => p\.usuarioEmail === user\.email\)/.test(metricas),
    message: 'Las métricas del operario volvieron a mostrar solo sus cargas en vez del campo asignado.',
  },
  {
    ok: /title=["']Mermas["']/.test(metricas) &&
      /Retacto/.test(metricas) && /Nacido muerto/.test(metricas) &&
      /Muerte señalado/.test(metricas) && /Orejano \(registros\)/.test(metricas) &&
      !/orejanos\.size\s*\/\s*2/.test(metricas),
    message: 'Se perdió el desglose de mermas o se volvió a dividir Orejanos de forma global.',
  },
];

const failed = checks.filter(check => !check.ok);
if (failed.length > 0) {
  failed.forEach(check => console.error(`✗ ${check.message}`));
  process.exit(1);
}

console.log('✓ Regresiones críticas verificadas: compras, PDF, caravanas, Orejano, Recepción, aislamiento, orden/filtros, mapa, permisos y mermas.');
