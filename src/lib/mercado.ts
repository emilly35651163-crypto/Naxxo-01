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
  { rotulo: "1 semana", duracao: "1", unidade: "semanas" },
  { rotulo: "15 dias", duracao: "15", unidade: "dias" },
  { rotulo: "1 mês", duracao: "1", unidade: "meses" },
  { rotulo: "2 meses", duracao: "2", unidade: "meses" },
  { rotulo: "3 meses", duracao: "3", unidade: "meses" },
];

// ---------- Colar uma lista (ex.: a nota do mercado) ----------

/** Adivinha a categoria pelo nome (dá para mudar depois). */
const PALAVRAS: [CategoriaMercado, RegExp][] = [
  [
    "carnes",
    /bacon|lingui[cç]a|calabresa|sobrecoxa|coxa|bisteca|frango|carne|alcatra|patinho|costela|picanha|peixe|til[aá]pia|hamb[uú]rguer|salsicha/i,
  ],
  ["laticinios", /queijo|presunto|peito de peru|mortadela|manteiga|margarina|leite|iogurte|requeij|nata|creme de leite/i],
  [
    "hortifruti",
    /alface|tomat|alho|cebola|batata|banana|ma[cç][aã]|laranja|lim[aã]o|cenoura|fruta|verdura|couve|piment|mam[aã]o|uva|abacate/i,
  ],
  ["higiene", /sabonete|pasta de dente|creme dental|escova|shampoo|condicionador|desodorante|papel higi|absorvente|fio dental/i],
  ["limpeza", /sab[aã]o|detergente|amaciante|desinfetante|[aá]gua sanit|esponja|saco de lixo|multiuso|lustra/i],
  ["bebidas", /suco|refrigerante|refri|[aá]gua mineral|cerveja|vinho|ch[aá] gelado|energ[eé]tico/i],
  ["pet", /ra[cç][aã]o|areia do gato|petisco/i],
  ["beleza", /hidratante|protetor solar|maquiagem|perfume|esmalte/i],
];

export function categoriaPeloNome(nome: string): CategoriaMercado {
  return PALAVRAS.find(([, re]) => re.test(nome))?.[0] ?? "alimentos";
}

export type ItemColado = {
  nome: string;
  categoria: CategoriaMercado;
  qtd: string;
  unidadeQtd: "un" | "kg";
  precoUnidade: number;
  total: number;
};

const num = (t: string) => Number(t.replace(/\./g, "").replace(",", "."));
const texto = (n: number) => String(Math.round(n * 1000) / 1000).replace(".", ",");

/**
 * Lê linhas como "5kg Arroz 24,99", "4 Sabonete de 5,88", "2 pacotinhos Bacon 14,99 cada", "1,5kg de sobrecoxa 25,48".
 * - `precoDaLinha` (padrão, como na nota): o número é o total da linha. Sem ele, "de 5,88" / "cada" é o preço de cada unidade.
 * - Peso em carnes e hortifrúti vira preço por kg; nos outros (pacote de 5 kg de arroz), o peso vai no nome.
 * Itens repetidos são somados.
 */
export function lerListaColada(textoColado: string, precoDaLinha = true): ItemColado[] {
  const itens: ItemColado[] = [];
  for (const bruta of textoColado.split(/\r?\n/)) {
    let linha = bruta.trim();
    if (!linha) continue;
    const preco = linha.match(/(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2})\s*(cada|und|un)?\s*$/i);
    if (!preco) continue;
    let valor = num(preco[1].includes(",") ? preco[1] : preco[1].replace(".", ","));
    // Na nota do mercado, o número já é o total da linha; "de cada unidade" multiplica pela quantidade
    let porUnidade = !precoDaLinha && !!preco[2] && /cada/i.test(preco[2]);
    linha = linha.slice(0, preco.index).trim();
    if (/\sde$/i.test(linha)) {
      porUnidade = !precoDaLinha;
      linha = linha.replace(/\s+de$/i, "").trim();
    }
    // Quantidade e medida no começo: "5kg", "300g", "2 und", "2 pacotinhos", "pote de", "1,5kg de"
    const q = linha.match(
      /^(\d+(?:[.,]\d+)?)?\s*(kg|g|ml|l|litros?|und|un|unid|pacotinhos?|pacotes?|potes?|bandejas?)?\.?\s+(?:de\s+)?/i,
    );
    let quantidade = 1;
    let medida = "";
    if (q && (q[1] || q[2])) {
      quantidade = q[1] ? num(q[1]) : 1;
      medida = (q[2] ?? "").toLowerCase();
      linha = linha.slice(q[0].length).trim();
    }
    if (!linha) continue;
    let nome = linha.charAt(0).toUpperCase() + linha.slice(1);
    const categoria = categoriaPeloNome(nome);
    let qtd = quantidade;
    let unidadeQtd: "un" | "kg" = "un";
    let total = porUnidade ? valor * quantidade : valor;
    if (["kg", "g"].includes(medida) && (categoria === "carnes" || categoria === "hortifruti")) {
      qtd = medida === "g" ? quantidade / 1000 : quantidade;
      unidadeQtd = "kg";
      total = valor;
    } else if (["kg", "g", "ml", "l", "litro", "litros"].includes(medida)) {
      // Pacote: o peso faz parte do produto ("Arroz 5kg"), comprado 1 vez
      nome = `${nome} ${texto(quantidade)}${medida === "litro" || medida === "litros" ? "L" : medida}`;
      qtd = 1;
      total = valor;
    }
    valor = total / (qtd || 1);
    const igual = itens.find((i) => semAcento(i.nome) === semAcento(nome));
    if (igual) {
      const novaQtd = num(igual.qtd) + qtd;
      igual.total += total;
      igual.qtd = texto(novaQtd);
      igual.precoUnidade = igual.total / novaQtd;
      continue;
    }
    itens.push({ nome, categoria, qtd: texto(qtd), unidadeQtd, precoUnidade: valor, total });
  }
  return itens;
}
