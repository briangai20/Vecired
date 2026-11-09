import { usuarioActual } from "@/lib/sesion";
import { Campanita } from "./campanita";

// La campanita solo aparece con la sesión iniciada.
export async function Avisos() {
  const usuario = await usuarioActual();
  return usuario ? <Campanita yo={usuario.id} /> : null;
}
