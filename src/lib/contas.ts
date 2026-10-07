// Contas: saldo de cada conta e quais têm cartão de crédito.

import {
  beneficioEmDinheiro,
  ehMovimentoDeMeta,
  jaAconteceu,
  paraHoraLocal,
  type Conta,
  type FonteRenda,
  type Lancamento,
} from "./store";
import { hojeISO } from "./formato";

/** A conta tem cartão de crédito? (contas antigas eram todas cartões) */
export function temCredito(conta: Conta) {
  return conta.tipo !== "vale" && conta.temCredito !== false && conta.limite > 0;
}

/** Conta de vale (VR/VA): o saldo é só para comida, não é dinheiro livre. */
export function ehVale(conta?: Pick<Conta, "tipo">) {
  return conta?.tipo === "vale";
}

/**
 * Este lançamento é dinheiro de verdade entrando/saindo (renda ou gasto)?
 * Não são: transferência entre contas, guardar/retirar de meta e o que acontece dentro de um vale (VR/VA).
 */
export function ehDinheiro(l: Lancamento, contas: Conta[], fontes: FonteRenda[] = []) {
  if (l.transferenciaId || ehMovimentoDeMeta(l)) return false;
  if (ehVale(contas.find((c) => c.id === l.contaId))) return false;
  if (l.tipo === "entrada" && l.beneficio) {
    const b = fontes.find((f) => f.id === l.fonteId)?.beneficios?.find((x) => x.tipo === l.beneficio);
    return beneficioEmDinheiro(b ?? { tipo: l.beneficio });
  }
  return true;
}

export function cartoesDeCredito(contas: Conta[]) {
  return contas.filter(temCredito);
}

/** Quando o saldo foi informado (data e hora). Sem isso, conta a partir do cadastro. */
export function marcoDoSaldo(conta: Conta) {
  // Tudo em hora local (datas antigas em UTC são convertidas): perto da meia-noite não erra o dia
  return paraHoraLocal(conta.saldoAtualizadoEm) ?? `${conta.criadoEm}T00:00:00`;
}

/**
 * Saldo da conta hoje: o que a pessoa informou + tudo o que entrou e saiu da conta depois disso.
 * O que foi lançado antes de informar o saldo já estava nele (não conta de novo).
 */
export function saldoDaConta(conta: Conta, lancamentos: Lancamento[], ate = hojeISO()) {
  const marco = marcoDoSaldo(conta);
  const diaDoMarco = marco.slice(0, 10);
  return lancamentos
    .filter(
      (l) =>
        l.contaId === conta.id &&
        !l.jaNoSaldo &&
        jaAconteceu(l, ate) &&
        (l.data > diaDoMarco || (paraHoraLocal(l.criadoEm) ?? "") >= marco),
    )
    .reduce((saldo, l) => saldo + (l.tipo === "entrada" ? l.valor : -l.valor), conta.saldo ?? 0);
}

/** Saldo total em dinheiro: soma das contas (os vales ficam de fora). Sem conta ainda, usa todos os lançamentos. */
export function saldoTotal(contas: Conta[], lancamentos: Lancamento[], ate = hojeISO()) {
  if (contas.length === 0) {
    return lancamentos.filter((l) => jaAconteceu(l, ate)).reduce((t, l) => t + (l.tipo === "entrada" ? l.valor : -l.valor), 0);
  }
  return contas.filter((c) => !ehVale(c)).reduce((total, c) => total + saldoDaConta(c, lancamentos, ate), 0);
}

/** Quanto tem nos vales (VR/VA). */
export function saldoDosVales(contas: Conta[], lancamentos: Lancamento[], ate = hojeISO()) {
  return contas.filter(ehVale).reduce((total, c) => total + saldoDaConta(c, lancamentos, ate), 0);
}

/** Lançamentos que ainda não têm conta (antigos): a pessoa escolhe depois. */
export function semConta(lancamentos: Lancamento[]) {
  return lancamentos.filter((l) => !l.contaId);
}

export function iconeDaConta(conta: Conta) {
  return conta.tipo === "dinheiro" ? "💵" : conta.tipo === "vale" ? "🍽️" : temCredito(conta) ? "💳" : "🏦";
}
