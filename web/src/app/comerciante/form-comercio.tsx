"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { ElegirUbicacion } from "@/components/elegir-ubicacion";
import { ErrorCampo, MarcoError } from "@/components/error-campo";
import { useListo } from "@/components/use-listo";
import type { Tabla } from "@/lib/supabase/tipos";
import { CENTROS, ZONA_INICIAL } from "@/lib/zonas";
import type { Franja } from "@/lib/formato";
import { guardarComercio, type Estado } from "./acciones";
import { HorarioSemanal } from "./horario-semanal";
import { ImagenComercio } from "./imagen-comercio";

const RUBROS = ["Ferretería", "Mercería", "Herrajes", "Librería", "Kiosco", "Almacén", "Farmacia", "Indumentaria", "Bazar", "Electricidad", "Pinturería"];

// A qué error corresponde cada campo del formulario (los del horario y el mapa son varios).
function campoDe(name: string) {
  if (/^h\d/.test(name) || name === "abre_feriados") return "horario";
  if (name === "lat" || name === "lng") return "ubicacion";
  if (name === "logo_url") return "logo";
  if (name === "redes" || name === "foto_local_url") return "verificacion";
  return name;
}

export function FormComercio({
  comercio,
  zonas,
  franjas,
  verificacion,
}: {
  comercio: Tabla<"comercios"> | null;
  zonas: Tabla<"zonas">[];
  franjas: Franja[];
  verificacion?: Tabla<"verificaciones_comercio"> | null;
}) {
  const [estado, accion, guardando] = useActionState<Estado, FormData>(guardarComercio, {});
  const listo = useListo();
  const [zona, setZona] = useState(comercio?.zona_id ?? ZONA_INICIAL);
  const form = useRef<HTMLFormElement>(null);

  // El rojo de un campo se va apenas la persona lo corrige.
  const [corregidos, setCorregidos] = useState<{ de: Estado; campos: string[] }>({ de: estado, campos: [] });
  if (corregidos.de !== estado) setCorregidos({ de: estado, campos: [] });
  const error = (campo: string) => (corregidos.campos.includes(campo) ? undefined : estado.campos?.[campo]);
  const corregir = (campo: string) => {
    if (estado.campos?.[campo] && !corregidos.campos.includes(campo)) setCorregidos({ de: estado, campos: [...corregidos.campos, campo] });
  };
  // Props de un campo: lo marca en rojo y lo une con su explicación (para lectores de pantalla).
  const marcar = (campo: string) => ({ "aria-invalid": error(campo) ? true : undefined, "aria-describedby": error(campo) ? `error-${campo}` : undefined });

  // Después de un error, lleva la pantalla al primer campo marcado.
  useEffect(() => {
    if (!estado.campos) return;
    const primero = form.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-error]');
    primero?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (primero instanceof HTMLInputElement || primero instanceof HTMLSelectElement) primero.focus({ preventScroll: true });
  }, [estado]);

  return (
    <form
      ref={form}
      noValidate
      // Se envía a mano (no con action=) para que React no vacíe el formulario si hay un error.
      onSubmit={(e) => {
        e.preventDefault();
        const datos = new FormData(e.currentTarget);
        startTransition(() => accion(datos));
      }}
      onInput={(e) => corregir(campoDe((e.target as Partial<HTMLInputElement>).name ?? ""))}
      onChange={(e) => corregir(campoDe((e.target as Partial<HTMLInputElement>).name ?? ""))}
      className="grid gap-4 md:grid-cols-2"
    >
      {comercio ? <input type="hidden" name="id" value={comercio.id} /> : null}
      {comercio ? <input type="hidden" name="logo_url_antes" value={comercio.logo_url ?? ""} /> : null}
      {verificacion ? <input type="hidden" name="hay_verificacion" value="1" /> : null}
      <label className="block text-xs">
        Nombre del comercio
        <input name="nombre" required defaultValue={comercio?.nombre} className="campo mt-1" {...marcar("nombre")} />
        <ErrorCampo id="error-nombre">{error("nombre")}</ErrorCampo>
      </label>
      <label className="block text-xs">
        Rubro
        <input name="rubro" required list="rubros" defaultValue={comercio?.rubro} className="campo mt-1" placeholder="Ferretería, mercería…" {...marcar("rubro")} />
        <datalist id="rubros">
          {RUBROS.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
        <ErrorCampo id="error-rubro">{error("rubro")}</ErrorCampo>
      </label>
      <label className="block text-xs">
        Dirección (calle y número)
        <input name="direccion" required defaultValue={comercio?.direccion} className="campo mt-1" placeholder="San Martín 780" {...marcar("direccion")} />
        <ErrorCampo id="error-direccion">{error("direccion")}</ErrorCampo>
      </label>
      <label className="block text-xs">
        Zona
        <select name="zona_id" value={zona} onChange={(e) => setZona(e.target.value)} className="campo mt-1" {...marcar("zona_id")}>
          {zonas.map((z) => (
            <option key={z.id} value={z.id}>
              {z.nombre}
            </option>
          ))}
        </select>
        <ErrorCampo id="error-zona_id">{error("zona_id")}</ErrorCampo>
      </label>
      <label className="block text-xs">
        WhatsApp del comercio (los vecinos te consultan por acá)
        <input name="whatsapp" type="tel" required defaultValue={comercio?.whatsapp ?? ""} className="campo mt-1" placeholder="11 2345 6789" {...marcar("whatsapp")} />
        <ErrorCampo id="error-whatsapp">{error("whatsapp")}</ErrorCampo>
      </label>
      <fieldset className="border-t border-white/15 pt-4 md:col-span-2">
        <legend className="px-1 text-sm font-semibold">Logo y verificación del local</legend>
        <p className="text-xs text-white/75">
          El logo se ve en el inicio, en el mapa y en tu página. Con el CUIT, tus redes y una foto del frente comprobamos que el local existe y lo
          publicamos más rápido. Estos datos (salvo el logo) no se muestran a los vecinos.
        </p>
        {comercio ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <MarcoError error={error("logo")} className="text-xs">
              <p className="mb-1">Logo del comercio</p>
              <ImagenComercio comercioId={comercio.id} name="logo_url" inicial={comercio.logo_url} tipo="logo" />
            </MarcoError>
            <MarcoError error={error("verificacion")} className="text-xs">
              <p className="mb-1">Foto del frente del local (con el cartel, si tiene)</p>
              <ImagenComercio comercioId={comercio.id} name="foto_local_url" inicial={verificacion?.foto_local_url ?? null} tipo="frente" />
            </MarcoError>
          </div>
        ) : (
          <p className="mt-3 text-xs text-white/75">Cuando crees el comercio vas a poder subir el logo y la foto del frente.</p>
        )}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-xs">
            CUIT del comercio o del titular
            <input
              name="cuit"
              inputMode="numeric"
              defaultValue={verificacion?.cuit ?? ""}
              className="campo mt-1"
              placeholder="20-12345678-9"
              {...marcar("cuit")}
            />
            <ErrorCampo id="error-cuit">{error("cuit")}</ErrorCampo>
          </label>
          <label className="block text-xs">
            Instagram, Facebook o página web (opcional)
            <input name="redes" maxLength={200} defaultValue={verificacion?.redes ?? ""} className="campo mt-1" placeholder="@mi.comercio" />
          </label>
        </div>
      </fieldset>
      <MarcoError error={error("horario")} className="md:col-span-2">
        <HorarioSemanal franjas={franjas} abreFeriados={comercio?.abre_feriados ?? false} />
      </MarcoError>
      <MarcoError error={error("ubicacion")} className="md:col-span-2">
        {/* El mapa no avisa cambios con eventos del formulario: tocarlo ya cuenta como corregido. */}
        <div onClick={() => corregir("ubicacion")}>
          <ElegirUbicacion
            inicial={comercio?.lat != null && comercio?.lng != null ? { lat: comercio.lat, lng: comercio.lng } : null}
            centroZona={CENTROS[zona] ?? CENTROS[ZONA_INICIAL]}
          />
        </div>
      </MarcoError>
      <div className="space-y-3 md:col-span-2">
        {estado.error ? (
          <div role="alert" className="flex items-start gap-3 rounded-2xl border-2 border-[#ff6b6b] bg-[#ff6b6b]/10 p-4 text-sm">
            <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#ff6b6b] font-black text-marino">
              !
            </span>
            <div>
              <p className="font-semibold">{estado.error.startsWith("Guardamos") ? "Se guardó solo una parte" : "No se guardaron los cambios"}</p>
              <p className="mt-1 text-white/90">{estado.error}</p>
            </div>
          </div>
        ) : estado.ok ? (
          <p role="status" className="rounded-2xl border border-[#8ce99a] bg-[#8ce99a]/10 p-4 text-sm">
            ✔ {estado.ok}
          </p>
        ) : null}
        <button disabled={guardando || !listo} className="boton rounded-xl px-5 py-2.5 text-sm font-semibold">
          {guardando ? "Guardando…" : comercio ? "Guardar cambios" : "Crear mi comercio"}
        </button>
      </div>
    </form>
  );
}
