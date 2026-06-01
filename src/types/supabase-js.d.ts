// Stub temporal hasta que se corra `npm install`.
// Cuando @supabase/supabase-js esté instalado en node_modules, este file
// puede borrarse — los tipos reales del package toman precedencia.
//
// El stub permite que tsc valide nuestro código sin tener el package
// realmente instalado en el sandbox de Cowork.

declare module '@supabase/supabase-js' {
  export type SupabaseClient = any;
  export function createClient(url: string, key: string, opts?: any): SupabaseClient;
}
