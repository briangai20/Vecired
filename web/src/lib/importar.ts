// Interpreta las filas de una planilla de productos (Excel o CSV). Se usa en
// el navegador para la vista previa; el servidor vuelve a limpiar cada dato.
//
// Las listas de precios reales vienen de mil formas: con un título o una
// segunda tabla arriba, el nombre en "Descripción", el costo y el margen en
// vez del precio de venta, una fila de totales al final... Por eso primero se
// busca la tabla y se adivina qué es cada columna (detectarTabla), y después
// se leen las filas con ese mapa (interpretarPlanilla). El comerciante puede
// corregir el mapa en pantalla antes de cargar.

import type { Enum } from "./supabase/tipos";

export type Celda = string | number | boolean | Date | null | undefined;

export type FilaProducto = {
  fila: number; // número de fila en la planilla, para los mensajes
  codigo: string | null;
  nombre: string;
  marca: string | null;
  grupo: string | null;
  descripcion: string | null;
  // undefined = la planilla no trae ese dato (al actualizar, se deja como estaba)
  precio?: number | null;
  modo?: Enum<"modo_stock">;
  stock?: number | null;
  semaforo?: Enum<"semaforo"> | null;
};

export type ResultadoLectura = { filas: FilaProducto[]; errores: string[] };

export const MAX_FILAS = 2000;

// Datos que se pueden sacar de una columna. "costo" y "margen" sirven para
// calcular el precio de venta cuando la planilla no lo trae.
export type Dato = "codigo" | "nombre" | "marca" | "grupo" | "descripcion" | "precio" | "costo" | "margen" | "stock";
export type Mapa = Partial<Record<Dato, number>>; // índice de columna

export type Tabla = {
  filaTitulos: number; // índice en la matriz; -1 si la planilla no tiene títulos
  columnas: { titulo: string; ejemplo: string }[];
  hasta: number; // índice de la última fila de la tabla
  mapa: Mapa;
  ignoradas: string[]; // filas con datos que quedaron fuera de la tabla, para avisar
};

const normal = (v: string) =>
  v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9%]+/g, " ")
    .trim();

const texto = (v: Celda) => (v == null ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim());

// Nombres de columna que se aceptan para cada dato (ya normalizados).
const SINONIMOS: Record<Dato, string[]> = {
  codigo: ["codigo", "cod", "sku", "codigo interno", "id", "codigo de articulo", "cod articulo", "ean", "codigo de barras", "referencia", "ref"],
  nombre: ["nombre", "producto", "produto", "productos", "nombre del producto", "articulo", "articulos", "item", "detalle"],
  marca: ["marca", "fabricante", "proveedor"],
  grupo: ["grupo", "variantes", "grupo de variantes", "familia"],
  descripcion: ["descripcion", "descripcion del producto", "descripcion del articulo", "observaciones", "comentario", "caracteristicas"],
  precio: ["precio", "precio venta", "precio de venta", "precio final", "precio al publico", "precio publico", "pvp", "venta", "precio unitario", "importe", "valor", "precio lista"],
  costo: ["costo", "precio costo", "precio de costo", "costo unitario", "compra", "precio compra", "precio de compra", "unitario", "neto", "precio neto", "precio proveedor"],
  margen: ["margen", "margen ganancia", "margen de ganancia", "markup", "recargo", "% ganancia", "utilidad", "coeficiente"],
  stock: ["stock", "cantidad", "existencia", "existencias", "disponible", "unidades", "cant", "disponibilidad", "stock actual"],
};

// Palabras que descartan una columna para un dato aunque el nombre se parezca:
// "Unidades x bulto" no es el stock, "Total pedido" no es el precio.
const DESCARTA: Partial<Record<Dato, RegExp>> = {
  precio: /\b(x|por)\b|bulto|blister|caja|pack|total|subtotal|ganancia|margen|iva|costo|compra|neto/,
  costo: /\b(x|por)\b|bulto|blister|caja|pack|total|subtotal|ganancia/,
  stock: /\b(x|por)\b|bulto|blister|caja|pack|minim|pedid|vendid/,
  margen: /neta|\bx\b|por producto|total/,
};

// Qué tan bien coincide un título con un dato: 3 exacto, 2 empieza igual, 0 nada.
function puntaje(titulo: string, dato: Dato) {
  const n = normal(titulo);
  if (!n) return 0;
  if (SINONIMOS[dato].includes(n)) return 3;
  if (DESCARTA[dato]?.test(n)) return 0;
  // "Precio ($)", "Stock actual", "Margen %"...
  if (SINONIMOS[dato].some((s) => s.length >= 3 && n.startsWith(s + " "))) return 2;
  return 0;
}

// Asigna cada dato a la columna que mejor le queda, sin repetir columnas.
function mapear(titulos: string[]): Mapa {
  const candidatos: { dato: Dato; col: number; p: number }[] = [];
  titulos.forEach((t, col) => {
    for (const dato of Object.keys(SINONIMOS) as Dato[]) {
      const p = puntaje(t, dato);
      if (p) candidatos.push({ dato, col, p });
    }
  });
  candidatos.sort((a, b) => b.p - a.p || a.col - b.col);
  const mapa: Mapa = {};
  const usadas = new Set<number>();
  for (const c of candidatos) {
    if (mapa[c.dato] !== undefined || usadas.has(c.col)) continue;
    mapa[c.dato] = c.col;
    usadas.add(c.col);
  }
  // Muchas listas traen "Código" + "Descripción": ahí la descripción es el nombre.
  if (mapa.nombre === undefined && mapa.descripcion !== undefined) {
    mapa.nombre = mapa.descripcion;
    delete mapa.descripcion;
  }
  // Con precio de venta no hace falta calcularlo.
  if (mapa.precio !== undefined) {
    delete mapa.costo;
    delete mapa.margen;
  }
  return mapa;
}

const vacia = (f: Celda[] | undefined) => !f || !f.some((c) => texto(c) !== "");

// Busca la fila de títulos de la tabla principal: la que reconoce el nombre
// del producto y tiene más filas con datos debajo. Revisa las primeras 50
// filas, porque arriba puede haber un logo, un título u otra tabla.
export function detectarTabla(matriz: Celda[][]): Tabla | null {
  if (!matriz.some((f) => !vacia(f))) return null;
  let mejor: { fila: number; mapa: Mapa; hasta: number; datos: number; reconocidas: number } | null = null;

  for (let i = 0; i < Math.min(50, matriz.length); i++) {
    if (vacia(matriz[i])) continue;
    const mapa = mapear(matriz[i].map(texto));
    if (mapa.nombre === undefined) continue;
    // La tabla termina donde hay dos filas vacías seguidas.
    let hasta = i;
    let datos = 0;
    for (let j = i + 1; j < matriz.length; j++) {
      if (vacia(matriz[j])) {
        if (vacia(matriz[j + 1])) break;
        continue;
      }
      hasta = j;
      if (texto(matriz[j][mapa.nombre])) datos++;
    }
    const reconocidas = Object.keys(mapa).length;
    if (!mejor || datos > mejor.datos || (datos === mejor.datos && reconocidas > mejor.reconocidas)) {
      mejor = { fila: i, mapa, hasta, datos, reconocidas };
    }
    i = hasta; // la siguiente tabla, si hay, empieza después de esta
  }

  const ancho = Math.max(...matriz.map((f) => f.length));
  const ejemplo = (desde: number, hasta: number, col: number) => {
    for (let j = desde; j <= hasta; j++) {
      const t = texto(matriz[j]?.[col]);
      if (t) return t.slice(0, 40);
    }
    return "";
  };

  // Sin títulos reconocibles: se asume nombre, precio, stock (como en el prototipo).
  if (!mejor) {
    const hasta = matriz.length - 1;
    return {
      filaTitulos: -1,
      columnas: Array.from({ length: ancho }, (_, c) => ({ titulo: `Columna ${letra(c)}`, ejemplo: ejemplo(0, hasta, c) })),
      hasta,
      mapa: { nombre: 0, ...(ancho > 1 ? { precio: 1 } : {}), ...(ancho > 2 ? { stock: 2 } : {}) },
      ignoradas: [],
    };
  }

  const m = mejor;
  const titulos = matriz[m.fila];
  const fuera = matriz.flatMap((f, j) => ((j < m.fila || j > m.hasta) && !vacia(f) ? [j + 1] : []));
  return {
    filaTitulos: m.fila,
    columnas: Array.from({ length: ancho }, (_, c) => ({ titulo: texto(titulos[c]) || `Columna ${letra(c)}`, ejemplo: ejemplo(m.fila + 1, m.hasta, c) })),
    hasta: m.hasta,
    mapa: m.mapa,
    ignoradas: rangos(fuera),
  };
}

export const letra = (c: number): string => (c < 26 ? String.fromCharCode(65 + c) : letra(Math.floor(c / 26) - 1) + letra(c % 26));

// [1,2,3,5] -> ["1 a 3", "5"]
function rangos(nums: number[]) {
  const r: string[] = [];
  for (let k = 0; k < nums.length; ) {
    let fin = k;
    while (nums[fin + 1] === nums[fin] + 1) fin++;
    r.push(fin > k ? `${nums[k]} a ${nums[fin]}` : String(nums[k]));
    k = fin + 1;
  }
  return r;
}

// "$ 1.200,50" -> 1200.5 · "1200.5" -> 1200.5 · "1.200" -> 1200 · "" / "consultar" -> null
export function leerPrecio(v: Celda): number | null | "error" {
  if (typeof v === "number") return v >= 0 ? Math.round(v * 100) / 100 : "error";
  let s = texto(v).replace(/^\$\s*/, "").replace(/\s/g, "");
  if (!s || /consult|^-$/i.test(s)) return null;
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : "error";
}

// El margen puede venir como coeficiente (2,5 = el doble y medio del costo)
// o como porcentaje (40 o "40%" = costo + 40 %). Devuelve por cuánto multiplicar.
export function leerMargen(v: Celda): number | null {
  const s = texto(v);
  const pct = s.includes("%");
  const n = typeof v === "number" ? v : leerPrecio(s.replace("%", ""));
  if (typeof n !== "number" || n <= 0) return null;
  if (pct) return 1 + n / 100;
  if (n < 1) return 1 + n; // 0,4 = 40 %
  if (n <= 10) return n; // coeficiente
  return 1 + n / 100; // 40 = 40 %
}

// Número -> stock exacto · "hay"/"poco"/"no hay" -> semáforo · "consultar" · "a pedido"
export function leerStock(v: Celda): Pick<FilaProducto, "modo" | "stock" | "semaforo"> | "error" | null {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? { modo: "exacto", stock: Math.floor(v), semaforo: null } : "error";
  const s = normal(texto(v));
  if (!s) return null;
  if (/^\d+$/.test(s)) return { modo: "exacto", stock: Number(s), semaforo: null };
  if (["no", "no hay", "sin stock", "agotado", "0 no"].includes(s)) return { modo: "semaforo", stock: null, semaforo: "no" };
  if (["poco", "pocas", "pocos", "ultimas", "ultimos", "bajo"].includes(s)) return { modo: "semaforo", stock: null, semaforo: "poco" };
  if (["hay", "si", "disponible", "con stock", "ok"].includes(s)) return { modo: "semaforo", stock: null, semaforo: "hay" };
  if (s.startsWith("consult")) return { modo: "consultar", stock: null, semaforo: null };
  if (s.includes("pedido") || s.includes("encargo")) return { modo: "pedido", stock: null, semaforo: null };
  return "error";
}

// Filas que no son productos: totales, subtotales y los ejemplos de la plantilla.
const esTotal = (f: Celda[]) => f.some((c) => /^(sub)?total(es)?\b/.test(normal(texto(c))));
const esEjemplo = (nombre: string) => normal(nombre).startsWith("ejemplo");

// Lee las filas de la tabla con el mapa de columnas.
export function interpretarPlanilla(matriz: Celda[][], tabla: Tabla, mapa: Mapa = tabla.mapa): ResultadoLectura {
  const errores: string[] = [];
  if (mapa.nombre === undefined) return { filas: [], errores: ["Elegí qué columna tiene el nombre del producto."] };
  if (tabla.ignoradas.length) {
    errores.push(`Tomamos la tabla de la fila ${tabla.filaTitulos + 1}. No cargamos las filas ${tabla.ignoradas.join(", ")}, que están fuera de esa tabla.`);
  }

  const filas: FilaProducto[] = [];
  const vistos = new Map<string, number>();
  const calcula = mapa.precio === undefined && mapa.costo !== undefined && mapa.margen !== undefined;

  for (let i = tabla.filaTitulos + 1; i <= tabla.hasta; i++) {
    const f = matriz[i] ?? [];
    if (vacia(f)) continue;
    if (filas.length >= MAX_FILAS) {
      errores.push(`La planilla tiene más de ${MAX_FILAS} productos: cargamos los primeros ${MAX_FILAS}. Dividila en dos archivos.`);
      break;
    }
    const n = i + 1;
    const dato = (k: Dato): Celda | undefined => (mapa[k] === undefined ? undefined : f[mapa[k]]);
    const nombre = texto(dato("nombre")).slice(0, 200);
    if (!nombre || esEjemplo(nombre)) {
      // Una fila de totales o un ejemplo de la plantilla se saltea sin avisar.
      if (!nombre && !esTotal(f) && (texto(dato("codigo")) || mapa.codigo === undefined)) {
        errores.push(`Fila ${n}: falta el nombre del producto (la salteamos).`);
      }
      continue;
    }
    const fila: FilaProducto = {
      fila: n,
      codigo: texto(dato("codigo")).slice(0, 60) || null,
      nombre,
      marca: texto(dato("marca")).slice(0, 80) || null,
      grupo: texto(dato("grupo")).slice(0, 120) || null,
      descripcion: texto(dato("descripcion")).slice(0, 1000) || null,
    };

    if (mapa.precio !== undefined) {
      const p = leerPrecio(dato("precio"));
      if (p === "error") {
        errores.push(`Fila ${n} (${nombre}): el precio "${texto(dato("precio"))}" no es un número (lo dejamos "A consultar").`);
        fila.precio = null;
      } else fila.precio = p;
    } else if (calcula) {
      const costo = leerPrecio(dato("costo"));
      const factor = leerMargen(dato("margen"));
      if (typeof costo === "number" && factor) fila.precio = Math.round(costo * factor * 100) / 100;
      else {
        fila.precio = null;
        if (texto(dato("costo")) || texto(dato("margen"))) {
          errores.push(`Fila ${n} (${nombre}): no pudimos calcular el precio con costo "${texto(dato("costo"))}" y margen "${texto(dato("margen"))}" (lo dejamos "A consultar").`);
        }
      }
    }

    if (mapa.stock !== undefined) {
      const s = leerStock(dato("stock"));
      if (s === "error") {
        errores.push(`Fila ${n} (${nombre}): no entendimos el stock "${texto(dato("stock"))}" (lo dejamos como "Consultar").`);
        Object.assign(fila, { modo: "consultar", stock: null, semaforo: null });
      } else if (s) Object.assign(fila, s);
    }

    const clave = fila.codigo ? `c:${fila.codigo}` : `n:${normal(nombre)}`;
    if (vistos.has(clave)) {
      errores.push(`Fila ${n} (${nombre}): está repetida con la fila ${vistos.get(clave)} (usamos la última).`);
      filas.splice(
        filas.findIndex((x) => x.fila === vistos.get(clave)),
        1,
      );
    }
    vistos.set(clave, n);
    filas.push(fila);
  }
  if (!filas.length) errores.push("No encontramos productos en la planilla.");
  return { filas, errores };
}

// Une cada fila con un producto existente: primero por código, después por nombre.
export function emparejar<F extends { codigo: string | null; nombre: string }, T extends { id: number; codigo: string | null; nombre: string }>(
  filas: F[],
  existentes: T[],
) {
  const porCodigo = new Map(existentes.filter((p) => p.codigo).map((p) => [p.codigo!, p]));
  const porNombre = new Map(existentes.map((p) => [normal(p.nombre), p]));
  return filas.map((f) => ({ fila: f, existente: (f.codigo && porCodigo.get(f.codigo)) || porNombre.get(normal(f.nombre)) || null }));
}

export const nombreNormal = normal;
