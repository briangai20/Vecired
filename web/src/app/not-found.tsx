import type { Metadata } from "next";
import Link from "next/link";
import { LogoVeciRed } from "@/components/logo";

export const metadata: Metadata = { title: "Página no encontrada" };

// Página que se ve cuando la dirección no existe, o el comercio o producto ya
// no está publicado.
export default function NoEncontrada() {
  return (
    <div className="tarjeta mx-auto max-w-xl rounded-3xl p-8 text-center">
      <LogoVeciRed className="mx-auto h-16 w-16" />
      <h1 className="mt-4 text-2xl font-bold">No encontramos esta página</h1>
      <p className="mt-2 text-sm text-white/85">
        Puede que el link esté mal escrito, o que el comercio o el producto ya no estén publicados.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/" className="boton rounded-xl px-5 py-2.5 text-sm font-semibold">
          Buscar en mi barrio
        </Link>
        <Link href="/preguntas" className="rounded-xl border border-white/40 px-5 py-2.5 text-sm hover:bg-white/10">
          Preguntas frecuentes
        </Link>
      </div>
    </div>
  );
}
