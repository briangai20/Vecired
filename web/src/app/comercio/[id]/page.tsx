import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FotoPerfil } from "@/components/foto-perfil";
import { FotoProducto } from "@/components/foto-producto";
import { LogoComercio } from "@/components/logo-comercio";
import { Favorito } from "@/components/favorito";
import { TarjetaProductoCargando } from "@/components/tarjeta-producto";
import { Abierto, Estrellas, Stock, Verificado } from "@/components/insignias";
import { MapaComercios } from "@/components/mapa-comercios";
import { RegistrarVista } from "@/components/registrar-vista";
import { AvisoCierres } from "@/components/aviso-cierres";
import { abiertoAhora, fechaAR, disponibilidad, horario, nota, plata, promedio } from "@/lib/formato";
import { supabasePublico } from "@/lib/supabase/publico";
import { SITIO, vistaPrevia } from "@/lib/sitio";
import { enlaceWhatsapp } from "@/lib/whatsapp";
import type { Tabla } from "@/lib/supabase/tipos";
import { Catalogo, type ItemCatalogo } from "./catalogo";

type Props = PageProps<"/comercio/[id]">;

// Título, descripción y vista previa al compartir el link del comercio o al
// aparecer en Google.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const comercioId = Number((await params).id);
  if (!Number.isInteger(comercioId) || comercioId <= 0) return {};
  const { data: c } = await supabasePublico()
    .from("comercios")
    .select("nombre, rubro, direccion, logo_url")
    .eq("id", comercioId)
    .eq("aprobado", true)
    .maybeSingle();
  if (!c) return { title: "Comercio no encontrado" };
  const titulo = `${c.nombre}: ${c.rubro} en ${c.direccion}`;
  const descripcion = `${c.rubro} en ${c.direccion}. Mirá sus productos con precio y stock, reservalos en VeciRed y retiralos en el local.`;
  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: `/comercio/${comercioId}` },
    openGraph: vistaPrevia({ titulo: c.nombre, descripcion, ruta: `/comercio/${comercioId}`, foto: c.logo_url, alt: c.nombre }),
  };
}

const sinAcentos = (v: string) => v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default function PaginaComercio({ params, searchParams }: Props) {
  return (
    <div className="tarjeta rounded-3xl p-5">
      <Suspense fallback={<ComercioCargando />}>
        <Comercio params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Comercio({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const { id } = await params;
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const comercioId = Number(id);
  if (!Number.isInteger(comercioId) || comercioId <= 0) notFound();

  const db = supabasePublico();
  const [{ data: c }, { data: productos }, { data: resenas }, { data: franjas }] = await Promise.all([
    db.from("comercios").select("*").eq("id", comercioId).eq("aprobado", true).maybeSingle(),
    db.from("productos").select("*").eq("comercio_id", comercioId).eq("activo", true).order("nombre"),
    db.from("resenas").select("estrellas, texto, autor_nombre, autor_foto_url, creada_en, respuesta").eq("comercio_id", comercioId).order("creada_en", { ascending: false }),
    db.from("horarios").select("*").eq("comercio_id", comercioId),
  ]);
  if (!c) notFound();

  const ahora = new Date();
  const { data: cierres } = await db.rpc("dias_cerrados", { p_comercio: c.id, p_desde: fechaAR(ahora), p_hasta: fechaAR(ahora, 21) });
  const cerrados = (cierres ?? []).map((x) => x.fecha);
  const prom = promedio((resenas ?? []).map((r) => r.estrellas));
  // Los productos con el mismo "grupo" se muestran como una tarjeta con variantes.
  const grupos = new Map<string, Tabla<"productos">[]>();
  for (const p of productos ?? []) {
    const k = p.grupo || `#${p.id}`;
    grupos.set(k, [...(grupos.get(k) ?? []), p]);
  }
  // El buscador filtra en el navegador; cada tarjeta lleva el texto donde buscar.
  const items: ItemCatalogo[] = [...grupos].map(([clave, lista]) => ({
    clave,
    texto: sinAcentos(lista.flatMap((p) => [p.nombre, p.descripcion, p.marca, p.grupo]).filter(Boolean).join(" ")),
    tarjeta: lista.length > 1 ? <TarjetaGrupo lista={lista} /> : <TarjetaProducto p={lista[0]} ahora={ahora} />,
  }));

  // Datos del comercio en el formato que entiende Google (ficha de negocio local).
  const fichaGoogle = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: c.nombre,
    url: `${SITIO}/comercio/${c.id}`,
    address: { "@type": "PostalAddress", streetAddress: c.direccion, addressCountry: "AR" },
    ...(c.lat != null && c.lng != null ? { geo: { "@type": "GeoCoordinates", latitude: c.lat, longitude: c.lng } } : {}),
    ...(c.logo_url ? { image: c.logo_url } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(fichaGoogle).replace(/</g, "\\u003c") }} />
      <RegistrarVista comercioId={c.id} />
      <Link href="/" className="text-sm text-white/80 transition hover:text-white">
        ‹ Volver a la búsqueda
      </Link>
      <div className="mt-3 flex items-center gap-3">
        <LogoComercio url={c.logo_url} nombre={c.nombre} className="h-16 w-16 text-lg" />
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold break-words">{c.nombre}</h1>
          <Abierto abierto={abiertoAhora(franjas ?? [], ahora, cerrados)} />
          <Verificado />
        </div>
        <Suspense fallback={<span className="ml-auto h-10 w-10 shrink-0" />}>
          <Favorito tipo="comercio" id={c.id} className="ml-auto" />
        </Suspense>
      </div>
      <p className="mt-1 text-sm text-white/80">
        {c.rubro} · {c.direccion} · Horario {horario(franjas ?? [])}
      </p>
      <AvisoCierres cierres={cierres ?? []} ahora={ahora} />
      <div className="mt-2 flex items-center gap-2 text-xs text-white/80">
        <Estrellas valor={prom} />
        <span>{nota(prom) ?? "Sin reseñas"}</span>
        {resenas?.length ? <span>({resenas.length})</span> : null}
      </div>

      {c.lat != null && c.lng != null ? (
        <div className="mt-4">
          <MapaComercios
            centro={{ lat: c.lat, lng: c.lng }}
            seleccionado={c.id}
            comercios={[{ id: c.id, nombre: c.nombre, rubro: c.rubro, direccion: c.direccion, lat: c.lat, lng: c.lng, logo_url: c.logo_url }]}
            className="h-56"
          />
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm text-white/85 underline hover:text-white"
          >
            Cómo llegar
          </a>
          {enlaceWhatsapp(c.whatsapp) ? (
            <a
              href={enlaceWhatsapp(c.whatsapp, `Hola, los encontré en VeciRed. Quería hacerles una consulta.`)!}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 ml-4 inline-block text-sm text-white/85 underline hover:text-white"
            >
              Consultar por WhatsApp
            </a>
          ) : null}
        </div>
      ) : null}

      <Catalogo comercio={c.nombre} items={items} inicial={q} />

      {resenas?.length ? (
        <section id="resenas" className="mt-10 scroll-mt-24">
          <h2 className="titulo-seccion">⭐ Reseñas</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {resenas.slice(0, 6).map((r, i) => (
              <article key={i} className="rounded-2xl border border-white/20 p-4">
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
                {r.texto ? <p className="mt-3 text-sm">{r.texto}</p> : null}
                {r.respuesta ? (
                  <div className="mt-3 rounded-xl border-l-2 border-naranja-vivo bg-white/5 p-3 text-sm">
                    <p className="text-xs font-semibold text-white/80">Respuesta de {c.nombre}</p>
                    <p className="mt-1">{r.respuesta}</p>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function TarjetaProducto({ p, ahora }: { p: Tabla<"productos">; ahora: Date }) {
  const d = disponibilidad(p, ahora);
  return (
    <Link href={`/producto/${p.id}`} className="group block overflow-hidden rounded-2xl border border-white/20 transition hover:-translate-y-0.5 hover:border-white/60">
      <div className="relative aspect-[4/3] overflow-hidden bg-marino-claro">
        <FotoProducto url={p.foto_url} nombre={p.nombre} sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw" />
        <span className="absolute top-3 left-3">
          <Stock d={d} />
        </span>
      </div>
      <div className="p-4">
        {p.marca ? <p className="text-[11px] tracking-wider text-white/70 uppercase">{p.marca}</p> : null}
        <h3 className="leading-snug font-semibold">{p.nombre}</h3>
        <p className="mt-1 line-clamp-2 min-h-10 text-xs text-white/75">{p.descripcion}</p>
        <p className="mt-3 text-xl font-black">{plata(p.precio)}</p>
        <span className="boton mt-4 block w-full rounded-xl px-4 py-2.5 text-center text-sm font-semibold">
          {d.sePuede ? "Ver y reservar" : d.texto}
        </span>
      </div>
    </Link>
  );
}

function TarjetaGrupo({ lista }: { lista: Tabla<"productos">[] }) {
  const primero = lista[0];
  const precios = lista.map((p) => p.precio).filter((v): v is number => v != null);
  const desde = precios.length ? Math.min(...precios) : null;
  const marcas = [...new Set(lista.map((p) => p.marca).filter(Boolean))];
  const conFoto = lista.find((p) => p.foto_url) ?? primero;
  return (
    <Link href={`/producto/${primero.id}`} className="group block overflow-hidden rounded-2xl border border-white/20 transition hover:-translate-y-0.5 hover:border-white/60">
      <div className="relative aspect-[4/3] overflow-hidden bg-marino-claro">
        <FotoProducto url={conFoto.foto_url} nombre={primero.grupo ?? primero.nombre} sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw" />
        <span className="absolute top-3 left-3 rounded-full border border-white bg-marino px-2.5 py-0.5 text-[11px] font-semibold">
          {lista.length} variantes
        </span>
      </div>
      <div className="p-4">
        <h3 className="leading-snug font-semibold">{primero.grupo}</h3>
        <p className="mt-1 line-clamp-2 min-h-10 text-xs text-white/75">{marcas.length ? marcas.join(" · ") : "Varias opciones"}</p>
        <p className="mt-3 text-xl font-black">
          {desde != null ? <span className="mr-1 text-xs font-normal text-white/80">Desde</span> : null}
          {plata(desde)}
        </p>
        <span className="boton mt-4 block w-full rounded-xl px-4 py-2.5 text-center text-sm font-semibold">Elegir variante</span>
      </div>
    </Link>
  );
}

// Esqueleto mientras carga: logo, nombre, mapa y productos, en gris.
function ComercioCargando() {
  return (
    <div aria-label="Cargando el comercio…">
      <div className="h-4 w-36 animate-pulse rounded bg-white/10" />
      <div className="mt-4 flex items-center gap-3">
        <div className="h-16 w-16 animate-pulse rounded-2xl bg-white/10" />
        <div className="flex-1 space-y-2">
          <div className="h-6 w-1/2 animate-pulse rounded bg-white/10" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-white/10" />
        </div>
      </div>
      <div className="mt-6 h-56 animate-pulse rounded-2xl bg-white/10" />
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <TarjetaProductoCargando key={i} />
        ))}
      </div>
    </div>
  );
}
