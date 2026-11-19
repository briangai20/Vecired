"use server";

import { after } from "next/server";
import { avisarReserva } from "@/lib/avisos";
import { disponibilidad, fechaAR, franjasRetiro, retiroYaHasta } from "@/lib/formato";
import { preciosDeOferta } from "@/lib/ofertas";
import { usuarioActual } from "@/lib/sesion";
import { supabasePublico } from "@/lib/supabase/publico";
import { supabaseServidor } from "@/lib/supabase/servidor";

export type DatosComercio = {
  /** Horarios de retiro para elegir (los mismos que en la página del producto). */
  franjas: string[];
  /** "Retiro ya": hasta qué hora, si el local está abierto ahora. */
  retiroYa: string | null;
  productos: Record<number, { nombre: string; precio: number | null; sePuede: boolean; ya: boolean; maximo: number; texto: string }>;
};

const ids = (v: unknown[]) => [...new Set(v.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 60);

// Lo que el carrito necesita saber al momento: precios y stock actuales y los
// horarios de retiro de cada comercio.
export async function datosCarrito(comercios: number[], productos: number[]): Promise<Record<number, DatosComercio>> {
  const db = supabasePublico();
  const ahora = new Date();
  const listaComercios = ids(comercios);
  const listaProductos = ids(productos);
  const [{ data: filas }, { data: horarios }, ofertas] = await Promise.all([
    db.from("productos").select("id, comercio_id, nombre, precio, modo, stock, semaforo, actualizado_en").in("id", listaProductos).eq("activo", true),
    db.from("horarios").select("*").in("comercio_id", listaComercios),
    preciosDeOferta(db, listaProductos),
  ]);
  const salida: Record<number, DatosComercio> = {};
  await Promise.all(
    listaComercios.map(async (id) => {
      const { data: cierres } = await db.rpc("dias_cerrados", { p_comercio: id, p_desde: fechaAR(ahora), p_hasta: fechaAR(ahora, 21) });
      const cerrados = (cierres ?? []).map((x) => x.fecha);
      const franjas = (horarios ?? []).filter((h) => h.comercio_id === id);
      salida[id] = { franjas: franjasRetiro(franjas, ahora, cerrados), retiroYa: retiroYaHasta(franjas, ahora, cerrados), productos: {} };
    }),
  );
  for (const p of filas ?? []) {
    const datos = salida[p.comercio_id];
    if (!datos) continue;
    const d = disponibilidad(p, ahora);
    const exacto = p.modo === "exacto" && !d.requiereConfirmacion;
    datos.productos[p.id] = {
      nombre: p.nombre,
      precio: ofertas.get(p.id) ?? p.precio,
      sePuede: d.sePuede,
      ya: exacto && d.sePuede,
      maximo: exacto ? Math.min(Math.max(p.stock ?? 1, 1), 20) : 10,
      texto: d.texto,
    };
  }
  return salida;
}

export type ResultadoCarrito = { error?: string; ingresar?: boolean; reserva?: number };

// Reserva todo lo del carrito de un comercio en un solo pedido (un código).
export async function reservarCarrito(items: { producto: number; cantidad: number }[], retiro: string, ya: boolean): Promise<ResultadoCarrito> {
  if (!(await usuarioActual())) return { ingresar: true };
  const lista = items
    .map((i) => ({ producto: Number(i.producto), cantidad: Number(i.cantidad) }))
    .filter((i) => Number.isInteger(i.producto) && i.producto > 0 && Number.isInteger(i.cantidad) && i.cantidad >= 1 && i.cantidad <= 20)
    .slice(0, 30);
  if (!lista.length) return { error: "El carrito está vacío." };
  if (!ya && !retiro.trim()) return { error: "Elegí un horario de retiro." };
  const supabase = await supabaseServidor();
  const { data: pedido, error } = await supabase.rpc("reservar_pedido", { p_items: lista, p_retiro: ya ? "" : retiro.slice(0, 80), p_ya: ya });
  if (error || pedido == null) return { error: error?.code === "P0001" ? error.message : "No pudimos hacer la reserva. Probá de nuevo en un rato." };
  const { data: primera } = await supabase.from("reservas").select("id").eq("pedido", pedido).order("id").limit(1).maybeSingle();
  if (primera) after(() => avisarReserva(primera.id, "nueva"));
  return { reserva: primera?.id };
}
