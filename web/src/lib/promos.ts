// Promos de las ofertas (ver supabase/22_moderacion_y_promos.sql). La base
// calcula el descuento al reservar; esto es lo mismo para mostrarlo antes.

export type PromoOferta = {
  promo: "nxm" | "segunda" | "porcentaje";
  lleva: number | null;
  paga: number | null;
  porcentaje: number | null;
};

// "4x3", "50% en la 2da unidad", "20% de descuento".
export function nombrePromo(p: PromoOferta) {
  if (p.promo === "nxm") return `${p.lleva}x${p.paga}`;
  if (p.promo === "segunda") return `${p.porcentaje}% en la 2da unidad`;
  return `${p.porcentaje}% de descuento`;
}

// "Llevá 4 y pagá 3", para explicarla.
export function explicarPromo(p: PromoOferta) {
  if (p.promo === "nxm") return `Llevá ${p.lleva} y pagá ${p.paga}`;
  if (p.promo === "segunda") return `La 2da unidad tiene ${p.porcentaje}% de descuento`;
  return `${p.porcentaje}% de descuento en cada unidad`;
}

export function descuentoPromo(p: PromoOferta, precio: number, cantidad: number) {
  if (p.promo === "nxm" && p.lleva && p.paga != null) return Math.floor(cantidad / p.lleva) * (p.lleva - p.paga) * precio;
  if (p.promo === "segunda" && p.porcentaje) return (Math.floor(cantidad / 2) * precio * p.porcentaje) / 100;
  if (p.promo === "porcentaje" && p.porcentaje) return (cantidad * precio * p.porcentaje) / 100;
  return 0;
}

// La que más conviene para esa cantidad (como hace la base).
export function mejorPromo(promos: PromoOferta[], precio: number, cantidad: number) {
  let mejor: { promo: PromoOferta; descuento: number } | null = null;
  for (const p of promos) {
    const d = descuentoPromo(p, precio, cantidad);
    if (d > 0 && (!mejor || d > mejor.descuento)) mejor = { promo: p, descuento: Math.round(d * 100) / 100 };
  }
  return mejor;
}
