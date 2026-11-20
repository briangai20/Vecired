"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { coincideAprox, coincideExacto, corregir, palabrasBuscadas, palabrasDe, vocabulario } from "@/lib/busqueda";
import { cambiarEnBloque, guardarVarios, type AccionLote } from "./acciones";

const ACCIONES: { valor: AccionLote; texto: string; numero?: string }[] = [
  { valor: "sumar", texto: "Sumar/restar stock", numero: "Unidades (ej.: 10 o -5)" },
  { valor: "fijar", texto: "Fijar stock", numero: "Unidades" },
  { valor: "precio", texto: "Precio en %", numero: "% (ej.: 10 o -5)" },
  { valor: "pausar", texto: "Pausar (ocultar)" },
  { valor: "activar", texto: "Activar (mostrar)" },
];

// Lo que va escrito adentro del campo del número (en el celular no entra la etiqueta).
const PISTA: Partial<Record<AccionLote, string>> = { sumar: "±10", fijar: "Cant.", precio: "±%" };

const DE_A = 20; // productos que se muestran al principio (después, "Ver más")

type Filtros = { marca: string; grupo: string; estado: "" | "1" | "0"; stock: "" | "sin-stock" | "poco" | "sin-confirmar"; sinFoto: boolean };
const SIN_FILTROS: Filtros = { marca: "", grupo: "", estado: "", stock: "", sinFoto: false };

// Control de stock del panel: envuelve la lista de productos.
// - Buscador con corrector ("martiyo" encuentra "Martillo") y filtros por
//   marca, grupo, publicado u oculto, stock y sin foto.
// - Cada producto tiene una casilla; con los tildados se aplica un cambio en
//   bloque (sumar 10 unidades a 20 productos de una vez, por ejemplo).
// - "Guardar todo" guarda juntos todos los productos que se modificaron.
export type ItemStock = { id: number; texto: string; marca: string; grupo: string; activo: "1" | "0"; stock: string; foto: "1" | "0" };

export function HerramientasProductos({ items, children }: { items: ItemStock[]; children: ReactNode }) {
  const lista = useRef<HTMLDivElement>(null);
  const [tildados, setTildados] = useState(0);
  const [cambiados, setCambiados] = useState(0);
  const [accion, setAccion] = useState<AccionLote>("sumar");
  const [valor, setValor] = useState("");
  const [aviso, setAviso] = useState<{ texto: string; error?: boolean } | null>(null);
  const [trabajando, empezar] = useTransition();
  const [texto, setTexto] = useState("");
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS);
  const [cuantos, setCuantos] = useState(DE_A);
  const [verFiltros, setVerFiltros] = useState(false);

  const casillas = (soloVisibles = false) =>
    [...(lista.current?.querySelectorAll<HTMLInputElement>("input[data-elegir]") ?? [])].filter((c) => !soloVisibles || !c.closest("form")?.hidden);
  const formulariosCambiados = () => [...(lista.current?.querySelectorAll<HTMLFormElement>("form[data-cambiado]") ?? [])];
  const contar = () => {
    setTildados(casillas().filter((c) => c.checked).length);
    setCambiados(formulariosCambiados().length);
  };

  // Qué productos coinciden con lo buscado y los filtros (primero tal cual;
  // si no hay nada, lo parecido, por errores de tipeo).
  const marcas = [...new Set(items.map((x) => x.marca).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  const grupos = [...new Set(items.map((x) => x.grupo).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  const buscadas = palabrasBuscadas(texto);
  const filtrados = items.filter(
    (x) =>
      (!filtros.marca || x.marca === filtros.marca) &&
      (!filtros.grupo || x.grupo === filtros.grupo) &&
      (!filtros.estado || x.activo === filtros.estado) &&
      (!filtros.stock || x.stock === filtros.stock) &&
      (!filtros.sinFoto || x.foto === "0"),
  );
  const exactos = buscadas.length ? filtrados.filter((x) => coincideExacto(x.texto, buscadas)) : filtrados;
  const aprox = buscadas.length > 0 && !exactos.length;
  const coinciden = aprox ? filtrados.filter((x) => coincideAprox(palabrasDe(x.texto), buscadas)) : exactos;
  const resultado = {
    total: items.length,
    coinciden: coinciden.length,
    aprox: aprox && coinciden.length > 0,
    corregida: aprox && coinciden.length ? corregir(texto, vocabulario(items.map((x) => x.texto))) : null,
  };
  const claveVisibles = coinciden
    .slice(0, cuantos)
    .map((x) => x.id)
    .join(",");

  // Oculta en la lista los que no coinciden (los productos los arma el servidor).
  useEffect(() => {
    const visibles = new Set(claveVisibles.split(",").filter(Boolean));
    for (const f of lista.current?.querySelectorAll<HTMLFormElement>("form[data-producto]") ?? []) f.hidden = !visibles.has(f.dataset.producto ?? "");
  }, [claveVisibles, children]);

  function tildarTodos(si: boolean) {
    // "Tildar todos" toma solo los que se ven con la búsqueda y los filtros.
    for (const c of si ? casillas(true) : casillas()) c.checked = si;
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
  const cambiar = <K extends keyof Filtros>(k: K, v: Filtros[K]) => {
    setFiltros((f) => ({ ...f, [k]: v }));
    setCuantos(DE_A);
  };
  const filtrosActivos = [filtros.marca, filtros.grupo, filtros.estado, filtros.stock, filtros.sinFoto].filter(Boolean).length;
  const hayFiltros = texto.trim() !== "" || JSON.stringify(filtros) !== JSON.stringify(SIN_FILTROS);

  return (
    <div>
      {/* Buscador y filtros */}
      <div className="space-y-2 rounded-2xl border border-white/15 p-3">
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setCuantos(DE_A);
            }}
            aria-label="Buscar un producto"
            placeholder="Buscar: nombre, marca o código"
            className="campo min-w-0 flex-1"
            autoComplete="off"
          />
          {/* En el celular los filtros se abren con este botón; en la compu se ven siempre. */}
          <button
            type="button"
            onClick={() => setVerFiltros((v) => !v)}
            aria-expanded={verFiltros}
            className={`shrink-0 rounded-xl border px-3 py-2.5 text-xs font-semibold sm:hidden ${filtrosActivos ? "border-naranja-vivo text-naranja-vivo" : "border-white/30"}`}
          >
            Filtros{filtrosActivos ? ` (${filtrosActivos})` : ""}
          </button>
        </div>
        <div className={`${verFiltros ? "grid" : "hidden"} grid-cols-2 gap-2 text-xs sm:grid sm:grid-cols-4`}>
          <label className="block">
            Marca
            <select value={filtros.marca} onChange={(e) => cambiar("marca", e.target.value)} className="campo mt-1">
              <option value="">Todas</option>
              {marcas.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label className="block">
            Grupo
            <select value={filtros.grupo} onChange={(e) => cambiar("grupo", e.target.value)} className="campo mt-1">
              <option value="">Todos</option>
              {grupos.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <label className="block">
            Stock
            <select value={filtros.stock} onChange={(e) => cambiar("stock", e.target.value as Filtros["stock"])} className="campo mt-1">
              <option value="">Todos</option>
              <option value="sin-stock">Sin stock</option>
              <option value="poco">Pocas unidades</option>
              <option value="sin-confirmar">Stock sin confirmar</option>
            </select>
          </label>
          <label className="block">
            Estado
            <select value={filtros.estado} onChange={(e) => cambiar("estado", e.target.value as Filtros["estado"])} className="campo mt-1">
              <option value="">Todos</option>
              <option value="1">Publicados</option>
              <option value="0">Ocultos</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <label className={`${verFiltros ? "flex" : "hidden"} items-center gap-2 sm:flex`}>
            <input type="checkbox" checked={filtros.sinFoto} onChange={(e) => cambiar("sinFoto", e.target.checked)} className="h-4 w-4 accent-white" />
            Solo sin foto
          </label>
          <span role="status" className="text-white/80">
            {hayFiltros ? `${resultado.coinciden} de ${resultado.total} productos` : `${resultado.total} productos`}
          </span>
          {hayFiltros ? (
            <button
              type="button"
              onClick={() => {
                setTexto("");
                setFiltros(SIN_FILTROS);
                setCuantos(DE_A);
              }}
              className="underline"
            >
              Sacar filtros
            </button>
          ) : null}
        </div>
        {resultado.aprox ? (
          <p className="text-xs text-white/85">
            No encontramos “{texto.trim()}” tal cual: te mostramos lo más parecido
            {resultado.corregida ? (
              <>
                {" "}(
                <button type="button" onClick={() => setTexto(resultado.corregida!)} className="font-semibold text-naranja-vivo underline">
                  {resultado.corregida}
                </button>
                )
              </>
            ) : null}
            .
          </p>
        ) : texto.trim() && !resultado.coinciden ? (
          <p className="text-xs text-white/85">No encontramos “{texto.trim()}” entre tus productos.</p>
        ) : null}
      </div>

      {/* Cambios en bloque y "Guardar todo": siempre a la vista y compacto. En la
          compu queda pegado arriba al bajar; en el celular no, para no tapar la lista. */}
      <div className="-mx-2 my-2 rounded-2xl border-2 border-naranja-vivo/70 bg-marino-claro px-3 py-2.5 shadow-lg shadow-black/30 sm:sticky sm:top-28 sm:z-20 lg:top-20">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold">✏️ Cambiar stock o precio</p>
          {cambiados ? (
            <button type="button" onClick={guardarTodo} disabled={trabajando} className="boton shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold">
              {trabajando ? "Guardando…" : `Guardar todo (${cambiados})`}
            </button>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-white/80">
          {tildados ? (
            <>
              <b className="text-naranja-vivo">
                {tildados} {tildados === 1 ? "tildado" : "tildados"}
              </b>
              {" · "}
              <button type="button" onClick={() => tildarTodos(false)} className="underline">
                Destildar
              </button>
            </>
          ) : (
            <>
              Tildá “Elegir” en los productos (o{" "}
              <button type="button" onClick={() => tildarTodos(true)} className="font-semibold underline">
                los que se ven
              </button>
              ), elegí el cambio y tocá Aplicar.
            </>
          )}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs sm:flex-nowrap">
          <select
            value={accion}
            onChange={(e) => setAccion(e.target.value as AccionLote)}
            aria-label="Qué cambiar"
            className="campo min-w-0 basis-full py-2 sm:flex-1 sm:basis-auto"
          >
            {ACCIONES.map((a) => (
              <option key={a.valor} value={a.valor}>
                {a.texto}
              </option>
            ))}
          </select>
          {pide ? (
            <input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              inputMode="decimal"
              aria-label={pide}
              placeholder={PISTA[accion] ?? "Nº"}
              className="campo w-24 min-w-0 flex-1 py-2 sm:flex-none"
            />
          ) : null}
          <button type="button" onClick={aplicar} disabled={trabajando || !tildados} className="boton ml-auto shrink-0 rounded-xl px-4 py-2.5 text-xs font-semibold">
            {trabajando && tildados ? "…" : tildados ? `Aplicar a ${tildados}` : "Aplicar"}
          </button>
        </div>
        {aviso ? (
          <p role="status" className={`mt-2 text-xs font-semibold ${aviso.error ? "text-[#ffb4a2]" : "text-verde"}`}>
            {aviso.texto}
          </p>
        ) : null}
      </div>
      <div
        ref={lista}
        className="divide-y divide-white/15"
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
      {resultado.coinciden > cuantos ? (
        <button
          type="button"
          onClick={() => setCuantos((n) => n + DE_A)}
          className="mt-3 w-full rounded-xl border border-white/30 py-2 text-sm hover:bg-white/10"
        >
          Ver más ({resultado.coinciden - cuantos} más)
        </button>
      ) : null}
    </div>
  );
}
