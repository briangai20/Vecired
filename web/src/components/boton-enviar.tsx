"use client";

import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";

// Botón de un formulario con acción del servidor: mientras se envía muestra
// "enviando" y queda deshabilitado (junto con los otros botones del mismo
// formulario), así no se aprieta dos veces ni parece que no pasó nada.
export function BotonEnviar({ enviando, children, ...props }: { enviando: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending, data } = useFormStatus();
  // Si el formulario tiene varios botones (Aceptar / Rechazar), solo cambia el texto del apretado.
  const esEste = pending && (props.name == null || data?.get(props.name) === props.value);
  return (
    <button {...props} disabled={pending || props.disabled} aria-busy={esEste || undefined}>
      {esEste ? enviando : children}
    </button>
  );
}
