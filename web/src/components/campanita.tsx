"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/navegador";
import type { Tabla } from "@/lib/supabase/tipos";
import { AvisosCelular } from "./avisos-celular";

type Notificacion = Tabla<"notificaciones">;
type Categoria = Notificacion["categoria"];

// Los avisos se borran solos a los 7 días (en la base); acá tampoco se
// muestran los más viejos, por si todavía no pasó el borrado del día.
const SIETE_DIAS = 7 * 24 * 60 * 60 * 1000;

const ICONO: Record<Categoria, string> = {
  reservas: "📦",
  mensajes: "💬",
  ofertas: "🏷️",
  favoritos: "❤️",
  resenas: "⭐",
  cuenta: "🏪",
};

// Misma regla que la base (categoria_aviso), para los avisos que llegaron
// antes de que existiera la categoría.
function categoriaDe(n: Notificacion): Categoria {
  if (n.categoria && n.categoria !== "cuenta") return n.categoria;
  const t = n.titulo;
  const e = n.enlace ?? "";
  if (t.startsWith("Mensaje de ")) return "mensajes";
  if (/^Nueva (pregunta|reseña)|respondió tu (pregunta|reseña)$|^¿Cómo te fue en /.test(t)) return "resenas";
  if (e.includes("seccion=reservas") || e.startsWith("/reservas") || t.startsWith("Reclamo")) return "reservas";
  return n.categoria ?? "cuenta";
}

// Destacadas: las que piden que hagas algo (una reserva nueva, un mensaje, se
// pasa el horario...). No las de ofertas, favoritos ni las que salieron bien o mal.
const destacada = (n: Notificacion) => (n.tono ?? "accion") === "accion" && ["reservas", "mensajes", "resenas"].includes(categoriaDe(n));

type Filtro = "todas" | "destacadas" | Categoria;
const FILTROS: [Filtro, string][] = [
  ["todas", "Todas"],
  ["destacadas", "Destacadas"],
  ["reservas", "Reservas"],
  ["mensajes", "Mensajes"],
  ["ofertas", "Ofertas"],
  ["favoritos", "Comercios favoritos"],
  ["resenas", "Reseñas y preguntas"],
  ["cuenta", "Mi cuenta"],
];
const pasa = (n: Notificacion, f: Filtro) => (f === "todas" ? true : f === "destacadas" ? destacada(n) : categoriaDe(n) === f);

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

// Campanita del encabezado: lista de avisos por categoría, contador de no
// leídos, sonido y cartelito cuando llega uno nuevo con la página abierta.
export function Campanita({ yo }: { yo: string }) {
  const router = useRouter();
  const [lista, setLista] = useState<Notificacion[]>([]);
  const [abierta, setAbierta] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("todas");
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
  const visibles = lista.filter((n) => pasa(n, filtro));
  // Solo las pestañas que tienen algo (Todas siempre).
  const filtros = FILTROS.filter(([f]) => f === "todas" || f === filtro || lista.some((n) => pasa(n, f)));

  const cargar = useCallback(async () => {
    const { data } = await supabaseNavegador()
      .from("notificaciones")
      .select("*")
      .eq("usuario_id", yo)
      .gte("creada_en", new Date(Date.now() - SIETE_DIAS).toISOString())
      .order("creada_en", { ascending: false })
      .limit(100);
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
      // Leídos desde otro aparato con la misma cuenta.
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notificaciones", filter: `usuario_id=eq.${yo}` }, (p) => {
        const n = p.new as Notificacion;
        setLista((l) => l.map((x) => (x.id === n.id ? { ...x, leida_en: n.leida_en } : x)));
      })
      .subscribe();
    // Al volver a la pestaña, por si llegó algo mientras la conexión estaba dormida.
    const alVolver = () => {
      if (document.visibilityState !== "visible") return;
      void cargar();
      router.refresh();
    };
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

  const sinLeerDe = (f: Filtro) => lista.filter((n) => !n.leida_en && pasa(n, f)).length;

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
        <div className="absolute inset-x-4 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-marino/15 bg-white text-marino shadow-2xl shadow-black/40 sm:inset-x-auto sm:right-0 sm:w-[24rem]">
          <div className="flex items-center justify-between gap-2 border-b border-marino/10 px-4 py-3">
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
          {/* Pestañas por tipo de aviso: en el celular se deslizan con el dedo; en la
              compu (con mouse) se ven todas, en dos renglones si hace falta. */}
          <div
            role="tablist"
            aria-label="Tipo de aviso"
            className="sin-barra flex gap-1.5 overflow-x-auto border-b border-marino/10 px-3 py-2 [@media(hover:hover)]:flex-wrap [@media(hover:hover)]:overflow-visible"
          >
            {filtros.map(([f, etiqueta]) => {
              const n = sinLeerDe(f);
              const activo = f === filtro;
              return (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={activo}
                  onClick={() => setFiltro(f)}
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition ${activo ? "border-marino bg-marino text-white" : "border-marino/20 text-marino hover:bg-marino/5"}`}
                >
                  {etiqueta}
                  {n ? <span className="ml-1 font-bold">({n})</span> : null}
                </button>
              );
            })}
          </div>
          <ul className="max-h-[55vh] overflow-y-auto">
            {visibles.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-marino/60">
                {lista.length === 0 ? "No tenés avisos de los últimos 7 días." : "No hay avisos de este tipo."}
              </li>
            ) : (
              visibles.map((n) => (
                <li key={n.id} className="border-b border-marino/10 last:border-0">
                  <Link
                    href={n.enlace ?? "#"}
                    onClick={() => {
                      void marcar([n.id]);
                      setAbierta(false);
                    }}
                    className={`flex gap-3 px-4 py-3 text-sm transition hover:bg-marino/5 ${n.leida_en ? "text-marino/65" : "bg-marino/[0.04]"}`}
                  >
                    <span aria-hidden className="shrink-0 text-base leading-5">
                      {ICONO[categoriaDe(n)]}
                    </span>
                    <span className="min-w-0 flex-1">
                      {/* Título a la izquierda y la fecha arriba a la derecha. */}
                      <span className="flex items-start justify-between gap-2">
                        <span className={`min-w-0 ${n.leida_en ? "" : "font-semibold"}`}>
                          {n.leida_en ? null : <span aria-label="Sin leer" className="mr-1.5 inline-block h-2 w-2 rounded-full bg-marino align-middle" />}
                          {n.titulo}
                        </span>
                        <span className="shrink-0 pt-0.5 text-[11px] whitespace-nowrap text-marino/55">{hace(n.creada_en)}</span>
                      </span>
                      {n.cuerpo ? <span className="mt-0.5 block text-xs text-marino/75">{n.cuerpo}</span> : null}
                    </span>
                  </Link>
                </li>
              ))
            )}
          </ul>
          <p className="border-t border-marino/10 px-4 py-2 text-[11px] text-marino/55">Los avisos se borran solos a los 7 días.</p>
          <AvisosCelular />
        </div>
      ) : null}

      {cartel ? (
        <div
          role="status"
          className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-marino/15 bg-white p-4 text-marino shadow-2xl shadow-black/40 lg:bottom-4"
        >
          <div className="flex items-start gap-3">
            <span aria-hidden className="text-xl">
              {ICONO[categoriaDe(cartel)]}
            </span>
            <Link
              href={cartel.enlace ?? "#"}
              onClick={() => {
                void marcar([cartel.id]);
                setCartel(null);
              }}
              className="min-w-0 flex-1"
            >
              <span className="block font-semibold">{cartel.titulo}</span>
              {cartel.cuerpo ? <span className="mt-0.5 block text-sm text-marino/75">{cartel.cuerpo}</span> : null}
            </Link>
            <button type="button" onClick={() => setCartel(null)} aria-label="Cerrar aviso" className="text-marino/60 hover:text-marino">
              ✕
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
