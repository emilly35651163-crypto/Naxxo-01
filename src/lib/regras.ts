// A memória do NAXXO (docs/NOVO-SISTEMA.md, seção 5): a pessoa renomeia ou recategoriza uma vez, e vale para sempre.
// Cada item do extrato ganha uma "chave" (a descrição do banco limpa + o tipo). A regra guarda o que a pessoa escolheu.

import {
  atualizarCompra,
  atualizarLancamento,
  lerCompras,
  lerLancamentos,
  lerRegras,
  gravarRegra,
  marcarSoEste,
  type CompraCartao,
  type Lancamento,
  type Regra,
  type Tipo,
} from "./store";

import type { Extrato } from "./extrato";

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * "PIX ENVIADO - EMILLY S OLIVEIRA - ***.123.456-**" → "pix enviado emilly s oliveira"
 * "IFOOD *RESTAURANTE 12345 SAO PAULO" → "ifood restaurante"
 * Tira: CPF/CNPJ mascarado, números (documento, código), datas, horas, "parcela x/y", LTDA/S.A./ME/EIRELI, símbolos.
 */
export function chaveDaDescricao(descricao: string) {
  return semAcento(descricao)
    .replace(/parc(ela)?\.?\s*\d{1,2}\s*(\/|de)\s*\d{1,2}/g, " ")
    .replace(/[•*·]{2,}[\d.\-•*]*/g, " ") // ***.123.456-** e parecidos
    .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b|\b\d{1,2}:\d{2}\b/g, " ")
    .replace(/\d+/g, " ")
    .replace(/\b(ltda|s\.?\s?a\.?|me|eireli|epp|sao paulo|sp|rj|rio de janeiro|bh|br|brasil)\b/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 8)
    .join(" ");
}

export const chaveDoItem = (descricaoBanco: string, tipo: Tipo) => `${tipo}|${chaveDaDescricao(descricaoBanco)}`;

/** A regra que vale para este item (as "só este" repetidas não valem: a loja tem coisas diferentes) */
export function regraDe(descricaoBanco: string | undefined, tipo: Tipo, regras: Regra[] = lerRegras()) {
  if (!descricaoBanco) return undefined;
  const chave = chaveDoItem(descricaoBanco, tipo);
  if (chave.endsWith("|")) return undefined;
  return regras.find((r) => r.chave === chave && !r.variada && (r.nome || r.categoria));
}

/** Aplica a regra num item que vai entrar (nome e categoria da pessoa; certo, então não precisa revisar) */
export function comRegra<T extends { descricao: string; categoria: string; subcategoria?: string; revisar?: boolean }>(
  item: T,
  descricaoBanco: string,
  tipo: Tipo,
  regras?: Regra[],
): T {
  const r = regraDe(descricaoBanco, tipo, regras);
  if (!r) return item;
  return {
    ...item,
    descricao: r.nome ?? item.descricao,
    categoria: r.categoria ?? item.categoria,
    subcategoria: r.categoria ? r.subcategoria : item.subcategoria,
    revisar: undefined,
  };
}

export type Alcance = "todos" | "proximos" | "so-este";

/**
 * A pessoa mudou o nome/categoria de um item do extrato. Conforme o alcance:
 * - "todos": vira regra e muda também os antigos iguais;
 * - "proximos": vira regra (os antigos ficam como estão);
 * - "so-este": não vira regra (duas vezes na mesma chave = loja variada, a regra para de valer sozinha).
 */
export function aprender(
  item: { descricaoBanco: string; tipo: Tipo; nome: string; categoria: string; subcategoria?: string },
  alcance: Alcance,
) {
  const chave = chaveDoItem(item.descricaoBanco, item.tipo);
  if (chave.endsWith("|")) return 0;
  if (alcance === "so-este") {
    marcarSoEste(chave);
    return 0;
  }
  gravarRegra({ chave, nome: item.nome, categoria: item.categoria, subcategoria: item.subcategoria });
  if (alcance !== "todos") return 0;
  const mesma = (x: { descricaoBanco?: string }, tipo: Tipo) =>
    !!x.descricaoBanco && chaveDoItem(x.descricaoBanco, tipo) === chave;
  const mudar = { descricao: item.nome, categoria: item.categoria, subcategoria: item.subcategoria, revisar: undefined };
  const ls = lerLancamentos().filter((l: Lancamento) => mesma(l, l.tipo));
  ls.forEach((l) => atualizarLancamento(l.id, mudar));
  const cs = item.tipo === "saida" ? lerCompras().filter((c: CompraCartao) => mesma(c, "saida")) : [];
  cs.forEach((c) => atualizarCompra(c.id, mudar));
  return ls.length + cs.length;
}

/** Extrato lido → cada linha com as regras da pessoa (vem antes de tudo: a escolha dela ganha) */
export function aplicarRegras(e: Extrato): Extrato {
  const rs = lerRegras();
  if (rs.length === 0) return e;
  return { ...e, linhas: e.linhas.map((l) => comRegra(l, l.original, l.tipo, rs)) };
}
