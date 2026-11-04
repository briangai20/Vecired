"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

// En el celular el menú no entra en una fila: se abre con un botón y se
// cierra solo al elegir una opción o al cambiar de página.
export function MenuMovil({ children }: { children: ReactNode }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const ruta = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    if (menu.current) menu.current.open = false;
  }, [ruta, params]);

  return (
    <details ref={menu} className="group relative md:hidden">
      <summary
        className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-white/30 px-3 py-2 text-sm font-medium text-white [&::-webkit-details-marker]:hidden"
        aria-label="Menú"
      >
        <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path className="group-open:hidden" d="M4 7h16M4 12h16M4 17h16" />
          <path className="hidden group-open:block" d="M6 6l12 12M18 6L6 18" />
        </svg>
        Menú
      </summary>
      <nav
        aria-label="Secciones"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a") && menu.current) menu.current.open = false;
        }}
        className="absolute right-0 z-50 mt-2 flex w-56 flex-col gap-1 rounded-2xl border border-white/20 bg-marino p-2 shadow-xl shadow-black/40 [&_a]:block [&_button]:w-full [&_button]:text-left [&_form]:w-full"
      >
        {children}
      </nav>
    </details>
  );
}
