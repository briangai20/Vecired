"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { avisarParaRevisar, avisarReserva, type Evento } from "@/lib/avisos";
import { usuarioActual } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { emparejar, MAX_FILAS, type FilaProducto } from "@/lib/importar";
import { cuitValido, soloDigitos } from "@/lib/cuit";
import { errorWhatsapp, numeroWhatsapp } from "@/lib/whatsapp";
import type { Enum, TablesInsert, TablesUpdate } from "@/lib/supabase/tipos";

// "campos": qué campo está mal y por qué (el formulario los marca en rojo).
export type Estado = { error?: string; ok?: string; campos?: Record<string, string> };

// Traduce lo que responde la base a algo que el comerciante entienda.
function explicarError(error: { message: string; code?: string }, que: string) {
  const m = error.message.toLowerCase();
  console.error(`[guardar ${que}]`, error.code, error.message);
  if (error.code === "P0001") return error.message;
  // Columna o tabla que todavía no existe (falta aplicar supabase/13_logo_y_verificacion.sql).
  if (["42703", "PGRST204", "42P01", "PGRST205"].includes(error.code ?? "") || m.includes("logo_url") || m.includes("verificaciones_comercio")) {
    return `No pudimos guardar ${que}: la carga del logo y de los datos de verificación todavía no está activada en VeciRed. Ya estamos trabajando en eso; mientras tanto, quitá el logo y la foto, y dejá vacíos el CUIT y las redes para guardar el resto.`;
  }
  if (error.code === "42501" || m.includes("permission") || m.includes("row-level security")) {
    return `No pudimos guardar ${que} porque tu sesión no tiene permiso sobre este comercio. Salí y volvé a ingresar con la cuenta del dueño.`;
  }
  if (error.code === "23514") {
    if (m.includes("cuit")) return "El CUIT tiene que tener exactamente 11 números.";
    if (m.includes("nombre")) return "El nombre del comercio no puede quedar vacío.";
    return `Algún dato de ${que} no tiene el formato correcto. Revisalo y probá de nuevo.`;
  }
  if (m.includes("fetch failed") || m.includes("network") || m.includes("timeout")) {
    return `No pudimos guardar ${que} porque se cortó la conexión. Revisá tu internet y apretá Guardar de nuevo.`;
  }
  return `No pudimos guardar ${que}. Probá de nuevo en un rato; si sigue pasando, escribinos y contanos este detalle: "${error.message}".`;
}

const texto = (d: FormData, k: string) => String(d.get(k) ?? "").trim();
const opcional = (d: FormData, k: string) => texto(d, k) || null;
// Los campos numéricos del formulario (type="number") ya llegan con punto decimal.
function numero(d: FormData, k: string) {
  const v = texto(d, k);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

// Todas las acciones exigen sesión de comerciante. Que el comercio o el
// producto sean suyos lo controlan las reglas de la base (RLS).
async function comerciante() {
  const u = await usuarioActual();
  if (!u) redirect("/ingresar?siguiente=/comerciante");
  if (u.rol !== "comerciante") throw new Error("Solo los comerciantes pueden hacer esto");
  return supabaseServidor();
}

// Lee el horario semanal del formulario (ver horario-semanal.tsx) y lo valida.
function leerHorario(d: FormData): { franjas: { dia: number; abre: string; cierra: string }[] } | { error: string } {
  const NOMBRES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const hora = (k: string) => (/^\d{2}:\d{2}$/.test(texto(d, k)) ? texto(d, k) : "");
  const franjas: { dia: number; abre: string; cierra: string }[] = [];
  for (let dia = 0; dia < 7; dia++) {
    if (d.get(`h${dia}on`) !== "on") continue;
    const [a1, c1, a2, c2] = [hora(`h${dia}a1`), hora(`h${dia}c1`), hora(`h${dia}a2`), hora(`h${dia}c2`)];
    if (!a1 || !c1 || a1 === c1) return { error: `Revisá el horario del ${NOMBRES[dia]}: poné a qué hora abrís y a qué hora cerrás.` };
    franjas.push({ dia, abre: a1, cierra: c1 });
    if (a2 || c2) {
      if (!a2 || !c2 || a2 === c2) return { error: `Revisá el horario de la tarde del ${NOMBRES[dia]}.` };
      if (c1 < a1 || a2 < c1) return { error: `El ${NOMBRES[dia]}, la segunda franja tiene que empezar después de que cerrás al mediodía.` };
      franjas.push({ dia, abre: a2, cierra: c2 });
    }
  }
  if (!franjas.length) return { error: "Marcá al menos un día en que abre tu comercio (tildá el casillero del día y poné el horario)." };
  return { franjas };
}

export async function guardarComercio(_: Estado, d: FormData): Promise<Estado> {
  const supabase = await comerciante();
  const id = Number(texto(d, "id")) || null;
  const lat = numero(d, "lat");
  const lng = numero(d, "lng");
  const datos = {
    nombre: texto(d, "nombre"),
    rubro: texto(d, "rubro"),
    direccion: texto(d, "direccion"),
    zona_id: texto(d, "zona_id"),
    whatsapp: opcional(d, "whatsapp"),
    abre_feriados: d.get("abre_feriados") === "on",
    lat,
    lng,
    // El logo se sube cuando el comercio ya existe (va en su carpeta). Solo se
    // manda si cambió, así un problema con el logo no frena el resto.
    ...(d.has("logo_url") && texto(d, "logo_url") !== texto(d, "logo_url_antes") ? { logo_url: opcional(d, "logo_url") } : {}),
  };
  const verificacion = {
    cuit: soloDigitos(texto(d, "cuit")) || null,
    redes: opcional(d, "redes")?.slice(0, 200) ?? null,
    ...(d.has("foto_local_url") ? { foto_local_url: opcional(d, "foto_local_url") } : {}),
  };
  // Se revisa todo de una vez, para marcar juntos todos los campos que están mal.
  const campos: Record<string, string> = {};
  if (!datos.nombre) campos.nombre = "Escribí el nombre del comercio, tal como figura en el cartel.";
  if (!datos.rubro) campos.rubro = "Escribí qué vendés, por ejemplo Ferretería o Kiosco.";
  if (!datos.direccion) campos.direccion = "Escribí la calle y el número del local, por ejemplo San Martín 780.";
  else if (!/\d/.test(datos.direccion)) campos.direccion = "Falta el número de la calle, por ejemplo San Martín 780.";
  if (!datos.zona_id) campos.zona_id = "Elegí la zona donde está el local.";
  if (!numeroWhatsapp(datos.whatsapp)) campos.whatsapp = errorWhatsapp(datos.whatsapp ?? "");
  const cuit = verificacion.cuit ?? "";
  if (cuit && cuit.length !== 11) {
    campos.cuit = `El CUIT tiene que tener 11 números y escribiste ${cuit.length}. Copialo de tu constancia de ARCA (ex AFIP), por ejemplo 20-12345678-9.`;
  } else if (cuit && !cuitValido(cuit)) {
    campos.cuit = "Ese CUIT no existe: el último número (el dígito verificador) no coincide con los anteriores. Revisá que no falte ni sobre ningún número.";
  }
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) campos.ubicacion = "Tocá el mapa en la puerta de tu local para marcar dónde está.";
  const horario = leerHorario(d);
  if ("error" in horario) campos.horario = horario.error;
  const cuantos = Object.keys(campos).length;
  if (cuantos) {
    return {
      campos,
      error: cuantos === 1 ? Object.values(campos)[0] : `Hay ${cuantos} datos para corregir. Los marcamos en rojo: cada uno dice qué falta.`,
    };
  }
  if ("error" in horario) return { error: horario.error }; // (para TypeScript: ya se revisó arriba)

  let comercioId = id;
  // Un comercio nuevo, o uno rechazado que se corrige, queda para revisar: se avisa a los administradores.
  let paraRevisar: "nuevo" | "corregido" | null = null;
  if (id) {
    const { data: antes } = await supabase.from("comercios").select("motivo_rechazo").eq("id", id).maybeSingle();
    const { error } = await supabase.from("comercios").update(datos).eq("id", id);
    if (error) {
      const delLogo = "logo_url" in datos && error.message.includes("logo_url");
      return { error: explicarError(error, delLogo ? "el logo" : "los datos del comercio"), campos: delLogo ? { logo: "El logo no se guardó." } : undefined };
    }
    if (antes?.motivo_rechazo) paraRevisar = "corregido";
  } else {
    const { data, error } = await supabase.from("comercios").insert(datos).select("id").single();
    if (error) return { error: explicarError(error, "tu comercio") };
    comercioId = data.id;
    paraRevisar = "nuevo";
  }
  if (paraRevisar) after(() => avisarParaRevisar(comercioId!, paraRevisar === "corregido"));

  // CUIT, redes y foto del frente: solo los ven el dueño y los administradores.
  // Si no cargó ninguno (ni antes ni ahora), no hay nada que guardar.
  const hayVerificacion = !!(verificacion.cuit || verificacion.redes || verificacion.foto_local_url || d.get("hay_verificacion"));
  const { error: errorVerificacion } = hayVerificacion
    ? await supabase.from("verificaciones_comercio").upsert({ comercio_id: comercioId!, ...verificacion, actualizado_en: new Date().toISOString() })
    : { error: null };

  // El horario se reemplaza entero.
  const { error: errorBorrar } = await supabase.from("horarios").delete().eq("comercio_id", comercioId!);
  const { error: errorHorario } = errorBorrar
    ? { error: errorBorrar }
    : await supabase.from("horarios").insert(horario.franjas.map((f) => ({ ...f, comercio_id: comercioId! })));
  if (errorHorario) return { error: `Guardamos los datos, pero no el horario. ${explicarError(errorHorario, "el horario")}`, campos: { horario: "Este horario no se guardó." } };
  refresh();
  // El comercio ya quedó guardado; si falló solo la verificación, se avisa cuál.
  if (errorVerificacion) {
    return {
      error: `Guardamos los datos del comercio, pero no el CUIT, las redes ni la foto del frente. ${explicarError(errorVerificacion, "esos datos")}`,
      campos: { verificacion: "Estos datos no se guardaron." },
    };
  }
  return { ok: id ? "Datos guardados." : "¡Listo! Ya podés cargar tus productos. Publicamos tu comercio cuando lo revisemos." };
}

export async function guardarProducto(d: FormData) {
  const supabase = await comerciante();
  const id = Number(texto(d, "id")) || null;
  const modo = (["exacto", "semaforo", "consultar", "pedido"].includes(texto(d, "modo")) ? texto(d, "modo") : "exacto") as Enum<"modo_stock">;
  const semaforo = (["hay", "poco", "no"].includes(texto(d, "semaforo")) ? texto(d, "semaforo") : null) as Enum<"semaforo"> | null;
  const precio = numero(d, "precio");
  const stock = numero(d, "stock");
  const datos = {
    nombre: texto(d, "nombre"),
    marca: opcional(d, "marca"),
    grupo: opcional(d, "grupo"),
    descripcion: opcional(d, "descripcion"),
    codigo: opcional(d, "codigo"),
    precio: precio == null || Number.isNaN(precio) || precio < 0 ? null : precio,
    modo,
    stock: modo === "exacto" ? Math.max(0, Math.round(stock && !Number.isNaN(stock) ? stock : 0)) : null,
    semaforo: modo === "semaforo" ? (semaforo ?? "hay") : null,
    activo: d.get("activo") === "on",
  };
  if (!datos.nombre) return;

  if (id) {
    await supabase.from("productos").update(datos).eq("id", id);
  } else {
    const comercioId = Number(texto(d, "comercio_id"));
    // La foto ya se subió desde el formulario; solo se acepta si está en la carpeta del comercio.
    const foto = texto(d, "foto_url");
    const carpeta = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/productos/${comercioId}/`;
    await supabase.from("productos").insert({ ...datos, comercio_id: comercioId, foto_url: foto.startsWith(carpeta) ? foto : null });
  }
  refresh();
}

// "Sigue igual": confirma el stock sin cambiarlo, para que no aparezca "Stock sin confirmar".
export async function confirmarStock(d: FormData) {
  const supabase = await comerciante();
  const id = Number(texto(d, "id"));
  if (id) await supabase.from("productos").update({ actualizado_en: new Date().toISOString() }).eq("id", id);
  refresh();
}

// Si la base rechaza la acción (por ejemplo, ya no hay stock), volvemos al
// panel con el motivo. Los mensajes "P0001" los escribe la base en castellano.
function volverConError(error: { message: string; code?: string } | null) {
  if (!error) return;
  const motivo = error.code === "P0001" ? error.message : "No pudimos guardar el cambio. Probá de nuevo.";
  redirect(`/comerciante?error=${encodeURIComponent(motivo)}#reservas`);
}

export async function cambiarReserva(d: FormData) {
  const supabase = await comerciante();
  const reserva = Number(texto(d, "reserva"));
  const accion = texto(d, "accion");
  if (!reserva) return;
  const rpc =
    accion === "aceptar" ? "aceptar_reserva" : accion === "rechazar" ? "rechazar_reserva" : accion === "retirada" ? "marcar_retirada" : null;
  if (!rpc) return;
  const { error } = await supabase.rpc(rpc, { p_reserva: reserva });
  volverConError(error);
  const evento: Evento = accion === "aceptar" ? "aceptada" : accion === "rechazar" ? "rechazada" : "retirada";
  after(() => avisarReserva(reserva, evento));
  await listo();
}

// Después de una acción que salió bien: actualiza el panel en el lugar. Si
// había un cartel de error en la dirección, vuelve a la pestaña sin él.
// (Antes redirigía siempre a la misma dirección, y eso no recargaba los
// datos hasta el clic siguiente.)
async function listo(seccion = "reservas") {
  const desde = (await headers()).get("referer") ?? "";
  if (desde.includes("error=")) redirect(`/comerciante?seccion=${seccion}`);
  refresh();
}

// "No lo tengo": le ofrece al cliente otros productos del catálogo.
export async function ofrecerAlternativas(d: FormData) {
  const supabase = await comerciante();
  const reserva = Number(texto(d, "reserva"));
  const productos = d.getAll("productos").map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (!reserva) return;
  if (!productos.length) redirect(`/comerciante?error=${encodeURIComponent("Elegí al menos un producto para ofrecer.")}#reservas`);
  const { error } = await supabase.rpc("ofrecer_alternativas", { p_reserva: reserva, p_productos: productos });
  volverConError(error);
  after(() => avisarReserva(reserva, "alternativa"));
  await listo();
}

// Días que el comercio cierra por su cuenta (vacaciones, inventario...).
export async function agregarCierre(d: FormData) {
  const supabase = await comerciante();
  const comercio = Number(texto(d, "comercio_id"));
  const desde = texto(d, "desde");
  const hasta = texto(d, "hasta") || desde;
  const fecha = /^\d{4}-\d{2}-\d{2}$/;
  if (!fecha.test(desde) || !fecha.test(hasta) || hasta < desde) {
    redirect(`/comerciante?seccion=configuracion&error=${encodeURIComponent("Revisá las fechas del cierre: la fecha final no puede ser anterior a la inicial.")}#cierres`);
  }
  const { error } = await supabase
    .from("cierres")
    .insert({ comercio_id: comercio, desde, hasta, motivo: opcional(d, "motivo")?.slice(0, 80) ?? null });
  if (error) redirect(`/comerciante?seccion=configuracion&error=${encodeURIComponent("No pudimos guardar el cierre. Probá de nuevo.")}#cierres`);
  await listo("configuracion");
}

export async function borrarCierre(d: FormData) {
  const supabase = await comerciante();
  await supabase.from("cierres").delete().eq("id", Number(texto(d, "id")));
  await listo("configuracion");
}

// Guarda la foto recién subida a Storage y borra la anterior, si era nuestra.
// Al subir muchas juntas se refresca el panel solo con la última.
export async function guardarFoto(productoId: number, url: string, refrescar = true) {
  const supabase = await comerciante();
  const { data: p } = await supabase.from("productos").select("comercio_id, foto_url").eq("id", productoId).single();
  if (!p) throw new Error("Producto no encontrado");
  const carpeta = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/productos/${p.comercio_id}/`;
  if (!url.startsWith(carpeta)) throw new Error("La foto no es de este comercio");

  const { error } = await supabase.from("productos").update({ foto_url: url }).eq("id", productoId);
  if (error) throw new Error("No se pudo guardar la foto");
  const raiz = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/productos/`;
  if (p.foto_url?.startsWith(raiz)) await supabase.storage.from("productos").remove([p.foto_url.slice(raiz.length)]);
  if (refrescar) refresh();
}

// Refresca el panel después de subir varias fotos.
export async function refrescarPanel() {
  await comerciante();
  refresh();
}

export type ResultadoImportacion = { error?: string; agregados?: number; actualizados?: number };

// Carga masiva desde la planilla (ya interpretada en el navegador con
// lib/importar.ts). Agrega los productos nuevos y actualiza los que ya
// estaban (por código o, si no hay código, por nombre). No borra ni oculta
// los que no vienen en la planilla.
export async function importarProductos(comercioId: number, filas: FilaProducto[]): Promise<ResultadoImportacion> {
  const supabase = await comerciante();
  if (!Array.isArray(filas) || !filas.length) return { error: "La planilla no tiene productos." };
  if (filas.length > MAX_FILAS) return { error: `Son más de ${MAX_FILAS} productos: dividí la planilla en dos.` };

  // No confiamos en lo que manda el navegador: se limpia de nuevo cada dato.
  const MODOS = ["exacto", "semaforo", "consultar", "pedido"];
  const SEMAFOROS = ["hay", "poco", "no"];
  const corto = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);
  const limpias = filas
    .map((f) => ({
      fila: Number(f.fila) || 0,
      codigo: corto(f.codigo, 60),
      nombre: corto(f.nombre, 200) ?? "",
      marca: corto(f.marca, 80),
      grupo: corto(f.grupo, 120),
      descripcion: corto(f.descripcion, 1000),
      precio: f.precio === undefined ? undefined : typeof f.precio === "number" && f.precio >= 0 && f.precio < 1e9 ? f.precio : null,
      modo: MODOS.includes(f.modo as string) ? (f.modo as Enum<"modo_stock">) : undefined,
      stock: typeof f.stock === "number" && f.stock >= 0 && f.stock < 1e6 ? Math.floor(f.stock) : null,
      semaforo: SEMAFOROS.includes(f.semaforo as string) ? (f.semaforo as Enum<"semaforo">) : null,
    }))
    .filter((f) => f.nombre);

  // Solo trae productos si el comercio es suyo (RLS); si no, el alta falla abajo.
  const { data: existentes, error: errorLeer } = await supabase.from("productos").select("id, codigo, nombre").eq("comercio_id", comercioId);
  if (errorLeer) return { error: "No pudimos leer tus productos. Probá de nuevo." };

  const stockDe = (f: (typeof limpias)[number]) =>
    f.modo === undefined
      ? {}
      : { modo: f.modo, stock: f.modo === "exacto" ? (f.stock ?? 0) : null, semaforo: f.modo === "semaforo" ? (f.semaforo ?? "hay") : null };

  const nuevos: TablesInsert<"productos">[] = [];
  const cambios: { id: number; datos: TablesUpdate<"productos"> }[] = [];
  for (const { fila: f, existente } of emparejar(limpias, existentes ?? [])) {
    if (existente) {
      cambios.push({
        id: existente.id,
        datos: {
          nombre: f.nombre,
          activo: true,
          ...(f.codigo ? { codigo: f.codigo } : {}),
          ...(f.marca ? { marca: f.marca } : {}),
          ...(f.grupo ? { grupo: f.grupo } : {}),
          ...(f.descripcion ? { descripcion: f.descripcion } : {}),
          ...(f.precio !== undefined ? { precio: f.precio } : {}),
          ...stockDe(f),
        },
      });
    } else {
      nuevos.push({
        comercio_id: comercioId,
        codigo: f.codigo,
        nombre: f.nombre,
        marca: f.marca,
        grupo: f.grupo,
        descripcion: f.descripcion,
        precio: f.precio ?? null,
        modo: "consultar",
        stock: null,
        semaforo: null,
        ...stockDe(f),
      });
    }
  }

  if (nuevos.length) {
    const { error } = await supabase.from("productos").insert(nuevos);
    if (error) return { error: "No pudimos agregar los productos nuevos. Revisá que no haya códigos repetidos y probá de nuevo." };
  }
  let actualizados = 0;
  for (let i = 0; i < cambios.length; i += 25) {
    const tanda = await Promise.all(cambios.slice(i, i + 25).map((c) => supabase.from("productos").update(c.datos).eq("id", c.id)));
    actualizados += tanda.filter((r) => !r.error).length;
  }
  refresh();
  return { agregados: nuevos.length, actualizados };
}

// Responder (o cambiar, o borrar con texto vacío) la respuesta a una reseña.
export async function responderResena(d: FormData) {
  const supabase = await comerciante();
  const resena = Number(texto(d, "resena"));
  if (!resena) return;
  const { error } = await supabase.rpc("responder_resena", { p_resena: resena, p_texto: texto(d, "respuesta").slice(0, 1000) });
  if (error) redirect(`/comerciante?seccion=resenas&error=${encodeURIComponent(error.code === "P0001" ? error.message : "No pudimos guardar la respuesta. Probá de nuevo.")}`);
  await listo("resenas");
}
