"use client";

import Image from "next/image";
import { avisarNavegacion } from "@/components/barra-carga";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { cambiarCantidad, useCarrito, vaciarComercio, type CarritoComercio } from "@/lib/carrito";
import { plata } from "@/lib/formato";
import { datosCarrito, reservarCarrito, type DatosComercio } from "./acciones";

// El carrito, separado por comercio: cada comercio es un pedido aparte, con su
// horario de retiro y un solo código para retirar todo.
export function Carrito() {
  const carrito = useCarrito();
  const grupos = Object.values(carrito);
  const [datos, setDatos] = useState<Record<number, DatosComercio> | null>(null);
  const clave = grupos.map((g) => `${g.comercio.id}:${g.items.map((i) => i.id).join(",")}`).join("|");

  // Precios, stock y horarios al día (lo guardado puede haber cambiado).
  useEffect(() => {
    if (!clave) return;
    let vigente = true;
    const comercios = clave.split("|").map((g) => Number(g.split(":")[0]));
    const productos = clave.split("|").flatMap((g) => g.split(":")[1].split(",").map(Number));
    void datosCarrito(comercios, productos).then((d) => vigente && setDatos(d));
    return () => {
      vigente = false;
    };
  }, [clave]);

  if (!grupos.length) {
    return (
      <div className="tarjeta rounded-3xl p-8 text-center">
        <p className="text-lg font-semibold">Tu carrito está vacío</p>
        <p className="mt-1 text-sm text-white/80">Agregá productos de un mismo comercio y reservalos juntos: los retirás con un solo código.</p>
        <Link href="/" className="boton mt-5 inline-block rounded-xl px-5 py-2.5 text-sm font-semibold">
          Buscar productos
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {grupos.map((g) => (
        <Pedido key={g.comercio.id} grupo={g} datos={datos?.[g.comercio.id] ?? null} />
      ))}
    </div>
  );
}

function Pedido({ grupo, datos }: { grupo: CarritoComercio; datos: DatosComercio | null }) {
  const router = useRouter();
  const [ya, setYa] = useState(false);
  const [retiro, setRetiro] = useState("");
  const [error, setError] = useState("");
  const [enviando, empezar] = useTransition();
  const { comercio, items } = grupo;
  const info = (id: number) => datos?.productos[id];
  const sinStock = items.filter((i) => datos && !info(i.id)?.sePuede);
  // "Retiro ya" solo si el local está abierto y todos tienen el stock confirmado.
  const puedeYa = !!datos?.retiroYa && items.every((i) => info(i.id)?.ya);
  const elegido = retiro || datos?.franjas[0] || "";
  const total = items.reduce<number | null>((t, i) => {
    const precio = info(i.id)?.precio ?? i.precio;
    return t == null || precio == null ? null : t + precio * i.cantidad;
  }, 0);

  const reservar = () =>
    empezar(async () => {
      setError("");
      const r = await reservarCarrito(
        items.map((i) => ({ producto: i.id, cantidad: i.cantidad })),
        elegido,
        ya && puedeYa,
      );
      if (r.ingresar) {
        router.push(`/ingresar?siguiente=${encodeURIComponent("/carrito")}`);
        return;
      }
      if (r.error) {
        setError(r.error);
        return;
      }
      vaciarComercio(comercio.id);
      avisarNavegacion();
      router.push(`/reservas${r.reserva ? `?nueva=${r.reserva}` : ""}`);
    });

  return (
    <section className="tarjeta rounded-3xl p-5" aria-label={`Pedido en ${comercio.nombre}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="titulo-seccion">🛒 {comercio.nombre}</h2>
        <Link href={`/comercio/${comercio.id}`} className="text-xs underline">
          Agregar más de este comercio
        </Link>
      </div>
      <ul className="mt-3 divide-y divide-white/15">
        {items.map((i) => {
          const d = info(i.id);
          const maximo = d?.maximo ?? i.maximo;
          return (
            <li key={i.id} className="flex items-center gap-3 py-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-marino-claro">
                {i.foto ? <Image src={i.foto} alt={i.nombre} fill sizes="56px" className="object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/producto/${i.id}`} className="line-clamp-2 text-sm font-semibold hover:underline">
                  {d?.nombre ?? i.nombre}
                </Link>
                <p className="text-xs text-white/80">{plata(d?.precio ?? i.precio)} c/u</p>
                {datos && !d?.sePuede ? <p className="text-xs font-semibold text-[#ffb4a2]">{d?.texto ?? "Ya no está disponible"}: sacalo para reservar</p> : null}
              </div>
              <select
                value={Math.min(i.cantidad, maximo)}
                onChange={(e) => cambiarCantidad(comercio.id, i.id, Number(e.target.value))}
                aria-label={`Cantidad de ${i.nombre}`}
                className="campo w-16 shrink-0 px-2"
              >
                {Array.from({ length: maximo }, (_, n) => (
                  <option key={n + 1} value={n + 1}>
                    {n + 1}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => cambiarCantidad(comercio.id, i.id, 0)}
                aria-label={`Sacar ${i.nombre} del carrito`}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 rounded-xl border-l-4 border-naranja-vivo bg-naranja/15 px-3 py-2">
        <span className="text-sm">Total estimado</span>
        <span className="text-xl font-black">{plata(total)}</span>
      </div>
      <p className="mt-1 text-xs text-white/70">Si hay promos (2x1, % en la 2da…), se descuentan solas al reservar. Pagás en el local al retirar.</p>

      {!datos ? (
        <div className="mt-4 h-24 animate-pulse rounded-xl bg-white/5" />
      ) : (
        <div className="mt-4 space-y-3">
          {puedeYa ? (
            <div role="radiogroup" aria-label="Cuándo retirás" className="grid grid-cols-2 gap-2">
              {[
                [true, "⚡ Retiro ya", `Voy ahora · hasta las ${datos.retiroYa}`],
                [false, "📅 Elegir horario", "Hoy o los próximos días"],
              ].map(([valor, titulo, detalle]) => (
                <button
                  key={String(valor)}
                  type="button"
                  role="radio"
                  aria-checked={ya === valor}
                  onClick={() => setYa(valor as boolean)}
                  className={`rounded-xl border px-3 py-2 text-left transition ${ya === valor ? "border-naranja-vivo bg-naranja/20" : "border-white/25 hover:bg-white/10"}`}
                >
                  <span className="block text-sm font-semibold">{titulo}</span>
                  <span className="block text-[11px] text-white/80">{detalle}</span>
                </button>
              ))}
            </div>
          ) : null}
          {ya && puedeYa ? (
            <p className="rounded-xl border border-white/25 px-3 py-2.5 text-xs">
              Retirás <b>hoy hasta las {datos.retiroYa}</b>. Queda confirmado al instante, sin esperar al comercio.
            </p>
          ) : (
            <label className="block text-xs">
              Horario de retiro
              <select value={elegido} onChange={(e) => setRetiro(e.target.value)} className="campo mt-1">
                {datos.franjas.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
          )}
          {!(ya && puedeYa) ? (
            <p className="text-xs text-white/75">El comercio confirma cada producto. Lo que acepte lo retirás todo junto con un solo código.</p>
          ) : null}
          <button
            type="button"
            onClick={reservar}
            disabled={enviando || sinStock.length > 0 || (!ya && !elegido)}
            className="boton w-full rounded-xl px-4 py-3 text-sm font-semibold"
          >
            {enviando ? "Reservando…" : ya && puedeYa ? `⚡ Reservar ${items.length} ${items.length === 1 ? "producto" : "productos"} y voy ahora` : `Reservar ${items.length} ${items.length === 1 ? "producto" : "productos"}`}
          </button>
          {error ? (
            <p role="alert" className="text-sm font-semibold text-[#ffb4a2]">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
