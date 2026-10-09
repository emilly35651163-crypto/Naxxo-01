// Ler o texto do PDF do extrato no próprio navegador (pdf.js, da Mozilla). O arquivo não sai do aparelho.
// O PDF não tem "linhas": cada pedaço de texto tem uma posição. Aqui os pedaços da mesma altura viram uma linha,
// da esquerda para a direita, com espaços largos onde havia colunas (data · descrição · valor · saldo).

export class PdfComSenha extends Error {}

type Pedaco = { x: number; y: number; w: number; texto: string };

export async function linhasDoPdf(arquivo: File, senha?: string): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const dados = new Uint8Array(await arquivo.arrayBuffer());
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: dados, password: senha }).promise;
  } catch (e) {
    // Muitos bancos protegem o PDF com senha (os primeiros números do CPF, a data de nascimento…)
    if (e instanceof Error && e.name === "PasswordException") throw new PdfComSenha(e.message);
    throw e;
  }
  const linhas: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n);
    const conteudo = await pagina.getTextContent();
    const pedacos: Pedaco[] = [];
    for (const item of conteudo.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      pedacos.push({ x: item.transform[4], y: item.transform[5], w: item.width, texto: item.str });
    }
    // Mesma altura (com 3 pontos de folga) = mesma linha; de cima para baixo
    pedacos.sort((a, b) => b.y - a.y || a.x - b.x);
    const grupos: Pedaco[][] = [];
    for (const p of pedacos) {
      const g = grupos.find((x) => Math.abs(x[0].y - p.y) <= 3);
      if (g) g.push(p);
      else grupos.push([p]);
    }
    for (const g of grupos.sort((a, b) => b[0].y - a[0].y)) {
      g.sort((a, b) => a.x - b.x);
      let texto = "";
      let fim = -Infinity;
      for (const p of g) {
        // Buraco grande entre um pedaço e outro = outra coluna: separa com "  |  "
        const buraco = p.x - fim;
        texto += !texto ? p.texto : buraco > 12 ? `  |  ${p.texto}` : buraco > 1.5 ? ` ${p.texto}` : p.texto;
        fim = p.x + p.w;
      }
      linhas.push(texto.replace(/\s+/g, " ").trim());
    }
  }
  return linhas;
}
