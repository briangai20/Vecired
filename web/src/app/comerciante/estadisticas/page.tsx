import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { plata, totalReserva } from "@/lib/formato";
import { usuarioActual } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import type { Enum } from "@/lib/supabase/tipos";

export const metadata: Metadata = { title: "Estadísticas del comercio" };

export default function PaginaEstadisticas({ searchParams }: PageProps<"/comerciante/estadisticas">) {
  return (
    <Suspense fallback={<div className="tarjeta h-96 animate-pulse rounded-3xl" />}>
      <Estadisticas searchParams={searchParams} />
    </Suspense>
  );
}

const PERIODOS = { "7": "7 días", "30": "30 días", "90": "3 meses", "365": "1 año", todo: "Desde siempre" } as const;
type Periodo = keyof typeof PERIODOS;

const DIA = 86_400_000;
// Argentina no cambia de hora: siempre UTC−3.
const enAR = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3_600_000);
const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const num = (n: number) => n.toLocaleString("es-AR");
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);

type Reserva = {
  id: number;
  pedido: number | null;
  estado: Enum<"estado_reserva">;
  cantidad: number;
  precio_unitario: number | null;
  descuento: number;
  promo: string | null;
  producto_id: number | null;
  producto_nombre: string;
  comprador_id: string;
  creada_en: string;
  retiro_ya: boolean;
};

// Supabase devuelve hasta 1000 filas por consulta: pedimos de a páginas.
async function todas<T>(pedir: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null }>, tope = 20_000) {
  const filas: T[] = [];
  for (let i = 0; i < tope; i += 1000) {
    const { data } = await pedir(i, i + 999);
    filas.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return filas;
}

async function Estadisticas({ searchParams }: Pick<PageProps<"/comerciante/estadisticas">, "searchParams">) {
  const usuario = await usuarioActual();
  const { periodo: p } = await searchParams;
  const periodo: Periodo = typeof p === "string" && p in PERIODOS ? (p as Periodo) : "30";

  if (!usuario || usuario.rol !== "comerciante") {
    return (
      <div className="tarjeta mx-auto max-w-xl rounded-3xl p-8 text-center">
        <h1 className="text-xl font-bold">Estadísticas del comercio</h1>
        <p className="mt-2 text-sm text-white/85">Entrá con tu cuenta de comerciante para verlas.</p>
        <Link href="/ingresar?siguiente=/comerciante/estadisticas" className="boton mt-5 inline-block rounded-xl px-5 py-2.5 text-sm font-semibold">
          Ingresar
        </Link>
      </div>
    );
  }

  const supabase = await supabaseServidor();
  const { data: comercio } = await supabase.from("comercios").select("id, nombre, creado_en").eq("dueno_id", usuario.id).order("id").limit(1).maybeSingle();
  if (!comercio) {
    return (
      <div className="tarjeta mx-auto max-w-xl rounded-3xl p-8 text-center">
        <p className="font-semibold">Todavía no cargaste tu comercio.</p>
        <Link href="/comerciante" className="boton mt-4 inline-block rounded-xl px-5 py-2.5 text-sm font-semibold">
          Ir al panel
        </Link>
      </div>
    );
  }

  const ahora = new Date().getTime();
  const dias = periodo === "todo" ? null : Number(periodo);
  const desde = dias ? new Date(ahora - dias * DIA) : null;
  // Para comparar: el período anterior del mismo largo.
  const desdeAnterior = dias ? new Date(ahora - 2 * dias * DIA) : null;
  const filtro = desdeAnterior?.toISOString() ?? "2000-01-01T00:00:00Z";
  const filtroVistas = desde?.toISOString() ?? "2000-01-01T00:00:00Z";

  const [reservasTodas, vistas, { data: productos }, { data: resenas }, { data: preguntas }] = await Promise.all([
    todas<Reserva>((a, b) =>
      supabase
        .from("reservas")
        .select("id, pedido, estado, cantidad, precio_unitario, descuento, promo, producto_id, producto_nombre, comprador_id, creada_en, retiro_ya")
        .eq("comercio_id", comercio.id)
        .gte("creada_en", filtro)
        .order("id")
        .range(a, b),
    ),
    todas<{ creada_en: string; producto_id: number | null }>((a, b) =>
      supabase.from("vistas").select("creada_en, producto_id").eq("comercio_id", comercio.id).gte("creada_en", filtroVistas).order("id").range(a, b),
    ),
    supabase.from("productos").select("id, nombre, activo, modo, stock, semaforo").eq("comercio_id", comercio.id),
    supabase.from("resenas").select("estrellas, creada_en, respuesta").eq("comercio_id", comercio.id),
    supabase.from("preguntas").select("creada_en, respuesta").eq("comercio_id", comercio.id),
  ]);

  const enPeriodo = (iso: string) => !desde || new Date(iso) >= desde;
  const reservas = reservasTodas.filter((r) => enPeriodo(r.creada_en));
  const anteriores = desde ? reservasTodas.filter((r) => !enPeriodo(r.creada_en)) : null;

  // ---- Resumen ----
  const resumen = (rs: Reserva[]) => {
    const retiradas = rs.filter((r) => r.estado === "retirada");
    const pedidos = new Set(rs.map((r) => r.pedido ?? -r.id));
    const pedidosRetirados = new Set(retiradas.map((r) => r.pedido ?? -r.id));
    const ingresos = retiradas.reduce((t, r) => t + (totalReserva(r) ?? 0), 0);
    return {
      ingresos,
      pedidos: pedidos.size,
      pedidosRetirados: pedidosRetirados.size,
      ticket: pedidosRetirados.size ? ingresos / pedidosRetirados.size : 0,
      unidades: retiradas.reduce((t, r) => t + r.cantidad, 0),
      clientes: new Set(rs.map((r) => r.comprador_id)).size,
    };
  };
  const ya = resumen(reservas);
  const antes = anteriores ? resumen(anteriores) : null;

  const cuenta = (e: Enum<"estado_reserva">) => reservas.filter((r) => r.estado === e).length;
  const estados = {
    retirada: cuenta("retirada"),
    aceptada: cuenta("aceptada"),
    pendiente: cuenta("pendiente") + cuenta("alternativa"),
    rechazada: cuenta("rechazada"),
    cancelada: cuenta("cancelada"),
    no_retirada: cuenta("no_retirada"),
    vencida: cuenta("vencida"),
  };
  const respondidas = estados.retirada + estados.aceptada + estados.no_retirada + estados.rechazada + estados.cancelada;
  const aceptadas = estados.retirada + estados.aceptada + estados.no_retirada;
  const perdido = reservas
    .filter((r) => r.estado === "rechazada" || r.estado === "cancelada" || r.estado === "no_retirada" || r.estado === "vencida")
    .reduce((t, r) => t + (totalReserva(r) ?? 0), 0);
  const descuentos = reservas.filter((r) => r.estado === "retirada").reduce((t, r) => t + (r.descuento ?? 0), 0);
  const conPromo = new Set(reservas.filter((r) => r.promo || r.descuento > 0).map((r) => r.pedido ?? -r.id)).size;
  const retiroYa = new Set(reservas.filter((r) => r.retiro_ya).map((r) => r.pedido ?? -r.id)).size;

  // Clientes que volvieron (más de un pedido en el período).
  const pedidosPorCliente = new Map<string, Set<number>>();
  for (const r of reservas) {
    const s = pedidosPorCliente.get(r.comprador_id) ?? new Set<number>();
    s.add(r.pedido ?? -r.id);
    pedidosPorCliente.set(r.comprador_id, s);
  }
  const volvieron = [...pedidosPorCliente.values()].filter((s) => s.size > 1).length;

  // ---- Evolución en el tiempo ----
  const primera = reservas[0]?.creada_en ?? vistas[0]?.creada_en;
  const inicio = desde ?? (primera ? new Date(primera) : new Date(comercio.creado_en ?? ahora));
  const largo = (ahora - inicio.getTime()) / DIA;
  const paso: "dia" | "semana" | "mes" = largo <= 31 ? "dia" : largo <= 120 ? "semana" : "mes";
  const claveDe = (d: Date) => {
    if (paso === "mes") return `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    if (paso === "semana") {
      const lunes = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DIA);
      return lunes.toISOString().slice(0, 10);
    }
    return d.toISOString().slice(0, 10);
  };
  const etiquetaDe = (d: Date) =>
    paso === "mes" ? `${MESES[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}` : `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
  const tramos: { clave: string; etiqueta: string; ingresos: number; pedidos: Set<number>; vistas: number }[] = [];
  {
    const indice = new Map<string, number>();
    const fin = enAR(new Date(ahora).toISOString());
    for (let d = enAR(inicio.toISOString()); d <= fin; ) {
      const c = claveDe(d);
      if (!indice.has(c)) {
        indice.set(c, tramos.length);
        tramos.push({ clave: c, etiqueta: etiquetaDe(paso === "semana" ? new Date(c) : d), ingresos: 0, pedidos: new Set(), vistas: 0 });
      }
      d = new Date(d.getTime() + DIA);
    }
    const tramo = (iso: string) => tramos[indice.get(claveDe(enAR(iso))) ?? -1];
    for (const r of reservas) {
      const t = tramo(r.creada_en);
      if (!t) continue;
      t.pedidos.add(r.pedido ?? -r.id);
      if (r.estado === "retirada") t.ingresos += totalReserva(r) ?? 0;
    }
    for (const v of vistas) {
      const t = tramo(v.creada_en);
      if (t) t.vistas++;
    }
  }
  const nombrePaso = paso === "dia" ? "por día" : paso === "semana" ? "por semana" : "por mes";

  // ---- Cuándo te reservan ----
  const porDia = Array.from({ length: 7 }, () => new Set<number>());
  const porHora = Array.from({ length: 24 }, () => new Set<number>());
  for (const r of reservas) {
    const d = enAR(r.creada_en);
    porDia[d.getUTCDay()].add(r.pedido ?? -r.id);
    porHora[d.getUTCHours()].add(r.pedido ?? -r.id);
  }
  const diaPico = porDia.reduce((m, s, i) => (s.size > porDia[m].size ? i : m), 0);
  const horaPico = porHora.reduce((m, s, i) => (s.size > porHora[m].size ? i : m), 0);

  // ---- Productos ----
  type Prod = { nombre: string; unidades: number; ingresos: number; reservas: number; perdidas: number; vistas: number };
  const prods = new Map<string, Prod>();
  const nombrePorId = new Map((productos ?? []).map((x) => [x.id, x.nombre]));
  const prod = (id: number | null, nombre: string) => {
    const k = id != null ? `i${id}` : `n${nombre}`;
    let x = prods.get(k);
    if (!x) {
      x = { nombre: (id != null && nombrePorId.get(id)) || nombre, unidades: 0, ingresos: 0, reservas: 0, perdidas: 0, vistas: 0 };
      prods.set(k, x);
    }
    return x;
  };
  for (const r of reservas) {
    const x = prod(r.producto_id, r.producto_nombre);
    x.reservas++;
    if (r.estado === "retirada") {
      x.unidades += r.cantidad;
      x.ingresos += totalReserva(r) ?? 0;
    }
    if (["rechazada", "cancelada", "no_retirada", "vencida"].includes(r.estado)) x.perdidas++;
  }
  for (const v of vistas) if (v.producto_id != null) prod(v.producto_id, nombrePorId.get(v.producto_id) ?? "Producto borrado").vistas++;
  const lista = [...prods.values()];
  const top = (k: keyof Omit<Prod, "nombre">) => lista.filter((x) => x[k] > 0).sort((a, b) => b[k] - a[k]).slice(0, 8);
  const conMovimiento = new Set(reservas.map((r) => r.producto_id));
  const activos = (productos ?? []).filter((x) => x.activo);
  const sinMovimiento = activos.filter((x) => !conMovimiento.has(x.id));
  const sinStock = activos.filter((x) => (x.modo === "exacto" && (x.stock ?? 0) <= 0) || (x.modo === "semaforo" && x.semaforo === "no")).length;
  const vistasComercio = vistas.filter((v) => v.producto_id == null).length;

  // ---- Reseñas y preguntas ----
  const resenasP = (resenas ?? []).filter((r) => enPeriodo(r.creada_en));
  const estrellas = [5, 4, 3, 2, 1].map((n) => ({ n, cant: resenasP.filter((r) => r.estrellas === n).length }));
  const promedio = resenasP.length ? resenasP.reduce((t, r) => t + r.estrellas, 0) / resenasP.length : null;
  const promedioTotal = resenas?.length ? resenas.reduce((t, r) => t + r.estrellas, 0) / resenas.length : null;
  const preguntasP = (preguntas ?? []).filter((r) => enPeriodo(r.creada_en));

  const textoPeriodo = periodo === "todo" ? "desde que empezaste" : `en los últimos ${PERIODOS[periodo]}`;

  return (
    <div className="space-y-5">
      <div className="tarjeta rounded-3xl p-5 sm:p-6">
        <Link href="/comerciante" className="text-xs text-white/80 underline hover:text-white">
          ← Volver al panel
        </Link>
        <h1 className="mt-2 text-2xl font-bold">📊 Estadísticas de {comercio.nombre}</h1>
        <p className="mt-1 text-sm text-white/80">Todo lo que pasó {textoPeriodo}. Los montos son de lo que los clientes retiraron (pagan en el local).</p>
        <nav className="mt-4 flex flex-wrap gap-2" aria-label="Período">
          {(Object.keys(PERIODOS) as Periodo[]).map((k) => (
            <Link
              key={k}
              href={`/comerciante/estadisticas?periodo=${k}`}
              scroll={false}
              aria-current={k === periodo ? "page" : undefined}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${k === periodo ? "bg-naranja-vivo text-white" : "bg-white/10 text-white/85 hover:bg-white/15"}`}
            >
              {PERIODOS[k]}
            </Link>
          ))}
        </nav>
      </div>

      {/* Lo principal */}
      <section className="tarjeta rounded-3xl p-5 sm:p-6" aria-label="Resumen">
        <h2 className="titulo-seccion">💰 Resumen</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Dato titulo="Ganaste" valor={plata(ya.ingresos)} ahora={ya.ingresos} antes={antes?.ingresos} grande />
          <Dato titulo="Pedidos recibidos" valor={num(ya.pedidos)} ahora={ya.pedidos} antes={antes?.pedidos} grande />
          <Dato titulo="Pedidos retirados" valor={num(ya.pedidosRetirados)} ahora={ya.pedidosRetirados} antes={antes?.pedidosRetirados} grande />
          <Dato titulo="Ticket promedio" valor={plata(Math.round(ya.ticket))} ahora={ya.ticket} antes={antes?.ticket} grande />
          <Dato titulo="Unidades vendidas" valor={num(ya.unidades)} ahora={ya.unidades} antes={antes?.unidades} />
          <Dato titulo="Clientes distintos" valor={num(ya.clientes)} ahora={ya.clientes} antes={antes?.clientes} />
          <Dato titulo="Clientes que volvieron" valor={num(volvieron)} nota={ya.clientes ? `${pct(volvieron, ya.clientes)}% de tus clientes` : undefined} />
          <Dato titulo="Visitas" valor={num(vistas.length)} nota={vistas.length ? `${pct(ya.pedidos, vistas.length) ?? 0}% terminó en pedido` : undefined} />
        </div>
        {antes ? <p className="mt-3 text-[11px] text-white/65">La flechita compara con los {PERIODOS[periodo]} anteriores.</p> : null}
      </section>

      {/* Evolución */}
      <section className="tarjeta rounded-3xl p-5 sm:p-6" aria-label="Evolución">
        <h2 className="titulo-seccion">📈 Cómo vas {nombrePaso}</h2>
        <Barras titulo={`Ganancia ${nombrePaso}`} datos={tramos.map((t) => ({ etiqueta: t.etiqueta, valor: t.ingresos, texto: plata(t.ingresos) }))} />
        <Barras titulo={`Pedidos ${nombrePaso}`} datos={tramos.map((t) => ({ etiqueta: t.etiqueta, valor: t.pedidos.size, texto: num(t.pedidos.size) }))} />
        <Barras titulo={`Visitas ${nombrePaso}`} datos={tramos.map((t) => ({ etiqueta: t.etiqueta, valor: t.vistas, texto: num(t.vistas) }))} />
      </section>

      {/* Qué pasó con las reservas */}
      <section className="tarjeta rounded-3xl p-5 sm:p-6" aria-label="Reservas">
        <h2 className="titulo-seccion">📦 Qué pasó con cada reserva</h2>
        <p className="mt-1 text-xs text-white/75">Cada producto reservado cuenta por separado ({num(reservas.length)} en total).</p>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <Lista
            filas={[
              { nombre: "✅ Retiradas", valor: estados.retirada },
              { nombre: "🕒 Aceptadas, falta retirar", valor: estados.aceptada },
              { nombre: "⏳ Esperando respuesta", valor: estados.pendiente },
              { nombre: "🙅 Canceladas por el cliente", valor: estados.cancelada },
              { nombre: "🚫 No vino a retirar", valor: estados.no_retirada },
              { nombre: "❌ Rechazadas por vos", valor: estados.rechazada },
              { nombre: "⌛ Vencidas sin respuesta", valor: estados.vencida },
            ]}
            total={reservas.length}
            formato={num}
          />
          <div className="grid grid-cols-2 content-start gap-4">
            <Dato titulo="Aceptás" valor={pct(aceptadas, respondidas) != null ? `${pct(aceptadas, respondidas)}%` : "—"} nota="de las que respondiste" />
            <Dato titulo="Te retiran" valor={pct(estados.retirada, estados.retirada + estados.no_retirada) != null ? `${pct(estados.retirada, estados.retirada + estados.no_retirada)}%` : "—"} nota="de las aceptadas" />
            <Dato titulo="Cancelan los clientes" valor={pct(estados.cancelada + estados.no_retirada, reservas.length) != null ? `${pct(estados.cancelada + estados.no_retirada, reservas.length)}%` : "—"} nota="cancelan o no vienen" />
            <Dato titulo="Rechazás vos" valor={pct(estados.rechazada + estados.vencida, reservas.length) != null ? `${pct(estados.rechazada + estados.vencida, reservas.length)}%` : "—"} nota="rechazadas o vencidas" />
            <Dato titulo="Ventas que se perdieron" valor={plata(perdido)} nota="canceladas, rechazadas, vencidas y no retiradas" />
            <Dato titulo="⚡ Retiro ya" valor={num(retiroYa)} nota={`pedidos para ir en el momento`} />
            <Dato titulo="Pedidos con promo" valor={num(conPromo)} nota={descuentos ? `${plata(descuentos)} descontados` : undefined} />
          </div>
        </div>
      </section>

      {/* Cuándo */}
      <section className="tarjeta rounded-3xl p-5 sm:p-6" aria-label="Cuándo te reservan">
        <h2 className="titulo-seccion">🗓️ Cuándo te reservan</h2>
        {ya.pedidos ? (
          <p className="mt-1 text-sm text-white/85">
            El día con más pedidos es el <b>{["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][diaPico]}</b> y la hora pico, entre las{" "}
            <b>
              {horaPico} y las {(horaPico + 1) % 24} h
            </b>
            .
          </p>
        ) : null}
        <div className="grid gap-x-8 lg:grid-cols-2">
          <Barras titulo="Pedidos por día de la semana" datos={[1, 2, 3, 4, 5, 6, 0].map((i) => ({ etiqueta: DIAS_SEMANA[i], valor: porDia[i].size, texto: num(porDia[i].size) }))} todas />
          <Barras titulo="Pedidos por hora" datos={porHora.map((s, h) => ({ etiqueta: `${h}`, valor: s.size, texto: `${num(s.size)} entre las ${h} y las ${(h + 1) % 24} h` }))} />
        </div>
      </section>

      {/* Productos */}
      <section className="tarjeta rounded-3xl p-5 sm:p-6" aria-label="Productos">
        <h2 className="titulo-seccion">🏷️ Tus productos</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Dato titulo="Publicados" valor={num(activos.length)} nota={`${num((productos ?? []).length - activos.length)} ocultos`} />
          <Dato titulo="Sin stock ahora" valor={num(sinStock)} />
          <Dato titulo="Sin reservas" valor={num(sinMovimiento.length)} nota={textoPeriodo} />
          <Dato titulo="Visitas a tu comercio" valor={num(vistasComercio)} nota={`y ${num(vistas.length - vistasComercio)} a productos`} />
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Ranking titulo="Los que más ganancia te dejan" filas={top("ingresos").map((x) => ({ nombre: x.nombre, valor: x.ingresos }))} formato={plata} />
          <Ranking titulo="Los más vendidos (unidades)" filas={top("unidades").map((x) => ({ nombre: x.nombre, valor: x.unidades }))} formato={num} />
          <Ranking titulo="Los más vistos" filas={top("vistas").map((x) => ({ nombre: x.nombre, valor: x.vistas }))} formato={num} />
          <Ranking
            titulo="Los que más se pierden"
            detalle="Reservas canceladas, rechazadas, vencidas o no retiradas: revisá stock y precio."
            filas={top("perdidas").map((x) => ({ nombre: x.nombre, valor: x.perdidas }))}
            formato={num}
          />
        </div>
        {sinMovimiento.length ? (
          <details className="mt-5 text-sm">
            <summary className="cursor-pointer text-white/85">Ver los {num(sinMovimiento.length)} productos publicados sin reservas</summary>
            <p className="mt-2 text-xs leading-relaxed text-white/75">{sinMovimiento.map((x) => x.nombre).join(" · ")}</p>
          </details>
        ) : null}
      </section>

      {/* Reseñas y preguntas */}
      <section className="tarjeta rounded-3xl p-5 sm:p-6" aria-label="Reseñas y preguntas">
        <h2 className="titulo-seccion">⭐ Reseñas y preguntas</h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div>
            <div className="grid grid-cols-2 gap-4">
              <Dato titulo="Valoración del período" valor={promedio ? `${promedio.toFixed(1).replace(".", ",")} ★` : "—"} nota={`${num(resenasP.length)} reseñas`} />
              <Dato titulo="Valoración general" valor={promedioTotal ? `${promedioTotal.toFixed(1).replace(".", ",")} ★` : "—"} nota={`${num(resenas?.length ?? 0)} reseñas en total`} />
            </div>
            <div className="mt-4">
              <Lista filas={estrellas.map((e) => ({ nombre: "★".repeat(e.n), valor: e.cant }))} total={resenasP.length} formato={num} />
            </div>
          </div>
          <div className="grid grid-cols-2 content-start gap-4">
            <Dato titulo="Reseñas respondidas" valor={resenasP.length ? `${pct(resenasP.filter((r) => r.respuesta).length, resenasP.length)}%` : "—"} />
            <Dato titulo="Preguntas recibidas" valor={num(preguntasP.length)} />
            <Dato titulo="Preguntas respondidas" valor={preguntasP.length ? `${pct(preguntasP.filter((r) => r.respuesta).length, preguntasP.length)}%` : "—"} />
          </div>
        </div>
      </section>
    </div>
  );
}

// Un número con su título y, si hay con qué comparar, la flecha de cambio.
function Dato({ titulo, valor, nota, ahora, antes, grande }: { titulo: string; valor: string; nota?: string; ahora?: number; antes?: number; grande?: boolean }) {
  const cambio = antes != null && ahora != null ? (antes ? Math.round(((ahora - antes) / antes) * 100) : ahora ? null : 0) : undefined;
  return (
    <div className="border-l-2 border-naranja-vivo/70 py-1 pl-3">
      <p className="text-xs text-white/75">{titulo}</p>
      <p className={`mt-0.5 font-black ${grande ? "text-2xl" : "text-xl"}`}>{valor}</p>
      {cambio !== undefined ? (
        <p className="text-[11px] text-white/70">
          {cambio === null ? "▲ nuevo" : cambio === 0 ? "= igual que antes" : cambio > 0 ? `▲ ${cambio}% más que antes` : `▼ ${-cambio}% menos que antes`}
        </p>
      ) : nota ? (
        <p className="text-[11px] text-white/70">{nota}</p>
      ) : null}
    </div>
  );
}

// Gráfico de barras simple (una sola serie, naranja). Al pasar o tocar, el
// valor exacto; las etiquetas de abajo se ralean si son muchas.
function Barras({ titulo, datos, todas }: { titulo: string; datos: { etiqueta: string; valor: number; texto: string }[]; todas?: boolean }) {
  const max = Math.max(...datos.map((d) => d.valor), 0);
  const cada = todas ? 1 : Math.max(1, Math.ceil(datos.length / 8));
  return (
    <figure className="mt-5">
      <figcaption className="flex items-baseline justify-between gap-2 text-sm font-semibold">
        {titulo}
        {max ? <span className="text-[11px] font-normal text-white/65">máx. {datos.find((d) => d.valor === max)?.texto}</span> : null}
      </figcaption>
      {max ? (
        <>
          <div className="mt-2 flex h-32 items-end gap-[2px] border-b border-white/25" role="img" aria-label={`${titulo}: ${datos.map((d) => `${d.etiqueta} ${d.texto}`).join(", ")}`}>
            {datos.map((d, i) => (
              <div key={i} className="group relative flex h-full min-w-0 flex-1 items-end" title={`${d.etiqueta}: ${d.texto}`}>
                <div
                  className="w-full rounded-t-[4px] bg-naranja-vivo transition-colors group-hover:bg-white"
                  style={{ height: d.valor ? `${Math.max(3, (d.valor / max) * 100)}%` : 0 }}
                />
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-md bg-white px-2 py-1 text-[11px] whitespace-nowrap text-marino shadow group-hover:block">
                  {d.etiqueta}: <b>{d.texto}</b>
                </span>
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-[2px] text-[10px] text-white/65">
            {datos.map((d, i) => (
              <span key={i} className="min-w-0 flex-1 overflow-visible text-center whitespace-nowrap">
                {i % cada === 0 ? d.etiqueta : ""}
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-2 rounded-xl bg-white/5 px-3 py-6 text-center text-xs text-white/65">Todavía no hay datos en este período.</p>
      )}
    </figure>
  );
}

// Filas con barra horizontal y porcentaje del total.
function Lista({ filas, total, formato }: { filas: { nombre: string; valor: number }[]; total: number; formato: (n: number) => string }) {
  return (
    <ul className="space-y-2.5">
      {filas.map((f) => (
        <li key={f.nombre}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span>{f.nombre}</span>
            <span className="shrink-0 font-semibold">
              {formato(f.valor)} <span className="text-xs font-normal text-white/65">{total ? `${pct(f.valor, total)}%` : ""}</span>
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-white/10">
            <div className="h-2 rounded-full bg-naranja-vivo" style={{ width: total ? `${(f.valor / total) * 100}%` : 0 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Ranking({ titulo, detalle, filas, formato }: { titulo: string; detalle?: string; filas: { nombre: string; valor: number }[]; formato: (n: number) => string }) {
  const max = Math.max(...filas.map((f) => f.valor), 0);
  return (
    <div>
      <h3 className="text-sm font-semibold">{titulo}</h3>
      {detalle ? <p className="text-[11px] text-white/65">{detalle}</p> : null}
      {filas.length ? (
        <ol className="mt-2 space-y-2">
          {filas.map((f, i) => (
            <li key={f.nombre + i}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="min-w-0 truncate">
                  {i + 1}. {f.nombre}
                </span>
                <span className="shrink-0 font-semibold">{formato(f.valor)}</span>
              </div>
              <div className="mt-0.5 h-1.5 rounded-full bg-white/10">
                <div className="h-1.5 rounded-full bg-naranja-vivo" style={{ width: max ? `${(f.valor / max) * 100}%` : 0 }} />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-xs text-white/65">Todavía no hay datos en este período.</p>
      )}
    </div>
  );
}
