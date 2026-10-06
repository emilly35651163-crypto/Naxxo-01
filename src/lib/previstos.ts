// O que está previsto em cada mês: tudo o que ainda vai entrar ou sair, num lugar só.
// Usado pelos Lançamentos, pela Projeção, pelo Início, pelo Relatório e pela Trilha (meta do mês).

import {
  jaAconteceu,
  type Cartao,
  type CompraCartao,
  type FonteRenda,
  type GastoFixo,
  type ItemLista,
  type ItemMercado,
  type Lancamento,
  type Meta,
  type PagamentoFatura,
} from "./store";
import { dataDoRecebimento, hojeISO, lerValor, mesAtual } from "./formato";
import { itensAPagar, type ItemAPagar } from "./apagar";
import { calcularMeta } from "./metas";
import { rendaPendente, type ParteDaRenda } from "./renda";
import { ehDinheiro } from "./contas";

/**
 * Guarda o último resultado de cada conta por mês: as telas chamam as previsões várias vezes por render,
 * e com meses de dados isso pesa. Só recalcula quando algum dado (ou o dia) muda.
 */
function lembrar<R>(fn: (mes: string, d: Dados) => R) {
  const cache = new Map<string, { chaves: unknown[]; valor: R }>();
  return (mes: string, d: Dados): R => {
    const chaves = [
      hojeISO(),
      d.lancamentos,
      d.fontes,
      d.fixos,
      d.cartoes,
      d.compras,
      d.pagamentos,
      d.metas,
      d.itensMercado,
      d.listaCompras,
      d.compraPlanejada,
    ];
    const salvo = cache.get(mes);
    if (salvo && salvo.chaves.every((c, i) => c === chaves[i])) return salvo.valor;
    const valor = fn(mes, d);
    cache.set(mes, { chaves, valor });
    if (cache.size > 40) cache.delete(cache.keys().next().value!);
    return valor;
  };
}
import { datasDeReposicao } from "./mercado";

export type Dados = {
  lancamentos: Lancamento[];
  fontes: FonteRenda[];
  fixos: GastoFixo[];
  cartoes: Cartao[];
  compras: CompraCartao[];
  pagamentos: PagamentoFatura[];
  metas: Meta[];
  itensMercado: ItemMercado[];
  listaCompras?: ItemLista[];
  compraPlanejada?: string | null; // dia em que a pessoa vai ao mercado com a lista
};

/** Quanto a lista deve custar: o preço estimado de cada item (ou o último preço pago). */
export function totalDaLista(lista: ItemLista[], despensa: ItemMercado[]) {
  return lista.reduce((t, l) => {
    const estimado = lerValor(l.valor ?? "");
    const ultimo = despensa.find((d) => d.nome.trim().toLowerCase() === l.nome.trim().toLowerCase())?.valor ?? 0;
    return t + (estimado > 0 ? estimado : ultimo);
  }, 0);
}

export type Previsto = {
  chave: string;
  data: string;
  tipo: "entrada" | "saida";
  valor: number;
  nome: string;
  icone: string;
  origem: "lançamento" | "renda" | "benefício" | "fixo" | "fatura" | "parcela" | "guardar" | "mercado";
  // O que confirmar quando a pessoa tocar em "Pago"/"Recebi"
  item?: ItemAPagar;
  lancamento?: Lancamento;
  fonte?: FonteRenda;
  meta?: Meta;
  parte?: ParteDaRenda; // renda: qual parte (salário, adiantamento, benefício…)
  dinheiro?: boolean; // false = vale (VR/VA) ou algo dentro de um vale: não conta na sobra
};

const fimDoMes = (mes: string) => dataDoRecebimento("31", mes);

/** Tudo o que está previsto no mês, menos o "guardar" das metas (que depende da sobra). */
export const previstosBase = lembrar(calcularPrevistosBase);
function calcularPrevistosBase(mes: string, d: Dados): Previsto[] {
  const hoje = hojeISO();
  const lista: Previsto[] = [];
  if (mes < mesAtual()) return lista;

  // Entradas lançadas que ainda não caíram
  for (const l of d.lancamentos) {
    if (l.tipo === "entrada" && !l.transferenciaId && !jaAconteceu(l, hoje) && l.data.startsWith(mes)) {
      lista.push({
        chave: `l-${l.id}`,
        data: l.data,
        tipo: "entrada",
        valor: l.valor,
        nome: l.descricao,
        icone: "💰",
        origem: "lançamento",
        lancamento: l,
        dinheiro: ehDinheiro(l, d.cartoes, d.fontes),
      });
    }
  }

  // Rendas que ainda não caíram no mês (salário, adiantamento, 13º, férias e benefícios; as que variam, pela média)
  for (const f of d.fontes) {
    for (const parte of rendaPendente(f, mes, d.lancamentos)) {
      lista.push({
        chave: parte.chave,
        data: parte.data,
        tipo: "entrada",
        valor: parte.valor,
        nome: parte.nome,
        icone: parte.icone,
        origem: parte.parte === "beneficio" ? "benefício" : "renda",
        fonte: f,
        parte,
        dinheiro: parte.dinheiro,
      });
    }
  }

  // Contas a pagar: lançamentos em aberto, gastos fixos, faturas e parcelas de quitar
  for (const item of itensAPagar(mes, d)) {
    const base = { chave: item.chave, data: item.vencimento, tipo: "saida" as const, valor: item.valor, icone: item.icone, item };
    if (item.tipo === "lancamento")
      lista.push({
        ...base,
        nome: item.lancamento.descricao,
        origem: "lançamento",
        lancamento: item.lancamento,
        dinheiro: ehDinheiro(item.lancamento, d.cartoes, d.fontes),
      });
    if (item.tipo === "fixo") lista.push({ ...base, nome: item.fixo.nome, origem: "fixo" });
    if (item.tipo === "fatura") lista.push({ ...base, nome: `Fatura ${item.cartao.nome}`, origem: "fatura" });
    if (item.tipo === "parcela") {
      // A parcela pode ter outro valor neste mês (ou zero, para não entrar)
      const valor = item.meta.planoMensal?.[mes] ?? item.valor;
      if (valor > 0)
        lista.push({
          ...base,
          valor,
          nome: `${item.meta.nome} (${item.numero}/${item.meta.parcelas})`,
          origem: "parcela",
          meta: item.meta,
        });
    }
  }

  // Mercado: a compra planejada (a lista, no dia marcado) …
  const listaDeCompras = d.listaCompras ?? [];
  const planejada =
    d.compraPlanejada && d.compraPlanejada.startsWith(mes) && listaDeCompras.length > 0 ? d.compraPlanejada : null;
  if (planejada) {
    lista.push({
      chave: `lista-${planejada}`,
      data: planejada,
      tipo: "saida",
      valor: totalDaLista(listaDeCompras, d.itensMercado),
      nome: `Compra planejada no mercado (${listaDeCompras.length} ${listaDeCompras.length === 1 ? "item" : "itens"})`,
      icone: "🛒",
      origem: "mercado",
    });
  }
  // … e o que vai acabar e precisa ser reposto (agrupado por dia). O que já está na lista planejada não conta de novo.
  const naLista = (nome: string) =>
    !!d.compraPlanejada && listaDeCompras.some((l) => l.nome.trim().toLowerCase() === nome.trim().toLowerCase());
  const porDia = new Map<string, ItemMercado[]>();
  for (const item of d.itensMercado.filter((i) => !naLista(i.nome))) {
    for (const data of datasDeReposicao(item, fimDoMes(mes))) {
      if (data.startsWith(mes)) porDia.set(data, [...(porDia.get(data) ?? []), item]);
    }
  }
  for (const [data, itens] of porDia) {
    lista.push({
      chave: `merc-${data}`,
      data,
      tipo: "saida",
      valor: itens.reduce((t, i) => t + i.valor, 0),
      nome: `Repor ${itens.map((i) => i.nome.toLowerCase()).join(", ")}`,
      icone: "🛒",
      origem: "mercado",
    });
  }

  return lista;
}

/**
 * O resumo do mês, igual em todas as telas: o que entrou, o que saiu e o que ainda vai entrar/sair.
 * Conta só dinheiro de verdade: transferências entre contas, guardar/retirar de meta e vales (VR/VA) ficam de fora.
 * O que já foi guardado em metas aparece à parte (`guardado`), assim como o que ainda falta guardar no mês.
 */
export const resumoDoMes = lembrar(calcularResumoDoMes);
function calcularResumoDoMes(mes: string, d: Dados) {
  const feitos = d.lancamentos.filter((l) => l.data.startsWith(mes) && jaAconteceu(l));
  const dinheiro = feitos.filter((l) => ehDinheiro(l, d.cartoes, d.fontes));
  const soma = (xs: { valor: number }[]) => Math.round(xs.reduce((t, x) => t + x.valor, 0) * 100) / 100;
  const base = previstosBase(mes, d).filter((p) => p.dinheiro !== false);
  const entrou = soma(dinheiro.filter((l) => l.tipo === "entrada"));
  const saiu = soma(dinheiro.filter((l) => l.tipo === "saida"));
  const vaiEntrar = soma(base.filter((p) => p.tipo === "entrada"));
  const vaiSair = soma(base.filter((p) => p.tipo === "saida"));
  const movimentosDeMeta = feitos.filter(
    (l) => l.efeito === "guardar" || l.efeito === "retirar" || l.categoria === "Guardar (metas)",
  );
  const guardado =
    soma(movimentosDeMeta.filter((l) => l.tipo === "saida")) - soma(movimentosDeMeta.filter((l) => l.tipo === "entrada"));
  const entra = entrou + vaiEntrar;
  const sai = saiu + vaiSair;
  return { entrou, saiu, vaiEntrar, vaiSair, entra, sai, sobra: entra - sai, guardado };
}

/** Plano do mês das metas: a sobra (o que entra menos o que sai, sem contar metas) e a sugestão de quanto guardar em cada uma. */
export const planoDoMes = lembrar(calcularPlanoDoMes);
function calcularPlanoDoMes(mes: string, d: Dados) {
  const { entra, sai, sobra } = resumoDoMes(mes, d);

  const deJuntar = d.metas.filter((m) => m.tipo !== "quitar" && !m.arquivada && !calcularMeta(m).concluida);
  // Quanto cada meta "pede": pelo prazo, pelo que a pessoa disse que consegue, ou para chegar em 1 ano
  const pede = new Map(
    deJuntar.map((m) => {
      const c = calcularMeta(m);
      return [m.id, Math.min(c.precisaPorMes ?? m.aporteMensal ?? c.falta / 12, c.falta)];
    }),
  );

  // Primeiro os valores escolhidos pela pessoa; o que sobra é dividido entre as automáticas
  const escolhidas = deJuntar.filter((m) => m.planoMensal?.[mes] !== undefined);
  const automaticas = deJuntar.filter((m) => m.planoMensal?.[mes] === undefined);
  let disponivel = Math.max(sobra - escolhidas.reduce((t, m) => t + (m.planoMensal![mes] ?? 0), 0), 0);

  // Por padrão, cada meta de juntar fica com R$ 0 no mês: a pessoa vê o que sobra de verdade e decide quanto guardar.
  // A divisão abaixo é só a sugestão (reserva primeiro, depois as outras, pelo que cada uma pede).
  const valores = new Map<string, { valor: number; automatico: boolean; sugerido: number }>();
  escolhidas.forEach((m) => valores.set(m.id, { valor: m.planoMensal![mes], automatico: false, sugerido: 0 }));

  // A reserva de emergência vem antes das outras
  const ordem = [...automaticas].sort((a, b) => Number(!!b.reserva) - Number(!!a.reserva));
  const reservas = ordem.filter((m) => m.reserva);
  const outras = ordem.filter((m) => !m.reserva);
  for (const m of reservas) {
    const valor = Math.min(pede.get(m.id) ?? 0, disponivel);
    valores.set(m.id, { valor: 0, automatico: true, sugerido: valor });
    disponivel -= valor;
  }
  const totalPedido = outras.reduce((t, m) => t + (pede.get(m.id) ?? 0), 0);
  const fator = totalPedido > 0 ? Math.min(disponivel / totalPedido, 1) : 0;
  for (const m of outras) valores.set(m.id, { valor: 0, automatico: true, sugerido: (pede.get(m.id) ?? 0) * fator });

  return { sobra, entra, sai, valores, pede };
}

/** Quanto já foi guardado em cada meta neste mês, menos o que foi retirado (para não prever de novo). */
function guardadoNoMes(meta: Meta, mes: string, lancamentos: Lancamento[]) {
  return lancamentos
    .filter((l) => l.metaId === meta.id && l.data.startsWith(mes) && (l.efeito === "guardar" || l.efeito === "retirar"))
    .reduce((t, l) => t + (l.efeito === "guardar" ? l.valor : -l.valor), 0);
}

/** Tudo o que está previsto no mês, incluindo o quanto guardar em cada meta. */
export const previstosDoMes = lembrar(calcularPrevistosDoMes);
function calcularPrevistosDoMes(mes: string, d: Dados): Previsto[] {
  const lista = [...previstosBase(mes, d)]; // cópia: a lista base fica guardada e não pode mudar
  if (mes >= mesAtual()) {
    const { valores } = planoDoMes(mes, d);
    for (const m of d.metas) {
      const plano = valores.get(m.id);
      if (!plano) continue;
      const falta = Math.round((plano.valor - guardadoNoMes(m, mes, d.lancamentos)) * 100) / 100;
      if (falta < 1) continue;
      lista.push({
        chave: `guardar-${m.id}-${mes}`,
        data: fimDoMes(mes) < hojeISO() ? hojeISO() : fimDoMes(mes),
        tipo: "saida",
        valor: falta,
        nome: `Guardar para ${m.nome}`,
        icone: m.icone,
        origem: "guardar",
        meta: m,
      });
    }
  }
  return lista.sort((a, b) => a.data.localeCompare(b.data) || (a.tipo === "entrada" ? -1 : 1));
}
