"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";

export type EstadoBaja = { error?: string };

const ACTIVAS = ["pendiente", "alternativa", "aceptada"] as const;

// Borra la cuenta del usuario y todo lo suyo (perfil, comercios, productos,
// reservas y reseñas). La base vuelve a controlar las reservas activas en
// borrar_mi_cuenta; acá se revisan antes para no borrar fotos en vano.
export async function borrarCuenta(_: EstadoBaja, d: FormData): Promise<EstadoBaja> {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/ingresar?siguiente=/cuenta");
  if (String(d.get("confirmacion") ?? "").trim().toUpperCase() !== "BORRAR") {
    return { error: "Escribí BORRAR para confirmar." };
  }

  const supabase = await supabaseServidor();
  const { data: comercios } = await supabase.from("comercios").select("id").eq("dueno_id", usuario.id);
  const ids = (comercios ?? []).map((c) => c.id);

  const [{ count: comoComprador }, { count: comoComercio }] = await Promise.all([
    supabase.from("reservas").select("id", { count: "exact", head: true }).eq("comprador_id", usuario.id).in("estado", ACTIVAS),
    ids.length
      ? supabase.from("reservas").select("id", { count: "exact", head: true }).in("comercio_id", ids).in("estado", ACTIVAS)
      : Promise.resolve({ count: 0 }),
  ]);
  if (comoComprador) return { error: "Tenés reservas activas. Cancelalas desde Mis reservas antes de borrar la cuenta." };
  if (comoComercio) return { error: "Tu comercio tiene reservas activas. Respondelas o marcalas como retiradas antes de borrar la cuenta." };

  // Fotos de productos: cada comercio tiene su carpeta en el bucket "productos".
  for (const id of ids) {
    const { data: fotos } = await supabase.storage.from("productos").list(String(id), { limit: 1000 });
    if (fotos?.length) await supabase.storage.from("productos").remove(fotos.map((f) => `${id}/${f.name}`));
  }

  // Foto de perfil: carpeta <id del usuario> en el bucket "perfiles".
  const { data: fotosPerfil } = await supabase.storage.from("perfiles").list(usuario.id, { limit: 100 });
  if (fotosPerfil?.length) await supabase.storage.from("perfiles").remove(fotosPerfil.map((f) => `${usuario.id}/${f.name}`));

  const { error } = await supabase.rpc("borrar_mi_cuenta");
  if (error) {
    return { error: error.code === "P0001" ? error.message : "No pudimos borrar la cuenta. Probá de nuevo en un rato." };
  }
  await supabase.auth.signOut();
  redirect("/");
}

export type EstadoPerfil = { error?: string; ok?: string; campos?: Record<string, string> };

// Nombre y teléfono del perfil.
export async function guardarPerfil(_: EstadoPerfil, d: FormData): Promise<EstadoPerfil> {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/ingresar?siguiente=/cuenta");
  const nombre = String(d.get("nombre") ?? "").trim();
  const telefono = String(d.get("telefono") ?? "").trim();
  const campos: Record<string, string> = {};
  if (!nombre) campos.nombre = "Escribí tu nombre y apellido: es lo que ve el comercio cuando reservás.";
  else if (nombre.length > 80) campos.nombre = "El nombre es demasiado largo (hasta 80 letras).";
  const digitos = telefono.replace(/\D/g, "");
  if (telefono && digitos.length < 10) {
    campos.telefono = `El teléfono tiene ${digitos.length} números y tienen que ser al menos 10: código de área + número, por ejemplo 11 2345 6789.`;
  }
  if (Object.keys(campos).length) return { campos, error: "Revisá los datos marcados en rojo." };

  const supabase = await supabaseServidor();
  const { error } = await supabase.from("perfiles").update({ nombre, telefono: telefono || null }).eq("id", usuario.id);
  if (error) {
    console.error("[perfil]", error.code, error.message);
    return { error: "No pudimos guardar tus datos. Revisá tu conexión y probá de nuevo." };
  }
  refresh();
  return { ok: "Tus datos quedaron guardados." };
}

// Foto de perfil ya subida a Storage (perfiles/<id>/…), o null para quitarla.
export async function guardarFotoPerfil(url: string | null): Promise<{ error?: string }> {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/ingresar?siguiente=/cuenta");
  const carpeta = `/storage/v1/object/public/perfiles/${usuario.id}/`;
  if (url && !url.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}${carpeta}`)) return { error: "Esa foto no es tuya." };
  const supabase = await supabaseServidor();
  const { error } = await supabase.from("perfiles").update({ foto_url: url }).eq("id", usuario.id);
  if (error) {
    console.error("[foto perfil]", error.code, error.message);
    return {
      error: error.message.includes("foto_url")
        ? "La foto de perfil todavía no está activada en VeciRed. Probá más tarde."
        : "No pudimos guardar la foto. Probá de nuevo.",
    };
  }
  refresh();
  return {};
}

// Vuelve a publicar el comercio que se había dado de baja (la cuenta vuelve a
// ser de comerciante).
export async function reactivarComercio() {
  if (!(await usuarioActual())) redirect("/ingresar?siguiente=/cuenta");
  const supabase = await supabaseServidor();
  const { error } = await supabase.rpc("reactivar_mi_comercio");
  if (error) redirect(`/cuenta?error=${encodeURIComponent(error.code === "P0001" ? error.message : "No pudimos reactivar el comercio. Probá de nuevo.")}`);
  redirect("/comerciante");
}
