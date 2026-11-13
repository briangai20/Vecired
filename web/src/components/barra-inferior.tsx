"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

const ICONOS = {
  inicio: <path d="M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5" />,
  comercios: <path d="M4 9.5 5.5 4h13L20 9.5M4 9.5h16M4 9.5c0 1.7 1.3 3 3 3s3-1.3 3-3m0 0c0 1.7 1.3 3 3 3s3-1.3 3-3m0 0c0 1.7 1.3 3 3 3M5.5 12.3V20h13v-7.7" />,
  ofertas: <path d="M20 12.5 12.5 20 4 11.5V4h7.5L20 12.5ZM8 8h.01" />,
  reservas: <path d="M6 7h12l-1 13H7L6 7Zm3 0V5.5a3 3 0 0 1 6 0V7" />,
  mas: <path d="M4 7h16M4 12h16M4 17h16" />,
};

function Icono({ d }: { d: ReactNode }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {d}
    </svg>
  );
}

const item =
  "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium text-white/80 transition active:bg-naranja/70 aria-[current=page]:text-naranja-vivo";

// Barra fija abajo en el celular, como en las apps. "Más" abre las opciones
// de la cuenta (las que en la compu están arriba a la derecha). Lo elegido se
// pinta en naranja.
export function BarraInferior({ children }: { children: ReactNode }) {
  const ruta = usePathname();
  const params = useSearchParams();
  const [mas, setMas] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const [antes, setAntes] = useState({ ruta, params: params.toString() });

  // Al cambiar de página se cierra "Más".
  if (antes.ruta !== ruta || antes.params !== params.toString()) {
    setAntes({ ruta, params: params.toString() });
    setMas(false);
  }

  // Tocar afuera lo cierra.
  useEffect(() => {
    if (!mas) return;
    const fuera = (e: PointerEvent) => !caja.current?.contains(e.target as Node) && setMas(false);
    document.addEventListener("pointerdown", fuera);
    return () => document.removeEventListener("pointerdown", fuera);
  }, [mas]);

  const actual = (href: string) => (href === "/" ? ruta === "/" && !mas : ruta.startsWith(href) && !mas) || undefined;

  return (
    <div ref={caja} className="lg:hidden">
      {mas ? (
        <nav
          aria-label="Más opciones"
          onClick={(e) => (e.target as HTMLElement).closest("a, button") && setMas(false)}
          className="fixed right-2 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-50 flex w-60 flex-col gap-1 rounded-2xl border border-white/20 bg-marino p-2 shadow-2xl shadow-black/50 [&_a]:block [&_button]:w-full [&_button]:text-left [&_form]:w-full"
        >
          {children}
        </nav>
      ) : null}
      <nav
        aria-label="Navegación"
        className="fixed inset-x-0 bottom-0 z-40 flex gap-1 border-t border-white/15 bg-marino px-2 pt-1 pb-[calc(0.25rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.5)]"
      >
        <Link href="/" aria-current={actual("/") && "page"} className={item}>
          <Icono d={ICONOS.inicio} />
          Inicio
        </Link>
        <Link href="/#resultados" className={item}>
          <Icono d={ICONOS.comercios} />
          Comercios
        </Link>
        <Link href="/ofertas" aria-current={actual("/ofertas") && "page"} className={item}>
          <Icono d={ICONOS.ofertas} />
          Ofertas
        </Link>
        <Link href="/reservas" aria-current={actual("/reservas") && "page"} className={item}>
          <Icono d={ICONOS.reservas} />
          Reservas
        </Link>
        <button type="button" onClick={() => setMas((v) => !v)} aria-expanded={mas} aria-current={mas ? "page" : undefined} className={item}>
          <Icono d={ICONOS.mas} />
          Más
        </button>
      </nav>
    </div>
  );
}
