import type { Metadata } from "next";
import Link from "next/link";
import { PLANTILLA_EXCEL, PLANTILLA_GOOGLE } from "@/components/planilla-modelo";
import { Preguntas, type Pregunta } from "@/components/preguntas";
import { MAIL_CONTACTO } from "@/lib/legal";
import { vistaPrevia } from "@/lib/sitio";

const DESCRIPCION =
  "Sumá tu comercio a VeciRed: publicá tus productos con precio y stock, recibí reservas de vecinos de tu zona y que te retiren en el local. Los primeros 3 meses son gratis.";

export const metadata: Metadata = {
  title: "Para comercios",
  description: DESCRIPCION,
  alternates: { canonical: "/comercios" },
  openGraph: vistaPrevia({ titulo: "Sumá tu comercio a VeciRed", descripcion: DESCRIPCION, ruta: "/comercios", alt: "VeciRed" }),
};

const CREAR = "/ingresar?modo=crear&siguiente=/comerciante";

const PASOS = [
  {
    titulo: "Creá tu cuenta y cargá el comercio",
    texto: "Nombre, dirección con el pin en el mapa, horarios y una forma de contacto. Lo revisamos y te avisamos cuando queda publicado.",
  },
  {
    titulo: "Subí tus productos",
    texto: "De a uno con foto, o todos juntos con una planilla de Excel. Para cada producto elegís cómo mostrar el stock.",
  },
  {
    titulo: "Recibí reservas y vendé en el local",
    texto: "Te llega la reserva, la aceptás con un toque y el vecino pasa a retirar y pagar en tu local, como siempre.",
  },
];

const BENEFICIOS = [
  ["Te encuentran los vecinos", "Tu comercio y tus productos aparecen en el mapa y en la búsqueda de la gente de tu zona, y también en Google."],
  ["Vendés sin cambiar nada", "El cliente paga en tu local con los medios que ya aceptás. No hace falta envío ni cobrar por internet."],
  ["Menos consultas que no terminan en venta", "El vecino ya ve el precio y si hay stock antes de ir, y te llega con el producto reservado."],
  ["Si no lo tenés, ofrecé otra cosa", "Si te reservan algo que se agotó, le ofrecés al cliente otros productos de tu catálogo con un toque."],
  ["Sabés qué interesa", "En tu panel ves cuántas veces vieron tu comercio, cuántas reservas recibiste, cuántas se retiraron y tus reseñas."],
  ["Hablás directo con el cliente", "Ves su nombre y teléfono en cada reserva, con botones para escribirle por WhatsApp o llamarlo."],
];

const PREGUNTAS: Pregunta[] = [
  {
    p: "¿Cuánto cuesta?",
    r: (
      <p>
        Los primeros 3 meses son gratis. Después, el uso tiene una suscripción mensual. Te avisamos el precio y las condiciones con
        al menos 30 días de anticipación, y si no te conviene podés dar de baja el comercio sin costo antes de que empiece a
        cobrarse.
      </p>
    ),
  },
  {
    p: "¿Quién cobra la venta?",
    r: (
      <p>
        Vos. VeciRed no vende ni cobra los productos: la reserva es un pedido para que le guardes el producto al vecino, que paga
        cuando lo retira en tu local, con los medios que vos aceptes. La factura, la garantía y los cambios siguen siendo como
        siempre.
      </p>
    ),
  },
  {
    p: "¿Qué necesito para sumarme?",
    r: (
      <p>
        Un local a la calle con dirección, tus horarios de atención y un celular o computadora para ver las reservas. Antes de
        publicar revisamos que el comercio exista: te podemos pedir el CUIT, tus redes o una foto del frente.
      </p>
    ),
  },
  {
    p: "¿Cómo cargo los productos?",
    r: (
      <>
        <p>
          Desde tu panel podés cargarlos de a uno, con foto, precio y descripción. Si tenés muchos, bajás nuestra planilla de
          Excel, la completás y la subís: se cargan todos juntos. Las fotos también se pueden subir todas de una vez.
        </p>
        <p>
          <a href={PLANTILLA_EXCEL}>Descargar la planilla para Excel</a>
          {PLANTILLA_GOOGLE ? (
            <>
              {" · "}
              <a href={PLANTILLA_GOOGLE} target="_blank" rel="noopener noreferrer">
                Abrirla en Google Sheets
              </a>
            </>
          ) : null}
        </p>
      </>
    ),
  },
  {
    p: "¿Tengo que tener el stock exacto?",
    r: (
      <p>
        No. Para cada producto elegís: cantidad exacta, un semáforo (hay, queda poco, no hay), “consultar” o “por pedido”. Así lo
        mantenés al día sin tener que contar todo.
      </p>
    ),
  },
  {
    p: "¿Cuánto tiempo tengo para responder una reserva?",
    r: (
      <p>
        Dos horas dentro de tu horario de atención. Si una reserva llega con el local cerrado, el tiempo empieza a contar cuando
        abrís. Si no respondés, vence sola y el vecino lo ve en sus reservas.
      </p>
    ),
  },
  {
    p: "¿Y si el cliente no viene a retirar?",
    r: (
      <p>
        La reserva aceptada vence sola un día de atención después del último horario de retiro, y el producto vuelve a tu stock.
        Si un cliente no retira o cancela reservas seguido, podemos limitar su cuenta.
      </p>
    ),
  },
  {
    p: "¿Qué pasa en feriados o si cierro unos días?",
    r: (
      <p>
        Los feriados nacionales ya están cargados, y vos elegís si abrís o no. También podés marcar días puntuales de cierre, como
        vacaciones: esos días no se pueden hacer reservas para retirar.
      </p>
    ),
  },
  {
    p: "¿En qué zonas está VeciRed?",
    r: <p>Arrancamos en Ingeniero Maschwitz y vamos a sumar Escobar, Pacheco, Tigre, Pilar y más zonas de a poco.</p>,
  },
  {
    p: "¿Puedo dar de baja el comercio?",
    r: <p>Sí, cuando quieras y sin costo. Escribinos y lo despublicamos, o borrá tu cuenta desde “Mi perfil”.</p>,
  },
];

export default function PaginaComercios() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="tarjeta rounded-3xl p-6 text-center sm:p-10">
        <p className="text-sm font-semibold tracking-wide text-naranja-vivo uppercase">Para comercios de barrio</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Que los vecinos encuentren lo que vendés</h1>
        <p className="mx-auto mt-3 max-w-2xl text-white/85">
          Publicá tus productos con precio y stock, recibí reservas de gente de tu zona y que te retiren en el local. Vos cobrás
          como siempre.
        </p>
        <p className="mt-4 inline-block rounded-full border border-white/40 px-4 py-1 text-sm font-semibold">
          Los primeros 3 meses son gratis
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href={CREAR} className="boton rounded-xl px-6 py-3 font-semibold">
            Sumá tu comercio
          </Link>
          <Link href="/ingresar?siguiente=/comerciante" className="rounded-xl border border-white/40 px-6 py-3 hover:bg-white/10">
            Ya tengo cuenta
          </Link>
        </div>
      </section>

      <section className="tarjeta rounded-3xl p-6 sm:p-8">
        <h2 className="text-xl font-bold">Cómo funciona</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          {PASOS.map((paso, i) => (
            <li key={paso.titulo} className="rounded-2xl border border-white/20 p-4">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-naranja font-bold">{i + 1}</span>
              <h3 className="mt-3 font-semibold">{paso.titulo}</h3>
              <p className="mt-1 text-sm text-white/80">{paso.texto}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="tarjeta rounded-3xl p-6 sm:p-8">
        <h2 className="text-xl font-bold">Qué te da VeciRed</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {BENEFICIOS.map(([titulo, texto]) => (
            <li key={titulo} className="flex gap-3">
              <span aria-hidden className="mt-0.5 text-naranja-vivo">✓</span>
              <div>
                <h3 className="font-semibold">{titulo}</h3>
                <p className="mt-0.5 text-sm text-white/80">{texto}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="tarjeta rounded-3xl p-6 sm:p-8">
        <h2 className="text-xl font-bold">Preguntas frecuentes</h2>
        <div className="mt-4">
          <Preguntas lista={PREGUNTAS} />
        </div>
      </section>

      <section className="tarjeta rounded-3xl p-6 text-center sm:p-8">
        <h2 className="text-xl font-bold">¿Lo probamos?</h2>
        <p className="mt-2 text-sm text-white/85">
          Crear la cuenta lleva unos minutos. Si tenés dudas, escribinos a <a href={`mailto:${MAIL_CONTACTO}`} className="underline">{MAIL_CONTACTO}</a>.
        </p>
        <Link href={CREAR} className="boton mt-5 inline-block rounded-xl px-6 py-3 font-semibold">
          Sumá tu comercio gratis
        </Link>
      </section>
    </div>
  );
}
