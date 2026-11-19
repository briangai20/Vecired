import type { Metadata } from "next";
import { Carrito } from "./carrito";

export const metadata: Metadata = { title: "Mi carrito", robots: { index: false } };

export default function PaginaCarrito() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold">Mi carrito</h1>
      <p className="mb-4 text-sm text-marino/80">Cada comercio es un pedido: elegís cuándo retirar y te llevás todo con un solo código.</p>
      <Carrito />
    </div>
  );
}
