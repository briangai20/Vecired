"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { cambiarEnBloque, guardarVarios, type AccionLote } from "./acciones";

const ACCIONES: { valor: AccionLote; texto: string; numero?: string }[] = [
  { valor: "sumar", texto: "Sumar o restar stock", numero: "Unidades (ej.: 10 o -5)" },
  { valor: "fijar", texto: "Fijar el stock en", numero: "Unidades" },
  { valor: "precio", texto: "Cambiar el precio en %", numero: "% (ej.: 10 o -5)" },
  { valor: "pausar", texto: "Pausar (ocultar)" },
  { valor: "activar", texto: "Activar (mostrar)" },
];

// Envuelve la lista de productos del panel:
// - Cada producto tiene una casilla; con los tildados se aplica un cambio en
//   bloque (sumar 10 unidades a 20 productos de una vez, por ejemplo).
// - "Guardar todo" guarda juntos todos los productos que se modificaron, sin
//   tener que apretar Guardar en cada uno.
export function HerramientasProductos({ children }: { children: ReactNode }) {
  const lista = useRef<HTMLDivElement>(null);
  const [tildados, setTildados] = useState(0);
  const [cambiados, setCambiados] = useState(0);
  const [accion, setAccion] = useState<AccionLote>("sumar");
  const [valor, setValor] = useState("");
  const [aviso, setAviso] = useState<{ texto: string; error?: boolean } | null>(null);
  const [trabajando, empezar] = useTransition();

  const casillas = () => [...(lista.current?.querySelectorAll<HTMLInputElement>("input[data-elegir]") ?? [])];
  const formulariosCambiados = () => [...(lista.current?.querySelectorAll<HTMLFormElement>("form[data-cambiado]") ?? [])];
  const contar = () => {
    setTildados(casillas().filter((c) => c.checked).length);
    setCambiados(formulariosCambiados().length);
  };

  function tildarTodos(si: boolean) {
    for (const c of casillas()) c.checked = si;
    contar();
  }

  function aplicar() {
    const ids = casillas()
      .filter((c) => c.checked)
      .map((c) => Number(c.value));
    const numero = Number(valor.replace(",", "."));
    const pide = ACCIONES.find((a) => a.valor === accion)?.numero;
    if (pide && (valor.trim() === "" || !Number.isFinite(numero))) return setAviso({ texto: "Poné un número.", error: true });
    setAviso(null);
    empezar(async () => {
      const r = await cambiarEnBloque(ids, accion, numero);
      if (r.error) return setAviso({ texto: r.error, error: true });
      tildarTodos(false);
      setValor("");
      setAviso({ texto: `Listo: ${r.cambiados} ${r.cambiados === 1 ? "producto cambiado" : "productos cambiados"}${r.salteados ? ` (${r.salteados} sin precio o sin cambios)` : ""}.` });
    });
  }

  function guardarTodo() {
    const forms = formulariosCambiados();
    if (!forms.length) return;
    setAviso(null);
    empezar(async () => {
      const datos = forms.map((f) => [...new FormData(f).entries()].filter((e): e is [string, string] => typeof e[1] === "string"));
      const r = await guardarVarios(datos);
      for (const f of forms) delete f.dataset.cambiado;
      contar();
      setAviso(
        r.errores.length
          ? { texto: `Se guardaron ${r.guardados}. No se pudieron guardar: ${r.errores.join(" · ")}`, error: true }
          : { texto: `Listo: ${r.guardados} ${r.guardados === 1 ? "producto guardado" : "productos guardados"}.` },
      );
    });
  }

  const pide = ACCIONES.find((a) => a.valor === accion)?.numero;

  return (
    <div>
      <div className="sticky top-28 z-20 -mx-2 mb-2 rounded-2xl bg-marino-claro px-3 py-3 shadow-lg shadow-black/30 lg:top-20">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
          <span className="font-semibold">
            {tildados} {tildados === 1 ? "tildado" : "tildados"}
          </span>
          <button type="button" onClick={() => tildarTodos(true)} className="font-medium text-white/85 hover:text-naranja-vivo active:text-naranja-vivo">
            Tildar todos
          </button>
          {tildados ? (
            <button type="button" onClick={() => tildarTodos(false)} className="font-medium text-white/85 hover:text-naranja-vivo active:text-naranja-vivo">
              Destildar
            </button>
          ) : null}
          <button
            type="button"
            onClick={guardarTodo}
            disabled={!cambiados || trabajando}
            className="boton ml-auto rounded-xl px-4 py-2 text-xs font-semibold"
          >
            {trabajando && cambiados ? "Guardando…" : `Guardar todo${cambiados ? ` (${cambiados})` : ""}`}
          </button>
        </div>
        {tildados ? (
          <div className="mt-2 flex flex-wrap items-end gap-2 text-xs">
            <label className="block">
              Cambio para los tildados
              <select value={accion} onChange={(e) => setAccion(e.target.value as AccionLote)} className="campo mt-1">
                {ACCIONES.map((a) => (
                  <option key={a.valor} value={a.valor}>
                    {a.texto}
                  </option>
                ))}
              </select>
            </label>
            {pide ? (
              <label className="block">
                {pide}
                <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" className="campo mt-1 w-32" />
              </label>
            ) : null}
            <button type="button" onClick={aplicar} disabled={trabajando} className="boton rounded-xl px-4 py-2.5 text-xs font-semibold">
              {trabajando ? "Aplicando…" : `Aplicar a ${tildados}`}
            </button>
          </div>
        ) : null}
        {aviso ? (
          <p role="status" className={`mt-2 text-xs font-semibold ${aviso.error ? "text-[#ffb4a2]" : "text-verde"}`}>
            {aviso.texto}
          </p>
        ) : null}
      </div>
      <div
        ref={lista}
        // Se marca cada formulario que se modifica, para "Guardar todo".
        onInput={(e) => {
          const f = (e.target as HTMLElement).closest("form");
          if (f && !(e.target as HTMLElement).hasAttribute("data-elegir")) f.dataset.cambiado = "1";
          contar();
        }}
        onChange={contar}
      >
        {children}
      </div>
    </div>
  );
}
