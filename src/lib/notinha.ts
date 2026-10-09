// Ler a notinha do mercado (cupom fiscal / NFC-e) já passada pelo leitor de imagem, e o print do carrinho dos apps.
// O texto do leitor é bagunçado: o resultado sempre vai para uma lista que a pessoa confere antes de salvar.

import { lerNumero } from "./extrato";

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** O leitor confunde letras e números nos valores: "1O,5O" → "10,50", "l2,00" → "12,00" */
const consertarNumeros = (linha: string) =>
  linha.replace(/\b[\dOoIl]{1,5}[,.][\dOoIl]{2}\b/g, (m) => m.replace(/[Oo]/g, "0").replace(/[Il]/g, "1"));

const DINHEIRO = /(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2})(?![\d,])/g;
const valoresDa = (linha: string) => [...linha.matchAll(DINHEIRO)].map((m) => lerNumero(m[1]));

const capitalizar = (t: string) =>
  t
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());

export type ItemDaNotinha = { nome: string; quantidade: string; valor: number };
export type Notinha = { loja?: string; data?: string; total?: number; itens: ItemDaNotinha[] };

// Linhas do rodapé (não são produtos)
const RODAPE =
  /\btotal\b|subtotal|valor a pagar|troco|desconto|acrescimo|forma de pagamento|pagamento|dinheiro|cartao|credito|debito|\bpix\b|cpf|cnpj|tributo|icms|lei 12|aprox|consumidor|protocolo|chave de acesso|qtd\.? total|itens|caixa|operador|serie|emissao|via\b/;
// Começo de produto: número do item e/ou código de barras ("001 7891000315507 ARROZ…")
// O leitor troca dígitos por letras parecidas no código (0→O, 8→B, 6→G, 1→I/l, 5→S): aceita, se tiver dígitos suficientes
const INICIO_ITEM = /^\s*(\d{1,3}\s+)?([0-9OBGIlSZ]{6,14})\s+(?=\S*[a-z])/i;
const pareceCodigo = (c: string) => (c.match(/\d/g) ?? []).length >= 5;
// Quantidade comprada: a que vem antes do "X" do preço unitário ("2 UN X 9,49", "1,235 KG X 6,99"),
// não o tamanho do produto que está no nome ("ARROZ 5KG")
const QTD = /(\d+(?:[.,]\d{1,3})?)\s*(un|und|kg|g|l|lt|ml|pc|pct|cx|fd)\s*x\b/i;

/**
 * Cupom fiscal / NFC-e → produtos (nome, quantidade, valor total do produto), a loja, a data e o total da notinha.
 * Cada produto começa no código (às vezes com o número do item antes) e o valor dele é o último da linha
 * (ou da linha de baixo, quando a quantidade e o preço vêm embaixo: "2 UN X 4,99   9,98").
 */
export function lerNotinha(texto: string): Notinha {
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => consertarNumeros(l.trim()))
    .filter(Boolean);
  const itens: ItemDaNotinha[] = [];
  let total: number | undefined;
  let data: string | undefined;
  const loja = linhas
    .slice(0, 4)
    .find(
      (l) =>
        (l.match(/[a-z]/gi) ?? []).length >= 4 &&
        !/cnpj|cpf|cupom|documento|nfc|nota|danfe|endereco|rua|av\./i.test(semAcento(l)),
    );

  let atual: { nome: string; quantidade: string; valores: number[] } | null = null;
  const fechar = () => {
    if (atual && atual.valores.length) {
      const valor = atual.valores[atual.valores.length - 1];
      if (valor > 0 && atual.nome.length >= 2) itens.push({ nome: atual.nome, quantidade: atual.quantidade, valor });
    }
    atual = null;
  };

  for (const linha of linhas) {
    const t = semAcento(linha);
    if (!data) {
      const d = linha.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
      if (d) data = `${d[3]}-${d[2]}-${d[1]}`;
    }
    // Total da notinha
    if (/valor a pagar|valor total|^total\b|total r\$/.test(t)) {
      const v = valoresDa(linha);
      if (v.length) total = v[v.length - 1];
      fechar();
      continue;
    }
    const achado = linha.match(INICIO_ITEM);
    const inicio = achado && pareceCodigo(achado[2]) ? achado : null;
    if (inicio) {
      fechar();
      const resto = linha.slice(inicio[0].length);
      const qtd = resto.match(QTD);
      const nome = resto
        .replace(DINHEIRO, " ")
        .replace(/\b\d+(?:[.,]\d+)?\s*(un|und|kg|g|l|lt|ml|pc|pct|cx|fd)\s*x\b.*$/i, " ") // a quantidade × preço e o que vem depois
        .replace(/\s+x\s+.*$/i, " ")
        .replace(/\s(kg|un|und)\s*$/i, " ") // "BANANA PRATA KG" (vendido por quilo)
        .replace(/\b[ftin]\d{1,2}\b|\b\d{1,2}(?:[.,]\d+)?%/gi, " ") // códigos de imposto (F1, T03, 18%)
        .replace(/[^a-z0-9à-úç%.\-/ ]/gi, " ");
      atual = {
        nome: capitalizar(nome).slice(0, 50),
        quantidade: qtd ? `${qtd[1]} ${qtd[2].toLowerCase()}` : "",
        valores: valoresDa(resto),
      };
      continue;
    }
    // Linha de baixo do produto: quantidade × preço e o valor do produto
    if (atual && !RODAPE.test(t) && valoresDa(linha).length) {
      const qtd = linha.match(QTD);
      if (qtd && !atual.quantidade) atual.quantidade = `${qtd[1]} ${qtd[2].toLowerCase()}`;
      atual.valores.push(...valoresDa(linha));
      continue;
    }
    if (RODAPE.test(t)) fechar();
  }
  fechar();

  // Notinha sem código de barras (alguns cupons simples): "NOME DO PRODUTO .... 9,98"
  if (itens.length === 0)
    for (const linha of linhas) {
      const t = semAcento(linha);
      const v = valoresDa(linha);
      const nome = linha.replace(DINHEIRO, " ").replace(/[^a-zà-úç ]/gi, " ");
      if (!v.length || RODAPE.test(t) || (nome.match(/[a-z]/gi) ?? []).length < 3) continue;
      itens.push({
        nome: capitalizar(nome).slice(0, 50),
        quantidade: (linha.match(QTD) ?? [])[0]?.toLowerCase() ?? "",
        valor: v[v.length - 1],
      });
    }
  return { loja: loja ? capitalizar(loja.replace(/[^a-zà-úç0-9 &.-]/gi, " ")) : undefined, data, total, itens };
}

// ---------- Print do carrinho (Shein, Mercado Livre, Amazon…) ----------

export const LOJAS_APP: [string, RegExp][] = [
  ["Shein", /shein/],
  ["Mercado Livre", /mercado ?livre|mercadolivre|\bmeli\b/],
  ["Amazon", /amazon/],
  ["Shopee", /shopee/],
  ["AliExpress", /aliexpress|ali express/],
  ["Temu", /\btemu\b/],
  ["Magalu", /magalu|magazine luiza/],
];

/** Qual loja é o print (pelo texto da tela) */
export const lojaDoTexto = (texto: string) => LOJAS_APP.find(([, re]) => re.test(semAcento(texto)))?.[0];

// O que não é produto num carrinho
const NAO_E_PRODUTO =
  /subtotal|\btotal\b|frete|entrega|chega|cupom|desconto|economi|parcela|\d+\s*x\s*(de\s*)?r?\$|sem juros|\bpix\b|boleto|cashback|finalizar|comprar|continuar|selecionar|frete gratis|voce economiza|off\b|moedas|pontos|vendido por|enviado por|full\b|garantia/;
const QTD_CARRINHO = /qtd\.?:?\s*(\d{1,2})|quantidade:?\s*(\d{1,2})|\bx\s?(\d{1,2})\b|\b(\d{1,2})\s*(?:un|unidades?)\b/;

export type ItemDoCarrinho = { nome: string; valor: number; quantidade: number };

/**
 * Print do carrinho → produtos. Em cada linha com preço, o preço é o MENOR (o maior costuma ser o "de", riscado);
 * o nome está na própria linha ou na de cima.
 */
export function itensDoCarrinho(texto: string): ItemDoCarrinho[] {
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => consertarNumeros(l.trim()))
    .filter(Boolean);
  const itens: ItemDoCarrinho[] = [];
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const t = semAcento(linha);
    const v = valoresDa(linha).filter((x) => x > 0);
    if (!v.length || NAO_E_PRODUTO.test(t)) continue;
    const temLetras = (s: string) => (s.replace(DINHEIRO, "").match(/[a-zà-ú]/gi) ?? []).length >= 4;
    let nome = linha.replace(/r?\$\s*/gi, "").replace(DINHEIRO, " ");
    if (!temLetras(nome)) {
      // O nome está nas linhas de cima (as que não têm preço nem são avisos)
      const acima = [linhas[i - 1], linhas[i - 2]].find(
        (l) => l && !valoresDa(l).length && temLetras(l) && !NAO_E_PRODUTO.test(semAcento(l)),
      );
      if (!acima) continue;
      nome = acima;
    }
    const vizinhas = semAcento([linhas[i - 1], linha, linhas[i + 1]].filter(Boolean).join(" "));
    const q = vizinhas.match(QTD_CARRINHO);
    const quantidade = q ? Number(q[1] ?? q[2] ?? q[3] ?? q[4]) || 1 : 1;
    nome = nome
      .replace(/[|•·>›<‹©®™@#*_=~"“”]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (nome.length < 3) continue;
    // Preço de uma unidade: o menor da linha (o maior é o preço antigo, riscado)
    itens.push({ nome: nome.slice(0, 60), valor: Math.min(...v), quantidade });
  }
  return itens;
}
