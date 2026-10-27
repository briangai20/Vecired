import type { Metadata } from "next";
import Link from "next/link";
import { Seccion, TextoLegal } from "@/components/texto-legal";
import { CUIT, DOMICILIO, MAIL_CONTACTO, TITULAR } from "@/lib/legal";

export const metadata: Metadata = { title: "Términos y condiciones" };

export default function PaginaTerminos() {
  return (
    <TextoLegal titulo="Términos y condiciones">
      <p>
        Estos términos regulan el uso de Vecired. Al crear una cuenta o usar la app aceptás estos términos y la{" "}
        <Link href="/privacidad">política de privacidad</Link>. Si no estás de acuerdo, no uses Vecired.
      </p>

      <Seccion titulo="1. Quiénes somos">
        <p>
          Vecired es operada por {TITULAR}, CUIT {CUIT}, con domicilio en {DOMICILIO}. Podés escribirnos a {MAIL_CONTACTO}.
        </p>
      </Seccion>

      <Seccion titulo="2. Qué es Vecired">
        <p>
          Vecired es una plataforma que conecta a personas que buscan productos (“compradores”) con comercios físicos de su zona
          (“comercios”). En Vecired podés encontrar productos, reservarlos y retirarlos en el local.
        </p>
        <p>
          <strong>Vecired no vende los productos.</strong> Cada venta se hace directamente entre el comprador y el comercio. El
          comercio es el vendedor y responde por el producto, su precio, su stock, la factura, la garantía y los cambios o
          devoluciones, según la ley de defensa del consumidor.
        </p>
      </Seccion>

      <Seccion titulo="3. Tu cuenta">
        <ul>
          <li>Para reservar o publicar un comercio necesitás una cuenta. Tenés que ser mayor de 18 años.</li>
          <li>Los datos que cargues tienen que ser verdaderos y estar actualizados.</li>
          <li>Tu contraseña es personal. Sos responsable de lo que se haga con tu cuenta. Si creés que alguien la usó sin tu permiso, avisanos.</li>
          <li>Podés pedir la baja de tu cuenta cuando quieras escribiéndonos a {MAIL_CONTACTO}.</li>
        </ul>
      </Seccion>

      <Seccion titulo="4. Reservas (para compradores)">
        <ul>
          <li>
            Una reserva es un pedido para que el comercio te guarde un producto. No es una compra: la compra se hace cuando pagás
            y retirás el producto en el local.
          </li>
          <li>Por ahora el pago se hace en el local, con los medios que acepte cada comercio.</li>
          <li>
            El comercio puede aceptar la reserva, rechazarla u ofrecerte productos alternativos. Si no responde dentro de las 2
            horas en que el local está abierto, la reserva vence sola.
          </li>
          <li>Podés cancelar una reserva desde “Mis reservas” mientras no la hayas retirado.</li>
          <li>
            Cuando el comercio acepta, tenés que retirar el producto en el horario que elegiste. Si no vas a poder, cancelá la
            reserva para que el comercio pueda ofrecer el producto a otra persona.
          </li>
          <li>
            Los precios, el stock, las fotos y las descripciones los carga cada comercio. Hacemos lo posible para que estén al
            día, pero el precio final es el que te informe el comercio al momento de pagar.
          </li>
          <li>Si no retirás o cancelás reservas en forma repetida, podemos limitar tu cuenta.</li>
        </ul>
      </Seccion>

      <Seccion titulo="5. Comercios">
        <ul>
          <li>
            Para publicar un comercio tenés que ser su titular o estar autorizado por él. Revisamos cada comercio antes de
            mostrarlo y podemos no aprobarlo.
          </li>
          <li>
            El comercio es responsable de que la información que publica (nombre, dirección, horarios, productos, precios, stock y
            fotos) sea verdadera y esté actualizada, y de tener los derechos sobre las fotos y textos que sube.
          </li>
          <li>
            El comercio se compromete a responder las reservas, a guardar el producto reservado hasta el horario de retiro y a
            respetar el precio publicado al momento de la reserva.
          </li>
          <li>
            El comercio debe cumplir las normas que le correspondan: habilitaciones, facturación, defensa del consumidor, precios
            y cualquier otra que se aplique a su actividad.
          </li>
          <li>
            No se pueden publicar productos ilegales, falsificados, robados, medicamentos de venta bajo receta, armas, tabaco o
            alcohol para menores, ni nada cuya venta esté prohibida o requiera autorizaciones que el comercio no tenga.
          </li>
          <li>
            Los comercios usan Vecired sin costo durante los primeros 3 meses. Después, el uso tendrá una suscripción mensual. Te
            vamos a avisar el precio y las condiciones con al menos 30 días de anticipación, y vas a poder dar de baja el comercio
            sin costo antes de que empiece a cobrarse.
          </li>
          <li>
            El comercio nos autoriza a mostrar en Vecired, y en la difusión de Vecired, su nombre, logo, fotos y productos mientras
            esté publicado.
          </li>
        </ul>
      </Seccion>

      <Seccion titulo="6. Reseñas">
        <p>
          Después de retirar una reserva podés dejar una reseña del comercio. Tiene que ser sobre tu experiencia real, sin
          insultos, datos personales de terceros ni publicidad. Podemos quitar las reseñas que no cumplan estas reglas. Junto a
          la reseña se muestra tu nombre y la inicial de tu apellido.
        </p>
      </Seccion>

      <Seccion titulo="7. Qué no está permitido">
        <ul>
          <li>Usar Vecired para engañar, estafar o molestar a otras personas.</li>
          <li>Hacer reservas falsas o publicar información falsa.</li>
          <li>Intentar acceder a cuentas o datos de otras personas, o afectar el funcionamiento de la app.</li>
          <li>Copiar en forma masiva el contenido de Vecired con programas automáticos.</li>
        </ul>
        <p>Si no se cumplen estos términos, podemos suspender o dar de baja la cuenta o el comercio.</p>
      </Seccion>

      <Seccion titulo="8. Responsabilidad">
        <p>
          Vecired es un intermediario: no es parte de la venta y no garantiza que el comercio tenga el producto, ni su calidad o
          precio. Igualmente, si tenés un problema con un comercio, escribinos y vamos a intentar ayudarte.
        </p>
        <p>
          Trabajamos para que la app funcione siempre, pero puede haber interrupciones por mantenimiento o fallas técnicas. Nada
          de lo que dicen estos términos limita los derechos que te da la ley de defensa del consumidor.
        </p>
      </Seccion>

      <Seccion titulo="9. Propiedad intelectual">
        <p>
          La marca Vecired, el diseño y el software de la app son de su titular. El contenido que cargan los comercios y las
          reseñas siguen siendo de quienes los publicaron.
        </p>
      </Seccion>

      <Seccion titulo="10. Cambios en estos términos">
        <p>
          Podemos actualizar estos términos. Si el cambio es importante, te vamos a avisar por mail o en la app antes de que entre
          en vigencia. Si seguís usando Vecired después, se entiende que aceptás la nueva versión.
        </p>
      </Seccion>

      <Seccion titulo="11. Ley aplicable">
        <p>
          Estos términos se rigen por las leyes de la República Argentina. Si sos consumidor, son competentes los tribunales de tu
          domicilio. También podés hacer reclamos ante la autoridad de defensa del consumidor de tu jurisdicción.
        </p>
      </Seccion>
    </TextoLegal>
  );
}
