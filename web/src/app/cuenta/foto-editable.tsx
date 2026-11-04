"use client";

import { useRef, useState } from "react";
import { ErrorCampo } from "@/components/error-campo";
import { motivoImagen, prepararImagen } from "@/lib/imagen";
import { supabaseNavegador } from "@/lib/supabase/navegador";
import { guardarFotoPerfil } from "./acciones";

// Foto de perfil con botones para cambiarla o quitarla. Se guarda apenas se elige.
export function FotoEditable({ usuarioId, inicial, nombre }: { usuarioId: string; inicial: string | null; nombre: string }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(inicial);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");

  async function subir(archivo: File) {
    setSubiendo(true);
    setError("");
    try {
      const foto = await prepararImagen(archivo, 400);
      const ruta = `${usuarioId}/foto-${Date.now()}.jpg`;
      const supabase = supabaseNavegador();
      const { error: errorSubir } = await supabase.storage.from("perfiles").upload(ruta, foto, { contentType: "image/jpeg" });
      if (errorSubir) throw errorSubir;
      const nueva = supabase.storage.from("perfiles").getPublicUrl(ruta).data.publicUrl;
      const r = await guardarFotoPerfil(nueva);
      if (r.error) setError(r.error);
      else setUrl(nueva);
    } catch (e) {
      console.error("[foto perfil]", e);
      setError(motivoImagen(e, archivo));
    }
    setSubiendo(false);
  }

  async function quitar() {
    setSubiendo(true);
    const r = await guardarFotoPerfil(null);
    if (r.error) setError(r.error);
    else setUrl(null);
    setSubiendo(false);
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span
        className={`relative grid h-28 w-28 place-items-center overflow-hidden rounded-full bg-marino-claro text-4xl font-bold ${error ? "border-2 border-[#ff6b6b]" : "border-2 border-white/60"}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- se cambia en el momento, sin pasar por el optimizador */}
        {url ? <img src={url} alt={`Foto de ${nombre}`} className="h-full w-full object-cover" /> : (nombre.trim().charAt(0) || "?").toUpperCase()}
      </span>
      <input
        ref={entrada}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (archivo) subir(archivo);
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap justify-center gap-2 text-xs">
        <button
          type="button"
          disabled={subiendo}
          onClick={() => entrada.current?.click()}
          className="rounded-lg border border-white/40 px-3 py-1.5 hover:bg-white/10 disabled:opacity-50"
        >
          {subiendo ? "Guardando…" : url ? "Cambiar foto" : "Subir foto de perfil"}
        </button>
        {url && !subiendo ? (
          <button type="button" onClick={quitar} className="underline">
            Quitar
          </button>
        ) : null}
      </div>
      <ErrorCampo>{error}</ErrorCampo>
    </div>
  );
}
