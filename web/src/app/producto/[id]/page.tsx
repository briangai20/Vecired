import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Favorito } from "@/components/favorito";
import { Galeria } from "@/components/galeria";
import { Abierto, Estrellas, Stock } from "@/components/insignias";
import { RegistrarVista } from "@/components/registrar-vista";
import { AvisoCierres } from "@/components/aviso-cierres";
import { abiertoAhora, fechaAR, disponibilidad, franjasRetiro, horario, nota, plata, promedio } from "@/lib/formato";
import { usuarioActual } from "@/lib/sesion";
import { FormReserva } from "./form-reserva";
import { supabasePublico } from "@/lib/supabase/publico";
import { vistaPrevia } from "@/lib/sitio";
import { enlaceWhatsapp } from "@/lib/whatsapp";

type Props = PageProps<"/producto/[id]">;

// Título, descripción y vista previa (con la foto del producto) al compartir el
// link o al aparecer en Google.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const productoId = Number((await params).id);
  if (!Number.isInteger(productoId) || productoId <= 0) return {};
  const { data: p } = await supabasePublico()
    .from("productos")
    .select("nombre, precio, foto_url, comercio:comercios!inner(nombre, direccion, logo_url, aprobado)")
    .eq("id", productoId)
    .eq("activo", true)
    .eq("comercio.aprobado", true)
    .maybeSingle();
  if (!p) return { title: "Producto no encontrado" };
  const c = p.comercio;
  const precio = p.precio == null ? "" : ` a ${plata(p.precio)}`;
  const descripcion = `${p.nombre}${precio} en ${c.nombre}, ${c.direccion}. Reservalo en VeciRed y retiralo en el local.`;
  return {
    title: `${p.nombre} en ${c.nombre}`,
    description: descripcion,
    alternates: { canonical: `/producto/${productoId}` },
    openGraph: vistaPrevia({
      titulo: `${p.nombre}${precio}`,
      descripcion,
      ruta: `/producto/${productoId}`,
      foto: p.foto_url ?? c.logo_url,
      alt: p.nombre,
    }),
  };
}

export default function PaginaProducto({ params }: Props) {
  return (
    <div className="tarjeta rounded-3xl p-5">
      <Suspense fallback={<ProductoCargando />}>
        <Producto params={params} />
      </Suspense>
    </div>
  );
}

async function Producto({ params }: Pick<Props, "params">) {
  const { id } = await params;
  const productoId = Number(id);
  if (!Number.isInteger(productoId) || productoId <= 0) notFound();

  const db = supabasePublico();
  const { data: p } = await db
    .from("productos")
    .select("*, comercio:comercios!inner(*)")
    .eq("id", productoId)
    .eq("activo", true)
    .eq("comercio.aprobado", true)
    .maybeSingle();
  if (!p) notFound();
  const c = p.comercio;

  // "También lo tienen": el mismo producto en otros comercios (mismo nombre, o
  // mismo código si parece un código de barras).
  const mismoNombre = p.nombre.trim().replace(/[\%_]/g, (x) => "\\" + x);
  const codigoBarras = p.codigo && /^\d{8,14}$/.test(p.codigo.trim()) ? p.codigo.trim() : null;
  const deOtros = () =>
    db
      .from("productos")
      .select("id, nombre, precio, modo, stock, semaforo, actualizado_en, foto_url, comercio:comercios!inner(id, nombre, direccion, aprobado)")
      .eq("activo", true)
      .eq("comercio.aprobado", true)
      .neq("comercio_id", c.id)
      .limit(8);
  const [{ data: hermanos }, { data: otros }, { data: resenas }, { data: franjas }, { data: igualNombre }, { data: igualCodigo }] = await Promise.all([
    p.grupo
      ? db.from("productos").select("id, nombre, precio").eq("comercio_id", c.id).eq("grupo", p.grupo).eq("activo", true).order("precio")
      : Promise.resolve({ data: [] }),
    db.from("productos").select("id, nombre, precio").eq("comercio_id", c.id).eq("activo", true).neq("id", p.id).limit(8),
    db.from("resenas").select("estrellas").eq("comercio_id", c.id),
    db.from("horarios").select("*").eq("comercio_id", c.id),
    deOtros().ilike("nombre", mismoNombre),
    codigoBarras ? deOtros().eq("codigo", codigoBarras) : Promise.resolve({ data: [] }),
  ]);
  const enOtros = [...new Map([...(igualNombre ?? []), ...(igualCodigo ?? [])].map((o) => [o.id, o])).values()].sort(
    (x, y) => (x.precio ?? Infinity) - (y.precio ?? Infinity),
  );

  const ahora = new Date();
  const { data: cierres } = await db.rpc("dias_cerrados", { p_comercio: c.id, p_desde: fechaAR(ahora), p_hasta: fechaAR(ahora, 21) });
  const cerrados = (cierres ?? []).map((x) => x.fecha);
  const d = disponibilidad(p, ahora);
  const prom = promedio((resenas ?? []).map((r) => r.estrellas));
  const masProductos = (otros ?? []).filter((o) => !hermanos?.some((h) => h.id === o.id)).slice(0, 4);
  // El botón dice lo mismo en todos los comercios; si hace falta que el comercio confirme, lo aclara el aviso de arriba.
  const textoBoton = d.sePuede ? "Reservar" : d.texto;
  const whatsapp = enlaceWhatsapp(c.whatsapp, `Hola, vi en VeciRed "${p.nombre}". ¿Lo tienen disponible?`);
  const fila = (k: string, v: string) => (
    <div className="flex justify-between gap-4 border-b border-white/10 py-2.5 text-sm">
      <dt className="text-white/70">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );

  return (
    <>
      <RegistrarVista comercioId={c.id} productoId={p.id} />
      <Link href={`/comercio/${c.id}`} className="text-sm text-white/80 transition hover:text-white">
        ‹ Volver a {c.nombre}
      </Link>
      <nav aria-label="Ubicación" className="mt-3 flex flex-wrap gap-x-1 text-xs text-white/70">
        <Link href={`/?q=${encodeURIComponent(c.rubro)}`} className="hover:underline">
          {c.rubro}
        </Link>
        <span aria-hidden>›</span>
        <Link href={`/comercio/${c.id}`} className="hover:underline">
          {c.nombre}
        </Link>
        {p.grupo && p.grupo.trim().toLowerCase() !== p.nombre.trim().toLowerCase() ? (
          <>
            <span aria-hidden>›</span>
            <Link href={`/comercio/${c.id}?q=${encodeURIComponent(p.grupo)}`} className="hover:underline">
              {p.grupo}
            </Link>
          </>
        ) : null}
        <span aria-hidden>›</span>
        <span className="text-white/90">{p.nombre}</span>
      </nav>

      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <Galeria fotos={[p.foto_url, ...(p.fotos ?? [])].filter((f): f is string => !!f)} nombre={p.nombre} />
        <div>
          <p className="text-xs text-white/80">
            Vendido por <span className="font-semibold text-white">{c.nombre}</span>
          </p>
          <div className="mt-1 flex items-center gap-2 text-xs text-white/80">
            <Estrellas valor={prom} />
            <span>{nota(prom) ?? "Sin reseñas"}</span>
          </div>
          <div className="mt-3 flex items-start justify-between gap-3">
            <h1 className="text-2xl leading-snug font-bold">{p.nombre}</h1>
            <Suspense fallback={<span className="h-10 w-10 shrink-0" />}>
              <Favorito tipo="producto" id={p.id} />
            </Suspense>
          </div>
          {p.marca ? <p className="mt-1 text-sm text-white/80">Marca: {p.marca}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Stock d={d} />
            <Abierto abierto={abiertoAhora(franjas ?? [], ahora, cerrados)} />
          </div>
          {d.requiereConfirmacion ? (
            <p className="mt-2 text-xs text-white/85">
              {d.texto === "Stock sin confirmar"
                ? "El comercio no actualizó el stock en los últimos días: al reservar, te confirma si lo tiene antes de que vayas."
                : "El comercio te confirma la reserva antes de que vayas a retirar."}
            </p>
          ) : null}
          <p className="mt-4 text-3xl font-black">{plata(p.precio)}</p>

          {d.sePuede ? (
            <Suspense fallback={<div className="mt-5 h-40 animate-pulse rounded-xl bg-white/5" />}>
              <Reserva
                productoId={p.id}
                maximo={p.modo === "exacto" && !d.requiereConfirmacion ? Math.min(Math.max(p.stock ?? 1, 1), 20) : 10}
                franjas={franjasRetiro(franjas ?? [], ahora, cerrados)}
                textoBoton={textoBoton}
                precio={p.precio}
              />
            </Suspense>
          ) : (
            <button type="button" disabled className="boton mt-5 w-full rounded-xl px-4 py-3 text-sm font-semibold">
              {textoBoton}
            </button>
          )}
          {whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block w-full rounded-xl border border-white/30 px-4 py-3 text-center text-sm transition hover:bg-white/10"
            >
              Consultar por WhatsApp
            </a>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-white/30 px-4 py-3 text-center text-xs text-white/75">
              Este comercio todavía no cargó su WhatsApp para consultas.
            </p>
          )}

          <div className="mt-6 rounded-2xl border border-white/20 p-4">
            <p className="text-sm font-semibold">Retirás en el local</p>
            <p className="mt-1 text-xs text-white/80">{c.direccion}</p>
            <p className="mt-1 text-xs text-white/80">Horario de atención: {horario(franjas ?? [])}</p>
            <AvisoCierres cierres={cierres ?? []} ahora={ahora} />
          </div>
        </div>
      </div>

      {hermanos && hermanos.length > 1 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Variantes de {p.grupo}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {hermanos.map((h) => (
              <Link
                key={h.id}
                href={`/producto/${h.id}`}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${h.id === p.id ? "border-white bg-white font-semibold text-marino" : "border-white/40 hover:bg-white/10"}`}
              >
                {h.nombre}
                {h.precio != null ? ` · ${plata(h.precio)}` : ""}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {enOtros.length ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">También lo tienen</h2>
          <p className="mt-1 text-sm text-white/75">El mismo producto en otros comercios de VeciRed. Compará antes de reservar.</p>
          <ul className="mt-3 divide-y divide-white/10 rounded-2xl border border-white/20">
            <li className="flex items-center justify-between gap-3 bg-white/5 px-4 py-3 text-sm">
              <span className="min-w-0">
                <span className="font-semibold">{c.nombre}</span> <span className="text-xs text-white/70">(el que estás viendo)</span>
              </span>
              <span className="shrink-0 font-bold">{plata(p.precio)}</span>
            </li>
            {enOtros.map((o) => {
              const masBarato = o.precio != null && p.precio != null && o.precio < p.precio;
              return (
                <li key={o.id}>
                  <Link href={`/producto/${o.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition hover:bg-white/5">
                    <span className="min-w-0">
                      <span className="block font-semibold break-words">{o.comercio.nombre}</span>
                      <span className="block text-xs break-words text-white/70">{o.comercio.direccion}</span>
                      <span className="mt-1 inline-block">
                        <Stock d={disponibilidad(o, ahora)} />
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-bold">{plata(o.precio)}</span>
                      {masBarato ? <span className="mt-0.5 block text-[11px] font-semibold text-naranja-vivo">Más barato</span> : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Descripción</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/85">{p.descripcion || "Este producto todavía no tiene descripción cargada."}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Características</h2>
        <dl className="mt-2 max-w-xl">
          {fila("Comercio", c.nombre)}
          {fila("Rubro", c.rubro)}
          {p.marca ? fila("Marca", p.marca) : null}
          {fila("Disponibilidad", d.texto)}
          {fila("Precio", plata(p.precio))}
          {fila("Horario de atención", horario(franjas ?? []))}
          {fila("Valoración del comercio", prom != null ? `${nota(prom)} de 5` : "Sin reseñas")}
        </dl>
      </section>

      {masProductos.length ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Más productos de {c.nombre}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {masProductos.map((o) => (
              <Link key={o.id} href={`/producto/${o.id}`} className="rounded-2xl border border-white/20 p-4 transition hover:-translate-y-0.5 hover:border-white/60">
                <p className="text-sm font-semibold">{o.nombre}</p>
                <p className="mt-1 text-sm text-white/80">{plata(o.precio)}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

// Formulario de reserva si hay sesión; si no, un botón que lleva a ingresar
// y vuelve a este producto.
async function Reserva(props: React.ComponentProps<typeof FormReserva>) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return (
      <>
        <Link
          href={`/ingresar?siguiente=${encodeURIComponent(`/producto/${props.productoId}`)}`}
          className="boton mt-5 block w-full rounded-xl px-4 py-3 text-center text-sm font-semibold"
        >
          {props.textoBoton}
        </Link>
        <p className="mt-2 text-xs text-white/75">Para reservar ingresá o creá tu cuenta. Te lleva un minuto.</p>
      </>
    );
  }
  return <FormReserva {...props} />;
}

// Esqueleto mientras carga: foto, título, precio y botón, en gris.
function ProductoCargando() {
  return (
    <div aria-label="Cargando el producto…">
      <div className="h-4 w-40 animate-pulse rounded bg-white/10" />
      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <div className="aspect-square animate-pulse rounded-2xl bg-white/10" />
        <div className="space-y-3">
          <div className="h-3 w-1/3 animate-pulse rounded bg-white/10" />
          <div className="h-7 w-4/5 animate-pulse rounded bg-white/10" />
          <div className="h-5 w-1/2 animate-pulse rounded bg-white/10" />
          <div className="h-9 w-2/5 animate-pulse rounded bg-white/10" />
          <div className="h-12 w-full animate-pulse rounded-xl bg-white/10" />
          <div className="h-12 w-full animate-pulse rounded-xl bg-white/10" />
        </div>
      </div>
    </div>
  );
}
