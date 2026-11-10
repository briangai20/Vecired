import { usuarioActual } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { Corazon } from "./corazon";

// Lee si el producto o comercio ya está en favoritos y muestra el corazón.
export async function Favorito({ tipo, id, className }: { tipo: "producto" | "comercio"; id: number; className?: string }) {
  const usuario = await usuarioActual();
  if (!usuario) return <Corazon tipo={tipo} id={id} guardado={false} conSesion={false} className={className} />;
  const supabase = await supabaseServidor();
  const { data } = await supabase
    .from("favoritos")
    .select("id")
    .eq(tipo === "producto" ? "producto_id" : "comercio_id", id)
    .maybeSingle();
  return <Corazon tipo={tipo} id={id} guardado={!!data} conSesion className={className} />;
}
