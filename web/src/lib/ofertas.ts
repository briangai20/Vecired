import type { SupabaseClient } from "@supabase/supabase-js";
import { connection } from "next/server";
import { fechaAR } from "@/lib/formato";
import type { Database } from "@/lib/supabase/tipos";

type Db = SupabaseClient<Database>;

export type Oferta = {
  id: number;
  hasta: string;
  titulo: string | null;
  imagen_url: string | null;
  precio_oferta: number | null;
  comercio: { id: number; nombre: string };
  producto: { id: number; nombre: string; precio: number | null; foto_url: string | null } | null;
};

// Ofertas vigentes de comercios publicados (las reglas de la base ya filtran
// las vencidas y las de comercios ocultos para quien no es el dueño).
export async function ofertasVigentes(db: Db, { limite = 30, comercio }: { limite?: number; comercio?: number } = {}): Promise<Oferta[]> {
  // "Vigente" depende de la fecha de hoy: se calcula en cada pedido.
  await connection();
  let q = db
    .from("ofertas")
    .select("id, hasta, titulo, imagen_url, precio_oferta, comercio:comercios!inner(id, nombre, aprobado), producto:productos(id, nombre, precio, foto_url, activo)")
    .eq("comercio.aprobado", true)
    .gte("hasta", fechaAR(new Date()))
    .order("creada_en", { ascending: false })
    .limit(limite);
  if (comercio) q = q.eq("comercio_id", comercio);
  const { data } = await q;
  return (data ?? [])
    .filter((o) => !o.producto || o.producto.activo)
    .map((o) => ({
      id: o.id,
      hasta: o.hasta,
      titulo: o.titulo,
      imagen_url: o.imagen_url,
      precio_oferta: o.precio_oferta,
      comercio: { id: o.comercio.id, nombre: o.comercio.nombre },
      producto: o.producto ? { id: o.producto.id, nombre: o.producto.nombre, precio: o.producto.precio, foto_url: o.producto.foto_url } : null,
    }));
}

// Precio de oferta vigente de cada producto (el más barato si hay varias).
export async function preciosDeOferta(db: Db, productos: number[]): Promise<Map<number, number>> {
  const precios = new Map<number, number>();
  if (!productos.length) return precios;
  await connection();
  const { data } = await db
    .from("ofertas")
    .select("producto_id, precio_oferta")
    .in("producto_id", productos.slice(0, 500))
    .gte("hasta", fechaAR(new Date()));
  for (const o of data ?? []) {
    if (o.producto_id == null || o.precio_oferta == null) continue;
    const antes = precios.get(o.producto_id);
    if (antes == null || o.precio_oferta < antes) precios.set(o.producto_id, o.precio_oferta);
  }
  return precios;
}

// "hasta el 20/11"
export const hastaCorto = (fecha: string) => `hasta el ${Number(fecha.slice(8, 10))}/${Number(fecha.slice(5, 7))}`;

// Porcentaje de descuento redondeado ("-25%"), o null si no se puede calcular.
export function descuento(normal: number | null, oferta: number | null) {
  if (normal == null || oferta == null || normal <= 0 || oferta >= normal) return null;
  return Math.round((1 - oferta / normal) * 100);
}
