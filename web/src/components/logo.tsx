/* Logo de VeciRed: dos vecinos (puntos crema) unidos al comercio (punto naranja) forman la V.
   Sin fondo, para apoyarlo sobre el azul marino. El mismo dibujo está en app/icon.svg y app/apple-icon.tsx. */
export function LogoVeciRed({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path d="M25 28 50 74 75 28" fill="none" stroke="#fff8ec" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="25" cy="28" r="10" fill="#fff8ec" />
      <circle cx="75" cy="28" r="10" fill="#fff8ec" />
      <circle cx="50" cy="74" r="12" fill="#d9480f" stroke="#14213d" strokeWidth="4" />
    </svg>
  );
}
