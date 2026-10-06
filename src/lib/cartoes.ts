// Contas dos cartões de crédito: em qual fatura cada compra cai, valor da fatura, limite usado.
// As faturas são identificadas pelo mês em que VENCEM ("2026-11" = fatura que vence em novembro).

import type { Cartao, CompraCartao, GastoFixo, PagamentoFatura } from "./store";
import { dataDoRecebimento, hojeISO, mesesEntre, somarMeses } from "./formato";
import { ativoNoMes, cobraNoMes, datasNoMes, descreverCobranca, mesesEntreCobrancas, porIntervalo } from "./fixos";

/**
 * Valor de cada parcela em centavos certinhos: 100 em 3x = 33,34 + 33,33 + 33,33.
 * A diferença dos centavos fica na 1ª parcela, como os bancos fazem.
 */
export function valorDaParcela(compra: Pick<CompraCartao, "valorTotal" | "parcelas">, indice: number) {
  const totalCentavos = Math.round(compra.valorTotal * 100);
  const base = Math.floor(totalCentavos / compra.parcelas);
  const sobra = totalCentavos - base * compra.parcelas;
  return (indice === 0 ? base + sobra : base) / 100;
}

/** Em qual fatura cai uma compra feita nesta data. */
export function faturaDaData(data: string, cartao: Pick<Cartao, "diaFechamento" | "diaVencimento">) {
  const mes = data.slice(0, 7);
  const dia = Number(data.slice(8, 10));
  // Compra no dia do fechamento ou depois já vai para a fatura seguinte
  const mesDoFechamento = dia < cartao.diaFechamento ? mes : somarMeses(mes, 1);
  // Se vence antes do dia que fecha, o vencimento é no mês seguinte ao fechamento
  return cartao.diaVencimento > cartao.diaFechamento ? mesDoFechamento : somarMeses(mesDoFechamento, 1);
}

/**
 * Data da compra a partir das parcelas já pagas: volta um mês por parcela paga.
 * Assim a próxima parcela a pagar cai na fatura que está aberta agora.
 */
export function dataPelasParcelasPagas(pagas: number) {
  const hoje = hojeISO();
  if (pagas <= 0) return hoje;
  return dataDoRecebimento(String(Number(hoje.slice(8, 10))), somarMeses(hoje.slice(0, 7), -pagas));
}

/** A fatura que está aberta hoje (recebendo compras). */
export function faturaAberta(cartao: Pick<Cartao, "diaFechamento" | "diaVencimento">) {
  return faturaDaData(hojeISO(), cartao);
}

export function dataDeVencimento(cartao: Cartao, fatura: string) {
  return dataDoRecebimento(String(cartao.diaVencimento), fatura);
}

export function dataDeFechamento(cartao: Cartao, fatura: string) {
  const mesDoFechamento = cartao.diaVencimento > cartao.diaFechamento ? fatura : somarMeses(fatura, -1);
  return dataDoRecebimento(String(cartao.diaFechamento), mesDoFechamento);
}

export type ItemFatura = {
  chave: string;
  descricao: string;
  valor: number;
  detalhe: string; // "3/12", "à vista", "assinatura · dia 20"
  compraId?: string;
  fixoId?: string;
};

type Dados = { compras: CompraCartao[]; fixos: GastoFixo[]; pagamentos: PagamentoFatura[] };

/**
 * A primeira fatura de uma assinatura/gasto fixo no cartão: a que estava aberta quando ele foi cadastrado.
 * A partir dela, entra uma vez em cada fatura, como gasto previsto, mesmo antes do dia da cobrança.
 */
function primeiraFaturaDoFixo(fixo: GastoFixo, cartao: Cartao) {
  const cadastro = fixo.criadoEm ?? `${fixo.desde}-01`;
  return faturaDaData(cadastro > cartao.criadoEm ? cadastro : cartao.criadoEm, cartao);
}

/** Em qual fatura cai cada parcela de uma compra (índice 0 = 1ª parcela). */
export function faturaDaParcela(compra: CompraCartao, cartao: Cartao, indice: number) {
  return somarMeses(faturaDaData(compra.data, cartao), indice);
}

/**
 * Tudo o que está numa fatura. Parcelas que já estavam pagas quando a compra foi incluída ficam de fora.
 * Com `fixosAte`, as assinaturas só contam em faturas até essa (para o limite usado: até a fatura aberta).
 */
export function itensDaFatura(cartao: Cartao, fatura: string, { compras, fixos }: Dados, fixosAte?: string): ItemFatura[] {
  const itens: ItemFatura[] = [];

  for (const compra of compras) {
    if (compra.cartaoId !== cartao.id) continue;
    const indice = mesesEntre(faturaDaData(compra.data, cartao), fatura);
    if (indice < 0 || indice >= compra.parcelas || indice < (compra.parcelasPagas ?? 0)) continue;
    itens.push({
      chave: `${compra.id}-${indice}`,
      descricao: compra.descricao,
      valor: valorDaParcela(compra, indice),
      detalhe: compra.parcelas > 1 ? `${indice + 1}/${compra.parcelas}` : "à vista",
      compraId: compra.id,
    });
  }

  for (const fixo of fixos) {
    if (fixo.pagamento !== "cartao" || fixo.cartaoId !== cartao.id) continue;
    if (fatura < primeiraFaturaDoFixo(fixo, cartao) || (fixosAte && fatura > fixosAte)) continue;
    // Cancelado ou pausado: olha o mês da cobrança que cairia nesta fatura
    const mesesDaCobranca = [somarMeses(fatura, -2), somarMeses(fatura, -1), fatura].filter(
      (m) => faturaDaData(dataDoRecebimento(String(fixo.dia || 1), m), cartao) === fatura,
    );
    if (!porIntervalo(fixo) && mesesDaCobranca.length > 0 && !mesesDaCobranca.some((m) => ativoNoMes(fixo, m))) continue;
    // "A cada X dias" (ex.: gasolina no cartão a cada 15 dias): cada abastecida cai na fatura da sua data
    if (porIntervalo(fixo)) {
      const meses = [somarMeses(fatura, -2), somarMeses(fatura, -1), fatura];
      const cadastro = fixo.criadoEm ?? fixo.inicio!;
      for (const data of meses.flatMap((m) => datasNoMes(fixo, m))) {
        if (data < cadastro || data < cartao.criadoEm || faturaDaData(data, cartao) !== fatura) continue;
        itens.push({
          chave: `fixo-${fixo.id}-${data}`,
          descricao: `${fixo.icone} ${fixo.nome}`,
          valor: fixo.valor,
          detalhe: `${descreverCobranca(fixo)} · ${data.slice(8)}/${data.slice(5, 7)}`,
          fixoId: fixo.id,
        });
      }
      continue;
    }
    // Semestral/anual: só entra na fatura onde cai a cobrança do mês da vez
    if (mesesEntreCobrancas(fixo) > 1) {
      const meses = [somarMeses(fatura, -2), somarMeses(fatura, -1), fatura];
      const cobraNestaFatura = meses.some(
        (m) => cobraNoMes(fixo, m) && faturaDaData(dataDoRecebimento(String(fixo.dia), m), cartao) === fatura,
      );
      if (!cobraNestaFatura) continue;
    }
    itens.push({
      chave: `fixo-${fixo.id}-${fatura}`,
      descricao: `${fixo.icone} ${fixo.nome}`,
      valor: fixo.valor,
      detalhe: `${fixo.categoria === "assinaturas" ? "assinatura" : "fixo"}${
        fixo.frequencia && fixo.frequencia !== "mensal" ? ` ${fixo.frequencia}` : ""
      } · dia ${fixo.dia}`,
      fixoId: fixo.id,
    });
  }

  return itens;
}

export type SituacaoFatura = "futura" | "aberta" | "fechada" | "paga" | "vazia";

function pagoNaFatura(cartao: Cartao, fatura: string, pagamentos: PagamentoFatura[]) {
  return pagamentos.filter((p) => p.cartaoId === cartao.id && p.fatura === fatura).reduce((total, p) => total + p.valor, 0);
}

/** Valor, quanto já foi pago e a situação de uma fatura. */
export function resumoDaFatura(cartao: Cartao, fatura: string, dados: Dados) {
  const itens = itensDaFatura(cartao, fatura, dados);
  const valor = itens.reduce((total, i) => total + i.valor, 0);
  const pago = pagoNaFatura(cartao, fatura, dados.pagamentos);
  const restante = Math.max(valor - pago, 0);
  const aberta = faturaAberta(cartao);

  let situacao: SituacaoFatura;
  if (valor === 0) situacao = "vazia";
  else if (restante < 0.005) situacao = "paga";
  else if (fatura > aberta) situacao = "futura";
  else if (fatura === aberta) situacao = "aberta";
  else situacao = "fechada";

  return {
    itens,
    valor,
    pago,
    restante,
    situacao,
    vencimento: dataDeVencimento(cartao, fatura),
    fechamento: dataDeFechamento(cartao, fatura),
  };
}

/** Quanto do limite está usado: tudo o que ainda não foi pago, inclusive parcelas futuras (+ o ajuste pelo app do banco). */
export function limiteUsado(cartao: Cartao, dados: Dados) {
  return Math.min(Math.max(limiteUsadoPelasCompras(cartao, dados) + (cartao.ajusteLimite ?? 0), 0), cartao.limite || Infinity);
}

/** O limite usado só pelo que está cadastrado no app. */
export function limiteUsadoPelasCompras(cartao: Cartao, dados: Dados) {
  // Todas as faturas que têm alguma coisa: as das parcelas das compras e até a fatura aberta (gastos fixos)
  const faturas = new Set<string>([faturaAberta(cartao)]);
  for (const compra of dados.compras) {
    if (compra.cartaoId !== cartao.id) continue;
    for (let i = compra.parcelasPagas ?? 0; i < compra.parcelas; i++) faturas.add(faturaDaParcela(compra, cartao, i));
  }

  // Assinaturas ocupam o limite até a fatura aberta (as de meses futuros ainda não)
  const aberta = faturaAberta(cartao);
  let usado = 0;
  for (const fatura of faturas) {
    const valor = itensDaFatura(cartao, fatura, dados, aberta).reduce((total, i) => total + i.valor, 0);
    usado += Math.max(valor - pagoNaFatura(cartao, fatura, dados.pagamentos), 0);
  }
  return usado;
}

/**
 * Faturas de meses anteriores que fecharam e não foram pagas (atrasadas).
 * Olha até 12 meses para trás, a partir de quando o cartão foi cadastrado.
 */
export function faturasAtrasadas(cartao: Cartao, dados: Dados, mes = hojeISO().slice(0, 7)) {
  const primeira = faturaDaData(cartao.criadoEm, cartao);
  const hoje = hojeISO();
  const atrasadas: { fatura: string; restante: number; vencimento: string }[] = [];
  for (let i = 12; i >= 1; i--) {
    const fatura = somarMeses(mes, -i);
    if (fatura < primeira) continue;
    const r = resumoDaFatura(cartao, fatura, dados);
    if (r.restante > 0.005 && r.vencimento < hoje) atrasadas.push({ fatura, restante: r.restante, vencimento: r.vencimento });
  }
  return atrasadas;
}

/** Quantas parcelas de uma compra já estão pagas (as informadas na inclusão + as de faturas quitadas). */
export function parcelasPagasDaCompra(compra: CompraCartao, cartao: Cartao, dados: Dados) {
  let pagas = compra.parcelasPagas ?? 0;
  for (let i = pagas; i < compra.parcelas; i++) {
    const r = resumoDaFatura(cartao, faturaDaParcela(compra, cartao, i), dados);
    if (r.situacao === "paga") pagas++;
  }
  return pagas;
}
