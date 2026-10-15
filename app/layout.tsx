import type { Metadata, Viewport } from "next";
import { Anton, Geist, Geist_Mono } from "next/font/google";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { CursorRing } from "@/components/motion/cursor";
import { ToastProvider } from "@/components/ui/toast";
import { siteConfig } from "@/config/site";
import { getSiteSettings } from "@/lib/data/settings";
import { siteUrl } from "@/lib/env";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/* One weight of one condensed face carries all the display type. */
const anton = Anton({
  variable: "--font-anton",
  weight: "400",
  // latin-ext carries the rupee sign used in the prize figure.
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const title = `${siteConfig.name} — ${siteConfig.tagline}`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: title, template: `%s · ${siteConfig.name}` },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title,
    description: siteConfig.description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description: siteConfig.description,
  },
};

export const viewport: Viewport = {
  themeColor: "#060608",
  colorScheme: "dark",
};

/**
 * Decides, before first paint, whether the opening sequence plays: only on the
 * home page, once per browser session, and never with reduced motion. Without
 * JavaScript the attribute is never set, so the intro simply does not exist.
 */
const introScript = `try{var d=document.documentElement;if(location.pathname==="/"&&!sessionStorage.getItem("dsd-intro")&&!matchMedia("(prefers-reduced-motion: reduce)").matches){d.setAttribute("data-intro","play");sessionStorage.setItem("dsd-intro","1")}}catch(e){}`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const settings = await getSiteSettings();
  const registrationOpen = settings.registrationStatus === "open";

  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      // The intro script may add data-intro before React hydrates.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${anton.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <script dangerouslySetInnerHTML={{ __html: introScript }} />
        {/* Scroll-reveal content starts hidden; keep it visible without JS. */}
        <noscript>
          <style>{`[data-reveal]{opacity:1!important;transform:none!important;clip-path:none!important}`}</style>
        </noscript>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[90] focus:rounded-[3px] focus:bg-lime focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-[#060608]"
        >
          Skip to content
        </a>
        <ToastProvider>
          <Header registrationOpen={registrationOpen} />
          <main id="main" className="flex-1 pt-16">
            {children}
          </main>
          <Footer />
        </ToastProvider>
        <CursorRing />
        <div aria-hidden="true" className="grain" />
      </body>
    </html>
  );
}
