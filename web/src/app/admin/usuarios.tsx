import Link from "next/link";
import { FotoPerfil } from "@/components/foto-perfil";
import { ListaConMas } from "@/components/lista-con-mas";
import { coincideAprox, coincideExacto, palabrasBuscadas, palabrasDe } from "@/lib/busqueda";
import type { Database } from "@/lib/supabase/tipos";

export type UsuarioAdmin = Database["public"]["Functions"]["usuarios_para_admin"]["Returns"][number];

const fecha = (f: string) => new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "numeric", year: "2-digit" }).format(new Date(f));

const DIA = 86_400_000;
const COMERCIO: Record<NonNullable<UsuarioAdmin["comercio_estado"]>, string> = {
  publicado: "Comercio publicado",
  en_revision: "Comercio en revisión",
  rechazado: "Comercio rechazado",
  dado_de_baja: "Comercio dado de baja",
};

// Estado de la cuenta: sin confirmar el mail, activa (entró en los últimos
// 30 días) o inactiva.
function estado(u: UsuarioAdmin, ahora: number) {
  if (!u.mail_confirmado) return { texto: "Mail sin confirmar", clase: "border-naranja-vivo text-naranja-vivo" };
  if (u.ultimo_ingreso && ahora - new Date(u.ultimo_ingreso).getTime() < 30 * DIA) return { texto: "Activa", clase: "border-verde text-verde" };
  return { texto: "Inactiva (+30 días)", clase: "border-white/40 text-white/70" };
}

const TIPOS = { todos: "Todos", comprador: "Compradores", comerciante: "Comerciantes", sin_confirmar: "Sin confirmar" } as const;
type Tipo = keyof typeof TIPOS;

// Usuarios registrados: cuántos hay, en qué estado y los datos de su perfil.
export function Usuarios({ usuarios, tipo: tipoParam, q }: { usuarios: UsuarioAdmin[]; tipo?: string; q?: string }) {
  const ahora = new Date().getTime();
  const tipo: Tipo = tipoParam && tipoParam in TIPOS ? (tipoParam as Tipo) : "todos";
  const pasaTipo = (u: UsuarioAdmin, t: Tipo) => (t === "todos" ? true : t === "sin_confirmar" ? !u.mail_confirmado : u.rol === t);
  const buscadas = palabrasBuscadas(q ?? "");
  const texto = (u: UsuarioAdmin) => [u.nombre, u.email, u.telefono, u.comercio_nombre].filter(Boolean).join(" ");
  const delTipo = usuarios.filter((u) => pasaTipo(u, tipo));
  const exactos = buscadas.length ? delTipo.filter((u) => coincideExacto(texto(u), buscadas)) : delTipo;
  const lista = exactos.length || !buscadas.length ? exactos : delTipo.filter((u) => coincideAprox(palabrasDe(texto(u)), buscadas));

  const resumen: [string, number][] = [
    ["Usuarios", usuarios.length],
    ["Compradores", usuarios.filter((u) => u.rol === "comprador").length],
    ["Comerciantes", usuarios.filter((u) => u.rol === "comerciante").length],
    ["Nuevos (7 días)", usuarios.filter((u) => ahora - new Date(u.creado_en).getTime() < 7 * DIA).length],
    ["Activos (30 días)", usuarios.filter((u) => estado(u, ahora).texto === "Activa").length],
    ["Mail sin confirmar", usuarios.filter((u) => !u.mail_confirmado).length],
  ];

  return (
    <div className="space-y-4">
      <div className="tarjeta rounded-3xl p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {resumen.map(([t, n]) => (
            <div key={t} className="border-l-2 border-naranja-vivo/70 py-1 pl-3">
              <p className="text-xs text-white/75">{t}</p>
              <p className="mt-1 text-2xl font-black">{n.toLocaleString("es-AR")}</p>
            </div>
          ))}
        </div>
        <form className="mt-4 flex flex-wrap items-end gap-2" action="/admin">
          <input type="hidden" name="ver" value="usuarios" />
          <input type="hidden" name="tipo" value={tipo} />
          <label className="block min-w-0 flex-1 text-xs">
            Buscar
            <input type="search" name="q" defaultValue={q ?? ""} placeholder="Nombre, mail, teléfono o comercio" className="campo mt-1" />
          </label>
          <button className="boton rounded-xl px-4 py-2.5 text-sm font-semibold">Buscar</button>
        </form>
        <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Tipo de usuario">
          {(Object.keys(TIPOS) as Tipo[]).map((t) => (
            <Link
              key={t}
              href={`/admin?ver=usuarios&tipo=${t}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              aria-current={t === tipo ? "page" : undefined}
              className={t === tipo ? "font-semibold text-naranja-vivo underline decoration-2 underline-offset-8" : "text-white/85 hover:text-naranja-vivo"}
            >
              {TIPOS[t]} ({usuarios.filter((u) => pasaTipo(u, t)).length})
            </Link>
          ))}
        </nav>
        <p className="mt-3 text-[11px] text-white/60">
          Datos personales: usalos solo para administrar VeciRed (soporte, verificar comercios, prevenir abusos). No los copies ni los compartas.
        </p>
      </div>

      {lista.length === 0 ? (
        <p className="tarjeta rounded-3xl p-6 text-sm">No hay usuarios con esos datos.</p>
      ) : (
        <ListaConMas deA={30} que="usuarios" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((u) => {
            const e = estado(u, ahora);
            return (
              <article key={u.id} className="tarjeta min-w-0 rounded-2xl p-4 text-sm">
                <div className="flex items-start gap-3">
                  <FotoPerfil url={u.foto_url} nombre={u.nombre || u.email} className="h-11 w-11 text-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold break-words">
                      {u.nombre || "Sin nombre"}
                      {u.es_admin ? <span className="ml-1.5 rounded-full bg-naranja px-1.5 py-0.5 text-[10px] font-bold">Admin</span> : null}
                    </p>
                    <p className="text-xs text-white/75">{u.rol === "comerciante" ? "🏪 Comerciante" : "🛍️ Comprador"}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${e.clase}`}>{e.texto}</span>
                </div>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  <dt className="text-white/60">Mail</dt>
                  <dd className="break-all">
                    <a href={`mailto:${u.email}`} className="hover:underline">
                      {u.email}
                    </a>
                  </dd>
                  <dt className="text-white/60">Teléfono</dt>
                  <dd>{u.telefono || "No cargó"}</dd>
                  <dt className="text-white/60">Se registró</dt>
                  <dd>{fecha(u.creado_en)}</dd>
                  <dt className="text-white/60">Último ingreso</dt>
                  <dd>{u.ultimo_ingreso ? fecha(u.ultimo_ingreso) : "Nunca"}</dd>
                  <dt className="text-white/60">Reservas</dt>
                  <dd>
                    {u.reservas} hechas · {u.retiradas} retiradas
                  </dd>
                  <dt className="text-white/60">Mails</dt>
                  <dd>{u.avisos_mail === "ninguno" ? "No quiere recibir" : "Solo importantes"}</dd>
                  {u.rol === "comerciante" ? (
                    <>
                      <dt className="text-white/60">Comercio</dt>
                      <dd className="break-words">
                        {u.comercio_id ? (
                          <>
                            <Link href={`/admin?ver=${u.comercio_estado === "publicado" ? "publicados" : u.comercio_estado === "rechazado" ? "rechazados" : "pendientes"}#c${u.comercio_id}`} className="underline">
                              {u.comercio_nombre}
                            </Link>{" "}
                            · {COMERCIO[u.comercio_estado ?? "en_revision"]}
                          </>
                        ) : (
                          "Todavía no lo cargó"
                        )}
                      </dd>
                    </>
                  ) : null}
                </dl>
              </article>
            );
          })}
        </ListaConMas>
      )}
    </div>
  );
}
