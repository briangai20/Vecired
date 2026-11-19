"use client";

import { useSyncExternalStore } from "react";

// Carrito de compras, guardado solo en el navegador. Se arma por comercio:
// todo lo de un mismo comercio se reserva junto, en un solo pedido, y se
// retira con un solo código. Si el navegador no deja guardar, queda vacío.

export type ItemCarrito = {
  id: number;
  nombre: string;
  precio: number | null;
  foto: string | null;
  cantidad: number;
  maximo: number;
};
export type CarritoComercio = { comercio: { id: number; nombre: string }; items: ItemCarrito[] };
type Carrito = Record<string, CarritoComercio>;

const CLAVE = "vecired:carrito";
const EVENTO = "vecired:carrito";
const VACIO: Carrito = {};

let cacheTexto: string | null = null;
let cache: Carrito = VACIO;

function leer(): Carrito {
  let texto: string | null = null;
  try {
    texto = localStorage.getItem(CLAVE);
  } catch {
    return VACIO;
  }
  if (texto === cacheTexto) return cache;
  cacheTexto = texto;
  try {
    const v: unknown = texto ? JSON.parse(texto) : {};
    cache = v && typeof v === "object" && !Array.isArray(v) ? (v as Carrito) : VACIO;
  } catch {
    cache = VACIO;
  }
  return cache;
}

function escribir(c: Carrito) {
  try {
    const limpio = Object.fromEntries(Object.entries(c).filter(([, x]) => x.items.length));
    if (Object.keys(limpio).length) localStorage.setItem(CLAVE, JSON.stringify(limpio));
    else localStorage.removeItem(CLAVE);
    window.dispatchEvent(new Event(EVENTO));
  } catch {
    // Sin lugar o sin permiso: se ignora.
  }
}

function suscribir(avisar: () => void) {
  const alCambiar = (e: Event) => {
    if (e instanceof StorageEvent && e.key !== CLAVE) return;
    avisar();
  };
  window.addEventListener(EVENTO, alCambiar);
  window.addEventListener("storage", alCambiar); // otra pestaña
  return () => {
    window.removeEventListener(EVENTO, alCambiar);
    window.removeEventListener("storage", alCambiar);
  };
}

/** Todo el carrito, por comercio. */
export const useCarrito = () => useSyncExternalStore(suscribir, leer, () => VACIO);

/** Cuántas unidades hay en total (para el ícono). */
export const unidades = (c: Carrito) => Object.values(c).reduce((n, x) => n + x.items.reduce((m, i) => m + i.cantidad, 0), 0);

export function agregarAlCarrito(comercio: { id: number; nombre: string }, item: ItemCarrito) {
  const c = { ...leer() };
  const actual = c[comercio.id] ?? { comercio, items: [] };
  const ya = actual.items.find((i) => i.id === item.id);
  const items = ya
    ? actual.items.map((i) => (i.id === item.id ? { ...i, ...item, cantidad: Math.min(i.cantidad + item.cantidad, item.maximo) } : i))
    : [...actual.items, { ...item, cantidad: Math.min(item.cantidad, item.maximo) }];
  c[comercio.id] = { comercio, items };
  escribir(c);
}

export function cambiarCantidad(comercioId: number, productoId: number, cantidad: number) {
  const c = { ...leer() };
  const actual = c[comercioId];
  if (!actual) return;
  c[comercioId] = {
    ...actual,
    items: actual.items
      .map((i) => (i.id === productoId ? { ...i, cantidad: Math.max(0, Math.min(cantidad, i.maximo)) } : i))
      .filter((i) => i.cantidad > 0),
  };
  escribir(c);
}

export function vaciarComercio(comercioId: number) {
  const c = { ...leer() };
  delete c[comercioId];
  escribir(c);
}
