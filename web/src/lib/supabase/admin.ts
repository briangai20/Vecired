import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./tipos";

// Cliente con la clave secreta (SUPABASE_SECRET_KEY, solo de servidor): saltea
// las reglas de la base. Solo para lo que no puede hacer el propio usuario,
// como leer mails para los avisos o guardar la foto de alguien que todavía no
// confirmó su cuenta. null si la clave no está cargada.
export function supabaseAdmin() {
  // Al pegarla puede colarse un salto de línea, que la vuelve inválida.
  const clave = process.env.SUPABASE_SECRET_KEY?.replace(/\s/g, "");
  if (!clave) return null;
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
