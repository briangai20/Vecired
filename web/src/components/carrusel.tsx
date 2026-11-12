"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const VELOCIDAD = 0.6; // píxeles por milisegundo (600 por segundo), igual en cualquier compu

// Fila de tarjetas que se corre de costado. En la compu, al acercar el mouse
// a un costado aparece una flecha (antes no se ve); mientras el mouse está apoyado sobre ella,
// la fila se corre sola. En el celular se desliza con el dedo. La barra de
// desplazamiento no se ve.
export function Carrusel({ children, etiqueta }: { children: ReactNode; etiqueta: string }) {
  const fila = useRef<HTMLUListElement>(null);
  const cuadro = useRef(0);
  const [bordes, setBordes] = useState({ inicio: true, fin: false });
  const [cerca, setCerca] = useState<-1 | 0 | 1>(0);

  const medir = useCallback(() => {
    const f = fila.current;
    if (!f) return;
    const inicio = f.scrollLeft <= 2;
    const fin = f.scrollLeft + f.clientWidth >= f.scrollWidth - 2;
    setBordes((b) => (b.inicio === inicio && b.fin === fin ? b : { inicio, fin }));
  }, []);

  useEffect(() => {
    const f = fila.current;
    if (!f) return;
    const t = setTimeout(medir, 0);
    const obs = new ResizeObserver(medir);
    obs.observe(f);
    return () => {
      clearTimeout(t);
      obs.disconnect();
      cancelAnimationFrame(cuadro.current);
    };
  }, [medir]);

  function correr(sentido: 1 | -1) {
    cancelAnimationFrame(cuadro.current);
    let antes = performance.now();
    const paso = (ahora: number) => {
      const f = fila.current;
      if (!f) return;
      f.scrollLeft += sentido * VELOCIDAD * Math.min(ahora - antes, 50);
      antes = ahora;
      const tope = sentido > 0 ? f.scrollLeft + f.clientWidth >= f.scrollWidth - 1 : f.scrollLeft <= 0;
      if (!tope) cuadro.current = requestAnimationFrame(paso);
    };
    cuadro.current = requestAnimationFrame(paso);
  }
  const frenar = () => cancelAnimationFrame(cuadro.current);

  const flecha = (sentido: 1 | -1) => {
    const visible = cerca === sentido && !(sentido < 0 ? bordes.inicio : bordes.fin);
    return (
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onMouseEnter={() => correr(sentido)}
        onMouseLeave={frenar}
        onClick={() => fila.current?.scrollBy({ left: sentido * fila.current.clientWidth * 0.8, behavior: "smooth" })}
        className={`absolute top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/40 bg-marino text-2xl leading-none text-white shadow-lg shadow-black/40 transition duration-200 [@media(hover:hover)]:grid ${
          sentido < 0 ? "left-1" : "right-1"
        } ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        {sentido < 0 ? "‹" : "›"}
      </button>
    );
  };

  // La flecha aparece solo cuando el mouse se acerca a un costado de la fila.
  function mover(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const lado = x < 90 ? -1 : x > r.width - 90 ? 1 : 0;
    if (lado !== cerca) setCerca(lado);
  }

  return (
    <div
      className="relative"
      onMouseMove={mover}
      onMouseLeave={() => {
        setCerca(0);
        frenar();
      }}
    >
      {flecha(-1)}
      <ul ref={fila} onScroll={medir} aria-label={etiqueta} className="sin-barra -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 [@media(hover:hover)]:snap-none">
        {children}
      </ul>
      {flecha(1)}
    </div>
  );
}
