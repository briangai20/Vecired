import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Estrellas } from "@/components/insignias";
import { usuarioActual } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { BorrarCuenta } from "./borrar-cuenta";
import { FormPerfil } from "./form-perfil";
import { FotoEditable } from "./foto-editable";

export const metadata: Metadata = { title: "Mi perfil" };

export default function PaginaCuenta() {
  return (
    <Suspense fallback={<div className="tarjeta mx-auto h-72 max-w-3xl animate-pulse rounded-3xl" />}>
      <Cuenta />
    </Suspense>
  );
}

const fecha = (f: string) =>
  new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "long", year: "numeric" }).format(new Date(f));

async function Cuenta() {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/ingresar?siguiente=/cuenta");

  const supabase = await supabaseServidor();
  const [{ data: perfil }, { data: auth }, { count: reservas }, { count: retiradas }, { data: resenas }, { data: comercio }] = await Promise.all([
    supabase.from("perfiles").select("*").eq("id", usuario.id).maybeSingle(),
    supabase.auth.getUser(),
    supabase.from("reservas").select("id", { count: "exact", head: true }).eq("comprador_id", usuario.id),
    supabase.from("reservas").select("id", { count: "exact", head: true }).eq("comprador_id", usuario.id).eq("estado", "retirada"),
    supabase
      .from("resenas")
      .select("id, estrellas, texto, creada_en, comercio:comercios(id, nombre)")
      .eq("autor_id", usuario.id)
      .order("creada_en", { ascending: false }),
    usuario.rol === "comerciante"
      ? supabase.from("comercios").select("id, nombre, aprobado").eq("dueno_id", usuario.id).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const meta = auth.user?.user_metadata ?? {};

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <section className="tarjeta rounded-3xl p-6">
        <h1 className="text-2xl font-bold">Mi perfil</h1>
        <div className="mt-6 grid gap-6 sm:grid-cols-[auto_1fr]">
          <FotoEditable usuarioId={usuario.id} inicial={perfil?.foto_url ?? null} nombre={usuario.nombre} />
          <FormPerfil nombre={perfil?.nombre ?? usuario.nombre} telefono={perfil?.telefono ?? null} />
        </div>
        <p className="mt-4 text-xs text-white/70">Tu foto y tu nombre (solo el apellido abreviado) se ven en las reseñas que escribís.</p>
      </section>

      <section className="tarjeta rounded-3xl p-6">
        <h2 className="text-lg font-semibold">Datos de la cuenta</h2>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-white/70">Mail</dt>
          <dd className="break-all">{usuario.email}</dd>
          <dt className="text-white/70">Tipo de cuenta</dt>
          <dd>{usuario.rol === "comerciante" ? "Comerciante (tengo un comercio)" : "Comprador"}</dd>
          {comercio ? (
            <>
              <dt className="text-white/70">Mi comercio</dt>
              <dd>
                <Link href="/comerciante" className="underline">
                  {comercio.nombre}
                </Link>
                {comercio.aprobado ? " · Publicado" : " · En revisión"}
              </dd>
            </>
          ) : null}
          {perfil?.creado_en ? (
            <>
              <dt className="text-white/70">En VeciRed desde</dt>
              <dd>{fecha(perfil.creado_en)}</dd>
            </>
          ) : null}
          {typeof meta.acepto_terminos_en === "string" ? (
            <>
              <dt className="text-white/70">Términos aceptados</dt>
              <dd>
                {fecha(meta.acepto_terminos_en)}
                {typeof meta.acepto_terminos === "string" ? ` (versión ${meta.acepto_terminos})` : ""} ·{" "}
                <Link href="/terminos" className="underline">
                  Ver términos
                </Link>
              </dd>
            </>
          ) : null}
          <dt className="text-white/70">Reservas</dt>
          <dd>
            {reservas ?? 0} en total · {retiradas ?? 0} retiradas ·{" "}
            <Link href="/reservas" className="underline">
              Ver mis reservas
            </Link>
          </dd>
        </dl>
      </section>

      <section className="tarjeta rounded-3xl p-6">
        <h2 className="text-lg font-semibold">Mis reseñas ({resenas?.length ?? 0})</h2>
        {resenas?.length ? (
          <ul className="mt-3 space-y-3">
            {resenas.map((r) => (
              <li key={r.id} className="rounded-2xl border border-white/20 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {r.comercio ? (
                    <Link href={`/comercio/${r.comercio.id}`} className="font-semibold underline">
                      {r.comercio.nombre}
                    </Link>
                  ) : (
                    <span className="font-semibold">Comercio</span>
                  )}
                  <span className="text-xs text-white/70">{fecha(r.creada_en)}</span>
                </div>
                <div className="mt-1">
                  <Estrellas valor={r.estrellas} />
                </div>
                {r.texto ? <p className="mt-2">{r.texto}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-white/80">Todavía no escribiste reseñas. Podés dejar una después de retirar un pedido.</p>
        )}
      </section>

      <section className="tarjeta rounded-3xl p-6">
        <h2 className="text-lg font-semibold">Borrar mi cuenta</h2>
        <BorrarCuenta comerciante={usuario.rol === "comerciante"} />
      </section>
    </div>
  );
}
