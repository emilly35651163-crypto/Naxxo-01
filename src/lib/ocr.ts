// Ler o texto de prints (imagens) no próprio navegador, de graça (tesseract.js).
// O leitor só é carregado quando alguém usa (ele é grande).

/**
 * Deixa o print do jeito que o leitor lê melhor: largura padrão (aumenta os pequenos, diminui os enormes),
 * preto e branco com bastante contraste e sempre letra escura em fundo claro (prints no modo escuro são invertidos).
 */
async function prepararImagem(arquivo: File): Promise<Blob | File> {
  try {
    const imagem = await createImageBitmap(arquivo);
    const largura = 1400;
    const escala = largura / imagem.width;
    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = Math.min(Math.round(imagem.height * escala), 12000);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return arquivo;
    ctx.fillStyle = "#fff"; // fundo branco (prints com transparência)
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(imagem, 0, 0, canvas.width, canvas.height);

    // Tons de cinza; o fundo é o tom mais comum (a maior parte da tela é fundo)
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const p = pixels.data;
    const cinza = new Uint8ClampedArray(p.length / 4);
    const contagem = new Uint32Array(256);
    for (let i = 0; i < cinza.length; i++) {
      cinza[i] = 0.299 * p[i * 4] + 0.587 * p[i * 4 + 1] + 0.114 * p[i * 4 + 2];
      contagem[cinza[i]]++;
    }
    const fundo = contagem.indexOf(Math.max(...contagem));
    // O que está perto da cor do fundo vira branco; o texto (longe dela) fica escuro.
    // Assim o modo escuro (letra clara em fundo escuro) e textos coloridos viram letra preta em fundo branco.
    for (let i = 0; i < cinza.length; i++) {
      const v = 255 - Math.min(255, Math.abs(cinza[i] - fundo) * 2.2);
      p[i * 4] = p[i * 4 + 1] = p[i * 4 + 2] = v;
    }
    ctx.putImageData(pixels, 0, 0);
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
