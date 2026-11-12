"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/navegador";
import type { Tabla } from "@/lib/supabase/tipos";
import { AvisosCelular } from "./avisos-celular";

type Notificacion = Tabla<"notificaciones">;

// Color de cada aviso: naranja si hay que hacer algo (y los viejos, sin tono),
// verde si salió bien (aceptada, publicado) y rojo si no (rechazada, vencida).
const TONO = {
  accion: { punto: "bg-naranja-vivo", borde: "border-l-naranja-vivo", icono: "🔔" },
  bien: { punto: "bg-verde", borde: "border-l-verde", icono: "✅" },
  mal: { punto: "bg-rojo", borde: "border-l-rojo", icono: "❌" },
} as const;
const tono = (n: Notificacion) => TONO[n.tono ?? "accion"];

const SIN_SONIDO = "vecired-sin-sonido";

// "Ding" corto de dos notas, armado en el navegador (sin archivos de audio).
// Los navegadores solo dejan sonar después de que la persona tocó la página
// una vez, así que el audio se "destraba" con el primer toque.
let audio: AudioContext | null = null;
function prepararAudio() {
  if (typeof window === "undefined") return;
  audio ??= new AudioContext();
  if (audio.state === "suspended") void audio.resume();
}
function sonar() {
  if (!audio || audio.state !== "running") return;
  const ahora = audio.currentTime;
  for (const [i, frecuencia] of [880, 1320].entries()) {
    const osc = audio.createOscillator();
    const vol = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = frecuencia;
    const t = ahora + i * 0.14;
    vol.gain.setValueAtTime(0.0001, t);
    vol.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    vol.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(vol).connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  }
}

const hace = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "numeric" });
};

// Campanita del encabezado: lista de avisos, contador de no leídos, sonido y
// cartelito cuando llega uno nuevo con la página abierta.
export function Campanita({ yo }: { yo: string }) {
  const router = useRouter();
  const [lista, setLista] = useState<Notificacion[]>([]);
  const [abierta, setAbierta] = useState(false);
  const [cartel, setCartel] = useState<Notificacion | null>(null);
  // Solo se muestra dentro de la lista (cerrada al cargar), así que leerlo acá no desacomoda la página.
  const [silencio, setSilencio] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(SIN_SONIDO) === "1";
    } catch {
      return false;
    }
  });
  const caja = useRef<HTMLDivElement>(null);
  const noLeidas = lista.filter((n) => !n.leida_en).length;

  const cargar = useCallback(async () => {
    const { data } = await supabaseNavegador()
      .from("notificaciones")
      .select("*")
      .eq("usuario_id", yo)
      .order("creada_en", { ascending: false })
      .limit(30);
    if (data) setLista(data);
  }, [yo]);

  useEffect(() => {
    const primera = setTimeout(() => void cargar(), 0);
    const destrabar = () => prepararAudio();
    window.addEventListener("pointerdown", destrabar, { once: true });
    window.addEventListener("keydown", destrabar, { once: true });

    const supabase = supabaseNavegador();
    const canal = supabase
      .channel(`notificaciones-${yo}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notificaciones", filter: `usuario_id=eq.${yo}` }, (p) => {
        const n = p.new as Notificacion;
        setLista((l) => (l.some((x) => x.id === n.id) ? l : [n, ...l]));
        setCartel(n);
        let mudo = false;
        try {
          mudo = localStorage.getItem(SIN_SONIDO) === "1";
        } catch {}
        if (!mudo) sonar();
        // Que la pantalla muestre la reserva, el mensaje o el estado nuevo.
        router.refresh();
      })
      .subscribe();
    // Al volver a la pestaña, por si llegó algo mientras la conexión estaba dormida.
    const alVolver = () => document.visibilityState === "visible" && void cargar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearTimeout(primera);
      supabase.removeChannel(canal);
      window.removeEventListener("pointerdown", destrabar);
      window.removeEventListener("keydown", destrabar);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [yo, cargar, router]);

  // El cartelito se va solo a los 6 segundos.
  useEffect(() => {
    if (!cartel) return;
    const t = setTimeout(() => setCartel(null), 6000);
    return () => clearTimeout(t);
  }, [cartel]);

  // Contador en el título de la pestaña: "(2) VeciRed".
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\) /, "");
    document.title = noLeidas ? `(${noLeidas}) ${base}` : base;
  }, [noLeidas]);

  // Cerrar al tocar afuera.
  useEffect(() => {
    if (!abierta) return;
    const fuera = (e: PointerEvent) => !caja.current?.contains(e.target as Node) && setAbierta(false);
    document.addEventListener("pointerdown", fuera);
    return () => document.removeEventListener("pointerdown", fuera);
  }, [abierta]);

  async function marcar(ids: number[]) {
    if (!ids.length) return;
    const ahora = new Date().toISOString();
    setLista((l) => l.map((n) => (ids.includes(n.id) ? { ...n, leida_en: n.leida_en ?? ahora } : n)));
    await supabaseNavegador().from("notificaciones").update({ leida_en: ahora }).in("id", ids);
  }

  function cambiarSonido() {
    const nuevo = !silencio;
    setSilencio(nuevo);
    try {
      localStorage.setItem(SIN_SONIDO, nuevo ? "1" : "0");
    } catch {}
    if (!nuevo) {
      prepararAudio();
      setTimeout(sonar, 50);
    }
  }

  return (
    <div ref={caja} className="sm:relative">
      <button
        type="button"
        onClick={() => {
          prepararAudio();
          setAbierta((v) => !v);
        }}
        aria-label={noLeidas ? `Avisos: ${noLeidas} sin leer` : "Avisos"}
        aria-expanded={abierta}
        className="relative grid h-10 w-10 place-items-center rounded-xl border border-white/30 text-white transition hover:bg-white/10"
      >
        <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {noLeidas ? (
          <span className="absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-naranja px-1 text-[11px] font-bold">
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        ) : null}
      </button>

      {abierta ? (
        // En el celular cuelga del encabezado, a lo ancho de la pantalla (pegado a
        // la campanita se salía por la izquierda); en la compu cuelga del botón.
        <div className="absolute inset-x-4 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-white/20 bg-marino text-white shadow-2xl shadow-black/50 sm:inset-x-auto sm:right-0 sm:w-[22rem]">
          <div className="flex items-center justify-between gap-2 border-b border-white/15 px-4 py-3">
            <p className="font-semibold">Avisos</p>
            <div className="flex items-center gap-3 text-xs">
              <button type="button" onClick={cambiarSonido} className="underline" aria-pressed={!silencio}>
                {silencio ? "🔇 Sin sonido" : "🔔 Con sonido"}
              </button>
              {noLeidas ? (
                <button type="button" onClick={() => marcar(lista.filter((n) => !n.leida_en).map((n) => n.id))} className="underline">
                  Marcar leídos
                </button>
              ) : null}
            </div>
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {lista.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-white/70">Todavía no tenés avisos.</li>
            ) : (
              lista.map((n) => (
                <li key={n.id} className="border-b border-white/10 last:border-0">
                  <Link
                    href={n.enlace ?? "#"}
                    onClick={() => {
                      void marcar([n.id]);
                      setAbierta(false);
                    }}
                    className={`flex gap-3 border-l-4 px-4 py-3 text-sm transition hover:bg-white/5 ${tono(n).borde} ${n.leida_en ? "text-white/70" : "bg-white/[0.04]"}`}
                  >
                    <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.leida_en ? "bg-transparent" : tono(n).punto}`} />
                    <span className="min-w-0 flex-1">
                      <span className={`block ${n.leida_en ? "" : "font-semibold"}`}>{n.titulo}</span>
                      {n.cuerpo ? <span className="mt-0.5 block text-xs text-white/75">{n.cuerpo}</span> : null}
                      <span className="mt-1 block text-[11px] text-white/55">{hace(n.creada_en)}</span>
                    </span>
                  </Link>
                </li>
              ))
            )}
          </ul>
          <AvisosCelular />
        </div>
      ) : null}

      {cartel ? (
        <div role="status" className={`fixed right-4 bottom-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-l-8 border-white/30 ${tono(cartel).borde} bg-marino p-4 text-white shadow-2xl shadow-black/50`}>
          <div className="flex items-start gap-3">
            <span aria-hidden className="text-xl">{tono(cartel).icono}</span>
            <Link
              href={cartel.enlace ?? "#"}
              onClick={() => {
                void marcar([cartel.id]);
                setCartel(null);
              }}
              className="min-w-0 flex-1"
            >
              <span className="block font-semibold">{cartel.titulo}</span>
              {cartel.cuerpo ? <span className="mt-0.5 block text-sm text-white/80">{cartel.cuerpo}</span> : null}
            </Link>
            <button type="button" onClick={() => setCartel(null)} aria-label="Cerrar aviso" className="text-white/70 hover:text-white">
              ✕
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
