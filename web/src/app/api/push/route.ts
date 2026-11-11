import webpush from "web-push";
import { VAPID_PUBLICA } from "@/lib/push";
import { supabaseAdmin } from "@/lib/supabase/admin";

// La base llama acá (con pg_net) cada vez que crea una notificación para
// alguien que activó los avisos (ver supabase/18_avisos_push.sql). Se manda a
// todos sus aparatos.
//
// No hace falta clave: solo se mandan notificaciones que existen, que se
// crearon hace menos de 5 minutos y que todavía no se mandaron. Lo peor que
// puede hacer un extraño es adelantar un aviso que igual iba a llegar.
//
// Necesita, solo en el servidor: VAPID_PRIVADA y SUPABASE_SECRET_KEY.

export async function POST(pedido: Request) {
  const privada = process.env.VAPID_PRIVADA?.replace(/\s/g, "");
  const admin = supabaseAdmin();
  if (!privada || !admin) return Response.json({ enviado: 0, motivo: "sin configurar" });

  let id = 0;
  try {
    id = Number((await pedido.json())?.id);
  } catch {}
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "Falta el id" }, { status: 400 });

  // Se marca como enviada en el mismo paso, así dos llamadas no mandan dos veces.
  const { data: n } = await admin
    .from("notificaciones")
    .update({ push_enviada_en: new Date().toISOString() })
    .eq("id", id)
    .is("push_enviada_en", null)
    .gt("creada_en", new Date(Date.now() - 5 * 60_000).toISOString())
    .select("id, usuario_id, titulo, cuerpo, enlace")
    .maybeSingle();
  if (!n) return Response.json({ enviado: 0 });

  const { data: aparatos } = await admin.from("suscripciones_push").select("id, endpoint, p256dh, auth").eq("usuario_id", n.usuario_id);
  if (!aparatos?.length) return Response.json({ enviado: 0 });

  webpush.setVapidDetails("https://vecired.com.ar", VAPID_PUBLICA, privada);
  const aviso = JSON.stringify({ id: n.id, titulo: n.titulo, cuerpo: n.cuerpo, enlace: n.enlace });
  const vencidas: number[] = [];
  let enviado = 0;
  await Promise.all(
    aparatos.map(async (a) => {
      try {
        await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, aviso, {
          TTL: 60 * 60 * 24,
          urgency: "high",
        });
        enviado++;
      } catch (e) {
        const estado = (e as { statusCode?: number }).statusCode;
        // 404 / 410: la persona desactivó los avisos o desinstaló; se borra.
        if (estado === 404 || estado === 410) vencidas.push(a.id);
        else console.error(`[push] No se pudo mandar el aviso ${n.id}: ${estado ?? (e as Error).message}`);
      }
    }),
  );
  if (vencidas.length) await admin.from("suscripciones_push").delete().in("id", vencidas);
  return Response.json({ enviado });
}
