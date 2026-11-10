// Ícono para cada rubro en los accesos de la portada. Se busca por palabra
// clave sin acentos, así "Ferretería" y "ferreteria industrial" dan lo mismo.
const ICONOS: [string, string][] = [
  ["ferret", "🔧"],
  ["herraj", "🔩"],
  ["merceri", "🧵"],
  ["mascot", "🐾"],
  ["veterinari", "🐾"],
  ["kiosc", "🍬"],
  ["librer", "📚"],
  ["almacen", "🛒"],
  ["verduler", "🥕"],
  ["carnicer", "🥩"],
  ["panader", "🥖"],
  ["farmac", "💊"],
  ["perfumer", "🧴"],
  ["ropa", "👕"],
  ["indumentari", "👕"],
  ["calzad", "👟"],
  ["zapater", "👟"],
  ["jugueter", "🧸"],
  ["electr", "💡"],
  ["pintur", "🎨"],
  ["bazar", "🍽️"],
  ["vivero", "🌱"],
  ["jardin", "🌱"],
  ["bicicle", "🚲"],
  ["tecnolog", "💻"],
  ["celular", "📱"],
  ["optica", "👓"],
  ["regaler", "🎁"],
];

export const sinAcentos = (v: string) =>
  v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export function iconoRubro(rubro: string) {
  const r = sinAcentos(rubro);
  return ICONOS.find(([clave]) => r.includes(clave))?.[1] ?? "🏪";
}

// "FERRETERÍA" o "ferretería" → "Ferretería".
export const nombreRubro = (rubro: string) => {
  const t = rubro.trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};
