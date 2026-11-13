"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

// Opción de menú sin recuadro: se pinta al tocarla y queda pintada la de la
// página en la que estás.
export function EnlaceMenu({ href, className = "", ...props }: ComponentProps<typeof Link> & { href: string }) {
  const ruta = usePathname();
  const actual = href === "/" ? ruta === "/" : ruta === href || ruta.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={actual ? "page" : undefined}
      className={`rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap text-white transition hover:bg-white/10 active:bg-naranja/70 aria-[current=page]:bg-naranja aria-[current=page]:text-white ${className}`}
      {...props}
    />
  );
}
