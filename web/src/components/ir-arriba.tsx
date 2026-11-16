"use client";

import { useEffect } from "react";

// Al abrir una página (por ejemplo, un producto desde los resultados), la
// pantalla arranca arriba de todo, en el producto, y no más abajo.
export function IrArriba() {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, []);
  return null;
}
