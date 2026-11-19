"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { avisarReserva } from "@/lib/avisos";
import { usuarioActual } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import type { TablesInsert } from "@/lib/supabase/tipos";

export type EstadoReserva = { error?: string };

const numero = (d: FormData, k: string) => Number(String(d.get(k) ?? ""));
const texto = (d: FormData, k: string) => String(d.get(k) ?? "").trim();

// Los mensajes de error los escribe la base en castellano (stock, producto
// no disponible...), así que se pueden mostrar tal cual.
function mensaje(e: { message: string; code?: string }) {
  return e.code === "P0001" ? e.message : "No pudimos hacer la reserva. Probá de nuevo en un rato.";
}

async function conSesion(siguiente: string) {
  const u = await usuarioActual();
  if (!u) redirect(`/ingresar?siguiente=${encodeURIComponent(siguiente)}`);
  return supabaseServidor();
}

export async function reservar(_: EstadoReserva, d: FormData): Promise<EstadoReserva> {
  const productoId = numero(d, "producto");
  const supabase = await conSesion(`/producto/${productoId}`);
  const cantidad = numero(d, "cantidad");
  const ya = texto(d, "retiro_ya") === "1";
  // Con "Retiro ya" el horario lo arma la base (desde ahora hasta 2 horas o el cierre).
  const retiro = ya ? "Ya" : texto(d, "retiro");
  if (!productoId || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 20) return { error: "Elegí una cantidad entre 1 y 20." };
  if (!retiro) return { error: "Elegí un horario de retiro." };

  // Precio, comercio y estado los completa la base (trigger preparar_reserva).
  // El comprador solo tiene permiso para mandar estas columnas.
  const fila = { producto_id: productoId, cantidad, retiro, medio_pago: "local", ...(ya ? { retiro_ya: true } : {}) } as TablesInsert<"reservas">;
  const { data, error } = await supabase.from("reservas").insert(fila).select("id").single();
  if (error) return { error: mensaje(error) };
  after(() => avisarReserva(data.id, "nueva"));
  redirect(`/reservas?nueva=${data.id}`);
}

// "No lo retiré": reclamo de una entrega hecha sin el código (48 horas).
export async function reclamarRetiro(d: FormData) {
  const reserva = numero(d, "reserva");
  const supabase = await conSesion("/reservas");
  if (!reserva) return;
  const { error } = await supabase.rpc("reclamar_retiro", { p_reserva: reserva, p_texto: texto(d, "texto").slice(0, 1000) });
  if (error) redirect(`/reservas?error=${encodeURIComponent(error.code === "P0001" ? error.message : "No pudimos enviar el reclamo. Probá de nuevo.")}`);
  refresh();
}

// Elegir otro horario de retiro cuando se pasó el elegido (una sola vez).
export async function reprogramarRetiro(d: FormData) {
  const reserva = numero(d, "reserva");
  const supabase = await conSesion("/reservas");
  const retiro = texto(d, "retiro");
  if (!reserva || !retiro) return;
  const { error } = await supabase.rpc("reprogramar_retiro", { p_reserva: reserva, p_retiro: retiro.slice(0, 80) });
  if (error) redirect(`/reservas?error=${encodeURIComponent(error.code === "P0001" ? error.message : "No pudimos cambiar el horario. Probá de nuevo.")}`);
  refresh();
}

export async function cancelar(d: FormData) {
  const supabase = await conSesion("/reservas");
  const reserva = numero(d, "reserva");
  const { error } = await supabase.rpc("cancelar_reserva", { p_reserva: reserva });
  if (!error) after(() => avisarReserva(reserva, "cancelada"));
  redirect("/reservas"); // sin "?nueva=1", para que no quede el cartel de "¡Listo, reservaste!"
}

export async function elegirAlternativa(d: FormData) {
  const supabase = await conSesion("/reservas");
  const reserva = numero(d, "reserva");
  const { error } = await supabase.rpc("elegir_alternativa", { p_reserva: reserva, p_producto: numero(d, "producto") });
  if (error) redirect(`/reservas?error=${encodeURIComponent(mensaje(error))}`);
  after(() => avisarReserva(reserva, "alternativa_elegida"));
  redirect("/reservas");
}

export type EstadoResena = { error?: string };

// Si el texto tiene datos que no se pueden publicar, la base lo rechaza con el
// motivo en castellano y el formulario lo muestra en un cartel.
export async function dejarResena(_: EstadoResena, d: FormData): Promise<EstadoResena> {
  const supabase = await conSesion("/reservas");
  const estrellas = numero(d, "estrellas");
  if (!(estrellas >= 1 && estrellas <= 5)) return { error: "Elegí de 1 a 5 estrellas." };
  // Comercio, autor y fecha los completa la base (trigger preparar_resena).
  const fila = { reserva_id: numero(d, "reserva"), estrellas, texto: texto(d, "texto").slice(0, 1000) || null } as TablesInsert<"resenas">;
  const { error } = await supabase.from("resenas").insert(fila);
  if (error) return { error: error.code === "P0001" ? error.message : "No pudimos publicar la reseña. Probá de nuevo en un rato." };
  refresh();
  return {};
}
