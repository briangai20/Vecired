import Link from "next/link";
import { Suspense } from "react";
import { Filtros, type ValoresFiltro } from "@/components/filtros";
import { FotoProducto } from "@/components/foto-producto";
import { Abierto, Estrellas, Stock } from "@/components/insignias";
import { ListaConMas } from "@/components/lista-con-mas";
import { LogoComercio } from "@/components/logo-comercio";
import { MapaComercios } from "@/components/mapa-comercios";
import { abiertoAhora, disponibilidad, fechaAR, horario, km, nota, plata, promedio, viaje } from "@/lib/formato";
import { iconoRubro, nombreRubro, sinAcentos } from "@/lib/rubros";
import { supabasePublico } from "@/lib/supabase/publico";
import { CENTROS, RADIO_INICIAL, ZONA_INICIAL } from "@/lib/zonas";

type Params = PageProps<"/">["searchParams"];
type SP = Awaited<Params>;

const ORDENES = { cerca: "Más cerca", precio: "Menor precio", valorados: "Mejor valorados" } as const;
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
        <Portada searchParams={searchParams} />
      </Suspense>
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Suspense fallback={<div className="tarjeta h-16 animate-pulse rounded-3xl lg:h-72" />}>
            <FiltrosConZonas searchParams={searchParams} />
          </Suspense>
        </aside>
        <section className="tarjeta min-w-0 rounded-3xl p-4 sm:p-5">
          <Suspense fallback={<Cargando />}>
            <Resultados searchParams={searchParams} />
          </Suspense>
        </section>
      </div>
    </div>
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
      <section className="tarjeta overflow-hidden rounded-3xl p-5 sm:p-8">
        <div className="grid items-center gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <h1 className="text-2xl leading-tight font-black tracking-tight sm:text-4xl">
              Lo que necesitás, <span className="text-naranja-vivo">en tu barrio.</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm text-white/85 sm:text-base">
              Mirá precio y stock de los comercios cercanos, reservá desde el celular y retiralo hoy en el local. Sin envíos ni esperas.
            </p>
            <p className="mt-4 text-sm">
              <Link href="/comercios" className="font-semibold text-naranja-vivo underline">
                ¿Tenés un comercio? Sumalo gratis
              </Link>
            </p>
          </div>
          <ol className="grid grid-cols-3 gap-2 text-center sm:gap-3">
            {[
              ["🔎", "Buscá", "Productos con precio y stock"],
              ["📲", "Reservá", "El comercio te lo guarda"],
              ["🏪", "Retirá", "Pagás en el local"],
            ].map(([icono, titulo, detalle], i) => (
              <li key={titulo} className="rounded-2xl border border-white/20 p-3 sm:p-4">
                <span aria-hidden className="text-2xl sm:text-3xl">{icono}</span>
                <p className="mt-1 text-sm font-bold">
                  {i + 1}. {titulo}
                </p>
                <p className="mt-0.5 hidden text-xs text-white/75 sm:block">{detalle}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {rubros.length ? (
        <nav aria-label="Rubros">
          <h2 className="mb-2 text-sm font-semibold text-marino">Explorá por rubro</h2>
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
      const directo = sinAcentos([p.nombre, p.marca, p.descripcion, p.grupo, p.codigo].filter(Boolean).join(" ")).includes(buscado);
      return { p, c, d: disponibilidad(p, ahora), directo, sirve: directo || sinAcentos(`${c.nombre} ${c.rubro}`).includes(buscado) };
    })
    .filter((x) => x.sirve && (!a.conStock || x.d.sePuede));
  productos = productos.sort((x, y) =>
    Number(y.directo) - Number(x.directo) ||
    (a.orden === "precio"
      ? (x.p.precio ?? Infinity) - (y.p.precio ?? Infinity) || x.c.distancia_km - y.c.distancia_km
      : a.orden === "valorados"
        ? (valoracion.get(y.c.id) ?? 0) - (valoracion.get(x.c.id) ?? 0) || x.c.distancia_km - y.c.distancia_km
        : x.c.distancia_km - y.c.distancia_km),
  );

  const elegido = lista.find((c) => c.id === leerElegido(sp));
  const conBusqueda = Boolean(f.q);
  const verProductos = conBusqueda && !a.verComercios;

  return (
    <>
      {conBusqueda ? (
        <div className="mb-4">
          <h1 className="text-lg font-semibold break-words">
            Resultados para “{f.q}” <span className="font-normal text-white/75">a menos de {f.radio} km</span>
          </h1>
          <div className="mt-3 flex gap-1 rounded-2xl border border-white/20 p-1" role="tablist" aria-label="Qué ver">
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
                  className={`flex-1 rounded-xl px-3 py-2 text-center text-sm font-medium transition ${activo ? "bg-white text-marino" : "hover:bg-white/10"}`}
                >
                  {etiqueta}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      <Ajustes sp={sp} a={a} conStock={verProductos} />

      {verProductos ? (
        productos.length === 0 ? (
          <Vacio>
            No encontramos productos con “{f.q}” {a.soloAbiertos || a.conStock ? "con esos filtros " : ""}a menos de {f.radio} km.
            <br />
            Probá con otra palabra, ampliá el radio o{" "}
            <Link href={con(sp, { ver: "comercios" })} className="underline">
              mirá los comercios
            </Link>
            .
          </Vacio>
        ) : (
          <ListaConMas deA={12} que="productos" className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {productos.map(({ p, c, d }) => (
              <Link
                key={p.id}
                href={`/producto/${p.id}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-white/20 transition hover:-translate-y-0.5 hover:border-white/60"
              >
                <div className="relative aspect-square overflow-hidden bg-marino-claro">
                  <FotoProducto url={p.foto_url} nombre={p.nombre} sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 50vw" />
                  <span className="absolute top-2 left-2">
                    <Stock d={d} />
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-3">
                  <p className="line-clamp-2 text-sm leading-snug font-medium">{p.nombre}</p>
                  <p className="mt-1 text-lg font-black">{plata(p.precio)}</p>
                  <p className="mt-auto pt-2 text-xs break-words text-white/80">
                    {c.nombre} · {km(c.distancia_km)}
                  </p>
                  <p className={`text-[11px] font-semibold ${abierto.get(c.id) ? "text-white" : "text-white/55"}`}>
                    {abierto.get(c.id) ? "● Abierto ahora" : "Cerrado ahora"}
                  </p>
                </div>
              </Link>
            ))}
          </ListaConMas>
        )
      ) : (
        <>
          <div className="mt-4 mb-6">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">Mapa</h2>
              <span className="text-xs text-white/80">Tocá un comercio para ver sus datos</span>
            </div>
            <MapaComercios
              centro={centro}
              radioKm={f.radio}
              seleccionado={elegido?.id}
              elegirEnLista
              comercios={lista.map((c) => ({ id: c.id, nombre: c.nombre, rubro: c.rubro, direccion: c.direccion, lat: c.lat, lng: c.lng, logo_url: c.logo_url }))}
            />
          </div>

          {elegido ? (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">{elegido.nombre}</h2>
                <Link href={con(sp, { comercio: null })} scroll={false} className="text-xs underline">
                  Ver los {lista.length} comercios a menos de {f.radio} km
                </Link>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {tarjeta(elegido)}
                <div className="flex flex-col justify-center gap-2">
                  <Link href={`/comercio/${elegido.id}`} className="boton rounded-xl px-4 py-3 text-center text-sm font-semibold">
                    Ver catálogo
                  </Link>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${elegido.lat},${elegido.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl border border-white/40 px-4 py-3 text-center text-sm hover:bg-white/10"
                  >
                    Cómo llegar
                  </a>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">{conBusqueda ? "Comercios" : "Comercios cercanos"}</h2>
              <span className="text-xs text-white/80">
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
            <ListaConMas deA={9} que="comercios" className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {lista.map(tarjeta)}
            </ListaConMas>
          )}
        </>
      )}
    </>
  );

  function tarjeta(c: (typeof lista)[number]) {
    const prom = valoracion.get(c.id) ?? null;
    const t = viaje(c.distancia_km);
    return (
      <Link
        key={c.id}
        href={`/comercio/${c.id}`}
        className="block rounded-2xl border border-white/20 p-4 transition hover:-translate-y-0.5 hover:border-white/60"
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

// Orden y filtros rápidos, como botones (funcionan sin JavaScript).
function Ajustes({ sp, a, conStock }: { sp: SP; a: ReturnType<typeof leerAjustes>; conStock: boolean }) {
  const chip = (activo: boolean) =>
    `shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${activo ? "border-white bg-white text-marino" : "border-white/30 hover:bg-white/10"}`;
  const ordenes = (Object.keys(ORDENES) as Orden[]).filter((o) => conStock || o !== "precio");
  return (
    <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
      <span className="shrink-0 text-xs text-white/70">Ordenar:</span>
      {ordenes.map((o) => (
        <Link key={o} href={con(sp, { orden: o === "cerca" ? null : o, comercio: null })} scroll={false} aria-pressed={a.orden === o} className={chip(a.orden === o)}>
          {ORDENES[o]}
        </Link>
      ))}
      <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-white/20" />
      <Link href={con(sp, { abierto: a.soloAbiertos ? null : "1", comercio: null })} scroll={false} aria-pressed={a.soloAbiertos} className={chip(a.soloAbiertos)}>
        {a.soloAbiertos ? "✓ " : ""}Abierto ahora
      </Link>
      {conStock ? (
        <Link href={con(sp, { stock: a.conStock ? null : "1" })} scroll={false} aria-pressed={a.conStock} className={chip(a.conStock)}>
          {a.conStock ? "✓ " : ""}Con stock
        </Link>
      ) : null}
    </div>
  );
}

function Cargando() {
  return (
    <div className="space-y-3" aria-label="Buscando…">
      <div className="h-6 w-1/2 animate-pulse rounded-lg bg-white/10" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-2xl bg-white/10" />
        ))}
      </div>
    </div>
  );
}

function Vacio({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 rounded-2xl border border-dashed border-white/30 p-8 text-center text-sm">{children}</div>;
}
