import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { usuarioActual } from "@/lib/sesion";
import { BorrarCuenta } from "./borrar-cuenta";

export const metadata: Metadata = { title: "Mi cuenta" };

export default function PaginaCuenta() {
  return (
    <Suspense fallback={<div className="tarjeta mx-auto h-72 max-w-xl animate-pulse rounded-3xl" />}>
      <Cuenta />
    </Suspense>
  );
}

async function Cuenta() {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/ingresar?siguiente=/cuenta");

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <section className="tarjeta rounded-3xl p-6">
        <h1 className="text-2xl font-bold">Mi cuenta</h1>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-white/70">Nombre</dt>
          <dd>{usuario.nombre || "—"}</dd>
          <dt className="text-white/70">Mail</dt>
          <dd className="break-all">{usuario.email}</dd>
          <dt className="text-white/70">Uso</dt>
          <dd>{usuario.rol === "comerciante" ? "Tengo un comercio" : "Compro"}</dd>
        </dl>
      </section>
      <section className="tarjeta rounded-3xl p-6">
        <h2 className="text-lg font-semibold">Borrar mi cuenta</h2>
        <BorrarCuenta comerciante={usuario.rol === "comerciante"} />
      </section>
    </div>
  );
}
