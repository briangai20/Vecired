"use client";

import { useEffect, useRef, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/navegador";
import { guardarFoto } from "./acciones";

// Achica la foto a 1200 px de lado y la pasa a JPEG, para que suba rápido
// con datos móviles y no ocupe espacio de más.
export async function achicar(archivo: File): Promise<Blob> {
  const imagen = await createImageBitmap(archivo);
  const escala = Math.min(1, 1200 / Math.max(imagen.width, imagen.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);
  lienzo.getContext("2d")!.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  return new Promise((ok, mal) => lienzo.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo procesar la foto"))), "image/jpeg", 0.82));
}

// Achica, sube a Storage y guarda la foto del producto.
export async function subirFotoProducto(archivo: File, productoId: number, comercioId: number, refrescar = true) {
  const foto = await achicar(archivo);
  const ruta = `${comercioId}/${productoId}-${Date.now()}.jpg`;
  const supabase = supabaseNavegador();
  const { error } = await supabase.storage.from("productos").upload(ruta, foto, { contentType: "image/jpeg" });
  if (error) throw error;
  const { data } = supabase.storage.from("productos").getPublicUrl(ruta);
  await guardarFoto(productoId, data.publicUrl, refrescar);
}

export function SubirFoto({ productoId, comercioId, tieneFoto }: { productoId: number; comercioId: number; tieneFoto: boolean }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<"" | "subiendo" | "error">("");

  async function subir(archivo: File) {
    setEstado("subiendo");
    try {
      await subirFotoProducto(archivo, productoId, comercioId);
      setEstado("");
    } catch (e) {
      console.error("[fotos]", e);
      setEstado("error");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <input
        ref={entrada}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (archivo) subir(archivo);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={estado === "subiendo"}
        onClick={() => entrada.current?.click()}
        className="rounded-lg border border-white/40 px-3 py-1.5 hover:bg-white/10 disabled:opacity-50"
      >
        {estado === "subiendo" ? "Subiendo foto…" : tieneFoto ? "Cambiar foto" : "Agregar foto"}
      </button>
      {estado === "error" ? <span className="text-[#ffb4a2]">No se pudo subir. Probá con otra foto.</span> : null}
    </div>
  );
}

// Foto para un producto que todavía no existe (formulario de alta): se sube
// apenas se elige y el formulario manda su dirección en "foto_url".
export function FotoNuevoProducto({ comercioId }: { comercioId: number }) {
  const entrada = useRef<HTMLInputElement>(null);
  const contenedor = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState("");
  const [estado, setEstado] = useState<"" | "subiendo" | "error">("");

  // Al agregar el producto el formulario se vacía: la foto también.
  useEffect(() => {
    const form = contenedor.current?.closest("form");
    const limpiar = () => {
      setUrl("");
      setEstado("");
    };
    form?.addEventListener("reset", limpiar);
    return () => form?.removeEventListener("reset", limpiar);
  }, []);

  async function subir(archivo: File) {
    setEstado("subiendo");
    try {
      const foto = await achicar(archivo);
      const ruta = `${comercioId}/nuevo-${Date.now()}.jpg`;
      const supabase = supabaseNavegador();
      const { error } = await supabase.storage.from("productos").upload(ruta, foto, { contentType: "image/jpeg" });
      if (error) throw error;
      setUrl(supabase.storage.from("productos").getPublicUrl(ruta).data.publicUrl);
      setEstado("");
    } catch (e) {
      console.error("[fotos]", e);
      setEstado("error");
    }
  }

  return (
    <div ref={contenedor} className="flex items-center gap-3 text-xs">
      <input type="hidden" name="foto_url" value={url} />
      <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/20 bg-marino-claro text-white/50">
        {/* eslint-disable-next-line @next/next/no-img-element -- vista previa de la foto recién subida */}
        {url ? <img src={url} alt="" className="h-full w-full bg-white object-contain" /> : "Foto"}
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
      <button
        type="button"
        disabled={estado === "subiendo"}
        onClick={() => entrada.current?.click()}
        className="rounded-lg border border-white/40 px-3 py-1.5 hover:bg-white/10 disabled:opacity-50"
      >
        {estado === "subiendo" ? "Subiendo foto…" : url ? "Cambiar foto" : "Agregar foto"}
      </button>
      {url ? (
        <button type="button" onClick={() => setUrl("")} className="underline">
          Quitar
        </button>
      ) : null}
      {estado === "error" ? <span className="text-[#ffb4a2]">No se pudo subir. Probá con otra foto.</span> : null}
    </div>
  );
}
