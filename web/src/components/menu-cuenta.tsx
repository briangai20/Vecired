import { EnlaceMenu } from "@/components/enlace-menu";
import { salir } from "@/app/ingresar/acciones";
import { usuarioActual } from "@/lib/sesion";

// Opciones sin recuadro; se pinta la elegida (ver EnlaceMenu).
const salirClase = "rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap text-white transition hover:bg-white/10 active:bg-naranja/70";

const inicio = (
  <EnlaceMenu href="/">
    Inicio
  </EnlaceMenu>
);

export async function MenuCuenta() {
  const usuario = await usuarioActual();
  if (!usuario) {
    return (
      <>
        {inicio}
        <EnlaceMenu href="/comercios">
          Soy comerciante
        </EnlaceMenu>
        <EnlaceMenu href="/ingresar" className="bg-white/10">
          Ingresar
        </EnlaceMenu>
      </>
    );
  }
  return (
    <>
      {inicio}
      <EnlaceMenu href="/reservas">
        Mis reservas
      </EnlaceMenu>
      <EnlaceMenu href="/favoritos">
        Favoritos
      </EnlaceMenu>
      {usuario.rol === "comerciante" ? (
        <EnlaceMenu href="/comerciante">
          Mi comercio
        </EnlaceMenu>
      ) : null}
      {usuario.admin ? (
        <EnlaceMenu href="/admin">
          Admin
        </EnlaceMenu>
      ) : null}
      <EnlaceMenu href="/cuenta">
        Mi perfil
      </EnlaceMenu>
      <form action={salir}>
        <button className={salirClase} title={usuario.email}>
          Salir
        </button>
      </form>
    </>
  );
}
