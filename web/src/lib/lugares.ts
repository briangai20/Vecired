// Busca calles, barrios y ciudades mientras se escribe. Usa dos buscadores
// gratuitos y sin clave:
// - Photon: lugares, barrios, calles y comercios de OpenStreetMap (los mismos
//   datos que dibuja el mapa). Primero lo que está cerca.
// - Georef (API oficial del Estado argentino): direcciones con altura
//   ("Tomás Le Breton 4993"), que Photon a veces no encuentra según cómo se escriban.
export type Lugar = { nombre: string; detalle: string; lat: number; lng: number };
type Punto = { lat: number; lng: number };

const ARGENTINA = "-73.6,-55.1,-53.6,-21.8"; // oeste, sur, este, norte

// Photon no entiende "Capital Federal" ni "CABA": se reemplazan por el nombre oficial.
const CAPITAL = /\b(capital federal|c\.?a\.?b\.?a\.?|ciudad de buenos aires)\b/gi;

type Propiedades = {
  name?: string;
  street?: string;
  housenumber?: string;
  district?: string;
  city?: string;
  county?: string;
  state?: string;
};

function desdePhoton(p: Propiedades, lat: number, lng: number): Lugar | null {
  const calle = p.street ? [p.street, p.housenumber].filter(Boolean).join(" ") : "";
  const nombre = p.name || calle;
  if (!nombre) return null;
  const detalle = [p.name && calle !== p.name ? calle : "", p.district, p.city ?? p.county, p.state]
    .filter((x, i, todos) => x && x !== nombre && todos.indexOf(x) === i)
    .join(", ");
  return { nombre, detalle, lat, lng };
}

async function photon(texto: string, cerca: Punto, senal?: AbortSignal) {
  const p = new URLSearchParams({ q: texto, limit: "8", lat: String(cerca.lat), lon: String(cerca.lng), bbox: ARGENTINA });
  const r = await fetch(`https://photon.komoot.io/api/?${p}`, { signal: senal });
  if (!r.ok) throw new Error(`Photon respondió ${r.status}`);
  const datos: { features: { properties: Propiedades; geometry: { coordinates: [number, number] } }[] } = await r.json();
  return datos.features.flatMap((f) => {
    const l = desdePhoton(f.properties, f.geometry.coordinates[1], f.geometry.coordinates[0]);
    return l ? [l] : [];
  });
}

// Photon a veces no encuentra nada según cómo esté escrito ("Tomás Lebretón"
// en vez de "Tomás Le Breton"). Si no trae resultados, prueba solo con lo
// anterior a la primera coma y después sin la primera palabra.
async function photonInsistente(consulta: string, cerca: Punto, senal?: AbortSignal) {
  const primera = consulta.split(",")[0].trim();
  const sinPrimeraPalabra = primera.split(/\s+/).slice(1).join(" ");
  const intentos = [consulta.trim(), primera, sinPrimeraPalabra].filter((x, i, todos) => x.length >= 3 && todos.indexOf(x) === i);
  for (const intento of intentos) {
    const l = await photon(intento, cerca, senal);
    if (l.length) return l;
  }
  return [];
}

const capitalizar =(s: string) => s.toLowerCase().replace(/(^|[\s.-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

type Direccion = {
  calle: { nombre: string };
  altura: { valor: number | null };
  departamento: { nombre: string | null };
  localidad_censal: { nombre: string | null };
  provincia: { nombre: string };
  ubicacion: { lat: number | null; lon: number | null };
};

async function georef(texto: string, senal?: AbortSignal): Promise<Lugar[]> {
  // "Mendoza 1100, Ingeniero Maschwitz": lo que sigue a la coma es la localidad.
  const [direccion, ...resto] = texto.split(",");
  const localidad = resto.join(" ").trim();
  const p = new URLSearchParams({ direccion: localidad ? direccion : texto, max: "10" });
  if (localidad) p.set("localidad", localidad);
  const r = await fetch(`https://apis.datos.gob.ar/georef/api/direcciones?${p}`, { signal: senal });
  if (!r.ok) throw new Error(`Georef respondió ${r.status}`);
  const datos: { direcciones?: Direccion[] } = await r.json();
  // Si no la reconoce con esa localidad, se busca la dirección sola.
  if (localidad && !datos.direcciones?.length) return georef(direccion, senal);
  return (datos.direcciones ?? []).flatMap((d) => {
    if (d.ubicacion.lat == null || d.ubicacion.lon == null) return [];
    const detalle = [d.departamento.nombre, d.localidad_censal.nombre, d.provincia.nombre]
      .filter((x, i, todos) => x && todos.indexOf(x) === i)
      .join(", ");
    // Georef antepone "C" (calle) a algunos nombres: "C MENDOZA".
    const calle = capitalizar(d.calle.nombre.replace(/^C\s+/, ""));
    const nombre = `${calle}${d.altura.valor ? ` ${d.altura.valor}` : ""}`;
    return [{ nombre, detalle, lat: d.ubicacion.lat, lng: d.ubicacion.lon }];
  });
}

// Distancia aproximada en km (alcanza para ordenar).
const distancia = (a: Punto, b: Punto) =>
  Math.hypot(a.lat - b.lat, (a.lng - b.lng) * Math.cos((a.lat * Math.PI) / 180)) * 111;

export async function buscarLugares(texto: string, cerca: Punto, senal?: AbortSignal) {
  const consulta = texto.replace(CAPITAL, "Ciudad Autónoma de Buenos Aires");
  const conAltura = /\d/.test(texto);

  // Si un buscador falla, se usa lo que traiga el otro; si fallan los dos, se avisa.
  const [g, p] = await Promise.allSettled([
    conAltura ? georef(consulta, senal) : Promise.resolve([]),
    photonInsistente(consulta, cerca, senal),
  ]);
  senal?.throwIfAborted();
  if (g.status === "rejected" && p.status === "rejected") throw p.reason;
  const deGeoref = g.status === "fulfilled" ? g.value : [];
  const dePhoton = p.status === "fulfilled" ? p.value : [];

  const vistos = new Set<string>();
  const lugares: Lugar[] = [];
  const cercanas = deGeoref.sort((a, b) => distancia(a, cerca) - distancia(b, cerca)).slice(0, 3);
  for (const l of [...cercanas, ...dePhoton]) {
    // La misma calle viene partida en tramos: se muestra una vez por localidad.
    // Y la misma dirección puede venir de los dos buscadores (a menos de 100 m).
    const clave = `${l.nombre.toLowerCase()}|${l.detalle.toLowerCase()}`;
    const repetida = /\d/.test(l.nombre) && lugares.some((x) => /\d/.test(x.nombre) && distancia(x, l) < 0.1);
    if (vistos.has(clave) || repetida) continue;
    vistos.add(clave);
    lugares.push(l);
  }
  return lugares.slice(0, 6);
}
