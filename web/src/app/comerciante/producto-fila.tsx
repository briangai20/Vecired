import { disponibilidad, plata } from "@/lib/formato";
import type { Tabla } from "@/lib/supabase/tipos";
import { FotoProducto } from "@/components/foto-producto";
import { Stock } from "@/components/insignias";
import { confirmarStock, guardarProducto } from "./acciones";
import { FotoNuevoProducto, FotosExtra, SubirFoto } from "./subir-foto";

// Un producto editable (o el formulario de alta, si no se pasa producto).
// En el celular, con un producto ya cargado: oculto salvo con "Más datos" abierto.
const SOLO_ABIERTO = "max-sm:hidden max-sm:group-has-[details[data-mas][open]]:block";

export function ProductoFila({ p, comercioId, ahora }: { p?: Tabla<"productos">; comercioId: number; ahora: Date }) {
  const d = p ? disponibilidad(p, ahora) : null;
  const plegar = (siempre: boolean) => (p && !siempre ? SOLO_ABIERTO : "");
  return (
    <form
      action={guardarProducto}
      // Tildado para cambiar en bloque: la fila se resalta en naranja.
      className="group -mx-2 rounded-xl px-2 py-3 transition-colors has-[input[data-elegir]:checked]:bg-naranja/15 sm:py-4"
      // Para que el control de stock muestre u oculte este producto.
      data-producto={p?.id}
    >
      {p ? <input type="hidden" name="id" value={p.id} /> : <input type="hidden" name="comercio_id" value={comercioId} />}
      <div className="flex flex-wrap items-start justify-between gap-2">
        {p ? (
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            {/* Casilla para los cambios en bloque (no se manda al guardar). */}
            <label className="flex shrink-0 cursor-pointer flex-col items-center gap-0.5 text-[10px] font-semibold text-white/75">
              <input type="checkbox" data-elegir value={p.id} aria-label={`Tildar ${p.nombre}`} className="h-6 w-6 accent-[#ff6b2c]" />
              Elegir
            </label>
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-white/20 bg-marino-claro sm:h-14 sm:w-14">
              <FotoProducto url={p.foto_url} nombre={p.nombre} sizes="56px" texto="text-xl" />
            </div>
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm leading-snug font-semibold sm:text-base">{p.nombre}</p>
              <p className="text-xs text-white/70">
                {plata(p.precio)} · {p.activo ? "Publicado" : "Oculto"}
              </p>
              <div className={`mt-1 ${SOLO_ABIERTO}`}>
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

      <div className={`mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 ${p ? "max-sm:mt-2 max-sm:grid-cols-2 max-sm:gap-2" : ""}`}>
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
        <label className={`block text-xs ${plegar(false)}`}>
          Cómo mostrás el stock
          <select name="modo" defaultValue={p?.modo ?? "exacto"} className="campo mt-1">
            <option value="exacto">Cantidad exacta</option>
            <option value="semaforo">Hay / poco / no hay</option>
            <option value="consultar">Consultar</option>
            <option value="pedido">Sobre pedido</option>
          </select>
        </label>
        <label className={`block text-xs ${plegar(p?.modo === "exacto")}`}>
          Cantidad<span className="max-sm:hidden"> (si es exacta)</span>
          <input name="stock" type="number" min={0} step={1} defaultValue={p?.stock ?? ""} className="campo mt-1" />
        </label>
        <label className={`block text-xs ${plegar(p?.modo === "semaforo")}`}>
          <span className="sm:hidden">Hay / poco</span>
          <span className="max-sm:hidden">Semáforo (si usás hay/poco)</span>
          <select name="semaforo" defaultValue={p?.semaforo ?? "hay"} className="campo mt-1">
            <option value="hay">Hay</option>
            <option value="poco">Poco</option>
            <option value="no">No hay</option>
          </select>
        </label>
        <label className={`flex items-center gap-2 self-end pb-2.5 text-xs ${p ? "max-sm:hidden max-sm:group-has-[details[data-mas][open]]:flex" : ""}`}>
          <input type="checkbox" name="activo" defaultChecked={p?.activo ?? true} className="h-4 w-4 accent-white" />
          Publicado
        </label>
      </div>

      <details data-mas className="mt-3 text-xs" open={!p}>
        <summary className="cursor-pointer text-white/80">
          {p ? <span className="sm:hidden">Más datos y fotos</span> : null}
          <span className={p ? "max-sm:hidden" : ""}>Más datos (marca, medida, material, variantes, descripción)</span>
        </summary>
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

      <div className={`mt-4 flex flex-wrap gap-2 ${p ? "max-sm:mt-2" : ""}`}>
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
