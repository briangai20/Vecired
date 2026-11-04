import Image from "next/image";
import { iniciales } from "@/lib/formato";

// Logo del comercio, o sus iniciales si todavía no subió uno.
export function LogoComercio({ url, nombre, className = "h-12 w-12 text-sm" }: { url: string | null | undefined; nombre: string; className?: string }) {
  return (
    <span className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white/80 bg-marino-claro font-black text-white ${className}`}>
      {url ? (
        <Image src={url} alt={`Logo de ${nombre}`} fill sizes="96px" className="bg-white object-contain" />
      ) : (
        <span aria-hidden>{iniciales(nombre) || nombre.charAt(0).toUpperCase()}</span>
      )}
    </span>
  );
}
