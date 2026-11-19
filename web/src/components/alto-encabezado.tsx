"use client";

import { useEffect } from "react";

// El encabezado está fijo arriba (ver layout.tsx), así que no ocupa lugar en la
// página: este componente mide cuánto mide de alto (cambia con el buscador del
// celular o la zona de la hora del iPhone) y lo deja en --alto-encabezado, que
// usa el espacio de debajo para que el contenido no quede tapado.
export function AltoEncabezado() {
  useEffect(() => {
    const encabezado = document.getElementById("encabezado");
    if (!encabezado) return;
    const medir = () => document.documentElement.style.setProperty("--alto-encabezado", `${encabezado.offsetHeight}px`);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(encabezado);
    return () => obs.disconnect();
  }, []);
  return null;
}
