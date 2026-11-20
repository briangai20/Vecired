import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { disponibilidad, fechaAR, plata, totalReserva } from "@/lib/formato";
import { usuarioActual } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import type { Enum, Tabla } from "@/lib/supabase/tipos";
import { reactivarComercio } from "@/app/cuenta/acciones";
import { FormOferta } from "./form-oferta";
import { HerramientasProductos } from "./herramientas-productos";
import { CancelarReprogramada } from "./cancelar-reprogramada";
import { MotivoBaja } from "./motivo-baja";
import { SelectorProductos } from "./selector-productos";
import { CamposPromo } from "./campos-promo";
import { descuento, hastaCorto } from "@/lib/ofertas";
import { agregarCierre, borrarCierre, borrarOferta, productosDeOferta, borrarPreguntaComercio, darDeBajaComercio, cambiarReserva, marcarNoVino, ofrecerAlternativas, responderPregunta, responderResena } from "./acciones";

const fechaCorta = (f: string) => `${Number(f.slice(8))}/${Number(f.slice(5, 7))}`;

// El panel se divide en pestañas (?seccion=): lo del día a día (reservas)
// queda separado de la configuración del comercio.
const SECCIONES = { reservas: "Reservas", productos: "Productos", preguntas: "Preguntas", ofertas: "Ofertas", resenas: "Reseñas", configuracion: "Configuración del comercio" } as const;
type Seccion = keyof typeof SECCIONES;
import { FormComercio } from "./form-comercio";
import { BorrarRespuesta } from "./borrar-respuesta";
import { FotosEnLote } from "./fotos-en-lote";
import { ImportarProductos } from "./importar-productos";
import { ProductoFila } from "./producto-fila";
import { LogoComercio } from "@/components/logo-comercio";
import { BotonEnviar } from "@/components/boton-enviar";
import { AvisosCelular } from "@/components/avisos-celular";
import { Conversacion } from "@/components/conversacion";
import { BotonesReserva, ConfirmarRetiro, EstadoReserva, ReservaEnVivo, SiEstado } from "./reserva-en-vivo";
import { FotoPerfil } from "@/components/foto-perfil";
import { Estrellas } from "@/components/insignias";
import { enlaceWhatsapp, numeroWhatsapp } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Panel del comerciante" };

export default function PaginaComerciante({ searchParams }: PageProps<"/comerciante">) {
  return (
    <Suspense fallback={<div className="tarjeta h-96 animate-pulse rounded-3xl" />}>
      <Panel searchParams={searchParams} />
    </Suspense>
  );
}

// Todo lo que se puede editar de un producto: si algo cambia, su formulario se
// vuelve a armar con los valores nuevos.
const claveProducto = (p: Tabla<"productos">) =>
  [p.id, p.actualizado_en, p.nombre, p.precio, p.stock, p.modo, p.semaforo, p.activo, p.marca, p.medida, p.material, p.grupo, p.codigo, p.descripcion, p.foto_url, (p.fotos ?? []).length].join("|");

const ESTADOS: Record<Enum<"estado_reserva">, string> = {
  pendiente: "Para responder",
  alternativa: "Esperando al cliente",
  aceptada: "Aceptada: falta retirar",
  retirada: "Retirada",
  no_retirada: "No retirada (volvió al stock)",
  rechazada: "Rechazada",
  cancelada: "Cancelada por el cliente",
  vencida: "Vencida",
};

async function Panel({ searchParams }: Pick<PageProps<"/comerciante">, "searchParams">) {
  const usuario = await usuarioActual();
  const { error: errorAccion, seccion: seccionParam } = await searchParams;
  const seccion: Seccion = typeof seccionParam === "string" && seccionParam in SECCIONES ? (seccionParam as Seccion) : "reservas";

  if (!usuario) {
    return (
      <div className="tarjeta mx-auto max-w-xl rounded-3xl p-8 text-center">
        <h1 className="text-2xl font-bold">Sumá tu comercio a VeciRed</h1>
        <p className="mt-2 text-sm text-white/85">
          Publicá tus productos con precio y stock, recibí reservas de vecinos de tu zona y que te retiren en el local. Los primeros 3 meses son gratis.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/ingresar?modo=crear&siguiente=/comerciante" className="boton rounded-xl px-5 py-2.5 text-sm font-semibold">
            Crear cuenta de comerciante
          </Link>
          <Link href="/ingresar?siguiente=/comerciante" className="rounded-xl border border-white/40 px-5 py-2.5 text-sm hover:bg-white/10">
            Ya tengo cuenta
          </Link>
        </div>
        <Link href="/comercios" className="mt-4 inline-block rounded-xl border border-white/30 px-4 py-2 text-sm transition hover:border-white/60 hover:bg-white/10">
          Conocé cómo funciona y cuánto cuesta
        </Link>
      </div>
    );
  }

  if (usuario.rol !== "comerciante") {
    return (
      <div className="tarjeta mx-auto max-w-xl rounded-3xl p-8 text-center">
        <h1 className="text-xl font-bold">Tu cuenta es de comprador</h1>
        <p className="mt-2 text-sm text-white/85">
          Para publicar un comercio necesitás una cuenta de comerciante. Salí y creá una nueva con otro mail, o escribinos para cambiar la tuya.
        </p>
      </div>
    );
  }

  const supabase = await supabaseServidor();
  const [{ data: comercio }, { data: zonas }] = await Promise.all([
    supabase.from("comercios").select("*").eq("dueno_id", usuario.id).order("id").limit(1).maybeSingle(),
    supabase.from("zonas").select("*").order("nombre"),
  ]);

  if (comercio?.dado_de_baja_en) {
    return (
      <div className="tarjeta mx-auto max-w-xl rounded-3xl p-8 text-center">
        <h1 className="text-2xl font-bold">{comercio.nombre} está dado de baja</h1>
        <p className="mt-2 text-sm text-white/85">
          Nadie lo ve en VeciRed, pero guardamos tus productos y datos. Podés seguir usando tu cuenta para reservar como cualquier vecino, o volver a
          publicarlo cuando quieras.
        </p>
        <form action={reactivarComercio} className="mt-6">
          <BotonEnviar enviando="Reactivando…" className="boton rounded-xl px-5 py-2.5 text-sm font-semibold">
            Reactivar mi comercio
          </BotonEnviar>
        </form>
      </div>
    );
  }

  if (!comercio) {
    return (
      <div className="tarjeta rounded-3xl p-6">
        <h1 className="text-2xl font-bold">Hola{usuario.nombre ? `, ${usuario.nombre.split(" ")[0]}` : ""}. Cargá tu comercio</h1>
        <p className="mt-1 mb-6 text-sm text-white/85">Con estos datos te encuentran los vecinos. Después cargás los productos.</p>
        <FormComercio comercio={null} zonas={zonas ?? []} franjas={[]} />
      </div>
    );
  }

  const ahora = new Date();
  const [{ data: productos }, { data: reservas }, { data: stats }, { data: statsSemana }, { data: franjas }, { data: cierres }, { data: feriados }, { data: verificacion }, { data: resenas }, { data: preguntas }, { data: misOfertas }, { data: avisosMensajes }] = await Promise.all([
    supabase.from("productos").select("*").eq("comercio_id", comercio.id).order("nombre"),
    supabase
      .from("reservas")
      .select("*, comprador:perfiles!reservas_comprador_id_fkey(nombre, telefono, foto_url), alternativas:reserva_alternativas(producto:productos(nombre)), mensajes(id, autor_id, texto, creado_en)")
      .eq("comercio_id", comercio.id)
      .order("creada_en", { ascending: false })
      .limit(30),
    // Desde siempre (no se borran) y, aparte, lo de los últimos 7 días.
    supabase.rpc("estadisticas_comercio", { p_comercio: comercio.id, p_desde: "2000-01-01T00:00:00Z" }),
    supabase.rpc("estadisticas_comercio", { p_comercio: comercio.id }),
    supabase.from("horarios").select("*").eq("comercio_id", comercio.id),
    supabase.from("cierres").select("*").eq("comercio_id", comercio.id).gte("hasta", fechaAR(ahora)).order("desde"),
    supabase.from("feriados").select("*").neq("tipo", "puente").gte("fecha", fechaAR(ahora)).lte("fecha", fechaAR(ahora, 90)).order("fecha"),
    supabase.from("verificaciones_comercio").select("*").eq("comercio_id", comercio.id).maybeSingle(),
    supabase
      .from("resenas")
      .select("id, estrellas, texto, autor_nombre, autor_foto_url, creada_en, respuesta, respuesta_borrada_en")
      .eq("comercio_id", comercio.id)
      .order("creada_en", { ascending: false })
      .limit(50),
    supabase
      .from("preguntas")
      .select("id, texto, creada_en, respuesta, respuesta_borrada_en, producto:productos(id, nombre)")
      .eq("comercio_id", comercio.id)
      .order("creada_en", { ascending: false })
      .limit(100),
    supabase
      .from("ofertas")
      .select("id, hasta, titulo, imagen_url, precio_oferta, promo, lleva, paga, porcentaje, producto:productos!ofertas_producto_id_fkey(id, nombre, precio), oferta_productos(producto_id)")
      .eq("comercio_id", comercio.id)
      .order("hasta", { ascending: false })
      .limit(50),
    // Mensajes de clientes sin leer: un aviso "Mensaje de…" por mensaje.
    supabase
      .from("notificaciones")
      .select("enlace")
      .eq("usuario_id", usuario.id)
      .is("leida_en", null)
      .like("titulo", "Mensaje de %")
      .limit(200),
  ]);
  const mensajesSinLeer = new Map<number, number>();
  for (const a of avisosMensajes ?? []) {
    const id = Number(/#reserva-(\d+)$/.exec(a.enlace ?? "")?.[1]);
    if (id) mensajesSinLeer.set(id, (mensajesSinLeer.get(id) ?? 0) + 1);
  }
  const sinResponder = (resenas ?? []).filter((r) => !r.respuesta && !r.respuesta_borrada_en).length;
  // Primero las que esperan respuesta.
  const cerrada = (q: { respuesta: string | null; respuesta_borrada_en: string | null }) => !!q.respuesta || !!q.respuesta_borrada_en;
  const listaPreguntas = [...(preguntas ?? [])].sort((a, b) => Number(cerrada(a)) - Number(cerrada(b)));
  const preguntasSinResponder = listaPreguntas.filter((q) => !cerrada(q)).length;
  const s = stats?.[0];
  const semana = statsSemana?.[0];
  const enCurso = (e: string) => e === "pendiente" || e === "alternativa" || e === "aceptada";
  const abiertas = (reservas ?? []).filter((r) => enCurso(r.estado));
  const cerradas = (reservas ?? []).filter((r) => !enCurso(r.estado));
  // Las reservas del mismo pedido del carrito van juntas en una tarjeta.
  const grupos: (typeof abiertas)[] = [];
  for (const r of [...abiertas].sort((x, y) => x.id - y.id)) {
    const g = r.pedido ? grupos.find((x) => x[0].pedido === r.pedido) : undefined;
    if (g) g.push(r);
    else grupos.push([r]);
  }
  grupos.sort((x, y) => y[0].id - x[0].id);
  const totalMensajesSinLeer = abiertas.reduce((n, r) => n + (mensajesSinLeer.get(r.id) ?? 0), 0);

  // Qué se le puede ofrecer en lugar de lo reservado: productos publicados,
  // con stock para esa cantidad, primero los del mismo grupo de variantes.
  const opciones = (productoId: number | null, cantidad: number) => {
    const original = (productos ?? []).find((p) => p.id === productoId);
    return (productos ?? [])
      .filter((p) => p.activo && p.id !== productoId)
      .filter((p) => {
        const d = disponibilidad(p, ahora);
        return d.sePuede && (p.modo !== "exacto" || (p.stock ?? 0) >= cantidad);
      })
      .sort((a, b) => Number(b.grupo != null && b.grupo === original?.grupo) - Number(a.grupo != null && a.grupo === original?.grupo));
  };

  return (
    <div className="space-y-6">
      {typeof errorAccion === "string" ? (
        <p role="alert" className="rounded-2xl border border-naranja bg-naranja/15 p-4 text-sm">
          {errorAccion}
        </p>
      ) : null}
      {!comercio.aprobado && comercio.motivo_rechazo ? (
        <div role="alert" className="rounded-2xl border border-naranja bg-naranja/15 p-4 text-sm">
          <p className="font-semibold">Todavía no pudimos publicar tu comercio.</p>
          <p className="mt-1">{comercio.motivo_rechazo}</p>
          <p className="mt-2">
            Corregilo en los datos del comercio y guardá: lo volvemos a revisar.
          </p>
          <Link href="/comerciante?seccion=configuracion#datos" className="mt-3 inline-block rounded-lg border border-white/30 px-3 py-1.5 text-xs font-medium transition hover:border-white/60 hover:bg-white/10">
            Ir a los datos del comercio
          </Link>
        </div>
      ) : !comercio.aprobado ? (
        <p className="rounded-2xl border border-naranja bg-naranja/10 p-4 text-sm">
          <span className="font-semibold">Tu comercio está en revisión.</span> Mientras tanto podés cargar productos; los vecinos lo van a ver cuando lo publiquemos.
        </p>
      ) : null}
      {!numeroWhatsapp(comercio.whatsapp) ? (
        <p role="alert" className="rounded-2xl border border-naranja bg-naranja/10 p-4 text-sm">
          <span className="font-semibold">Falta tu WhatsApp.</span> Sin él, los vecinos no pueden consultarte antes de reservar.
          <Link href="/comerciante?seccion=configuracion#datos" className="mt-3 block w-fit rounded-lg border border-white/30 px-3 py-1.5 text-xs font-medium transition hover:border-white/60 hover:bg-white/10">
            Cargalo en la configuración del comercio
          </Link>
        </p>
      ) : null}

      <div className="tarjeta rounded-3xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <LogoComercio url={comercio.logo_url} nombre={comercio.nombre} className="h-14 w-14 text-base" />
            <div className="min-w-0">
            <h1 className="text-2xl font-bold break-words">Panel de {comercio.nombre}</h1>
            <p className="text-sm text-white/80">
              {productos?.length ?? 0} productos · {comercio.direccion}
            </p>
            </div>
          </div>
          {comercio.aprobado ? (
            <Link href={`/comercio/${comercio.id}`} className="rounded-xl border border-white/40 px-4 py-2 text-sm hover:bg-white/10">
              Ver como cliente
            </Link>
          ) : null}
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          {/* Totales desde que empezó (no se borran); abajo, lo de la última semana. */}
          {(
            [
              ["Vistas", s?.total_vistas ?? 0, semana?.total_vistas ?? 0],
              ["Reservas", s?.total_reservas ?? 0, semana?.total_reservas ?? 0],
              ["Retiradas", s?.total_retiradas ?? 0, semana?.total_retiradas ?? 0],
              ["Valoración", s?.promedio_estrellas ? `${String(s.promedio_estrellas).replace(".", ",")} (${s.total_resenas})` : "Sin reseñas", null],
            ] as const
          ).map(([t, v, ultimos]) => (
            <div key={t} className="border-l-2 border-naranja-vivo/70 py-1 pl-3">
              <p className="text-xs text-white/75">{t}</p>
              <p className="mt-1 text-2xl font-black">{typeof v === "number" ? v.toLocaleString("es-AR") : v}</p>
              {ultimos != null ? <p className="text-[11px] text-white/65">+{ultimos.toLocaleString("es-AR")} esta semana</p> : null}
            </div>
          ))}
        </div>
        <Link
          href="/comerciante/estadisticas"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/15 active:bg-naranja/70"
        >
          📊 Ver estadísticas completas <span aria-hidden>›</span>
        </Link>
        <nav className="mt-6 grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-6" aria-label="Secciones del panel">
          {(Object.keys(SECCIONES) as Seccion[]).map((k) => {
            const pendientes =
              k === "reservas" ? abiertas.filter((r) => r.estado === "pendiente").length : k === "resenas" ? sinResponder : k === "preguntas" ? preguntasSinResponder : 0;
            return (
              <Link
                key={k}
                href={`/comerciante?seccion=${k}`}
                scroll={false}
                aria-current={k === seccion ? "page" : undefined}
                className={`flex items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-center text-sm font-medium leading-tight transition  ${k === seccion ? "text-naranja-vivo underline decoration-2 underline-offset-8" : "text-white/85 hover:text-naranja-vivo active:text-naranja-vivo"}`}
              >
                {k === "configuracion" ? (
                  <>
                    <span className="sm:hidden">Configuración</span>
                    <span className="hidden sm:inline">{SECCIONES[k]}</span>
                  </>
                ) : (
                  SECCIONES[k]
                )}
                {pendientes ? (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-naranja px-1.5 text-[11px] font-bold text-white" aria-label={`${pendientes} para responder`}>
                    {pendientes}
                  </span>
                ) : k === "productos" ? (
                  <span className="text-xs opacity-70">({productos?.length ?? 0})</span>
                ) : null}
                {k === "reservas" && totalMensajesSinLeer ? (
                  <span
                    className="grid h-5 min-w-5 place-items-center rounded-full bg-naranja px-1.5 text-[11px] font-bold text-white"
                    aria-label={`${totalMensajesSinLeer} mensajes sin leer`}
                    title={`${totalMensajesSinLeer} mensajes sin leer`}
                  >
                    💬 {totalMensajesSinLeer}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>

      {seccion === "reservas" ? (
      <section id="reservas" className="tarjeta rounded-3xl p-6">
        <h2 className="titulo-seccion">📦 Reservas</h2>
        <p className="info mt-2 text-sm">Respondé cada reserva dentro de las 2 horas de tu horario de atención: si no, vence sola. Las que llegan con el local cerrado empiezan a contar cuando abrís. Si el cliente no retira en el horario que eligió, puede elegir otro una sola vez antes de que cierres (te avisamos y podés cancelarla con un motivo); si no, la reserva se cancela sola y el producto vuelve a tu stock.</p>
        <AvisosCelular variante="panel" />
        {abiertas.length === 0 ? (
          <p className="mt-3 text-sm text-white/80">No tenés reservas para responder. Aparecen acá en cuanto un vecino reserve.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {grupos.map((g) => {
              const r = g[0];
              const esPedido = g.length > 1;
              const aceptadas = g.filter((x) => x.estado === "aceptada");
              const vencida = aceptadas.find((x) => x.retiro_hasta && new Date(x.retiro_hasta) < ahora);
              const reprogramada = aceptadas.find((x) => x.reprogramada_en);
              const aReprogramar = aceptadas.find((x) => x.reprogramar_hasta && !x.reprogramada_en);
              const sinCodigo = g.find((x) => x.retiro_sin_codigo);
              const totales = g.map((x) => totalReserva(x));
              const total = totales.some((t) => t == null) ? null : totales.reduce<number>((a, t) => a + (t ?? 0), 0);
              const sinLeer = g.reduce((n, x) => n + (mensajesSinLeer.get(x.id) ?? 0), 0);
              return (
                // Una tarjeta por pedido: si el cliente reservó varios productos con el
                // carrito, van todos juntos y se aceptan o rechazan de a uno.
                <article key={r.pedido ?? r.id} id={`reserva-${r.id}`} className="scroll-mt-24 rounded-2xl border border-white/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold">{esPedido ? `🛒 Pedido de ${g.length} productos` : `${r.producto_nombre} × ${r.cantidad}`}</p>
                      <p className="text-xs text-white/75">
                        Retira: {r.retiro} · {r.medio_pago === "online" ? "Pagó online" : "Paga en el local"}
                      </p>
                    </div>
                    {r.retiro_ya ? <span className="shrink-0 rounded-full bg-naranja px-2 py-0.5 text-[11px] font-bold">⚡ Retiro ya · ya aceptada</span> : null}
                  </div>
                  <Cliente comprador={r.comprador} producto={esPedido ? "tu pedido" : r.producto_nombre} comercio={comercio.nombre} />

                  {esPedido ? <p className="mt-3 text-xs text-white/80">Aceptá lo que tenés y rechazá o reemplazá lo que no. Con un solo código retira todo lo aceptado.</p> : null}
                  <ul className={esPedido ? "mt-2 divide-y divide-white/10 rounded-xl bg-white/5 px-3" : ""}>
                    {g.map((x) => (
                      <li key={x.id} id={esPedido ? `reserva-${x.id}` : undefined} className={esPedido ? "scroll-mt-24 py-3" : ""}>
                        <ReservaEnVivo reserva={x.id} estado={x.estado} etiquetas={ESTADOS} accion={cambiarReserva} pagoLocal={x.medio_pago === "local"}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 text-sm">
                              {esPedido ? (
                                <p className="font-semibold">
                                  {x.producto_nombre} × {x.cantidad}
                                </p>
                              ) : null}
                              <p className={esPedido ? "text-xs text-white/75" : "mt-2"}>
                                {esPedido ? "" : "Total: "}
                                <b>{plata(totalReserva(x))}</b>
                                {x.promo ? <span className="ml-2 rounded-full bg-naranja px-2 py-0.5 text-[11px] font-bold">{x.promo}</span> : null}
                              </p>
                            </div>
                            <EstadoReserva />
                          </div>
                          {x.estado === "alternativa" ? (
                            <p className="mt-2 text-xs text-white/85">
                              Le ofreciste: {x.alternativas.map((a) => a.producto?.nombre).filter(Boolean).join(", ")}. Si no elige, podés rechazarlo.
                            </p>
                          ) : null}
                          <BotonesReserva conRetiro={false} />
                          <SiEstado es="pendiente">
                            <details className="mt-2 text-sm">
                              <summary className="cursor-pointer text-xs text-white/85">No lo tengo: ofrecer otro producto</summary>
                              {opciones(x.producto_id, x.cantidad).length ? (
                                <form action={ofrecerAlternativas} className="mt-2 space-y-2">
                                  <input type="hidden" name="reserva" value={x.id} />
                                  <p className="text-xs text-white/75">Elegí uno o más productos. El cliente elige cuál le sirve o lo saca del pedido sin costo.</p>
                                  <SelectorProductos titulo="Productos para ofrecer" maximo={10} productos={opciones(x.producto_id, x.cantidad)} />
                                  <BotonEnviar enviando="Enviando…" className="boton w-full rounded-xl py-2 text-sm font-semibold">
                                    Ofrecer al cliente
                                  </BotonEnviar>
                                </form>
                              ) : (
                                <p className="mt-2 text-xs text-white/75">No tenés otros productos con stock para ofrecer. Podés rechazarlo.</p>
                              )}
                            </details>
                          </SiEstado>
                        </ReservaEnVivo>
                      </li>
                    ))}
                  </ul>

                  {esPedido ? (
                    <p className="mt-3 text-sm">
                      Total del pedido: <b>{plata(total)}</b>
                    </p>
                  ) : null}
                  {reprogramada ? (
                    <div className="info mt-2 text-xs">
                      <p>🔁 El cliente cambió el horario de retiro a <b>{reprogramada.retiro}</b>.</p>
                      <CancelarReprogramada reserva={reprogramada.id} />
                    </div>
                  ) : aReprogramar ? (
                    <p className="info mt-2 text-xs">⏰ Se le pasó el horario al cliente: tiene hasta el cierre para elegir otro, o la reserva se cancela sola.</p>
                  ) : null}
                  {sinCodigo ? (
                    <p className="info mt-2 text-xs">
                      Entregada sin código: {sinCodigo.retiro_sin_codigo}.
                      {sinCodigo.reclamo_en ? <b className="mt-1 block">⚠ El cliente dice que no la retiró{sinCodigo.reclamo ? `: “${sinCodigo.reclamo}”` : ""}. Lo vamos a revisar.</b> : null}
                    </p>
                  ) : null}
                  {/* Un solo código para retirar todo lo aceptado. */}
                  {aceptadas.length ? (
                    <div className="mt-3">
                      {esPedido ? (
                        <p className="text-xs font-semibold">
                          Retiro: {aceptadas.length} de {g.length} productos aceptados
                        </p>
                      ) : null}
                      <ConfirmarRetiro reserva={aceptadas[0].id} pagoLocal={aceptadas[0].medio_pago === "local"} />
                    </div>
                  ) : null}
                  {vencida ? (
                    <form action={marcarNoVino} className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <input type="hidden" name="reserva" value={vencida.id} />
                      <span className="text-white/80">¿No vino en su horario?</span>
                      <BotonEnviar enviando="Cerrando…" className="rounded-lg border border-white/40 px-3 py-1.5 font-semibold hover:bg-white/10">
                        {esPedido ? "No vino: cerrar el pedido y devolver el stock" : "No vino: cerrar y devolver el stock"}
                      </BotonEnviar>
                    </form>
                  ) : null}
                  <Conversacion reserva={r.id} yo={usuario.id} otro="el cliente" iniciales={g.flatMap((x) => x.mensajes)} abierta sinLeer={sinLeer} />
                </article>
              );
            })}
          </div>
        )}
        {cerradas.length ? (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-white/80">Historial ({cerradas.length})</summary>
            <ul className="mt-2 divide-y divide-white/10">
              {cerradas.map((r) => (
                <li key={r.id} className="flex justify-between gap-3 py-2">
                  <span>
                    {r.producto_nombre} × {r.cantidad} · {r.comprador?.nombre || "Cliente"}
                  </span>
                  <span className="text-white/70">{ESTADOS[r.estado]}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>
      ) : null}

      {seccion === "productos" ? (
      <section id="productos" className="tarjeta rounded-3xl p-6">
        <h2 className="titulo-seccion">🛍️ Productos</h2>
        <p className="info mt-2 text-sm">
          Mantené el stock al día: si no lo tocás en 7 días (3 si usás hay/poco), el producto aparece como &quot;Stock sin confirmar&quot;.
        </p>
        <details className="mt-4 border-t border-white/15 pt-4" open={!(productos ?? []).length}>
          <summary className="cursor-pointer font-semibold">Cargar o actualizar desde Excel</summary>
          <div className="mt-3">
            <ImportarProductos comercioId={comercio.id} existentes={(productos ?? []).map((p) => ({ id: p.id, codigo: p.codigo, nombre: p.nombre }))} />
          </div>
        </details>
        {(productos ?? []).length ? (
          <details className="mt-4 border-t border-white/15 pt-4" id="fotos">
            <summary className="cursor-pointer font-semibold">
              Cargar fotos de varios productos
              {(() => {
                const sin = (productos ?? []).filter((p) => !p.foto_url).length;
                return sin ? <span className="font-normal text-white/70"> · {sin} sin foto</span> : null;
              })()}
            </summary>
            <div className="mt-3">
              <FotosEnLote
                comercioId={comercio.id}
                productos={(productos ?? []).map((p) => ({ id: p.id, codigo: p.codigo, nombre: p.nombre, foto_url: p.foto_url }))}
              />
            </div>
          </details>
        ) : null}
        {/* Cada parte se abre al tocar el título, para que la sección no sea larguísima. */}
        <details className="mt-4 border-t border-white/15 pt-4" open={!(productos ?? []).length}>
          <summary className="cursor-pointer font-semibold">➕ Agregar un producto a mano</summary>
          <ProductoFila comercioId={comercio.id} ahora={ahora} />
        </details>
        {(productos ?? []).length ? (
          <details className="mt-4 border-t border-white/15 pt-4" id="stock">
            <summary className="cursor-pointer font-semibold">
              📦 Control de stock
              <span className="font-normal text-white/70"> · {(productos ?? []).length} productos</span>
            </summary>
            <p className="mt-2 text-xs text-white/75">Buscá un producto o filtralo, cambiá el stock o el precio y guardá. Con las casillas cambiás varios de una vez.</p>
            <div className="mt-3">
              <HerramientasProductos
                items={(productos ?? []).map((p) => {
                  const d = disponibilidad(p, ahora);
                  return {
                    id: p.id,
                    texto: [p.nombre, p.marca, p.codigo, p.grupo, p.medida, p.material].filter(Boolean).join(" "),
                    marca: p.marca?.trim() ?? "",
                    grupo: p.grupo?.trim() ?? "",
                    activo: p.activo ? "1" : "0",
                    stock: d.texto === "Stock sin confirmar" ? "sin-confirmar" : d.tono === "no" ? "sin-stock" : d.tono === "poco" ? "poco" : "ok",
                    foto: p.foto_url ? "1" : "0",
                  } as const;
                })}
              >
                {(productos ?? []).map((p) => (
                  // La clave cambia con los datos guardados: así, al guardar (uno, varios o
                  // en bloque) los campos muestran enseguida lo nuevo, sin recargar.
                  <ProductoFila key={claveProducto(p)} p={p} comercioId={comercio.id} ahora={ahora} />
                ))}
              </HerramientasProductos>
            </div>
          </details>
        ) : null}
      </section>
      ) : null}

      {seccion === "preguntas" ? (
      <section id="preguntas" className="tarjeta rounded-3xl p-6">
        <h2 className="titulo-seccion">💬 Preguntas de los vecinos</h2>
        <p className="info mt-2 text-sm">
          Lo que preguntan en la página de tus productos. Respondé rápido: la pregunta y tu respuesta quedan a la vista de todos y le avisamos al vecino. Se responde una sola vez: no se puede modificar, solo borrar. Si una pregunta es ofensiva o no tiene que ver, podés borrarla.
        </p>
        {listaPreguntas.length ? (
          <div className="mt-4 divide-y divide-white/15">
            {listaPreguntas.map((q) => (
              <article key={q.id} className={`rounded-2xl border p-4 ${cerrada(q) ? "border-white/20" : "border-naranja-vivo/70"}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-white/70">
                  {q.producto ? (
                    <Link href={`/producto/${q.producto.id}#preguntas`} className="font-semibold text-white underline-offset-2 hover:underline">
                      {q.producto.nombre}
                    </Link>
                  ) : null}
                  <span>{new Date(q.creada_en).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}</span>
                </div>
                <p className="mt-2 text-sm break-words">“{q.texto}”</p>
                {q.respuesta ? (
                  <div className="mt-3 rounded-lg border-l-2 border-naranja-vivo bg-white/5 p-2 text-sm">
                    <p className="text-xs font-semibold text-white/80">Tu respuesta</p>
                    <p className="mt-0.5 break-words">{q.respuesta}</p>
                  </div>
                ) : q.respuesta_borrada_en ? (
                  <p className="mt-3 text-xs text-white/65">Borraste tu respuesta: esta pregunta ya no se puede volver a responder.</p>
                ) : null}
                <form action={responderPregunta} className="mt-3 space-y-2">
                  <input type="hidden" name="pregunta" value={q.id} />
                  {cerrada(q) ? null : (
                    <label className="block text-xs text-white/80">
                      Tu respuesta <span className="text-white/60">(se envía una sola vez: después no se puede modificar, solo borrar)</span>
                      <textarea name="respuesta" required maxLength={1000} rows={2} className="campo mt-1" placeholder="¡Hola! Sí, lo tenemos. Te esperamos." />
                    </label>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    {cerrada(q) ? null : (
                      <BotonEnviar enviando="Enviando…" className="boton rounded-xl px-4 py-2 text-sm font-semibold">
                        Responder
                      </BotonEnviar>
                    )}
                    {q.respuesta ? <BorrarRespuesta accion={responderPregunta} campo="pregunta" id={q.id} que="pregunta" /> : null}
                    <BotonEnviar
                      formAction={borrarPreguntaComercio}
                      name="borrar"
                      value="1"
                      enviando="Borrando…"
                      className="rounded-lg border border-white/30 px-3 py-1.5 text-xs font-medium transition hover:border-white/60 hover:bg-white/10 text-white/80"
                    >
                      Borrar pregunta
                    </BotonEnviar>
                  </div>
                </form>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-white/80">Todavía no te hicieron preguntas. Aparecen acá cuando un vecino pregunta en la página de un producto.</p>
        )}
      </section>
      ) : null}

      {seccion === "ofertas" ? (
      <section id="ofertas" className="tarjeta rounded-3xl p-6">
        <h2 className="titulo-seccion">🔥 Ofertas</h2>
        <p className="info mt-2 text-sm">
          Aparecen arriba de todo en la portada (van pasando solas) y en la sección Ofertas. Si es un producto rebajado, la reserva se hace al precio de
          oferta mientras esté vigente. Podés tener hasta 10 a la vez, de hasta 60 días.
        </p>
        <FormOferta
          comercioId={comercio.id}
          productos={(productos ?? []).filter((p) => p.activo).map((p) => ({ id: p.id, nombre: p.nombre, precio: p.precio }))}
          hoy={fechaAR(ahora)}
          maximo={fechaAR(ahora, 60)}
        />
        <h3 className="mt-6 text-sm font-semibold">Tus ofertas</h3>
        {misOfertas?.length ? (
          <ul className="mt-2 divide-y divide-white/15">
            {misOfertas.map((o) => {
              const vencida = o.hasta < fechaAR(ahora);
              const menos = o.producto ? descuento(o.producto.precio, o.precio_oferta) : null;
              return (
                <li key={o.id} className={`flex flex-wrap items-center justify-between gap-3 py-3 text-sm ${vencida ? "opacity-60" : ""}`}>
                  <div className="min-w-0">
                    <p className="font-semibold break-words">
                      {o.producto ? o.producto.nombre : o.titulo}
                      {menos ? <span className="ml-2 rounded-full bg-naranja px-2 py-0.5 text-[11px] font-black">-{menos}%</span> : null}
                    </p>
                    <p className="text-xs text-white/75">
                      {o.producto ? `${plata(o.precio_oferta)} (normal ${plata(o.producto.precio)}) · ` : "Aviso libre · "}
                      {vencida ? "Vencida" : hastaCorto(o.hasta)}
                      {!o.producto ? ` · ${o.oferta_productos.length} ${o.oferta_productos.length === 1 ? "producto" : "productos"}` : ""}
                    </p>
                    {!o.producto && !vencida ? (
                      <details className="mt-2" open={!o.oferta_productos.length}>
                        <summary className="cursor-pointer text-xs font-semibold text-naranja-vivo">
                          {o.oferta_productos.length ? "Cambiar los productos y la promo" : "Elegí los productos y la promo"}
                        </summary>
                        <form action={productosDeOferta} className="mt-2 space-y-2">
                          <input type="hidden" name="oferta" value={o.id} />
                          <SelectorProductos
                            productos={(productos ?? []).filter((p) => p.activo).map((p) => ({ id: p.id, nombre: p.nombre, precio: p.precio }))}
                            elegidos={o.oferta_productos.map((x) => x.producto_id)}
                          />
                          <CamposPromo inicial={{ promo: o.promo, lleva: o.lleva, paga: o.paga, porcentaje: o.porcentaje }} />
                          <BotonEnviar enviando="Guardando…" className="boton rounded-xl px-4 py-2 text-xs font-semibold">
                            Guardar
                          </BotonEnviar>
                        </form>
                      </details>
                    ) : null}
                  </div>
                  <form action={borrarOferta}>
                    <input type="hidden" name="oferta" value={o.id} />
                    <BotonEnviar enviando="Borrando…" className="rounded-lg px-3 py-1.5 text-xs font-medium text-white/85 transition hover:bg-white/10 active:bg-naranja/70">
                      Borrar
                    </BotonEnviar>
                  </form>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-white/75">Todavía no cargaste ofertas.</p>
        )}
      </section>
      ) : null}

      {seccion === "resenas" ? (
      <section id="resenas" className="tarjeta rounded-3xl p-6">
        <h2 className="titulo-seccion">⭐ Reseñas</h2>
        <p className="info mt-2 text-sm">
          Lo que opinan tus clientes después de retirar. Respondé con amabilidad: tu respuesta se ve en tu página, debajo de la reseña, y le avisamos al cliente. Se responde una sola vez: no se puede modificar, solo borrar.
        </p>
        {resenas?.length ? (
          <div className="mt-4 divide-y divide-white/15">
            {resenas.map((r) => (
              <article key={r.id} className="py-4">
                <div className="flex items-center gap-3">
                  <FotoPerfil url={r.autor_foto_url} nombre={r.autor_nombre} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{r.autor_nombre}</p>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Estrellas valor={r.estrellas} />
                      <span className="text-xs text-white/70">{new Date(r.creada_en).toLocaleDateString("es-AR")}</span>
                    </div>
                  </div>
                </div>
                {r.texto ? <p className="mt-3 text-sm">{r.texto}</p> : <p className="mt-3 text-sm text-white/60">Sin comentario.</p>}
                {r.respuesta ? (
                  <>
                    <div className="mt-3 rounded-lg border-l-2 border-naranja-vivo bg-white/5 p-2 text-sm">
                      <p className="text-xs font-semibold text-white/80">Tu respuesta</p>
                      <p className="mt-0.5 break-words">{r.respuesta}</p>
                    </div>
                    <div className="mt-2">
                      <BorrarRespuesta accion={responderResena} campo="resena" id={r.id} que="reseña" />
                    </div>
                  </>
                ) : r.respuesta_borrada_en ? (
                  <p className="mt-3 text-xs text-white/65">Borraste tu respuesta: esta reseña ya no se puede volver a responder.</p>
                ) : (
                  <form action={responderResena} className="mt-3 space-y-2">
                    <input type="hidden" name="resena" value={r.id} />
                    <label className="block text-xs text-white/80">
                      Tu respuesta <span className="text-white/60">(se envía una sola vez: después no se puede modificar, solo borrar)</span>
                      <textarea name="respuesta" required maxLength={1000} rows={2} className="campo mt-1" placeholder="¡Gracias por venir! Te esperamos de nuevo." />
                    </label>
                    <BotonEnviar enviando="Enviando…" className="boton rounded-xl px-4 py-2 text-sm font-semibold">
                      Responder
                    </BotonEnviar>
                  </form>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-white/80">Todavía no tenés reseñas. Aparecen cuando un cliente retira su reserva y califica tu comercio.</p>
        )}
      </section>
      ) : null}

      {seccion === "configuracion" ? (
      <>
      <section id="datos" className="tarjeta rounded-3xl p-6">
        <h2 className="titulo-seccion mb-1">🏪 Datos del comercio</h2>
        <p className="info mt-2 mb-4 text-sm">Nombre, dirección, WhatsApp, logo, verificación, horario de atención y ubicación en el mapa.</p>
        <FormComercio comercio={comercio} zonas={zonas ?? []} franjas={franjas ?? []} verificacion={verificacion} />
      </section>

      <section id="cierres" className="tarjeta rounded-3xl p-6">
        <h2 className="titulo-seccion">📅 Días que cerrás</h2>
        <p className="info mt-2 text-sm">
          Vacaciones, inventario o cualquier día que no abras. Esos días figurás cerrado y las reservas esperan a que vuelvas a abrir.
        </p>
        {(cierres ?? []).length ? (
          <ul className="mt-3 space-y-2">
            {(cierres ?? []).map((ci) => (
              <li key={ci.id} className="flex items-center justify-between gap-3 border-b border-white/10 py-2 text-sm">
                <span>
                  {fechaCorta(ci.desde)}
                  {ci.hasta !== ci.desde ? ` al ${fechaCorta(ci.hasta)}` : ""}
                  {ci.motivo ? ` · ${ci.motivo}` : ""}
                </span>
                <form action={borrarCierre}>
                  <input type="hidden" name="id" value={ci.id} />
                  <BotonEnviar enviando="Quitando…" className="rounded-lg border border-white/30 px-3 py-1.5 text-xs font-medium transition hover:border-white/60 hover:bg-white/10">
                    Quitar
                  </BotonEnviar>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
        <form action={agregarCierre} className="mt-4 grid gap-3 sm:grid-cols-4">
          <input type="hidden" name="comercio_id" value={comercio.id} />
          <label className="block text-xs">
            Desde
            <input type="date" name="desde" required min={fechaAR(ahora)} className="campo mt-1" />
          </label>
          <label className="block text-xs">
            Hasta (si es más de un día)
            <input type="date" name="hasta" min={fechaAR(ahora)} className="campo mt-1" />
          </label>
          <label className="block text-xs">
            Motivo (opcional)
            <input name="motivo" maxLength={80} placeholder="Vacaciones" className="campo mt-1" />
          </label>
          <BotonEnviar enviando="Agregando…" className="boton self-end rounded-xl px-4 py-2.5 text-sm font-semibold">
            Agregar cierre
          </BotonEnviar>
        </form>
        <p className="mt-4 text-xs text-white/75">
          Próximos feriados nacionales{comercio.abre_feriados ? " (marcaste que abrís los feriados)" : " (figurás cerrado; si abrís, marcalo en el horario)"}:{" "}
          {(feriados ?? []).map((f) => `${fechaCorta(f.fecha)} ${f.nombre}`).join(" · ") || "no hay en los próximos 3 meses"}.
        </p>
      </section>
      <section id="baja" className="tarjeta scroll-mt-28 rounded-3xl p-6">
        <h2 className="titulo-seccion">🚪 Dar de baja el comercio</h2>
        <p className="info mt-2 text-sm">
          Si ya no vas a vender por VeciRed, podés dar de baja el comercio sin borrar tu cuenta: vas a seguir pudiendo reservar como cualquier vecino.
          El comercio y sus productos dejan de verse, pero quedan guardados para reactivarlo cuando quieras desde “Mi perfil”. Las reservas en curso se
          cancelan y les avisamos a los clientes.
        </p>
        <form action={darDeBajaComercio} className="mt-4 space-y-4">
          <MotivoBaja />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="confirmo" value="si" required className="mt-1" />
            Entiendo que {comercio.nombre} deja de verse y que se cancelan las reservas en curso.
          </label>
          <BotonEnviar enviando="Dando de baja…" className="rounded-xl border border-[#ff6b6b] px-4 py-2.5 text-sm font-semibold text-[#ffb4b4] transition hover:bg-[#ff6b6b]/15">
            Dar de baja mi comercio
          </BotonEnviar>
        </form>
      </section>
      </>
      ) : null}
    </div>
  );
}

// Quién hizo la reserva: foto, nombre y cómo contactarlo.
function Cliente({
  comprador,
  producto,
  comercio,
}: {
  comprador: { nombre: string; telefono: string | null; foto_url: string | null } | null;
  producto: string;
  comercio: string;
}) {
  const nombre = comprador?.nombre || "Cliente";
  const whatsapp = enlaceWhatsapp(comprador?.telefono, `Hola ${nombre.split(" ")[0]}, te escribimos de ${comercio} por tu reserva de "${producto}" en VeciRed.`);
  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl bg-white/5 p-3">
      <FotoPerfil url={comprador?.foto_url} nombre={nombre} className="h-12 w-12 text-base" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold break-words">{nombre}</p>
        {comprador?.telefono ? (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/80">
            <span>{comprador.telefono}</span>
            {whatsapp ? (
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-white/30 px-3 py-1.5 font-medium text-white transition hover:border-white/60 hover:bg-white/10">
                WhatsApp
              </a>
            ) : null}
            <a href={`tel:${comprador.telefono.replace(/[^\d+]/g, "")}`} className="rounded-lg border border-white/30 px-3 py-1.5 font-medium text-white transition hover:border-white/60 hover:bg-white/10">
              Llamar
            </a>
          </div>
        ) : (
          <p className="text-xs text-white/70">No cargó teléfono</p>
        )}
      </div>
    </div>
  );
}
