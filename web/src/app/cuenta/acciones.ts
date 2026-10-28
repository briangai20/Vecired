"use server";

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

  const { error } = await supabase.rpc("borrar_mi_cuenta");
  if (error) {
    return { error: error.code === "P0001" ? error.message : "No pudimos borrar la cuenta. Probá de nuevo en un rato." };
  }
  await supabase.auth.signOut();
  redirect("/");
}
