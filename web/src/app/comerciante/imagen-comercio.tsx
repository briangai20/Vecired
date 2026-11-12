"use client";

import { useRef, useState } from "react";
import { ErrorCampo } from "@/components/error-campo";
import { motivoImagen as motivo, prepararImagen as preparar } from "@/lib/imagen";
import { supabaseNavegador } from "@/lib/supabase/navegador";

// Logo o foto del frente del local: se sube apenas se elige y el formulario
// manda su dirección en el campo "name" al guardar.
export function ImagenComercio({
  comercioId,
  name,
  inicial,
  tipo,
}: {
  comercioId: number;
  name: string;
  inicial: string | null;
  tipo: "logo" | "frente";
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(inicial ?? "");
  const [estado, setEstado] = useState<"" | "subiendo" | "error">("");
  const [problema, setProblema] = useState("");

  async function subir(archivo: File) {
    setEstado("subiendo");
    setProblema("");
    try {
      const foto = await preparar(archivo, tipo === "logo" ? 400 : 1200);
      const ruta = `${comercioId}/${tipo}-${Date.now()}.jpg`;
      const supabase = supabaseNavegador();
      const { error } = await supabase.storage.from("productos").upload(ruta, foto, { contentType: "image/jpeg" });
      if (error) throw error;
      setUrl(supabase.storage.from("productos").getPublicUrl(ruta).data.publicUrl);
      setEstado("");
    } catch (e) {
      console.error("[imagen comercio]", e);
      setProblema(motivo(e, archivo));
      setEstado("error");
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 text-xs">
        <input type="hidden" name={name} value={url} />
        <div
          className={`grid shrink-0 place-items-center overflow-hidden bg-marino-claro text-white/50 ${estado === "error" ? "border-2 border-[#ff6b6b]" : "border border-white/30"} ${tipo === "logo" ? "h-16 w-16 rounded-full" : "h-16 w-24 rounded-xl"}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- vista previa de la imagen recién subida */}
          {url ? <img src={url} alt="" className={`h-full w-full bg-white ${tipo === "logo" ? "object-contain" : "object-cover"}`} /> : tipo === "logo" ? "Logo" : "Frente"}
        </div>
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
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={estado === "subiendo"}
            onClick={() => entrada.current?.click()}
            className="rounded-lg border border-white/40 px-3 py-1.5 hover:bg-white/10 disabled:opacity-50"
          >
            {estado === "subiendo" ? "Subiendo…" : url ? "Cambiar" : tipo === "logo" ? "Subir logo" : "Subir foto"}
          </button>
          {url ? (
            <button type="button" onClick={() => setUrl("")} className="rounded-lg border border-white/30 px-3 py-1.5 hover:bg-white/10">
              Quitar
            </button>
          ) : null}
        </div>
      </div>
      <ErrorCampo>{estado === "error" ? problema : null}</ErrorCampo>
    </div>
  );
}
