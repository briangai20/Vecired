"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { avisarRevision } from "@/lib/avisos";
import { usuarioActual } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { CONTROLES, type Control } from "./verificar";

// Aprobar, rechazar o despublicar un comercio. La base vuelve a controlar
// que sea un administrador (revisar_comercio).
export async function revisarComercio(d: FormData) {
  const u = await usuarioActual();
  if (!u?.admin) redirect("/");
  const comercio = Number(d.get("comercio"));
  const aprobar = d.get("accion") === "aprobar";
  // Motivo escrito a mano, o uno de los más comunes.
  const motivo = String(d.get("motivo") ?? "").trim() || String(d.get("motivo_rapido") ?? "").trim();
  const controles = d.getAll("control").map(String).filter((c): c is Control => c in CONTROLES);
  const ver = String(d.get("ver") ?? "pendientes");
  if (!comercio) return;
  if (aprobar && !controles.includes("existe")) {
    redirect(`/admin?ver=${ver}&error=${encodeURIComponent("Antes de publicar, confirmá que el local existe.")}#c${comercio}`);
  }

  const supabase = await supabaseServidor();
  const { error } = await supabase.rpc("revisar_comercio", {
    p_comercio: comercio,
    p_aprobar: aprobar,
    p_motivo: motivo || undefined,
    p_controles: aprobar ? controles : undefined,
  });
  if (error) redirect(`/admin?ver=${ver}&error=${encodeURIComponent(error.message)}`);
  after(() => avisarRevision(comercio));
  redirect(`/admin?ver=${ver}&ok=${encodeURIComponent(aprobar ? "Comercio publicado." : "Listo: le avisamos el motivo al comerciante.")}`);
}
