"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  guardarUbicacion,
  sistemaDelCelular,
  ubicacionDelNavegador,
} from "@/lib/ubicacion";

const MARCA = "vecired:ubicacion-al-abrir";
// En el iPhone, después de un "No permitir" el navegador no vuelve a preguntar
// en la misma página: hay que recargarla y pedir de nuevo al cargar.
const PEDIR_AL_CARGAR = "vecired:pedir-ubicacion";
const DEPENDEN = ["/", "/ofertas"]; // páginas que muestran cosas según la ubicación
const CLAVES = ["zona", "lat", "lng", "lugar", "comercio"];

// Cada vez que se abre VeciRed de cero (pestaña o app nueva), toma la
// ubicación actual y la guarda: no arranca desde la de la vez anterior.
// Mientras se navega no cambia sola: solo si la persona elige otra.
// Primero prueba con el GPS (alta precisión); si no responde, con la
// precisión normal. Si no se puede (sin permiso), usa la zona de siempre y,
// si dijo que no, en cada apertura muestra un cartel para que la permita.
export function UbicacionAlAbrir() {
  const router = useRouter();
  const ruta = usePathname();
  const params = useSearchParams();
  const datos = useRef({ ruta, params: params.toString() });
  const [cartel, setCartel] = useState<null | "pedir" | "bloqueada">(null);
  const [buscando, setBuscando] = useState(false);
  useEffect(() => {
    datos.current = { ruta, params: params.toString() };
  }, [ruta, params]);

  // Actualiza la página para que use la ubicación guardada.
  const aplicar = useCallback(() => {
    const { ruta: r, params: p } = datos.current;
    if (!DEPENDEN.includes(r)) return;
    const q = new URLSearchParams(p);
    const habia = CLAVES.some((k) => q.has(k));
    for (const k of CLAVES) q.delete(k);
    if (habia)
      router.replace(`${r}${q.size ? `?${q}` : ""}`, { scroll: false });
    else router.refresh();
  }, [router]);

  // Pide la ubicación. `alNegar` se llama si la persona (o el navegador) dice que no.
  const pedir = useCallback(
    (alNegar: () => void) => {
      const radio = ubicacionDelNavegador().radio;
      const listo = (pos: GeolocationPosition) => {
        guardarUbicacion({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          gps: true,
          radio,
        });
        setCartel(null);
        setBuscando(false);
        aplicar();
      };
      // Sin ubicación: se olvida la de la vez anterior y queda la zona de siempre.
      const sinUbicacion = () => {
        guardarUbicacion({ radio });
        setBuscando(false);
        aplicar();
      };
      if (!navigator.geolocation) return sinUbicacion();
      navigator.geolocation.getCurrentPosition(
        listo,
        (e) => {
          if (e.code === e.PERMISSION_DENIED) {
            sinUbicacion();
            return alNegar();
          }
          navigator.geolocation.getCurrentPosition(listo, sinUbicacion, {
            enableHighAccuracy: false,
            timeout: 10_000,
            maximumAge: 300_000,
          });
        },
        { enableHighAccuracy: true, timeout: 8_000, maximumAge: 30_000 },
      );
    },
    [aplicar],
  );

  useEffect(() => {
    try {
      if (sessionStorage.getItem(PEDIR_AL_CARGAR)) {
        sessionStorage.removeItem(PEDIR_AL_CARGAR);
        // Vino de tocar "Permitir ubicación": si sigue sin dejar, mostramos los pasos.
        pedir(() => setCartel("bloqueada"));
        return;
      }
      if (sessionStorage.getItem(MARCA)) return;
      sessionStorage.setItem(MARCA, "1");
    } catch {}
    // Si dijo que no, en cada apertura le mostramos el cartel para permitirla.
    pedir(() => setCartel("pedir"));
  }, [pedir]);

  if (!cartel) return null;

  const sistema = sistemaDelCelular();
  const cerrar = () => setCartel(null);
  const reintentar = () => {
    setBuscando(true);
    if (sistema === "ios") {
      try {
        sessionStorage.setItem(PEDIR_AL_CARGAR, "1");
        window.location.reload();
        return;
      } catch {}
    }
    // Si el navegador ya no deja preguntar, explicamos cómo habilitarla.
    pedir(() => setCartel("bloqueada"));
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-3 sm:items-center"
      onClick={cerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-ubicacion"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-marino shadow-2xl sm:pb-5"
      >
        <p className="text-3xl" aria-hidden>
          📍
        </p>
        <h2 id="titulo-ubicacion" className="mt-1 text-lg font-bold">
          {cartel === "pedir"
            ? "Permití tu ubicación"
            : "La ubicación está bloqueada"}
        </h2>
        {cartel === "pedir" ? (
          <p className="mt-1 text-sm text-marino/80">
            Así te mostramos los comercios y productos más cerca tuyo, y cuánto
            te queda para llegar. Solo la usamos mientras usás VeciRed.
          </p>
        ) : (
          <div className="mt-1 space-y-2 text-sm text-marino/80">
            <p>
              Tu {sistema === "otro" ? "navegador" : "celular"} guardó que no.
              Para permitirla:
            </p>
            {sistema === "ios" ? (
              <ol className="list-decimal space-y-1.5 pl-5">
                {"standalone" in navigator && (navigator as { standalone?: boolean }).standalone ? (
                  <li>
                    Abrí <b>Safari</b> (el navegador del iPhone) y entrá a <b>vecired.com.ar</b>.
                  </li>
                ) : null}
                <li>
                  Tocá el ícono a la izquierda de la dirección (<b>aA</b> o <b>☰</b>) › <b>Configuración del sitio web</b> › <b>Ubicación</b> y elegí{" "}
                  <b>Permitir</b>.
                </li>
                <li>
                  En <b>Ajustes › Privacidad y seguridad › Localización › Sitios web de Safari</b>, elegí <b>Al usar la app</b>.
                </li>
                {"standalone" in navigator && (navigator as { standalone?: boolean }).standalone ? (
                  <li>
                    <b>Cerrá VeciRed del todo</b> (deslizá hacia arriba y sacala de las apps abiertas) y volvé a abrirla.
                  </li>
                ) : (
                  <li>Volvé a esta página y tocá “Ya la permití”.</li>
                )}
              </ol>
            ) : sistema === "android" ? (
              <ol className="list-decimal space-y-1 pl-5">
                <li>
                  Tocá el <b>candado o los tres puntos</b> arriba, al lado de la
                  dirección (si usás la app instalada: mantené apretado el ícono
                  de VeciRed › <b>Información</b>).
                </li>
                <li>
                  Entrá a <b>Permisos › Ubicación</b> y elegí <b>Permitir</b>.
                </li>
                <li>Volvé y tocá “Ya la permití”.</li>
              </ol>
            ) : (
              <ol className="list-decimal space-y-1 pl-5">
                <li>
                  Hacé clic en el <b>candado 🔒</b> a la izquierda de la
                  dirección de la página.
                </li>
                <li>
                  Activá <b>Ubicación</b> (o elegí <b>Permitir</b>).
                </li>
                <li>Tocá “Ya la permití”.</li>
              </ol>
            )}
          </div>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={cerrar}
            className="rounded-xl border border-marino/25 px-4 py-2 text-sm font-medium hover:bg-marino/5"
          >
            Ahora no
          </button>
          <button
            type="button"
            onClick={reintentar}
            disabled={buscando}
            className="boton rounded-xl px-4 py-2 text-sm font-semibold"
          >
            {buscando
              ? "Buscando…"
              : cartel === "pedir"
                ? "Permitir ubicación"
                : "Ya la permití"}
          </button>
        </div>
      </div>
    </div>
  );
}
