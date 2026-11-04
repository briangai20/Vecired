"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { ErrorCampo } from "@/components/error-campo";
import { ingresar, registrarse, type EstadoCuenta } from "./acciones";
import { FotoRegistro } from "./foto-registro";

export function FormularioCuenta({ siguiente, modoInicial }: { siguiente: string; modoInicial: "ingresar" | "crear" }) {
  const [modo, setModo] = useState(modoInicial);
  const [estadoIngreso, accionIngreso, ingresando] = useActionState<EstadoCuenta, FormData>(ingresar, {});
  const [estadoAlta, accionAlta, creando] = useActionState<EstadoCuenta, FormData>(registrarse, {});
  const estado = modo === "ingresar" ? estadoIngreso : estadoAlta;
  // Después de crear la cuenta se muestra solo el cartel de "mail enviado".
  // Vuelve al formulario con "atrás" o tocando Ingresar / Crear cuenta.
  const [cerrado, setCerrado] = useState<EstadoCuenta | null>(null);
  const cartel = modo === "crear" && estadoAlta.enviado && cerrado !== estadoAlta ? estadoAlta.enviado : null;

  // Con el cartel, la dirección pasa a tener ?enviado=1: así "atrás" o el
  // botón Ingresar del menú (que la sacan) vuelven al formulario.
  useEffect(() => {
    if (!cartel) return;
    const url = new URL(window.location.href);
    url.searchParams.set("enviado", "1");
    window.history.pushState(null, "", url);
  }, [cartel]);
  const enUrl = useSearchParams().get("enviado") === "1";
  const [antesEnUrl, setAntesEnUrl] = useState(enUrl);
  if (antesEnUrl !== enUrl) {
    setAntesEnUrl(enUrl);
    if (!enUrl && cartel) setCerrado(estadoAlta);
  }

  function elegir(m: "ingresar" | "crear") {
    if (cartel) {
      setCerrado(estadoAlta);
      // Saca el "enviado" de la dirección sin agregar otro paso al historial.
      const url = new URL(window.location.href);
      url.searchParams.delete("enviado");
      window.history.replaceState(null, "", url);
    }
    setModo(m);
  }

  return (
    <div className="tarjeta mx-auto max-w-md rounded-3xl p-6">
      <div className="grid grid-cols-2 gap-1 rounded-2xl border border-white/20 p-1" role="tablist">
        {(["ingresar", "crear"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={modo === m}
            onClick={() => elegir(m)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${modo === m && !cartel ? "bg-white text-marino" : "hover:bg-white/10"}`}
          >
            {m === "ingresar" ? "Ingresar" : "Crear cuenta"}
          </button>
        ))}
      </div>

      {cartel ? (
        <div role="status" className="mt-6 text-center">
          <div aria-hidden className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/10 text-3xl">
            ✉
          </div>
          <h2 className="mt-4 text-xl font-bold">¡Te mandamos un mail!</h2>
          <p className="mt-2 text-sm text-white/85">
            Lo enviamos a <span className="font-semibold break-all text-white">{cartel}</span>. Abrí el link que te llegó para confirmar tu cuenta y listo.
          </p>
          <p className="mt-3 text-xs text-white/70">Si no lo ves en unos minutos, revisá la carpeta de spam o correo no deseado.</p>
          <button type="button" onClick={() => elegir("ingresar")} className="boton mt-6 w-full rounded-xl px-4 py-3 text-sm font-semibold">
            Ya lo confirmé: ingresar
          </button>
          <p className="mt-3 text-xs text-white/70">¿Te equivocaste de mail? Tocá “Crear cuenta” arriba para cargarlo de nuevo.</p>
        </div>
      ) : modo === "ingresar" ? (
        <form key={JSON.stringify(estadoIngreso.valores ?? {})} action={accionIngreso} noValidate className="mt-6 space-y-4">
          <input type="hidden" name="siguiente" value={siguiente} />
          <Campo etiqueta="Mail" name="email" type="email" autoComplete="email" defaultValue={estado.valores?.email} error={estadoIngreso.campos?.email} />
          <Campo etiqueta="Contraseña" name="password" type="password" autoComplete="current-password" error={estadoIngreso.campos?.password} />
          <button disabled={ingresando} className="boton w-full rounded-xl px-4 py-3 text-sm font-semibold">
            {ingresando ? "Ingresando…" : "Ingresar"}
          </button>
          <Link href="/recuperar" className="block text-center text-sm text-white/80 underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </form>
      ) : (
        <form key={JSON.stringify(estadoAlta.valores ?? {})} action={accionAlta} noValidate className="mt-6 space-y-4">
          <input type="hidden" name="siguiente" value={siguiente} />
          <fieldset>
            <legend className="text-xs">Quiero usar VeciRed para…</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {[
                { v: "comprador", t: "Comprar", d: "Buscar y reservar productos" },
                { v: "comerciante", t: "Vender", d: "Publicar mi comercio" },
              ].map((o) => (
                <label
                  key={o.v}
                  className="flex cursor-pointer items-start gap-2 rounded-xl border border-white/25 p-3 text-sm has-[:checked]:border-white has-[:checked]:bg-marino-claro"
                >
                  <input type="radio" name="rol" value={o.v} defaultChecked={o.v === (estadoAlta.valores?.rol ?? (siguiente.startsWith("/comerciante") ? "comerciante" : "comprador"))} className="mt-1 accent-white" />
                  <span>
                    <span className="font-semibold">{o.t}</span>
                    <span className="block text-xs text-white/75">{o.d}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <Campo etiqueta="Tu nombre y apellido" name="nombre" autoComplete="name" defaultValue={estadoAlta.valores?.nombre} error={estadoAlta.campos?.nombre} />
          <Campo etiqueta="Mail" name="email" type="email" autoComplete="email" defaultValue={estado.valores?.email} error={estadoAlta.campos?.email} />
          <Campo etiqueta="Contraseña (mínimo 8 caracteres)" name="password" type="password" autoComplete="new-password" minLength={8} error={estadoAlta.campos?.password} />
          <Campo
            etiqueta="Teléfono (opcional: lo ve el comercio cuando reservás)"
            name="telefono"
            type="tel"
            autoComplete="tel"
            placeholder="11 2345 6789"
            required={false}
            defaultValue={estadoAlta.valores?.telefono}
            error={estadoAlta.campos?.telefono}
          />
          <FotoRegistro error={estadoAlta.campos?.foto} />
          <div className={estadoAlta.campos?.acepto ? "rounded-xl border-2 border-[#ff6b6b] bg-[#ff6b6b]/10 p-3" : ""}>
          <label className="flex items-start gap-2 text-xs">
            <input type="checkbox" name="acepto" required className="mt-0.5 accent-white" />
            <span>
              Soy mayor de 18 años y acepto los{" "}
              <Link href="/terminos" target="_blank" className="underline">términos y condiciones</Link> y la{" "}
              <Link href="/privacidad" target="_blank" className="underline">política de privacidad</Link>.
            </span>
          </label>
          <ErrorCampo>{estadoAlta.campos?.acepto}</ErrorCampo>
          </div>
          <button disabled={creando} className="boton w-full rounded-xl px-4 py-3 text-sm font-semibold">
            {creando ? "Creando la cuenta…" : "Crear cuenta"}
          </button>
        </form>
      )}

      {cartel ? null : estado.error ? (
          <div role="alert" className="mt-4 flex items-start gap-3 rounded-2xl border-2 border-[#ff6b6b] bg-[#ff6b6b]/10 p-3 text-sm">
            <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#ff6b6b] font-black text-marino">
              !
            </span>
            <span>{estado.error}</span>
          </div>
        ) : (
          <p role="status" className="mt-4 min-h-5 text-sm">
            {estado.aviso}
          </p>
        )}
    </div>
  );
}

function Campo({ etiqueta, error, ...props }: { etiqueta: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block text-xs">
      {etiqueta}
      <input required className="campo mt-1" aria-invalid={error ? true : undefined} {...props} />
      <ErrorCampo>{error}</ErrorCampo>
    </label>
  );
}
