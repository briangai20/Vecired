"use client";

import { useMemo, useSyncExternalStore } from "react";

// Lo que la persona vio y buscó, guardado solo en su navegador (no viaja a la
// base). Si el navegador no deja guardar (modo incógnito, bloqueado), no pasa
// nada: simplemente no se muestra.

const VISTOS = "vecired:vistos";
const BUSQUEDAS = "vecired:busquedas";
const EVENTO = "vecired:historial";
const MAX_VISTOS = 12;
const MAX_BUSQUEDAS = 6;

function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function escribir(clave: string, valor: unknown[] | null) {
  try {
    if (valor == null || !valor.length) localStorage.removeItem(clave);
    else localStorage.setItem(clave, JSON.stringify(valor));
    window.dispatchEvent(new Event(EVENTO));
  } catch {
    // Sin lugar o sin permiso: se ignora.
  }
}

function lista<T>(texto: string | null, valido: (x: unknown) => x is T): T[] {
  if (!texto) return [];
  try {
    const v: unknown = JSON.parse(texto);
    return Array.isArray(v) ? v.filter(valido) : [];
  } catch {
    return [];
  }
}

const esId = (x: unknown): x is number => Number.isInteger(x) && (x as number) > 0;
const esTexto = (x: unknown): x is string => typeof x === "string" && x.trim().length > 0;

function suscribir(avisar: () => void) {
  const alCambiar = (e: Event) => {
    if (e instanceof StorageEvent && e.key !== VISTOS && e.key !== BUSQUEDAS) return;
    avisar();
  };
  window.addEventListener(EVENTO, alCambiar);
  window.addEventListener("storage", alCambiar); // otra pestaña
  return () => {
    window.removeEventListener(EVENTO, alCambiar);
    window.removeEventListener("storage", alCambiar);
  };
}

// --- Productos vistos ---

export function guardarVisto(productoId: number) {
  const antes = lista(leer(VISTOS), esId).filter((id) => id !== productoId);
  escribir(VISTOS, [productoId, ...antes].slice(0, MAX_VISTOS));
}

export function sacarVisto(productoId: number) {
  escribir(VISTOS, lista(leer(VISTOS), esId).filter((id) => id !== productoId));
}

export const borrarVistos = () => escribir(VISTOS, null);

/** Ids de los productos vistos, del más reciente al más viejo. En el servidor da "". */
export function useVistos(): number[] {
  const texto = useSyncExternalStore(suscribir, () => leer(VISTOS) ?? "", () => "");
  return useMemo(() => lista(texto, esId), [texto]);
}

// --- Búsquedas recientes ---

export function guardarBusqueda(texto: string) {
  const t = texto.trim().slice(0, 80);
  if (!t) return;
  const antes = lista(leer(BUSQUEDAS), esTexto).filter((b) => b.toLowerCase() !== t.toLowerCase());
  escribir(BUSQUEDAS, [t, ...antes].slice(0, MAX_BUSQUEDAS));
}

export function sacarBusqueda(texto: string) {
  escribir(BUSQUEDAS, lista(leer(BUSQUEDAS), esTexto).filter((b) => b !== texto));
}

export function useBusquedas(): string[] {
  const texto = useSyncExternalStore(suscribir, () => leer(BUSQUEDAS) ?? "", () => "");
  return useMemo(() => lista(texto, esTexto), [texto]);
}
