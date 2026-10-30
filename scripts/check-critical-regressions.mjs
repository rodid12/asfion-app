import { readFile } from 'node:fs/promises';

const files = {
  compra: new URL('../src/screens/compras/CompraDetailScreen.tsx', import.meta.url),
  pdf: new URL('../src/lib/pdfExport.ts', import.meta.url),
  paricion: new URL('../src/screens/pariciones/ParicionFormScreen.tsx', import.meta.url),
  migracion: new URL('../supabase/migrations/0060_pariciones_caravana_unica.sql', import.meta.url),
};

const [compra, pdf, paricion, migracion] = await Promise.all(
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
    ok: /repo\.buscarCaravana\(caravanaColor, numero, paricionId\)/.test(paricion),
    message: 'El formulario dejó de validar caravanas repetidas.',
  },
  {
    ok: /CREATE TRIGGER pariciones_caravana_unica_trigger/.test(migracion),
    message: 'Falta la protección de caravanas repetidas en la base de datos.',
  },
];

const failed = checks.filter(check => !check.ok);
if (failed.length > 0) {
  failed.forEach(check => console.error(`✗ ${check.message}`));
  process.exit(1);
}

console.log('✓ Regresiones críticas verificadas: compras, PDF y caravanas únicas.');
