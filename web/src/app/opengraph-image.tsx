import { ImageResponse } from "next/og";

// Imagen que aparece al compartir un link de VeciRed (WhatsApp, Facebook, etc.)
// cuando la página no tiene una foto propia.
export const alt = "VeciRed: conectá con el comercio de tu barrio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function ImagenParaCompartir() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 56,
          padding: "0 96px",
          background: "#14213d",
          color: "#fff8ec",
        }}
      >
        <svg viewBox="0 0 100 100" width="280" height="280">
          <path d="M25 28 50 74 75 28" fill="none" stroke="#fff8ec" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="25" cy="28" r="10" fill="#fff8ec" />
          <circle cx="75" cy="28" r="10" fill="#fff8ec" />
          <circle cx="50" cy="74" r="12" fill="#d9480f" stroke="#14213d" strokeWidth="4" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 120, fontWeight: 900, letterSpacing: -4, lineHeight: 1 }}>
            <span style={{ color: "#ffffff" }}>Veci</span>
            <span style={{ color: "#ff6b2c" }}>Red</span>
          </div>
          <div style={{ marginTop: 28, fontSize: 44, lineHeight: 1.2 }}>Conectá con el comercio de tu barrio</div>
          <div style={{ marginTop: 20, fontSize: 30, color: "rgba(255,248,236,0.8)" }}>Buscá, reservá y retirá en el local</div>
        </div>
      </div>
    ),
    size,
  );
}
