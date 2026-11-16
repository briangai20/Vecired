"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { guardarUbicacion, ubicacionDelNavegador } from "@/lib/ubicacion";

const MARCA = "vecired:ubicacion-al-abrir";
const DEPENDEN = ["/", "/ofertas"]; // páginas que muestran cosas según la ubicación
const CLAVES = ["zona", "lat", "lng", "lugar", "comercio"];

// Cada vez que se abre VeciRed de cero (pestaña o app nueva), toma la
// ubicación actual y la guarda: no arranca desde la de la vez anterior.
// Mientras se navega no cambia sola: solo si la persona elige otra.
// Primero prueba con el GPS (alta precisión); si no responde, con la
// precisión normal. Si no se puede (sin permiso), usa la zona de siempre.
export function UbicacionAlAbrir() {
  const router = useRouter();
  const ruta = usePathname();
  const params = useSearchParams();
  const datos = useRef({ ruta, params: params.toString() });
  useEffect(() => {
    datos.current = { ruta, params: params.toString() };
  }, [ruta, params]);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(MARCA)) return;
      sessionStorage.setItem(MARCA, "1");
    } catch {}

    // Actualiza la página para que use la ubicación guardada.
    function aplicar() {
      const { ruta: r, params: p } = datos.current;
      if (!DEPENDEN.includes(r)) return;
      const q = new URLSearchParams(p);
      const habia = CLAVES.some((k) => q.has(k));
      for (const k of CLAVES) q.delete(k);
      if (habia) router.replace(`${r}${q.size ? `?${q}` : ""}`, { scroll: false });
      else router.refresh();
    }

    const radio = ubicacionDelNavegador().radio;
    const listo = (pos: GeolocationPosition) => {
      guardarUbicacion({ lat: pos.coords.latitude, lng: pos.coords.longitude, gps: true, radio });
      aplicar();
    };
    // Sin ubicación: se olvida la de la vez anterior y queda la zona de siempre.
    const sinUbicacion = () => {
      guardarUbicacion({ radio });
      aplicar();
    };

    if (!navigator.geolocation) return sinUbicacion();
    navigator.geolocation.getCurrentPosition(
      listo,
      (e) => {
        if (e.code === e.PERMISSION_DENIED) return sinUbicacion();
        navigator.geolocation.getCurrentPosition(listo, sinUbicacion, { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 });
      },
      { enableHighAccuracy: true, timeout: 8_000, maximumAge: 30_000 },
    );
  }, [router]);

  return null;
}
