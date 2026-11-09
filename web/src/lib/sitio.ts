// Dirección pública del sitio, para el sitemap, el robots y las vistas previas
// al compartir un link (WhatsApp, Facebook, etc.).
export const SITIO = "https://vecired.com.ar";

export const DESCRIPCION_SITIO =
  "Encontrá productos en los comercios de tu barrio, reservalos y retiralos en el local.";

// Vista previa al compartir una página. Cada página que la define reemplaza la
// general entera, así que siempre lleva el nombre del sitio y, si no hay foto
// propia, la imagen de VeciRed (app/opengraph-image.tsx).
export function vistaPrevia({ titulo, descripcion, ruta, foto, alt }: { titulo: string; descripcion: string; ruta: string; foto?: string | null; alt: string }) {
  return {
    siteName: "VeciRed",
    locale: "es_AR",
    type: "website" as const,
    title: titulo,
    description: descripcion,
    url: ruta,
    images: [foto ? { url: foto, alt } : { url: "/opengraph-image", width: 1200, height: 630, alt: "VeciRed: conectá con el comercio de tu barrio" }],
  };
}
