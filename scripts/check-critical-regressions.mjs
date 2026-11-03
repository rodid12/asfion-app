import { readFile } from 'node:fs/promises';

const files = {
  compra: new URL('../src/screens/compras/CompraDetailScreen.tsx', import.meta.url),
  pdf: new URL('../src/lib/pdfExport.ts', import.meta.url),
  paricion: new URL('../src/screens/pariciones/ParicionFormScreen.tsx', import.meta.url),
  mortandad: new URL('../src/screens/mortandad/MortandadFormScreen.tsx', import.meta.url),
  ganaderas: new URL('../src/config/clients/ganaderas.ts', import.meta.url),
  clientConfig: new URL('../src/config/ClientConfigContext.tsx', import.meta.url),
  migracion: new URL('../supabase/migrations/0061_hotfix_caravana_unica_por_campania.sql', import.meta.url),
  migracionRecepcion: new URL('../supabase/migrations/0062_urgencias_recepcion_ganaderas.sql', import.meta.url),
};

const [compra, pdf, paricion, mortandad, ganaderas, clientConfig, migracion, migracionRecepcion] = await Promise.all(
  Object.values(files).map(file => readFile(file, 'utf8')),
);

const checks = [
  {
    ok: !/Total estimado|precio\s*\*\s*compra\.kgNetosDestino/i.test(compra),
    message: 'Compras volvió a mostrar o calcular el total estimado.',
  },
  {
    ok: /Platform\.OS\s*===\s*['"]android['"][\s\S]*Print\.printAsync\(\{ uri \}\)/.test(pdf),
    message: 'Se perdió la alternativa estable de exportación PDF para Android.',
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
    ok: /categoriasPorActividad,Recepción/.test(migracionRecepcion) &&
      /Novillito/.test(migracionRecepcion) && /Vaq 1/.test(migracionRecepcion),
    message: 'Falta la migración de categorías de Recepción en Supabase.',
  },
];

const failed = checks.filter(check => !check.ok);
if (failed.length > 0) {
  failed.forEach(check => console.error(`✗ ${check.message}`));
  process.exit(1);
}

console.log('✓ Regresiones críticas verificadas: compras, PDF, caravanas, Orejano, Recepción y aislamiento de catálogos.');
