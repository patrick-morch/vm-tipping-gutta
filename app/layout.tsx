import "./globals.css";
import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme";

export const metadata: Metadata = {
  metadataBase: new URL("https://vm-tipping-gutta.web.app"),
  title: "VM-tipping — Gutta",
  description: "Klubbens VM-tipping. Tipp kampene, følg ledertavla.",
  openGraph: {
    title: "VM-tipping — Gutta",
    description: "Tipp kampene, følg ledertavla og sluttspillet.",
    url: "https://vm-tipping-gutta.web.app",
    siteName: "VM-tipping — Gutta",
    locale: "nb_NO",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "VM-tipping — Gutta",
    description: "Tipp kampene, følg ledertavla og sluttspillet.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nb" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('vmt.tema');if(t!=='lys'&&t!=='mørk'){t=matchMedia('(prefers-color-scheme: dark)').matches?'mørk':'lys';}document.documentElement.dataset.theme=t==='mørk'?'dark':'light';}catch(e){document.documentElement.dataset.theme='dark';}})();`,
          }}
        />
      </head>
      <body className="font-sans">
        <div className="ambient" aria-hidden />
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
