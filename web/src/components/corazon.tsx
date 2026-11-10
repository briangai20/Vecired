"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/navegador";

// Corazón para guardar un producto o un comercio en "Mis favoritos".
// Sin sesión lleva a ingresar y vuelve a la misma página.
export function Corazon({
  tipo,
  id,
  guardado,
  conSesion,
  className = "",
}: {
  tipo: "producto" | "comercio";
  id: number;
  guardado: boolean;
  conSesion: boolean;
  className?: string;
}) {
  const ruta = usePathname();
  const [activo, setActivo] = useState(guardado);
  const [ocupado, setOcupado] = useState(false);
  const etiqueta = activo ? "Sacar de favoritos" : "Guardar en favoritos";
  const clase = `grid h-10 w-10 shrink-0 place-items-center rounded-full border transition ${activo ? "border-naranja-vivo bg-naranja-vivo/15 text-naranja-vivo" : "border-white/40 text-white hover:bg-white/10"} ${className}`;
  const icono = (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill={activo ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M12 20s-7-4.4-9.2-8.6C1.3 8.4 3 5 6.3 5c2 0 3.3 1.1 3.9 2.2h3.6C14.4 6.1 15.7 5 17.7 5 21 5 22.7 8.4 21.2 11.4 19 15.6 12 20 12 20z" />
    </svg>
  );

  if (!conSesion) {
    return (
      <Link href={`/ingresar?siguiente=${encodeURIComponent(ruta)}`} aria-label={etiqueta} title={etiqueta} className={clase}>
        {icono}
      </Link>
    );
  }

  async function cambiar() {
    if (ocupado) return;
    const nuevo = !activo;
    setActivo(nuevo); // se ve al instante; si falla, vuelve atrás
    setOcupado(true);
    const supabase = supabaseNavegador();
    const columna = tipo === "producto" ? "producto_id" : "comercio_id";
    const { error } = nuevo
      ? await supabase.from("favoritos").insert(tipo === "producto" ? { producto_id: id } : { comercio_id: id })
      : await supabase.from("favoritos").delete().eq(columna, id);
    // Si ya estaba guardado (por ejemplo desde otra pestaña), da igual: queda guardado.
    if (error && error.code !== "23505") setActivo(!nuevo);
    setOcupado(false);
  }

  return (
    <button type="button" onClick={cambiar} aria-pressed={activo} aria-label={etiqueta} title={etiqueta} className={clase}>
      {icono}
    </button>
  );
}
