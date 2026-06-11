// Cron diario que mueve el subscription_status de los clientes según el
// período vencido. Se invoca todos los días a las 3am Argentina (ver
// "Cómo se schedulea" abajo).
//
// Reglas (matchean exactamente el copy del SubscriptionBanner y la UX
// definida en discusión con Ro):
//   active     → past_due   al día 1+ vencido
//   past_due   → restricted al día 8+ vencido
//   restricted → suspended  al día 20+ vencido
//   suspended → (no auto-cancel; lo hace manual el admin)
//
// La función es IDEMPOTENTE: corre todos los días sin importar el cron
// anterior, y solo escribe los rows que cambian de estado. Si por algún
// motivo no corre un día (Supabase caído, error de red), al día siguiente
// se "pone al día" porque el cómputo es siempre vs la fecha real.
//
// === Cómo se schedulea ===
//
// 1. Deploy de la función:
//      supabase functions deploy billing-cron
// 2. En el SQL editor del Supabase Dashboard, configurar pg_cron:
//
//      SELECT cron.schedule(
//        'asfion-billing-daily',
//        '0 6 * * *',  -- 06:00 UTC = 03:00 Argentina
//        $$
//          SELECT net.http_post(
//            url := 'https://<project>.supabase.co/functions/v1/billing-cron',
//            headers := jsonb_build_object(
//              'Authorization', 'Bearer ' || current_setting('app.cron_token')
//            )
//          );
//        $$
//      );
//
//    Requiere las extensiones pg_cron y pg_net habilitadas en el proyecto.
//    El cron_token tiene que estar configurado en app.cron_token (un secret
//    arbitrario que también valida la función vía CRON_SECRET env var).
//
// 3. Definir el secret:
//      supabase secrets set CRON_SECRET=<token-aleatorio>
//
// Para correr a mano (ej. testeo):
//      curl -X POST -H "Authorization: Bearer <CRON_SECRET>" \
//           https://<project>.supabase.co/functions/v1/billing-cron

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Tipos del cliente — duplicados acá para no acoplar al código de la app.
type Status = 'active' | 'past_due' | 'restricted' | 'suspended' | 'canceled';
interface ClienteRow {
  id: string;
  subscription_status: Status;
  period_end_date: string | null;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

function daysOverdue(periodEndDate: string | null, today = new Date()): number {
  if (!periodEndDate) return 0;
  const end = new Date(periodEndDate + 'T23:59:59');
  const diff = today.getTime() - end.getTime();
  if (diff <= 0) return 0;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Devuelve el status nuevo basado en el actual y los días vencidos. Null si
 * no hay cambio (evitamos UPDATE innecesario).
 */
function nextStatus(current: Status, days: number): Status | null {
  // Solo aplica forward transitions. Reverse (ej. past_due → active) lo hace
  // el admin cuando marca pago en el dashboard — no acá.
  if (current === 'suspended' || current === 'canceled') return null;

  if (days >= 20 && current !== 'suspended')  return 'suspended';
  if (days >= 8  && current !== 'restricted' && current !== 'suspended') return 'restricted';
  if (days >= 1  && current === 'active')     return 'past_due';
  return null;
}

Deno.serve(async (req) => {
  // Validación del secret: el cron de Postgres tiene que mandar Bearer auth.
  // Sin esto, cualquiera con la URL pública podría disparar la función.
  const auth = req.headers.get('Authorization') ?? '';
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Solo nos interesan los clientes que potencialmente cambien de estado:
  // los que YA tienen un period_end_date y todavía no están suspended/canceled.
  const { data, error } = await supa
    .from('clientes')
    .select('id, subscription_status, period_end_date')
    .not('period_end_date', 'is', null)
    .in('subscription_status', ['active', 'past_due', 'restricted']);

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  const today = new Date();
  const transitions: Array<{ id: string; from: Status; to: Status; days: number }> = [];

  for (const row of (data ?? []) as ClienteRow[]) {
    const days = daysOverdue(row.period_end_date, today);
    const next = nextStatus(row.subscription_status, days);
    if (!next) continue;

    const { error: upErr } = await supa
      .from('clientes')
      .update({ subscription_status: next })
      .eq('id', row.id);

    if (upErr) {
      // Logueamos pero no abortamos — queremos procesar todos los clientes
      // aunque uno falle (ej. constraint check). El supabase log queda como
      // audit trail.
      console.error(`[billing-cron] update failed for ${row.id}: ${upErr.message}`);
      continue;
    }

    transitions.push({ id: row.id, from: row.subscription_status, to: next, days });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      ranAt: today.toISOString(),
      checked: data?.length ?? 0,
      changed: transitions.length,
      transitions,
    }),
    { headers: { 'content-type': 'application/json' } },
  );
});
