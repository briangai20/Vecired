import type { MetadataRoute } from "next";
import { DESCRIPCION_SITIO } from "@/lib/sitio";

// Lo que necesita el celular para instalar VeciRed como una app: nombre,
// colores e íconos. Se abre sin la barra del navegador.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VeciRed",
    short_name: "VeciRed",
    description: DESCRIPCION_SITIO,
    lang: "es-AR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#14213d",
    theme_color: "#14213d",
    categories: ["shopping", "lifestyle"],
    icons: [
      { src: "/icono-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icono-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icono-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Mis reservas", url: "/reservas" },
      { name: "Favoritos", url: "/favoritos" },
    ],
  };
}
