// Empareja fotos con productos por el nombre del archivo: "OZK100.jpg" con
// el producto de código OZK100, "Collar reflectivo.jpg" con ese producto.
import { nombreNormal as normal } from "./importar";

export type ProductoFoto = { id: number; codigo: string | null; nombre: string; foto_url: string | null };
export type Coincidencia = { productoId: number; como: "código" | "nombre" | "parecido" } | null;

const palabras = (s: string) => new Set(normal(s).split(" ").filter((p) => p.length >= 2));

export function emparejarFoto(archivo: string, productos: ProductoFoto[]): Coincidencia {
  const base = archivo.replace(/\.[a-z0-9]+$/i, "");
  // "OZK100 (2)", "OZK100-1", "OZK100_3": copias de la misma foto.
  const sinCopia = base.replace(/\s*\(\d+\)$|[-_ ]\d{1,2}$/, "");
  const nombres = [...new Set([base, sinCopia])].map(normal).filter(Boolean);
  if (!nombres.length) return null;

  // 1. Código exacto, o el código como una palabra del archivo ("OZK100 collar").
  for (const n of nombres) {
    const p = productos.find((x) => x.codigo && normal(x.codigo) === n);
    if (p) return { productoId: p.id, como: "código" };
  }
  const tokens = new Set(nombres.flatMap((n) => n.split(" ")));
  const porToken = productos.filter((x) => x.codigo && normal(x.codigo).length >= 3 && tokens.has(normal(x.codigo)));
  if (porToken.length === 1) return { productoId: porToken[0].id, como: "código" };

  // 2. Nombre exacto.
  for (const n of nombres) {
    const p = productos.find((x) => normal(x.nombre) === n);
    if (p) return { productoId: p.id, como: "nombre" };
  }

  // 3. Nombre parecido: comparten la mayoría de las palabras. Si hay empate, no se adivina.
  const delArchivo = palabras(sinCopia);
  if (delArchivo.size < 2) return null;
  let mejor: { id: number; parecido: number } | null = null;
  let empate = false;
  for (const p of productos) {
    const delProducto = palabras(p.nombre);
    const comunes = [...delArchivo].filter((w) => delProducto.has(w)).length;
    // Si todas las palabras del archivo están en el producto ("Comedero doble"
    // en "Comedero doble 41x22 cm"), cuenta como bastante parecido.
    const parecido = Math.max(comunes / new Set([...delArchivo, ...delProducto]).size, comunes === delArchivo.size ? 0.7 : 0);
    if (parecido < 0.6) continue;
    if (!mejor || parecido > mejor.parecido) {
      mejor = { id: p.id, parecido };
      empate = false;
    } else if (parecido === mejor.parecido) empate = true;
  }
  return mejor && !empate ? { productoId: mejor.id, como: "parecido" } : null;
}
