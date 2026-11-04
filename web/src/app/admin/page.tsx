import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { usuarioActual } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import Image from "next/image";
import { LogoComercio } from "@/components/logo-comercio";
import { enlaceWhatsapp } from "@/lib/whatsapp";
import { revisarComercio } from "./acciones";
import { chequeos, CONTROLES, distanciaDireccionPin, enlacesVerificacion, MOTIVOS, type Chequeo, type Control } from "./verificar";

export const metadata: Metadata = { title: "Administración", robots: { index: false } };

export default function PaginaAdmin({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<div className="tarjeta h-96 animate-pulse rounded-3xl" />}>
      <Panel searchParams={searchParams} />
    </Suspense>
  );
}

const VISTAS = {
  pendientes: "En revisión",
  rechazados: "Rechazados",
  publicados: "Publicados",
} as const;
type Vista = keyof typeof VISTAS;

const fecha = (f: string) =>
  new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(f));

async function Panel({ searchParams }: Pick<PageProps<"/admin">, "searchParams">) {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/ingresar?siguiente=/admin");
  if (!usuario.admin) notFound();

  const { ver: verParam, error, ok } = await searchParams;
  const ver: Vista = typeof verParam === "string" && verParam in VISTAS ? (verParam as Vista) : "pendientes";

  const supabase = await supabaseServidor();
  const { data } = await supabase.rpc("comercios_para_revisar");
  const todos = data ?? [];
  const vistaDe = (c: (typeof todos)[number]): Vista => (c.aprobado ? "publicados" : c.motivo_rechazo ? "rechazados" : "pendientes");
  const lista = todos.filter((c) => vistaDe(c) === ver);
  const cuantos = (v: Vista) => todos.filter((c) => vistaDe(c) === v).length;
  // Dónde queda la dirección escrita respecto del pin (solo los que hay que revisar).
  const metros = new Map(
    await Promise.all(
      lista.map(
        async (c) =>
          [c.id, ver === "publicados" || c.lat == null || c.lng == null ? null : await distanciaDireccionPin(c.direccion, c.zona, { lat: c.lat, lng: c.lng })] as const,
      ),
    ),
  );

  return (
    <div className="space-y-6">
      <div className="tarjeta rounded-3xl p-6">
        <h1 className="text-2xl font-bold">Administración</h1>
        <p className="mt-1 text-sm text-white/80">
          Revisá cada comercio antes de publicarlo. En cada uno ves las comprobaciones automáticas; usá los links para buscarlo en Google, verlo
          en Street View o escribirle al dueño, y marcá lo que confirmaste.
        </p>
        <nav className="mt-4 flex flex-wrap gap-1 rounded-2xl border border-white/20 p-1 sm:inline-flex" aria-label="Estado">
          {(Object.keys(VISTAS) as Vista[]).map((v) => (
            <Link
              key={v}
              href={`/admin?ver=${v}`}
              aria-current={v === ver ? "page" : undefined}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${v === ver ? "bg-white text-marino" : "hover:bg-white/10"}`}
            >
              {VISTAS[v]} ({cuantos(v)})
            </Link>
          ))}
        </nav>
      </div>

      {typeof error === "string" ? (
        <p role="alert" className="rounded-2xl border border-naranja bg-naranja/15 p-4 text-sm">
          {error}
        </p>
      ) : typeof ok === "string" ? (
        <p role="status" className="rounded-2xl border border-marino/30 bg-white p-4 text-sm">
          {ok}
        </p>
      ) : null}

      {lista.length === 0 ? (
        <p className="tarjeta rounded-3xl p-6 text-sm text-white/85">
          {ver === "pendientes" ? "No hay comercios esperando revisión." : "No hay comercios en esta lista."}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {lista.map((c) => (
            <article key={c.id} id={`c${c.id}`} className="tarjeta min-w-0 rounded-3xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <LogoComercio url={c.logo_url} nombre={c.nombre} />
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold break-words">{c.nombre}</h2>
                  <p className="text-sm text-white/80">
                    {c.rubro} · {c.zona}
                  </p>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-white/70">Alta {fecha(c.creado_en)}</span>
              </div>

              <Chequeos lista={chequeos({ ...c, metros: metros.get(c.id) })} />

              {c.foto_local_url ? (
                <a href={c.foto_local_url} target="_blank" rel="noreferrer" className="relative mt-3 block aspect-video overflow-hidden rounded-2xl border border-white/20">
                  <Image src={c.foto_local_url} alt={`Frente de ${c.nombre}`} fill sizes="(min-width: 768px) 40vw, 90vw" className="object-cover" />
                  <span className="absolute bottom-2 left-2 rounded-full bg-marino/90 px-2.5 py-0.5 text-[11px]">Foto del frente que subió el dueño</span>
                </a>
              ) : null}

              <div className="mt-3">
                <p className="text-xs text-white/70">Buscalo por afuera de VeciRed:</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {enlacesVerificacion(c).map((e) => (
                    <a key={e.texto} href={e.href} target="_blank" rel="noreferrer" className="rounded-full border border-white/30 px-3 py-1 text-xs hover:bg-white/10">
                      {e.texto} ↗
                    </a>
                  ))}
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
                <dt className="text-white/70">Dirección</dt>
                <dd>
                  {c.direccion}
                  {c.lat != null && c.lng != null ? (
                    <>
                      {" · "}
                      <a href={`https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`} target="_blank" rel="noreferrer" className="underline">
                        Ver el pin en Google Maps
                      </a>
                    </>
                  ) : (
                    <span className="text-[#ffb4a2]"> · Sin pin en el mapa</span>
                  )}
                </dd>
                <dt className="text-white/70">Dueño</dt>
                <dd>
                  {c.dueno_nombre || "Sin nombre"} ·{" "}
                  <a href={`mailto:${c.dueno_email}`} className="underline">
                    {c.dueno_email}
                  </a>
                  {c.dueno_telefono ? ` · ${c.dueno_telefono}` : ""}
                </dd>
                {c.whatsapp ? (
                  <>
                    <dt className="text-white/70">WhatsApp</dt>
                    <dd>
                      <a href={enlaceWhatsapp(c.whatsapp) ?? "#"} target="_blank" rel="noreferrer" className="underline">
                        {c.whatsapp}
                      </a>
                    </dd>
                  </>
                ) : null}
                {c.revisado_en ? (
                  <>
                    <dt className="text-white/70">Revisado</dt>
                    <dd>{fecha(c.revisado_en)}</dd>
                  </>
                ) : null}
                {c.aprobado && c.controles?.length ? (
                  <>
                    <dt className="text-white/70">Controles</dt>
                    <dd>{c.controles.map((k) => CONTROLES[k as Control]?.split(" (")[0] ?? k).join(" · ")}</dd>
                  </>
                ) : null}
              </dl>

              {c.motivo_rechazo ? (
                <p className="mt-3 rounded-xl border border-white/20 p-3 text-sm">
                  <span className="text-white/70">Motivo: </span>
                  {c.motivo_rechazo}
                </p>
              ) : null}

              <div className="mt-4 space-y-3">
                {!c.aprobado ? (
                  <form action={revisarComercio} className="space-y-2">
                    <input type="hidden" name="comercio" value={c.id} />
                    <input type="hidden" name="ver" value={ver} />
                    <fieldset className="space-y-1.5 rounded-2xl border border-white/20 p-3">
                      <legend className="px-1 text-xs font-semibold">Lo que confirmaste</legend>
                      {(Object.keys(CONTROLES) as Control[]).map((k) => (
                        <label key={k} className="flex items-start gap-2 text-xs">
                          <input type="checkbox" name="control" value={k} required={k === "existe"} className="mt-0.5 h-4 w-4 shrink-0 accent-white" />
                          <span>
                            {CONTROLES[k]}
                            {k === "existe" ? <span className="text-white/70"> (obligatorio)</span> : null}
                          </span>
                        </label>
                      ))}
                    </fieldset>
                    <button name="accion" value="aprobar" className="boton w-full rounded-xl py-2.5 text-sm font-semibold">
                      {c.motivo_rechazo ? "Aprobar igual y publicar" : "Aprobar y publicar"}
                    </button>
                  </form>
                ) : null}
                {!c.motivo_rechazo ? (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-white/85">{c.aprobado ? "Despublicar" : "Rechazar"}</summary>
                    <form action={revisarComercio} className="mt-2 space-y-2">
                      <input type="hidden" name="comercio" value={c.id} />
                      <input type="hidden" name="ver" value={ver} />
                      <fieldset className="space-y-1.5">
                        <legend className="text-xs">Motivo (lo ve el comerciante)</legend>
                        {MOTIVOS.map((m, i) => (
                          <label key={m} className="flex items-start gap-2 text-xs">
                            <input type="radio" name="motivo_rapido" value={m} defaultChecked={i === 0} className="mt-0.5 h-4 w-4 shrink-0 accent-white" />
                            <span>{m}</span>
                          </label>
                        ))}
                      </fieldset>
                      <label className="block text-xs">
                        U otro motivo (si lo escribís, se usa este)
                        <textarea name="motivo" maxLength={500} rows={2} className="campo mt-1" placeholder="Ej.: el rubro no coincide con lo que vende." />
                      </label>
                      <button name="accion" value="rechazar" className="w-full rounded-xl border border-white/40 py-2 text-sm hover:bg-white/10">
                        {c.aprobado ? "Despublicar" : "Rechazar"}
                      </button>
                    </form>
                  </details>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Chequeos({ lista }: { lista: Chequeo[] }) {
  const bien = lista.filter((x) => x.ok === true).length;
  return (
    <div className="mt-4 rounded-2xl border border-white/20 p-3">
      <p className="text-xs font-semibold">
        Comprobaciones automáticas: {bien} de {lista.length} bien
      </p>
      <ul className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
        {lista.map((x) => (
          <li key={x.texto} className="flex gap-1.5">
            <span aria-hidden className={x.ok === true ? "text-[#8ce99a]" : x.ok === false ? "text-[#ffb4a2]" : "text-white/50"}>
              {x.ok === true ? "✔" : x.ok === false ? "✖" : "•"}
            </span>
            <span className={x.ok === false ? "text-[#ffb4a2]" : ""}>{x.texto}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
