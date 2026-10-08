import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { TEMAS } from "@/lib/temas";

// Aplica o tema salvo antes de a página aparecer (sem piscar o tema padrão ao abrir)
const BASES = Object.fromEntries(TEMAS.map((t) => [t.id, [t.base, t.cor === "NAXXO" ? "" : t.id]]));
const SCRIPT_TEMA = `try{var p=JSON.parse(localStorage.getItem("naxxo:preferencias")||"{}"),b=${JSON.stringify(BASES)}[p.tema],r=document.documentElement;r.dataset.tema=b?b[0]:(p.tema==="auto"&&matchMedia("(prefers-color-scheme: light)").matches?"claro":"escuro");if(b&&b[1])r.dataset.paleta=b[1]}catch(e){}`;

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NAXXO Finanças",
  description: "Controle financeiro pessoal",
};

export const viewport: Viewport = {
  themeColor: "#0b0f1a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${montserrat.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="min-h-full font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
