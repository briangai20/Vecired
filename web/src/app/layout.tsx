import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { LogoVeciRed } from "@/components/logo";
import { MenuCuenta } from "@/components/menu-cuenta";
import { BarraInferior } from "@/components/barra-inferior";
import { Avisos } from "@/components/avisos";
import { Buscador, BuscadorCargando } from "@/components/buscador";
import { InstalarApp } from "@/components/instalar-app";
import { PantallaInicio } from "@/components/pantalla-inicio";
import { DESCRIPCION_SITIO, SITIO } from "@/lib/sitio";
import { CUIT, MAIL_CONTACTO, TITULAR } from "@/lib/legal";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITIO),
  title: {
    default: "VeciRed | Conectá con el comercio de tu barrio",
    template: "%s | VeciRed",
  },
  description: DESCRIPCION_SITIO,
  openGraph: {
    siteName: "VeciRed",
    locale: "es_AR",
    type: "website",
    title: "VeciRed | Conectá con el comercio de tu barrio",
    description: DESCRIPCION_SITIO,
  },
  twitter: { card: "summary_large_image" },
  // Al agregarla a la pantalla de inicio del iPhone, se abre como app.
  appleWebApp: { capable: true, title: "VeciRed", statusBarStyle: "black-translucent" },
};

// Enlaces del pie: sin recuadro, se pintan al tocarlos.
const botonPie = "-mx-3 rounded-xl px-3 py-2 transition hover:bg-white/10 active:bg-naranja/70";

export const viewport: Viewport = {
  // Ocupa toda la pantalla del celular (la barra de abajo respeta la zona del gesto de inicio).
  viewportFit: "cover",
  themeColor: "#14213D",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} h-full antialiased`} suppressHydrationWarning>
      {/* En el celular, lugar abajo para la barra de navegación fija. */}
      <body className="flex min-h-full flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] font-sans lg:pb-0">
        <PantallaInicio />
        <header className="sticky top-0 z-40 border-b border-white/10 bg-marino pt-[env(safe-area-inset-top)] shadow-lg shadow-black/30">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 lg:gap-5 lg:px-6">
            <Link href="/" className="mr-auto flex min-w-0 items-center gap-2.5 sm:gap-3 lg:mr-0 lg:shrink-0">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/30">
                <LogoVeciRed className="h-9 w-9" />
              </span>
              <span className="min-w-0">
                <span className="block text-2xl leading-none font-black tracking-tight text-white">
                  Veci<span className="text-naranja-vivo">Red</span>
                </span>
                <span className="mt-1 block text-xs leading-tight text-white lg:hidden xl:block">Conectá con el comercio de tu barrio</span>
              </span>
            </Link>
            {/* En la compu el buscador va en el medio; en el celular, en una fila propia (abajo). */}
            <Suspense fallback={<BuscadorCargando className="hidden flex-1 lg:block" />}>
              <Buscador className="hidden flex-1 lg:block" />
            </Suspense>
            <nav className="hidden shrink-0 items-center gap-1 lg:flex" aria-label="Secciones">
              <Suspense fallback={null}>
                <MenuCuenta />
              </Suspense>
            </nav>
            <Suspense fallback={null}>
              <Avisos />
            </Suspense>
          </div>
          <div className="mx-auto max-w-7xl px-4 pb-3 lg:hidden">
            <Suspense fallback={<BuscadorCargando />}>
              <Buscador />
            </Suspense>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 lg:px-6">{children}</main>
        <footer className="mt-6 bg-marino text-white">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 text-sm sm:grid-cols-3 lg:px-6">
            <div>
              <Link href="/" className="flex items-center gap-2">
                <LogoVeciRed className="h-8 w-8" />
                <span className="text-xl font-black tracking-tight">
                  Veci<span className="text-naranja-vivo">Red</span>
                </span>
              </Link>
              <p className="mt-2 text-white/75">Conectá con el comercio de tu barrio.</p>
              <div className="mt-4">
                <InstalarApp />
              </div>
            </div>
            {/* Las dos columnas de enlaces, con el mismo espacio entre todos en el celular. */}
            <div className="grid gap-1 sm:col-span-2 sm:grid-cols-2 sm:gap-6">
            <nav className="flex flex-col gap-1 sm:items-start" aria-label="VeciRed">
              <Link href="/comercios" className={botonPie}>Sumá tu comercio</Link>
              <Link href="/preguntas" className={botonPie}>Preguntas frecuentes</Link>
              <a href={`mailto:${MAIL_CONTACTO}`} className={botonPie}>Contacto: {MAIL_CONTACTO}</a>
            </nav>
            <nav className="flex flex-col gap-1 sm:items-start" aria-label="Legales">
              <Link href="/terminos" className={botonPie}>Términos y condiciones</Link>
              <Link href="/privacidad" className={botonPie}>Política de privacidad</Link>
            </nav>
            </div>
          </div>
          <p className="border-t border-white/10 px-4 py-4 text-center text-xs text-white/60">
            VeciRed™ · {TITULAR} · CUIT {CUIT}
          </p>
        </footer>
        <Suspense fallback={null}>
          <BarraInferior>
            <Suspense fallback={null}>
              <MenuCuenta />
            </Suspense>
          </BarraInferior>
        </Suspense>
      </body>
    </html>
  );
}
