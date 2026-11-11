"use client";

import { useEffect, useRef } from "react";
import { supabaseNavegador } from "@/lib/supabase/navegador";
import { guardarVisto } from "@/lib/historial";

// Suma una vista para las estadísticas del comerciante. Corre en el
// navegador para no contar las visitas de buscadores ni las precargas.
export function RegistrarVista({ comercioId, productoId }: { comercioId: number; productoId?: number }) {
  const registrada = useRef("");
  useEffect(() => {
    const clave = `${comercioId}:${productoId ?? ""}`;
    if (registrada.current === clave) return;
    registrada.current = clave;
    if (productoId) guardarVisto(productoId);
    supabaseNavegador()
      .from("vistas")
      .insert({ comercio_id: comercioId, producto_id: productoId ?? null })
      .then(({ error }) => {
        if (error) console.warn("No se pudo registrar la vista", error.message);
      });
  }, [comercioId, productoId]);
  return null;
}
