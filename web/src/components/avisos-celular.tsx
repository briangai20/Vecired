"use client";

import { useEffect, useState } from "react";
import { VAPID_PUBLICA } from "@/lib/push";
import { supabaseNavegador } from "@/lib/supabase/navegador";

type Estado = "cargando" | "no_soportado" | "iphone_sin_instalar" | "bloqueado" | "apagado" | "activado";

// La llave pública viene en base64 "para URL"; el navegador la quiere en bytes.
function bytes(base64: string) {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const crudo = atob((base64 + relleno).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(crudo, (c) => c.charCodeAt(0));
}

async function estadoActual(): Promise<Estado> {
  const iphone = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const instalada = window.matchMedia("(display-mode: standalone)").matches;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    // En el iPhone los avisos solo andan con VeciRed instalada en la pantalla de inicio.
    return iphone && !instalada ? "iphone_sin_instalar" : "no_soportado";
  }
  if (Notification.permission === "denied") return "bloqueado";
  const registro = await navigator.serviceWorker.getRegistration("/");
  const suscripcion = await registro?.pushManager.getSubscription();
  return suscripcion && Notification.permission === "granted" ? "activado" : "apagado";
}

// "Recibir avisos en este celular": avisos del sistema aunque VeciRed esté
// cerrada (reserva nueva, aceptada, mensajes, preguntas...). Cada aparato se
// activa por separado.
export function AvisosCelular({ variante = "campanita" }: { variante?: "campanita" | "panel" }) {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let vigente = true;
    estadoActual()
      .then((e) => vigente && setEstado(e))
      .catch(() => vigente && setEstado("no_soportado"));
    return () => {
      vigente = false;
    };
  }, []);

  async function activar() {
    setTrabajando(true);
    setError("");
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setEstado(permiso === "denied" ? "bloqueado" : "apagado");
        return;
      }
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const registro = await navigator.serviceWorker.ready;
      const suscripcion =
        (await registro.pushManager.getSubscription()) ??
        (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(VAPID_PUBLICA) }));
      const { endpoint, keys } = suscripcion.toJSON();
      if (!endpoint || !keys?.p256dh || !keys?.auth) throw new Error("Suscripción incompleta");
      const { error: e } = await supabaseNavegador().rpc("guardar_suscripcion_push", { p_endpoint: endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth });
      if (e) throw e;
      setEstado("activado");
    } catch {
      setError("No pudimos activar los avisos en este aparato. Probá de nuevo.");
    } finally {
      setTrabajando(false);
    }
  }

  async function desactivar() {
    setTrabajando(true);
    setError("");
    try {
      const registro = await navigator.serviceWorker.getRegistration("/");
      const suscripcion = await registro?.pushManager.getSubscription();
      if (suscripcion) {
        await supabaseNavegador().from("suscripciones_push").delete().eq("endpoint", suscripcion.endpoint);
        await suscripcion.unsubscribe();
      }
      setEstado("apagado");
    } catch {
      setError("No pudimos desactivarlos. Probá de nuevo.");
    } finally {
      setTrabajando(false);
    }
  }

  if (estado === "cargando" || estado === "no_soportado") return null;
  // En el panel solo se insiste si todavía no están activados.
  if (variante === "panel" && estado === "activado") return null;

  const caja =
    variante === "panel"
      ? "mt-4 flex flex-col gap-3 rounded-2xl border border-naranja-vivo/70 p-4 sm:flex-row sm:items-center"
      : "border-t border-white/15 px-4 py-3 text-xs";

  return (
    <div className={caja}>
      <p className={variante === "panel" ? "flex-1 text-sm" : "text-white/85"}>
        {estado === "activado" ? (
          <>📱 Avisos en este aparato: <b>activados</b>. Te llegan aunque VeciRed esté cerrada.</>
        ) : estado === "bloqueado" ? (
          <>📱 Este navegador tiene bloqueados los avisos de VeciRed. Para recibirlos, permitilos en la configuración del sitio (el candado al lado de la dirección).</>
        ) : estado === "iphone_sin_instalar" ? (
          <>📱 En el iPhone, para recibir avisos aunque la página esté cerrada, primero instalá VeciRed: botón Compartir de Safari › “Agregar a inicio”.</>
        ) : variante === "panel" ? (
          <>
            <b>📱 Enterate de cada reserva al instante.</b> Activá los avisos en este celular o compu y te llegan aunque VeciRed esté cerrada.
          </>
        ) : (
          <>📱 Recibí los avisos en este aparato aunque VeciRed esté cerrada.</>
        )}
      </p>
      {estado === "apagado" ? (
        <button
          type="button"
          onClick={activar}
          disabled={trabajando}
          className={variante === "panel" ? "boton shrink-0 rounded-xl px-4 py-2 text-sm font-semibold" : "boton mt-2 w-full rounded-xl px-3 py-2 text-xs font-semibold"}
        >
          {trabajando ? "Activando…" : "Activar avisos"}
        </button>
      ) : estado === "activado" ? (
        <button type="button" onClick={desactivar} disabled={trabajando} className="mt-1 underline">
          {trabajando ? "Desactivando…" : "Desactivar en este aparato"}
        </button>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1 font-semibold text-naranja-vivo">
          {error}
        </p>
      ) : null}
    </div>
  );
}
