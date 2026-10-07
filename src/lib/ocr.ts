// Ler o texto de prints (imagens) no próprio navegador, de graça (tesseract.js).
// O leitor só é carregado quando alguém usa (ele é grande).

/** Deixa o print num tamanho padrão (prints de celular são enormes): lê mais rápido e de um jeito mais previsível. */
async function prepararImagem(arquivo: File): Promise<Blob | File> {
  try {
    const imagem = await createImageBitmap(arquivo);
    const largura = Math.min(imagem.width, 1200);
    const escala = largura / imagem.width;
    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = Math.round(imagem.height * escala);
    const ctx = canvas.getContext("2d");
    if (!ctx) return arquivo;
    ctx.fillStyle = "#fff"; // fundo branco (prints com transparência)
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imagem, 0, 0, canvas.width, canvas.height);
    return await new Promise((ok) => canvas.toBlob((b) => ok(b ?? arquivo), "image/png"));
  } catch {
    return arquivo; // formato que o navegador não abre: tenta assim mesmo
  }
}

/**
 * Lê o texto de cada imagem. Lê a tela linha por linha (nome e valor ficam juntos, mesmo em colunas).
 * Se `achou` disser que não serviu, tenta de novo no modo automático.
 */
export async function lerTextoDosPrints(
  arquivos: File[],
  aoAvancar: (texto: string) => void,
  achou: (texto: string) => boolean = () => true,
): Promise<string[]> {
  const { createWorker, PSM } = await import("tesseract.js");
  aoAvancar("Preparando o leitor de prints…");
  const leitor = await createWorker("por");
  const textos: string[] = [];
  try {
    for (let i = 0; i < arquivos.length; i++) {
      aoAvancar(`Lendo o print ${i + 1} de ${arquivos.length}…`);
      const imagem = await prepararImagem(arquivos[i]);
      await leitor.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: "1" });
      let { data } = await leitor.recognize(imagem);
      if (!achou(data.text)) {
        await leitor.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
        ({ data } = await leitor.recognize(imagem));
      }
      textos.push(data.text);
    }
  } finally {
    await leitor.terminate();
  }
  return textos;
}

export const ehImagem = (arquivo: File) => arquivo.type.startsWith("image/") || /\.(png|jpe?g|heic|webp)$/i.test(arquivo.name);
