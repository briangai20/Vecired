import type { NextConfig } from "next";

// Sin estas variables la app compila pero se cae al abrir cualquier página.
// Mejor que falle el build: así Vercel no publica una versión rota.
const faltan = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"].filter((k) => !process.env[k]);
if (faltan.length) {
  throw new Error(
    `Faltan variables de entorno: ${faltan.join(", ")}. ` +
      "Cargalas en Vercel (Settings > Environment Variables) para Production, Preview y Development, o en web/.env.local.",
  );
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Fotos de productos guardadas en Supabase Storage
    remotePatterns: [
      {
        protocol: "https",
        hostname: "yhiampnffbxbwwhhpmzl.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // Solo para las fotos de los datos de prueba (supabase/03_datos_prueba.sql)
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  // El service worker de los avisos (public/sw.js) no se guarda en caché,
  // así cada arreglo llega enseguida a los celulares.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
