import { useId, type ReactNode } from "react";

export type Pregunta = { p: string; r: ReactNode };

// Lista de preguntas que se abren al tocarlas (sin JavaScript). Se abre una
// sola a la vez.
export function Preguntas({ lista }: { lista: Pregunta[] }) {
  // Mismo "name" en todas: al abrir una, el navegador cierra la que estaba abierta.
  const grupo = useId();
  return (
    <div className="divide-y divide-white/15 rounded-2xl border border-white/20">
      {lista.map(({ p, r }) => (
        <details key={p} name={grupo} className="group px-4 py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium [&::-webkit-details-marker]:hidden">
            {p}
            <span aria-hidden className="shrink-0 text-xl leading-none text-white/70 transition group-open:rotate-45">
              +
            </span>
          </summary>
          <div className="mt-2 space-y-2 text-sm leading-relaxed text-white/85 [&_a]:underline">{r}</div>
        </details>
      ))}
    </div>
  );
}
