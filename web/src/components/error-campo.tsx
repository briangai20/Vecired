import type { ReactNode } from "react";

// Explicación en rojo debajo de un campo que está mal.
export function ErrorCampo({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <span id={id} role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-[#ffb4a2]">
      <span aria-hidden className="mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#ff6b6b] text-[10px] font-black text-marino">
        !
      </span>
      {children}
    </span>
  );
}

// Recuadro rojo para un bloque entero que está mal (el mapa, el horario, las fotos).
export function MarcoError({ error, children, className = "" }: { error?: string; children: ReactNode; className?: string }) {
  return (
    <div data-error={error ? "" : undefined} className={`${className} ${error ? "rounded-2xl border-2 border-[#ff6b6b] bg-[#ff6b6b]/10 p-3" : ""}`}>
      {children}
      <ErrorCampo>{error}</ErrorCampo>
    </div>
  );
}
