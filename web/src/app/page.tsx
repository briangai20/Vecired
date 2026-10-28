import Link from "next/link";
import { Suspense } from "react";
import { Filtros, type ValoresFiltro } from "@/components/filtros";
import { Abierto, Estrellas } from "@/components/insignias";
import { MapaComercios } from "@/components/mapa-comercios";
import { abiertoAhora, fechaAR, horario, km, nota, promedio, viaje } from "@/lib/formato";
import { supabasePublico } from "@/lib/supabase/publico";
import { CENTROS, RADIO_INICIAL, ZONA_INICIAL } from "@/lib/zonas";

type Params = PageProps<"/">["searchParams"];

function leerFiltro(sp: Awaited<Params>): ValoresFiltro {
  const texto = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const numero = (k: string) => {
    const n = Number(texto(k));
    return texto(k) !== "" && Number.isFinite(n) ? n : undefined;
  };
  const zona = CENTROS[texto("zona")] ? texto("zona") : ZONA_INICIAL;
  const radio = Math.min(20, Math.max(1, Math.round(numero("radio") ?? RADIO_INICIAL)));
  const lat = numero("lat");
  const lng = numero("lng");
  const ubicacionValida = lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  return {
    q: texto("q"),
    zona,
    radio,
    ...(ubicacionValida ? { lat, lng, lugar: texto("lugar").slice(0, 120) || undefined } : {}),
  };
}

// Comercio tocado en el mapa (?comercio=id).
function leerElegido(sp: Awaited<Params>) {
  const n = Number(typeof sp.comercio === "string" ? sp.comercio : "");
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

// La misma búsqueda sin el comercio elegido, para volver a ver todos.
function sinElegido(sp: Awaited<Params>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (k !== "comercio" && typeof v === "string") p.set(k, v);
  return `/?${p}`;
}

export default function Inicio({ searchParams }: PageProps<"/">) {
  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <aside>
        <Suspense fallback={<div className="tarjeta h-72 animate-pulse rounded-3xl" />}>
          <FiltrosConZonas searchParams={searchParams} />
        </Suspense>
      </aside>
      <section className="tarjeta rounded-3xl p-5">
        <Suspense fallback={<p className="py-10 text-center text-sm text-white/80">Buscando comercios cercanos…</p>}>
          <Resultados searchParams={searchParams} />
        </Suspense>
      </section>
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
  const centro = f.lat != null && f.lng != null ? { lat: f.lat, lng: f.lng } : CENTROS[f.zona];
  const db = supabasePublico();

  const { data: comercios, error } = await db.rpc("comercios_cercanos", {
    p_lat: centro.lat,
    p_lng: centro.lng,
    p_radio_km: f.radio,
    p_busqueda: f.q || undefined,
  });

  if (error) {
    return <Vacio>No pudimos cargar los comercios. Probá de nuevo en un rato.</Vacio>;
  }

  const lista = comercios ?? [];
  const elegido = lista.find((c) => c.id === leerElegido(sp));
  const ids = lista.map((c) => c.id);
  const [{ data: resenas }, { data: horarios }] = ids.length
    ? await Promise.all([
        db.from("resenas").select("comercio_id, estrellas").in("comercio_id", ids),
        db.from("horarios").select("*").in("comercio_id", ids),
      ])
    : [{ data: [] }, { data: [] }];
  const franjasDe = (id: number) => (horarios ?? []).filter((h) => h.comercio_id === id);
  const ahora = new Date();
  // Qué comercios están cerrados hoy por feriado o cierre puntual.
  const cerradosHoy = new Set(
    (
      await Promise.all(ids.map((id) => db.rpc("dias_cerrados", { p_comercio: id, p_desde: fechaAR(ahora), p_hasta: fechaAR(ahora) })))
    ).flatMap((r, i) => (r.data?.length ? [ids[i]] : [])),
  );

  return (
    <>
      <div className="mb-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Mapa</h2>
          <span className="text-xs text-white/80">Tocá un comercio para ver sus datos</span>
        </div>
        <MapaComercios
          centro={centro}
          radioKm={f.radio}
          seleccionado={elegido?.id}
          elegirEnLista
          comercios={lista.map((c) => ({ id: c.id, nombre: c.nombre, rubro: c.rubro, direccion: c.direccion, lat: c.lat, lng: c.lng }))}
        />
      </div>

      {elegido ? (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-lg font-semibold">{elegido.nombre}</h1>
            <Link href={sinElegido(sp)} scroll={false} className="text-xs underline">
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
          <h1 className="text-lg font-semibold">Comercios cercanos</h1>
          <span className="text-xs text-white/80">
            {lista.length} {lista.length === 1 ? "comercio" : "comercios"} a menos de {f.radio} km
          </span>
        </div>
      )}

      {elegido ? null : lista.length === 0 ? (
        <Vacio>
          {f.q
            ? `No hay comercios con "${f.q}" dentro de ${f.radio} km. Probá ampliar el radio o buscar otra palabra.`
            : `Todavía no hay comercios cargados dentro de ${f.radio} km. Estamos sumando locales de a uno.`}
        </Vacio>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{lista.map(tarjeta)}</div>
      )}
    </>
  );

  function tarjeta(c: (typeof lista)[number]) {
    const prom = promedio((resenas ?? []).filter((r) => r.comercio_id === c.id).map((r) => r.estrellas));
    const t = viaje(c.distancia_km);
    return (
      <Link
        key={c.id}
        href={`/comercio/${c.id}`}
        className="block rounded-2xl border border-white/20 p-4 transition hover:-translate-y-0.5 hover:border-white/60"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{c.nombre}</p>
            <p className="text-xs text-white/80">{c.rubro}</p>
          </div>
          <Abierto abierto={abiertoAhora(franjasDe(c.id), ahora, cerradosHoy.has(c.id) ? [fechaAR(ahora)] : [])} />
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
        <p className="mt-2 truncate text-xs text-white/70">{c.direccion}</p>
        <p className="mt-1 text-xs text-white/70">Horario {horario(franjasDe(c.id))}</p>
      </Link>
    );
  }
}

function Vacio({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-white/30 p-8 text-center text-sm">{children}</div>
  );
}
