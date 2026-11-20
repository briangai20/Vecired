// Ubicación de búsqueda guardada en una cookie, para que todas las páginas
// (portada, ofertas, resultados) busquen en el mismo lugar. Si la dirección
// trae una ubicación (?lat=&lng= o ?zona=), manda la dirección.
//
// Formato: "lat=-34.38204&lng=-58.73707&gps=1&radio=5" (como una dirección).

export const COOKIE_UBICACION = "vecired_ubicacion";

export type Ubicacion = {
  lat?: number;
  lng?: number;
  /** Nombre del lugar elegido en el buscador. */
  lugar?: string;
  zona?: string;
  radio?: number;
  /** true si las coordenadas son las del GPS del aparato (precisas). */
  gps?: boolean;
};

export function leerUbicacion(texto: string | undefined | null): Ubicacion {
  if (!texto) return {};
  const p = new URLSearchParams(texto);
  const num = (k: string) => {
    const v = Number(p.get(k));
    return p.get(k) != null && Number.isFinite(v) ? v : undefined;
  };
  const lat = num("lat");
  const lng = num("lng");
  const valida = lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  return {
    ...(valida ? { lat, lng } : {}),
    lugar: p.get("lugar")?.slice(0, 120) || undefined,
    zona: p.get("zona") || undefined,
    radio: num("radio"),
    gps: p.get("gps") === "1",
  };
}

export function escribirUbicacion(u: Ubicacion) {
  const p = new URLSearchParams();
  if (u.lat != null && u.lng != null) {
    p.set("lat", u.lat.toFixed(6));
    p.set("lng", u.lng.toFixed(6));
    if (u.lugar) p.set("lugar", u.lugar);
    if (u.gps) p.set("gps", "1");
  } else if (u.zona) p.set("zona", u.zona);
  if (u.radio) p.set("radio", String(u.radio));
  return p.toString();
}

// Solo en el navegador.
export function guardarUbicacion(u: Ubicacion) {
  try {
    document.cookie = `${COOKIE_UBICACION}=${encodeURIComponent(escribirUbicacion(u))}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
  } catch {}
}

export function ubicacionDelNavegador(): Ubicacion {
  try {
    const par = document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE_UBICACION}=`));
    return leerUbicacion(par ? decodeURIComponent(par.slice(COOKIE_UBICACION.length + 1)) : "");
  } catch {
    return {};
  }
}

// Enlace a Google Maps para llegar al comercio. Si tenemos tu ubicación del
// GPS, va como punto de partida (si no, Google la adivina y en la compu suele
// errar).
export function enlaceComoLlegar(destino: { lat: number; lng: number }, desde?: Ubicacion) {
  const p = new URLSearchParams({ api: "1", destination: `${destino.lat},${destino.lng}` });
  if (desde?.gps && desde.lat != null && desde.lng != null) p.set("origin", `${desde.lat},${desde.lng}`);
  return `https://www.google.com/maps/dir/?${p}`;
}

export type AppMapa = "google" | "waze" | "apple";

// Enlaces para navegar hasta el comercio en cada app. En el celular abren la
// app con el recorrido armado desde donde estás y el botón para iniciar el
// viaje (Google necesita `dir_action=navigate` y que no le pasemos un origen;
// Waze, `navigate=yes`; Apple Maps arma la ruta con `daddr`).
export function enlaceNavegar(app: AppMapa, destino: { lat: number; lng: number }, desde?: Ubicacion, celular = true) {
  const d = `${destino.lat},${destino.lng}`;
  if (app === "waze") return `https://waze.com/ul?${new URLSearchParams({ ll: d, navigate: "yes" })}`;
  if (app === "apple") {
    const p = new URLSearchParams({ daddr: d, dirflg: "d" });
    if (!celular && desde?.gps && desde.lat != null && desde.lng != null) p.set("saddr", `${desde.lat},${desde.lng}`);
    return `https://maps.apple.com/?${p}`;
  }
  if (celular) return `https://www.google.com/maps/dir/?${new URLSearchParams({ api: "1", destination: d, dir_action: "navigate" })}`;
  return enlaceComoLlegar(destino, desde);
}

export type Sistema = "ios" | "android" | "otro";

export function sistemaDelCelular(): Sistema {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  // iPad con iPadOS se presenta como Mac, pero tiene pantalla táctil.
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  return "otro";
}

// Enlace que abre directo la APP de mapas (no la página web, que solo muestra el
// recorrido y no deja iniciar el viaje). null = no hay app para ese celular.
export function enlaceApp(app: AppMapa, destino: { lat: number; lng: number }, sistema: Sistema) {
  const d = `${destino.lat},${destino.lng}`;
  if (sistema === "ios") {
    if (app === "google") return `comgooglemaps://?daddr=${d}&directionsmode=driving`;
    if (app === "waze") return `waze://?ll=${d}&navigate=yes`;
    return `maps://?daddr=${d}&dirflg=d`;
  }
  if (sistema === "android") {
    // Arranca la navegación de Google Maps directamente.
    if (app === "google") return `google.navigation:q=${d}`;
    if (app === "waze") return `waze://?ll=${d}&navigate=yes`;
  }
  return null;
}
