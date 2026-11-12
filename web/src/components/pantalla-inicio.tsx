import { LogoVeciRed } from "@/components/logo";

// Pantalla con el logo y la frase al abrir VeciRed (una vez por visita).
// Se arma en el HTML para verse desde el primer instante, y se va sola con
// CSS (ver .pantalla-inicio en globals.css): no depende de que cargue nada.
// Si en esta visita ya se vio, el script la saca antes de que se dibuje.
const yaSeVio = `try{if(sessionStorage.getItem("vecired:intro"))document.documentElement.classList.add("sin-intro");else sessionStorage.setItem("vecired:intro","1")}catch(e){}`;

export function PantallaInicio() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: yaSeVio }} />
      <div aria-hidden className="pantalla-inicio fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-marino px-6 text-center text-white">
        <span className="pantalla-inicio-logo grid h-28 w-28 place-items-center rounded-[2rem] border border-white/30">
          <LogoVeciRed className="h-20 w-20" />
        </span>
        <span className="text-5xl leading-none font-black tracking-tight">
          Veci<span className="text-naranja-vivo">Red</span>
        </span>
        <span className="text-lg text-white/90">Conectá con el comercio de tu barrio</span>
      </div>
    </>
  );
}
