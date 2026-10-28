"use client";

import { useEffect, useRef, useState } from "react";
import { useListo } from "@/components/use-listo";
import { emparejarFoto, type Coincidencia, type ProductoFoto } from "@/lib/fotos";
import { refrescarPanel } from "./acciones";
import { subirFotoProducto } from "./subir-foto";

type Elegida = { clave: string; archivo: File; vista: string; productoId: number | null; como: NonNullable<Coincidencia>["como"] | null };
type Estado = "" | "subiendo" | "listo" | "error";

const COMO = { código: "por código", nombre: "por nombre", parecido: "nombre parecido: revisalo" } as const;

// Dos formas de cargar fotos sin ir producto por producto: elegir muchas de
// una vez (se asignan por el nombre del archivo) o sacarlas seguidas con el
// celular, una por cada producto sin foto.
export function FotosEnLote({ comercioId, productos }: { comercioId: number; productos: ProductoFoto[] }) {
  const [modo, setModo] = useState<"varias" | "celular">("varias");
  return (
    <div>
      <div className="grid grid-cols-2 gap-1 rounded-2xl border border-white/20 p-1 sm:inline-grid" role="tablist">
        {(
          [
            ["varias", "Elegir varias fotos"],
            ["celular", "Sacarlas con el celular"],
          ] as const
        ).map(([m, t]) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={modo === m}
            onClick={() => setModo(m)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${modo === m ? "bg-white text-marino" : "hover:bg-white/10"}`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="mt-4">{modo === "varias" ? <Varias comercioId={comercioId} productos={productos} /> : <Celular comercioId={comercioId} productos={productos} />}</div>
    </div>
  );
}

function Varias({ comercioId, productos }: { comercioId: number; productos: ProductoFoto[] }) {
  const listo = useListo();
  const [elegidas, setElegidas] = useState<Elegida[]>([]);
  const [estados, setEstados] = useState<Record<string, Estado>>({});
  const [subiendo, setSubiendo] = useState(false);
  const [aviso, setAviso] = useState("");

  // Libera las vistas previas al elegir otras fotos o salir.
  const vistas = useRef<string[]>([]);
  const liberar = () => {
    vistas.current.forEach((v) => URL.revokeObjectURL(v));
    vistas.current = [];
  };
  useEffect(() => liberar, []);

  function elegir(archivos: FileList) {
    liberar();
    const nuevas = [...archivos]
      .filter((a) => a.type.startsWith("image/"))
      .map((archivo, i) => {
        const c = emparejarFoto(archivo.name, productos);
        return { clave: `${Date.now()}-${i}`, archivo, vista: URL.createObjectURL(archivo), productoId: c?.productoId ?? null, como: c?.como ?? null };
      });
    vistas.current = nuevas.map((e) => e.vista);
    setElegidas(nuevas);
    setEstados({});
    setAviso(nuevas.length ? "" : "Elegí archivos de imagen (JPG, PNG o WebP).");
  }

  const asignadas = elegidas.filter((e) => e.productoId != null && estados[e.clave] !== "listo");
  const repetidos = new Set(asignadas.map((e) => e.productoId).filter((id, i, a) => a.indexOf(id) !== i));
  const porId = new Map(productos.map((p) => [p.id, p]));

  async function subir() {
    setSubiendo(true);
    setAviso("");
    let errores = 0;
    for (const e of asignadas) {
      setEstados((s) => ({ ...s, [e.clave]: "subiendo" }));
      try {
        await subirFotoProducto(e.archivo, e.productoId!, comercioId, false);
        setEstados((s) => ({ ...s, [e.clave]: "listo" }));
      } catch (err) {
        console.error("[fotos]", err);
        errores++;
        setEstados((s) => ({ ...s, [e.clave]: "error" }));
      }
    }
    await refrescarPanel();
    setSubiendo(false);
    setAviso(
      errores
        ? `Subimos ${asignadas.length - errores} fotos. ${errores} no se pudieron subir: probá con esas de nuevo.`
        : `¡Listo! Subimos ${asignadas.length} foto${asignadas.length === 1 ? "" : "s"}.`,
    );
  }

  return (
    <div>
      <p className="text-sm text-white/80">
        Elegí todas las fotos juntas. Si cada archivo se llama como el <b>código</b> del producto (por ejemplo <i>OZK100.jpg</i>) o como su <b>nombre</b>,
        la asignamos sola. Las que no coincidan las asignás vos antes de subir.
      </p>
      <p className="mt-1 text-xs text-white/70">
        Consejo: pedile a tu proveedor sus fotos con el código en el nombre del archivo. Usá solo fotos tuyas, de tu proveedor o de la marca.
      </p>
      <label className={`boton mt-3 inline-block cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold ${listo && !subiendo ? "" : "pointer-events-none opacity-40"}`}>
        Elegir fotos
        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) elegir(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {elegidas.length ? (
        <>
          <p className="mt-3 text-sm">
            {elegidas.length} foto{elegidas.length === 1 ? "" : "s"}: <b>{elegidas.filter((e) => e.productoId != null).length}</b> asignadas y{" "}
            <b>{elegidas.filter((e) => e.productoId == null).length}</b> sin asignar.
          </p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {elegidas.map((e) => {
              const p = e.productoId != null ? porId.get(e.productoId) : undefined;
              const estado = estados[e.clave];
              return (
                <li key={e.clave} className="flex gap-3 rounded-2xl border border-white/20 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:) */}
                  <img src={e.vista} alt="" className="h-20 w-20 shrink-0 rounded-xl bg-white object-contain" />
                  <div className="min-w-0 flex-1 text-xs">
                    <p className="truncate text-white/70" title={e.archivo.name}>
                      {e.archivo.name}
                    </p>
                    <select
                      value={e.productoId ?? ""}
                      disabled={subiendo || estado === "listo"}
                      onChange={(ev) =>
                        setElegidas((l) =>
                          l.map((x) => (x.clave === e.clave ? { ...x, productoId: ev.target.value ? Number(ev.target.value) : null, como: null } : x)),
                        )
                      }
                      className="campo mt-1 py-1.5 text-xs"
                    >
                      <option value="">No subir</option>
                      {productos.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.nombre}
                          {x.codigo ? ` · ${x.codigo}` : ""}
                          {x.foto_url ? " (ya tiene foto)" : ""}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1">
                      {estado === "subiendo" ? (
                        "Subiendo…"
                      ) : estado === "listo" ? (
                        "Subida ✓"
                      ) : estado === "error" ? (
                        <span className="text-[#ffb4a2]">No se pudo subir</span>
                      ) : p ? (
                        <>
                          {e.como ? <span className={e.como === "parecido" ? "text-estrella" : "text-white/70"}>Asignada {COMO[e.como]}. </span> : null}
                          {repetidos.has(p.id) ? <span className="text-[#ffb4a2]">Hay otra foto para este producto: queda la última. </span> : null}
                          {p.foto_url ? <span className="text-white/70">Reemplaza la foto actual.</span> : null}
                        </>
                      ) : (
                        <span className="text-white/70">Elegí a qué producto corresponde.</span>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={!asignadas.length || subiendo} onClick={subir} className="boton rounded-xl px-4 py-2 text-sm font-semibold">
              {subiendo ? "Subiendo…" : `Subir ${asignadas.length} foto${asignadas.length === 1 ? "" : "s"}`}
            </button>
            <button
              type="button"
              disabled={subiendo}
              onClick={() => {
                setElegidas([]);
                setAviso("");
              }}
              className="rounded-xl border border-white/40 px-4 py-2 text-sm hover:bg-white/10"
            >
              {Object.values(estados).includes("listo") ? "Terminar" : "Cancelar"}
            </button>
          </div>
        </>
      ) : null}
      <p role="status" className="mt-2 min-h-5 text-sm">
        {aviso}
      </p>
    </div>
  );
}

// Recorre los productos sin foto: uno por vez, con la cámara del celular.
function Celular({ comercioId, productos }: { comercioId: number; productos: ProductoFoto[] }) {
  const listo = useListo();
  const entrada = useRef<HTMLInputElement>(null);
  // Se arma una sola vez: así el producto que recién recibió foto no desaparece de la lista.
  const [pendientes] = useState(() => productos.filter((p) => !p.foto_url));
  const [indice, setIndice] = useState(0);
  const [hechos, setHechos] = useState(0);
  const [estado, setEstado] = useState<Estado>("");

  if (!pendientes.length) return <p className="text-sm text-white/80">Todos tus productos ya tienen foto. ¡Bien ahí!</p>;
  const actual = pendientes[indice];

  async function subir(archivo: File) {
    setEstado("subiendo");
    try {
      await subirFotoProducto(archivo, actual.id, comercioId, false);
      setHechos((h) => h + 1);
      setEstado("listo");
      setIndice((i) => i + 1);
    } catch (e) {
      console.error("[fotos]", e);
      setEstado("error");
    }
  }

  if (!actual) {
    return (
      <div className="text-sm">
        <p>
          ¡Terminaste! Sacaste {hechos} foto{hechos === 1 ? "" : "s"}.
        </p>
        <button type="button" onClick={() => refrescarPanel()} className="boton mt-3 rounded-xl px-4 py-2 text-sm font-semibold">
          Ver mis productos
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-white/80">
        Abrilo desde el celular: te mostramos un producto sin foto por vez, le sacás la foto y pasamos al siguiente. Con buena luz y fondo liso quedan mejor.
      </p>
      <div className="mt-4 rounded-2xl border border-white/20 p-4 text-center">
        <p className="text-xs text-white/70">
          Producto {indice + 1} de {pendientes.length} sin foto{hechos ? ` · ya sacaste ${hechos}` : ""}
        </p>
        <p className="mt-2 text-lg font-bold">{actual.nombre}</p>
        {actual.codigo ? <p className="text-xs text-white/70">Código {actual.codigo}</p> : null}
        <input
          ref={entrada}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            const a = e.target.files?.[0];
            if (a) subir(a);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={!listo || estado === "subiendo"}
          onClick={() => entrada.current?.click()}
          className="boton mt-4 w-full rounded-xl px-4 py-3 text-base font-semibold"
        >
          {estado === "subiendo" ? "Subiendo…" : "Sacar foto"}
        </button>
        <button
          type="button"
          disabled={estado === "subiendo"}
          onClick={() => {
            setEstado("");
            setIndice((i) => i + 1);
          }}
          className="mt-2 w-full rounded-xl border border-white/40 px-4 py-2 text-sm hover:bg-white/10"
        >
          Saltear este
        </button>
        <p role="status" className="mt-2 min-h-5 text-sm">
          {estado === "listo" ? "Foto guardada ✓" : estado === "error" ? <span className="text-[#ffb4a2]">No se pudo subir. Probá de nuevo.</span> : null}
        </p>
      </div>
    </div>
  );
}
