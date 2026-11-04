"use client";

import { startTransition, useActionState } from "react";
import { ErrorCampo } from "@/components/error-campo";
import { guardarPerfil, type EstadoPerfil } from "./acciones";

// Nombre y teléfono del perfil, editables.
export function FormPerfil({ nombre, telefono }: { nombre: string; telefono: string | null }) {
  const [estado, accion, guardando] = useActionState<EstadoPerfil, FormData>(guardarPerfil, {});

  return (
    <form
      // Se envía a mano (no con action=) para que React no vacíe el formulario si hay un error.
      onSubmit={(e) => {
        e.preventDefault();
        const datos = new FormData(e.currentTarget);
        startTransition(() => accion(datos));
      }}
      noValidate
      className="space-y-4"
    >
      <label className="block text-xs">
        Nombre y apellido
        <input
          name="nombre"
          defaultValue={nombre}
          autoComplete="name"
          maxLength={80}
          className="campo mt-1"
          aria-invalid={estado.campos?.nombre ? true : undefined}
        />
        <ErrorCampo>{estado.campos?.nombre}</ErrorCampo>
      </label>
      <label className="block text-xs">
        Teléfono (opcional: lo ve el comercio cuando reservás)
        <input
          name="telefono"
          type="tel"
          defaultValue={telefono ?? ""}
          autoComplete="tel"
          placeholder="11 2345 6789"
          className="campo mt-1"
          aria-invalid={estado.campos?.telefono ? true : undefined}
        />
        <ErrorCampo>{estado.campos?.telefono}</ErrorCampo>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={guardando} className="boton rounded-xl px-5 py-2.5 text-sm font-semibold">
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
        {estado.ok ? (
          <span role="status" className="text-sm text-[#8ce99a]">
            ✔ {estado.ok}
          </span>
        ) : estado.error && !estado.campos ? (
          <ErrorCampo>{estado.error}</ErrorCampo>
        ) : null}
      </div>
    </form>
  );
}
