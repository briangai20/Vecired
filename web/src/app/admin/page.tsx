import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { usuarioActual } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { revisarComercio } from "./acciones";

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

  return (
    <div className="space-y-6">
      <div className="tarjeta rounded-3xl p-6">
        <h1 className="text-2xl font-bold">Administración</h1>
        <p className="mt-1 text-sm text-white/80">
          Revisá cada comercio antes de publicarlo: que exista, que la dirección y el pin coincidan y que el rubro sea el que dice.
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
            <article key={c.id} className="tarjeta rounded-3xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">{c.nombre}</h2>
                  <p className="text-sm text-white/80">
                    {c.rubro} · {c.zona}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-white/70">Alta {fecha(c.creado_en)}</span>
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
                      <a href={`https://wa.me/${c.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="underline">
                        {c.whatsapp}
                      </a>
                    </dd>
                  </>
                ) : null}
                <dt className="text-white/70">Productos</dt>
                <dd>{c.productos}</dd>
                <dt className="text-white/70">Horario</dt>
                <dd>{c.con_horario ? "Cargado" : <span className="text-[#ffb4a2]">Sin cargar</span>}</dd>
                {c.revisado_en ? (
                  <>
                    <dt className="text-white/70">Revisado</dt>
                    <dd>{fecha(c.revisado_en)}</dd>
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
                  <form action={revisarComercio}>
                    <input type="hidden" name="comercio" value={c.id} />
                    <input type="hidden" name="ver" value={ver} />
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
                      <label className="block text-xs">
                        Motivo (lo ve el comerciante)
                        <textarea name="motivo" required maxLength={500} rows={3} className="campo mt-1" placeholder="Ej.: el pin no coincide con la dirección. Movelo a la puerta del local." />
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
