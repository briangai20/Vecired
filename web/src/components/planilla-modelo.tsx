// Planilla modelo de productos: el comerciante elige abrirla en Excel o en
// Google Sheets. La de Google es una copia pública de la misma planilla; el
// link termina en /copy para que cada uno se haga su copia en su Drive.
export const PLANTILLA_EXCEL = "/plantilla-productos-vecired.xlsx";
// "Planilla de productos VeciRed" en el Drive de briangai20 (compartida: cualquiera con el link puede ver).
// Si se deja vacío, el botón de Google Sheets no se muestra.
export const PLANTILLA_GOOGLE: string = "https://docs.google.com/spreadsheets/d/100aU_l0LujSjZm5X0lkx7rVdKwnBacGd9BEHFgLrX9o/copy";

export function PlanillaModelo({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/20 p-3 text-sm ${className}`}>
      <p className="font-semibold">Planilla modelo</p>
      <p className="mt-0.5 text-xs text-white/75">Elegí con qué la querés completar:</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <a href={PLANTILLA_EXCEL} download className="rounded-xl border border-white/40 px-4 py-2 hover:bg-white/10">
          Descargar para Excel
        </a>
        {PLANTILLA_GOOGLE ? (
          <a href={PLANTILLA_GOOGLE} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-white/40 px-4 py-2 hover:bg-white/10">
            Abrir en Google Sheets
          </a>
        ) : null}
      </div>
      {PLANTILLA_GOOGLE ? (
        <p className="mt-2 text-xs text-white/75">
          Con Google Sheets: tocá “Hacer una copia”, completala y después andá a Archivo › Descargar › Microsoft Excel (.xlsx). Ese
          archivo es el que subís acá.
        </p>
      ) : null}
    </div>
  );
}
