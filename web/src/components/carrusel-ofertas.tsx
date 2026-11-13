"use client";

import Link from "next/link";
import { Children, useEffect, useRef, useState, type ReactNode } from "react";

const CADA = 6000; // milisegundos entre una oferta y la siguiente

// Ofertas que van pasando solas cada 6 segundos. Se frena mientras el mouse
// está encima o la persona la está deslizando con el dedo, y tiene puntitos
// para ir a una en particular.
export function CarruselOfertas({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);
  const fila = useRef<HTMLDivElement>(null);
  const [actual, setActual] = useState(0);
  const [quieto, setQuieto] = useState(false);

  const ir = (i: number) => {
    const f = fila.current;
    const hijo = f?.children[i] as HTMLElement | undefined;
    if (f && hijo) f.scrollTo({ left: hijo.offsetLeft - f.offsetLeft, behavior: "smooth" });
  };

  // Cuál se ve, según cuánto se corrió.
  function alCorrer() {
    const f = fila.current;
    if (!f || !f.children.length) return;
    const ancho = (f.children[0] as HTMLElement).offsetWidth || 1;
    setActual(Math.min(items.length - 1, Math.round(f.scrollLeft / ancho)));
  }

  useEffect(() => {
    if (quieto || items.length < 2) return;
    const t = setInterval(() => {
      const f = fila.current;
      if (!f) return;
      const alFinal = f.scrollLeft + f.clientWidth >= f.scrollWidth - 4;
      const siguiente = f.children[actual + 1] as HTMLElement | undefined;
      f.scrollTo({ left: alFinal || !siguiente ? 0 : siguiente.offsetLeft - f.offsetLeft, behavior: "smooth" });
    }, CADA);
    return () => clearInterval(t);
  }, [quieto, actual, items.length]);

  return (
    <div onMouseEnter={() => setQuieto(true)} onMouseLeave={() => setQuieto(false)} onTouchStart={() => setQuieto(true)} onTouchEnd={() => setQuieto(false)}>
      <div ref={fila} onScroll={alCorrer} className="sin-barra -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {items.map((hijo, i) => (
          <div key={i} className="h-36 w-[85%] shrink-0 snap-start sm:h-40 sm:w-[calc(50%-0.375rem)] lg:w-[calc(33.333%-0.5rem)]">
            {hijo}
          </div>
        ))}
      </div>
      {items.length > 1 ? (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => ir(i)}
              aria-label={`Ver oferta ${i + 1}`}
              className={`h-2 rounded-full transition-all ${i === actual ? "w-5 bg-naranja" : "w-2 bg-marino/25"}`}
            />
          ))}
          <Link href="/ofertas" className="ml-3 text-xs font-semibold text-marino underline">
            Ver todas
          </Link>
        </div>
      ) : null}
    </div>
  );
}
