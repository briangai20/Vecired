"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { guardarBusqueda, sacarBusqueda, useBusquedas } from "@/lib/historial";
import { iconoRubro } from "@/lib/rubros";
import { supabaseNavegador } from "@/lib/supabase/navegador";

type Sugerencia =
  | { tipo: "reciente"; texto: string }
  | { tipo: "producto"; texto: string }
  | { tipo: "correccion"; texto: string }
  | { tipo: "comercio"; id: number; texto: string; rubro: string };

// Escapa los comodines de "ilike" para buscar el texto tal cual.
const literal = (t: string) => t.replace(/[\\%_]/g, (x) => "\\" + x);

// Buscador del encabezado, como la barra de Mercado Libre: está en todas las
// páginas y siempre lleva a los resultados de la portada. Si ya estás en la
// portada, conserva la ubicación, el radio y el orden que elegiste. Mientras
// escribís sugiere productos y comercios; vacío, muestra tus búsquedas recientes.
export function Buscador({ className = "" }: { className?: string }) {
  const router = useRouter();
  const ruta = usePathname();
  const params = useSearchParams();
  const actual = ruta === "/" ? (params.get("q") ?? "") : "";
  const [texto, setTexto] = useState(actual);
  const [antes, setAntes] = useState(actual);
  const [abierto, setAbierto] = useState(false);
  const [activa, setActiva] = useState(-1);
  const [encontradas, setEncontradas] = useState<{ para: string; lista: Sugerencia[] }>({ para: "", lista: [] });
  const recientes = useBusquedas();
  const lista = useId();
  const campo = useRef<HTMLInputElement>(null);
  // Si la búsqueda cambia desde otro lado (un rubro, volver atrás), el campo la acompaña.
  if (actual !== antes) {
    setAntes(actual);
    setTexto(actual);
  }

  const t = texto.trim();
  // Busca sugerencias en la base un ratito después de que dejás de escribir.
  useEffect(() => {
    if (t.length < 2) return;
    let vigente = true;
    const espera = setTimeout(async () => {
      const db = supabaseNavegador();
      const patron = `%${literal(t)}%`;
      const productosCon = (p: string) =>
        db
          .from("productos")
          .select("nombre, comercio:comercios!inner(aprobado)")
          .eq("activo", true)
          .eq("comercio.aprobado", true)
          .ilike("nombre", p)
          .limit(40);
      const [deProductos, { data: comercios }] = await Promise.all([
        productosCon(patron),
        db.from("comercios").select("id, nombre, rubro").eq("aprobado", true).ilike("nombre", patron).limit(3),
      ]);
      let productos = deProductos.data;
      if (!vigente) return;
      // Si casi no aparece nada, puede ser un error de tipeo ("cillar"): se
      // propone lo corregido ("collar") y sus productos.
      let correccion: string | null = null;
      if (t.length >= 3 && (productos?.length ?? 0) + (comercios?.length ?? 0) < 2) {
        const { data } = await db.rpc("corregir_busqueda", { p_texto: t });
        if (!vigente) return;
        if (data) {
          correccion = data;
          const { data: otros } = await productosCon(`%${literal(data)}%`);
          if (!vigente) return;
          productos = [...(productos ?? []), ...(otros ?? [])];
        }
      }
      // Nombres sin repetir, primero los que empiezan con lo escrito.
      const vistos = new Set<string>();
      const nombres = (productos ?? [])
        .map((p) => p.nombre.trim())
        .filter((n) => {
          const k = n.toLowerCase();
          if (vistos.has(k)) return false;
          vistos.add(k);
          return true;
        })
        .sort((a, b) => Number(b.toLowerCase().startsWith(t.toLowerCase())) - Number(a.toLowerCase().startsWith(t.toLowerCase())) || a.length - b.length)
        .slice(0, 6);
      setEncontradas({
        para: t,
        lista: [
          ...(correccion ? [{ tipo: "correccion", texto: correccion } as Sugerencia] : []),
          ...nombres.map((n): Sugerencia => ({ tipo: "producto", texto: n })),
          ...(comercios ?? []).map((c): Sugerencia => ({ tipo: "comercio", id: c.id, texto: c.nombre, rubro: c.rubro })),
        ],
      });
    }, 200);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [t]);

  const coincide = (r: string) => r.toLowerCase().includes(t.toLowerCase()) && r.toLowerCase() !== t.toLowerCase();
  const sugerencias: Sugerencia[] =
    t.length < 2
      ? recientes.filter((r) => !t || coincide(r)).map((r) => ({ tipo: "reciente", texto: r }))
      : [
          ...recientes.filter(coincide).slice(0, 2).map((r): Sugerencia => ({ tipo: "reciente", texto: r })),
          ...(encontradas.para === t ? encontradas.lista.filter((s) => s.tipo !== "producto" || !recientes.some((r) => r.toLowerCase() === s.texto.toLowerCase())) : []),
        ];
  const mostrar = abierto && sugerencias.length > 0;

  function irA(busqueda: string) {
    const p = new URLSearchParams(ruta === "/" ? params.toString() : "");
    p.delete("comercio");
    p.delete("ver");
    p.delete("buscaste");
    const b = busqueda.trim();
    if (b) {
      p.set("q", b);
      guardarBusqueda(b);
    } else p.delete("q");
    setTexto(b);
    setAbierto(false);
    setActiva(-1);
    campo.current?.blur();
    router.push(`/${p.size ? `?${p}` : ""}`);
  }

  function elegir(s: Sugerencia) {
    if (s.tipo === "comercio") {
      setAbierto(false);
      setActiva(-1);
      campo.current?.blur();
      router.push(`/comercio/${s.id}`);
    } else irA(s.texto);
  }

  function teclas(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setAbierto(false);
      setActiva(-1);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!sugerencias.length) return;
      e.preventDefault();
      setAbierto(true);
      const paso = e.key === "ArrowDown" ? 1 : -1;
      // Recorre las sugerencias en ronda; el -1 es "ninguna" (queda lo escrito).
      const n = sugerencias.length + 1;
      setActiva((a) => ((((a + 1 + paso) % n) + n) % n) - 1);
    } else if (e.key === "Enter" && mostrar && activa >= 0 && activa < sugerencias.length) {
      e.preventDefault();
      elegir(sugerencias[activa]);
    }
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        irA(texto);
      }}
      className={`relative ${className}`}
    >
      <input
        ref={campo}
        type="search"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierto(true);
          setActiva(-1);
        }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setAbierto(false)}
        onKeyDown={teclas}
        placeholder="Buscá productos o comercios: tornillos, alimento para perro…"
        aria-label="Buscar productos o comercios"
        role="combobox"
        aria-expanded={mostrar}
        aria-controls={lista}
        aria-autocomplete="list"
        aria-activedescendant={mostrar && activa >= 0 && activa < sugerencias.length ? `${lista}-${activa}` : undefined}
        autoComplete="off"
        className="h-11 w-full rounded-xl border border-white/30 bg-white pr-12 pl-4 text-sm text-marino placeholder:text-marino/55 focus:border-white focus:ring-2 focus:ring-naranja-vivo focus:outline-none"
      />
      <button
        type="submit"
        aria-label="Buscar"
        className="absolute top-1 right-1 grid h-9 w-10 place-items-center rounded-lg bg-naranja text-white transition hover:bg-naranja-hover"
      >
        <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </button>
      {mostrar ? (
        <ul
          id={lista}
          role="listbox"
          aria-label="Sugerencias"
          // Que tocar una sugerencia no le saque el foco al campo antes del clic.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-marino/10 bg-white py-1 text-sm text-marino shadow-xl shadow-black/30"
        >
          {t.length < 2 ? <li className="px-4 pt-1 pb-1.5 text-xs font-semibold text-marino/60">Búsquedas recientes</li> : null}
          {sugerencias.map((s, i) => (
            <li
              key={`${s.tipo}-${s.texto}-${i}`}
              id={`${lista}-${i}`}
              role="option"
              aria-selected={i === activa}
              onClick={() => elegir(s)}
              onMouseEnter={() => setActiva(i)}
              className={`flex cursor-pointer items-center gap-3 px-4 py-2 ${i === activa ? "bg-crema" : ""}`}
            >
              <span aria-hidden className="w-5 shrink-0 text-center text-marino/55">
                {s.tipo === "reciente" ? "🕘" : s.tipo === "comercio" ? iconoRubro(s.rubro) : s.tipo === "correccion" ? "✨" : "🔍"}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {s.tipo === "correccion" ? (
                  <span>
                    ¿Quisiste decir <b className="text-naranja">{s.texto}</b>?
                  </span>
                ) : (
                  <Resaltado texto={s.texto} buscado={t} />
                )}
                {s.tipo === "comercio" ? <span className="ml-2 text-xs text-marino/60">Comercio · {s.rubro}</span> : null}
              </span>
              {s.tipo === "reciente" ? (
                <button
                  type="button"
                  aria-label={`Sacar "${s.texto}" de las búsquedas recientes`}
                  onClick={(e) => {
                    e.stopPropagation();
                    sacarBusqueda(s.texto);
                  }}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-marino/50 hover:bg-marino/10 hover:text-marino"
                >
                  ✕
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}

// Lo que escribiste va normal y el resto en negrita, como en Mercado Libre.
function Resaltado({ texto, buscado }: { texto: string; buscado: string }) {
  const i = buscado ? texto.toLowerCase().indexOf(buscado.toLowerCase()) : -1;
  if (i < 0) return <span className="font-semibold">{texto}</span>;
  return (
    <span className="font-semibold">
      {texto.slice(0, i)}
      <span className="font-normal">{texto.slice(i, i + buscado.length)}</span>
      {texto.slice(i + buscado.length)}
    </span>
  );
}

// Lo que se ve mientras carga (mismo tamaño, para que no salte la página).
export function BuscadorCargando({ className = "" }: { className?: string }) {
  return <div className={`h-11 rounded-xl border border-white/30 bg-white ${className}`} />;
}
