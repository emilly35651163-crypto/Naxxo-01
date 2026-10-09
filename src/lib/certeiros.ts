// Reconhecimentos certeiros (docs/NOVO-SISTEMA.md, etapa 3): o que dá para saber sem dúvida, depois de importar.
// Transferência entre minhas contas e Pix para mim mesma não são gasto nem ganho.

import { atualizarLancamento, lerLancamentos, lerPerfil, virarTransferencia, type Lancamento } from "./store";

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const diasEntre = (a: string, b: string) =>
  Math.abs(new Date(`${a}T12:00:00`).getTime() - new Date(`${b}T12:00:00`).getTime()) / 864e5;

/** Parece transferência (Pix, TED, DOC, "transferência")? */
const pareceTransferencia = (l: Lancamento) =>
  /\bpix\b|\bted\b|\bdoc\b|transf/.test(semAcento(`${l.descricao} ${l.descricaoBanco ?? ""}`));

/** Diz no próprio texto que é entre contas da mesma pessoa */
const MESMA_TITULARIDADE = /mesma titularidade|entre contas|conta propria|contas proprias|transferencia propria/;

/**
 * O nome da pessoa aparece na descrição? Sozinho (sem a outra ponta), só vale com nome e sobrenome; com a outra ponta
 * (mesmo valor e dia em outra conta dela), o primeiro nome já basta.
 */
function ehParaMim(l: Lancamento, partesDoNome: string[], minimo = 2) {
  const texto = semAcento(`${l.descricao} ${l.descricaoBanco ?? ""}`);
  if (MESMA_TITULARIDADE.test(texto)) return true;
  if (partesDoNome.length < minimo) return false;
  const palavras = new Set(texto.split(/[^a-z]+/));
  return (minimo === 1 ? partesDoNome.slice(0, 1) : partesDoNome).every((p) => palavras.has(p));
}

/**
 * Liga as duas pontas de dinheiro passando entre as contas da pessoa (sai de uma, entra na outra, mesmo valor, até 2 dias)
 * e marca o Pix para ela mesma (com o nome completo dela) como transferência. Só olha o que veio do extrato.
 * Pode rodar sempre: o que já é transferência não muda. Devolve quantas achou.
 */
export function reconhecerTransferencias() {
  const nome = semAcento(lerPerfil().nome ?? "")
    .split(/\s+/)
    .filter((p) => p.length >= 3);
  let achou = 0;
  const livres = () => lerLancamentos().filter((l) => !l.transferenciaId && l.contaId && l.categoria !== "Fatura do cartão");

  for (const s of livres().filter((l) => l.importado && l.tipo === "saida" && pareceTransferencia(l))) {
    const atual = lerLancamentos().find((l) => l.id === s.id);
    if (!atual || atual.transferenciaId) continue;
    const e = livres().find(
      (l) =>
        l.tipo === "entrada" &&
        l.contaId !== s.contaId &&
        Math.abs(l.valor - s.valor) < 0.01 &&
        diasEntre(l.data, s.data) <= 2 &&
        // Mesmo valor e dia não bastam (Pix para a Maria e Pix do João podem coincidir): precisa ser para ela mesma
        (ehParaMim(s, nome, 1) || ehParaMim(l, nome, 1)),
    );
    if (e) {
      virarTransferencia(s.id, s.contaId!, e.contaId!, s.valor, s.data, "Transferência entre contas");
      achou++;
    }
  }

  // Pix/TED para mim mesma, sem a outra ponta no app (a outra conta não está cadastrada): uma ponta só
  for (const l of livres().filter((x) => x.importado && pareceTransferencia(x) && ehParaMim(x, nome))) {
    atualizarLancamento(l.id, {
      categoria: "Transferência",
      subcategoria: undefined,
      transferenciaId: `propria-${l.id}`,
      descricao: l.tipo === "saida" ? "Transferência para mim" : "Transferência de mim",
      revisar: undefined,
    });
    achou++;
  }
  return achou;
}
