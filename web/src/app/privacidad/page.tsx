import type { Metadata } from "next";
import Link from "next/link";
import { Seccion, TextoLegal } from "@/components/texto-legal";
import { CUIT, DOMICILIO, MAIL_CONTACTO, TITULAR } from "@/lib/legal";

export const metadata: Metadata = { title: "Política de privacidad" };

export default function PaginaPrivacidad() {
  return (
    <TextoLegal titulo="Política de privacidad">
      <p>
        Esta política explica qué datos personales usa VeciRed, para qué los usa y qué derechos tenés sobre ellos, según la Ley
        25.326 de Protección de Datos Personales. Complementa los <Link href="/terminos">términos y condiciones</Link>.
      </p>

      <Seccion titulo="1. Responsable de los datos">
        <p>
          El responsable de la base de datos es {TITULAR}, CUIT {CUIT}, con domicilio en {DOMICILIO}. Para cualquier consulta sobre
          tus datos escribinos a {MAIL_CONTACTO}.
        </p>
      </Seccion>

      <Seccion titulo="2. Qué datos usamos">
        <ul>
          <li>
            <strong>Datos de tu cuenta:</strong> nombre y apellido, mail, contraseña (guardada cifrada: nadie puede leerla, ni
            nosotros), si usás VeciRed para comprar o para vender y, si lo cargás, tu teléfono.
          </li>
          <li>
            <strong>Reservas:</strong> qué producto reservaste, cantidad, precio, comercio, horario de retiro elegido y en qué
            estado está la reserva.
          </li>
          <li>
            <strong>Reseñas:</strong> las estrellas y el texto que escribas, junto con tu nombre y la inicial de tu apellido.
          </li>
          <li>
            <strong>Datos del comercio:</strong> nombre, rubro, dirección, ubicación en el mapa, WhatsApp, horarios, días cerrados,
            productos, precios, stock y fotos.
          </li>
          <li>
            <strong>Tu ubicación:</strong> solo si tocás “Usar mi ubicación”, para mostrarte los comercios más cercanos. No la
            guardamos en tu cuenta. Podés buscar por zona sin compartirla.
          </li>
          <li>
            <strong>Visitas:</strong> contamos cuántas veces se ve cada comercio y producto, sin registrar quién lo vio, para
            mostrarle estadísticas al comercio.
          </li>
          <li>
            <strong>Datos técnicos:</strong> como en cualquier sitio web, nuestros proveedores registran la dirección IP, el
            navegador y las páginas pedidas, para que la app funcione y sea segura.
          </li>
        </ul>
      </Seccion>

      <Seccion titulo="3. Para qué los usamos">
        <ul>
          <li>Crear y mantener tu cuenta y dejarte ingresar.</li>
          <li>Que puedas buscar productos, reservarlos y seguir tus reservas.</li>
          <li>Que el comercio pueda gestionar las reservas que recibe.</li>
          <li>Mandarte mails necesarios: confirmar tu cuenta, recuperar tu contraseña y avisos sobre tus reservas.</li>
          <li>Prevenir abusos y fraudes y cumplir con la ley.</li>
        </ul>
        <p>No vendemos tus datos ni los usamos para publicidad de terceros.</p>
      </Seccion>

      <Seccion titulo="4. Con quién los compartimos">
        <ul>
          <li>
            <strong>Con el comercio donde reservás:</strong> ve tu nombre, tu teléfono si lo cargaste y los datos de la reserva,
            para poder prepararla y contactarte.
          </li>
          <li>
            <strong>Con el público:</strong> los datos del comercio y sus productos, y las reseñas con el nombre e inicial de quien
            las escribió.
          </li>
          <li>
            <strong>Con los proveedores que hacen funcionar la app</strong>, que solo pueden usar los datos para prestarnos su
            servicio: Supabase (base de datos, cuentas y fotos), Vercel (servidores del sitio), OpenFreeMap (mapas: tu
            navegador les pide las imágenes del mapa) y el servicio que usemos para mandar mails.
          </li>
          <li>Con autoridades, cuando una ley u orden judicial nos obligue.</li>
        </ul>
      </Seccion>

      <Seccion titulo="5. Dónde se guardan">
        <p>
          Los datos se guardan en servidores de Supabase y Vercel ubicados en Estados Unidos. Al usar VeciRed aceptás esta
          transferencia internacional. Elegimos proveedores que aplican medidas de seguridad adecuadas, como cifrado de las
          comunicaciones y control de acceso a los datos.
        </p>
      </Seccion>

      <Seccion titulo="6. Cookies">
        <p>
          Usamos solo las cookies necesarias para mantener tu sesión iniciada. No usamos cookies de publicidad ni de
          seguimiento.
        </p>
      </Seccion>

      <Seccion titulo="7. Cuánto tiempo los guardamos">
        <p>
          Guardamos tus datos mientras tengas la cuenta. Si la das de baja, los borramos, salvo lo que la ley nos obligue a
          conservar o lo necesario para resolver un reclamo pendiente. Las reseñas pueden quedar publicadas sin tu nombre.
        </p>
      </Seccion>

      <Seccion titulo="8. Tus derechos">
        <p>
          Podés borrar tu cuenta y tus datos cuando quieras desde <Link href="/cuenta">Mi cuenta</Link>. También podés pedir
          ver, corregir, actualizar o borrar tus datos escribiéndonos a {MAIL_CONTACTO} desde el mail de tu cuenta.
          Tu nombre y teléfono los podés cambiar en cualquier momento. Respondemos los pedidos de acceso en un máximo de 10 días
          corridos y los de corrección o borrado en un máximo de 5 días hábiles.
        </p>
        <p>
          El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a
          intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme lo establecido en
          el artículo 14, inciso 3 de la Ley Nº 25.326.
        </p>
        <p>
          La Agencia de Acceso a la Información Pública, en su carácter de Órgano de Control de la Ley Nº 25.326, tiene la
          atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por
          incumplimiento de las normas vigentes en materia de protección de datos personales.
        </p>
      </Seccion>

      <Seccion titulo="9. Seguridad">
        <p>
          Las comunicaciones con VeciRed viajan cifradas, las contraseñas se guardan cifradas y cada persona solo puede ver los
          datos que le corresponden. Ningún sistema es infalible: si detectamos un problema de seguridad que afecte tus datos, te
          vamos a avisar.
        </p>
      </Seccion>

      <Seccion titulo="10. Menores de edad">
        <p>VeciRed es para mayores de 18 años. Si sabemos que una cuenta es de un menor, la damos de baja.</p>
      </Seccion>

      <Seccion titulo="11. Cambios en esta política">
        <p>
          Si cambiamos esta política te vamos a avisar por mail o en la app antes de que el cambio entre en vigencia. Arriba de
          todo está la fecha de la última versión.
        </p>
      </Seccion>
    </TextoLegal>
  );
}
