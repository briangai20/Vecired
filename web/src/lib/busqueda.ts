// Búsqueda que perdona errores de tipeo: "tornilo", "martiyo" o "alimento
// perro" encuentran "Tornillo", "Martillo" y "Alimento para perros". Se usa en
// la portada (servidor) y en el catálogo de cada comercio (navegador), sin
// tocar la base: compara palabra por palabra contra los productos que hay.

// Minúsculas, sin acentos y solo letras y números.
export function normalizar(t: string) {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Palabras que no cambian lo que se busca ("alimento para perro").
const RELLENO = new Set(["de", "del", "la", "las", "el", "los", "lo", "para", "con", "y", "e", "o", "en", "un", "una", "unos", "unas", "por", "al", "a"]);

/** Las palabras que importan de lo que se escribió (si son todas de relleno, quedan todas). */
export function palabrasBuscadas(t: string) {
  const todas = normalizar(t).split(" ").filter(Boolean);
  const utiles = todas.filter((p) => !RELLENO.has(p));
  return utiles.length ? utiles : todas;
}

export const palabrasDe = (t: string) => normalizar(t).split(" ").filter(Boolean);

// Cuántas letras se pueden errar según el largo de la palabra.
const tolerancia = (n: number) => (n <= 3 ? 0 : n <= 5 ? 1 : 2);

// Distancia entre dos palabras: letras de más, de menos, cambiadas o dadas vuelta.
export function distancia(a: string, b: string) {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + costo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

// ¿La palabra buscada es (casi) esta palabra del producto? También vale si la
// está escribiendo a medias ("tornil" → "tornillo"), con o sin error.
function seParece(buscada: string, palabra: string) {
  if (palabra.includes(buscada)) return true;
  const tol = tolerancia(buscada.length);
  if (!tol) return false;
  if (Math.abs(palabra.length - buscada.length) <= tol && distancia(buscada, palabra) <= tol) return true;
  return buscada.length >= 5 && palabra.length > buscada.length && distancia(buscada, palabra.slice(0, buscada.length)) <= 1;
}

/** Cada palabra buscada aparece tal cual en el texto. */
export function coincideExacto(texto: string, buscadas: string[]) {
  const t = normalizar(texto);
  return buscadas.every((b) => t.includes(b));
}

/** Cada palabra buscada se parece a alguna del texto. */
export function coincideAprox(palabras: string[], buscadas: string[]) {
  return buscadas.every((b) => palabras.some((p) => !RELLENO.has(p) && seParece(b, p)));
}

/** Qué parte de lo buscado se parece al texto (0 a 1): para ordenar "parecidos". */
export function parecido(palabras: string[], buscadas: string[]) {
  if (!buscadas.length) return 0;
  return buscadas.filter((b) => palabras.some((p) => !RELLENO.has(p) && seParece(b, p))).length / buscadas.length;
}

/** Arma el vocabulario (palabra → cuántas veces aparece) de una lista de textos. */
export function vocabulario(textos: string[]) {
  const v = new Map<string, number>();
  for (const t of textos) for (const p of palabrasDe(t)) if (p.length >= 3) v.set(p, (v.get(p) ?? 0) + 1);
  return v;
}

/**
 * Corrige lo escrito con las palabras que existen: "martiyo de goma" →
 * "martillo de goma". Devuelve null si no hacía falta (o no hay nada parecido).
 */
export function corregir(texto: string, vocab: Map<string, number>) {
  let cambio = false;
  const salida = palabrasDe(texto).map((w) => {
    if (w.length < 3 || RELLENO.has(w)) return w;
    for (const v of vocab.keys()) if (v.includes(w)) return w;
    const tol = tolerancia(w.length);
    let mejor: string | null = null;
    let mejorD = Infinity;
    let mejorN = 0;
    for (const [v, n] of vocab) {
      if (Math.abs(v.length - w.length) > tol) continue;
      const d = distancia(w, v);
      if (d <= tol && (d < mejorD || (d === mejorD && n > mejorN))) {
        mejor = v;
        mejorD = d;
        mejorN = n;
      }
    }
    if (!mejor) return w;
    cambio = true;
    return mejor;
  });
  return cambio ? salida.join(" ") : null;
}
