import type { Metadata } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

/**
 * What a link to this system looks like when somebody pastes it somewhere.
 *
 * WhatsApp, Slack and the rest fetch the page **anonymously** and read these
 * tags. That has two consequences worth stating, because both are easy to get
 * wrong and neither shows up in a browser:
 *
 *   1. The crawler follows the redirect to /login and reads the tags THERE.
 *      Defining them on the root layout is what makes them apply to the login
 *      page too — putting them only on a page behind the session would mean the
 *      preview is generated from a page no crawler ever sees.
 *
 *   2. The image has to be fetchable with no session, or there is no thumbnail.
 *      `/brand/` is on the public list in `middleware.ts` for exactly this
 *      reason, and for no other.
 *
 * `metadataBase` comes from the REQUEST, not from configuration. The image URL
 * in a preview has to be absolute, and the first version of this built it from
 * an environment variable — which was not passed to the application container,
 * so it fell back to `https://localhost:3000/brand/og.png`. The tags all looked
 * present, the title and description rendered correctly, and no thumbnail ever
 * appeared, because the only reader that matters was being told to fetch the
 * image from its own machine.
 *
 * The host that served the page is the one host guaranteed to be reachable by
 * whoever just fetched it. It also needs no configuration, survives the move
 * from an sslip.io name to the company's own domain, and cannot drift out of
 * step with reality — which an environment variable did, immediately.
 */
async function siteUrl(): Promise<URL> {
  const h = await headers();
  // x-forwarded-* first: TLS is terminated by Caddy, so the application itself
  // only ever sees plain HTTP against an internal name.
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  if (host) {
    try {
      return new URL(`${proto}://${host}`);
    } catch {
      // A malformed Host header is not worth failing metadata generation over.
    }
  }
  const configured = process.env.PUBLIC_HOSTNAME?.trim();
  if (configured) return new URL(`https://${configured}`);
  return new URL(process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000");
}

export async function generateMetadata(): Promise<Metadata> {
  const title = "Canei Subirats — ERP System";
  const description =
    "Presupuestos, obras, facturación y tesorería en un solo sitio. " +
    "Acceso privado para el equipo de Canei Subirats.";
  return {
    metadataBase: await siteUrl(),
    title,
    description,
    applicationName: "Canei Subirats ERP",
    icons: { icon: "/brand/icon.svg", apple: "/brand/icon.svg" },
    openGraph: {
      type: "website",
      siteName: "Canei Subirats ERP",
      title,
      description,
      locale: "es_ES",
      images: [
        { url: "/brand/og.png", width: 1200, height: 630, alt: "Canei Subirats ERP System" },
      ],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/brand/og.png"] },
    // A private system. Being indexed would put the login page — and the
    // company's name next to it — into search results for no benefit.
    robots: { index: false, follow: false },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
