"use client";

import { useEffect, useId, useState } from "react";
import { buscarLugares, type Lugar } from "@/lib/lugares";

type Zona = { id: string; nombre: string };

export type Eleccion = { tipo: "yo" } | { tipo: "zona"; zona: Zona } | { tipo: "lugar"; lugar: Lugar };

const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

// Campo de ubicación con sugerencias: al tocarlo muestra "mi ubicación" y las
// zonas; al escribir suma calles, barrios y ciudades del mapa.
export function CampoUbicacion({
  zonas,
  etiqueta,
  cerca,
  onElegir,
}: {
  zonas: Zona[];
  /** Lo que se muestra cuando no se está escribiendo. */
  etiqueta: string;
  cerca: { lat: number; lng: number };
  onElegir: (e: Eleccion) => void;
}) {
  const id = useId();
  // Lo que la persona está escribiendo; null mientras no escribe (se ve la etiqueta).
  const [escrito, setEscrito] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [activa, setActiva] = useState(0);
  // Resultado del mapa para una consulta; si no coincide con la actual, se está buscando.
  const [resultado, setResultado] = useState<{ consulta: string; lugares: Lugar[]; fallo: boolean } | null>(null);

  const consulta = escrito?.trim() ?? "";
  const alDia = resultado?.consulta === consulta ? resultado : null;
  const lugares = alDia?.lugares ?? [];
  const buscando = consulta.length >= 3 && !alDia;

  // Busca en el mapa cuando se deja de escribir (desde 3 letras).
  useEffect(() => {
    if (consulta.length < 3) return;
    const control = new AbortController();
    const t = setTimeout(() => {
      buscarLugares(consulta, cerca, control.signal)
        .then((l) => setResultado({ consulta, lugares: l, fallo: false }))
        .catch((e) => {
          if (e.name !== "AbortError") setResultado({ consulta, lugares: [], fallo: true });
        });
    }, 300);
    return () => {
      clearTimeout(t);
      control.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consulta]);

  const zonasVisibles = consulta ? zonas.filter((z) => normalizar(z.nombre).includes(normalizar(consulta))) : zonas;
  const opciones: Eleccion[] = [
    { tipo: "yo" },
    ...zonasVisibles.map((zona) => ({ tipo: "zona" as const, zona })),
    ...lugares.map((lugar) => ({ tipo: "lugar" as const, lugar })),
  ];

  function cerrar() {
    setAbierto(false);
    setEscrito(null);
  }

  function elegir(e: Eleccion) {
    cerrar();
    onElegir(e);
  }

  function teclas(ev: React.KeyboardEvent<HTMLInputElement>) {
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      setAbierto(true);
      const paso = ev.key === "ArrowDown" ? 1 : -1;
      setActiva((a) => (a + paso + opciones.length) % opciones.length);
    } else if (ev.key === "Enter" && abierto && opciones[activa]) {
      ev.preventDefault();
      elegir(opciones[activa]);
    } else if (ev.key === "Escape") {
      cerrar();
    }
  }

  return (
    <div className="relative mt-1">
      <input
        id="ubicacion"
        role="combobox"
        aria-expanded={abierto}
        aria-controls={`${id}-lista`}
        aria-autocomplete="list"
        aria-activedescendant={abierto ? `${id}-${activa}` : undefined}
        autoComplete="off"
        placeholder="Ciudad, barrio o calle"
        value={escrito ?? etiqueta}
        onFocus={(e) => {
          e.target.select();
          setActiva(0);
          setAbierto(true);
        }}
        onChange={(e) => {
          setEscrito(e.target.value);
          setActiva(0);
          setAbierto(true);
        }}
        // Las opciones evitan el blur con preventDefault, así que el clic llega antes de cerrar.
        onBlur={cerrar}
        onKeyDown={teclas}
        className="campo"
      />
      {abierto ? (
        <ul
          id={`${id}-lista`}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-xl border border-white/25 bg-marino-claro py-1 text-sm shadow-xl"
        >
          {opciones.map((o, i) => (
            <li
              key={o.tipo === "yo" ? "yo" : o.tipo === "zona" ? `z-${o.zona.id}` : `l-${i}`}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === activa}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => elegir(o)}
              onMouseEnter={() => setActiva(i)}
              className={`cursor-pointer px-3 py-2 ${i === activa ? "bg-white/15" : ""}`}
            >
              {o.tipo === "yo" ? (
                <span className="font-medium text-[#ff6b2c]">Usar mi ubicación actual</span>
              ) : o.tipo === "zona" ? (
                <>
                  <span className="block font-medium">{o.zona.nombre}</span>
                  <span className="block text-xs text-white/70">Zona de VeciRed</span>
                </>
              ) : (
                <>
                  <span className="block font-medium">{o.lugar.nombre}</span>
                  {o.lugar.detalle ? <span className="block text-xs text-white/70">{o.lugar.detalle}</span> : null}
                </>
              )}
            </li>
          ))}
          {consulta.length >= 3 && (buscando || alDia?.fallo || !lugares.length) ? (
            <li className="px-3 py-2 text-xs text-white/70" role="presentation">
              {buscando ? "Buscando en el mapa…" : alDia?.fallo ? "No pudimos buscar en el mapa. Probá de nuevo." : "No encontramos ese lugar en el mapa."}
            </li>
          ) : consulta.length > 0 && consulta.length < 3 ? (
            <li className="px-3 py-2 text-xs text-white/70" role="presentation">
              Escribí al menos 3 letras para buscar calles y ciudades.
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
