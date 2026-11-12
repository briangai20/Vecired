import Link from "next/link";
import { salir } from "@/app/ingresar/acciones";
import { usuarioActual } from "@/lib/sesion";

// Cada opción va en su propio recuadro, en la compu y en el menú del celular.
const enlace = "rounded-xl border border-white/25 px-3 py-2 text-center text-sm font-medium whitespace-nowrap text-white transition hover:border-white/60 hover:bg-white/10";

const inicio = (
  <Link href="/" className={enlace}>
    Inicio
  </Link>
);

export async function MenuCuenta() {
  const usuario = await usuarioActual();
  if (!usuario) {
    return (
      <>
        {inicio}
        <Link href="/comercios" className={enlace}>
          Soy comerciante
        </Link>
        <Link href="/ingresar" className={`${enlace} border-white/50 bg-white/10`}>
          Ingresar
        </Link>
      </>
    );
  }
  return (
    <>
      {inicio}
      <Link href="/reservas" className={enlace}>
        Mis reservas
      </Link>
      <Link href="/favoritos" className={enlace}>
        Favoritos
      </Link>
      {usuario.rol === "comerciante" ? (
        <Link href="/comerciante" className={enlace}>
          Mi comercio
        </Link>
      ) : null}
      {usuario.admin ? (
        <Link href="/admin" className={enlace}>
          Admin
        </Link>
      ) : null}
      <Link href="/cuenta" className={enlace}>
        Mi perfil
      </Link>
      <form action={salir}>
        <button className={enlace} title={usuario.email}>
          Salir
        </button>
      </form>
    </>
  );
}
