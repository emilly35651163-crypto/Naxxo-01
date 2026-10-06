import { gerarIconeApp } from "@/lib/iconeApp";

// /icone-app/192 e /icone-app/512: ícones do app instalado (manifest)
export async function GET(_request: Request, { params }: { params: Promise<{ tamanho: string }> }) {
  const { tamanho } = await params;
  const lado = [192, 512].includes(Number(tamanho)) ? Number(tamanho) : 192;
  return gerarIconeApp(lado);
}
