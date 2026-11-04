// Achica una imagen a "lado" px y la pasa a JPEG sobre fondo blanco (los PNG
// con fondo transparente quedarían negros). Solo en el navegador.
export async function prepararImagen(archivo: File, lado: number): Promise<Blob> {
  const imagen = await createImageBitmap(archivo);
  const escala = Math.min(1, lado / Math.max(imagen.width, imagen.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);
  const ctx = lienzo.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  return new Promise((ok, mal) => lienzo.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo procesar la imagen"))), "image/jpeg", 0.85));
}

// Por qué no se pudo subir una imagen, en palabras que se entiendan.
export function motivoImagen(e: unknown, archivo: File) {
  const m = (e instanceof Error ? e.message : String(e)).toLowerCase();
  if (!archivo.type.startsWith("image/")) return `"${archivo.name}" no es una imagen. Elegí una foto JPG o PNG.`;
  if (m.includes("decode") || m.includes("procesar") || m.includes("invalidstate") || m.includes("source image"))
    return "No pudimos abrir esa imagen (puede ser un formato como HEIC). Sacale una captura o guardala como JPG y probá de nuevo.";
  if (m.includes("size") || m.includes("too large") || m.includes("413")) return "La imagen es demasiado pesada. Probá con una de menos de 5 MB.";
  if (m.includes("row-level") || m.includes("unauthorized") || m.includes("403") || m.includes("jwt"))
    return "Tu sesión venció. Salí, volvé a ingresar y subila de nuevo.";
  if (m.includes("bucket not found")) return "La carga de fotos de perfil todavía no está activada. Probá más tarde.";
  if (m.includes("fetch") || m.includes("network")) return "Se cortó la conexión mientras se subía. Revisá tu internet y probá de nuevo.";
  return "No pudimos subir la imagen. Probá de nuevo con otra foto; si sigue pasando, escribinos.";
}
