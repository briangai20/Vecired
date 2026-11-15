"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

// Opción de menú sin recuadro: al tocarla se pintan las letras de naranja, y
// quedan así en la de la página en la que estás.
export function EnlaceMenu({ href, className = "", ...props }: ComponentProps<typeof Link> & { href: string }) {
  const ruta = usePathname();
  const actual = href === "/" ? ruta === "/" : ruta === href || ruta.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={actual ? "page" : undefined}
      className={`rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap text-white transition hover:text-naranja-vivo active:text-naranja-vivo aria-[current=page]:text-naranja-vivo ${className}`}
      {...props}
    />
  );
}
