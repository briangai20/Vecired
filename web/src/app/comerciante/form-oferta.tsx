"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { useListo } from "@/components/use-listo";
import { plata } from "@/lib/formato";
import { supabaseNavegador } from "@/lib/supabase/navegador";
import { crearOferta, type EstadoOferta } from "./acciones";
import { achicar } from "./subir-foto";

type Producto = { id: number; nombre: string; precio: number | null };

// Cargar una oferta: un producto rebajado (precio de oferta) o un aviso libre
// (título e imagen), con fecha de fin.
export function FormOferta({ comercioId, productos, hoy, maximo }: { comercioId: number; productos: Producto[]; hoy: string; maximo: string }) {
  const [estado, accion, enviando] = useActionState<EstadoOferta, FormData>(crearOferta, {});
  const listo = useListo();
  const [tipo, setTipo] = useState<"producto" | "aviso">("producto");
  const [productoId, setProductoId] = useState("");
  const [imagen, setImagen] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const elegido = productos.find((p) => String(p.id) === productoId);
  const enUnaSemana = new Date(new Date(`${hoy}T12:00:00`).getTime() + 7 * 86_400_000).toISOString().slice(0, 10);

  async function subir(archivo: File) {
    setSubiendo(true);
    try {
      const foto = await achicar(archivo);
      const ruta = `${comercioId}/oferta-${Date.now()}.jpg`;
      const supabase = supabaseNavegador();
      const { error } = await supabase.storage.from("productos").upload(ruta, foto, { contentType: "image/jpeg" });
      if (error) throw error;
      setImagen(supabase.storage.from("productos").getPublicUrl(ruta).data.publicUrl);
    } catch (e) {
      console.error("[ofertas]", e);
      alert("No se pudo subir la imagen. Probá con otra.");
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <form
      key={estado.ok ?? "nueva"}
      onSubmit={(e) => {
        e.preventDefault();
        const datos = new FormData(e.currentTarget);
        startTransition(() => accion(datos));
      }}
      className="mt-4 space-y-3"
    >
      <input type="hidden" name="comercio" value={comercioId} />
      <input type="hidden" name="tipo" value={tipo} />
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de oferta">
        {(
          [
            ["producto", "Producto rebajado"],
            ["aviso", "Aviso libre (texto e imagen)"],
          ] as const
        ).map(([t, texto]) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={tipo === t}
            onClick={() => setTipo(t)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition active:bg-naranja/70 ${tipo === t ? "bg-naranja text-white" : "bg-white/10 hover:bg-white/15"}`}
          >
            {texto}
          </button>
        ))}
      </div>

      {tipo === "producto" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs">
            Producto
            <select name="producto" value={productoId} onChange={(e) => setProductoId(e.target.value)} required className="campo mt-1">
              <option value="">Elegí un producto…</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} {p.precio != null ? `(${plata(p.precio)})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            Precio de oferta {elegido?.precio != null ? <span className="text-white/60">(normal {plata(elegido.precio)})</span> : null}
            <input name="precio" type="number" min="1" step="0.01" max={elegido?.precio != null ? elegido.precio - 0.01 : undefined} required className="campo mt-1" />
          </label>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs">
            Título
            <input name="titulo" minLength={3} maxLength={80} required className="campo mt-1" placeholder="2x1 en tornillos este finde" />
          </label>
          <div className="text-xs">
            Imagen (opcional)
            <input type="hidden" name="imagen" value={imagen} />
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
            <div className="mt-1 flex items-center gap-2">
              <button type="button" onClick={() => entrada.current?.click()} disabled={subiendo} className="rounded-xl bg-white/10 px-4 py-2.5 text-sm hover:bg-white/15">
                {subiendo ? "Subiendo…" : imagen ? "Cambiar imagen" : "Subir imagen"}
              </button>
              {imagen ? <span className="text-white/75">✓ Imagen lista</span> : null}
            </div>
          </div>
        </div>
      )}

      <label className="block text-xs sm:w-60">
        Vale hasta el
        <input name="hasta" type="date" min={hoy} max={maximo} defaultValue={enUnaSemana} required className="campo mt-1" />
      </label>

      {estado.error ? (
        <p role="alert" className="text-sm font-semibold text-naranja-vivo">
          {estado.error}
        </p>
      ) : estado.ok ? (
        <p role="status" className="text-sm">
          ¡Listo! La oferta ya se ve en la portada y en “Ofertas”.
        </p>
      ) : null}
      <button type="submit" disabled={!listo || enviando || subiendo} className="boton rounded-xl px-5 py-2.5 text-sm font-semibold">
        {enviando ? "Publicando…" : "Publicar oferta"}
      </button>
    </form>
  );
}
