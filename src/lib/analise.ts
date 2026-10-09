// Análises do mês usadas no Relatório e nos Gráficos.

import {
  CATEGORIAS_FIXO,
  doMes,
  iconeDaCategoria,
  jaAconteceu,
  type CompraCartao,
  type CompraMercado,
  type GastoFixo,
  type Lancamento,
} from "./store";
import { itensDaFatura } from "./cartoes";
import { previstosDoMes, resumoDoMes, type Dados } from "./previstos";

/** Um gasto do mês, com o que precisa para mostrar o detalhe (e abrir para editar). */
export type Gasto = {
  chave: string;
  categoria: string;
  valor: number;
  descricao: string;
  data: string;
  onde: string; // "Nubank", "💳 Nubank · 2/3", "previsto"
  previsto: boolean;
  icone: string;
  lancamento?: Lancamento;
  compra?: CompraCartao;
  fixo?: GastoFixo;
};

/**
 * Os gastos do mês, juntando tudo sem contar nada duas vezes:
 * saídas lançadas (menos pagamento de fatura, transferência e dinheiro guardado em metas) + o que está na fatura que vence no mês
 * + gastos fixos, parcelas e mercado ainda previstos.
 */
export function gastosDoMes(mes: string, d: Dados): Gasto[] {
  const gastos: Gasto[] = [];
  const nomeDaConta = (id?: string) => d.cartoes.find((c) => c.id === id)?.nome ?? "sem conta";
  const categoriaDoFixo = (fixo?: GastoFixo) =>
    CATEGORIAS_FIXO.find((x) => x.id === fixo?.categoria)?.categoriaLancamento ?? "Outros";

  for (const l of doMes(d.lancamentos, mes)) {
    if (
      l.tipo === "saida" &&
      !l.transferenciaId &&
      l.categoria !== "Fatura do cartão" &&
      l.categoria !== "Guardar (metas)" &&
      (jaAconteceu(l) || l.pago)
    ) {
      gastos.push({
        chave: l.id,
        categoria: l.categoria,
        valor: l.valor,
        descricao: l.descricao,
        data: l.data,
        onde: nomeDaConta(l.contaId),
        previsto: !jaAconteceu(l),
        icone: iconeDaCategoria("saida", l.categoria),
        lancamento: l,
      });
    }
  }
  for (const c of d.cartoes) {
    for (const item of itensDaFatura(c, mes, d)) {
      const compra = d.compras.find((x) => x.id === item.compraId);
      const fixo = d.fixos.find((x) => x.id === item.fixoId);
      const categoria = compra?.categoria ?? categoriaDoFixo(fixo);
      gastos.push({
        chave: `fatura:${item.chave}`,
        categoria,
        valor: item.valor,
        descricao: item.descricao,
        data: compra?.data ?? `${mes}-${String(fixo?.dia ?? 1).padStart(2, "0")}`,
        onde: `💳 ${c.nome} · ${item.detalhe}`,
        previsto: false,
        icone: fixo?.icone ?? iconeDaCategoria("saida", categoria),
        compra,
        fixo,
      });
    }
  }
  for (const p of previstosDoMes(mes, d)) {
    const item = p.item;
    const base = {
      chave: `previsto:${p.chave}`,
      valor: p.valor,
      descricao: p.nome,
      data: p.data,
      onde: "previsto",
      previsto: true,
      icone: p.icone,
    };
    if (item?.tipo === "fixo") gastos.push({ ...base, categoria: categoriaDoFixo(item.fixo), fixo: item.fixo });
    if (p.origem === "parcela") gastos.push({ ...base, categoria: "Dívidas e juros" });
    if (p.origem === "mercado") gastos.push({ ...base, categoria: "Mercado" });
    if (p.origem === "lançamento" && p.lancamento && p.tipo === "saida" && !p.lancamento.pago && !p.lancamento.transferenciaId) {
      gastos.push({ ...base, categoria: p.lancamento.categoria, lancamento: p.lancamento });
    }
  }
  return gastos.sort((a, b) => b.data.localeCompare(a.data));
}

/** Despesas do mês somadas por categoria (maior primeiro). */
export function despesasPorCategoria(mes: string, d: Dados) {
  return Object.entries(
    gastosDoMes(mes, d).reduce<Record<string, number>>(
      (acc, x) => ({ ...acc, [x.categoria]: (acc[x.categoria] ?? 0) + x.valor }),
      {},
    ),
  )
    .map(([categoria, valor]) => ({ categoria, valor }))
    .sort((a, b) => b.valor - a.valor);
}

/** Os produtos de uma compra de mercado (se o gasto veio do Mercado), pela ligação com a compra. */
export function itensDoMercado(g: Gasto, comprasMercado: CompraMercado[]) {
  const id = g.lancamento?.compraMercadoId ?? g.compra?.compraMercadoId;
  if (!id) return null;
  return comprasMercado.find((c) => c.id === id)?.itens ?? null;
}

/** Entradas e saídas do mês: o mesmo resumo de todas as telas (sem transferências, metas e vales). */
export function balancoDoMes(mes: string, d: Dados) {
  const r = resumoDoMes(mes, d);
  return { entrouFeito: r.entrou, saiuFeito: r.saiu, vaiEntrar: r.vaiEntrar, vaiSair: r.vaiSair, entra: r.entra, sai: r.sai };
}

/** Regra 50/30/20: o que conta como necessidade (a pessoa pode mudar em Configurações). */
export const NECESSIDADES_PADRAO = ["Mercado", "Moradia", "Contas da casa", "Transporte", "Saúde", "Educação", "Dívidas e juros"];
