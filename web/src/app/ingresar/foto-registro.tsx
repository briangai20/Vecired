"use client";

import { useEffect, useRef, useState } from "react";
import { ErrorCampo } from "@/components/error-campo";
import { motivoImagen, prepararImagen } from "@/lib/imagen";

// Foto de perfil opcional al crear la cuenta. Se achica en el navegador y
// viaja con el formulario (campo "foto"); la guarda el servidor al crear la cuenta.
export function FotoRegistro({ error }: { error?: string }) {
  const elegir = useRef<HTMLInputElement>(null);
  const enviar = useRef<HTMLInputElement>(null);
  const [vista, setVista] = useState("");
  const [problema, setProblema] = useState("");
  const [preparando, setPreparando] = useState(false);

  // Si el formulario se vacía (después de enviarlo), la foto también.
  useEffect(() => {
    const form = enviar.current?.closest("form");
    const limpiar = () => setVista("");
    form?.addEventListener("reset", limpiar);
    return () => form?.removeEventListener("reset", limpiar);
  }, []);

  async function preparar(archivo: File) {
    setProblema("");
    setPreparando(true);
    try {
      const foto = await prepararImagen(archivo, 400);
      const lista = new DataTransfer();
      lista.items.add(new File([foto], "foto.jpg", { type: "image/jpeg" }));
      enviar.current!.files = lista.files;
      setVista(URL.createObjectURL(foto));
    } catch (e) {
      setProblema(motivoImagen(e, archivo));
    }
    setPreparando(false);
  }

  function quitar() {
    if (enviar.current) enviar.current.value = "";
    setVista("");
  }

  const mal = problema || error;
  return (
    <div className="text-xs">
      <p>Foto de perfil (opcional: se ve en tus reseñas)</p>
      <div className="mt-2 flex items-center gap-3">
        <span
          className={`grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-marino-claro text-white/50 ${mal ? "border-2 border-[#ff6b6b]" : "border border-white/30"}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local de la foto elegida */}
          {vista ? <img src={vista} alt="" className="h-full w-full object-cover" /> : "Foto"}
        </span>
        <input ref={enviar} type="file" name="foto" hidden />
        <input
          ref={elegir}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const archivo = e.target.files?.[0];
            if (archivo) preparar(archivo);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={preparando}
          onClick={() => elegir.current?.click()}
          className="rounded-lg border border-white/40 px-3 py-1.5 hover:bg-white/10 disabled:opacity-50"
        >
          {preparando ? "Preparando…" : vista ? "Cambiar foto" : "Elegir foto"}
        </button>
        {vista ? (
          <button type="button" onClick={quitar} className="underline">
            Quitar
          </button>
        ) : null}
      </div>
      <ErrorCampo>{mal}</ErrorCampo>
    </div>
  );
}
