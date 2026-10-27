import Link from "next/link";
import { VIGENCIA } from "@/lib/legal";

// Marco común de los términos y la política de privacidad.
export function TextoLegal({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <article className="tarjeta mx-auto max-w-3xl rounded-3xl p-6 sm:p-8">
      <h1 className="text-2xl font-bold">{titulo}</h1>
      <p className="mt-1 text-sm text-white/70">Vigente desde el {VIGENCIA}</p>
      <div className="mt-6 space-y-6 text-sm leading-relaxed text-white/90 [&_a]:underline [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
      <nav className="mt-8 flex flex-wrap gap-4 border-t border-white/15 pt-4 text-sm text-white/80" aria-label="Textos legales">
        <Link href="/terminos" className="underline">Términos y condiciones</Link>
        <Link href="/privacidad" className="underline">Política de privacidad</Link>
        <Link href="/" className="underline">Volver a buscar</Link>
      </nav>
    </article>
  );
}

export function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-white">{titulo}</h2>
      {children}
    </section>
  );
}
