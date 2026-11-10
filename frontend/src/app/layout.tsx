import type { Metadata } from "next";
import "./globals.css";
// Sistema visual del prototipo Withyouly v7: las reglas viven bajo .wy, así que
// solo afectan a las pantallas que envuelven su contenido en esa clase.
import "./withyouly.css";
// Capa de paridad con la entrega v58: tipografia, colores y controles finales.
import "./withyouly-v58-parity.css";
// Correcciones medidas en la verificacion E2E (se cargan al final).
import "./withyouly-e2e-fixes.css";
import ReadingSizeSync from "@/components/ReadingSizeSync";

// Base para las URLs absolutas de las vistas previas (Open Graph). En Vercel se
// usa el dominio del despliegue; NEXT_PUBLIC_SITE_URL permite fijar el dominio propio.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Whityouly",
  description: "Refugio anónimo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        {/* v58 declara Inter en la pila tipográfica pero no la descarga: se ve con la
            fuente del sistema. No se carga ninguna webfont para conservar ese aspecto. */}
      </head>
      <body className={`antialiased font-body-md`}>
        <ReadingSizeSync />
        {children}
      </body>
    </html>
  );
}
