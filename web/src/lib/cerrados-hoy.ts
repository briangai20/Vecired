import type { SupabaseClient } from "@supabase/supabase-js";
import { fechaAR } from "@/lib/formato";
import type { Database } from "@/lib/supabase/tipos";

// Qué comercios están cerrados hoy por un cierre puntual (vacaciones,
// inventario) o por feriado (si no abren feriados). Tres consultas en total,
// sin importar cuántos comercios sean: antes era una por comercio.
// Misma regla que la función dias_cerrados de la base (supabase/08_feriados.sql).
export async function cerradosHoy(db: SupabaseClient<Database>, ids: number[], ahora: Date) {
  if (!ids.length) return new Set<number>();
  const hoy = fechaAR(ahora);
  const [{ data: cierres }, { data: feriado }, { data: comercios }] = await Promise.all([
    db.from("cierres").select("comercio_id").in("comercio_id", ids).lte("desde", hoy).gte("hasta", hoy),
    db.from("feriados").select("fecha").eq("fecha", hoy).neq("tipo", "puente").limit(1),
    db.from("comercios").select("id, abre_feriados").in("id", ids),
  ]);
  const cerrados = new Set((cierres ?? []).map((c) => c.comercio_id));
  if (feriado?.length) for (const c of comercios ?? []) if (!c.abre_feriados) cerrados.add(c.id);
  return cerrados;
}
