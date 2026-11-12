import type { Metadata } from "next";
import Link from "next/link";
import { Preguntas, type Pregunta } from "@/components/preguntas";
import { MAIL_CONTACTO } from "@/lib/legal";
import { vistaPrevia } from "@/lib/sitio";

const DESCRIPCION = "Cómo buscar, reservar y retirar productos en los comercios de tu barrio con VeciRed.";

export const metadata: Metadata = {
  title: "Preguntas frecuentes",
  description: DESCRIPCION,
  alternates: { canonical: "/preguntas" },
  openGraph: vistaPrevia({ titulo: "Preguntas frecuentes | VeciRed", descripcion: DESCRIPCION, ruta: "/preguntas", alt: "VeciRed" }),
};

const PREGUNTAS: Pregunta[] = [
  {
    p: "¿Qué es VeciRed?",
    r: (
      <p>
        Una página para encontrar productos en los comercios de tu barrio: ves el precio y si hay stock, lo reservás y lo
        retirás en el local. Así no vas hasta un negocio para enterarte de que no lo tienen.
      </p>
    ),
  },
  {
    p: "¿Cuánto cuesta usarla?",
    r: <p>Nada. Buscar, reservar y retirar es gratis para los vecinos. Pagás solo el producto, en el local.</p>,
  },
  {
    p: "¿Cómo reservo un producto?",
    r: (
      <p>
        Buscá lo que necesitás, entrá al producto, tocá “Reservar” y elegí cuándo vas a pasar a retirarlo. Necesitás una cuenta,
        que se crea en un minuto con tu mail.
      </p>
    ),
  },
  {
    p: "¿Tengo que pagar online?",
    r: (
      <p>
        No. Por ahora pagás cuando retirás, en el local, con los medios que acepte cada comercio. La venta es entre vos y el
        comercio: él te da la factura y responde por el producto.
      </p>
    ),
  },
  {
    p: "¿Cómo sé si el comercio aceptó mi reserva?",
    r: (
      <p>
        Te avisamos por mail y lo ves en “Mis reservas”. El comercio tiene 2 horas de su horario de atención para responder; si
        no lo hace, la reserva vence sola y lo ves en “Mis reservas”.
      </p>
    ),
  },
  {
    p: "¿Y si no tienen lo que reservé?",
    r: (
      <p>
        El comercio puede ofrecerte otros productos parecidos. En “Mis reservas” elegís el que te sirve o cancelás sin ningún
        costo.
      </p>
    ),
  },
  {
    p: "¿Puedo cancelar una reserva?",
    r: (
      <p>
        Sí, desde “Mis reservas”, mientras no la hayas retirado. Si no vas a poder ir, cancelala: así el comercio puede ofrecer
        el producto a otra persona. Si no retirás o cancelás reservas seguido, podemos limitar tu cuenta.
      </p>
    ),
  },
  {
    p: "¿El precio puede cambiar?",
    r: (
      <p>
        Los precios los carga cada comercio, que se compromete a respetar el precio publicado al momento de tu reserva. Si
        encontrás una diferencia, avisanos.
      </p>
    ),
  },
  {
    p: "¿Puedo dejar una opinión del comercio?",
    r: (
      <p>
        Sí. Después de retirar una reserva podés calificar al comercio con estrellas y dejar un comentario. Se muestra con tu
        nombre y la inicial de tu apellido.
      </p>
    ),
  },
  {
    p: "¿Qué hacen con mis datos?",
    r: (
      <p>
        Los usamos solo para que funcionen tu cuenta y tus reservas. El comercio donde reservás ve tu nombre, tu teléfono y tu
        foto para coordinar el retiro. Podés cambiar tus datos o borrar tu cuenta desde “Mi perfil”. Más detalles en la{" "}
        <Link href="/privacidad">política de privacidad</Link>.
      </p>
    ),
  },
];

export default function PaginaPreguntas() {
  return (
    <div className="tarjeta mx-auto max-w-3xl rounded-3xl p-6 sm:p-8">
      <h1 className="text-2xl font-bold">Preguntas frecuentes</h1>
      <p className="mt-1 text-sm text-white/80">Todo sobre buscar, reservar y retirar en los comercios de tu barrio.</p>
      <div className="mt-6">
        <Preguntas lista={PREGUNTAS} />
      </div>
      <p className="mt-6 text-sm text-white/85">
        ¿No encontraste tu respuesta? Escribinos a{" "}
        <a href={`mailto:${MAIL_CONTACTO}`} className="underline">
          {MAIL_CONTACTO}
        </a>
        . ¿Tenés un comercio? Mirá <Link href="/comercios" className="underline">cómo sumarte</Link>.
      </p>
    </div>
  );
}
