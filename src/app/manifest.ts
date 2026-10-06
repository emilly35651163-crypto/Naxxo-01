import type { MetadataRoute } from "next";

// Deixa o app instalável no celular ("Adicionar à tela de início"), abrindo sem a barra do navegador.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NAXXO Finanças",
    short_name: "NAXXO",
    description: "Seu controle financeiro pessoal: contas, metas, mercado e previsão do mês.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "pt-BR",
    background_color: "#0b0f1a",
    theme_color: "#0b0f1a",
    icons: [
      { src: "/icone-app/192", sizes: "192x192", type: "image/png" },
      { src: "/icone-app/512", sizes: "512x512", type: "image/png" },
      { src: "/icone-app/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
