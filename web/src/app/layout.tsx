import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { LogoVeciRed } from "@/components/logo";
import { MenuCuenta } from "@/components/menu-cuenta";
import { MenuMovil } from "@/components/menu-movil";
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
};

export const viewport: Viewport = {
  themeColor: "#14213D",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-marino shadow-lg shadow-black/30">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 lg:px-6">
            <Link href="/" className="mr-auto flex min-w-0 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/30">
                <LogoVeciRed className="h-9 w-9" />
              </span>
              <span className="min-w-0">
                <span className="block text-2xl leading-none font-black tracking-tight text-white">
                  Veci<span className="text-naranja-vivo">Red</span>
                </span>
                <span className="mt-1 block text-xs leading-tight text-white">Conectá con el comercio de tu barrio</span>
              </span>
            </Link>
            <nav className="hidden items-center gap-1 rounded-2xl border border-white/20 p-1 md:flex" aria-label="Secciones">
              <Link href="/" className="rounded-xl px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10">
                Buscar
              </Link>
              <Suspense fallback={null}>
                <MenuCuenta />
              </Suspense>
            </nav>
            <Suspense fallback={null}>
              <MenuMovil>
                <Link href="/" className="rounded-xl px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10">
                  Buscar
                </Link>
                <Suspense fallback={null}>
                  <MenuCuenta />
                </Suspense>
              </MenuMovil>
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
            </div>
            <nav className="flex flex-col gap-2" aria-label="VeciRed">
              <Link href="/comercios" className="hover:underline">Sumá tu comercio</Link>
              <Link href="/preguntas" className="hover:underline">Preguntas frecuentes</Link>
              <a href={`mailto:${MAIL_CONTACTO}`} className="hover:underline">Contacto: {MAIL_CONTACTO}</a>
            </nav>
            <nav className="flex flex-col gap-2" aria-label="Legales">
              <Link href="/terminos" className="hover:underline">Términos y condiciones</Link>
              <Link href="/privacidad" className="hover:underline">Política de privacidad</Link>
            </nav>
          </div>
          <p className="border-t border-white/10 px-4 py-4 text-center text-xs text-white/60">
            VeciRed™ · {TITULAR} · CUIT {CUIT}
          </p>
        </footer>
      </body>
    </html>
  );
}
