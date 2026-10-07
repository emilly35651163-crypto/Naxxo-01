// Contas do Mercado: quando cada item acaba, quanto ainda resta e o que entra na previsão de cada mês.

import {
  CATEGORIAS_MERCADO,
  UNIDADES_DURACAO,
  type CategoriaMercado,
  type ItemMercado,
  type OpcaoMercado,
  type UnidadeDuracao,
  semAcento,
} from "./store";
import { dataDoRecebimento, diasEntre, hojeISO, mesAtual, somarDias } from "./formato";
import { DIAS_POR_UNIDADE } from "./duracao";

export { melhorUnidade } from "./duracao";

/** Quantos dias dura (2 meses = 60 dias), ou null se ainda não sabe. */
export function duracaoEmDias(item: { duracao: number | null; unidade: UnidadeDuracao }) {
  if (!item.duracao) return null;
  return Math.max(item.duracao * DIAS_POR_UNIDADE[item.unidade], 1);
}

/** "2 meses", "1 semana" */
export function descreverDuracao(duracao: number, unidade: UnidadeDuracao) {
  const u = UNIDADES_DURACAO.find((x) => x.id === unidade)!;
  return `${duracao} ${duracao === 1 ? u.singular : u.nome}`;
}

export type EstadoItem = "acabou" | "acabando" | "semana" | "ok" | "sem-prazo" | "programado";

/** Como está o item hoje: quando acaba, quantos dias faltam, quanto ainda resta (0 a 1). */
export function situacaoDoItem(item: ItemMercado) {
  // Compra programada para o futuro: o item ainda nem chegou
  if (item.ultimaCompra > hojeISO()) {
    return { acabaEm: null, faltam: null, resta: null, estado: "programado" as EstadoItem, diasDeUso: 0 };
  }
  const dias = duracaoEmDias(item);
  if (dias === null) {
    return {
      acabaEm: null,
      faltam: null,
      resta: null,
      estado: "sem-prazo" as EstadoItem,
      diasDeUso: diasEntre(item.ultimaCompra, hojeISO()),
    };
  }
  const acabaEm = somarDias(item.ultimaCompra, dias);
  const faltam = diasEntre(hojeISO(), acabaEm);
  const resta = Math.min(Math.max(faltam / dias, 0), 1);
  const estado: EstadoItem = faltam < 0 ? "acabou" : faltam <= 3 ? "acabando" : faltam <= 7 ? "semana" : "ok";
  return { acabaEm, faltam, resta, estado, diasDeUso: diasEntre(item.ultimaCompra, hojeISO()) };
}

/**
 * Quantas vezes o item precisa ser reposto num mês.
 * Itens que já acabaram e não foram recomprados contam no mês atual. Sem duração, não entra na previsão.
 */
export function reposicoesNoMes(item: ItemMercado, mes: string) {
  const dias = duracaoEmDias(item);
  if (!item.repor || dias === null || mes < mesAtual()) return 0;
  const inicio = `${mes}-01`;
  const fim = dataDoRecebimento("31", mes);
  let data = somarDias(item.ultimaCompra, dias);
  if (data < hojeISO()) data = hojeISO(); // já acabou: precisa repor agora
  let vezes = 0;
  while (data <= fim) {
    if (data >= inicio) vezes++;
    data = somarDias(data, dias);
  }
  return vezes;
}

/** As datas em que o item vai precisar ser reposto, de hoje até `ate` (para o calendário de projeção). */
export function datasDeReposicao(item: ItemMercado, ate: string) {
  const dias = duracaoEmDias(item);
  if (!item.repor || dias === null) return [];
  const datas: string[] = [];
  let data = somarDias(item.ultimaCompra, dias);
  if (data < hojeISO()) data = hojeISO();
  while (data <= ate) {
    datas.push(data);
    data = somarDias(data, dias);
  }
  return datas;
}

/** O que o mercado deve custar no mês (itens que vão acabar e precisam ser repostos). */
export function previsaoDoMes(itens: ItemMercado[], mes: string) {
  const lista = itens.map((item) => ({ item, vezes: reposicoesNoMes(item, mes) })).filter((x) => x.vezes > 0);
  return { lista, total: lista.reduce((t, x) => t + x.item.valor * x.vezes, 0) };
}

export type OpcaoProduto = {
  nome: string;
  icone: string;
  categoria: CategoriaMercado;
  quantidade: string;
  duracao: number | null;
  unidade: UnidadeDuracao;
  preco?: number; // último preço, se já comprou
  daDespensa: boolean;
};

/**
 * Todos os produtos que dá para escolher: primeiro os da despensa (com o último preço),
 * depois os que a pessoa criou e por último as sugestões prontas. Sem repetir nomes.
 */
export function todasAsOpcoes(despensa: ItemMercado[], criadas: OpcaoMercado[]): OpcaoProduto[] {
  const vistos = new Set<string>();
  const lista: OpcaoProduto[] = [];
  const incluir = (o: OpcaoProduto) => {
    const chave = semAcento(o.nome);
    if (vistos.has(chave)) return;
    vistos.add(chave);
    lista.push(o);
  };
  despensa.forEach((i) => incluir({ ...i, preco: i.valor, daDespensa: true }));
  criadas.forEach((o) => incluir({ ...o, duracao: null, unidade: "meses", daDespensa: false }));
  return lista;
}

/** Filtra as opções pelo que foi digitado e pela categoria escolhida. */
/** Busca sem acento: "acucar" e "açu" acham "Açúcar". */
export function filtrarOpcoes(opcoes: OpcaoProduto[], busca: string, categoria: CategoriaMercado | null, tirar: string[] = []) {
  const termo = semAcento(busca);
  const fora = new Set(tirar.map(semAcento));
  return opcoes.filter(
    (o) =>
      !fora.has(semAcento(o.nome)) && (!categoria || o.categoria === categoria) && (!termo || semAcento(o.nome).includes(termo)),
  );
}

export function iconeDaCategoriaMercado(categoria: CategoriaMercado) {
  return CATEGORIAS_MERCADO.find((c) => c.id === categoria)?.icone ?? "🛍️";
}

// Quanto dura: as opções rápidas (o mesmo em todo o Mercado)
export const DURACOES: { rotulo: string; duracao: string; unidade: UnidadeDuracao }[] = [
  { rotulo: "15 dias", duracao: "15", unidade: "dias" },
  { rotulo: "1 mês", duracao: "1", unidade: "meses" },
  { rotulo: "2 meses", duracao: "2", unidade: "meses" },
  { rotulo: "3 meses", duracao: "3", unidade: "meses" },
];
