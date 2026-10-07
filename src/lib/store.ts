"use client";

// Onde os dados ficam guardados por enquanto: no próprio navegador (localStorage).
// Mais tarde trocamos isto pelo Supabase, sem precisar mexer nas telas.

import { useSyncExternalStore } from "react";
import { diasEntre, hojeISO, lerValor, mesAtual, somarMeses } from "./formato";
import { DIAS_POR_UNIDADE, melhorUnidade } from "./duracao";

// ---------- Tipos ----------

export type Tipo = "entrada" | "saida";

export type Lancamento = {
  id: string;
  tipo: Tipo;
  valor: number;
  descricao: string;
  categoria: string;
  data: string; // "2026-10-05"
  pago: boolean;
  fonteId?: string; // quando é um recebimento registrado na aba Renda
  horas?: number; // para quem ganha por hora
  beneficio?: TipoBeneficio; // quando é um vale/benefício (ex.: vale-refeição)
  gastoFixoId?: string; // quando é o pagamento de um gasto fixo (aluguel, Netflix…)
  cartaoId?: string; // quando é o pagamento de uma fatura de cartão
  fatura?: string; // qual fatura foi paga ("2026-11", pelo mês de vencimento)
  contaId?: string; // de qual conta saiu / em qual conta entrou (sem conta = lançamento antigo, a escolher)
  metaId?: string; // quando é parcela de quitar ou dinheiro guardado numa meta
  criadoEm?: string; // quando foi registrado (para saber se já estava no saldo informado da conta)
  transferenciaId?: string; // as duas pontas de uma transferência entre contas têm o mesmo id
  pagamentoFaturaId?: string; // quando é o pagamento de uma fatura: o registro do pagamento ligado a ele
  // O que este lançamento fez numa meta (apagar ou editar o lançamento desfaz o efeito)
  efeito?: "guardar" | "retirar" | "parcela";
  parcelasEfeito?: number; // parcela: quantas parcelas este pagamento quitou (adiantamento pode ser mais de uma)
  competencia?: string; // gasto fixo: de qual mês é a conta ("2026-09"), mesmo pagando com atraso
  compraMercadoId?: string; // quando é uma ida ao mercado: os itens dessa compra
  subcategoria?: string;
  parteRenda?: ParteRenda; // recebimento de uma fonte: salário, adiantamento, 13º, férias ou benefício
  // Já estava dentro do saldo informado da conta (ex.: criou a conta depois do salário cair): conta como recebido, não soma de novo
  jaNoSaldo?: boolean;
  extratoId?: string; // veio do extrato do banco: a linha de lá (para não importar duas vezes)
};

/** As partes de uma renda que caem em datas diferentes. */
export type ParteRenda = "salario" | "adiantamento" | "decimo1" | "decimo2" | "ferias" | "beneficio";

/** Transferência entre contas: muda o saldo das contas, mas não é renda nem gasto. */
export function ehTransferencia(l: Pick<Lancamento, "transferenciaId">) {
  return !!l.transferenciaId;
}

// ---------- Mercado ----------

export type CategoriaMercado =
  "alimentos" | "carnes" | "hortifruti" | "laticinios" | "bebidas" | "limpeza" | "higiene" | "beleza" | "pet" | "outros";
export type UnidadeDuracao = "dias" | "semanas" | "meses" | "anos";

/** Um item da despensa: o que foi comprado, quanto custou e quanto tempo dura. */
export type ItemMercado = {
  id: string;
  nome: string;
  icone: string;
  categoria: CategoriaMercado;
  quantidade: string; // "2 kg", "12 rolos"
  valor: number; // preço da última compra
  duracao: number | null; // null = ainda não sabe (o app descobre quando acabar)
  unidade: UnidadeDuracao;
  ultimaCompra: string; // "2026-10-05"
  repor: boolean; // quando acabar, compra de novo (entra na previsão de gastos)
  // De onde veio a duração: a pessoa informou/confirmou, ou o app calculou sozinho (falta confirmar)
  origemDuracao?: "informada" | "calculada";
};

export type UnidadeQtd = "un" | "kg" | "g" | "L" | "ml" | "pacote";
export const UNIDADES_QTD: UnidadeQtd[] = ["un", "kg", "g", "L", "ml", "pacote"];

/** Uma ida ao mercado (vira uma saída ou uma compra no cartão). */
export type CompraMercado = {
  id: string;
  data: string;
  total: number;
  itens: { itemId: string; nome: string; valor: number }[];
  cartaoId?: string;
  tipo?: "mes" | "avulsa"; // "compra do mês" (a grande) ou uma compra avulsa
  contaId?: string;
};

/** Um produto que a pessoa já usou alguma vez: fica salvo como opção para sempre. */
export type OpcaoMercado = { nome: string; icone: string; categoria: CategoriaMercado; quantidade: string };

/**
 * Um item da lista de compras. Na lista, só o nome. No mercado, a pessoa marca que pegou
 * e vai preenchendo quantidade, valor e (se souber) a duração; fica salvo enquanto ela compra.
 */
export type ItemLista = {
  id: string;
  nome: string;
  icone: string;
  categoria: CategoriaMercado;
  noCarrinho: boolean; // "peguei"
  qtd?: string;
  unidadeQtd?: UnidadeQtd;
  valor?: string;
  duracao?: string;
  unidadeDuracao?: UnidadeDuracao;
};

// ---------- Gastos fixos ----------

export type CategoriaFixo = "moradia" | "contas" | "assinaturas" | "saude" | "educacao" | "transporte" | "outros";
export type Frequencia = "mensal" | "semestral" | "anual" | "personalizada";
export type FormaPagamento = "boleto" | "pix" | "debito" | "cartao";

export type GastoFixo = {
  id: string;
  nome: string;
  icone: string;
  categoria: CategoriaFixo;
  valor: number; // se "varia", é o valor médio
  varia: boolean; // o valor muda todo mês (ex.: luz, água)
  dia: number; // dia do vencimento (ou da cobrança no cartão)
  pagamento: FormaPagamento;
  cartaoId?: string;
  contaId?: string; // fora do cartão: de qual conta sai
  desde: string; // "2026-10": a partir de qual mês existe
  criadoEm?: string; // "2026-10-05": no cartão, entra na fatura que estava aberta neste dia e em todas as seguintes
  frequencia?: Frequencia; // sem valor = mensal
  mesReferencia?: string; // semestral/anual: um mês em que cobra ("2027-03"); repete a cada 6 ou 12 meses
  // "A cada…" (ex.: gasolina a cada 15 dias): de quantos em quantos dias, a partir de qual data
  intervaloDias?: number;
  inicio?: string; // "2026-10-05"
  ate?: string; // último mês em que cobra ("2026-12"): cancelado depois disso, o histórico fica
  pausas?: string[]; // meses em que não cobra (pausado)
};

// ---------- Cartões ----------

/**
 * Uma conta: banco (com ou sem cartão de crédito) ou dinheiro na carteira.
 * O saldo é informado uma vez e, dali em diante, muda sozinho com cada entrada e saída da conta.
 * No crédito, o limite usado não é digitado: sai das compras que ainda não foram pagas.
 * (O nome do tipo continua "Cartao" porque as contas nasceram dos cartões.)
 */
export type Cartao = {
  id: string;
  nome: string;
  cor: string;
  tipo?: "banco" | "dinheiro" | "vale"; // vale: VR/VA (Alelo, VR, Pluxee…), só paga comida e não é dinheiro livre
  temCredito?: boolean; // sem valor = true (contas antigas eram todas cartões)
  limite: number;
  diaFechamento: number;
  diaVencimento: number;
  criadoEm: string; // "2026-10-07" (gastos fixos no cartão contam a partir daqui)
  saldo?: number | null; // saldo informado pela pessoa
  saldoAtualizadoEm?: string; // quando o saldo foi informado (data e hora)
  // Diferença entre o limite usado no app do banco e o que está cadastrado aqui (compras não cadastradas)
  ajusteLimite?: number;
};
export type Conta = Cartao;

export type CompraCartao = {
  id: string;
  cartaoId: string;
  descricao: string;
  categoria: string;
  valorTotal: number;
  parcelas: number;
  parcelasPagas?: number; // parcelas que já estavam pagas quando a compra foi incluída
  data: string; // dia da compra
  metaId?: string; // quando a compra é uma meta de quitar da Trilha (ex.: celular parcelado)
  gastoFixoId?: string; // quando é um gasto fixo que foi pago no crédito (conta como pago no mês)
  competencia?: string; // gasto fixo pago no crédito: de qual mês é a conta
  compraMercadoId?: string; // quando é uma ida ao mercado no crédito
  subcategoria?: string;
  extratoId?: string; // veio do extrato do cartão
};

export type PagamentoFatura = {
  id: string;
  cartaoId: string;
  fatura: string; // "2026-11" (mês de vencimento)
  valor: number;
  data: string;
};

export type Objetivo = "organizar" | "juntar" | "economizar" | "dividas" | "investir" | "outro";

export type Perfil = {
  concluido: boolean; // já respondeu o questionário de boas-vindas?
  nome: string;
  objetivos: Objetivo[];
  objetivoOutro: string;
};

export type Meta = {
  id: string;
  nome: string;
  icone: string;
  alvo: number; // quanto quer juntar
  guardado: number; // quanto já tem
  prazo: string | null; // "2027-06" (até quando quer chegar)
  aporteMensal: number | null; // quanto consegue guardar por mês
  reserva?: boolean; // é a reserva de emergência?
  // Metas de quitar algo parcelado (ex.: celular em 12x).
  // Nelas, alvo = parcela × parcelas, guardado = parcela × parcelasPagas, aporteMensal = parcela.
  tipo?: "juntar" | "quitar";
  divida?: TipoDivida;
  parcela?: number;
  parcelas?: number;
  parcelasPagas?: number;
  valorOriginal?: number; // quanto custava sem juros (ou quanto pegou emprestado)
  jurosMes?: number; // taxa ao mês do contrato (0.025 = 2,5%)
  economizado?: number; // juros economizados adiantando parcelas
  diaVencimento?: number; // dia em que a parcela vence (para aparecer no A pagar)
  ultimaParcelaPaga?: string; // "2026-10": mês em que a última parcela foi paga
  contaId?: string; // de qual conta sai a parcela / o dinheiro guardado
  // Quanto pagar/guardar em cada mês, quando a pessoa muda (0 = não entra na previsão daquele mês)
  planoMensal?: Record<string, number>;
  arquivada?: boolean; // concluída e guardada no histórico de conquistas
  concluidaEm?: string;
};

export type TipoDivida = "parcelado" | "emprestimo" | "financiamento" | "outro";

export type FormaRenda = "fixo" | "hora" | "servico" | "comissao" | "outro";

export type TipoBeneficio = "transporte" | "refeicao" | "alimentacao" | "combustivel" | "bonus" | "outro";

/** Algo que vem junto com uma renda: vale-transporte, vale-refeição, bônus… */
export type Beneficio = {
  tipo: TipoBeneficio;
  nome: string; // o nome do tipo, ou o que a pessoa escreveu em "Outro"
  valor: number; // por mês
  // Vem em dinheiro na conta (ex.: VT pago no salário) ou num cartão de vale (VR/VA)?
  // Vale não é dinheiro livre: não entra na sobra, na reserva nem na % da renda.
  emDinheiro?: boolean;
  contaId?: string; // onde cai (no vale: a conta do tipo vale)
};

export type FonteRenda = {
  id: string;
  nome: string;
  forma: FormaRenda;
  valor: number; // fixo: quanto recebe por mês; variável: média estimada por mês
  valorHora: number | null;
  horasMes: number | null;
  beneficios?: Beneficio[];
  diaRecebimento?: string; // "5" (todo dia 5), "5u" (5º dia útil), "ultimo-util"
  contaId?: string; // em qual conta cai
  // CLT: adiantamento (vale) no meio do mês, 13º salário e férias
  adiantamento?: { dia: string; percentual: number } | null; // ex.: dia "20", 40%
  decimoTerceiro?: boolean;
  mesFerias?: number | null; // 1 a 12: mês em que tira férias (recebe +1/3)
  // Freela que paga toda semana ou a cada 15 dias: `valor` é o de cada vez, a partir de `inicio`
  frequencia?: "mensal" | "semanal" | "quinzenal";
  inicio?: string;
};

// ---------- Listas fixas ----------

export const CATEGORIAS: Record<Tipo, { nome: string; icone: string }[]> = {
  saida: [
    { nome: "Mercado", icone: "🛒" },
    { nome: "Alimentação", icone: "🍔" },
    { nome: "Moradia", icone: "🏠" },
    { nome: "Contas", icone: "🧾" },
    { nome: "Transporte", icone: "🚌" },
    { nome: "Saúde", icone: "💊" },
    { nome: "Lazer", icone: "🎬" },
    { nome: "Compras", icone: "🛍️" },
    { nome: "Assinaturas", icone: "📺" },
    { nome: "Educação", icone: "📚" },
    { nome: "Fatura do cartão", icone: "💳" },
    { nome: "Parcelas e dívidas", icone: "💸" },
    { nome: "Guardar (metas)", icone: "🎯" },
    { nome: "Outros", icone: "📦" },
  ],
  entrada: [
    { nome: "Salário", icone: "💼" },
    { nome: "Freelance", icone: "💻" },
    { nome: "Benefícios", icone: "🎟️" },
    { nome: "Vendas", icone: "🏷️" },
    { nome: "Investimentos", icone: "📈" },
    { nome: "Outros", icone: "💰" },
  ],
};

export function iconeDaCategoria(tipo: Tipo, nome: string) {
  if (nome === "Transferência") return "🔁";
  if (nome === "Guardar (metas)") return "🎯";
  return (
    CATEGORIAS[tipo].find((c) => c.nome === nome)?.icone ??
    categoriasPersonalizadas.ler().find((c) => c.tipo === tipo && c.nome === nome)?.icone ??
    "•"
  );
}

export const OBJETIVOS: { id: Objetivo; nome: string; icone: string; descricao: string }[] = [
  { id: "organizar", nome: "Me organizar", icone: "🧭", descricao: "Saber para onde meu dinheiro vai" },
  { id: "juntar", nome: "Realizar um sonho", icone: "🎯", descricao: "Juntar dinheiro para comprar ou fazer algo" },
  { id: "economizar", nome: "Economizar", icone: "🐷", descricao: "Gastar menos e guardar o que sobrar" },
  { id: "dividas", nome: "Sair das dívidas", icone: "🔓", descricao: "Pagar o que devo e ficar em paz" },
  { id: "investir", nome: "Começar a investir", icone: "📈", descricao: "Fazer o dinheiro render" },
  { id: "outro", nome: "Outro", icone: "✏️", descricao: "Escrevo com as minhas palavras" },
];

export const SUGESTOES_SONHOS = [
  { nome: "Notebook", icone: "💻" },
  { nome: "Viagem", icone: "✈️" },
  { nome: "Carro", icone: "🚗" },
  { nome: "Casa própria", icone: "🏡" },
  { nome: "Celular novo", icone: "📱" },
  { nome: "Curso", icone: "🎓" },
  { nome: "Casamento", icone: "💍" },
  { nome: "Moto", icone: "🏍️" },
  { nome: "Reforma", icone: "🛠️" },
  { nome: "Móveis", icone: "🛋️" },
  { nome: "Intercâmbio", icone: "🌍" },
  { nome: "Show ou festival", icone: "🎤" },
  { nome: "Videogame", icone: "🎮" },
  { nome: "Presente", icone: "🎁" },
  { nome: "Festa", icone: "🎉" },
  { nome: "Meu negócio", icone: "🚀" },
  { nome: "Pet", icone: "🐶" },
  { nome: "Algo para mim", icone: "🌸" },
];

// Cartão de crédito fica de fora de propósito: compra no cartão vai para a fatura (aba Contas), não vira trilha.
export const SUGESTOES_QUITAR: { nome: string; icone: string; divida: TipoDivida }[] = [
  { nome: "Celular parcelado", icone: "📱", divida: "parcelado" },
  { nome: "Compra parcelada", icone: "🛍️", divida: "parcelado" },
  { nome: "Empréstimo", icone: "🏦", divida: "emprestimo" },
  { nome: "Financiamento", icone: "🚗", divida: "financiamento" },
  { nome: "Conta atrasada", icone: "🧾", divida: "outro" },
];

/** Empréstimo e financiamento têm taxa de juros no contrato e costumam dar desconto para adiantar. */
export function temContratoDeJuros(divida?: TipoDivida) {
  return divida === "emprestimo" || divida === "financiamento";
}

export const ICONES_META = [
  "🎯",
  "💻",
  "✈️",
  "🚗",
  "🏡",
  "📱",
  "🎓",
  "💍",
  "🌸",
  "🎮",
  "🐶",
  "🛟",
  "⭐",
  "🎸",
  "💳",
  "🏦",
  "🛍️",
  "🧾",
];

export const FORMAS_RENDA: { id: FormaRenda; nome: string; icone: string }[] = [
  { id: "fixo", nome: "Fixo todo mês", icone: "📅" },
  { id: "hora", nome: "Por hora", icone: "⏱️" },
  { id: "servico", nome: "Por serviço", icone: "🧰" },
  { id: "comissao", nome: "Comissão", icone: "🤝" },
  { id: "outro", nome: "Varia (outro)", icone: "🔀" },
];

export const TIPOS_BENEFICIO: { id: TipoBeneficio; nome: string; icone: string }[] = [
  { id: "transporte", nome: "Vale-transporte", icone: "🚌" },
  { id: "refeicao", nome: "Vale-refeição", icone: "🍽️" },
  { id: "alimentacao", nome: "Vale-alimentação", icone: "🛒" },
  { id: "combustivel", nome: "Vale-combustível", icone: "⛽" },
  { id: "bonus", nome: "Bônus", icone: "🎁" },
  { id: "outro", nome: "Outro", icone: "✏️" },
];

/** VR e VA costumam vir num cartão de vale (não é dinheiro livre); os outros, em dinheiro. */
export function beneficioEmDinheiro(b: Pick<Beneficio, "tipo" | "emDinheiro">) {
  return b.emDinheiro ?? !(b.tipo === "refeicao" || b.tipo === "alimentacao");
}

export function iconeDoBeneficio(tipo: TipoBeneficio) {
  return TIPOS_BENEFICIO.find((t) => t.id === tipo)?.icone ?? "🎟️";
}

/** Soma dos benefícios de uma fonte (por mês). Com `soDinheiro`, deixa os vales (VR/VA) de fora. */
export function totalBeneficios(fonte: FonteRenda, soDinheiro = false) {
  return (fonte.beneficios ?? []).filter((b) => !soDinheiro || beneficioEmDinheiro(b)).reduce((total, b) => total + b.valor, 0);
}

/** O valor é o mesmo todo mês? */
export function rendaFixa(forma: FormaRenda) {
  return forma === "fixo";
}

export function nomeDaForma(forma: FormaRenda) {
  return FORMAS_RENDA.find((f) => f.id === forma)?.nome ?? "";
}

/**
 * MODO DE TESTE do questionário: as respostas não ficam salvas,
 * então ao recarregar a página o questionário de boas-vindas aparece de novo.
 * Liga só com NEXT_PUBLIC_TESTAR_BOAS_VINDAS=1 no .env.local (nunca em produção).
 */
export const TESTANDO_BOAS_VINDAS = process.env.NEXT_PUBLIC_TESTAR_BOAS_VINDAS === "1";

// O emoji do item é sempre o da categoria (genéricos de propósito). `unidade`: como costuma ser vendido (dá para mudar).
export const CATEGORIAS_MERCADO: { id: CategoriaMercado; nome: string; icone: string; unidade: UnidadeQtd }[] = [
  { id: "alimentos", nome: "Mercearia", icone: "🥫", unidade: "un" },
  { id: "carnes", nome: "Carnes", icone: "🥩", unidade: "kg" },
  { id: "hortifruti", nome: "Frutas e verduras", icone: "🥦", unidade: "kg" },
  { id: "laticinios", nome: "Frios e laticínios", icone: "🧀", unidade: "un" },
  { id: "bebidas", nome: "Bebidas", icone: "🥤", unidade: "L" },
  { id: "limpeza", nome: "Limpeza", icone: "🧽", unidade: "un" },
  { id: "higiene", nome: "Higiene", icone: "🧴", unidade: "un" },
  { id: "beleza", nome: "Beleza", icone: "💄", unidade: "un" },
  { id: "pet", nome: "Pet", icone: "🐾", unidade: "un" },
  { id: "outros", nome: "Outros", icone: "🛒", unidade: "un" },
];

export const UNIDADES_DURACAO: { id: UnidadeDuracao; nome: string; singular: string; dias: number }[] = [
  { id: "dias", nome: "dias", singular: "dia", dias: 1 },
  { id: "semanas", nome: "semanas", singular: "semana", dias: 7 },
  { id: "meses", nome: "meses", singular: "mês", dias: 30 },
  { id: "anos", nome: "anos", singular: "ano", dias: 365 },
];

// Sugestões com uma duração de partida (para uma pessoa); dá para ajustar em cada compra
export const SUGESTOES_MERCADO: {
  nome: string;
  icone: string;
  categoria: CategoriaMercado;
  quantidade: string;
  duracao: number;
  unidade: UnidadeDuracao;
}[] = [
  { nome: "Arroz", icone: "🍚", categoria: "alimentos", quantidade: "5 kg", duracao: 2, unidade: "meses" },
  { nome: "Feijão", icone: "🫘", categoria: "alimentos", quantidade: "1 kg", duracao: 1, unidade: "meses" },
  { nome: "Macarrão", icone: "🍝", categoria: "alimentos", quantidade: "500 g", duracao: 2, unidade: "semanas" },
  { nome: "Café", icone: "☕", categoria: "alimentos", quantidade: "500 g", duracao: 3, unidade: "semanas" },
  { nome: "Açúcar", icone: "🍬", categoria: "alimentos", quantidade: "1 kg", duracao: 1, unidade: "meses" },
  { nome: "Óleo", icone: "🫒", categoria: "alimentos", quantidade: "900 ml", duracao: 1, unidade: "meses" },
  { nome: "Sal", icone: "🧂", categoria: "alimentos", quantidade: "1 kg", duracao: 6, unidade: "meses" },
  { nome: "Leite", icone: "🥛", categoria: "alimentos", quantidade: "12 L", duracao: 2, unidade: "semanas" },
  { nome: "Ovos", icone: "🥚", categoria: "alimentos", quantidade: "30 un", duracao: 2, unidade: "semanas" },
  { nome: "Pão", icone: "🍞", categoria: "alimentos", quantidade: "1 pacote", duracao: 1, unidade: "semanas" },
  { nome: "Manteiga", icone: "🧈", categoria: "alimentos", quantidade: "200 g", duracao: 2, unidade: "semanas" },
  { nome: "Frutas", icone: "🍎", categoria: "alimentos", quantidade: "", duracao: 1, unidade: "semanas" },
  { nome: "Carne", icone: "🥩", categoria: "alimentos", quantidade: "1 kg", duracao: 1, unidade: "semanas" },
  { nome: "Água mineral", icone: "💧", categoria: "bebidas", quantidade: "5 L", duracao: 1, unidade: "semanas" },
  { nome: "Refrigerante", icone: "🥤", categoria: "bebidas", quantidade: "2 L", duracao: 1, unidade: "semanas" },
  { nome: "Suco", icone: "🧃", categoria: "bebidas", quantidade: "1 L", duracao: 1, unidade: "semanas" },
  { nome: "Detergente", icone: "🧴", categoria: "limpeza", quantidade: "500 ml", duracao: 2, unidade: "semanas" },
  { nome: "Sabão em pó", icone: "🧺", categoria: "limpeza", quantidade: "1 kg", duracao: 1, unidade: "meses" },
  { nome: "Amaciante", icone: "🌸", categoria: "limpeza", quantidade: "2 L", duracao: 1, unidade: "meses" },
  { nome: "Água sanitária", icone: "🧪", categoria: "limpeza", quantidade: "2 L", duracao: 1, unidade: "meses" },
  { nome: "Desinfetante", icone: "🫧", categoria: "limpeza", quantidade: "2 L", duracao: 1, unidade: "meses" },
  { nome: "Esponja", icone: "🧽", categoria: "limpeza", quantidade: "3 un", duracao: 1, unidade: "meses" },
  { nome: "Saco de lixo", icone: "🗑️", categoria: "limpeza", quantidade: "1 rolo", duracao: 1, unidade: "meses" },
  { nome: "Papel higiênico", icone: "🧻", categoria: "higiene", quantidade: "12 rolos", duracao: 1, unidade: "meses" },
  { nome: "Sabonete", icone: "🧼", categoria: "higiene", quantidade: "4 un", duracao: 1, unidade: "meses" },
  { nome: "Shampoo", icone: "🧴", categoria: "higiene", quantidade: "350 ml", duracao: 2, unidade: "meses" },
  { nome: "Condicionador", icone: "🧴", categoria: "higiene", quantidade: "350 ml", duracao: 2, unidade: "meses" },
  { nome: "Pasta de dente", icone: "🪥", categoria: "higiene", quantidade: "90 g", duracao: 1, unidade: "meses" },
  { nome: "Escova de dente", icone: "🪥", categoria: "higiene", quantidade: "1 un", duracao: 3, unidade: "meses" },
  { nome: "Desodorante", icone: "🌬️", categoria: "higiene", quantidade: "1 un", duracao: 1, unidade: "meses" },
  { nome: "Absorvente", icone: "🩷", categoria: "higiene", quantidade: "1 pacote", duracao: 1, unidade: "meses" },
  { nome: "Fio dental", icone: "🦷", categoria: "higiene", quantidade: "50 m", duracao: 2, unidade: "meses" },
  { nome: "Hidratante", icone: "🧴", categoria: "beleza", quantidade: "200 ml", duracao: 2, unidade: "meses" },
  { nome: "Protetor solar", icone: "☀️", categoria: "beleza", quantidade: "60 ml", duracao: 2, unidade: "meses" },
  { nome: "Creme de cabelo", icone: "💆", categoria: "beleza", quantidade: "1 kg", duracao: 2, unidade: "meses" },
  { nome: "Base", icone: "💄", categoria: "beleza", quantidade: "30 ml", duracao: 3, unidade: "meses" },
  { nome: "Máscara de cílios", icone: "👁️", categoria: "beleza", quantidade: "1 un", duracao: 3, unidade: "meses" },
  { nome: "Perfume", icone: "🌹", categoria: "beleza", quantidade: "100 ml", duracao: 6, unidade: "meses" },
  { nome: "Ração", icone: "🐶", categoria: "pet", quantidade: "10 kg", duracao: 1, unidade: "meses" },
  { nome: "Areia do gato", icone: "🐱", categoria: "pet", quantidade: "4 kg", duracao: 1, unidade: "meses" },
  { nome: "Petisco", icone: "🦴", categoria: "pet", quantidade: "1 pacote", duracao: 2, unidade: "semanas" },
];

export const CATEGORIAS_FIXO: { id: CategoriaFixo; nome: string; icone: string; categoriaLancamento: string }[] = [
  { id: "moradia", nome: "Moradia", icone: "🏠", categoriaLancamento: "Moradia" },
  { id: "contas", nome: "Contas da casa", icone: "💡", categoriaLancamento: "Contas" },
  { id: "assinaturas", nome: "Assinaturas", icone: "📺", categoriaLancamento: "Assinaturas" },
  { id: "saude", nome: "Saúde e bem-estar", icone: "🩺", categoriaLancamento: "Saúde" },
  { id: "educacao", nome: "Educação", icone: "🎓", categoriaLancamento: "Educação" },
  { id: "transporte", nome: "Transporte", icone: "🚗", categoriaLancamento: "Transporte" },
  { id: "outros", nome: "Outros", icone: "📦", categoriaLancamento: "Outros" },
];

// Sugestões rápidas de gastos fixos (mercado fica de fora: vai ter aba própria)
export const SUGESTOES_FIXO: {
  nome: string;
  icone: string;
  categoria: CategoriaFixo;
  varia?: boolean;
  intervaloDias?: number; // sugestão de "a cada X dias"
}[] = [
  { nome: "Aluguel", icone: "🏠", categoria: "moradia" },
  { nome: "Condomínio", icone: "🏢", categoria: "moradia" },
  { nome: "Luz", icone: "💡", categoria: "contas", varia: true },
  { nome: "Água", icone: "🚿", categoria: "contas", varia: true },
  { nome: "Gás", icone: "🔥", categoria: "contas", varia: true },
  { nome: "Internet", icone: "📶", categoria: "contas" },
  { nome: "Plano de celular", icone: "📱", categoria: "contas" },
  { nome: "Netflix", icone: "🎬", categoria: "assinaturas" },
  { nome: "Spotify", icone: "🎧", categoria: "assinaturas" },
  { nome: "Amazon Prime", icone: "📦", categoria: "assinaturas" },
  { nome: "Disney+", icone: "🏰", categoria: "assinaturas" },
  { nome: "Max", icone: "🎞️", categoria: "assinaturas" },
  { nome: "Globoplay", icone: "📺", categoria: "assinaturas" },
  { nome: "YouTube Premium", icone: "▶️", categoria: "assinaturas" },
  { nome: "iCloud / Google One", icone: "☁️", categoria: "assinaturas" },
  { nome: "Game Pass / PS Plus", icone: "🎮", categoria: "assinaturas" },
  { nome: "ChatGPT / IA", icone: "🤖", categoria: "assinaturas" },
  { nome: "Academia", icone: "🏋️", categoria: "saude" },
  { nome: "Plano de saúde", icone: "🩺", categoria: "saude" },
  { nome: "Terapia", icone: "🧠", categoria: "saude" },
  { nome: "Faculdade", icone: "🎓", categoria: "educacao" },
  { nome: "Curso", icone: "📚", categoria: "educacao" },
  { nome: "Gasolina", icone: "⛽", categoria: "transporte", varia: true, intervaloDias: 15 },
  { nome: "Ônibus / Metrô", icone: "🚌", categoria: "transporte", intervaloDias: 7 },
  { nome: "Uber / 99", icone: "🚕", categoria: "transporte", varia: true, intervaloDias: 7 },
  { nome: "Pedágio", icone: "🛣️", categoria: "transporte", intervaloDias: 7 },
  { nome: "Seguro do carro", icone: "🚗", categoria: "transporte" },
  { nome: "Estacionamento", icone: "🅿️", categoria: "transporte" },
  { nome: "Diarista", icone: "🧹", categoria: "outros" },
  { nome: "Doação / Dízimo", icone: "🤲", categoria: "outros" },
];

export const FREQUENCIAS: { id: Frequencia; nome: string; meses: number; porExtenso: string }[] = [
  { id: "mensal", nome: "Mensal", meses: 1, porExtenso: "por mês" },
  { id: "semestral", nome: "Semestral", meses: 6, porExtenso: "por semestre" },
  { id: "anual", nome: "Anual", meses: 12, porExtenso: "por ano" },
  { id: "personalizada", nome: "A cada…", meses: 0, porExtenso: "cada vez" },
];

export const FORMAS_PAGAMENTO: { id: FormaPagamento; nome: string; icone: string }[] = [
  { id: "boleto", nome: "Boleto", icone: "🧾" },
  { id: "debito", nome: "Débito / Pix", icone: "🏦" },
  { id: "cartao", nome: "Cartão de crédito", icone: "💳" },
];

export const SUGESTOES_CARTAO = [
  "Nubank",
  "Inter",
  "Itaú",
  "Bradesco",
  "Santander",
  "C6",
  "Caixa",
  "Banco do Brasil",
  "Mercado Pago",
  "PicPay",
];

export const CORES_CARTAO = [
  "linear-gradient(135deg,#ff4ed8,#8b5cf6)",
  "linear-gradient(135deg,#8b5cf6,#3b82f6)",
  "linear-gradient(135deg,#3b82f6,#06b6d4)",
  "linear-gradient(135deg,#f97316,#ec4899)",
  "linear-gradient(135deg,#10b981,#3b82f6)",
  "linear-gradient(135deg,#334155,#0f172a)",
];

// ---------- Mecanismo de salvar e avisar as telas ----------

const ouvintes = new Set<() => void>();

function avisar() {
  ouvintes.forEach((ouvinte) => ouvinte());
}

function inscrever(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/**
 * Um conjunto de dados salvo no navegador com a chave informada.
 * Com salvar = false, fica só na memória e some ao recarregar a página.
 */
/**
 * Quem quer saber quando algo é salvo (a sincronização com a nuvem).
 * Fica de fora do resto do app: sem login, nada muda.
 */
type OuvinteDeGravacao = { aoGravar: (chave: string, valor: unknown) => void; aoApagarTudo: (manter: string[]) => void };
let ouvinteDeGravacao: OuvinteDeGravacao | null = null;
let silencioso = false; // gravando o que veio da nuvem: não manda de volta

export function definirOuvinteDeGravacao(ouvinte: OuvinteDeGravacao | null) {
  ouvinteDeGravacao = ouvinte;
}

/** Grava os dados que vieram da nuvem sem avisar a nuvem de novo. */
export function gravarDaNuvem(foto: Record<string, unknown>) {
  silencioso = true;
  try {
    restaurarDados(foto);
  } finally {
    silencioso = false;
  }
}

type Registro = { chave: string; ler: () => unknown; gravarCru: (valor: unknown) => void; esquecer: () => void; salvar: boolean };
const registro: Registro[] = [];

function criarDado<T>(chave: string, padrao: T, salvar = true) {
  let atual: T | undefined;

  function ler(): T {
    if (atual === undefined) {
      try {
        const salvo = salvar ? localStorage.getItem(chave) : null;
        atual = salvo ? (JSON.parse(salvo) as T) : padrao;
      } catch {
        atual = padrao;
      }
    }
    return atual;
  }

  function gravar(novo: T) {
    atual = novo;
    if (!salvar) return avisar();
    try {
      localStorage.setItem(chave, JSON.stringify(novo));
    } catch {
      // Sem acesso ao localStorage (ex.: janela anônima): os dados ficam só até fechar a aba.
    }
    if (!silencioso) ouvinteDeGravacao?.aoGravar(chave, novo);
    avisar();
  }

  registro.push({
    chave,
    ler,
    gravarCru: (valor) => gravar((valor ?? padrao) as T),
    esquecer: () => (atual = undefined),
    salvar,
  });
  return { ler, gravar };
}

/** Id único. crypto.randomUUID só existe em https/localhost: no celular pela rede (http://192.168…) usa outro jeito. */
function novoId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Data e hora local ("2026-10-05T14:30:00"), sem fuso: compara certo com as datas dos lançamentos. */
export function agoraLocal() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${hojeISO()}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Converte datas antigas gravadas em UTC ("…Z") para a hora local. */
export function paraHoraLocal(texto?: string) {
  if (!texto || !texto.endsWith("Z")) return texto;
  const d = new Date(texto);
  if (Number.isNaN(d.getTime())) return texto;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Fotografia de todos os dados (para "Desfazer" e para o backup). */
export function fotografarDados(): Record<string, unknown> {
  return Object.fromEntries(registro.filter((r) => r.salvar).map((r) => [r.chave, r.ler()]));
}

/** Volta todos os dados para uma fotografia (ou para o que veio de um backup). */
export function restaurarDados(foto: Record<string, unknown>) {
  for (const r of registro.filter((x) => x.salvar)) if (r.chave in foto) r.gravarCru(foto[r.chave]);
}

export const VERSAO_DOS_DADOS = 2;

/** Arquivo de backup: todos os dados, com a versão e a data. */
export function exportarBackup() {
  return JSON.stringify(
    { app: "naxxo-financas", versao: VERSAO_DOS_DADOS, exportadoEm: agoraLocal(), dados: fotografarDados() },
    null,
    2,
  );
}

/** Lê um backup. Devolve uma mensagem de erro, ou null se deu certo. */
export function importarBackup(texto: string): string | null {
  try {
    const arquivo = JSON.parse(texto);
    if (arquivo?.app !== "naxxo-financas" || typeof arquivo.dados !== "object")
      return "Esse arquivo não é um backup do NAXXO Finanças.";
    restaurarDados(arquivo.dados);
    try {
      localStorage.setItem("naxxo:versao", String(arquivo.versao ?? 1));
    } catch {}
    migrarDados();
    return null;
  } catch {
    return "Não consegui ler o arquivo. Escolha o .json que o app exportou.";
  }
}

/** Apaga tudo (volta ao começo, com o questionário). `manter`: chaves que ficam (ex.: a lista do mercado). */
export function apagarTudo(manter: string[] = [], tambemNaNuvem = true) {
  if (tambemNaNuvem && !silencioso) ouvinteDeGravacao?.aoApagarTudo(manter);
  for (const r of registro.filter((x) => !manter.includes(x.chave))) {
    try {
      localStorage.removeItem(r.chave);
    } catch {}
    r.esquecer();
  }
  avisar();
}

// Outra aba mudou os dados: lê de novo, para uma aba não apagar o que a outra salvou
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key && !e.key.startsWith("naxxo:")) return;
    registro.forEach((r) => r.esquecer());
    avisar();
  });
}

// ---------- Lançamentos ----------

const SEM_LANCAMENTOS: Lancamento[] = [];
const lancamentos = criarDado<Lancamento[]>("naxxo:lancamentos", SEM_LANCAMENTOS);

export function useLancamentos() {
  return useSyncExternalStore(inscrever, lancamentos.ler, () => SEM_LANCAMENTOS);
}

/** Os lançamentos agora (fora de um componente). */
export function lerLancamentos() {
  return lancamentos.ler();
}

/** Vários de uma vez (ex.: importar extrato): grava uma vez só. */
export function adicionarLancamentos(novos: Omit<Lancamento, "id">[]) {
  const criadoEm = agoraLocal();
  lancamentos.gravar([...novos.map((n) => ({ ...n, id: novoId(), criadoEm })), ...lancamentos.ler()]);
}

export function adicionarLancamento(novo: Omit<Lancamento, "id">) {
  const id = novoId();
  lancamentos.gravar([{ ...novo, id, criadoEm: agoraLocal() }, ...lancamentos.ler()]);
  return id;
}

/**
 * Edita um lançamento. Se ele mexia numa meta ou numa fatura, ajusta junto:
 * guardou R$ 100 e corrigiu para R$ 80 → a meta perde R$ 20; o pagamento da fatura muda de valor.
 */
export function atualizarLancamento(id: string, mudancas: Partial<Lancamento>) {
  const antes = lancamentos.ler().find((l) => l.id === id);
  if (!antes) return;
  const depois = { ...antes, ...mudancas };
  if (antes.metaId && (antes.efeito === "guardar" || antes.efeito === "retirar")) {
    const sinal = antes.efeito === "guardar" ? 1 : -1;
    const diferenca = (depois.valor - antes.valor) * sinal;
    if (diferenca)
      metas.gravar(metas.ler().map((m) => (m.id === antes.metaId ? { ...m, guardado: Math.max(m.guardado + diferenca, 0) } : m)));
  }
  if (antes.pagamentoFaturaId) {
    pagamentos.gravar(
      pagamentos.ler().map((p) => (p.id === antes.pagamentoFaturaId ? { ...p, valor: depois.valor, data: depois.data } : p)),
    );
  }
  lancamentos.gravar(lancamentos.ler().map((l) => (l.id === id ? depois : l)));
}

/** Desfaz o que o lançamento fez fora dele (na meta ou na fatura). */
function desfazerEfeito(l: Lancamento) {
  if (l.pagamentoFaturaId) pagamentos.gravar(pagamentos.ler().filter((p) => p.id !== l.pagamentoFaturaId));
  // Compra do mercado: some também do histórico do Mercado (gasto do mês)
  if (l.compraMercadoId) comprasMercado.gravar(comprasMercado.ler().filter((c) => c.id !== l.compraMercadoId));
  if (!l.metaId || !l.efeito) return;
  metas.gravar(
    metas.ler().map((m) => {
      if (m.id !== l.metaId) return m;
      if (l.efeito === "guardar") return { ...m, guardado: Math.max(m.guardado - l.valor, 0) };
      if (l.efeito === "retirar") return { ...m, guardado: m.guardado + l.valor };
      // Parcela: volta a contagem de parcelas pagas
      const parcelasPagas = Math.max((m.parcelasPagas ?? 0) - (l.parcelasEfeito ?? 1), 0);
      return {
        ...m,
        parcelasPagas,
        guardado: (m.parcela ?? 0) * parcelasPagas,
        ultimaParcelaPaga: parcelasPagas ? m.ultimaParcelaPaga : undefined,
      };
    }),
  );
}

/** Lançamentos que mexem em outra coisa (meta, fatura) não voltam para "a pagar": é preciso apagar (que desfaz tudo). */
export function podeReabrir(l: Lancamento) {
  return !l.pagamentoFaturaId && !l.efeito && !l.transferenciaId;
}

/** Já aconteceu de verdade? Marcado como pago/recebido e com a data de hoje ou antes. */
export function jaAconteceu(l: Lancamento, hoje = hojeISO()) {
  return l.pago && l.data <= hoje;
}

/** "Recebi" / "Paguei": confirma o lançamento. Se a data era futura, o dinheiro chegou antes: passa para hoje. */
export function confirmarLancamento(id: string) {
  const hoje = hojeISO();
  lancamentos.gravar(lancamentos.ler().map((l) => (l.id === id ? { ...l, pago: true, data: l.data > hoje ? hoje : l.data } : l)));
}

/** Volta um lançamento para "a pagar" / "a receber". */
export function reabrirLancamento(id: string) {
  const l = lancamentos.ler().find((x) => x.id === id);
  if (!l || !podeReabrir(l)) return;
  atualizarLancamento(id, { pago: false });
}

/** Remove o lançamento (numa transferência, as duas pontas) e desfaz o que ele fez na meta ou na fatura. */
export function removerLancamento(id: string) {
  const alvo = lancamentos.ler().find((l) => l.id === id);
  if (alvo) desfazerEfeito(alvo);
  lancamentos.gravar(
    lancamentos.ler().filter((l) => l.id !== id && !(alvo?.transferenciaId && l.transferenciaId === alvo.transferenciaId)),
  );
}

/** Transfere dinheiro de uma conta para outra: sai de uma e entra na outra, com a mesma data e valor. */
export function transferir(deContaId: string, paraContaId: string, valor: number, data: string, descricao: string) {
  const transferenciaId = novoId();
  const base = { valor, data, pago: true, categoria: "Transferência", transferenciaId };
  adicionarLancamento({ ...base, tipo: "saida", descricao, contaId: deContaId });
  adicionarLancamento({ ...base, tipo: "entrada", descricao, contaId: paraContaId });
}

/** Edita as duas pontas de uma transferência de uma vez. */
export function atualizarTransferencia(
  transferenciaId: string,
  dados: { deContaId: string; paraContaId: string; valor: number; data: string; descricao: string },
) {
  lancamentos.gravar(
    lancamentos.ler().map((l) =>
      l.transferenciaId !== transferenciaId
        ? l
        : {
            ...l,
            valor: dados.valor,
            data: dados.data,
            descricao: dados.descricao,
            pago: true,
            contaId: l.tipo === "saida" ? dados.deContaId : dados.paraContaId,
          },
    ),
  );
}

// ---------- Perfil (respostas do questionário) ----------

const PERFIL_PADRAO: Perfil = { concluido: false, nome: "", objetivos: [], objetivoOutro: "" };
const perfil = criarDado<Perfil>("naxxo:perfil", PERFIL_PADRAO, !TESTANDO_BOAS_VINDAS);

/** Devolve null enquanto a página ainda está carregando (antes de ler o navegador). */
export function usePerfil(): Perfil | null {
  return useSyncExternalStore(inscrever, perfil.ler, () => null);
}

export function salvarPerfil(novo: Perfil) {
  perfil.gravar(novo);
}

// ---------- Metas (a Trilha) ----------

const SEM_METAS: Meta[] = [];
const metas = criarDado<Meta[]>("naxxo:metas", SEM_METAS);

export function useMetas() {
  return useSyncExternalStore(inscrever, metas.ler, () => SEM_METAS);
}

export function adicionarMeta(nova: Omit<Meta, "id">) {
  metas.gravar([...metas.ler(), { ...nova, id: novoId() }]);
}

export function atualizarMeta(id: string, mudancas: Partial<Meta>) {
  metas.gravar(metas.ler().map((m) => (m.id === id ? { ...m, ...mudancas } : m)));
}

export function removerMeta(id: string) {
  metas.gravar(metas.ler().filter((m) => m.id !== id));
}

/**
 * Guarda (valor positivo) ou retira (negativo) dinheiro de uma meta.
 * Guardar e retirar são como transferências: o dinheiro só muda de lugar (não é gasto nem renda).
 * Não dá para retirar mais do que a meta tem. Devolve quanto realmente entrou/saiu.
 */
export function guardarNaMeta(id: string, valor: number, contaId?: string, data = hojeISO()) {
  const meta = metas.ler().find((m) => m.id === id);
  if (!meta) return 0;
  const real = valor < 0 ? -Math.min(-valor, meta.guardado) : valor;
  if (!real) return 0;
  metas.gravar(metas.ler().map((m) => (m.id === id ? { ...m, guardado: Math.max(m.guardado + real, 0) } : m)));
  // O dinheiro sai da conta (vai para a meta). Retirar da meta devolve para a conta.
  if (contaId) {
    adicionarLancamento({
      tipo: real >= 0 ? "saida" : "entrada",
      valor: Math.abs(real),
      descricao: `${real >= 0 ? "Guardei para" : "Tirei de"} ${meta.nome}`,
      categoria: "Guardar (metas)",
      data,
      pago: true,
      contaId,
      metaId: id,
      efeito: real >= 0 ? "guardar" : "retirar",
    });
  }
  return real;
}

/** Guardar e retirar de meta: o dinheiro só muda de lugar. Não é gasto nem renda. */
export function ehMovimentoDeMeta(l: Pick<Lancamento, "categoria" | "efeito">) {
  return l.categoria === "Guardar (metas)" || l.efeito === "guardar" || l.efeito === "retirar";
}

/** Meta concluída vai para o histórico de conquistas (some da lista principal). */
export function arquivarMeta(id: string, arquivada = true) {
  atualizarMeta(id, { arquivada, concluidaEm: arquivada ? hojeISO() : undefined });
}

/** Parcela: passa a deste mês para o mês que vem (com aviso de multa na tela). Nunca some em silêncio. */
export function adiarParcela(id: string, mes: string) {
  const meta = metas.ler().find((m) => m.id === id);
  if (!meta?.parcela) return;
  const proximo = somarMeses(mes, 1);
  const desteMes = meta.planoMensal?.[mes] ?? meta.parcela;
  const doProximo = meta.planoMensal?.[proximo] ?? meta.parcela;
  atualizarMeta(id, { planoMensal: { ...(meta.planoMensal ?? {}), [mes]: 0, [proximo]: doProximo + desteMes } });
}

/** Muda quanto pagar/guardar numa meta em um mês (0 = não entra na previsão desse mês; null = volta ao automático). */
export function definirPlanoDoMes(id: string, mes: string, valor: number | null) {
  metas.gravar(
    metas.ler().map((m) => {
      if (m.id !== id) return m;
      const plano = { ...(m.planoMensal ?? {}) };
      if (valor === null) delete plano[mes];
      else plano[mes] = valor;
      return { ...m, planoMensal: plano };
    }),
  );
}

/** Marca mais uma parcela como paga numa meta de quitar e registra a saída nos lançamentos. */
export function pagarParcela(id: string, contaId?: string, valor?: number) {
  const meta = metas.ler().find((m) => m.id === id);
  if (!meta || !meta.parcela || !meta.parcelas) return;
  // Já quitada: não lança saída a mais
  if ((meta.parcelasPagas ?? 0) >= meta.parcelas) return;
  const parcelasPagas = (meta.parcelasPagas ?? 0) + 1;
  atualizarMeta(id, { parcelasPagas, guardado: meta.parcela * parcelasPagas, ultimaParcelaPaga: mesAtual() });
  adicionarLancamento({
    efeito: "parcela",
    parcelasEfeito: 1,
    tipo: "saida",
    valor: valor ?? meta.parcela,
    descricao: `${meta.nome} (${parcelasPagas}/${meta.parcelas})`,
    categoria: "Parcelas e dívidas",
    data: hojeISO(),
    pago: true,
    contaId: contaId ?? meta.contaId,
    metaId: meta.id,
  });
}

/** Adianta as últimas parcelas de uma meta de quitar, guardando quanto economizou de juros e registrando a saída. */
export function registrarAdiantamento(id: string, quantas: number, economia: number, valorPago: number, contaId?: string) {
  const meta = metas.ler().find((m) => m.id === id);
  if (!meta || !meta.parcela || !meta.parcelas) return;
  const parcelasPagas = Math.min((meta.parcelasPagas ?? 0) + quantas, meta.parcelas);
  const efetivas = parcelasPagas - (meta.parcelasPagas ?? 0);
  if (efetivas <= 0) return;
  atualizarMeta(id, {
    parcelasPagas,
    guardado: meta.parcela * parcelasPagas,
    economizado: (meta.economizado ?? 0) + economia,
  });
  adicionarLancamento({
    tipo: "saida",
    valor: valorPago,
    descricao: `${meta.nome} (adiantou ${efetivas} parcela${efetivas > 1 ? "s" : ""})`,
    categoria: "Parcelas e dívidas",
    data: hojeISO(),
    contaId: contaId ?? meta.contaId,
    metaId: meta.id,
    pago: true,
    efeito: "parcela",
    parcelasEfeito: efetivas,
  });
}

// ---------- Desejos (coisas pequenas: perfume, restaurante, roupa…) ----------

export type Desejo = { id: string; nome: string; icone: string; valor: number; criadoEm: string };

const SEM_DESEJOS: Desejo[] = [];
const desejos = criarDado<Desejo[]>("naxxo:desejos", SEM_DESEJOS);

export function useDesejos() {
  return useSyncExternalStore(inscrever, desejos.ler, () => SEM_DESEJOS);
}

export function adicionarDesejo(novo: Omit<Desejo, "id" | "criadoEm">) {
  desejos.gravar([...desejos.ler(), { ...novo, id: novoId(), criadoEm: hojeISO() }]);
}

export function removerDesejo(id: string) {
  desejos.gravar(desejos.ler().filter((d) => d.id !== id));
}

// ---------- Fontes de renda ----------

const SEM_FONTES: FonteRenda[] = [];
const fontes = criarDado<FonteRenda[]>("naxxo:fontes", SEM_FONTES);

export function useFontes() {
  return useSyncExternalStore(inscrever, fontes.ler, () => SEM_FONTES);
}

export function adicionarFonte(nova: Omit<FonteRenda, "id">) {
  fontes.gravar([...fontes.ler(), { ...nova, id: novoId() }]);
}

export function atualizarFonte(id: string, mudancas: Partial<FonteRenda>) {
  fontes.gravar(fontes.ler().map((f) => (f.id === id ? { ...f, ...mudancas } : f)));
}

export function removerFonte(id: string) {
  fontes.gravar(fontes.ler().filter((f) => f.id !== id));
}

// ---------- Gastos fixos ----------

const SEM_FIXOS: GastoFixo[] = [];
const fixos = criarDado<GastoFixo[]>("naxxo:fixos", SEM_FIXOS);

export function useGastosFixos() {
  return useSyncExternalStore(inscrever, fixos.ler, () => SEM_FIXOS);
}

export function adicionarGastoFixo(novo: Omit<GastoFixo, "id">) {
  const id = novoId();
  fixos.gravar([...fixos.ler(), { ...novo, criadoEm: novo.criadoEm ?? hojeISO(), id }]);
  return id;
}

export function atualizarGastoFixo(id: string, mudancas: Partial<GastoFixo>) {
  fixos.gravar(fixos.ler().map((f) => (f.id === id ? { ...f, ...mudancas } : f)));
}

export function removerGastoFixo(id: string) {
  fixos.gravar(fixos.ler().filter((f) => f.id !== id));
}

/** Marca um gasto fixo como pago: vira uma saída nos lançamentos, ligada a ele. */
/**
 * Paga um gasto fixo. `competencia` é o mês da conta (ex.: o aluguel de setembro pago em outubro):
 * a data real do pagamento fica como foi, e o fixo fica pago no mês certo.
 */
export function pagarGastoFixo(
  fixo: GastoFixo,
  valor: number,
  data: string,
  contaId?: string,
  cartaoId?: string,
  competencia = data.slice(0, 7),
) {
  const categoria = CATEGORIAS_FIXO.find((c) => c.id === fixo.categoria)?.categoriaLancamento ?? "Outros";
  // Pago no crédito: vai para a fatura do cartão (e o fixo fica pago no mês)
  if (cartaoId) {
    adicionarCompra({
      cartaoId,
      descricao: fixo.nome,
      categoria,
      valorTotal: valor,
      parcelas: 1,
      data,
      gastoFixoId: fixo.id,
      competencia,
    });
    return;
  }
  adicionarLancamento({
    tipo: "saida",
    valor,
    descricao: fixo.nome,
    categoria,
    data,
    pago: true,
    gastoFixoId: fixo.id,
    contaId: contaId ?? fixo.contaId,
    competencia,
  });
}

// ---------- Cartões ----------

const SEM_CARTOES: Cartao[] = [];
const cartoes = criarDado<Cartao[]>("naxxo:cartoes", SEM_CARTOES);

export function useCartoes() {
  return useSyncExternalStore(inscrever, cartoes.ler, () => SEM_CARTOES);
}

export function adicionarCartao(novo: Omit<Cartao, "id">) {
  const id = novoId();
  cartoes.gravar([...cartoes.ler(), { ...novo, id }]);
  return id;
}

export function atualizarCartao(id: string, mudancas: Partial<Cartao>) {
  cartoes.gravar(cartoes.ler().map((c) => (c.id === id ? { ...c, ...mudancas } : c)));
}

/** A pessoa informa quanto tem na conta agora: daqui para frente, o saldo segue sozinho. */
export function informarSaldo(id: string, saldo: number | null) {
  atualizarCartao(id, { saldo, saldoAtualizadoEm: agoraLocal() });
}

/** Escolhe a conta de vários lançamentos de uma vez (ex.: os antigos, que não tinham conta). */
export function definirContaDosLancamentos(ids: string[], contaId: string) {
  lancamentos.gravar(lancamentos.ler().map((l) => (ids.includes(l.id) ? { ...l, contaId } : l)));
}

/** O que fica ligado a uma conta (para avisar antes de excluir). */
export function vinculosDaConta(id: string) {
  return {
    lancamentos: lancamentos.ler().filter((l) => l.contaId === id).length,
    compras: compras.ler().filter((c) => c.cartaoId === id).length,
    fixos: fixos.ler().filter((f) => f.cartaoId === id || f.contaId === id).length,
    metas: metas.ler().filter((m) => m.contaId === id).length,
    fontes: fontes.ler().filter((f) => f.contaId === id || (f.beneficios ?? []).some((b) => b.contaId === id)).length,
  };
}

/**
 * Remove a conta sem deixar nada solto. Com `destinoId`, tudo o que era dela passa para a outra conta
 * (lançamentos, gastos fixos, metas, rendas). Sem destino, os lançamentos ficam "sem conta" (para escolher depois).
 * Compras no cartão saem; as assinaturas do cartão passam a sair da conta de destino (débito).
 */
export function removerCartao(id: string, destinoId?: string) {
  const pagamentosDaConta = new Set(
    pagamentos
      .ler()
      .filter((p) => p.cartaoId === id)
      .map((p) => p.id),
  );
  lancamentos.gravar(
    lancamentos.ler().map((l) => {
      let novo = l;
      // O pagamento da fatura deste cartão deixa de existir: o lançamento vira uma saída comum
      if (l.pagamentoFaturaId && pagamentosDaConta.has(l.pagamentoFaturaId)) novo = { ...novo, pagamentoFaturaId: undefined };
      if (l.contaId === id) novo = { ...novo, contaId: destinoId };
      return novo;
    }),
  );
  cartoes.gravar(cartoes.ler().filter((c) => c.id !== id));
  compras.gravar(compras.ler().filter((c) => c.cartaoId !== id));
  pagamentos.gravar(pagamentos.ler().filter((p) => p.cartaoId !== id));
  fixos.gravar(
    fixos.ler().map((f) => {
      if (f.cartaoId === id) return { ...f, pagamento: "debito" as const, cartaoId: undefined, contaId: destinoId };
      if (f.contaId === id) return { ...f, contaId: destinoId };
      return f;
    }),
  );
  metas.gravar(metas.ler().map((m) => (m.contaId === id ? { ...m, contaId: destinoId } : m)));
  fontes.gravar(
    fontes.ler().map((f) => ({
      ...f,
      contaId: f.contaId === id ? destinoId : f.contaId,
      beneficios: f.beneficios?.map((b) => (b.contaId === id ? { ...b, contaId: undefined } : b)),
    })),
  );
}

/** Compras do cartão que ainda têm parcelas para pagar (impedem desligar o crédito). */
export function comprasEmAberto(cartaoId: string) {
  return compras.ler().filter((c) => c.cartaoId === cartaoId && (c.parcelasPagas ?? 0) < c.parcelas);
}

/** Desliga o cartão de crédito: as assinaturas que eram nele passam a sair da conta (débito). */
export function moverAssinaturasParaDebito(cartaoId: string) {
  fixos.gravar(
    fixos
      .ler()
      .map((f) => (f.cartaoId === cartaoId ? { ...f, pagamento: "debito" as const, cartaoId: undefined, contaId: cartaoId } : f)),
  );
}

const SEM_COMPRAS: CompraCartao[] = [];
const compras = criarDado<CompraCartao[]>("naxxo:compras", SEM_COMPRAS);

export function useCompras() {
  return useSyncExternalStore(inscrever, compras.ler, () => SEM_COMPRAS);
}

export function adicionarCompras(novas: Omit<CompraCartao, "id">[]) {
  compras.gravar([...novas.map((n) => ({ ...n, id: novoId() })), ...compras.ler()]);
}

export function adicionarCompra(nova: Omit<CompraCartao, "id">) {
  compras.gravar([{ ...nova, id: novoId() }, ...compras.ler()]);
}

export function atualizarCompra(id: string, mudancas: Partial<CompraCartao>) {
  compras.gravar(compras.ler().map((c) => (c.id === id ? { ...c, ...mudancas } : c)));
}

export function removerCompra(id: string) {
  const alvo = compras.ler().find((c) => c.id === id);
  if (alvo?.compraMercadoId) comprasMercado.gravar(comprasMercado.ler().filter((c) => c.id !== alvo.compraMercadoId));
  compras.gravar(compras.ler().filter((c) => c.id !== id));
}

/** Foi no crédito, não no débito: o lançamento sai da conta e vira uma compra na fatura do cartão. */
export function lancamentoParaCredito(id: string, cartaoId: string, parcelas: number, mudancas: Partial<Lancamento> = {}) {
  const l = lancamentos.ler().find((x) => x.id === id);
  if (!l) return;
  const final = { ...l, ...mudancas };
  lancamentos.gravar(lancamentos.ler().filter((x) => x.id !== id));
  adicionarCompra({
    cartaoId,
    descricao: final.descricao,
    categoria: final.categoria,
    valorTotal: final.valor,
    parcelas,
    data: final.data,
    gastoFixoId: final.gastoFixoId,
    competencia: final.competencia,
    metaId: final.metaId,
    compraMercadoId: final.compraMercadoId,
    subcategoria: final.subcategoria,
  });
}

/** Foi no débito/Pix, não no crédito: a compra sai da fatura e vira uma saída da conta. */
export function compraParaDebito(id: string, contaId: string, mudancas: Partial<CompraCartao> = {}) {
  const c = compras.ler().find((x) => x.id === id);
  if (!c) return;
  const final = { ...c, ...mudancas };
  compras.gravar(compras.ler().filter((x) => x.id !== id));
  adicionarLancamento({
    tipo: "saida",
    valor: final.valorTotal,
    descricao: final.descricao,
    categoria: final.categoria,
    data: final.data,
    pago: final.data <= hojeISO(),
    contaId,
    gastoFixoId: final.gastoFixoId,
    competencia: final.competencia,
    compraMercadoId: final.compraMercadoId,
    subcategoria: final.subcategoria,
  });
}

const SEM_PAGAMENTOS: PagamentoFatura[] = [];
const pagamentos = criarDado<PagamentoFatura[]>("naxxo:pagamentos-fatura", SEM_PAGAMENTOS);

export function usePagamentosFatura() {
  return useSyncExternalStore(inscrever, pagamentos.ler, () => SEM_PAGAMENTOS);
}

/**
 * Paga (toda ou parte de) uma fatura: registra o pagamento e a saída nos lançamentos.
 * Com `descontarDoSaldo`, tira o valor do saldo em conta daquele banco.
 */
export function pagarFatura(cartao: Cartao, fatura: string, valor: number, data: string, contaId?: string) {
  const pagamentoId = novoId();
  pagamentos.gravar([...pagamentos.ler(), { id: pagamentoId, cartaoId: cartao.id, fatura, valor, data }]);
  // O dinheiro sai da conta escolhida (normalmente a do próprio banco do cartão)
  adicionarLancamento({
    contaId: contaId ?? cartao.id,
    tipo: "saida",
    valor,
    descricao: `Fatura ${cartao.nome}`,
    categoria: "Fatura do cartão",
    data,
    pago: true,
    cartaoId: cartao.id,
    fatura,
    pagamentoFaturaId: pagamentoId,
  });
}

// ---------- Mercado ----------

const SEM_ITENS: ItemMercado[] = [];
const itensMercado = criarDado<ItemMercado[]>("naxxo:mercado-itens", SEM_ITENS);

export function useItensMercado() {
  return useSyncExternalStore(inscrever, itensMercado.ler, () => SEM_ITENS);
}

export function atualizarItemMercado(id: string, mudancas: Partial<ItemMercado>) {
  itensMercado.gravar(itensMercado.ler().map((i) => (i.id === id ? { ...i, ...mudancas } : i)));
}

export function removerItemMercado(id: string) {
  itensMercado.gravar(itensMercado.ler().filter((i) => i.id !== id));
}

const SEM_COMPRAS_MERCADO: CompraMercado[] = [];
const comprasMercado = criarDado<CompraMercado[]>("naxxo:mercado-compras", SEM_COMPRAS_MERCADO);

export function useComprasMercado() {
  return useSyncExternalStore(inscrever, comprasMercado.ler, () => SEM_COMPRAS_MERCADO);
}

export type ItemDaCompra = Omit<ItemMercado, "id" | "ultimaCompra">;

/** Texto sem acento e em minúsculas: "Açúcar" e "acucar" são o mesmo produto. */
export function semAcento(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

const mesmoNome = (a: string, b: string) => semAcento(a) === semAcento(b);

/**
 * Registra uma ida ao mercado: atualiza (ou cria) cada item na despensa com a nova data e preço,
 * guarda a compra no histórico, tira os itens da lista de compras
 * e lança o total como saída (débito) ou como compra no cartão (crédito).
 */
export function registrarCompraMercado(dados: {
  data: string;
  tipo: "mes" | "avulsa";
  itens: ItemDaCompra[];
  credito?: { cartaoId: string; parcelas: number };
  contaId?: string; // no débito: de qual conta saiu
}) {
  let despensa = itensMercado.ler();
  const itensDaCompra: CompraMercado["itens"] = [];

  for (const item of dados.itens) {
    salvarOpcaoMercado(item);
    const existente = despensa.find((i) => mesmoNome(i.nome, item.nome));
    if (existente) {
      let duracao: Pick<ItemMercado, "duracao" | "unidade" | "origemDuracao">;
      const diasDesdeAUltima = diasEntre(existente.ultimaCompra, dados.data);
      if (item.duracao !== null) {
        duracao = { duracao: item.duracao, unidade: item.unidade, origemDuracao: "informada" };
      } else if (existente.duracao !== null) {
        // Já sabia quanto dura: mantém
        duracao = { duracao: existente.duracao, unidade: existente.unidade, origemDuracao: existente.origemDuracao };
      } else if (diasDesdeAUltima > 0) {
        // Não sabia quanto durava? O tempo desde a última compra é uma boa pista (falta a pessoa confirmar)
        duracao = { ...melhorUnidade(diasDesdeAUltima), origemDuracao: "calculada" };
      } else {
        duracao = { duracao: null, unidade: item.unidade, origemDuracao: undefined };
      }
      despensa = despensa.map((i) => (i.id === existente.id ? { ...i, ...item, ...duracao, ultimaCompra: dados.data } : i));
      itensDaCompra.push({ itemId: existente.id, nome: item.nome, valor: item.valor });
    } else {
      // Sem duração informada: usa a das sugestões (ex.: arroz 2 meses) como ponto de partida, para a pessoa só confirmar
      const sugestao = item.duracao === null ? SUGESTOES_MERCADO.find((s) => mesmoNome(s.nome, item.nome)) : undefined;
      const novo: ItemMercado = {
        ...item,
        ...(sugestao ? { duracao: sugestao.duracao, unidade: sugestao.unidade } : {}),
        id: novoId(),
        ultimaCompra: dados.data,
        origemDuracao: item.duracao !== null ? "informada" : sugestao ? "calculada" : undefined,
      };
      despensa = [...despensa, novo];
      itensDaCompra.push({ itemId: novo.id, nome: item.nome, valor: item.valor });
    }
  }
  itensMercado.gravar(despensa);

  const total = dados.itens.reduce((t, i) => t + i.valor, 0);
  const compraMercadoId = novoId();
  comprasMercado.gravar([
    {
      id: compraMercadoId,
      data: dados.data,
      total,
      itens: itensDaCompra,
      cartaoId: dados.credito?.cartaoId,
      contaId: dados.contaId,
      tipo: dados.tipo,
    },
    ...comprasMercado.ler(),
  ]);

  // O que foi comprado sai da lista de compras; se a lista acabou, o planejamento também
  const sobrou = listaCompras.ler().filter((l) => !dados.itens.some((i) => mesmoNome(i.nome, l.nome)));
  listaCompras.gravar(sobrou);
  if (sobrou.length === 0) compraPlanejada.gravar({ data: null });

  const quantos = `${dados.itens.length} ${dados.itens.length === 1 ? "item" : "itens"}`;
  const descricao = dados.tipo === "mes" ? `Compra do mês · ${quantos}` : `Mercado · ${quantos}`;
  if (dados.credito) {
    adicionarCompra({
      cartaoId: dados.credito.cartaoId,
      descricao,
      categoria: "Mercado",
      valorTotal: total,
      parcelas: dados.credito.parcelas,
      data: dados.data,
      compraMercadoId,
    });
  } else {
    // Compra programada (data no futuro) fica como prevista e vira saída sozinha quando o dia chegar
    adicionarLancamento({
      tipo: "saida",
      valor: total,
      descricao,
      categoria: "Mercado",
      data: dados.data,
      pago: true,
      contaId: dados.contaId,
      compraMercadoId,
    });
  }
}

/** "Acabou": calcula quanto o item durou de verdade e usa isso como duração dali em diante. */
export function marcarItemAcabou(id: string, dataQueAcabou: string) {
  const item = itensMercado.ler().find((i) => i.id === id);
  if (!item) return null;
  const dias = diasEntre(item.ultimaCompra, dataQueAcabou);
  if (dias < 1) return null;
  const nova = melhorUnidade(dias);
  atualizarItemMercado(id, { ...nova, origemDuracao: "informada" });
  return nova;
}

/** A pessoa diz (ou confirma) quanto o item dura. */
export function definirDuracaoItem(id: string, duracao: number, unidade: UnidadeDuracao) {
  atualizarItemMercado(id, { duracao, unidade, origemDuracao: "informada" });
}

// Produtos que a pessoa já usou (ficam como opção para sempre)
const SEM_OPCOES: OpcaoMercado[] = [];
const opcoesMercado = criarDado<OpcaoMercado[]>("naxxo:mercado-opcoes", SEM_OPCOES);

export function useOpcoesMercado() {
  return useSyncExternalStore(inscrever, opcoesMercado.ler, () => SEM_OPCOES);
}

/** Guarda um produto novo como opção (se ainda não for uma sugestão nem já estiver salvo). */
export function salvarOpcaoMercado(opcao: OpcaoMercado) {
  const nome = opcao.nome.trim();
  if (!nome) return;
  const jaExiste =
    SUGESTOES_MERCADO.some((s) => mesmoNome(s.nome, nome)) || opcoesMercado.ler().some((o) => mesmoNome(o.nome, nome));
  if (jaExiste) return;
  opcoesMercado.gravar([
    ...opcoesMercado.ler(),
    { nome, icone: opcao.icone, categoria: opcao.categoria, quantidade: opcao.quantidade ?? "" },
  ]);
}

// Lista de compras (só nomes)
const LISTA_VAZIA: ItemLista[] = [];
const listaCompras = criarDado<ItemLista[]>("naxxo:mercado-lista", LISTA_VAZIA);

export function lerListaDeCompras() {
  return listaCompras.ler();
}

export function useListaCompras() {
  return useSyncExternalStore(inscrever, listaCompras.ler, () => LISTA_VAZIA);
}

/** Põe um item na lista (ou atualiza, se já estiver lá). Itens novos viram sugestão para as próximas vezes. */
export function adicionarNaLista(
  item: Pick<ItemLista, "nome" | "icone" | "categoria"> & Partial<Omit<ItemLista, "id">>,
  jaPeguei = false,
) {
  const nome = item.nome.trim();
  if (!nome) return;
  salvarOpcaoMercado({
    nome,
    icone: item.icone,
    categoria: item.categoria,
    quantidade: item.qtd ? `${item.qtd} ${item.unidadeQtd ?? "un"}` : "",
  });
  const existente = listaCompras.ler().find((l) => mesmoNome(l.nome, nome));
  if (existente) return atualizarItemLista(existente.id, { ...item, nome });
  listaCompras.gravar([...listaCompras.ler(), { noCarrinho: jaPeguei, ...item, nome, id: novoId() }]);
}

/** Total de um item da lista: preço (por unidade/kg/L) × quantidade. */
export function totalDoItemLista(l: Pick<ItemLista, "valor" | "qtd">) {
  const preco = lerValor(l.valor ?? "") || 0;
  const qtd = lerValor(l.qtd ?? "") || 1;
  return Math.round(preco * qtd * 100) / 100;
}

/** A duração na lista é de CADA unidade (ou kg/litro): em casa, dura isso × a quantidade. */
export function duracaoTotal(l: Pick<ItemLista, "duracao" | "unidadeDuracao" | "qtd" | "unidadeQtd">) {
  const porUnidade = Number(l.duracao);
  if (!(porUnidade > 0)) return { duracao: null, unidade: l.unidadeDuracao ?? ("meses" as UnidadeDuracao) };
  const qtd = lerValor(l.qtd ?? "") || 1;
  const dias = Math.max(Math.round(porUnidade * DIAS_POR_UNIDADE[l.unidadeDuracao ?? "meses"] * qtd), 1);
  return melhorUnidade(dias);
}

/**
 * "Comprei": o item sai da lista, vai para a despensa e entra no gasto de hoje.
 * Vários itens comprados no mesmo dia (na mesma conta) viram uma compra só nos lançamentos.
 */
export function comprarItemDaLista(id: string, contaId?: string, data = hojeISO()) {
  const l = listaCompras.ler().find((x) => x.id === id);
  if (!l) return;
  const valor = totalDoItemLista(l);
  const item: ItemDaCompra = {
    nome: l.nome,
    icone: l.icone,
    categoria: l.categoria,
    quantidade: l.qtd ? `${l.qtd} ${l.unidadeQtd ?? "un"}` : "",
    valor,
    ...duracaoTotal(l),
    repor: true,
  };
  const deHoje = comprasMercado.ler().find((c) => c.data === data && c.tipo === "avulsa" && !c.cartaoId && c.contaId === contaId);
  const lancamento = deHoje && lancamentos.ler().find((x) => x.compraMercadoId === deHoje.id);
  if (!deHoje || !lancamento) {
    registrarCompraMercado({ data, tipo: "avulsa", itens: [item], contaId });
    return;
  }
  // Junta na compra de hoje: atualiza a despensa, a compra e o lançamento
  registrarItemNaDespensa(item, data);
  const itens = [
    ...deHoje.itens,
    { itemId: itensMercado.ler().find((i) => mesmoNome(i.nome, item.nome))?.id ?? "", nome: item.nome, valor },
  ];
  const total = deHoje.total + valor;
  comprasMercado.gravar(comprasMercado.ler().map((c) => (c.id === deHoje.id ? { ...c, itens, total } : c)));
  lancamentos.gravar(
    lancamentos
      .ler()
      .map((x) =>
        x.id === lancamento.id ? { ...x, valor: Math.round(total * 100) / 100, descricao: `Mercado · ${itens.length} itens` } : x,
      ),
  );
  listaCompras.gravar(listaCompras.ler().filter((x) => x.id !== id));
}

/** Atualiza (ou cria) um item na despensa com a compra de hoje. */
function registrarItemNaDespensa(item: ItemDaCompra, data: string) {
  salvarOpcaoMercado(item);
  const existente = itensMercado.ler().find((i) => mesmoNome(i.nome, item.nome));
  if (existente) {
    const duracao =
      item.duracao !== null ? { duracao: item.duracao, unidade: item.unidade, origemDuracao: "informada" as const } : {};
    atualizarItemMercado(existente.id, {
      ...item,
      duracao: existente.duracao,
      unidade: existente.unidade,
      ...duracao,
      ultimaCompra: data,
    });
  } else {
    itensMercado.gravar([
      ...itensMercado.ler(),
      { ...item, id: novoId(), ultimaCompra: data, origemDuracao: item.duracao !== null ? "informada" : undefined },
    ]);
  }
}

/** "Acabou hoje": aprende quanto durou e o item volta para a lista de compras (com quantidade e preço da última vez). */
export function acabouHoje(id: string) {
  const item = itensMercado.ler().find((i) => i.id === id);
  if (!item) return;
  marcarItemAcabou(id, hojeISO());
  const [qtd, unidade] = item.quantidade.split(" ");
  const numero = lerValor(qtd ?? "") || 1;
  adicionarNaLista({
    nome: item.nome,
    icone: item.icone,
    categoria: item.categoria,
    qtd: qtd && lerValor(qtd) ? qtd : undefined,
    unidadeQtd: (UNIDADES_QTD as string[]).includes(unidade) ? (unidade as UnidadeQtd) : undefined,
    valor: item.valor ? String(Math.round((item.valor / numero) * 100) / 100).replace(".", ",") : undefined,
  });
}

export function alternarNoCarrinho(id: string) {
  listaCompras.gravar(listaCompras.ler().map((l) => (l.id === id ? { ...l, noCarrinho: !l.noCarrinho } : l)));
}

// Dia em que a pessoa planeja ir ao mercado (a lista vira gasto previsto nesse dia)
const compraPlanejada = criarDado<{ data: string | null }>("naxxo:mercado-plano", { data: null });
const SEM_PLANO = { data: null };

export function useCompraPlanejada() {
  return useSyncExternalStore(inscrever, compraPlanejada.ler, () => SEM_PLANO);
}

export function planejarCompra(data: string | null) {
  compraPlanejada.gravar({ data });
}

/** Põe um item na despensa sem registrar compra (ex.: algo que já estava em casa). */
export function adicionarNaDespensa(item: Omit<ItemMercado, "id">) {
  salvarOpcaoMercado(item);
  const existente = itensMercado.ler().find((i) => mesmoNome(i.nome, item.nome));
  if (existente) atualizarItemMercado(existente.id, item);
  else itensMercado.gravar([...itensMercado.ler(), { ...item, id: novoId() }]);
}

/** Vai salvando o que a pessoa preenche no mercado (quantidade, valor, duração). */
export function atualizarItemLista(id: string, mudancas: Partial<ItemLista>) {
  listaCompras.gravar(listaCompras.ler().map((l) => (l.id === id ? { ...l, ...mudancas } : l)));
}

/**
 * Exclui um item de "em casa" de vez: some da despensa e da lista, e a compra dele é desfeita
 * (sai do gasto do mercado; o valor volta para a conta ou sai da fatura).
 */
export function excluirDaDespensa(id: string) {
  const item = itensMercado.ler().find((i) => i.id === id);
  if (!item) return;
  itensMercado.gravar(itensMercado.ler().filter((i) => i.id !== id));
  listaCompras.gravar(listaCompras.ler().filter((l) => !mesmoNome(l.nome, item.nome)));
  for (const c of comprasMercado.ler()) {
    const doItem = c.itens.filter((x) => x.itemId === id || mesmoNome(x.nome, item.nome));
    if (doItem.length === 0) continue;
    const resto = c.itens.filter((x) => !doItem.includes(x));
    const total = Math.round((c.total - doItem.reduce((t, x) => t + x.valor, 0)) * 100) / 100;
    const lancamento = lancamentos.ler().find((l) => l.compraMercadoId === c.id);
    const compra = compras.ler().find((x) => x.compraMercadoId === c.id);
    if (resto.length === 0 || total <= 0) {
      comprasMercado.gravar(comprasMercado.ler().filter((x) => x.id !== c.id));
      if (lancamento) lancamentos.gravar(lancamentos.ler().filter((l) => l.id !== lancamento.id));
      if (compra) compras.gravar(compras.ler().filter((x) => x.id !== compra.id));
      continue;
    }
    const descricao = `Mercado · ${resto.length} ${resto.length === 1 ? "item" : "itens"}`;
    comprasMercado.gravar(comprasMercado.ler().map((x) => (x.id === c.id ? { ...x, itens: resto, total } : x)));
    if (lancamento)
      lancamentos.gravar(lancamentos.ler().map((l) => (l.id === lancamento.id ? { ...l, valor: total, descricao } : l)));
    if (compra) compras.gravar(compras.ler().map((x) => (x.id === compra.id ? { ...x, valorTotal: total, descricao } : x)));
  }
}

/** Exclui o item de tudo: da lista e de "em casa" (despensa). As compras já feitas continuam nos lançamentos. */
export function excluirItemDeTudo(id: string) {
  const l = listaCompras.ler().find((x) => x.id === id);
  if (!l) return;
  listaCompras.gravar(listaCompras.ler().filter((x) => x.id !== id));
  const naDespensa = itensMercado.ler().find((i) => mesmoNome(i.nome, l.nome));
  if (naDespensa) excluirDaDespensa(naDespensa.id);
}

/** Preço por unidade a partir do total (ou o contrário): "o que for, serve para todos". */
export function precoPorUnidade(total: number, qtd: string | undefined) {
  const q = lerValor(qtd ?? "") || 1;
  return Math.round((total / q) * 100) / 100;
}

export function removerDaLista(id: string) {
  listaCompras.gravar(listaCompras.ler().filter((l) => l.id !== id));
}

// ---------- Questionário de boas-vindas ----------

export function concluirBoasVindas(dados: {
  perfil: Omit<Perfil, "concluido">;
  fontes: Omit<FonteRenda, "id">[];
  metas: Omit<Meta, "id">[];
}) {
  fontes.gravar(dados.fontes.map((f) => ({ ...f, id: novoId() })));
  // Meta sem valor não é salva (evita "R$ 0,00 de R$ 0,00")
  metas.gravar(dados.metas.filter((m) => m.alvo > 0).map((m) => ({ ...m, id: novoId() })));
  perfil.gravar({ ...dados.perfil, concluido: true });
}

/** Apaga as respostas, metas e fontes de renda (os lançamentos continuam). */
export function recomecarBoasVindas() {
  fontes.gravar(SEM_FONTES);
  metas.gravar(SEM_METAS);
  perfil.gravar(PERFIL_PADRAO);
}

// ---------- Mês selecionado (o "‹ Outubro 2026 ›" do topo) ----------

const MES_INICIAL = mesAtual();
let mesSelecionado = MES_INICIAL;

export function useMes() {
  return useSyncExternalStore(
    inscrever,
    () => mesSelecionado,
    () => MES_INICIAL,
  );
}

export function mudarMes(quantidade: number) {
  mesSelecionado = somarMeses(mesSelecionado, quantidade);
  avisar();
}

export function irParaMes(mes: string) {
  mesSelecionado = mes;
  avisar();
}

// ---------- Contas ----------

export function doMes(lista: Lancamento[], mes: string) {
  return lista.filter((l) => l.data.startsWith(mes));
}

export function somar(lista: { valor: number }[]) {
  return lista.reduce((total, item) => total + item.valor, 0);
}

export function maisRecentesPrimeiro(a: Lancamento, b: Lancamento) {
  return b.data.localeCompare(a.data);
}

// ---------- Categorias personalizadas (e subcategorias) ----------

/** Categoria criada pela pessoa (ex.: Pet, Beleza). Com `pai`, é uma subcategoria (ex.: Lazer › Cinema). */
export type CategoriaPersonalizada = { id: string; tipo: Tipo; nome: string; icone: string; pai?: string };

const SEM_CATEGORIAS: CategoriaPersonalizada[] = [];
const categoriasPersonalizadas = criarDado<CategoriaPersonalizada[]>("naxxo:categorias", SEM_CATEGORIAS);

export function useCategoriasPersonalizadas() {
  return useSyncExternalStore(inscrever, categoriasPersonalizadas.ler, () => SEM_CATEGORIAS);
}

export function adicionarCategoria(nova: Omit<CategoriaPersonalizada, "id">) {
  const nome = nova.nome.trim();
  if (!nome) return;
  const existe =
    (!nova.pai && CATEGORIAS[nova.tipo].some((c) => semAcento(c.nome) === semAcento(nome))) ||
    categoriasPersonalizadas
      .ler()
      .some((c) => c.tipo === nova.tipo && c.pai === nova.pai && semAcento(c.nome) === semAcento(nome));
  if (existe) return;
  categoriasPersonalizadas.gravar([...categoriasPersonalizadas.ler(), { ...nova, nome, id: novoId() }]);
}

export function removerCategoria(id: string) {
  categoriasPersonalizadas.gravar(categoriasPersonalizadas.ler().filter((c) => c.id !== id));
}

/** Todas as categorias de um tipo: as do app + as criadas pela pessoa. */
export function categoriasDe(tipo: Tipo, personalizadas: CategoriaPersonalizada[] = categoriasPersonalizadas.ler()) {
  return [
    ...CATEGORIAS[tipo],
    ...personalizadas.filter((c) => c.tipo === tipo && !c.pai).map((c) => ({ nome: c.nome, icone: c.icone })),
  ];
}

/** Subcategorias de uma categoria (ex.: Lazer → Cinema, Bar). */
export function subcategoriasDe(
  tipo: Tipo,
  categoria: string,
  personalizadas: CategoriaPersonalizada[] = categoriasPersonalizadas.ler(),
) {
  return personalizadas.filter((c) => c.tipo === tipo && c.pai === categoria);
}

// ---------- Orçamento por categoria (limite por mês) ----------

const SEM_ORCAMENTO: Record<string, number> = {};
const orcamentos = criarDado<Record<string, number>>("naxxo:orcamentos", SEM_ORCAMENTO);

export function useOrcamentos() {
  return useSyncExternalStore(inscrever, orcamentos.ler, () => SEM_ORCAMENTO);
}

/** Define o limite por mês de uma categoria (null tira o limite). */
export function definirOrcamento(categoria: string, valor: number | null) {
  const novo = { ...orcamentos.ler() };
  if (valor === null || !(valor > 0)) delete novo[categoria];
  else novo[categoria] = valor;
  orcamentos.gravar(novo);
}

// ---------- Preferências ----------

export type Preferencias = {
  tema: "auto" | "escuro" | "claro";
  lembretes: boolean; // avisos de contas que vencem (notificação no celular)
  necessidades?: string[]; // categorias que a pessoa considera necessidade (regra 50/30/20)
  ultimaConta?: string; // a última conta usada no "+" (já vem marcada na próxima vez)
  lembradoEm?: string; // último dia em que os lembretes foram mostrados
  checklistFechado?: boolean; // escondeu os "Primeiros passos" do Início
  semCartao?: boolean; // disse que não tem cartão de crédito
};

const PREFERENCIAS_PADRAO: Preferencias = { tema: "escuro", lembretes: false };
const preferencias = criarDado<Preferencias>("naxxo:preferencias", PREFERENCIAS_PADRAO);

export function usePreferencias() {
  return useSyncExternalStore(inscrever, preferencias.ler, () => PREFERENCIAS_PADRAO);
}

export function lerPreferencias() {
  return preferencias.ler();
}

export function mudarPreferencias(mudancas: Partial<Preferencias>) {
  preferencias.gravar({ ...preferencias.ler(), ...mudancas });
}

// ---------- Versão dos dados e migração ----------

/**
 * Atualiza dados salvos por versões antigas do app (roda uma vez por versão).
 * v2: liga lançamentos ao que eles fizeram (meta, fatura, mercado, renda), guarda o mês do gasto fixo
 *     e passa datas em UTC para a hora local.
 */
export function migrarDados() {
  if (typeof window === "undefined") return;
  let versao = 1;
  try {
    versao = Number(localStorage.getItem("naxxo:versao") ?? "1") || 1;
  } catch {
    return;
  }
  if (versao >= VERSAO_DOS_DADOS) return;

  const listaPagamentos = [...pagamentos.ler()];
  const usados = new Set(
    lancamentos
      .ler()
      .map((l) => l.pagamentoFaturaId)
      .filter(Boolean),
  );
  const listaFontes = fontes.ler();
  const listaMercado = comprasMercado.ler();
  const mercadoDaCompra = (data: string, total: number) =>
    listaMercado.find((c) => c.data === data && Math.abs(c.total - total) < 0.01)?.id;

  lancamentos.gravar(
    lancamentos.ler().map((l) => {
      const n: Lancamento = { ...l, criadoEm: paraHoraLocal(l.criadoEm) };
      if (n.metaId && !n.efeito) {
        if (n.categoria === "Guardar (metas)") n.efeito = n.tipo === "saida" ? "guardar" : "retirar";
        else if (n.tipo === "entrada" && n.descricao.startsWith("Tirei de")) {
          n.categoria = "Guardar (metas)";
          n.efeito = "retirar";
        } else if (n.categoria === "Parcelas e dívidas") {
          n.efeito = "parcela";
          n.parcelasEfeito = Number(n.descricao.match(/adiantou (\d+)/)?.[1] ?? 1);
        }
      }
      if (n.cartaoId && n.fatura && !n.pagamentoFaturaId) {
        const p = listaPagamentos.find(
          (x) => !usados.has(x.id) && x.cartaoId === n.cartaoId && x.fatura === n.fatura && Math.abs(x.valor - n.valor) < 0.01,
        );
        if (p) {
          usados.add(p.id);
          n.pagamentoFaturaId = p.id;
        }
      }
      if (n.gastoFixoId && !n.competencia) n.competencia = n.data.slice(0, 7);
      if (n.tipo === "entrada" && !n.fonteId) {
        const fonte = listaFontes.find((f) => semAcento(f.nome) === semAcento(n.descricao));
        if (fonte) n.fonteId = fonte.id;
      }
      if (n.categoria === "Mercado" && !n.compraMercadoId) n.compraMercadoId = mercadoDaCompra(n.data, n.valor);
      return n;
    }),
  );
  compras.gravar(
    compras
      .ler()
      .map((c) =>
        c.categoria === "Mercado" && !c.compraMercadoId ? { ...c, compraMercadoId: mercadoDaCompra(c.data, c.valorTotal) } : c,
      ),
  );
  cartoes.gravar(cartoes.ler().map((c) => ({ ...c, saldoAtualizadoEm: paraHoraLocal(c.saldoAtualizadoEm) })));

  try {
    localStorage.setItem("naxxo:versao", String(VERSAO_DOS_DADOS));
  } catch {}
}

migrarDados();
