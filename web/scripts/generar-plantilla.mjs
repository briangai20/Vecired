// Genera public/plantilla-productos-vecired.xlsx, la planilla modelo que
// descarga el comerciante. Correr después de cambiarla:
//   node scripts/generar-plantilla.mjs
import ExcelJS from "exceljs";

const MARINO = "FF14213D";
const NARANJA = "FFD9480F";
const CREMA = "FFFFF8EC";
const GRIS = "FF6B7280";

const libro = new ExcelJS.Workbook();
libro.creator = "VeciRed";

// ---------- Hoja 1: Productos ----------
const hoja = libro.addWorksheet("Productos", { views: [{ state: "frozen", ySplit: 1 }] });
hoja.columns = [
  { header: "Código", key: "codigo", width: 14 },
  { header: "Producto", key: "producto", width: 40 },
  { header: "Marca", key: "marca", width: 16 },
  { header: "Precio de venta", key: "precio", width: 17 },
  { header: "Stock", key: "stock", width: 12 },
  { header: "Descripción", key: "descripcion", width: 46 },
];

const titulos = hoja.getRow(1);
titulos.height = 24;
titulos.eachCell((c, n) => {
  c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
  c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: n === 2 ? NARANJA : MARINO } };
  c.alignment = { vertical: "middle", horizontal: "center" };
});

// Explicación al pasar el mouse por cada título.
const NOTAS = [
  "Opcional. Tu código interno o el de barras. Si lo ponés, la próxima vez que subas la lista actualizamos ese producto aunque le cambies el nombre.",
  "OBLIGATORIO. El nombre como lo buscaría un vecino: qué es, medida, color, cantidad.",
  "Opcional.",
  "El precio al público, en pesos. Podés escribir 2300 o $ 2.300,50. Si lo dejás vacío aparece \"A consultar\".",
  "Un número (cuántas unidades tenés), o una de estas palabras: hay · poco · no hay · consultar · a pedido.",
  "Opcional. Detalles que ayuden a elegir: material, talle, compatibilidad.",
];
NOTAS.forEach((nota, i) => {
  hoja.getCell(1, i + 1).note = { texts: [{ text: nota }], margins: { insetmode: "auto" } };
});

// Ejemplos: empiezan con "Ejemplo:" y VeciRed los saltea al cargar, así que no hace falta borrarlos.
const EJEMPLOS = [
  ["T-440", "Ejemplo: Tornillos 4x40 mm (caja x100)", "Fischer", 2300, 20, "Acero galvanizado"],
  ["CI-20", "Ejemplo: Cinta aisladora 20 m negra", "3M", 1100.5, "poco", ""],
  ["", "Ejemplo: Llave de paso 1/2\"", "", null, "a pedido", "Se consigue en 48 h"],
];
EJEMPLOS.forEach((fila) => {
  const r = hoja.addRow(fila);
  r.eachCell({ includeEmpty: true }, (c) => {
    c.font = { italic: true, color: { argb: GRIS } };
  });
});

// Filas listas para completar, con formato de precio y bordes suaves.
for (let i = 0; i < 300; i++) hoja.addRow([]);
hoja.getColumn("precio").numFmt = '"$" #,##0.00';
hoja.getColumn("codigo").numFmt = "@"; // que "00123" no pierda los ceros
for (let r = 2; r <= hoja.rowCount; r++) {
  for (let c = 1; c <= 6; c++) {
    hoja.getCell(r, c).border = { bottom: { style: "hair", color: { argb: "FFD1D5DB" } } };
  }
  // Ayuda al escribir el stock: muestra las opciones válidas al pararse en la celda.
  hoja.getCell(r, 5).dataValidation = {
    type: "custom",
    allowBlank: true,
    formulae: ["TRUE"],
    showInputMessage: true,
    promptTitle: "Stock",
    prompt: "Un número, o: hay · poco · no hay · consultar · a pedido",
  };
}

// ---------- Hoja 2: Cómo completarla ----------
const ayuda = libro.addWorksheet("Cómo completarla");
ayuda.getColumn(1).width = 22;
ayuda.getColumn(2).width = 90;
ayuda.properties.tabColor = { argb: NARANJA };

const titulo = ayuda.addRow(["Cómo completar tu lista de productos"]);
titulo.font = { bold: true, size: 16, color: { argb: MARINO } };
ayuda.addRow([]);
const pasos = [
  ["1.", "Completá la hoja \"Productos\": una fila por producto. Solo el nombre es obligatorio."],
  ["2.", "Las filas grises que empiezan con \"Ejemplo:\" no se cargan. Podés dejarlas o borrarlas."],
  ["3.", "Guardá el archivo y subilo desde tu panel de VeciRed, en Productos > Cargar o actualizar desde Excel."],
  ["4.", "Antes de cargar te mostramos cómo quedó cada producto para que lo revises."],
];
pasos.forEach((p) => {
  const r = ayuda.addRow(p);
  r.getCell(1).font = { bold: true, color: { argb: NARANJA } };
  r.getCell(2).alignment = { wrapText: true };
});
ayuda.addRow([]);

const cab = ayuda.addRow(["Columna", "Qué poner"]);
cab.eachCell((c) => {
  c.font = { bold: true, color: { argb: "FFFFFFFF" } };
  c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MARINO } };
});
const columnas = [
  ["Código", "Opcional. Si lo usás, la próxima vez que subas la lista actualizamos cada producto por su código."],
  ["Producto", "Obligatorio. El nombre como lo buscaría un vecino: \"Collar reflectivo ajustable talle M\"."],
  ["Marca", "Opcional."],
  ["Precio de venta", "El precio al público en pesos: 2300 o $ 2.300,50. Vacío = \"A consultar\"."],
  ["Stock", "Un número (por ejemplo 12), o una palabra: hay · poco · no hay · consultar · a pedido."],
  ["Descripción", "Opcional. Material, medidas, talle, compatibilidad."],
];
columnas.forEach((c, i) => {
  const r = ayuda.addRow(c);
  r.getCell(1).font = { bold: true };
  r.getCell(2).alignment = { wrapText: true };
  if (i % 2 === 0) r.eachCell((x) => (x.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CREMA } }));
});
ayuda.addRow([]);
const nota = ayuda.addRow([
  "¿Ya tenés tu lista?",
  "No hace falta pasarla a esta planilla: subí tu Excel como está. Reconocemos columnas como Descripción, Unitario, Costo, Margen o Unidades y te dejamos elegir qué es cada una.",
]);
nota.getCell(1).font = { bold: true, color: { argb: NARANJA } };
nota.getCell(2).alignment = { wrapText: true };

await libro.xlsx.writeFile("public/plantilla-productos-vecired.xlsx");
console.log("Listo: public/plantilla-productos-vecired.xlsx");
