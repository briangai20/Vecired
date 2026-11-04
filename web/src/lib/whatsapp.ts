// Números de WhatsApp de Argentina. wa.me necesita el número internacional
// de celular: 54 + 9 + código de área + número, sin el 0 ni el 15
// ("011 15 2345-6789" → 5491123456789).

/** Número para wa.me, o null si no tiene la cantidad de números de un celular argentino. */
export function numeroWhatsapp(v: string | null | undefined): string | null {
  let d = (v ?? "").replace(/\D/g, "");
  if (d.startsWith("549")) d = d.slice(3);
  else if (d.startsWith("54")) d = d.slice(2);
  d = d.replace(/^0/, "");
  // El 15 va después del código de área (de 2 a 4 números): se busca el que deja 10 números.
  if (d.length === 12) {
    for (const area of [2, 3, 4]) {
      if (d.slice(area, area + 2) === "15") {
        d = d.slice(0, area) + d.slice(area + 2);
        break;
      }
    }
  }
  return d.length === 10 ? `549${d}` : null;
}

/** Link para abrir el chat, con un mensaje ya escrito. */
export function enlaceWhatsapp(numero: string | null | undefined, mensaje?: string) {
  const n = numeroWhatsapp(numero);
  if (!n) return null;
  return `https://wa.me/${n}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ""}`;
}

/** Explicación para el formulario si el número no sirve. */
export function errorWhatsapp(v: string) {
  const d = v.replace(/\D/g, "");
  if (!d) return "Escribí el WhatsApp del comercio: los vecinos te consultan por ahí antes de reservar.";
  return `El WhatsApp tiene ${d.length} números. Escribilo con código de área, sin el 0 ni el 15: por ejemplo 11 2345 6789 (Buenos Aires) o 230 412 3456.`;
}
