import "server-only";
import { supabaseAdmin } from "./supabase/admin";
import { plata, totalReserva } from "./formato";

// Avisos por mail con Resend. Necesitan dos variables SOLO de servidor
// (nunca con NEXT_PUBLIC_):
//   RESEND_API_KEY       clave de Resend (resend.com > API Keys)
//   SUPABASE_SECRET_KEY  clave secreta de Supabase, para leer el mail de
//                        cada usuario (Project Settings > API Keys > Secret)
// Opcional: MAIL_REMITENTE, por ejemplo "VeciRed <avisos@vecired.ar>".
// Si falta alguna, no se manda nada y la app sigue andando igual.

export type Evento =
  | "nueva" // al comercio
  | "cancelada" // al comercio
  | "alternativa_elegida" // al comercio
  | "aceptada" // al comprador
  | "rechazada" // al comprador
  | "alternativa" // al comprador
  | "retirada"; // al comprador (pide la reseña)

const AL_COMERCIO: Evento[] = ["nueva", "cancelada", "alternativa_elegida"];

function sitio() {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// Los errores de la conexión pueden traer la clave adentro: nunca llega a los registros.
const sinClaves = (texto: string) => texto.replace(/(sb_secret_|re_)[^"']*/g, "[clave oculta]");

const admin = supabaseAdmin;

async function enviar(para: string, asunto: string, html: string) {
  const clave = process.env.RESEND_API_KEY;
  if (!clave) {
    console.info(`[avisos] Sin RESEND_API_KEY: no se mandó "${asunto}"`);
    return;
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.MAIL_REMITENTE || "VeciRed <onboarding@resend.dev>", to: [para], subject: asunto, html }),
  });
  if (!r.ok) console.error(`[avisos] Resend respondió ${r.status}: ${await r.text()}`);
}

function plantilla(titulo: string, cuerpo: string, boton: { texto: string; url: string }) {
  return `<div style="font-family:Arial,sans-serif;background:#FFF8EC;padding:24px">
  <div style="max-width:520px;margin:auto;background:#14213D;color:#fff;border-radius:16px;padding:24px">
    <p style="margin:0;font-size:22px;font-weight:900">Veci<span style="color:#FF6B2C">Red</span></p>
    <h1 style="font-size:18px;margin:16px 0 8px">${titulo}</h1>
    <div style="font-size:14px;line-height:1.5">${cuerpo}</div>
    <a href="${boton.url}" style="display:inline-block;margin-top:20px;background:#D9480F;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:bold">${boton.texto}</a>
  </div>
</div>`;
}

// Arma y manda el aviso de una reserva. Nunca tira error: un mail que no
// sale no puede romper la reserva.
export async function avisarReserva(reservaId: number, evento: Evento) {
  try {
    const db = admin();
    if (!db) {
      console.info(`[avisos] Sin SUPABASE_SECRET_KEY: no se avisó "${evento}" de la reserva ${reservaId}`);
      return;
    }
    const { data: r, error: errorReserva } = await db
      .from("reservas")
      .select("*, comercio:comercios(nombre, direccion, dueno_id), comprador:perfiles!reservas_comprador_id_fkey(nombre)")
      .eq("id", reservaId)
      .maybeSingle();
    if (!r?.comercio) {
      console.error(`[avisos] No se pudo leer la reserva ${reservaId}: ${sinClaves(errorReserva?.message ?? "no existe")}`);
      return;
    }

    // Mails solo de lo importante. "cancelada" y "alternativa_elegida" quedan
    // en la campanita y el aviso del celular.
    if (evento === "cancelada" || evento === "alternativa_elegida") return;
    const sinCodigo = evento === "retirada" && !!r.retiro_sin_codigo;
    // Imprescindibles (se mandan aunque la persona elija "ninguno"): la reserva
    // nueva al comercio, el código de retiro y el aviso de entrega sin código.
    const siempre = evento === "nueva" || evento === "aceptada" || sinCodigo;

    const alComercio = AL_COMERCIO.includes(evento);
    const destinatario = alComercio ? r.comercio.dueno_id : r.comprador_id;
    if (!siempre) {
      const { data: perfil } = await db.from("perfiles").select("avisos_mail").eq("id", destinatario).maybeSingle();
      if (perfil?.avisos_mail === "ninguno") return;
    }
    const { data: u, error: errorUsuario } = await db.auth.admin.getUserById(destinatario);
    const mail = u.user?.email;
    if (!mail) {
      console.error(`[avisos] Sin mail para "${evento}" de la reserva ${reservaId}: ${sinClaves(errorUsuario?.message ?? "usuario sin mail")}`);
      return;
    }

    const producto = `${esc(r.producto_nombre)} × ${r.cantidad}`;
    const total = plata(totalReserva(r)) + (r.promo ? ` (promo ${esc(r.promo)})` : "");
    const cliente = esc(r.comprador?.nombre || "Un cliente");
    const comercio = esc(r.comercio.nombre);
    const panel = { texto: "Abrir mi panel", url: `${sitio()}/comerciante#reservas` };
    const misReservas = { texto: "Ver mis reservas", url: `${sitio()}/reservas` };

    const { data: cod } = evento === "aceptada" ? await db.from("reserva_codigos").select("codigo").eq("reserva_id", r.id).maybeSingle() : { data: null };
    const codigo = cod?.codigo
      ? `<p style="margin:16px 0 4px">Tu código de retiro:</p><p style="font-size:32px;font-weight:900;letter-spacing:8px;margin:0;color:#FF6B2C">${esc(cod.codigo)}</p><p style="font-size:12px;margin-top:4px">Mostráselo al comercio cuando retires. No lo compartas con nadie más.</p>`
      : "";
    const cuando = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short" }).format(new Date(r.actualizada_en));

    const mensajes: Record<Evento, [string, string, { texto: string; url: string }]> = {
      nueva: [
        `Nueva reserva: ${r.producto_nombre}`,
        `<p>${cliente} reservó <b>${producto}</b> (${total}) para retirar <b>${esc(r.retiro)}</b>.</p><p>Tenés <b>2 horas de tu horario de atención</b> para aceptarla, rechazarla u ofrecer otra cosa (si llegó con el local cerrado, empiezan a contar cuando abrís). Si no, vence sola.</p>`,
        panel,
      ],
      cancelada: [`${r.comprador?.nombre || "El cliente"} canceló una reserva`, `<p>${cliente} canceló <b>${producto}</b>. Si ya la habías aceptado, el stock volvió a tu catálogo.</p>`, panel],
      alternativa_elegida: [
        `${r.comprador?.nombre || "El cliente"} eligió una alternativa`,
        `<p>${cliente} eligió <b>${producto}</b> (${total}). Quedó confirmada: separalo para el retiro <b>${esc(r.retiro)}</b>.</p>`,
        panel,
      ],
      aceptada: [
        `${r.comercio.nombre} confirmó tu reserva`,
        `<p>Ya te separaron <b>${producto}</b>. Pasá a retirarlo <b>${esc(r.retiro)}</b> por ${esc(r.comercio.direccion)}.</p><p>Total a pagar en el local: <b>${total}</b>.</p>${codigo}<p>Si no llegás en ese horario, te lo guardan un día de atención más; después la reserva vence.</p>`,
        misReservas,
      ],
      rechazada: [
        `${r.comercio.nombre} no pudo confirmar tu reserva`,
        `<p>${comercio} no tiene <b>${producto}</b> en este momento. No se cobró nada. Podés buscarlo en otro comercio cercano.</p>`,
        { texto: "Buscar en otro comercio", url: sitio() },
      ],
      alternativa: [
        `${r.comercio.nombre} te ofrece otra opción`,
        `<p>${comercio} no tiene <b>${producto}</b>, pero te ofrece alternativas. Elegí una dentro de las 2 horas (en horario del local) desde esta oferta, o cancelala sin costo.</p>`,
        misReservas,
      ],
      retirada: sinCodigo
        ? [
            "Tu reserva figura como retirada sin código",
            `<p>${comercio} marcó como entregada <b>${producto}</b> sin tu código de retiro (${cuando}). Motivo: ${esc(r.retiro_sin_codigo ?? "")}.</p><p><b>Si no fuiste vos</b>, entrá a Mis reservas y tocá "No lo retiré" dentro de las 48 horas. Lo revisamos.</p>`,
            { texto: "Ver mis reservas", url: `${sitio()}/reservas#reserva-${r.id}` },
          ]
        : [
            `Comprobante de retiro en ${r.comercio.nombre}`,
            `<p>Retiraste <b>${producto}</b> en ${comercio} (${esc(r.comercio.direccion)}) el ${cuando}. Total: <b>${total}</b>.</p><p>¿Cómo te atendieron? Dejá una reseña en un minuto: ayuda a tus vecinos.</p>`,
            { texto: "Dejar mi reseña", url: `${sitio()}/reservas` },
          ],
    };

    const [asunto, cuerpo, boton] = mensajes[evento];
    await enviar(mail, asunto, plantilla(esc(asunto), cuerpo, boton));
  } catch (e) {
    console.error(`[avisos] No se pudo mandar el aviso: ${sinClaves(String(e))}`);
  }
}

// Les avisa a los administradores que hay un comercio para revisar en /admin:
// recién cargado, o corregido después de un rechazo.
export async function avisarParaRevisar(comercioId: number, corregido: boolean) {
  try {
    const db = admin();
    if (!db) {
      console.info(`[avisos] Sin SUPABASE_SECRET_KEY: no se avisó a los administradores del comercio ${comercioId}`);
      return;
    }
    const [{ data: c, error: errorComercio }, { data: admins, error: errorAdmins }] = await Promise.all([
      db.from("comercios").select("nombre, rubro, direccion, dueno:perfiles!comercios_dueno_id_fkey(nombre)").eq("id", comercioId).maybeSingle(),
      db.from("administradores").select("usuario_id"),
    ]);
    if (!c || !admins?.length) {
      console.error(`[avisos] No se pudo avisar a los administradores del comercio ${comercioId}: ${sinClaves(errorComercio?.message ?? errorAdmins?.message ?? "sin comercio o sin administradores")}`);
      return;
    }

    const asunto = corregido ? `${c.nombre} corrigió su comercio` : `Comercio nuevo para revisar: ${c.nombre}`;
    const cuerpo = `<p><b>${esc(c.nombre)}</b> (${esc(c.rubro)}) ${corregido ? "corrigió lo que le pediste y volvió a revisión" : "se sumó a VeciRed y espera tu aprobación"}.</p><p>${esc(c.direccion)}${c.dueno?.nombre ? ` · ${esc(c.dueno.nombre)}` : ""}</p><p>Revisalo pronto: mientras no lo apruebes, los vecinos no lo ven.</p>`;
    const html = plantilla(esc(asunto), cuerpo, { texto: "Revisar en el panel", url: `${sitio()}/admin` });

    for (const { usuario_id } of admins) {
      const { data: u, error: errorUsuario } = await db.auth.admin.getUserById(usuario_id);
      if (u.user?.email) await enviar(u.user.email, asunto, html);
      else console.error(`[avisos] Administrador sin mail: ${sinClaves(errorUsuario?.message ?? "usuario sin mail")}`);
    }
  } catch (e) {
    console.error(`[avisos] No se pudo avisar a los administradores: ${sinClaves(String(e))}`);
  }
}

// Le avisa al comerciante que su comercio quedó publicado, o por qué no.
export async function avisarRevision(comercioId: number) {
  try {
    const db = admin();
    if (!db) {
      console.info(`[avisos] Sin SUPABASE_SECRET_KEY: no se avisó la revisión del comercio ${comercioId}`);
      return;
    }
    const { data: c, error: errorComercio } = await db.from("comercios").select("nombre, dueno_id, aprobado, motivo_rechazo").eq("id", comercioId).maybeSingle();
    if (!c) {
      console.error(`[avisos] No se pudo leer el comercio ${comercioId}: ${sinClaves(errorComercio?.message ?? "no existe")}`);
      return;
    }
    const { data: u, error: errorUsuario } = await db.auth.admin.getUserById(c.dueno_id);
    const mail = u.user?.email;
    if (!mail) {
      console.error(`[avisos] Sin mail para la revisión del comercio ${comercioId}: ${sinClaves(errorUsuario?.message ?? "usuario sin mail")}`);
      return;
    }

    const panel = { texto: "Abrir mi panel", url: `${sitio()}/comerciante` };
    if (c.aprobado) {
      const asunto = `¡${c.nombre} ya está en VeciRed!`;
      await enviar(
        mail,
        asunto,
        plantilla(esc(asunto), `<p>Revisamos tu comercio y ya lo pueden encontrar los vecinos. Mantené precios y stock al día para recibir reservas.</p>`, panel),
      );
    } else {
      const asunto = `Tu comercio necesita un cambio para publicarse`;
      await enviar(
        mail,
        asunto,
        plantilla(
          esc(asunto),
          `<p>Revisamos <b>${esc(c.nombre)}</b> y todavía no lo podemos publicar:</p><p><i>${esc(c.motivo_rechazo ?? "")}</i></p><p>Corregilo desde tu panel y lo volvemos a revisar.</p>`,
          panel,
        ),
      );
    }
  } catch (e) {
    console.error(`[avisos] No se pudo mandar el aviso de revisión: ${sinClaves(String(e))}`);
  }
}
