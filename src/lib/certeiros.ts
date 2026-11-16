// Reconhecimentos certeiros (docs/NOVO-SISTEMA.md, etapa 3): o que dá para saber sem dúvida, depois de importar.
// Transferência entre minhas contas, Pix para mim mesma e Pix no crédito não são gasto nem ganho.

import {
  atualizarCompra,
  atualizarLancamento,
  lerCompras,
  lerLancamentos,
  lerPerfil,
  salvarPerfil,
  virarTransferencia,
  type Lancamento,
} from "./store";
import { classificarPelaDescricao, quemE } from "./extrato";

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Só letras, separadas por um espaço (para comparar nomes palavra por palavra) */
const soLetras = (t: string) =>
  ` ${semAcento(t)
    .replace(/[^a-z]+/g, " ")
    .trim()} `;
const diasEntre = (a: string, b: string) =>
  Math.abs(new Date(`${a}T12:00:00`).getTime() - new Date(`${b}T12:00:00`).getTime()) / 864e5;
const textoDe = (l: Lancamento) => `${l.descricao} ${l.descricaoBanco ?? ""}`;

/** Parece transferência (Pix, TED, DOC, "transferência")? */
const pareceTransferencia = (l: Lancamento) => /\bpix\b|\bted\b|\bdoc\b|transf/.test(semAcento(textoDe(l)));

/** Diz no próprio texto que é entre contas da mesma pessoa */
const MESMA_TITULARIDADE = /mesma titularidade|entre contas|conta propria|contas proprias|transferencia propria/;

/**
 * Pix no crédito: o banco põe dinheiro do cartão de crédito na conta para pagar um Pix.
 * Nubank: "Valor adicionado na conta por cartão de crédito"; BB: "Pagamento Pix Cartão Créd".
 * Não é ganho: o gasto é o Pix que sai em seguida (e a conta vem na fatura).
 */
const PIX_NO_CREDITO = /valor adicionado (na conta )?(por|para) (cartao|pix)|pix no credito|pagamento pix cartao cred/;

/**
 * O nome que o banco escreveu, a partir do primeiro nome dela:
 * "Transferência enviada pelo Pix - EMILLY CAVALCANTE C DE OLIVEIRA - •••.397…" → "emilly cavalcante c de oliveira"
 * "01/09 07:33 51339732840 Emilly Cavalca - Pix - Recebido" → "emilly cavalca". Precisa de pelo menos 2 palavras.
 */
function nomeNoTexto(texto: string, primeiro: string) {
  const trecho = semAcento(texto)
    .split(/\s+-\s+/)
    .find((p) => soLetras(p).includes(` ${primeiro} `));
  if (!trecho) return null;
  const nome = soLetras(trecho.slice(trecho.indexOf(primeiro))).trim();
  return nome.split(" ").length >= 2 ? nome : null;
}

/**
 * É para (ou de) ela mesma?
 * - o texto diz "mesma titularidade";
 * - aparece um dos nomes dela já aprendidos ("emilly cavalca", inteiro, palavra por palavra);
 * - aparece o nome completo do perfil (nome e sobrenome);
 * - com `soPrimeiro` (quando a outra ponta, mesmo valor e dia, está em outra conta dela), o primeiro nome basta.
 */
function ehParaMim(l: Lancamento, partesDoNome: string[], meusNomes: string[], soPrimeiro = false) {
  const texto = soLetras(textoDe(l));
  if (MESMA_TITULARIDADE.test(texto)) return true;
  if (meusNomes.some((n) => texto.includes(` ${n} `))) return true;
  if (partesDoNome.length === 0) return false;
  if (soPrimeiro) return texto.includes(` ${partesDoNome[0]} `);
  return partesDoNome.length >= 2 && partesDoNome.every((p) => texto.includes(` ${p} `));
}

/**
 * Pix no crédito, as três pontas juntas: a entrada na conta (dinheiro do cartão), o Pix que saiu (o gasto de verdade)
 * e a compra na fatura do cartão. A compra fica ligada à entrada: o gasto conta uma vez só (o Pix) e, da fatura,
 * só os juros (o que passou do valor do Pix). Mesmo banco, até 3 dias, valor da fatura entre o do Pix e 60% a mais.
 */
function ligarPixNoCredito() {
  const entradas = lerLancamentos().filter((l) => l.transferenciaId?.startsWith("credito-"));
  const usadas = new Set(lerCompras().map((c) => c.pixCreditoId));
  let ligou = 0;
  for (const c of lerCompras()) {
    if (c.pixCreditoId || !/\bpix\b/.test(semAcento(`${c.descricao} ${c.descricaoBanco ?? ""}`))) continue;
    const e = entradas
      .filter(
        (e) =>
          !usadas.has(e.id) &&
          e.contaId === c.cartaoId &&
          c.valorTotal >= e.valor - 0.01 &&
          c.valorTotal <= e.valor * 1.6 &&
          diasEntre(e.data, c.data) <= 3,
      )
      .sort((a, b) => Math.abs(a.valor - c.valorTotal) - Math.abs(b.valor - c.valorTotal))[0];
    if (!e) continue;
    usadas.add(e.id);
    atualizarCompra(c.id, { pixCreditoId: e.id, revisar: undefined });
    ligou++;
  }
  return ligou;
}

/**
 * Dinheiro de uma EMPRESA (CNPJ, LTDA, S/A…; MEI conta como pessoa) que cai em 2 meses ou mais: é salário
 * (ex.: o estágio). Só mexe no que ainda está como "Outros" ou "Recebido de pessoas" (o que a pessoa escolheu fica).
 */
function salarioDeEmpresas() {
  const CNPJ = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/;
  const pagador = (t: string) => CNPJ.exec(t)?.[0] ?? soLetras(t).trim();
  const porPagador = new Map<string, Lancamento[]>();
  for (const l of lerLancamentos()) {
    if (!l.importado || l.tipo !== "entrada" || l.transferenciaId || l.fonteId || !l.descricaoBanco || l.valor < 100) continue;
    if (!["Outros", "Recebido de pessoas"].includes(l.categoria) || quemE(l.descricaoBanco) !== "empresa") continue;
    const k = pagador(l.descricaoBanco);
    porPagador.set(k, [...(porPagador.get(k) ?? []), l]);
  }
  let achou = 0;
  for (const ls of porPagador.values()) {
    if (new Set(ls.map((l) => l.data.slice(0, 7))).size < 2) continue;
    for (const l of ls) atualizarLancamento(l.id, { categoria: "Salário", subcategoria: "Salário", revisar: undefined });
    achou += ls.length;
  }
  return achou;
}

/**
 * O que veio do extrato e ficou "para revisar": se o banco de palavras (que vai melhorando) agora tem certeza,
 * já arruma a categoria. O que a pessoa escolheu nunca muda (só mexe no que ainda está para revisar).
 */
function reclassificarPendentes() {
  let arrumou = 0;
  for (const l of lerLancamentos()) {
    if (!l.importado || !l.revisar || l.transferenciaId || !l.descricaoBanco) continue;
    const c = classificarPelaDescricao(l.descricaoBanco, l.tipo);
    if (!c.certo) continue;
    atualizarLancamento(l.id, { categoria: c.categoria, subcategoria: c.subcategoria, revisar: undefined });
    arrumou++;
  }
  return arrumou;
}

/**
 * Liga as duas pontas de dinheiro passando entre as contas da pessoa (sai de uma, entra na outra, mesmo valor, até 2 dias),
 * marca o Pix para ela mesma como transferência e o Pix no crédito como dinheiro que veio do cartão.
 * Aprende como cada banco escreve o nome dela. Só olha o que veio do extrato.
 * Pode rodar sempre: o que já é transferência não muda. Devolve quantas achou.
 */
export function reconhecerTransferencias() {
  const perfil = lerPerfil();
  const nome = semAcento(perfil.nome ?? "")
    .split(/\s+/)
    .filter((p) => p.length >= 3);
  const primeiro = nome[0];
  const meusNomes = new Set(perfil.meusNomes ?? []);
  const aprender = (texto?: string) => {
    const n = primeiro && texto ? nomeNoTexto(texto, primeiro) : null;
    if (n) meusNomes.add(n);
  };
  let achou = 0;
  const livres = () => lerLancamentos().filter((l) => !l.transferenciaId && l.contaId && l.categoria !== "Fatura do cartão");

  // O que já foi ligado entre as contas dela ensina como os bancos escrevem o nome dela
  for (const l of lerLancamentos())
    if (l.transferenciaId && !l.transferenciaId.startsWith("propria-") && !l.transferenciaId.startsWith("credito-"))
      aprender(l.descricaoBanco);

  for (const s of livres().filter((l) => l.importado && l.tipo === "saida" && pareceTransferencia(l))) {
    const atual = lerLancamentos().find((l) => l.id === s.id);
    if (!atual || atual.transferenciaId) continue;
    const nomes = [...meusNomes];
    const e = livres().find(
      (l) =>
        l.tipo === "entrada" &&
        l.contaId !== s.contaId &&
        Math.abs(l.valor - s.valor) < 0.01 &&
        diasEntre(l.data, s.data) <= 2 &&
        // Mesmo valor e dia não bastam (Pix para a Maria e Pix do João podem coincidir): precisa ser para ela mesma
        (ehParaMim(s, nome, nomes, true) || ehParaMim(l, nome, nomes, true)),
    );
    if (e) {
      aprender(s.descricaoBanco);
      aprender(e.descricaoBanco);
      virarTransferencia(s.id, s.contaId!, e.contaId!, s.valor, s.data, "Transferência entre contas");
      achou++;
    }
  }

  // Pix/TED para mim mesma, sem a outra ponta no app (a outra conta não está cadastrada, ex.: PicPay): uma ponta só
  const nomes = [...meusNomes];
  for (const l of livres().filter((x) => x.importado && pareceTransferencia(x) && ehParaMim(x, nome, nomes))) {
    atualizarLancamento(l.id, {
      categoria: "Transferência",
      subcategoria: undefined,
      transferenciaId: `propria-${l.id}`,
      descricao: l.tipo === "saida" ? "Transferência para mim" : "Transferência de mim",
      revisar: undefined,
    });
    achou++;
  }

  // Pix no crédito: o dinheiro que entrou veio do cartão (não é ganho)
  for (const l of livres().filter((x) => x.importado && x.tipo === "entrada" && PIX_NO_CREDITO.test(semAcento(textoDe(x))))) {
    atualizarLancamento(l.id, {
      categoria: "Transferência",
      subcategoria: undefined,
      transferenciaId: `credito-${l.id}`,
      descricao: "Pix no crédito (veio do cartão)",
      revisar: undefined,
    });
    achou++;
  }

  achou += ligarPixNoCredito();
  achou += reclassificarPendentes();
  achou += salarioDeEmpresas();

  const aprendidos = [...meusNomes].sort();
  if (aprendidos.join("|") !== [...(perfil.meusNomes ?? [])].sort().join("|"))
    salvarPerfil({ ...lerPerfil(), meusNomes: aprendidos });
  return achou;
}
