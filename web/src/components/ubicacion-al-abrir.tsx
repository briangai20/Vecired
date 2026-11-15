"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { guardarUbicacion, ubicacionDelNavegador } from "@/lib/ubicacion";

const MARCA = "vecired:ubicacion-al-abrir";
const AUSENCIA = 30 * 60_000; // si estuvo cerrada/oculta más de 30 min, se vuelve a pedir
const DEPENDEN = ["/", "/ofertas"]; // páginas que muestran cosas según la ubicación

// Cada vez que se abre VeciRed (o se vuelve después de un rato), toma la
// ubicación actual del GPS con alta precisión, la guarda y actualiza la
// página. Así no arranca desde la última ubicación de la vez anterior.
// Si la persona no da permiso, sigue con la zona de siempre.
export function UbicacionAlAbrir() {
  const router = useRouter();
  const ruta = usePathname();
  const params = useSearchParams();
  const datos = useRef({ ruta, params: params.toString() });
  useEffect(() => {
    datos.current = { ruta, params: params.toString() };
  }, [ruta, params]);

  useEffect(() => {
    function pedir() {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const antes = ubicacionDelNavegador();
          guardarUbicacion({ lat: pos.coords.latitude, lng: pos.coords.longitude, gps: true, radio: antes.radio });
          const { ruta: r, params: p } = datos.current;
          if (!DEPENDEN.includes(r)) return;
          // Se saca de la dirección la ubicación vieja para que use la nueva.
          const q = new URLSearchParams(p);
          const habia = ["zona", "lat", "lng", "lugar", "comercio"].some((k) => q.has(k));
          for (const k of ["zona", "lat", "lng", "lugar", "comercio"]) q.delete(k);
          if (habia) router.replace(`${r}${q.size ? `?${q}` : ""}`, { scroll: false });
          else router.refresh();
        },
        () => {},
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
      );
    }

    try {
      if (!sessionStorage.getItem(MARCA)) {
        sessionStorage.setItem(MARCA, "1");
        pedir();
      }
    } catch {
      pedir();
    }

    // Al volver a la app después de un rato largo, se actualiza de nuevo.
    let oculta = 0;
    const alCambiar = () => {
      if (document.visibilityState === "hidden") oculta = Date.now();
      else if (oculta && Date.now() - oculta > AUSENCIA) pedir();
    };
    document.addEventListener("visibilitychange", alCambiar);
    return () => document.removeEventListener("visibilitychange", alCambiar);
  }, [router]);

  return null;
}
