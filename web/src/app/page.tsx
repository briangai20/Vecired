import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Filtros, type ValoresFiltro } from "@/components/filtros";
import { Abierto, Estrellas } from "@/components/insignias";
import { TarjetaProducto, TarjetaProductoCargando } from "@/components/tarjeta-producto";
import { ListaConMas } from "@/components/lista-con-mas";
import { LogoComercio } from "@/components/logo-comercio";
import { MapaComercios } from "@/components/mapa-comercios";
import { abiertoAhora, disponibilidad, fechaAR, horario, km, nota, promedio, viaje } from "@/lib/formato";
import { iconoRubro, nombreRubro, sinAcentos } from "@/lib/rubros";
import { supabasePublico } from "@/lib/supabase/publico";
import { CENTROS, RADIO_INICIAL, ZONA_INICIAL } from "@/lib/zonas";
import { VistosRecientes } from "@/components/vistos-recientes";
import { Carrusel } from "@/components/carrusel";
import { CarruselOfertas } from "@/components/carrusel-ofertas";
import { TarjetaOferta } from "@/components/tarjeta-oferta";
import { ofertasVigentes, preciosDeOferta } from "@/lib/ofertas";

type Params = PageProps<"/">["searchParams"];
type SP = Awaited<Params>;

const ORDENES = { cerca: "Más cerca", valorados: "Mejor valoración", precio: "Menor precio", precio_mayor: "Mayor precio" } as const;
// Filtros por característica del producto (?marca=…&medida=…&material=…).
const ATRIBUTOS = { marca: "Marca", medida: "Medida", material: "Material" } as const;
type Atributo = keyof typeof ATRIBUTOS;
type Orden = keyof typeof ORDENES;

const texto = (sp: SP, k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");

function leerFiltro(sp: SP): ValoresFiltro {
  const numero = (k: string) => {
    const n = Number(texto(sp, k));
    return texto(sp, k) !== "" && Number.isFinite(n) ? n : undefined;
  };
  const zona = CENTROS[texto(sp, "zona")] ? texto(sp, "zona") : ZONA_INICIAL;
  const radio = Math.min(20, Math.max(1, Math.round(numero("radio") ?? RADIO_INICIAL)));
  const lat = numero("lat");
  const lng = numero("lng");
  const ubicacionValida = lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  return {
    q: texto(sp, "q").trim().slice(0, 80),
    zona,
    radio,
    ...(ubicacionValida ? { lat, lng, lugar: texto(sp, "lugar").slice(0, 120) || undefined } : {}),
  };
}

// Orden y filtros de los resultados (?orden=precio&abierto=1&stock=1&ver=comercios).
function leerAjustes(sp: SP) {
  const orden: Orden = texto(sp, "orden") in ORDENES ? (texto(sp, "orden") as Orden) : "cerca";
  return {
    orden,
    soloAbiertos: texto(sp, "abierto") === "1",
    conStock: texto(sp, "stock") === "1",
    verComercios: texto(sp, "ver") === "comercios",
    atributos: Object.fromEntries((Object.keys(ATRIBUTOS) as Atributo[]).map((k) => [k, texto(sp, k).slice(0, 60)])) as Record<Atributo, string>,
  };
}

// La misma dirección cambiando algunos datos (null = sacarlo).
function con(sp: SP, cambios: Record<string, string | null>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") p.set(k, v);
  for (const [k, v] of Object.entries(cambios)) {
    if (v == null) p.delete(k);
    else p.set(k, v);
  }
  return `/${p.size ? `?${p}` : ""}`;
}

// Comercio tocado en el mapa (?comercio=id).
function leerElegido(sp: SP) {
  const n = Number(texto(sp, "comercio"));
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export default function Inicio({ searchParams }: PageProps<"/">) {
  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <OfertasDestacadas searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={null}>
        <Portada searchParams={searchParams} />
      </Suspense>
      {/* Enseguida de la bienvenida, la búsqueda y el mapa; las vidrieras de productos van al final. */}
      <div id="resultados" className="grid scroll-mt-32 gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Suspense fallback={<div className="tarjeta h-16 animate-pulse rounded-3xl lg:h-72" />}>
            <FiltrosConZonas searchParams={searchParams} />
          </Suspense>
        </aside>
        <section className="min-w-0">
          <Suspense fallback={<Cargando />}>
            <Resultados searchParams={searchParams} />
          </Suspense>
        </section>
      </div>
      <Suspense fallback={null}>
        <VistosRecientes />
      </Suspense>
      <Suspense fallback={<FilasCargando />}>
        <FilasDeProductos searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

// Ofertas de los comercios, arriba de todo (debajo del buscador), pasando
// solas cada 6 segundos. Solo en la portada, sin búsqueda hecha.
async function OfertasDestacadas({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  if (texto(sp, "q").trim()) return null;
  const ofertas = await ofertasVigentes(supabasePublico(), { limite: 12 });
  if (!ofertas.length) return null;
  return (
    <section aria-label="Ofertas">
      <h2 className="titulo-seccion mb-3 text-marino">🔥 Ofertas de tu barrio</h2>
      <CarruselOfertas>
        {ofertas.map((o) => (
          <TarjetaOferta key={o.id} o={o} className="h-full" />
        ))}
      </CarruselOfertas>
    </section>
  );
}

// Bienvenida y accesos por rubro: solo en la portada, sin búsqueda hecha.
async function Portada({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  if (texto(sp, "q").trim()) return null;
  const { data } = await supabasePublico().from("comercios").select("rubro").eq("aprobado", true);
  // Un acceso por rubro, sin repetir por mayúsculas o acentos, los más comunes primero.
  const cuenta = new Map<string, { nombre: string; n: number }>();
  for (const { rubro } of data ?? []) {
    const k = sinAcentos(rubro.trim());
    if (!k) continue;
    const r = cuenta.get(k) ?? { nombre: nombreRubro(rubro), n: 0 };
    r.n++;
    cuenta.set(k, r);
  }
  const rubros = [...cuenta.values()].sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre)).slice(0, 12);

  return (
    <>
      {/* Bienvenida chica: una línea con los 3 pasos, sin recuadros adentro. */}
      <section className="tarjeta rounded-2xl px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <p className="text-base leading-tight font-black tracking-tight sm:text-lg">
            Lo que necesitás, <span className="text-naranja-vivo">en tu barrio.</span>
          </p>
          <ol className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/85 sm:text-sm">
            {[
              ["🔎", "Buscá"],
              ["📲", "Reservá"],
              ["🏪", "Retirá en el local"],
            ].map(([icono, titulo], i) => (
              <li key={titulo} className="flex items-center gap-1.5">
                {i ? <span aria-hidden className="text-white/40">›</span> : null}
                <span aria-hidden>{icono}</span>
                <span className="font-semibold">{titulo}</span>
              </li>
            ))}
          </ol>
          <Link href="/comercios" className="text-xs font-semibold text-naranja-vivo underline sm:text-sm">
            ¿Tenés un comercio? Sumalo gratis
          </Link>
        </div>
      </section>

      {rubros.length ? (
        <nav aria-label="Rubros">
          <h2 className="titulo-seccion mb-3 text-marino">🧭 Explorá por rubro</h2>
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            {rubros.map((r) => (
              <li key={r.nombre} className="shrink-0">
                <Link
                  href={con(sp, { q: r.nombre, comercio: null, ver: null })}
                  className="flex items-center gap-2 rounded-full border border-marino/15 bg-white px-4 py-2 text-sm font-medium text-marino shadow-sm transition hover:border-naranja hover:text-naranja"
                >
                  <span aria-hidden>{iconoRubro(r.nombre)}</span>
                  {r.nombre}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </>
  );
}

// Filas de productos de la portada (sin búsqueda): cerca tuyo, abiertos ahora
// y recién agregados, como las vidrieras de Mercado Libre.
async function FilasDeProductos({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  const f = leerFiltro(sp);
  if (f.q) return null;
  const centro = f.lat != null && f.lng != null ? { lat: f.lat, lng: f.lng } : CENTROS[f.zona];
  const db = supabasePublico();
  const { data: comercios } = await db.rpc("comercios_cercanos", { p_lat: centro.lat, p_lng: centro.lng, p_radio_km: f.radio });
  const ids = (comercios ?? []).map((c) => c.id);
  if (!ids.length) return null;
  const ahora = new Date();
  const [{ data: productos }, { data: horarios }, cierres] = await Promise.all([
    db.from("productos").select("*").in("comercio_id", ids).eq("activo", true).order("id", { ascending: false }).limit(400),
    db.from("horarios").select("*").in("comercio_id", ids),
    Promise.all(ids.map((id) => db.rpc("dias_cerrados", { p_comercio: id, p_desde: fechaAR(ahora), p_hasta: fechaAR(ahora) }))),
  ]);
  const cerradoHoy = new Set(cierres.flatMap((r, i) => (r.data?.length ? [ids[i]] : [])));
  const abierto = new Map(
    ids.map((id) => [id, abiertoAhora((horarios ?? []).filter((h) => h.comercio_id === id), ahora, cerradoHoy.has(id) ? [fechaAR(ahora)] : [])]),
  );
  const comercioDe = new Map((comercios ?? []).map((c) => [c.id, c]));
  // Solo productos que se pueden reservar; con foto primero, que se ven mejor.
  const todos = (productos ?? [])
    .map((p) => ({ p, c: comercioDe.get(p.comercio_id)!, d: disponibilidad(p, ahora) }))
    .filter((x) => x.c && x.d.sePuede);
  type Item = (typeof todos)[number];
  const ofertaDe = await preciosDeOferta(db, todos.map((x) => x.p.id));
  const conFotoPrimero = (l: Item[]) => [...l].sort((a, b) => Number(!!b.p.foto_url) - Number(!!a.p.foto_url));
  // Para que una fila no sea toda de un mismo comercio, se van alternando.
  const mezclar = (l: Item[]) => {
    const porComercio = new Map<number, Item[]>();
    for (const x of l) porComercio.set(x.c.id, [...(porComercio.get(x.c.id) ?? []), x]);
    const colas = [...porComercio.values()];
    const salida: Item[] = [];
    while (colas.some((q) => q.length)) for (const q of colas) if (q.length) salida.push(q.shift()!);
    return salida;
  };
  const filas = [
    { titulo: "📍 Cerca tuyo", lista: mezclar(conFotoPrimero(todos).sort((a, b) => a.c.distancia_km - b.c.distancia_km)) },
    { titulo: "🟢 Abiertos ahora", lista: mezclar(conFotoPrimero(todos.filter((x) => abierto.get(x.c.id)))) },
    { titulo: "🆕 Recién agregados", lista: mezclar(todos) },
  ].filter((fila) => fila.lista.length >= 2);
  if (!filas.length) return null;

  return (
    <div className="space-y-5">
      {/* Las filas se alternan: franja blanca, fondo crema, franja blanca… */}
      {filas.map((fila, i) => (
        <section key={fila.titulo} aria-label={fila.titulo.replace(/^\S+ /, "")} className={i % 2 === 0 ? "banda" : "px-1"}>
          <h2 className="titulo-seccion mb-3 text-marino">{fila.titulo}</h2>
          <Carrusel etiqueta={fila.titulo}>
            {fila.lista.slice(0, 12).map(({ p, c, d }) => (
              <li key={p.id} className="w-40 shrink-0 snap-start sm:w-48">
                <TarjetaProducto
                  id={p.id}
                  nombre={p.nombre}
                  precio={p.precio}
                  foto={p.foto_url}
                  d={d}
                  comercio={c.nombre}
                  distancia={c.distancia_km}
                  abierto={abierto.get(c.id) ?? null}
                oferta={ofertaDe.get(p.id) ?? null}
                  className="h-full"
                />
              </li>
            ))}
          </Carrusel>
        </section>
      ))}
    </div>
  );
}

function FilasCargando() {
  return (
    <div>
      <div className="mb-2 h-5 w-32 animate-pulse rounded bg-marino/10" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <TarjetaProductoCargando key={i} className="w-40 shrink-0 bg-marino sm:w-48" />
        ))}
      </div>
    </div>
  );
}

async function FiltrosConZonas({ searchParams }: { searchParams: Params }) {
  const filtro = leerFiltro(await searchParams);
  const { data: zonas } = await supabasePublico()
    .from("zonas")
    .select("id, nombre")
    .eq("activa", true)
    .order("nombre");
  return <Filtros zonas={zonas ?? []} inicial={filtro} />;
}

async function Resultados({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  const f = leerFiltro(sp);
  const a = leerAjustes(sp);
  const centro = f.lat != null && f.lng != null ? { lat: f.lat, lng: f.lng } : CENTROS[f.zona];
  const db = supabasePublico();

  const { data: comercios, error } = await db.rpc("comercios_cercanos", {
    p_lat: centro.lat,
    p_lng: centro.lng,
    p_radio_km: f.radio,
    p_busqueda: f.q || undefined,
  });

  if (error) {
    return <Vacio>No pudimos cargar los resultados. Probá de nuevo en un rato.</Vacio>;
  }

  const ids = (comercios ?? []).map((c) => c.id);
  const [{ data: resenas }, { data: horarios }, { data: productosTodos }] = ids.length
    ? await Promise.all([
        db.from("resenas").select("comercio_id, estrellas").in("comercio_id", ids),
        db.from("horarios").select("*").in("comercio_id", ids),
        f.q ? db.from("productos").select("*").in("comercio_id", ids).eq("activo", true).limit(1000) : Promise.resolve({ data: [] }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const ahora = new Date();
  // Qué comercios están cerrados hoy por feriado o cierre puntual.
  const cerradosHoy = new Set(
    (
      await Promise.all(ids.map((id) => db.rpc("dias_cerrados", { p_comercio: id, p_desde: fechaAR(ahora), p_hasta: fechaAR(ahora) })))
    ).flatMap((r, i) => (r.data?.length ? [ids[i]] : [])),
  );
  const franjasDe = (id: number) => (horarios ?? []).filter((h) => h.comercio_id === id);
  const abierto = new Map(ids.map((id) => [id, abiertoAhora(franjasDe(id), ahora, cerradosHoy.has(id) ? [fechaAR(ahora)] : [])]));
  const valoracion = new Map(ids.map((id) => [id, promedio((resenas ?? []).filter((r) => r.comercio_id === id).map((r) => r.estrellas))]));

  // Comercios: abiertos ahora si se pidió, y en el orden elegido.
  let lista = (comercios ?? []).filter((c) => !a.soloAbiertos || abierto.get(c.id));
  if (a.orden === "valorados") lista = [...lista].sort((x, y) => (valoracion.get(y.id) ?? 0) - (valoracion.get(x.id) ?? 0));
  const comercioDe = new Map(lista.map((c) => [c.id, c]));

  // Productos: coinciden con lo buscado (o son de un comercio que coincide por nombre o rubro).
  const buscado = sinAcentos(f.q);
  // Primero los que tienen la palabra en el propio producto; después el resto
  // del catálogo de un comercio que coincide por nombre o rubro.
  let productos = (productosTodos ?? [])
    .filter((p) => comercioDe.has(p.comercio_id))
    .map((p) => {
      const c = comercioDe.get(p.comercio_id)!;
      const directo = sinAcentos([p.nombre, p.marca, p.medida, p.material, p.descripcion, p.grupo, p.codigo].filter(Boolean).join(" ")).includes(buscado);
      return { p, c, d: disponibilidad(p, ahora), directo, sirve: directo || sinAcentos(`${c.nombre} ${c.rubro}`).includes(buscado) };
    })
    .filter((x) => x.sirve && (!a.conStock || x.d.sePuede));
  // Opciones de Marca, Medida y Material: las que aparecen en estos resultados.
  const opciones = Object.fromEntries(
    (Object.keys(ATRIBUTOS) as Atributo[]).map((k) => [
      k,
      [...new Set(productos.map((x) => x.p[k]?.trim()).filter((v): v is string => !!v))].sort((m, n) => m.localeCompare(n, "es")).slice(0, 30),
    ]),
  ) as Record<Atributo, string[]>;
  productos = productos.filter((x) =>
    (Object.keys(ATRIBUTOS) as Atributo[]).every((k) => !a.atributos[k] || sinAcentos(x.p[k] ?? "") === sinAcentos(a.atributos[k])),
  );
  productos = productos.sort((x, y) =>
    Number(y.directo) - Number(x.directo) ||
    (a.orden === "precio"
      ? (x.p.precio ?? Infinity) - (y.p.precio ?? Infinity) || x.c.distancia_km - y.c.distancia_km
      : a.orden === "precio_mayor"
        ? (y.p.precio ?? -Infinity) - (x.p.precio ?? -Infinity) || x.c.distancia_km - y.c.distancia_km
      : a.orden === "valorados"
        ? (valoracion.get(y.c.id) ?? 0) - (valoracion.get(x.c.id) ?? 0) || x.c.distancia_km - y.c.distancia_km
        : x.c.distancia_km - y.c.distancia_km),
  );

  // Nada con lo que escribió: si parece un error de tipeo ("cillar"), se
  // busca lo corregido ("collar") y se le avisa arriba.
  const buscaste = texto(sp, "buscaste").slice(0, 80);
  if (f.q && !productos.length && !lista.length && !buscaste) {
    const { data: corregida } = await db.rpc("corregir_busqueda", { p_texto: f.q });
    if (corregida && corregida !== sinAcentos(f.q)) redirect(con(sp, { q: corregida, buscaste: f.q }));
  }

  const ofertaDe = await preciosDeOferta(db, productos.map((x) => x.p.id));
  const elegido = lista.find((c) => c.id === leerElegido(sp));
  const conBusqueda = Boolean(f.q);
  const verProductos = conBusqueda && !a.verComercios;

  // En la pestaña de productos, el mapa muestra los comercios que los tienen.
  const enMapa = verProductos ? [...new Map(productos.map((x) => [x.c.id, x.c])).values()] : lista;

  // Cada parte va en su propio recuadro (sin uno grande que las contenga).
  return (
    <div className="space-y-4">
      <div className="tarjeta rounded-3xl p-4 sm:p-5">
        {conBusqueda ? (
          <div className="mb-3">
            <h1 className="text-lg font-semibold break-words">
              Resultados para “{f.q}” <span className="font-normal text-white/75">a menos de {f.radio} km</span>
            </h1>
            {buscaste ? (
              <p className="mt-1 text-sm text-white/80">
                No encontramos “{buscaste}”: te mostramos resultados de <b className="text-naranja-vivo">“{f.q}”</b>.
              </p>
            ) : null}
            <div className="mt-3 flex gap-2" role="tablist" aria-label="Qué ver">
              {[
                [false, `Productos (${productos.length})`],
                [true, `Comercios (${lista.length})`],
              ].map(([comerciosTab, etiqueta]) => {
                const activo = a.verComercios === comerciosTab;
                return (
                  <Link
                    key={String(comerciosTab)}
                    href={con(sp, { ver: comerciosTab ? "comercios" : null, comercio: null })}
                    scroll={false}
                    role="tab"
                    aria-selected={activo}
                    className={`flex-1 rounded-xl px-3 py-2 text-center text-sm font-medium transition active:bg-naranja/70 ${activo ? "bg-naranja text-white" : "hover:bg-white/10"}`}
                  >
                    {etiqueta}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
        <Filtro sp={sp} a={a} deProductos={verProductos} opciones={opciones} />
      </div>

      <div className="tarjeta rounded-3xl p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="titulo-seccion">🗺️ Mapa</h2>
          <span className="text-xs text-white/80">{verProductos ? "Dónde están los comercios que lo tienen" : "Tocá un comercio para ver sus datos"}</span>
        </div>
        <MapaComercios
          centro={centro}
          radioKm={f.radio}
          seleccionado={verProductos ? undefined : elegido?.id}
          elegirEnLista={!verProductos}
          comercios={enMapa.map((c) => ({ id: c.id, nombre: c.nombre, rubro: c.rubro, direccion: c.direccion, lat: c.lat, lng: c.lng, logo_url: c.logo_url }))}
        />
      </div>

      {verProductos ? (
        productos.length === 0 ? (
          <Vacio>
            No encontramos productos con “{f.q}” {a.soloAbiertos || a.conStock || Object.values(a.atributos).some(Boolean) ? "con esos filtros " : ""}a menos de {f.radio} km.
            <br />
            Probá con otra palabra, ampliá el radio o{" "}
            <Link href={con(sp, { ver: "comercios" })} className="underline">
              mirá los comercios
            </Link>
            .
          </Vacio>
        ) : (
          <ListaConMas deA={12} que="productos" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {productos.map(({ p, c, d }) => (
              <TarjetaProducto
                key={p.id}
                id={p.id}
                nombre={p.nombre}
                precio={p.precio}
                foto={p.foto_url}
                d={d}
                comercio={c.nombre}
                distancia={c.distancia_km}
                abierto={abierto.get(c.id) ?? null}
                oferta={ofertaDe.get(p.id) ?? null}
              />
            ))}
          </ListaConMas>
        )
      ) : (
        <>
          {elegido ? (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
                <h2 className="titulo-seccion text-marino">{elegido.nombre}</h2>
                <Link href={con(sp, { comercio: null })} scroll={false} className="text-xs text-marino underline">
                  Ver los {lista.length} comercios a menos de {f.radio} km
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {tarjeta(elegido)}
                <div className="flex flex-col justify-center gap-2">
                  <Link href={`/comercio/${elegido.id}`} className="boton rounded-xl px-4 py-3 text-center text-sm font-semibold">
                    Ver catálogo
                  </Link>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${elegido.lat},${elegido.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl border border-marino/30 px-4 py-3 text-center text-sm font-medium text-marino hover:bg-marino/5"
                  >
                    Cómo llegar
                  </a>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
              <h2 className="titulo-seccion text-marino">🏪 {conBusqueda ? "Comercios" : "Comercios cercanos"}</h2>
              <span className="text-xs text-marino/70">
                {lista.length} {lista.length === 1 ? "comercio" : "comercios"} a menos de {f.radio} km
              </span>
            </div>
          )}

          {elegido ? null : lista.length === 0 ? (
            <Vacio>
              {f.q
                ? `No hay comercios con "${f.q}" dentro de ${f.radio} km. Probá ampliar el radio o buscar otra palabra.`
                : a.soloAbiertos
                  ? "No hay comercios abiertos en este momento dentro de ese radio."
                  : `Todavía no hay comercios cargados dentro de ${f.radio} km. Estamos sumando locales de a uno.`}
            </Vacio>
          ) : (
            <ListaConMas deA={9} que="comercios" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {lista.map(tarjeta)}
            </ListaConMas>
          )}
        </>
      )}
    </div>
  );

  function tarjeta(c: (typeof lista)[number]) {
    const prom = valoracion.get(c.id) ?? null;
    const t = viaje(c.distancia_km);
    return (
      <Link
        key={c.id}
        href={`/comercio/${c.id}`}
        className="tarjeta block rounded-2xl p-4 transition hover:-translate-y-0.5 hover:border-white/60"
      >
        <div className="flex items-start gap-3">
          <LogoComercio url={c.logo_url} nombre={c.nombre} />
          <div className="min-w-0 flex-1">
            <p className="leading-snug font-semibold break-words">{c.nombre}</p>
            <p className="text-xs text-white/80">{c.rubro}</p>
          </div>
          <Abierto abierto={abierto.get(c.id) ?? null} />
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs">
          <Estrellas valor={prom} />
          <span className="text-white/80">{nota(prom) ?? "Nuevo"}</span>
        </div>
        <div className="mt-3 flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-white/80">
          <span className="font-semibold text-white">{km(c.distancia_km)}</span>
          <span>
            A pie {t.aPie} min · En auto {t.enAuto} min
          </span>
        </div>
        <p className="mt-2 text-xs break-words text-white/70">{c.direccion}</p>
        <p className="mt-1 text-xs text-white/70">Horario {horario(franjasDe(c.id))}</p>
      </Link>
    );
  }
}

// Botón "Filtro": al tocarlo se abre con el orden (más cerca, mejor
// valoración, menor y mayor precio), "Abierto ahora", "Con stock" y, en
// productos, Marca, Medida y Material. Todo son enlaces: anda sin JavaScript.
function Filtro({
  sp,
  a,
  deProductos,
  opciones,
}: {
  sp: SP;
  a: ReturnType<typeof leerAjustes>;
  deProductos: boolean;
  opciones: Record<Atributo, string[]>;
}) {
  const chip = (activo: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs font-medium transition active:bg-naranja/70 ${activo ? "border-naranja bg-naranja text-white" : "border-white/30 hover:bg-white/10"}`;
  const ordenes = (Object.keys(ORDENES) as Orden[]).filter((o) => deProductos || (o !== "precio" && o !== "precio_mayor"));
  const atributos = deProductos ? (Object.keys(ATRIBUTOS) as Atributo[]).filter((k) => opciones[k].length || a.atributos[k]) : [];
  const activos =
    Number(a.orden !== "cerca") + Number(a.soloAbiertos) + Number(deProductos && a.conStock) + (deProductos ? Object.values(a.atributos).filter(Boolean).length : 0);
  const limpio = con(sp, { orden: null, abierto: null, stock: null, marca: null, medida: null, material: null, comercio: null });
  const grupo = (titulo: string, contenido: React.ReactNode) => (
    <div>
      <p className="mb-2 text-xs font-semibold tracking-wide text-white/70 uppercase">{titulo}</p>
      <div className="flex flex-wrap gap-2">{contenido}</div>
    </div>
  );

  return (
    <details className="group">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/15 active:bg-naranja/70 [&::-webkit-details-marker]:hidden">
        <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        Filtro
        {activos ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-naranja px-1.5 text-[11px] font-bold">{activos}</span> : null}
        <span aria-hidden className="text-white/70 transition group-open:rotate-180">▾</span>
      </summary>
      <div className="mt-4 space-y-4">
        {grupo(
          "Ordenar por",
          ordenes.map((o) => (
            <Link key={o} href={con(sp, { orden: o === "cerca" ? null : o, comercio: null })} scroll={false} aria-pressed={a.orden === o} className={chip(a.orden === o)}>
              {ORDENES[o]}
            </Link>
          )),
        )}
        {grupo(
          "Mostrar",
          <>
            <Link href={con(sp, { abierto: a.soloAbiertos ? null : "1", comercio: null })} scroll={false} aria-pressed={a.soloAbiertos} className={chip(a.soloAbiertos)}>
              {a.soloAbiertos ? "✓ " : ""}Abierto ahora
            </Link>
            {deProductos ? (
              <Link href={con(sp, { stock: a.conStock ? null : "1" })} scroll={false} aria-pressed={a.conStock} className={chip(a.conStock)}>
                {a.conStock ? "✓ " : ""}Con stock
              </Link>
            ) : null}
          </>,
        )}
        {atributos.map((k) => (
          <div key={k}>
            {grupo(
              ATRIBUTOS[k],
              [...new Set([...(a.atributos[k] ? [a.atributos[k]] : []), ...opciones[k]])].map((v) => {
                const elegido = sinAcentos(v) === sinAcentos(a.atributos[k]);
                return (
                  <Link key={v} href={con(sp, { [k]: elegido ? null : v, comercio: null })} scroll={false} aria-pressed={elegido} className={chip(elegido)}>
                    {elegido ? "✓ " : ""}
                    {v}
                  </Link>
                );
              }),
            )}
          </div>
        ))}
        {activos ? (
          <Link href={limpio} scroll={false} className="inline-block text-xs text-white/80 underline">
            Sacar todos los filtros
          </Link>
        ) : null}
      </div>
    </details>
  );
}

function Cargando() {
  return (
    <div className="space-y-3" aria-label="Buscando…">
      <div className="tarjeta h-24 animate-pulse rounded-3xl" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <TarjetaProductoCargando key={i} className="bg-marino" />
        ))}
      </div>
    </div>
  );
}

function Vacio({ children }: { children: React.ReactNode }) {
  return <div className="tarjeta rounded-3xl p-8 text-center text-sm">{children}</div>;
}
