import { disponibilidad, plata } from "@/lib/formato";
import type { Tabla } from "@/lib/supabase/tipos";
import { FotoProducto } from "@/components/foto-producto";
import { Stock } from "@/components/insignias";
import { confirmarStock, guardarProducto } from "./acciones";
import { FotoNuevoProducto, FotosExtra, SubirFoto } from "./subir-foto";

// Un producto editable (o el formulario de alta, si no se pasa producto).
export function ProductoFila({ p, comercioId, ahora }: { p?: Tabla<"productos">; comercioId: number; ahora: Date }) {
  const d = p ? disponibilidad(p, ahora) : null;
  return (
    <form action={guardarProducto} className="py-4">
      {p ? <input type="hidden" name="id" value={p.id} /> : <input type="hidden" name="comercio_id" value={comercioId} />}
      <div className="flex flex-wrap items-start justify-between gap-2">
        {p ? (
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/20 bg-marino-claro">
              <FotoProducto url={p.foto_url} nombre={p.nombre} sizes="56px" texto="text-xl" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold">{p.nombre}</p>
              <p className="text-xs text-white/70">
                {plata(p.precio)} · {p.activo ? "Publicado" : "Oculto"}
              </p>
              <div className="mt-1">
                <SubirFoto productoId={p.id} comercioId={comercioId} tieneFoto={!!p.foto_url} />
                <FotosExtra productoId={p.id} comercioId={comercioId} fotos={p.fotos ?? []} />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="font-semibold">Agregar un producto</p>
            <FotoNuevoProducto comercioId={comercioId} />
          </div>
        )}
        {d ? <Stock d={d} /> : null}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {!p ? (
          <label className="block text-xs sm:col-span-2 lg:col-span-5">
            Nombre
            <input name="nombre" required className="campo mt-1" placeholder="Taladro Bosch GSB 500 W" />
          </label>
        ) : null}
        <label className="block text-xs">
          Precio ($)
          <input name="precio" type="number" min={0} step="0.01" defaultValue={p?.precio ?? ""} placeholder="A consultar" className="campo mt-1" />
        </label>
        <label className="block text-xs">
          Cómo mostrás el stock
          <select name="modo" defaultValue={p?.modo ?? "exacto"} className="campo mt-1">
            <option value="exacto">Cantidad exacta</option>
            <option value="semaforo">Hay / poco / no hay</option>
            <option value="consultar">Consultar</option>
            <option value="pedido">Sobre pedido</option>
          </select>
        </label>
        <label className="block text-xs">
          Cantidad (si es exacta)
          <input name="stock" type="number" min={0} step={1} defaultValue={p?.stock ?? ""} className="campo mt-1" />
        </label>
        <label className="block text-xs">
          Semáforo (si usás hay/poco)
          <select name="semaforo" defaultValue={p?.semaforo ?? "hay"} className="campo mt-1">
            <option value="hay">Hay</option>
            <option value="poco">Poco</option>
            <option value="no">No hay</option>
          </select>
        </label>
        <label className="flex items-center gap-2 self-end pb-2.5 text-xs">
          <input type="checkbox" name="activo" defaultChecked={p?.activo ?? true} className="h-4 w-4 accent-white" />
          Publicado
        </label>
      </div>

      <details className="mt-3 text-xs" open={!p}>
        <summary className="cursor-pointer text-white/80">Más datos (marca, medida, material, variantes, descripción)</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {p ? (
            <label className="block sm:col-span-3">
              Nombre
              <input name="nombre" defaultValue={p.nombre} className="campo mt-1" />
            </label>
          ) : null}
          <label className="block">
            Marca
            <input name="marca" defaultValue={p?.marca ?? ""} className="campo mt-1" />
          </label>
          <label className="block">
            Medida
            <input name="medida" defaultValue={p?.medida ?? ""} maxLength={60} className="campo mt-1" placeholder="20 cm, talle M, 1/2 pulgada" />
          </label>
          <label className="block">
            Material
            <input name="material" defaultValue={p?.material ?? ""} maxLength={60} className="campo mt-1" placeholder="Acero, algodón, plástico" />
          </label>
          <label className="block">
            Grupo de variantes
            <input name="grupo" defaultValue={p?.grupo ?? ""} className="campo mt-1" placeholder="Taladro percutor" />
          </label>
          <label className="block">
            Código en tu planilla
            <input name="codigo" defaultValue={p?.codigo ?? ""} className="campo mt-1" />
          </label>
          <label className="block sm:col-span-3">
            Descripción
            <textarea name="descripcion" rows={2} defaultValue={p?.descripcion ?? ""} className="campo mt-1" />
          </label>
        </div>
      </details>

      <div className="mt-4 flex flex-wrap gap-2">
        <button className="boton rounded-xl px-4 py-2 text-sm font-semibold">{p ? "Guardar" : "Agregar producto"}</button>
        {p && d?.texto === "Stock sin confirmar" ? (
          <button formAction={confirmarStock} className="rounded-xl border border-white/40 px-4 py-2 text-sm hover:bg-white/10">
            El stock sigue igual
          </button>
        ) : null}
      </div>
    </form>
  );
}
