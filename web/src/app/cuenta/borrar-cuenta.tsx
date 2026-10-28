"use client";

import { useActionState, useState } from "react";
import { borrarCuenta, type EstadoBaja } from "./acciones";

export function BorrarCuenta({ comerciante }: { comerciante: boolean }) {
  const [estado, accion, borrando] = useActionState<EstadoBaja, FormData>(borrarCuenta, {});
  const [confirmacion, setConfirmacion] = useState("");
  const listo = confirmacion.trim().toUpperCase() === "BORRAR";

  return (
    <form action={accion} className="mt-4 space-y-3">
      <ul className="list-disc space-y-1 pl-5 text-sm text-white/85">
        <li>Se borran tu cuenta, tus datos, tus reservas y tus reseñas.</li>
        {comerciante ? <li>También se borra tu comercio, con sus productos, fotos, horarios y estadísticas.</li> : null}
        <li>No se puede deshacer. Si querés volver, vas a tener que crear una cuenta nueva.</li>
      </ul>
      <label className="block text-sm">
        Para confirmar, escribí <b>BORRAR</b>
        <input
          name="confirmacion"
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.target.value)}
          autoComplete="off"
          className="campo mt-1"
        />
      </label>
      {estado.error ? (
        <p role="alert" className="rounded-xl bg-red-500/20 px-3 py-2 text-sm">
          {estado.error}
        </p>
      ) : null}
      <button disabled={!listo || borrando} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40">
        {borrando ? "Borrando…" : "Borrar mi cuenta"}
      </button>
    </form>
  );
}
