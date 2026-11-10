import { ImageResponse } from "next/og";

// Ícono de VeciRed para instalar la página en el celular. El logo queda en el
// centro con margen, así sirve también cuando Android lo recorta en círculo.
export function iconoApp(lado: number) {
  const logo = Math.round(lado * 0.62);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#14213d" }}>
        <svg viewBox="0 0 100 100" width={logo} height={logo}>
          <path d="M25 28 50 74 75 28" fill="none" stroke="#fff8ec" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="25" cy="28" r="10" fill="#fff8ec" />
          <circle cx="75" cy="28" r="10" fill="#fff8ec" />
          <circle cx="50" cy="74" r="12" fill="#d9480f" stroke="#14213d" strokeWidth="4" />
        </svg>
      </div>
    ),
    { width: lado, height: lado },
  );
}
