"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

// Avisa a la barra que empezó una navegación hecha desde el código
// (router.push), por ejemplo al buscar.
export const EVENTO_NAVEGANDO = "vecired:navegando";
export const avisarNavegacion = () => window.dispatchEvent(new Event(EVENTO_NAVEGANDO));

// Barra naranja fina arriba de todo: aparece en el mismo momento en que se toca
// un enlace, así se nota enseguida que la página nueva está cargando, y se va
// cuando llega. Si en 10 segundos no llegó (o el enlace no cambió de página),
// se esconde sola.
export function BarraCarga() {
  const ruta = usePathname();
  const params = useSearchParams();
  const actual = `${ruta}?${params}`;
  const [cargando, setCargando] = useState(false);
  const [vista, setVista] = useState(actual);

  // Llegó la página nueva.
  if (vista !== actual) {
    setVista(actual);
    setCargando(false);
  }

  useEffect(() => {
    const empezar = () => setCargando(true);
    const alTocar = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a || !a.href || a.target === "_blank" || a.hasAttribute("download")) return;
      const destino = new URL(a.href, location.href);
      if (destino.origin !== location.origin) return;
      // Mismo lugar (o solo un #ancla de la misma página): no hay nada que cargar.
      if (destino.pathname === location.pathname && destino.search === location.search) return;
      empezar();
    };
    document.addEventListener("click", alTocar, true);
    window.addEventListener(EVENTO_NAVEGANDO, empezar);
    return () => {
      document.removeEventListener("click", alTocar, true);
      window.removeEventListener(EVENTO_NAVEGANDO, empezar);
    };
  }, []);

  useEffect(() => {
    if (!cargando) return;
    const t = setTimeout(() => setCargando(false), 10_000);
    return () => clearTimeout(t);
  }, [cargando]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top)] z-[70] h-[3px] overflow-hidden">
      {cargando ? <div className="barra-carga h-full bg-naranja-vivo shadow-[0_0_8px_rgb(255_107_44/0.8)]" /> : null}
    </div>
  );
}
