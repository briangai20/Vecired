"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { avisarRevision } from "@/lib/avisos";
import { usuarioActual } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";

// Aprobar, rechazar o despublicar un comercio. La base vuelve a controlar
// que sea un administrador (revisar_comercio).
export async function revisarComercio(d: FormData) {
  const u = await usuarioActual();
  if (!u?.admin) redirect("/");
  const comercio = Number(d.get("comercio"));
  const aprobar = d.get("accion") === "aprobar";
  const motivo = String(d.get("motivo") ?? "").trim();
  const ver = String(d.get("ver") ?? "pendientes");
  if (!comercio) return;

  const supabase = await supabaseServidor();
  const { error } = await supabase.rpc("revisar_comercio", { p_comercio: comercio, p_aprobar: aprobar, p_motivo: motivo || undefined });
  if (error) redirect(`/admin?ver=${ver}&error=${encodeURIComponent(error.message)}`);
  after(() => avisarRevision(comercio));
  redirect(`/admin?ver=${ver}&ok=${encodeURIComponent(aprobar ? "Comercio publicado." : "Listo: le avisamos el motivo al comerciante.")}`);
}
