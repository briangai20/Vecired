// Comprobaciones y links para verificar que un comercio existe antes de publicarlo.
import { cuitConGuiones, cuitValido, soloDigitos } from "@/lib/cuit";
import { buscarLugares } from "@/lib/lugares";
import { enlaceWhatsapp, numeroWhatsapp } from "@/lib/whatsapp";

// Controles que marca el administrador al aprobar (se guardan en comercios.controles).
export const CONTROLES = {
  existe: "Confirmé que el local existe (lo vi en Google Maps, Street View, redes o en persona)",
  cartel: "El nombre y el rubro coinciden con lo que se ve (cartel, redes o fotos)",
  pin: "El pin está en la puerta del local",
  contacto: "Hablé con el dueño por WhatsApp o teléfono",
  cuit: "El CUIT existe y corresponde al comercio o a su titular",
} as const;
export type Control = keyof typeof CONTROLES;

export const MOTIVOS = [
  "No pudimos confirmar que el local exista. Subí una foto del frente con el cartel y tus redes o página.",
  "El pin no coincide con la dirección. Movelo a la puerta del local.",
  "El CUIT no es válido o no corresponde al comercio. Revisalo.",
  "Falta cargar el horario de atención.",
  "No pudimos comunicarnos con vos. Revisá el WhatsApp o escribinos.",
] as const;

const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  Math.hypot(a.lat - b.lat, (a.lng - b.lng) * Math.cos((a.lat * Math.PI) / 180)) * 111.32;

// Busca la dirección escrita y mide a cuántos metros queda del pin.
// null = no se pudo ubicar la dirección (no quiere decir que esté mal).
export async function distanciaDireccionPin(direccion: string, zona: string, pin: { lat: number; lng: number }) {
  try {
    const senal = AbortSignal.timeout(5000);
    const lugares = (await buscarLugares(`${direccion}, ${zona}`, pin, senal)).filter((l) => /\d/.test(l.nombre));
    if (!lugares.length) return null;
    return Math.round(Math.min(...lugares.map((l) => km(l, pin))) * 1000);
  } catch {
    return null;
  }
}

export type Chequeo = { ok: boolean | null; texto: string };

export function chequeos(c: {
  cuit: string | null;
  mail_confirmado: boolean;
  lat: number | null;
  whatsapp: string | null;
  con_horario: boolean;
  productos: number;
  foto_local_url: string | null;
  redes: string | null;
  logo_url: string | null;
  metros: number | null | undefined;
}): Chequeo[] {
  return [
    {
      ok: c.cuit ? cuitValido(c.cuit) : null,
      texto: c.cuit ? (cuitValido(c.cuit) ? `CUIT ${cuitConGuiones(c.cuit)} con formato válido` : `CUIT ${c.cuit} inválido (dígito verificador)`) : "Sin CUIT",
    },
    {
      ok: c.lat == null ? false : c.metros == null ? null : c.metros <= 250,
      texto:
        c.lat == null
          ? "Sin pin en el mapa"
          : c.metros == null
            ? "No pudimos ubicar la dirección escrita: comparala a mano"
            : `La dirección escrita queda a ${c.metros < 1000 ? `${c.metros} m` : `${(c.metros / 1000).toFixed(1).replace(".", ",")} km`} del pin`,
    },
    { ok: !!c.foto_local_url || null, texto: c.foto_local_url ? "Subió foto del frente" : "Sin foto del frente" },
    { ok: !!c.redes || null, texto: c.redes ? "Cargó redes o página" : "Sin redes ni página" },
    {
      ok: !!numeroWhatsapp(c.whatsapp),
      texto: numeroWhatsapp(c.whatsapp) ? "Tiene WhatsApp para contactarlo" : c.whatsapp ? `WhatsApp mal cargado (${c.whatsapp})` : "Sin WhatsApp",
    },
    { ok: c.mail_confirmado, texto: c.mail_confirmado ? "Mail del dueño confirmado" : "El dueño no confirmó su mail" },
    { ok: c.con_horario, texto: c.con_horario ? "Horario cargado" : "Sin horario" },
    { ok: c.productos > 0 || null, texto: `${c.productos} productos cargados` },
    { ok: !!c.logo_url || null, texto: c.logo_url ? "Tiene logo" : "Sin logo" },
  ];
}

// Links para buscar el comercio por afuera de VeciRed.
export function enlacesVerificacion(c: { nombre: string; direccion: string; zona: string; lat: number | null; lng: number | null; cuit: string | null; redes: string | null; whatsapp: string | null }) {
  const q = (s: string) => encodeURIComponent(s);
  const lugar = `${c.direccion}, ${c.zona}`;
  const enlaces: { texto: string; href: string }[] = [
    { texto: "Buscar en Google", href: `https://www.google.com/search?q=${q(`"${c.nombre}" ${c.zona}`)}` },
    { texto: "Buscar en Google Maps", href: `https://www.google.com/maps/search/?api=1&query=${q(`${c.nombre} ${lugar}`)}` },
  ];
  if (c.lat != null && c.lng != null) {
    enlaces.push(
      { texto: "Ver el pin en el mapa", href: `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}` },
      { texto: "Ver la fachada (Street View)", href: `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${c.lat},${c.lng}` },
    );
  }
  enlaces.push({ texto: "Buscar en Instagram", href: `https://www.google.com/search?q=${q(`site:instagram.com ${c.nombre} ${c.zona}`)}` });
  if (c.cuit) enlaces.push({ texto: "Consultar el CUIT", href: `https://www.cuitonline.com/search.php?q=${soloDigitos(c.cuit)}` });
  if (c.redes) {
    const r = c.redes.trim();
    const href = /^https?:\/\//i.test(r) ? r : r.startsWith("@") ? `https://www.instagram.com/${r.slice(1)}` : `https://www.google.com/search?q=${q(r)}`;
    enlaces.push({ texto: `Abrir ${r.length > 30 ? "sus redes" : r}`, href });
  }
  const whatsapp = enlaceWhatsapp(
    c.whatsapp,
    `Hola, te escribimos de VeciRed. Estamos revisando "${c.nombre}" para publicarlo. ¿Nos confirmás la dirección (${c.direccion}) y el horario? ¡Gracias!`,
  );
  if (whatsapp) enlaces.push({ texto: "Escribirle por WhatsApp", href: whatsapp });
  return enlaces;
}
