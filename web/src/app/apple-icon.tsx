import { ImageResponse } from "next/og";

// Ícono al agregar VeciRed a la pantalla de inicio del celular (iPhone redondea las esquinas solo).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#14213d" }}>
        <svg viewBox="0 0 100 100" width="180" height="180">
          <path d="M25 28 50 74 75 28" fill="none" stroke="#fff8ec" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="25" cy="28" r="10" fill="#fff8ec" />
          <circle cx="75" cy="28" r="10" fill="#fff8ec" />
          <circle cx="50" cy="74" r="12" fill="#d9480f" stroke="#14213d" strokeWidth="4" />
        </svg>
      </div>
    ),
    size,
  );
}
