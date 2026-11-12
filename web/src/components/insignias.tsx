import type { Disponibilidad } from "@/lib/formato";

export function Estrellas({ valor, className = "text-sm" }: { valor: number | null; className?: string }) {
  const llenas = Math.round(valor ?? 0);
  return (
    <span className={`${className} tracking-tight whitespace-nowrap`} aria-label={valor ? `${valor.toFixed(1)} de 5` : "Sin reseñas"}>
      <span className="text-estrella">{"★".repeat(llenas)}</span>
      <span className="text-white/35">{"★".repeat(5 - llenas)}</span>
    </span>
  );
}

export function Abierto({ abierto }: { abierto: boolean | null }) {
  if (abierto == null) return null;
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${abierto ? "border-verde bg-verde/15 text-verde" : "border-white/40 text-white/70"}`}
    >
      {abierto ? "Abierto" : "Cerrado"}
    </span>
  );
}

// Solo se publican comercios que revisamos (ver /admin), así que la insignia va
// en todos los que se ven.
export function Verificado() {
  return (
    <span
      className="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-marino"
      title="Revisamos que este comercio exista antes de publicarlo"
    >
      ✓ Comercio verificado
    </span>
  );
}

const BORDE: Record<Disponibilidad["tono"], string> = {
  ok: "border-verde bg-verde text-marino",
  poco: "border-estrella bg-estrella text-marino",
  no: "border-white/40 bg-marino-claro text-white/80 line-through",
  consultar: "border-dashed border-white/70 bg-marino-claro text-white",
};

export function Stock({ d }: { d: Disponibilidad }) {
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold shadow-sm ${BORDE[d.tono]}`}>
      {d.texto}
    </span>
  );
}
