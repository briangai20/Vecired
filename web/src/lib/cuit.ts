// CUIT/CUIL: 11 dígitos con dígito verificador (módulo 11 de ARCA/AFIP).
export const soloDigitos = (v: string) => v.replace(/\D/g, "");

export function cuitValido(v: string) {
  const d = soloDigitos(v);
  if (d.length !== 11) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((s, p, i) => s + p * Number(d[i]), 0);
  const resto = 11 - (suma % 11);
  const verificador = resto === 11 ? 0 : resto === 10 ? 9 : resto;
  return verificador === Number(d[10]);
}

// 30-71234567-8
export const cuitConGuiones = (v: string) => {
  const d = soloDigitos(v);
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : v;
};
