"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { VIGENCIA } from "@/lib/legal";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServidor } from "@/lib/supabase/servidor";

// "valores" devuelve lo que escribió el usuario, para no borrarle el formulario si hay un error.
export type EstadoCuenta = {
  error?: string;
  aviso?: string;
  enviado?: string;
  valores?: { nombre?: string; email?: string; rol?: string; telefono?: string };
  // Qué campo está mal y por qué (el formulario los marca en rojo).
  campos?: Record<string, string>;
};

const mailValido = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

// Qué campo marcar en rojo según el error que devuelve Supabase.
function campoDelError(mensaje: string): Record<string, string> | undefined {
  const m = mensaje.toLowerCase();
  if (m.includes("invalid login credentials")) return { email: "Revisá que el mail esté bien escrito.", password: "Revisá la contraseña (mayúsculas y minúsculas cuentan)." };
  if (m.includes("email not confirmed")) return { email: "Este mail todavía no está confirmado." };
  if (m.includes("already registered") || m.includes("already been registered")) return { email: "Ya hay una cuenta con este mail." };
  if (m.includes("password")) return { password: "La contraseña tiene que tener al menos 8 caracteres." };
  if (m.includes("email address") && m.includes("invalid")) return { email: "Este mail no parece válido." };
  return undefined;
}

// Sólo rutas internas, para que nadie arme un link que mande a otro sitio.
function destinoSeguro(v: FormDataEntryValue | null) {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
}

function traducir(mensaje: string) {
  const m = mensaje.toLowerCase();
  if (m.includes("invalid login credentials")) return "El mail o la contraseña no son correctos.";
  if (m.includes("email not confirmed")) return "Todavía no confirmaste tu mail. Revisá tu casilla (y la carpeta de spam).";
  if (m.includes("already registered") || m.includes("already been registered")) return "Ya hay una cuenta con ese mail. Probá ingresar.";
  if (m.includes("password") && m.includes("characters")) return "La contraseña tiene que tener al menos 8 caracteres.";
  if (m.includes("rate limit")) return "Hubo demasiados intentos. Esperá unos minutos y probá de nuevo.";
  if (m.includes("email address") && m.includes("invalid")) return "Revisá el mail: no parece una dirección válida.";
  if (m.includes("not authorized")) return "Por ahora no podemos mandar mails a esa dirección. Escribinos para darte de alta.";
  return "No pudimos completar el pedido. Probá de nuevo en un rato.";
}

export async function ingresar(_: EstadoCuenta, datos: FormData): Promise<EstadoCuenta> {
  const email = String(datos.get("email") ?? "").trim();
  const password = String(datos.get("password") ?? "");
  const campos: Record<string, string> = {};
  if (!email) campos.email = "Escribí el mail con el que te registraste.";
  else if (!mailValido(email)) campos.email = "Revisá el mail: le falta la @ o el dominio (por ejemplo, nombre@gmail.com).";
  if (!password) campos.password = "Escribí tu contraseña.";
  if (Object.keys(campos).length) return { error: "Revisá los datos marcados en rojo.", campos, valores: { email } };

  const supabase = await supabaseServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: traducir(error.message), campos: campoDelError(error.message), valores: { email } };
  redirect(destinoSeguro(datos.get("siguiente")));
}

export async function registrarse(_: EstadoCuenta, datos: FormData): Promise<EstadoCuenta> {
  const nombre = String(datos.get("nombre") ?? "").trim();
  const email = String(datos.get("email") ?? "").trim();
  const password = String(datos.get("password") ?? "");
  const telefono = String(datos.get("telefono") ?? "").trim();
  const rol = datos.get("rol") === "comerciante" ? "comerciante" : "comprador";
  const valores = { nombre, email, rol, telefono };
  const foto = datos.get("foto");
  const conFoto = foto instanceof File && foto.size > 0 ? foto : null;
  // Se revisa todo de una vez, para marcar juntos todos los campos que están mal.
  const campos: Record<string, string> = {};
  if (!nombre) campos.nombre = "Escribí tu nombre y apellido.";
  if (!email) campos.email = "Escribí tu mail: ahí te llega el link para confirmar la cuenta.";
  else if (!mailValido(email)) campos.email = "Revisá el mail: le falta la @ o el dominio (por ejemplo, nombre@gmail.com).";
  if (!password) campos.password = "Elegí una contraseña de al menos 8 caracteres.";
  else if (password.length < 8) campos.password = `La contraseña tiene ${password.length} caracteres y tiene que tener al menos 8.`;
  const digitos = telefono.replace(/\D/g, "");
  if (telefono && digitos.length < 10) {
    campos.telefono = `El teléfono tiene ${digitos.length} números y tienen que ser al menos 10: código de área + número, por ejemplo 11 2345 6789.`;
  }
  if (conFoto && (!conFoto.type.startsWith("image/") || conFoto.size > 2 * 1024 * 1024)) {
    campos.foto = "Esa foto no sirve: elegí una imagen JPG o PNG (la achicamos sola).";
  }
  if (!datos.get("acepto")) campos.acepto = "Para crear la cuenta tenés que tildar esta casilla.";
  const cuantos = Object.keys(campos).length;
  if (cuantos) {
    return { error: cuantos === 1 ? Object.values(campos)[0] : `Hay ${cuantos} datos para corregir: los marcamos en rojo.`, campos, valores };
  }

  const h = await headers();
  const origen = h.get("origin") ?? `https://${h.get("host")}`;
  const siguiente = rol === "comerciante" ? "/comerciante" : destinoSeguro(datos.get("siguiente"));

  const supabase = await supabaseServidor();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Queda guardado cuándo aceptó los términos y qué versión.
      data: { nombre, rol, telefono: telefono || undefined, acepto_terminos: VIGENCIA, acepto_terminos_en: new Date().toISOString() },
      emailRedirectTo: `${origen}/auth/callback?siguiente=${encodeURIComponent(siguiente)}`,
    },
  });
  if (error) return { error: traducir(error.message), campos: campoDelError(error.message), valores };

  // Una cuenta que ya existía vuelve sin "identities": ahí no se toca nada.
  if (conFoto && data.user?.identities?.length) await guardarFotoNueva(data.user.id, conFoto);

  // Si el proyecto no pide confirmar el mail, la sesión ya quedó iniciada.
  if (data.session) redirect(siguiente);
  // El formulario muestra el cartel de "mail enviado" en lugar de los campos.
  return { enviado: email };
}

export async function salir() {
  const supabase = await supabaseServidor();
  await supabase.auth.signOut();
  redirect("/");
}

// Manda el mail para elegir una contraseña nueva. Siempre responde lo mismo,
// exista o no la cuenta, para no revelar qué mails están registrados.
export async function pedirNuevaClave(_: EstadoCuenta, datos: FormData): Promise<EstadoCuenta> {
  const email = String(datos.get("email") ?? "").trim();
  if (!email) return { error: "Escribí el mail con el que te registraste." };
  const h = await headers();
  const origen = h.get("origin") ?? `https://${h.get("host")}`;
  const supabase = await supabaseServidor();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origen}/auth/callback?siguiente=${encodeURIComponent("/nueva-clave")}`,
  });
  if (error && error.message.toLowerCase().includes("rate limit")) return { error: traducir(error.message), valores: { email } };
  return { aviso: `Si hay una cuenta con ${email}, te llega un mail con un link para elegir una contraseña nueva. Revisá también el spam.` };
}

export async function cambiarClave(_: EstadoCuenta, datos: FormData): Promise<EstadoCuenta> {
  const clave = String(datos.get("password") ?? "");
  const repetida = String(datos.get("repetida") ?? "");
  if (clave.length < 8) return { error: "La contraseña tiene que tener al menos 8 caracteres." };
  if (clave !== repetida) return { error: "Las dos contraseñas no coinciden." };
  const supabase = await supabaseServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "El link venció. Pedí uno nuevo desde “¿Olvidaste tu contraseña?”." };
  const { error } = await supabase.auth.updateUser({ password: clave });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes("different from the old")) return { error: "Elegí una contraseña distinta de la anterior." };
    return { error: traducir(error.message) };
  }
  return { aviso: "¡Listo! Tu contraseña nueva ya quedó guardada." };
}

// Foto elegida al crear la cuenta. Todavía no hay sesión (falta confirmar el
// mail), así que la guarda el servidor con la clave secreta. Si algo falla,
// la cuenta se crea igual: la foto se puede subir después desde "Mi perfil".
async function guardarFotoNueva(usuarioId: string, foto: File) {
  const admin = supabaseAdmin();
  if (!admin) {
    console.info("[foto registro] Sin SUPABASE_SECRET_KEY: no se guardó la foto de", usuarioId);
    return;
  }
  const ruta = `${usuarioId}/foto-${Date.now()}.jpg`;
  const { error } = await admin.storage.from("perfiles").upload(ruta, foto, { contentType: "image/jpeg" });
  if (error) {
    console.error("[foto registro]", error.message);
    return;
  }
  const url = admin.storage.from("perfiles").getPublicUrl(ruta).data.publicUrl;
  const { error: errorPerfil } = await admin.from("perfiles").update({ foto_url: url }).eq("id", usuarioId);
  if (errorPerfil) console.error("[foto registro]", errorPerfil.message);
}
