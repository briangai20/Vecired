import type { MetadataRoute } from "next";
import { cacheLife } from "next/cache";
import { supabasePublico } from "@/lib/supabase/publico";
import { SITIO } from "@/lib/sitio";

// Lista de páginas para Google: la portada, los legales, cada comercio aprobado
// y cada producto activo. Se arma de nuevo cada una hora como mucho.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  "use cache";
  cacheLife("hours");

  const db = supabasePublico();
  const [{ data: comercios }, { data: productos }] = await Promise.all([
    db.from("comercios").select("id, creado_en, revisado_en").eq("aprobado", true),
    db
      .from("productos")
      .select("id, actualizado_en, comercio:comercios!inner(aprobado)")
      .eq("activo", true)
      .eq("comercio.aprobado", true),
  ]);

  return [
    { url: SITIO, changeFrequency: "daily", priority: 1 },
    { url: `${SITIO}/comercios`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITIO}/preguntas`, changeFrequency: "monthly", priority: 0.5 },
    ...(comercios ?? []).map((c) => ({
      url: `${SITIO}/comercio/${c.id}`,
      lastModified: c.revisado_en ?? c.creado_en,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...(productos ?? []).map((p) => ({
      url: `${SITIO}/producto/${p.id}`,
      lastModified: p.actualizado_en,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
    { url: `${SITIO}/terminos`, changeFrequency: "yearly", priority: 0.1 },
    { url: `${SITIO}/privacidad`, changeFrequency: "yearly", priority: 0.1 },
  ];
}
