import { FREQUENCIAS, type GastoFixo } from "./store";
import { dataDoRecebimento, diasAte, diasEntre, hojeISO, mesesEntre, nomeMesCurto, somarDias } from "./formato";

export type SituacaoFixo = "pago" | "cartao" | "atrasado" | "hoje" | "pendente";

/** É do tipo "a cada X dias" (gasolina a cada 15 dias, ônibus toda semana…)? */
export function porIntervalo(fixo: GastoFixo) {
  return fixo.frequencia === "personalizada" && !!fixo.intervaloDias && !!fixo.inicio;
}

/** De quantos em quantos meses cobra (1, 6 ou 12). "A cada X dias" conta como 1 (cobra todo mês, talvez mais de uma vez). */
export function mesesEntreCobrancas(fixo: GastoFixo) {
  if (porIntervalo(fixo)) return 1;
  return FREQUENCIAS.find((f) => f.id === (fixo.frequencia ?? "mensal"))?.meses || 1;
}

/** O gasto existe neste mês? (começou, não foi cancelado e não está pausado) */
export function ativoNoMes(fixo: GastoFixo, mes: string) {
  if (fixo.desde > mes) return false;
  if (fixo.ate && mes > fixo.ate) return false;
  return !(fixo.pausas ?? []).includes(mes);
}

/** Os dias em que o gasto acontece naquele mês (pode ser mais de um, no "a cada X dias"). */
export function datasNoMes(fixo: GastoFixo, mes: string): string[] {
  if (fixo.ate && mes > fixo.ate) return [];
  if ((fixo.pausas ?? []).includes(mes)) return [];
  if (porIntervalo(fixo)) {
    const intervalo = fixo.intervaloDias!;
    const inicioMes = `${mes}-01`;
    const fimMes = dataDoRecebimento("31", mes);
    let data = fixo.inicio!;
    if (data > fimMes) return [];
    // Pula direto para a primeira data dentro do mês
    if (data < inicioMes) data = somarDias(data, Math.ceil(diasEntre(data, inicioMes) / intervalo) * intervalo);
    const datas: string[] = [];
    while (data <= fimMes) {
      datas.push(data);
      data = somarDias(data, intervalo);
    }
    return datas;
  }
  return cobraNoMes(fixo, mes) ? [dataDoRecebimento(String(fixo.dia), mes)] : [];
}

/** Cobra neste mês? Mensal: sempre. Semestral/anual: só nos meses da vez. "A cada X dias": se cair alguma data no mês. */
export function cobraNoMes(fixo: GastoFixo, mes: string): boolean {
  if (porIntervalo(fixo)) return datasNoMes(fixo, mes).length > 0;
  const intervalo = mesesEntreCobrancas(fixo);
  if (intervalo === 1) return true;
  const distancia = mesesEntre(fixo.mesReferencia ?? fixo.desde, mes);
  return ((distancia % intervalo) + intervalo) % intervalo === 0;
}

/** Quanto pesa por mês (uma anual de R$ 120 = R$ 10 por mês; R$ 40 a cada 15 dias = R$ 80 por mês). */
export function valorPorMes(fixo: GastoFixo) {
  if (porIntervalo(fixo)) return (fixo.valor * 30) / fixo.intervaloDias!;
  return fixo.valor / mesesEntreCobrancas(fixo);
}

/** Quanto o gasto custa naquele mês (o valor × quantas vezes cai no mês). */
export function valorNoMes(fixo: GastoFixo, mes: string) {
  return fixo.valor * datasNoMes(fixo, mes).length;
}

/** "todo dia 20", "anual · mar, dia 20", "a cada 15 dias" */
export function descreverCobranca(fixo: GastoFixo) {
  if (porIntervalo(fixo)) {
    const dias = fixo.intervaloDias!;
    return dias % 7 === 0 ? `a cada ${dias / 7 === 1 ? "semana" : `${dias / 7} semanas`}` : `a cada ${dias} dias`;
  }
  const frequencia = FREQUENCIAS.find((f) => f.id === (fixo.frequencia ?? "mensal"))!;
  // No cartão, o que importa é a fatura, não o dia
  if (fixo.pagamento === "cartao")
    return frequencia.meses === 1
      ? "todo mês"
      : `${frequencia.nome.toLowerCase()} · ${nomeMesCurto(fixo.mesReferencia ?? fixo.desde)}`;
  if (frequencia.meses === 1) return `todo dia ${fixo.dia}`;
  return `${frequencia.nome.toLowerCase()} · ${nomeMesCurto(fixo.mesReferencia ?? fixo.desde)}, dia ${fixo.dia}`;
}

/**
 * Pagamentos do fixo no mês: lançamentos (débito) e compras no crédito marcadas com o fixo.
 * Conta pelo mês da conta (competência): o aluguel de setembro pago em outubro é de setembro.
 */
type PagamentoDoFixo = { gastoFixoId?: string; data: string; valor: number; competencia?: string };

function pagamentosNoMes(fixo: GastoFixo, mes: string, lancamentos: PagamentoDoFixo[]) {
  return lancamentos.filter((l) => l.gastoFixoId === fixo.id && (l.competencia ?? l.data.slice(0, 7)) === mes);
}

/** As datas do mês que ainda não foram pagas (as primeiras são consideradas pagas, na ordem). */
export function datasPendentes(fixo: GastoFixo, mes: string, lancamentos: PagamentoDoFixo[]) {
  if (fixo.pagamento === "cartao") return [];
  return datasNoMes(fixo, mes).slice(pagamentosNoMes(fixo, mes, lancamentos).length);
}

/** Como está um gasto fixo num mês: pago, no cartão, atrasado ou ainda vai vencer (olhando a próxima data pendente). */
export function situacaoDoFixo(fixo: GastoFixo, mes: string, lancamentos: PagamentoDoFixo[]) {
  const datas = datasNoMes(fixo, mes);
  const pagamentos = pagamentosNoMes(fixo, mes, lancamentos);
  const pendentes = datas.slice(pagamentos.length);
  const vencimento = pendentes[0] ?? datas[datas.length - 1] ?? dataDoRecebimento(String(fixo.dia), mes);

  let situacao: SituacaoFixo;
  if (fixo.pagamento === "cartao") situacao = "cartao";
  else if (pendentes.length === 0) situacao = "pago";
  else if (vencimento < hojeISO()) situacao = "atrasado";
  else if (vencimento === hojeISO()) situacao = "hoje";
  else situacao = "pendente";

  return {
    situacao,
    vencimento,
    pagamento: pagamentos[pagamentos.length - 1],
    pagos: pagamentos.length,
    vezes: datas.length,
    diasParaVencer: diasAte(vencimento),
  };
}

/** Os gastos fixos que cobram naquele mês (criados até ele, não cancelados nem pausados; semestrais/anuais só no mês da vez). */
export function fixosDoMes(fixos: GastoFixo[], mes: string) {
  return fixos.filter((f) => ativoNoMes(f, mes) && cobraNoMes(f, mes));
}
