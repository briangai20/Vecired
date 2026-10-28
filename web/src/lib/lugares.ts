// Busca calles, barrios y ciudades mientras se escribe, con Photon (buscador
// gratuito sobre los mismos datos de OpenStreetMap que usa el mapa). Solo
// Argentina, y primero lo que está cerca del punto que se pasa.
export type Lugar = { nombre: string; detalle: string; lat: number; lng: number };

const ARGENTINA = "-73.6,-55.1,-53.6,-21.8"; // oeste, sur, este, norte

type Propiedades = {
  name?: string;
  street?: string;
  housenumber?: string;
  district?: string;
  city?: string;
  county?: string;
  state?: string;
};

function armar(p: Propiedades, lat: number, lng: number): Lugar | null {
  const calle = p.street ? [p.street, p.housenumber].filter(Boolean).join(" ") : "";
  const nombre = p.name || calle;
  if (!nombre) return null;
  const detalle = [p.name && calle !== p.name ? calle : "", p.district, p.city ?? p.county, p.state]
    .filter((x, i, todos) => x && x !== nombre && todos.indexOf(x) === i)
    .join(", ");
  return { nombre, detalle, lat, lng };
}

export async function buscarLugares(texto: string, cerca: { lat: number; lng: number }, senal?: AbortSignal) {
  const p = new URLSearchParams({ q: texto, limit: "8", lat: String(cerca.lat), lon: String(cerca.lng), bbox: ARGENTINA });
  const r = await fetch(`https://photon.komoot.io/api/?${p}`, { signal: senal });
  if (!r.ok) throw new Error(`Photon respondió ${r.status}`);
  const datos: { features: { properties: Propiedades; geometry: { coordinates: [number, number] } }[] } = await r.json();
  const vistos = new Set<string>();
  const lugares: Lugar[] = [];
  for (const f of datos.features) {
    const [lng, lat] = f.geometry.coordinates;
    const l = armar(f.properties, lat, lng);
    // La misma calle viene partida en tramos: se muestra una vez por localidad.
    const clave = l && `${l.nombre}|${l.detalle}`;
    if (!l || vistos.has(clave!)) continue;
    vistos.add(clave!);
    lugares.push(l);
  }
  return lugares.slice(0, 6);
}
