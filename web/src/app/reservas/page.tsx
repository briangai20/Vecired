import type { Metadata } from "next";
import { Conversacion } from "@/components/conversacion";
import Link from "next/link";
import { ComoLlegar } from "@/components/como-llegar";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FotoProducto } from "@/components/foto-producto";
import { Estrellas } from "@/components/insignias";
import { LogoComercio } from "@/components/logo-comercio";
import { fechaAR, franjasRetiro, plata, totalReserva } from "@/lib/formato";
import { usuarioActual } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import type { Enum } from "@/lib/supabase/tipos";
import { cancelar, elegirAlternativa, reclamarRetiro, reprogramarRetiro } from "./acciones";
import { FormResena } from "./form-resena";
import { BotonEnviar } from "@/components/boton-enviar";

export const metadata: Metadata = { title: "Mis reservas" };

type Estado = Enum<"estado_reserva">;

// Texto corto del estado y qué tiene que hacer el cliente.
const ESTADOS: Record<Estado, { texto: string; detalle: string; color: string }> = {
  pendiente: {
    texto: "Esperando al comercio",
    detalle: "El comercio tiene que confirmar que lo tiene (tiene 2 horas de su horario). Cuando lo confirme, te damos el código para retirar.",
    color: "border-white/40 text-white",
  },
  alternativa: {
    texto: "Elegí una opción",
    detalle: "El comercio no lo tiene, pero te ofrece otros productos. Elegí uno o cancelá sin costo.",
    color: "border-naranja-vivo bg-naranja/20 text-white",
  },
  aceptada: {
    texto: "Listo para retirar",
    detalle: "Ya te lo separaron. Mostrá el código en el local y pagás al retirar.",
    color: "border-verde bg-verde/15 text-verde",
  },
  retirada: { texto: "Retirada", detalle: "", color: "border-white/30 text-white/80" },
  no_retirada: { texto: "No la retiraste", detalle: "Pasó el plazo y el producto volvió a estar disponible. No se cobró nada.", color: "border-white/30 text-white/70" },
  rechazada: { texto: "No la pudo confirmar", detalle: "El comercio no la pudo confirmar. No se cobró nada.", color: "border-white/30 text-white/70" },
  cancelada: { texto: "Cancelada", detalle: "", color: "border-white/30 text-white/70" },
  vencida: { texto: "Vencida", detalle: "El comercio no respondió a tiempo. No se cobró nada.", color: "border-white/30 text-white/70" },
};
const EN_CURSO: Estado[] = ["pendiente", "alternativa", "aceptada"];

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
        "*, producto:productos!reservas_producto_id_fkey(foto_url), codigo:reserva_codigos(codigo), comercio:comercios(id, nombre, direccion, lat, lng, logo_url), alternativas:reserva_alternativas(producto:productos(id, nombre, precio, foto_url)), resena:resenas(estrellas, texto, respuesta), mensajes(id, autor_id, texto, creado_en)",
      )
      .eq("comprador_id", usuario.id)
      .order("creada_en", { ascending: false }),
    // Mensajes del comercio sin leer (un aviso "Mensaje de…" por mensaje).
    supabase.from("notificaciones").select("enlace").eq("usuario_id", usuario.id).is("leida_en", null).like("titulo", "Mensaje de %").limit(200),
  ]);
  const mensajesSinLeer = new Map<number, number>();
  for (const a of avisosMensajes ?? []) {
    const id = Number(/#reserva-(\d+)$/.exec(a.enlace ?? "")?.[1]);
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
  type Reserva = (typeof lista)[number];

  // Lo del mismo pedido del carrito va junto, en una sola tarjeta.
  const grupos: Reserva[][] = [];
  for (const r of [...lista].sort((a, b) => a.id - b.id)) {
    const g = r.pedido ? grupos.find((x) => x[0].pedido === r.pedido) : undefined;
    if (g) g.push(r);
    else grupos.push([r]);
  }
  grupos.sort((a, b) => b[0].id - a[0].id);
  // El estado de la tarjeta: lo más importante para el cliente.
  const estadoDe = (g: Reserva[]): Estado =>
    g.some((x) => x.estado === "alternativa")
      ? "alternativa"
      : g.some((x) => x.estado === "aceptada")
        ? "aceptada"
        : g.some((x) => x.estado === "pendiente")
          ? "pendiente"
          : g[g.length - 1].estado;
  const enCurso = grupos.filter((g) => g.some((x) => EN_CURSO.includes(x.estado)));
  const secciones: [string, Reserva[][]][] = [
    ["👉 Necesitan tu respuesta", enCurso.filter((g) => estadoDe(g) === "alternativa")],
    ["✅ Listas para retirar", enCurso.filter((g) => estadoDe(g) === "aceptada")],
    ["⏳ Esperando al comercio", enCurso.filter((g) => estadoDe(g) === "pendiente")],
  ];
  const historial = grupos.filter((g) => !g.some((x) => EN_CURSO.includes(x.estado)));
  const total = lista.filter((r) => EN_CURSO.includes(r.estado)).reduce((a, r) => a + (totalReserva(r) ?? 0), 0);

  function tarjeta(g: Reserva[]) {
    const r = g[0];
    const c = r.comercio;
    const estado = estadoDe(g);
    const e = ESTADOS[estado];
    const esPedido = g.length > 1;
    const abiertas = g.filter((x) => EN_CURSO.includes(x.estado));
    const codigo = g.find((x) => x.estado === "aceptada" && x.codigo)?.codigo?.codigo;
    const aRepro = g.find((x) => x.estado === "aceptada" && x.reprogramar_hasta && !x.reprogramada_en);
    const totales = g.filter((x) => !["rechazada", "cancelada", "vencida"].includes(x.estado)).map((x) => totalReserva(x));
    const totalG = totales.some((t) => t == null) ? null : totales.reduce<number>((a, t) => a + (t ?? 0), 0);
    const sinCodigo = g.find((x) => x.estado === "retirada" && x.retiro_sin_codigo);
    const retirada = g.find((x) => x.estado === "retirada");
    return (
      <article key={r.id} id={`reserva-${r.id}`} className="tarjeta scroll-mt-24 rounded-2xl p-4">
        {/* Comercio y estado */}
        <div className="flex items-center gap-2.5">
          <LogoComercio url={c?.logo_url} nombre={c?.nombre ?? "Comercio"} className="h-9 w-9 text-[11px]" />
          <div className="min-w-0 flex-1">
            <Link href={c ? `/comercio/${c.id}` : "#"} className="block truncate text-sm font-semibold hover:underline">
              {c?.nombre ?? "Comercio"}
            </Link>
            <p className="truncate text-[11px] text-white/70">
              {esPedido ? `🛒 Pedido de ${g.length} productos` : "Reserva"}
              {r.retiro_ya ? " · ⚡ Retiro ya" : ""}
            </p>
          </div>
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${e.color}`}>{e.texto}</span>
        </div>

        {/* Productos */}
        <ul className="mt-3 space-y-2">
          {g.map((x) => (
            <li key={x.id} id={esPedido ? `reserva-${x.id}` : undefined} className="flex scroll-mt-24 items-center gap-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-marino-claro">
                <FotoProducto url={x.producto?.foto_url ?? null} nombre={x.producto_nombre} sizes="48px" texto="text-lg" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{x.producto_nombre}</p>
                <p className="text-xs text-white/70">
                  {x.cantidad} × {plata(x.precio_unitario)}
                  {x.promo ? <span className="ml-1 font-bold text-naranja-vivo">· {x.promo}</span> : null}
                </p>
              </div>
              {esPedido && x.estado !== estado ? <span className="shrink-0 text-[11px] text-white/70">{ESTADOS[x.estado].texto}</span> : null}
            </li>
          ))}
        </ul>

        {/* Retiro y total */}
        <div className="mt-3 flex items-end justify-between gap-3 border-t border-white/15 pt-3 text-xs">
          <div className="min-w-0">
            <p className="text-white/60">Retiro</p>
            <p className="font-semibold">{r.retiro}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-white/60">Total</p>
            <p className="text-base font-black">{plata(totalG)}</p>
          </div>
        </div>

        {codigo ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-marino">
            <p className="text-xs leading-tight">
              <b>Código de retiro</b>
              <br />
              {esPedido ? "Uno solo para todo el pedido." : "Mostralo en el local."} No lo compartas.
            </p>
            <p className="font-mono text-2xl font-black tracking-[0.25em] text-naranja">{codigo}</p>
          </div>
        ) : null}

        {e.detalle && !codigo ? <p className="mt-2 text-xs text-white/80">{e.detalle}</p> : null}

        {aRepro ? (
          <div className="info mt-3 text-xs">
            <p className="font-semibold">⏰ Se pasó tu horario de retiro</p>
            <p className="mt-1 text-white/85">
              Elegí otro antes de las <b>{horaCorta(aRepro.reprogramar_hasta!)}</b> o se cancela. Se puede cambiar una sola vez.
            </p>
            {(franjasDe.get(aRepro.comercio_id) ?? []).length ? (
              <form action={reprogramarRetiro} className="mt-2 flex flex-wrap gap-2">
                <input type="hidden" name="reserva" value={aRepro.id} />
                <select name="retiro" className="campo min-w-0 flex-1" required>
                  {(franjasDe.get(aRepro.comercio_id) ?? []).map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
                <BotonEnviar enviando="Cambiando…" className="boton rounded-xl px-4 py-2 text-xs font-semibold">
                  Cambiar horario
                </BotonEnviar>
              </form>
            ) : (
              <p className="mt-2">El comercio no tiene horarios disponibles en los próximos días.</p>
            )}
          </div>
        ) : null}

        {/* Alternativas que ofrece el comercio para lo que no tiene. */}
        {g
          .filter((x) => x.estado === "alternativa" && x.alternativas.length)
          .map((x) => (
            <div key={x.id} className="mt-3 rounded-xl border border-naranja-vivo/70 p-3">
              <p className="text-xs">
                No tiene <b>{x.producto_nombre}</b>. Te ofrece:
              </p>
              <div className="mt-2 space-y-2">
                {x.alternativas.map((a) =>
                  a.producto ? (
                    <form key={a.producto.id} action={elegirAlternativa} className="flex items-center gap-2 text-xs">
                      <input type="hidden" name="reserva" value={x.id} />
                      <input type="hidden" name="producto" value={a.producto.id} />
                      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-marino-claro">
                        <FotoProducto url={a.producto.foto_url} nombre={a.producto.nombre} sizes="36px" texto="text-sm" />
                      </div>
                      <span className="min-w-0 flex-1">
                        {a.producto.nombre} · {plata(a.producto.precio)}
                      </span>
                      <button className="boton shrink-0 rounded-lg px-3 py-1.5 font-semibold">Elegir</button>
                    </form>
                  ) : null,
                )}
              </div>
              <form action={cancelar} className="mt-2 text-right">
                <input type="hidden" name="reserva" value={x.id} />
                <BotonEnviar enviando="Sacando…" className="text-xs text-white/75 underline hover:text-white">
                  {esPedido ? "No quiero ninguno: sacarlo del pedido" : "No quiero ninguno: cancelar"}
                </BotonEnviar>
              </form>
            </div>
          ))}

        {g.some((x) => x.estado === "rechazada" && x.motivo_comercio) ? (
          <p className="info mt-3 text-xs">Motivo del comercio: “{g.find((x) => x.motivo_comercio)?.motivo_comercio}”</p>
        ) : null}

        {sinCodigo ? (
          <div className="info mt-3 text-xs">
            <p>
              El comercio lo entregó <b>sin tu código</b> ({sinCodigo.retiro_sin_codigo}).
            </p>
            {sinCodigo.reclamo_en ? (
              <p className="mt-1 font-semibold">Hiciste el reclamo: lo estamos revisando.</p>
            ) : ahora.getTime() - new Date(sinCodigo.actualizada_en).getTime() < 48 * 3600_000 ? (
              <form action={reclamarRetiro} className="mt-2 flex flex-wrap gap-2">
                <input type="hidden" name="reserva" value={sinCodigo.id} />
                <input name="texto" maxLength={1000} placeholder="Contanos qué pasó (opcional)" className="campo min-w-0 flex-1" />
                <BotonEnviar enviando="Enviando…" className="rounded-xl border border-white/50 px-4 py-2 font-semibold hover:bg-white/10">
                  No lo retiré
                </BotonEnviar>
              </form>
            ) : null}
          </div>
        ) : null}

        {abiertas.length ? (
          <>
            <p className="mt-3 text-xs text-white/75">
              📍 {c?.direccion}
              {c?.lat != null && c?.lng != null ? (
                <>
                  {" · "}
                  <ComoLlegar lat={c.lat} lng={c.lng} className="underline" />
                </>
              ) : null}
            </p>
            <Conversacion
              reserva={r.id}
              yo={usuario!.id}
              otro="el comercio"
              iniciales={g.flatMap((x) => x.mensajes)}
              abierta
              sinLeer={g.reduce((n, x) => n + (mensajesSinLeer.get(x.id) ?? 0), 0)}
            />
            <form action={cancelar} className="mt-3 text-right">
              {abiertas.map((x) => (
                <input key={x.id} type="hidden" name="reserva" value={x.id} />
              ))}
              <BotonEnviar enviando="Cancelando…" className="text-xs text-white/70 underline hover:text-white">
                {esPedido ? "Cancelar el pedido" : "Cancelar reserva"}
              </BotonEnviar>
            </form>
          </>
        ) : null}

        {retirada ? (
          retirada.resena ? (
            <div className="mt-3 rounded-xl border border-white/25 p-3 text-sm">
              <p className="text-xs text-white/75">Tu reseña</p>
              <Estrellas valor={retirada.resena.estrellas} />
              {retirada.resena.texto ? <p className="mt-1">{retirada.resena.texto}</p> : null}
              {retirada.resena.respuesta ? (
                <div className="mt-2 rounded-lg border-l-2 border-naranja-vivo bg-white/5 p-2">
                  <p className="text-xs font-semibold text-white/80">Respuesta de {c?.nombre}</p>
                  <p className="mt-0.5">{retirada.resena.respuesta}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <FormResena reserva={retirada.id} />
          )
        ) : null}
      </article>
    );
  }

  return (
    <>
      {typeof error === "string" ? (
        <p role="alert" className="mb-4 rounded-2xl border border-naranja bg-naranja/10 p-4 text-sm">
          {error}
        </p>
      ) : null}
      {nueva ? <ReservaNueva reserva={lista.find((r) => String(r.id) === nueva)} /> : null}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Mis reservas</h1>
          <p className="text-sm text-marino/80">Retirás en el local, en el horario que elegiste, y pagás ahí.</p>
        </div>
        {total ? (
          <div className="tarjeta rounded-2xl px-4 py-2 text-right">
            <p className="text-[11px] text-white/80">A pagar al retirar</p>
            <p className="text-lg font-black">{plata(total)}</p>
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
        <div className="space-y-6">
          {enCurso.length === 0 ? (
            <p className="tarjeta rounded-2xl p-4 text-sm">No tenés reservas en curso. Abajo está tu historial.</p>
          ) : null}
          {secciones
            .filter(([, gs]) => gs.length)
            .map(([titulo, gs]) => (
              <section key={titulo} aria-label={titulo.replace(/^\S+ /, "")}>
                <h2 className="titulo-seccion mb-2 px-1 text-marino">
                  {titulo} <span className="text-base font-normal text-marino/60">({gs.length})</span>
                </h2>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {gs.map(tarjeta)}
                </div>
              </section>
            ))}
          {historial.length ? (
            <details className="group" open={enCurso.length === 0}>
              <summary className="titulo-seccion cursor-pointer px-1 text-marino">
                🗂️ Historial <span className="text-base font-normal text-marino/60">({historial.length})</span>
              </summary>
              <div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {historial.map(tarjeta)}
              </div>
            </details>
          ) : null}
        </div>
      )}
    </>
  );
}

// Cartel que se ve apenas se hace una reserva, con el camino para seguir
// comprando en el mismo comercio o volver al inicio.
function ReservaNueva({
  reserva,
}: {
  reserva?: { producto_nombre: string; cantidad: number; retiro: string; retiro_ya: boolean; comercio: { id: number; nombre: string } | null };
}) {
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
        {reserva?.retiro_ya
          ? "Ya quedó confirmada: andá al local con el código que ves acá abajo. Pagás al retirar."
          : "Ahora el comercio tiene que confirmar que lo tiene. Te avisamos y vas a ver el estado acá abajo. Pagás en el local al retirar."}
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
