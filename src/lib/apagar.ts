import type { Cartao, CompraCartao, GastoFixo, Lancamento, Meta, PagamentoFatura } from "./store";
import { iconeDaCategoria, jaAconteceu } from "./store";
import { dataDoRecebimento, hojeISO, mesAtual, mesesEntre, somarMeses } from "./formato";
import { datasPendentes, fixosDoMes } from "./fixos";
import { faturasAtrasadas, resumoDaFatura } from "./cartoes";

// Tudo o que falta pagar num mês, juntando quatro lugares:
// lançamentos marcados como "a pagar", gastos fixos ainda não pagos, faturas de cartão
// e parcelas de metas de quitar (que são obrigatórias todo mês).

// `atrasado`: venceu num mês anterior e ainda não foi pago (aparece no mês atual, com o selo "atrasado").
export type ItemAPagar = { atrasado?: boolean } & (
  | { tipo: "lancamento"; chave: string; vencimento: string; valor: number; lancamento: Lancamento; icone: string }
  | { tipo: "fixo"; chave: string; vencimento: string; valor: number; fixo: GastoFixo; icone: string; competencia: string }
  | { tipo: "fatura"; chave: string; vencimento: string; valor: number; cartao: Cartao; fatura: string; icone: string }
  | { tipo: "parcela"; chave: string; vencimento: string; valor: number; meta: Meta; numero: number; icone: string }
);

/** Quantos meses para trás o "a pagar" procura contas atrasadas. */
const MESES_ATRASADOS = 6;

/** A parcela de uma meta de quitar que cai neste mês (ou null se não cai / já foi paga). */
export function parcelaDoMes(meta: Meta, mes: string) {
  if (meta.tipo !== "quitar" || !meta.parcela || !meta.parcelas) return null;
  const restantes = meta.parcelas - (meta.parcelasPagas ?? 0);
  if (restantes <= 0) return null;
  const hoje = mesAtual();
  const distancia = mesesEntre(hoje, mes);
  if (distancia < 0) return null; // meses que já passaram ficam como estão
  // Se a parcela deste mês já foi paga, as que faltam começam no mês que vem
  const pagouEsteMes = meta.ultimaParcelaPaga === hoje;
  const posicao = pagouEsteMes ? distancia - 1 : distancia; // 0 = próxima parcela a pagar
  if (posicao < 0 || posicao >= restantes) return null;
  // Sem dia de vencimento, considera até o fim do mês (o "31" vira o último dia de cada mês)
  const dia = String(meta.diaVencimento ?? 31);
  return { numero: (meta.parcelasPagas ?? 0) + posicao + 1, vencimento: dataDoRecebimento(dia, mes) };
}

export function itensAPagar(
  mes: string,
  dados: {
    lancamentos: Lancamento[];
    fixos: GastoFixo[];
    cartoes: Cartao[];
    compras: CompraCartao[];
    pagamentos: PagamentoFatura[];
    metas: Meta[];
  },
): ItemAPagar[] {
  const itens: ItemAPagar[] = [];
  const proximoMes = somarMeses(mes, 1);

  // Saídas não pagas até o fim do mês (inclui as atrasadas de meses anteriores)
  for (const l of dados.lancamentos) {
    if (l.tipo === "saida" && !l.transferenciaId && !jaAconteceu(l) && l.data < proximoMes) {
      itens.push({
        tipo: "lancamento",
        chave: l.id,
        vencimento: l.data,
        valor: l.valor,
        lancamento: l,
        icone: iconeDaCategoria("saida", l.categoria),
        atrasado: l.data < `${mesAtual()}-01`,
      });
    }
  }

  // Gastos fixos do mês que ainda não foram pagos (os do cartão entram pela fatura).
  // Os "a cada X dias" (ex.: gasolina a cada 15 dias) aparecem uma vez para cada data do mês.
  const pagamentosDeFixos = [...dados.lancamentos, ...dados.compras.map((c) => ({ ...c, valor: c.valorTotal }))];
  // No mês atual, também os fixos de meses anteriores que ficaram sem pagar (desde que o fixo foi cadastrado)
  const mesesDosFixos =
    mes === mesAtual()
      ? [...Array.from({ length: MESES_ATRASADOS }, (_, i) => somarMeses(mes, i - MESES_ATRASADOS)), mes]
      : [mes];
  for (const m of mesesDosFixos) {
    for (const f of fixosDoMes(dados.fixos, m)) {
      for (const vencimento of datasPendentes(f, m, pagamentosDeFixos)) {
        const atrasado = m < mes;
        // Antes de cadastrar o fixo no app, não é "atrasado": a pessoa não tinha como marcar
        if (atrasado && (vencimento < (f.criadoEm ?? `${f.desde}-01`) || vencimento >= hojeISO())) continue;
        itens.push({
          tipo: "fixo",
          chave: `fixo-${f.id}-${vencimento}`,
          vencimento,
          valor: f.valor,
          fixo: f,
          icone: f.icone,
          competencia: m,
          atrasado,
        });
      }
    }
  }

  // Faturas que vencem neste mês e ainda têm valor a pagar (no mês atual, também as atrasadas)
  for (const c of dados.cartoes) {
    if (mes === mesAtual()) {
      for (const a of faturasAtrasadas(c, dados, mes)) {
        itens.push({
          tipo: "fatura",
          chave: `fatura-${c.id}-${a.fatura}`,
          vencimento: a.vencimento,
          valor: a.restante,
          cartao: c,
          fatura: a.fatura,
          icone: "💳",
          atrasado: true,
        });
      }
    }
    const r = resumoDaFatura(c, mes, dados);
    if (r.restante > 0.005) {
      itens.push({
        tipo: "fatura",
        chave: `fatura-${c.id}-${mes}`,
        vencimento: r.vencimento,
        valor: r.restante,
        cartao: c,
        fatura: mes,
        icone: "💳",
      });
    }
  }

  // Parcelas de metas de quitar (as que estão num cartão já entram pela fatura)
  for (const m of dados.metas) {
    if (dados.compras.some((c) => c.metaId === m.id)) continue;
    // Atrasadas: meses entre a última parcela paga e este mês que ficaram sem pagar
    let atrasadas = 0;
    if (mes === mesAtual() && m.tipo === "quitar" && m.parcela && m.parcelas && m.ultimaParcelaPaga) {
      const restantes = m.parcelas - (m.parcelasPagas ?? 0);
      const semPagar = Math.min(mesesEntre(m.ultimaParcelaPaga, mes) - 1, restantes - 1);
      for (let i = 1; i <= semPagar; i++) {
        const mesDaParcela = somarMeses(m.ultimaParcelaPaga, i);
        if ((m.planoMensal?.[mesDaParcela] ?? m.parcela) <= 0) continue; // adiada
        itens.push({
          tipo: "parcela",
          chave: `parcela-${m.id}-${mesDaParcela}`,
          vencimento: dataDoRecebimento(String(m.diaVencimento ?? 31), mesDaParcela),
          valor: m.parcela,
          meta: m,
          numero: (m.parcelasPagas ?? 0) + i,
          icone: m.icone,
          atrasado: true,
        });
        atrasadas++;
      }
    }
    const p = parcelaDoMes(m, mes);
    if (p) {
      itens.push({
        tipo: "parcela",
        chave: `parcela-${m.id}-${mes}`,
        vencimento: p.vencimento,
        valor: m.parcela!,
        meta: m,
        numero: p.numero + atrasadas, // as atrasadas vêm antes na contagem
        icone: m.icone,
      });
    }
  }

  return itens.sort((a, b) => a.vencimento.localeCompare(b.vencimento));
}
