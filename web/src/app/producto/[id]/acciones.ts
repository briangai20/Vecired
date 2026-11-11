"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";

export type EstadoPregunta = { error?: string; ok?: number };

// Pregunta pública en la página del producto. La base completa el comercio y
// el autor, y frena el abuso (ver supabase/17_preguntas.sql).
export async function preguntar(_: EstadoPregunta, d: FormData): Promise<EstadoPregunta> {
  const productoId = Number(String(d.get("producto") ?? ""));
  if (!Number.isInteger(productoId) || productoId <= 0) return { error: "Producto no encontrado." };
  const u = await usuarioActual();
  if (!u) redirect(`/ingresar?siguiente=${encodeURIComponent(`/producto/${productoId}#preguntas`)}`);
  const texto = String(d.get("texto") ?? "").trim();
  if (texto.length < 3) return { error: "Escribí tu pregunta (al menos 3 letras)." };
  if (texto.length > 500) return { error: "La pregunta puede tener hasta 500 letras." };
  const supabase = await supabaseServidor();
  const { error } = await supabase.from("preguntas").insert({ producto_id: productoId, texto });
  if (error) return { error: error.code === "P0001" ? error.message : "No pudimos mandar la pregunta. Probá de nuevo en un rato." };
  refresh();
  return { ok: Date.now() };
}

// Borra una pregunta propia (o, si sos el dueño, una de tu comercio).
export async function borrarPregunta(d: FormData) {
  const id = Number(String(d.get("pregunta") ?? ""));
  if (!Number.isInteger(id) || id <= 0) return;
  if (!(await usuarioActual())) return;
  const supabase = await supabaseServidor();
  await supabase.from("preguntas").delete().eq("id", id);
  refresh();
}
