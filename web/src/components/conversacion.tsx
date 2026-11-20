"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/navegador";

export type Mensaje = { id: number; autor_id: string; texto: string; creado_en: string };

const hora = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" });

// Mensajes entre el comprador y el comercio dentro de una reserva. Los nuevos
// llegan en vivo (Supabase Realtime); la base decide quién puede leer y escribir.
export function Conversacion({
  reserva,
  yo,
  otro,
  iniciales,
  abierta,
  sinLeer = 0,
}: {
  reserva: number;
  yo: string;
  otro: string; // "el comercio" / "el cliente", para los textos
  iniciales: Mensaje[];
  abierta: boolean; // si la reserva sigue en curso se puede escribir
  /** Mensajes del otro que todavía no leíste (avisos sin leer de esta reserva). */
  sinLeer?: number;
}) {
  const router = useRouter();
  const [mensajes, setMensajes] = useState<Mensaje[]>(() => [...iniciales].sort((a, b) => a.id - b.id));
  // Si la página se actualiza (llegó un aviso, volviste a la pestaña), se suman
  // los mensajes que trajo el servidor: así se ven también en la compu aunque
  // la conexión en vivo se haya cortado.
  const [antes, setAntes] = useState(iniciales);
  if (iniciales !== antes) {
    setAntes(iniciales);
    setMensajes((ms) => {
      const ids = new Set(ms.map((m) => m.id));
      return [...ms, ...iniciales.filter((m) => !ids.has(m.id))].sort((a, b) => a.id - b.id);
    });
  }
  const [nuevos, setNuevos] = useState(sinLeer);
  const [antesSinLeer, setAntesSinLeer] = useState(sinLeer);
  if (sinLeer !== antesSinLeer) {
    setAntesSinLeer(sinLeer);
    setNuevos(sinLeer);
  }
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [mostrar, setMostrar] = useState(sinLeer > 0);
  const lista = useRef<HTMLDivElement>(null);

  const sumar = (m: Mensaje) => setMensajes((ms) => (ms.some((x) => x.id === m.id) ? ms : [...ms, m].sort((a, b) => a.id - b.id)));

  // Escucha los mensajes nuevos de esta reserva mientras la página está abierta.
  useEffect(() => {
    const supabase = supabaseNavegador();
    const canal = supabase
      .channel(`mensajes-${reserva}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes", filter: `reserva_id=eq.${reserva}` }, (p) => {
        sumar(p.new as Mensaje);
        if ((p.new as Mensaje).autor_id !== yo) {
          setMostrar(true);
          setNuevos((n) => n + 1);
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [reserva, yo]);

  useEffect(() => {
    if (mostrar) lista.current?.scrollTo({ top: lista.current.scrollHeight });
  }, [mostrar, mensajes.length]);

  // Al ver la conversación, sus avisos de "Mensaje de…" quedan leídos.
  useEffect(() => {
    if (!mostrar || !nuevos) return;
    const t = setTimeout(() => {
      setNuevos(0);
      void supabaseNavegador()
        .from("notificaciones")
        .update({ leida_en: new Date().toISOString() })
        .eq("usuario_id", yo)
        .is("leida_en", null)
        .like("titulo", "Mensaje de %")
        .like("enlace", `%#reserva-${reserva}`)
        // Que el contador de mensajes del panel baje enseguida.
        .then(() => router.refresh());
    }, 1500);
    return () => clearTimeout(t);
  }, [mostrar, nuevos, reserva, yo, router]);

  // Si se abre desde un aviso (…#reserva-12), se despliega sola.
  useEffect(() => {
    const revisar = () => location.hash === `#reserva-${reserva}` && setMostrar(true);
    const t = setTimeout(revisar, 0);
    window.addEventListener("hashchange", revisar);
    return () => {
      clearTimeout(t);
      window.removeEventListener("hashchange", revisar);
    };
  }, [reserva]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    setError("");
    const { data, error } = await supabaseNavegador().from("mensajes").insert({ reserva_id: reserva, texto: t }).select().single();
    setEnviando(false);
    if (error || !data) {
      setError(error?.code === "P0001" ? error.message : "No se pudo enviar. Probá de nuevo.");
      return;
    }
    sumar(data);
    setTexto("");
  }

  if (!abierta && mensajes.length === 0) return null;

  return (
    <div className={`mt-3 rounded-xl border ${nuevos ? "border-naranja-vivo" : "border-white/20"}`}>
      <button
        type="button"
        onClick={() => setMostrar((v) => !v)}
        aria-expanded={mostrar}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm"
      >
        <span className="flex items-center gap-2">
          💬 Mensajes{mensajes.length ? ` (${mensajes.length})` : ""}
          {nuevos ? (
            <span className="rounded-full bg-naranja px-2 py-0.5 text-[11px] font-bold text-white">
              {nuevos} {nuevos === 1 ? "nuevo" : "nuevos"} de {otro}
            </span>
          ) : null}
        </span>
        <span aria-hidden className="text-white/70">{mostrar ? "−" : "+"}</span>
      </button>
      {mostrar ? (
        <div className="border-t border-white/15 p-3">
          <div ref={lista} className="max-h-60 space-y-2 overflow-y-auto">
            {mensajes.length === 0 ? (
              <p className="text-xs text-white/70">Escribile a {otro} si necesitás coordinar algo de esta reserva.</p>
            ) : (
              mensajes.map((m) => {
                const mio = m.autor_id === yo;
                return (
                  <div key={m.id} className={`flex ${mio ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${mio ? "bg-naranja text-white" : "bg-white/10"}`}>
                      <p className="whitespace-pre-wrap">{m.texto}</p>
                      <p className="mt-0.5 text-right text-[10px] opacity-70">{hora(m.creado_en)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {abierta ? (
            <form onSubmit={enviar} className="mt-2 flex gap-2">
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                maxLength={1000}
                placeholder="Escribí un mensaje…"
                aria-label={`Mensaje para ${otro}`}
                className="campo flex-1"
              />
              <button disabled={enviando || !texto.trim()} className="boton shrink-0 rounded-xl px-4 text-sm font-semibold">
                {enviando ? "…" : "Enviar"}
              </button>
            </form>
          ) : (
            <p className="mt-2 text-xs text-white/60">La reserva terminó: ya no se pueden mandar mensajes.</p>
          )}
          {error ? <p className="mt-1 text-xs text-[#ffb4a2]">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
