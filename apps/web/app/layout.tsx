import type { Metadata } from "next";
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
 * `metadataBase` is computed per request rather than fixed at build time,
 * because the address changes: an sslip.io name today, the company's own domain
 * when it transfers. A hardcoded one would produce a preview pointing at an
 * image on a host that no longer serves it.
 */
function siteUrl(): URL {
  const host = process.env.PUBLIC_HOSTNAME?.trim();
  if (host) return new URL(`https://${host}`);
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  // Last resort. Relative image paths still work in most crawlers, so an
  // imperfect base is better than throwing during metadata generation.
  return new URL(configured || "http://localhost:3000");
}

export function generateMetadata(): Metadata {
  const title = "Canei Subirats — ERP System";
  const description =
    "Presupuestos, obras, facturación y tesorería en un solo sitio. " +
    "Acceso privado para el equipo de Canei Subirats.";
  return {
    metadataBase: siteUrl(),
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
