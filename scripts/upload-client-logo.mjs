#!/usr/bin/env node

import { readFile, stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

const [clienteId, archivoArg] = process.argv.slice(2);

if (!clienteId || !archivoArg) {
  console.error('Uso: node scripts/upload-client-logo.mjs <cliente-id> <archivo>');
  process.exit(1);
}

const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL)?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl) {
  console.error('Falta SUPABASE_URL o EXPO_PUBLIC_SUPABASE_URL en el entorno.');
  process.exit(1);
}

if (!serviceRoleKey) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY en el entorno. No uses la anon key para esta tarea.');
  process.exit(1);
}

const archivo = resolve(archivoArg);
const info = await stat(archivo).catch(() => null);
if (!info?.isFile()) {
  console.error(`No existe el archivo: ${archivo}`);
  process.exit(1);
}

const mimePorExtension = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};
const extension = extname(archivo).toLowerCase();
const contentType = mimePorExtension[extension];
if (!contentType) {
  console.error('Formato no soportado. Usá JPG, JPEG, PNG o WEBP.');
  process.exit(1);
}

const bucket = 'client-logos';
const objectPath = `${clienteId}/logo${extension === '.jpg' ? '.jpeg' : extension}`;
const baseUrl = supabaseUrl.replace(/\/$/, '');
const authHeaders = {
  apikey: serviceRoleKey,
  // Las nuevas sb_secret_* son API keys, no JWT. Supabase exige enviarlas
  // únicamente como `apikey`; Authorization: Bearer queda para service_role
  // legacy (JWT largo que empieza con eyJ).
  ...(serviceRoleKey.startsWith('sb_secret_')
    ? {}
    : { Authorization: `Bearer ${serviceRoleKey}` }),
};

async function api(path, { method = 'GET', headers = {}, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...authHeaders, ...headers },
    body,
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${method} ${path}: ${response.status} ${detail}`);
  }
  if (response.status === 204) return null;
  const responseType = response.headers.get('content-type') ?? '';
  return responseType.includes('application/json')
    ? response.json()
    : response.text();
}

// Usamos HTTP directo en vez del cliente completo de Supabase para que este
// script funcione en Node 20 sin inicializar Realtime/WebSocket.
const clientes = await api(
  `/rest/v1/clientes?id=eq.${encodeURIComponent(clienteId)}&select=id,nombre&limit=1`,
);
const cliente = clientes?.[0];
if (!cliente) throw new Error(`No existe el cliente ${clienteId}.`);

const buckets = await api('/storage/v1/bucket');
const bucketConfig = {
  public: true,
  file_size_limit: 5 * 1024 * 1024,
  allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp'],
};

if (!buckets.some(item => item.name === bucket || item.id === bucket)) {
  await api('/storage/v1/bucket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: bucket, name: bucket, ...bucketConfig }),
  });
} else {
  await api(`/storage/v1/bucket/${encodeURIComponent(bucket)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bucketConfig),
  });
}

const contenido = await readFile(archivo);
const encodedObjectPath = objectPath.split('/').map(encodeURIComponent).join('/');
await api(`/storage/v1/object/${encodeURIComponent(bucket)}/${encodedObjectPath}`, {
  method: 'POST',
  headers: {
    'Content-Type': contentType,
    'Cache-Control': 'max-age=3600',
    'x-upsert': 'true',
  },
  body: contenido,
});

const publicUrl = `${baseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedObjectPath}`;
await api(`/rest/v1/clientes?id=eq.${encodeURIComponent(clienteId)}`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  },
  body: JSON.stringify({ logo_url: publicUrl }),
});

console.log(`Logo configurado para ${cliente.nombre}.`);
console.log(publicUrl);
