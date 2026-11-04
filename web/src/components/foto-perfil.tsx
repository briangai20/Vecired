import Image from "next/image";

// Foto de perfil redonda, o la inicial del nombre si no subió una.
export function FotoPerfil({ url, nombre, className = "h-10 w-10 text-sm" }: { url: string | null | undefined; nombre: string; className?: string }) {
  return (
    <span className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full border border-white/40 bg-marino-claro font-bold text-white ${className}`}>
      {url ? (
        <Image src={url} alt={`Foto de ${nombre}`} fill sizes="128px" className="object-cover" />
      ) : (
        <span aria-hidden>{(nombre.trim().charAt(0) || "?").toUpperCase()}</span>
      )}
    </span>
  );
}
