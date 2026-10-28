"use client";

import { useState, useTransition } from "react";
import { useListo } from "@/components/use-listo";
import { plata } from "@/lib/formato";
import { detectarTabla, emparejar, interpretarPlanilla, letra, type Celda, type Dato, type FilaProducto, type Mapa, type Tabla } from "@/lib/importar";
import { importarProductos, type ResultadoImportacion } from "./acciones";

type Existente = { id: number; codigo: string | null; nombre: string };

const SEMAFORO = { hay: "Hay", poco: "Poco", no: "No hay" } as const;
const textoStock = (f: FilaProducto) =>
  f.modo === undefined
    ? "—"
    : f.modo === "exacto"
      ? String(f.stock ?? 0)
      : f.modo === "semaforo"
        ? SEMAFORO[f.semaforo ?? "hay"]
        : f.modo === "pedido"
          ? "A pedido"
          : "Consultar";

// Datos que el comerciante puede asignar a una columna, en el orden en que se muestran.
const CAMPOS: { dato: Dato; titulo: string; ayuda?: string }[] = [
  { dato: "nombre", titulo: "Producto", ayuda: "Obligatorio" },
  { dato: "codigo", titulo: "Código", ayuda: "Sirve para actualizar la lista más adelante" },
  { dato: "stock", titulo: "Stock" },
  { dato: "marca", titulo: "Marca" },
  { dato: "descripcion", titulo: "Descripción" },
];

const CALCULAR = "calcular";

async function leerArchivo(archivo: File): Promise<Celda[][]> {
  const nombre = archivo.name.toLowerCase();
  if (nombre.endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/browser");
    return (await readSheet(archivo)) as Celda[][];
  }
  if (nombre.endsWith(".csv") || nombre.endsWith(".txt")) {
    const { default: Papa } = await import("papaparse");
    return new Promise((ok, mal) =>
      Papa.parse<string[]>(archivo, { skipEmptyLines: false, complete: (r) => ok(r.data), error: (e) => mal(e) }),
    );
  }
  throw new Error(nombre.endsWith(".xls") ? "xls" : "formato");
}

export function ImportarProductos({ comercioId, existentes }: { comercioId: number; existentes: Existente[] }) {
  const listo = useListo();
  const [matriz, setMatriz] = useState<Celda[][] | null>(null);
  const [tabla, setTabla] = useState<Tabla | null>(null);
  const [mapa, setMapa] = useState<Mapa>({});
  const [archivo, setArchivo] = useState("");
  const [aviso, setAviso] = useState("");
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);
  const [guardando, startTransition] = useTransition();

  async function elegir(f: File) {
    setResultado(null);
    setTabla(null);
    setArchivo(f.name);
    setAviso("Leyendo la planilla…");
    try {
      const m = await leerArchivo(f);
      const t = detectarTabla(m);
      if (!t) {
        setAviso("La planilla está vacía.");
        return;
      }
      setMatriz(m);
      setTabla(t);
      setMapa(t.mapa);
      setAviso("");
    } catch (e) {
      const motivo = e instanceof Error ? e.message : "";
      setAviso(
        motivo === "xls"
          ? "Ese archivo es de un Excel viejo (.xls). Abrilo y guardalo como .xlsx o como CSV, y probá de nuevo."
          : motivo === "formato"
            ? "Subí un archivo de Excel (.xlsx) o CSV."
            : "No pudimos leer el archivo. Revisá que sea la planilla correcta.",
      );
    }
  }

  // Asigna una columna a un dato; una columna no puede ser dos datos a la vez.
  function asignar(cambios: Partial<Record<Dato, number | undefined>>) {
    setMapa((prev) => {
      const nuevo: Mapa = { ...prev };
      for (const [dato, col] of Object.entries(cambios) as [Dato, number | undefined][]) {
        if (col !== undefined) {
          for (const d of Object.keys(nuevo) as Dato[]) if (nuevo[d] === col && d !== dato) delete nuevo[d];
          nuevo[dato] = col;
        } else delete nuevo[dato];
      }
      return nuevo;
    });
  }

  const lectura = matriz && tabla ? interpretarPlanilla(matriz, tabla, mapa) : null;
  const pares = lectura ? emparejar(lectura.filas, existentes) : [];
  const nuevos = pares.filter((p) => !p.existente).length;
  const actualizar = pares.length - nuevos;
  const calcula = mapa.precio === undefined && mapa.costo !== undefined && mapa.margen !== undefined;
  const modoPrecio = mapa.precio !== undefined ? String(mapa.precio) : mapa.costo !== undefined || mapa.margen !== undefined ? CALCULAR : "";
  const ejemploCalculo = calcula ? pares.find((p) => typeof p.fila.precio === "number") : undefined;

  function confirmar() {
    if (!lectura) return;
    startTransition(async () => {
      const r = await importarProductos(comercioId, lectura.filas);
      setResultado(r);
      if (!r.error) {
        setTabla(null);
        setMatriz(null);
      }
    });
  }

  const opciones = tabla?.columnas.map((c, i) => (
    <option key={i} value={i}>
      {letra(i)} · {c.titulo}
      {c.ejemplo && c.ejemplo !== c.titulo ? ` (ej.: ${c.ejemplo})` : ""}
    </option>
  ));
  const elegirColumna = (dato: Dato, opcional = true) => (
    <select
      value={mapa[dato] ?? ""}
      onChange={(e) => asignar({ [dato]: e.target.value === "" ? undefined : Number(e.target.value) })}
      className="campo mt-1"
    >
      {opcional ? <option value="">No cargar</option> : <option value="">Elegí una columna</option>}
      {opciones}
    </select>
  );

  return (
    <div>
      <p className="text-sm text-white/80">
        Subí tu lista de precios en Excel (.xlsx) o CSV, como la tengas. Buscamos solos el nombre, el precio, el stock y el código, y antes de cargar te
        mostramos qué entendimos para que lo corrijas si hace falta. Los productos que ya tenés se actualizan y los nuevos se agregan. No se borra nada.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className={`boton cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold ${listo ? "" : "pointer-events-none opacity-40"}`}>
          Elegir archivo
          <input
            type="file"
            accept=".xlsx,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) elegir(f);
              e.target.value = "";
            }}
          />
        </label>
        <a href="/plantilla-productos-vecired.xlsx" download className="rounded-xl border border-white/40 px-4 py-2 text-sm hover:bg-white/10">
          Descargar planilla modelo
        </a>
        {archivo ? <span className="text-xs text-white/70">{archivo}</span> : null}
      </div>
      <p role="status" className="mt-2 min-h-5 text-sm">
        {aviso}
        {resultado?.error ? <span className="text-[#ffb4a2]">{resultado.error}</span> : null}
        {resultado && !resultado.error ? (
          <span>
            ¡Listo! Agregamos {resultado.agregados} producto{resultado.agregados === 1 ? "" : "s"} y actualizamos {resultado.actualizados}.
          </span>
        ) : null}
      </p>

      {tabla && lectura ? (
        <div className="mt-3 space-y-4 rounded-2xl border border-white/20 p-4">
          <div>
            <h3 className="font-semibold">1. Revisá qué columna es cada dato</h3>
            <p className="mt-1 text-xs text-white/75">
              {tabla.filaTitulos >= 0
                ? `Tomamos los títulos de la fila ${tabla.filaTitulos + 1}. Si algo no coincide, cambialo acá y la vista previa se actualiza.`
                : "La planilla no tiene títulos: elegí qué columna es cada dato."}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CAMPOS.slice(0, 2).map((c) => (
                <label key={c.dato} className="block text-xs">
                  {c.titulo}
                  {c.ayuda ? <span className="text-white/60"> · {c.ayuda}</span> : null}
                  {elegirColumna(c.dato, c.dato !== "nombre")}
                </label>
              ))}
              <label className="block text-xs">
                Precio de venta
                <select
                  value={modoPrecio}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === CALCULAR) {
                      // Al pasar a "calcular" se sugieren las columnas de costo y margen si las hay.
                      const sugerido = tabla.mapa;
                      asignar({ precio: undefined, costo: mapa.costo ?? sugerido.costo, margen: mapa.margen ?? sugerido.margen });
                    } else asignar({ precio: v === "" ? undefined : Number(v), costo: undefined, margen: undefined });
                  }}
                  className="campo mt-1"
                >
                  <option value="">No cargar (queda &quot;A consultar&quot;)</option>
                  {opciones}
                  <option value={CALCULAR}>Calcular: costo × margen</option>
                </select>
              </label>
              {modoPrecio === CALCULAR ? (
                <>
                  <label className="block text-xs">
                    Costo
                    {elegirColumna("costo", false)}
                  </label>
                  <label className="block text-xs">
                    Margen <span className="text-white/60">· 2,5 = costo × 2,5 · 40 o 40% = costo + 40 %</span>
                    {elegirColumna("margen", false)}
                  </label>
                </>
              ) : null}
              {CAMPOS.slice(2).map((c) => (
                <label key={c.dato} className="block text-xs">
                  {c.titulo}
                  {elegirColumna(c.dato)}
                </label>
              ))}
            </div>
            {ejemploCalculo && mapa.costo !== undefined && mapa.margen !== undefined ? (
              <p className="mt-2 text-xs text-white/80">
                Precio de venta = {tabla.columnas[mapa.costo].titulo} × {tabla.columnas[mapa.margen].titulo}. Por ejemplo, {ejemploCalculo.fila.nombre}:{" "}
                {plata(ejemploCalculo.fila.precio ?? null)}.
              </p>
            ) : null}
          </div>

          <div>
            <h3 className="font-semibold">2. Mirá cómo quedan los productos</h3>
            <p className="mt-1 text-sm">
              Encontramos <b>{lectura.filas.length}</b> productos: <b>{nuevos}</b> {nuevos === 1 ? "nuevo" : "nuevos"} y <b>{actualizar}</b> que ya tenías (se{" "}
              {actualizar === 1 ? "actualiza" : "actualizan"}).
            </p>
            {lectura.errores.length ? (
              <details className="mt-2 text-xs" open={lectura.errores.length <= 5}>
                <summary className="cursor-pointer text-[#ffb4a2]">{lectura.errores.length} aviso(s) sobre la planilla</summary>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-white/85">
                  {lectura.errores.slice(0, 50).map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </details>
            ) : null}
            {pares.length ? (
              <div className="mt-3 max-h-72 overflow-auto rounded-xl border border-white/10">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-marino">
                    <tr className="text-white/70">
                      <th className="p-2">Producto</th>
                      <th className="p-2">Precio</th>
                      <th className="p-2">Stock</th>
                      <th className="p-2">Qué pasa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pares.slice(0, 100).map(({ fila: f, existente }) => (
                      <tr key={f.fila} className="border-t border-white/10">
                        <td className="p-2">
                          {f.nombre}
                          {f.codigo ? <span className="text-white/60"> · {f.codigo}</span> : null}
                        </td>
                        <td className="p-2 whitespace-nowrap">{f.precio === undefined ? "—" : plata(f.precio)}</td>
                        <td className="p-2">{textoStock(f)}</td>
                        <td className="p-2">{existente ? "Se actualiza" : "Nuevo"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {pares.length > 100 ? <p className="p-2 text-xs text-white/70">… y {pares.length - 100} más.</p> : null}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!pares.length || guardando} onClick={confirmar} className="boton rounded-xl px-4 py-2 text-sm font-semibold">
              {guardando ? "Guardando…" : `Cargar ${pares.length} productos`}
            </button>
            <button
              type="button"
              onClick={() => {
                setTabla(null);
                setMatriz(null);
              }}
              className="rounded-xl border border-white/40 px-4 py-2 text-sm hover:bg-white/10"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
