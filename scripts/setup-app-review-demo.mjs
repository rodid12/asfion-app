import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, chmod } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const REVIEW_EMAIL = process.env.APP_REVIEW_EMAIL
  ?? 'rosariodidziulis8+apple-review@gmail.com';
const CLIENT_ID = 'app-review-demo';
const CAMPAIGN_ID = 'campania-app-review-demo-2026-2027';
const OPERATIVE_CAMPAIGN_ID = 'campania-operativa-app-review-demo-2026-2027';

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  throw new Error(
    'Faltan EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o EXPO_PUBLIC_SUPABASE_ANON_KEY en .env.local.',
  );
}

function argumentValue(name) {
  const position = process.argv.indexOf(name);
  return position >= 0 ? process.argv[position + 1] : undefined;
}

function makePassword() {
  return `Asf!${randomBytes(18).toString('base64url')}9a`;
}

const password = process.env.APP_REVIEW_PASSWORD ?? makePassword();
const credentialsPath = resolve(
  argumentValue('--credentials-output')
    ?? process.env.APP_REVIEW_CREDENTIALS_OUTPUT
    ?? './.app-store-review-credentials.txt',
);

const adminHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function api(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: { ...adminHeaders, ...options.headers },
  });
  const raw = await response.text();
  let body = null;
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = raw;
    }
  }
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path}: ${response.status} ${raw}`);
  }
  return body;
}

async function upsert(table, rows, conflict = 'id') {
  // PostgREST exige que todos los objetos de un INSERT por lote tengan las
  // mismas claves. Completar los campos ausentes con null mantiene el script
  // legible y permite mezclar eventos con datos opcionales diferentes.
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const normalizedRows = rows.map((row) => Object.fromEntries(
    keys.map((key) => [key, Object.hasOwn(row, key) ? row[key] : null]),
  ));
  return api(`/rest/v1/${table}?on_conflict=${encodeURIComponent(conflict)}`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(normalizedRows),
  });
}

async function ensureAuthUser() {
  let page = 1;
  let existing = null;

  while (!existing) {
    const result = await api(`/auth/v1/admin/users?page=${page}&per_page=100`);
    const users = Array.isArray(result) ? result : (result?.users ?? []);
    existing = users.find(
      (user) => String(user.email ?? '').toLowerCase() === REVIEW_EMAIL.toLowerCase(),
    );
    if (existing || users.length < 100) break;
    page += 1;
  }

  const attributes = {
    email: REVIEW_EMAIL,
    password,
    email_confirm: true,
    user_metadata: {
      name: 'Apple Reviewer',
      full_name: 'Apple Reviewer',
      purpose: 'App Store Review',
    },
  };

  if (existing) {
    return api(`/auth/v1/admin/users/${existing.id}`, {
      method: 'PUT',
      body: JSON.stringify(attributes),
    });
  }

  return api('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify(attributes),
  });
}

const today = '2026-10-21';

await upsert('clientes', [{
  id: CLIENT_ID,
  nombre: 'Estancia Demo ASFION',
  tagline: 'Cuenta demostrativa para revisión de Apple',
  accent_color: '#FF7A00',
  modulos_habilitados: ['pariciones', 'lluvias', 'mortandad', 'pastoreo', 'compras', 'ventas'],
  catalogos: {
    pariciones: {
      vacasGrupos: ['Vacas cabeza', 'Vacas cuerpo', 'Vacas cola'],
      eventos: ['Nacimiento', 'Muerte', 'Retacto', 'Aborto'],
      sexos: ['Macho', 'Hembra', 'Orejano'],
      asistencia: ['Si', 'No'],
      caravanaColores: ['Celeste', 'Blanca', 'Amarillo', 'Naranja'],
      causaTipos: ['Muerte Señalado', 'Nacido Muerto'],
      causasFrecuentes: ['Diarrea', 'Insolación', 'Accidente', 'Desconocida'],
    },
    mortandad: {
      categorias: ['Vacas', 'Vaquillonas', 'Novillos', 'Terneros', 'Terneras'],
      actividades: ['Cría', 'Recría', 'Engorde'],
      causaTipos: ['Enfermedad', 'Accidente', 'Desconocida'],
    },
    pastoreo: {
      categorias: ['Vacas', 'Vaquillonas', 'Novillos', 'Terneros'],
      eventos: ['Entrada', 'Salida', 'Rotación', 'Muerte'],
      catAnimal: ['Vaca preñada', 'Vaca vacía', 'Terneros H', 'Terneros M', 'Novillo'],
    },
    compras: {
      actividades: ['Cría', 'Recría', 'Engorde', 'Invernada'],
      plazos: ['Contado', '30 días', '60 días'],
    },
  },
  subscription_status: 'active',
  period_end_date: '2028-12-31',
  billing_notes: 'Cuenta interna de demostración para Apple App Review. No facturar.',
}]);

await upsert('campos', [
  {
    id: 'campo-demo-norte', cliente_id: CLIENT_ID, nombre: 'Campo Norte',
    organizacion_id: 'org-app-review-demo', stock_inicial_vacas: 180,
    ubicacion_descripcion: 'Salta, Argentina', superficie_ha: 620,
  },
  {
    id: 'campo-demo-sur', cliente_id: CLIENT_ID, nombre: 'Campo Sur',
    organizacion_id: 'org-app-review-demo', stock_inicial_vacas: 135,
    ubicacion_descripcion: 'Salta, Argentina', superficie_ha: 480,
  },
]);

await upsert('lotes', [
  { id: 'lote-demo-norte-1', cliente_id: CLIENT_ID, campo_id: 'campo-demo-norte', nombre: 'Lote 1' },
  { id: 'lote-demo-norte-2', cliente_id: CLIENT_ID, campo_id: 'campo-demo-norte', nombre: 'Lote 2' },
  { id: 'lote-demo-sur-1', cliente_id: CLIENT_ID, campo_id: 'campo-demo-sur', nombre: 'Lote A' },
  { id: 'lote-demo-sur-2', cliente_id: CLIENT_ID, campo_id: 'campo-demo-sur', nombre: 'Lote B' },
]);

await upsert('pluviometros', [
  { id: 'pluv-demo-norte-casco', cliente_id: CLIENT_ID, campo_id: 'campo-demo-norte', nombre: 'Casco Norte' },
  { id: 'pluv-demo-norte-lote2', cliente_id: CLIENT_ID, campo_id: 'campo-demo-norte', nombre: 'Lote 2' },
  { id: 'pluv-demo-sur-casco', cliente_id: CLIENT_ID, campo_id: 'campo-demo-sur', nombre: 'Casco Sur' },
]);

await upsert('circuitos', [
  { id: 'circuito-demo-norte-1', cliente_id: CLIENT_ID, campo_id: 'campo-demo-norte', nombre: 'Circuito Norte 1', hectareas: 160 },
  { id: 'circuito-demo-sur-1', cliente_id: CLIENT_ID, campo_id: 'campo-demo-sur', nombre: 'Circuito Sur 1', hectareas: 120 },
]);

await upsert('parcelas', [
  { id: 'parcela-demo-norte-1', cliente_id: CLIENT_ID, circuito_id: 'circuito-demo-norte-1', numero: 1, hectareas: 40 },
  { id: 'parcela-demo-norte-2', cliente_id: CLIENT_ID, circuito_id: 'circuito-demo-norte-1', numero: 2, hectareas: 40 },
  { id: 'parcela-demo-sur-1', cliente_id: CLIENT_ID, circuito_id: 'circuito-demo-sur-1', numero: 1, hectareas: 30 },
  { id: 'parcela-demo-sur-2', cliente_id: CLIENT_ID, circuito_id: 'circuito-demo-sur-1', numero: 2, hectareas: 30 },
]);

await upsert('campanias_reproductivas', [{
  id: CAMPAIGN_ID,
  cliente_id: CLIENT_ID,
  nombre: 'Campaña 2026-2027',
  servicio_anio: 2026,
  fecha_inicio: '2026-09-01',
  fecha_fin: '2027-03-31',
  activa: true,
  observaciones: 'Campaña de demostración para Apple App Review.',
}]);

await upsert('campanias_operativas', [{
  id: OPERATIVE_CAMPAIGN_ID,
  cliente_id: CLIENT_ID,
  nombre: 'Campaña 2026/27',
  fecha_inicio: '2026-09-01',
  fecha_fin: '2027-08-31',
  activa: true,
  observaciones: 'Campaña operativa de demostración para Apple App Review.',
}]);

await upsert('usuarios', [{
  email: REVIEW_EMAIL.toLowerCase(),
  cliente_id: CLIENT_ID,
  nombre: 'Apple',
  apellido: 'Reviewer',
  rol: 'administrador',
  campo_asignado_id: null,
}], 'email');

await upsert('pariciones', [
  { id: 'paricion-demo-001', cliente_id: CLIENT_ID, campo_id: 'campo-demo-norte', lote_id: 'lote-demo-norte-1', usuario_email: REVIEW_EMAIL, fecha: '2026-09-03', vacas_grupo: 'Vacas cabeza', evento: 'Nacimiento', sexo: 'Macho', asistencia: 'No', caravana_color: 'Celeste', caravana_numero: '0101', observaciones: 'Nacimiento normal', campania_id: CAMPAIGN_ID },
  { id: 'paricion-demo-002', cliente_id: CLIENT_ID, campo_id: 'campo-demo-norte', lote_id: 'lote-demo-norte-1', usuario_email: REVIEW_EMAIL, fecha: '2026-09-05', vacas_grupo: 'Vacas cabeza', evento: 'Nacimiento', sexo: 'Hembra', asistencia: 'No', caravana_color: 'Celeste', caravana_numero: '0102', observaciones: 'Ternera en buen estado', campania_id: CAMPAIGN_ID },
  { id: 'paricion-demo-003', cliente_id: CLIENT_ID, campo_id: 'campo-demo-norte', lote_id: 'lote-demo-norte-2', usuario_email: REVIEW_EMAIL, fecha: '2026-09-08', vacas_grupo: 'Vacas cuerpo', evento: 'Nacimiento', sexo: 'Macho', asistencia: 'Si', caravana_color: 'Amarillo', caravana_numero: '0110', observaciones: 'Parto asistido sin complicaciones', campania_id: CAMPAIGN_ID },
  { id: 'paricion-demo-004', cliente_id: CLIENT_ID, campo_id: 'campo-demo-sur', lote_id: 'lote-demo-sur-1', usuario_email: REVIEW_EMAIL, fecha: '2026-09-12', vacas_grupo: 'Vacas cuerpo', evento: 'Nacimiento', sexo: 'Hembra', asistencia: 'No', caravana_color: 'Blanca', caravana_numero: '0201', observaciones: 'Nacimiento normal', campania_id: CAMPAIGN_ID },
  { id: 'paricion-demo-005', cliente_id: CLIENT_ID, campo_id: 'campo-demo-sur', lote_id: 'lote-demo-sur-1', usuario_email: REVIEW_EMAIL, fecha: '2026-09-15', vacas_grupo: 'Vacas cola', evento: 'Aborto', sexo: null, asistencia: null, observaciones: 'Evento de demostración', campania_id: CAMPAIGN_ID },
  { id: 'paricion-demo-006', cliente_id: CLIENT_ID, campo_id: 'campo-demo-sur', lote_id: 'lote-demo-sur-2', usuario_email: REVIEW_EMAIL, fecha: '2026-09-18', vacas_grupo: 'Vacas cola', evento: 'Muerte', sexo: 'Macho', causa_tipo: 'Nacido Muerto', causa_detalle: 'Causa no determinada', observaciones: 'Evento de demostración', campania_id: CAMPAIGN_ID },
  { id: 'paricion-demo-007', cliente_id: CLIENT_ID, campo_id: 'campo-demo-norte', lote_id: 'lote-demo-norte-2', usuario_email: REVIEW_EMAIL, fecha: '2026-10-04', vacas_grupo: 'Vacas cuerpo', evento: 'Nacimiento', sexo: 'Hembra', asistencia: 'No', caravana_color: 'Naranja', caravana_numero: '0125', observaciones: 'Nacimiento normal', campania_id: CAMPAIGN_ID },
  { id: 'paricion-demo-008', cliente_id: CLIENT_ID, campo_id: 'campo-demo-sur', lote_id: 'lote-demo-sur-2', usuario_email: REVIEW_EMAIL, fecha: today, vacas_grupo: 'Vacas cola', evento: 'Nacimiento', sexo: 'Macho', asistencia: 'No', caravana_color: 'Blanca', caravana_numero: '0220', observaciones: 'Carga reciente para revisión', campania_id: CAMPAIGN_ID },
]);

await upsert('lluvias', [
  { id: 'lluvia-demo-001', cliente_id: CLIENT_ID, campo_id: 'campo-demo-norte', pluviometro_id: 'pluv-demo-norte-casco', usuario_email: REVIEW_EMAIL, fecha: '2026-09-10', pluviometro_nombre: 'Casco Norte', milimetros: 28 },
  { id: 'lluvia-demo-002', cliente_id: CLIENT_ID, campo_id: 'campo-demo-norte', pluviometro_id: 'pluv-demo-norte-lote2', usuario_email: REVIEW_EMAIL, fecha: '2026-09-10', pluviometro_nombre: 'Lote 2', milimetros: 24 },
  { id: 'lluvia-demo-003', cliente_id: CLIENT_ID, campo_id: 'campo-demo-sur', pluviometro_id: 'pluv-demo-sur-casco', usuario_email: REVIEW_EMAIL, fecha: '2026-09-22', pluviometro_nombre: 'Casco Sur', milimetros: 41 },
  { id: 'lluvia-demo-004', cliente_id: CLIENT_ID, campo_id: 'campo-demo-norte', pluviometro_id: 'pluv-demo-norte-casco', usuario_email: REVIEW_EMAIL, fecha: '2026-10-02', pluviometro_nombre: 'Casco Norte', milimetros: 17 },
  { id: 'lluvia-demo-005', cliente_id: CLIENT_ID, campo_id: 'campo-demo-sur', pluviometro_id: 'pluv-demo-sur-casco', usuario_email: REVIEW_EMAIL, fecha: '2026-10-12', pluviometro_nombre: 'Casco Sur', milimetros: 35 },
  { id: 'lluvia-demo-006', cliente_id: CLIENT_ID, campo_id: 'campo-demo-norte', pluviometro_id: 'pluv-demo-norte-lote2', usuario_email: REVIEW_EMAIL, fecha: today, pluviometro_nombre: 'Lote 2', milimetros: 12 },
]);

await upsert('mortandad', [
  { id: 'mortandad-demo-001', cliente_id: CLIENT_ID, campo_id: 'campo-demo-norte', lote_id: 'lote-demo-norte-1', usuario_email: REVIEW_EMAIL, fecha: '2026-09-14', categoria: 'Vacas', actividad: 'Cría', causa_tipo: 'Enfermedad', causa_detalle: 'Problema digestivo', observaciones: 'Registro demostrativo' },
  { id: 'mortandad-demo-002', cliente_id: CLIENT_ID, campo_id: 'campo-demo-sur', lote_id: 'lote-demo-sur-1', usuario_email: REVIEW_EMAIL, fecha: '2026-09-27', categoria: 'Terneros', actividad: 'Cría', causa_tipo: 'Accidente', causa_detalle: 'Accidente de campo', observaciones: 'Registro demostrativo' },
  { id: 'mortandad-demo-003', cliente_id: CLIENT_ID, campo_id: 'campo-demo-norte', lote_id: 'lote-demo-norte-2', usuario_email: REVIEW_EMAIL, fecha: '2026-10-08', categoria: 'Vaquillonas', actividad: 'Recría', causa_tipo: 'Desconocida', causa_detalle: 'En evaluación', observaciones: 'Registro demostrativo' },
  { id: 'mortandad-demo-004', cliente_id: CLIENT_ID, campo_id: 'campo-demo-sur', lote_id: 'lote-demo-sur-2', usuario_email: REVIEW_EMAIL, fecha: '2026-10-19', categoria: 'Novillos', actividad: 'Engorde', causa_tipo: 'Enfermedad', causa_detalle: 'Cuadro respiratorio', observaciones: 'Registro demostrativo' },
]);

await upsert('pastoreo', [
  { id: 'pastoreo-demo-001', cliente_id: CLIENT_ID, campo_id: 'campo-demo-norte', circuito_id: 'circuito-demo-norte-1', parcela_id: 'parcela-demo-norte-1', parcela_numero: 1, usuario_email: REVIEW_EMAIL, fecha_entrada: '2026-09-05', fecha_salida: '2026-09-12', categoria: 'Vacas', evento: 'Rotación', categoria_animal: 'Vaca preñada', animales: 120, kg_promedio: 430 },
  { id: 'pastoreo-demo-002', cliente_id: CLIENT_ID, campo_id: 'campo-demo-norte', circuito_id: 'circuito-demo-norte-1', parcela_id: 'parcela-demo-norte-2', parcela_numero: 2, usuario_email: REVIEW_EMAIL, fecha_entrada: '2026-09-12', fecha_salida: '2026-09-20', categoria: 'Vacas', evento: 'Rotación', categoria_animal: 'Vaca preñada', animales: 120, kg_promedio: 432 },
  { id: 'pastoreo-demo-003', cliente_id: CLIENT_ID, campo_id: 'campo-demo-sur', circuito_id: 'circuito-demo-sur-1', parcela_id: 'parcela-demo-sur-1', parcela_numero: 1, usuario_email: REVIEW_EMAIL, fecha_entrada: '2026-10-01', fecha_salida: '2026-10-09', categoria: 'Novillos', evento: 'Rotación', categoria_animal: 'Novillo', animales: 85, kg_promedio: 315 },
  { id: 'pastoreo-demo-004', cliente_id: CLIENT_ID, campo_id: 'campo-demo-sur', circuito_id: 'circuito-demo-sur-1', parcela_id: 'parcela-demo-sur-2', parcela_numero: 2, usuario_email: REVIEW_EMAIL, fecha_entrada: '2026-10-09', fecha_salida: null, categoria: 'Novillos', evento: 'Entrada', categoria_animal: 'Novillo', animales: 84, kg_promedio: 321 },
]);

await upsert('compras', [
  { id: 'compra-demo-001', cliente_id: CLIENT_ID, campo_id: 'campo-demo-norte', usuario_email: REVIEW_EMAIL, fecha: '2026-09-07', actividad: 'Invernada', cant_cab_y_cat: '60 machos. 20 hembras', kg_netos_origen: 17840, kg_netos_destino: 17125, merma_porcentaje: 4.01, kg_corregidos: null, precio: 5450, consignado: 'Consignataria Demo', titular: 'Proveedor Norte', plazo: 'Contado', numero_dte: 'DEMO-0001', numero_operacion: 'DEM_1', km_recorrido: 240, observaciones: 'Compra de demostración', total_machos: 60, total_hembras: 20 },
  { id: 'compra-demo-002', cliente_id: CLIENT_ID, campo_id: 'campo-demo-sur', usuario_email: REVIEW_EMAIL, fecha: '2026-09-26', actividad: 'Recría', cant_cab_y_cat: '45 machos. 35 hembras', kg_netos_origen: 16450, kg_netos_destino: 15990, merma_porcentaje: 2.80, kg_corregidos: null, precio: 5520, consignado: 'Consignataria Demo', titular: 'Proveedor Sur', plazo: '30 días', numero_dte: 'DEMO-0002', numero_operacion: 'DEM_2', km_recorrido: 180, observaciones: 'Compra de demostración', total_machos: 45, total_hembras: 35 },
  { id: 'compra-demo-003', cliente_id: CLIENT_ID, campo_id: 'campo-demo-norte', usuario_email: REVIEW_EMAIL, fecha: '2026-10-15', actividad: 'Engorde', cant_cab_y_cat: '52 machos', kg_netos_origen: 12620, kg_netos_destino: 12240, merma_porcentaje: 3.01, kg_corregidos: null, precio: 5600, consignado: 'Consignataria Demo', titular: 'Proveedor Centro', plazo: 'Contado', numero_dte: 'DEMO-0003', numero_operacion: 'DEM_3', km_recorrido: 95, observaciones: 'Compra de demostración', total_machos: 52, total_hembras: 0 },
]);

await upsert('ventas', [
  { id: 'venta-demo-001', cliente_id: CLIENT_ID, campo_id: 'campo-demo-norte', usuario_email: REVIEW_EMAIL, fecha: '2026-09-18', grupos: [{ cantCabYCat: '40 novillos TM1.1-26 B6', kgBrutos: 13200, precio: 6100 }], consignado: 'Consignataria Demo', titular: 'Estancia Demo ASFION', pago: 'Contado', frigorifico: 'Frigorífico Norte', numero_dte: 'VENTA-DEMO-001', correlativo: '1-26', tropa: '1', importe_total: 74000000, observaciones: 'Venta de demostración' },
  { id: 'venta-demo-002', cliente_id: CLIENT_ID, campo_id: 'campo-demo-sur', usuario_email: REVIEW_EMAIL, fecha: '2026-10-03', grupos: [{ cantCabYCat: '30 novillos TM1.2-26 B4', kgBrutos: 9900, precio: 6250 }, { cantCabYCat: '15 vaquillonas VH.2-26 B4', kgBrutos: 4200, precio: 5980 }], consignado: 'Consignataria Demo', titular: 'Estancia Demo ASFION', pago: '30 días', frigorifico: 'Frigorífico Sur', numero_dte: 'VENTA-DEMO-002', correlativo: '2-26', tropa: '2', importe_total: 79000000, observaciones: 'Venta con dos categorías' },
  { id: 'venta-demo-003', cliente_id: CLIENT_ID, campo_id: 'campo-demo-norte', usuario_email: REVIEW_EMAIL, fecha: '2026-10-18', grupos: [{ cantCabYCat: '36 terneros TM1.3-26 B2', kgBrutos: 7560, precio: 6400 }], consignado: 'Consignataria Demo', titular: 'Estancia Demo ASFION', pago: 'Contado', frigorifico: 'Frigorífico Centro', numero_dte: 'VENTA-DEMO-003', correlativo: '3-26', tropa: '3', importe_total: 44500000, observaciones: 'Venta reciente de demostración' },
]);

await ensureAuthUser();

const loginResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: REVIEW_EMAIL, password }),
});
if (!loginResponse.ok) {
  throw new Error(`La cuenta fue creada pero el inicio de sesión de verificación falló: ${loginResponse.status} ${await loginResponse.text()}`);
}

await mkdir(dirname(credentialsPath), { recursive: true });
await writeFile(
  credentialsPath,
  [
    'ASFION — App Store Review',
    `Email: ${REVIEW_EMAIL}`,
    `Password: ${password}`,
    `Cliente: ${CLIENT_ID}`,
    `Creado/actualizado: ${new Date().toISOString()}`,
    '',
    'CONFIDENCIAL: no subir este archivo a Git ni compartirlo fuera de App Store Connect.',
  ].join('\n'),
  { mode: 0o600 },
);
await chmod(credentialsPath, 0o600);

console.log('Cuenta de revisión y datos de demostración listos.');
console.log(`Email: ${REVIEW_EMAIL}`);
console.log(`Credenciales guardadas en: ${credentialsPath}`);
console.log('Inicio de sesión verificado correctamente.');
