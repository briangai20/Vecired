import type { Metadata } from "next";
import { Conversacion } from "@/components/conversacion";
import Link from "next/link";
import { ComoLlegar } from "@/components/como-llegar";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Estrellas } from "@/components/insignias";
import { fechaAR, franjasRetiro, plata, totalReserva } from "@/lib/formato";
import { usuarioActual } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import type { Enum } from "@/lib/supabase/tipos";
import { cancelar, elegirAlternativa, reclamarRetiro, reprogramarRetiro } from "./acciones";
import { FormResena } from "./form-resena";
import { BotonEnviar } from "@/components/boton-enviar";

export const metadata: Metadata = { title: "Mis reservas" };

const ESTADOS: Record<Enum<"estado_reserva">, { texto: string; detalle: string }> = {
  pendiente: {
    texto: "Esperando al comercio",
    detalle: "El comercio tiene que confirmar que lo tiene. Tiene 2 horas de su horario de atención para responder; si no, la reserva vence sola y no se cobra nada.",
  },
  alternativa: {
    texto: "Te ofrecen otra opción",
    detalle: "El comercio no lo tiene, pero te ofrece estas alternativas. Elegí una dentro de las 2 horas (en horario del local) desde que te las ofreció.",
  },
  aceptada: {
    texto: "Confirmada: pasá a retirar",
    detalle: "Ya te lo separaron. Pagás al retirar. Retiralo en el horario que elegiste: si no llegás, podés elegir otro horario una sola vez antes de que cierre el local; si no, la reserva se cancela.",
  },
  retirada: { texto: "Retirada", detalle: "" },
  no_retirada: { texto: "No la retiraste", detalle: "Pasó el plazo para retirarla y el producto volvió a estar disponible. No se cobró nada." },
  rechazada: { texto: "El comercio no la pudo confirmar", detalle: "No se cobró nada." },
  cancelada: { texto: "Cancelada", detalle: "" },
  vencida: { texto: "Vencida", detalle: "El comercio no respondió a tiempo. No se cobró nada." },
};

export default function PaginaReservas({ searchParams }: PageProps<"/reservas">) {
  return (
    <Suspense fallback={<div className="tarjeta h-72 animate-pulse rounded-3xl" />}>
      <Reservas searchParams={searchParams} />
    </Suspense>
  );
}

async function Reservas({ searchParams }: Pick<PageProps<"/reservas">, "searchParams">) {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/ingresar?siguiente=/reservas");
  const { nueva: nuevaParam, error } = await searchParams;
  const nueva = typeof nuevaParam === "string" ? nuevaParam : undefined;

  const supabase = await supabaseServidor();
  const [{ data: reservas }, { data: avisosMensajes }] = await Promise.all([
    supabase
      .from("reservas")
      .select(
        "*, codigo:reserva_codigos(codigo), comercio:comercios(id, nombre, direccion, lat, lng), alternativas:reserva_alternativas(producto:productos(id, nombre, precio)), resena:resenas(estrellas, texto, respuesta), mensajes(id, autor_id, texto, creado_en)",
      )
      .eq("comprador_id", usuario.id)
      .order("creada_en", { ascending: false }),
    // Mensajes del comercio sin leer (un aviso "Mensaje de…" por mensaje).
    supabase.from("notificaciones").select("enlace").eq("usuario_id", usuario.id).is("leida_en", null).like("titulo", "Mensaje de %").limit(200),
  ]);
  const mensajesSinLeer = new Map<number, number>();
  for (const a of avisosMensajes ?? []) {
    const id = Number(/#reserva-(d+)$/.exec(a.enlace ?? "")?.[1]);
    if (id) mensajesSinLeer.set(id, (mensajesSinLeer.get(id) ?? 0) + 1);
  }

  const ahora = new Date();
  // Reservas a las que se les pasó el horario: horarios de su comercio para elegir otro.
  const aReprogramar = (reservas ?? []).filter((x) => x.estado === "aceptada" && x.reprogramar_hasta && !x.reprogramada_en);
  const comerciosReprogramar = [...new Set(aReprogramar.map((x) => x.comercio_id))];
  const franjasDe = new Map<number, string[]>();
  await Promise.all(
    comerciosReprogramar.map(async (id) => {
      const [{ data: horarios }, { data: cierres }] = await Promise.all([
        supabase.from("horarios").select("dia, abre, cierra").eq("comercio_id", id),
        supabase.rpc("dias_cerrados", { p_comercio: id, p_desde: fechaAR(ahora), p_hasta: fechaAR(ahora, 21) }),
      ]);
      franjasDe.set(id, franjasRetiro(horarios ?? [], ahora, (cierres ?? []).map((c) => c.fecha)));
    }),
  );
  const horaCorta = (f: string) =>
    new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", day: "numeric", month: "numeric" }).format(new Date(f));
  const lista = reservas ?? [];
  // Productos de cada pedido del carrito.
  const delPedido = (pedido: number) => lista.filter((x) => x.pedido === pedido).length;
  const abiertas = lista.filter((r) => ["pendiente", "alternativa", "aceptada"].includes(r.estado));
  const total = abiertas.reduce((a, r) => a + (totalReserva(r) ?? 0), 0);

  return (
    <>
      {typeof error === "string" ? (
        <p role="alert" className="mb-4 rounded-2xl border border-naranja bg-naranja/10 p-4 text-sm">
          {error}
        </p>
      ) : null}
      {nueva ? <ReservaNueva reserva={lista.find((r) => String(r.id) === nueva)} /> : null}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Mis reservas</h1>
          <p className="text-sm text-marino/80">Retirás en el local, en el horario que elegiste.</p>
        </div>
        {abiertas.length ? (
          <div className="tarjeta rounded-2xl px-5 py-3 text-right">
            <p className="text-xs text-white/80">Total a pagar al retirar</p>
            <p className="text-xl font-black">{plata(total)}</p>
          </div>
        ) : null}
      </div>

      {lista.length === 0 ? (
        <div className="tarjeta mx-auto max-w-xl rounded-3xl p-10 text-center">
          <h2 className="text-xl font-bold">Todavía no tenés reservas</h2>
          <p className="mt-2 text-sm text-white/80">Buscá un producto, elegí un comercio cercano y tocá Reservar.</p>
          <Link href="/" className="boton mt-6 inline-block rounded-xl px-5 py-2.5 text-sm font-semibold">
            Ir a buscar
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {lista.map((r) => {
            const e = ESTADOS[r.estado];
            const c = r.comercio;
            return (
              <article key={r.id} id={`reserva-${r.id}`} className="tarjeta scroll-mt-24 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-white/75">{c?.nombre}</p>
                    <h2 className="font-semibold">
                      {r.producto_nombre} × {r.cantidad}
                    </h2>
                    {r.retiro_ya || (r.pedido && delPedido(r.pedido) > 1) ? (
                      <p className="mt-1 flex flex-wrap gap-1.5">
                        {r.retiro_ya ? <span className="rounded-full bg-naranja px-2 py-0.5 text-[11px] font-bold">⚡ Retiro ya</span> : null}
                        {r.pedido && delPedido(r.pedido) > 1 ? (
                          <span className="rounded-full border border-white/40 px-2 py-0.5 text-[11px] font-semibold">🛒 Pedido de {delPedido(r.pedido)} productos · mismo código</span>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 rounded-full border border-white/40 px-2.5 py-1 text-[11px] font-semibold">{e.texto}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-white/60">Retiro</p>
                    <p className="font-medium">{r.retiro}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/60">Total</p>
                    <p className="font-bold">{plata(totalReserva(r))}</p>
                    {r.promo ? <p className="text-[11px] font-bold text-naranja-vivo">Promo {r.promo}</p> : null}
                  </div>
                </div>
                <p className="mt-3 text-xs text-white/75">
                  {c?.direccion}
                  {c?.lat != null && c?.lng != null ? (
                    <>
                      {" · "}
                      <ComoLlegar lat={c.lat} lng={c.lng} className="underline" />
                    </>
                  ) : null}
                </p>
                {e.detalle ? <p className="mt-2 text-xs text-white/85">{e.detalle}</p> : null}
                {r.estado === "pendiente" || r.estado === "alternativa" ? (
                  <p className="info mt-3 text-xs">
                    🔑 Cuando el comercio confirme tu reserva, te vamos a dar un <b>código de retiro</b> (acá y por mail). Lo mostrás en el local y
                    con ese código retirás tu pedido.
                  </p>
                ) : null}
                {r.estado === "aceptada" && r.reprogramar_hasta && !r.reprogramada_en ? (
                  <div className="info mt-3 text-sm">
                    <p className="font-semibold">⏰ Se pasó tu horario de retiro</p>
                    <p className="mt-1 text-xs text-white/85">
                      Elegí otro horario antes de las <b>{horaCorta(r.reprogramar_hasta)}</b> o la reserva se cancela. Lo podés cambiar una sola vez.
                    </p>
                    {(franjasDe.get(r.comercio_id) ?? []).length ? (
                      <form action={reprogramarRetiro} className="mt-2 flex flex-wrap gap-2">
                        <input type="hidden" name="reserva" value={r.id} />
                        <select name="retiro" className="campo min-w-0 flex-1" required>
                          {(franjasDe.get(r.comercio_id) ?? []).map((f) => (
                            <option key={f}>{f}</option>
                          ))}
                        </select>
                        <BotonEnviar enviando="Cambiando…" className="boton rounded-xl px-4 py-2 text-xs font-semibold">
                          Cambiar horario
                        </BotonEnviar>
                      </form>
                    ) : (
                      <p className="mt-2 text-xs">El comercio no tiene horarios disponibles en los próximos días.</p>
                    )}
                  </div>
                ) : null}
                {r.estado === "aceptada" && r.reprogramada_en ? (
                  <p className="mt-2 text-xs text-white/75">🔁 Cambiaste el horario de retiro (ya no se puede cambiar de nuevo).</p>
                ) : null}
                {r.estado === "rechazada" && r.motivo_comercio ? (
                  <p className="info mt-3 text-xs">
                    Motivo del comercio: “{r.motivo_comercio}”
                  </p>
                ) : null}
                {r.estado === "aceptada" && r.codigo ? (
                  <div className="info mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Código de retiro</p>
                      <p className="text-xs text-white/80">
                        {r.pedido && delPedido(r.pedido) > 1
                          ? "Es el mismo código para todo el pedido: con uno solo retirás todos los productos que aceptó el comercio. No lo compartas con nadie más."
                          : "Mostráselo al comercio cuando vayas a retirar. No lo compartas con nadie más."}
                      </p>
                    </div>
                    <p className="font-mono text-3xl font-black tracking-[0.3em] text-naranja-vivo">{r.codigo.codigo}</p>
                  </div>
                ) : null}
                {r.estado === "retirada" && r.retiro_sin_codigo ? (
                  <div className="info mt-3 text-xs">
                    <p>
                      El comercio la entregó <b>sin tu código</b> ({r.retiro_sin_codigo}).
                    </p>
                    {r.reclamo_en ? (
                      <p className="mt-1 font-semibold">Hiciste el reclamo: lo estamos revisando.</p>
                    ) : ahora.getTime() - new Date(r.actualizada_en).getTime() < 48 * 3600_000 ? (
                      <form action={reclamarRetiro} className="mt-2 flex flex-wrap gap-2">
                        <input type="hidden" name="reserva" value={r.id} />
                        <input name="texto" maxLength={1000} placeholder="Contanos qué pasó (opcional)" className="campo min-w-0 flex-1" />
                        <BotonEnviar enviando="Enviando…" className="rounded-xl border border-white/50 px-4 py-2 font-semibold hover:bg-white/10">
                          No lo retiré
                        </BotonEnviar>
                      </form>
                    ) : null}
                  </div>
                ) : null}

                {r.estado === "alternativa" && r.alternativas.length ? (
                  <div className="mt-3 space-y-2">
                    {r.alternativas.map((a) =>
                      a.producto ? (
                        <form key={a.producto.id} action={elegirAlternativa} className="flex items-center justify-between gap-2 rounded-xl border border-white/25 p-3 text-sm">
                          <input type="hidden" name="reserva" value={r.id} />
                          <input type="hidden" name="producto" value={a.producto.id} />
                          <span>
                            {a.producto.nombre} · {plata(a.producto.precio)} c/u
                          </span>
                          <button className="boton rounded-lg px-3 py-1.5 text-xs font-semibold">Elegir esta</button>
                        </form>
                      ) : null,
                    )}
                  </div>
                ) : null}

                <Conversacion
                  reserva={r.id}
                  yo={usuario.id}
                  otro="el comercio"
                  iniciales={r.mensajes}
                  abierta={["pendiente", "alternativa", "aceptada"].includes(r.estado)}
                  sinLeer={mensajesSinLeer.get(r.id) ?? 0}
                />

                {["pendiente", "alternativa", "aceptada"].includes(r.estado) ? (
                  <form action={cancelar} className="mt-4">
                    <input type="hidden" name="reserva" value={r.id} />
                    <button className="w-full rounded-xl border border-white/30 py-2 text-sm hover:bg-white/10">Cancelar reserva</button>
                  </form>
                ) : null}

                {r.estado === "retirada" ? (
                  r.resena ? (
                    <div className="mt-4 rounded-xl border border-white/25 p-3 text-sm">
                      <p className="text-xs text-white/75">Tu reseña</p>
                      <Estrellas valor={r.resena.estrellas} />
                      {r.resena.texto ? <p className="mt-1">{r.resena.texto}</p> : null}
                      {r.resena.respuesta ? (
                        <div className="mt-2 rounded-lg border-l-2 border-naranja-vivo bg-white/5 p-2">
                          <p className="text-xs font-semibold text-white/80">Respuesta de {c?.nombre}</p>
                          <p className="mt-0.5">{r.resena.respuesta}</p>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <FormResena reserva={r.id} />
                  )
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

// Cartel que se ve apenas se hace una reserva, con el camino para seguir
// comprando en el mismo comercio o volver al inicio.
function ReservaNueva({ reserva }: { reserva?: { producto_nombre: string; cantidad: number; retiro: string; comercio: { id: number; nombre: string } | null } }) {
  return (
    <div role="status" className="mb-6 rounded-3xl border-2 border-[#8ce99a] bg-white p-5 text-marino shadow-lg">
      <p className="text-lg font-bold">✔ ¡Listo, reservaste!</p>
      {reserva ? (
        <p className="mt-1 text-sm">
          {reserva.producto_nombre} × {reserva.cantidad} en <span className="font-semibold">{reserva.comercio?.nombre ?? "el comercio"}</span> · Retiro:{" "}
          {reserva.retiro}
        </p>
      ) : null}
      <p className="mt-2 text-sm text-marino/80">
        Ahora el comercio tiene que confirmar que lo tiene. Te avisamos por mail y vas a ver el estado acá abajo. Pagás en el local al retirar.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {reserva?.comercio ? (
          <Link href={`/comercio/${reserva.comercio.id}`} className="boton rounded-xl px-4 py-2.5 text-sm font-semibold">
            ‹ Volver a {reserva.comercio.nombre}
          </Link>
        ) : null}
        <Link href="/" className="rounded-xl border border-marino/30 px-4 py-2.5 text-sm font-semibold hover:bg-marino/5">
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
