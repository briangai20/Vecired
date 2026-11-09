import type { MetadataRoute } from "next";
import { SITIO } from "@/lib/sitio";

// Les dice a Google y compañía qué pueden mostrar: lo público sí, los paneles y
// las páginas de cuenta no.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/comerciante", "/cuenta", "/reservas", "/ingresar", "/recuperar", "/nueva-clave", "/auth"],
    },
    sitemap: `${SITIO}/sitemap.xml`,
    host: SITIO,
  };
}
