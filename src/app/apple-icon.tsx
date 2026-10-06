import { gerarIconeApp } from "@/lib/iconeApp";

// Ícone da tela inicial do iPhone (quando a pessoa "adiciona à tela de início")
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return gerarIconeApp(180);
}
