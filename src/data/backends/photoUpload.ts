// Upload de fotos a Supabase Storage.
//
// El operario saca foto con expo-image-picker, que devuelve una URI
// local tipo `file:///var/mobile/.../IMG_1234.jpg`. Esa URI solo es
// válida en el device que la sacó — el dashboard y los demás celulares
// no pueden verla.
//
// Esta función sube cada URI local al bucket `fotos-eventos` (creado en
// migration 0013) y devuelve la URL pública. El path en el bucket sigue
// la convención `<cliente_id>/<tabla>/<evento_id>/<idx>.<ext>` para que
// el dashboard pueda navegar las fotos por evento y la RLS valide acceso
// cross-tenant.
//
// Importante: las URIs que ya son URLs públicas (https://...supabase.co/...)
// se devuelven tal cual sin re-subir — soporta edits sucesivos de un mismo
// evento sin volver a subir las fotos ya cargadas.

import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'fotos-eventos';

function esLocalFileUri(uri: string): boolean {
  return uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('blob:');
}

function inferirExtension(uri: string, mime?: string): string {
  // Heurística simple: si la URI termina en .ext usable, usar esa.
  const m = uri.toLowerCase().match(/\.(jpg|jpeg|png|webp)(\?|$)/);
  if (m && m[1]) return m[1] === 'jpeg' ? 'jpg' : m[1];
  if (mime === 'image/png')  return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

function mimePorExtension(ext: string): string {
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

/**
 * Sube un array de URIs (local o remote) y devuelve un array con todas
 * convertidas a URLs públicas del bucket. Las URIs que ya son remotas
 * (http/https) pasan tal cual.
 *
 * Si la subida de una foto local falla, lanzamos error. Repository convierte
 * entonces TODO el evento en pendiente offline y vuelve a intentar más tarde.
 * Nunca debemos marcar una mortandad como sincronizada dejando un file:// en
 * la DB: esa URI solo existe en el celular y la evidencia se perdería para el
 * dashboard y los demás usuarios.
 */
export async function uploadFotosSiHaceFalta(
  supabase: SupabaseClient,
  clienteId: string,
  tabla: 'pariciones' | 'mortandad' | 'pastoreo' | 'lluvias' | 'compras' | 'ventas',
  eventoId: string,
  fotos: string[],
): Promise<string[]> {
  if (!fotos || fotos.length === 0) return [];

  // Path traversal guard (audit 27-jun-2026, item 5):
  // El path se construye como ${clienteId}/${tabla}/${eventoId}/foto-${i}.${ext}.
  // Si un actor pasa eventoId="../otraTabla" o similar, puede pisar archivos
  // dentro del mismo tenant aunque la RLS de Storage chequee el primer
  // segmento. clienteId también lo validamos para defense in depth.
  const ID_REGEX = /^[0-9a-zA-Z-]+$/;
  if (!ID_REGEX.test(eventoId)) {
    throw new Error(`uploadFotosSiHaceFalta: eventoId inválido (${eventoId})`);
  }
  if (!ID_REGEX.test(clienteId)) {
    throw new Error(`uploadFotosSiHaceFalta: clienteId inválido (${clienteId})`);
  }

  const out: string[] = [];
  for (let i = 0; i < fotos.length; i++) {
    const uri = fotos[i];
    if (!uri) continue;
    if (!esLocalFileUri(uri)) {
      // Ya es URL remota — la pasamos sin tocar.
      out.push(uri);
      continue;
    }
    // Supabase Storage en React Native recibe ArrayBuffer de forma confiable;
    // Blob/File/FormData pueden generar archivos vacíos según la versión de
    // Hermes. `fetch(file://)` nos permite leer el archivo local sin sumar
    // otra dependencia nativa.
    const res = await fetch(uri);
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength <= 0) {
      throw new Error(`La foto ${i + 1} está vacía o ya no existe en el celular`);
    }
    const ext = inferirExtension(uri);
    const path = `${clienteId}/${tabla}/${eventoId}/foto-${i}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, {
        contentType: mimePorExtension(ext),
        // upsert: para que si el operario re-edita el evento, sobreescriba
        // la foto vieja en el mismo path en vez de duplicar.
        upsert: true,
      });
    if (error) {
      throw new Error(`No se pudo subir la foto ${i + 1}: ${error.message}`);
    }
    // Generar la URL pública (bucket es public en migration 0013).
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    out.push(data.publicUrl);
  }
  return out;
}
