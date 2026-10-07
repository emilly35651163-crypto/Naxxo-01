// Orientações de especialistas em finanças pessoais, usadas na Trilha.
// Referências (pesquisa de out/2026):
// - Reserva de emergência: 3 a 6 meses de gastos para renda fixa (CLT), 6 a 12 meses para renda variável
//   (autônomo, freela). A base é o que a pessoa GASTA por mês, não o que ganha.
//   Guardar de 10% (para começar) a 20% (ideal, regra 50/30/20) da renda por mês.
// - Carro: regra 20/4/10 (20% de entrada, até 4 anos, custos do carro até 10% da renda);
//   parcela ideal até 15% da renda líquida. Banco aceita até 30%, mas não é o recomendado.
// - Moto: 20% de entrada (mercado pede no mínimo 10%); parcela até 30% da renda é o teto.
// - Casa: banco (Caixa) aceita parcela até 30% da renda bruta e financia até 80% (entrada de 20%;
//   30% no SAC); somar uns 5% de custos de compra (ITBI, cartório).

import type { FonteRenda, GastoFixo, Meta } from "./store";
import { valorPorMes } from "./fixos";
import { rendaMensal } from "./renda";

export type TipoBem = "carro" | "moto" | "casa";

/** Descobre se a meta é um carro, uma moto ou uma casa pelo nome/ícone. */
export function tipoDoBem(meta: Pick<Meta, "nome" | "icone">): TipoBem | null {
  const texto = `${meta.nome} ${meta.icone}`.toLowerCase();
  if (/moto|🏍/.test(texto)) return "moto";
  if (/carro|🚗|🚙/.test(texto)) return "carro";
  if (/casa|apartamento|apê|ape\b|imóvel|imovel|terreno|🏡|🏠/.test(texto)) return "casa";
  return null;
}

/** O que entra em dinheiro por mês (sem vales, que não pagam imprevisto nem parcela). */
export function rendaEmDinheiro(fontes: FonteRenda[]) {
  return fontes.reduce((total, f) => total + rendaMensal(f, true), 0);
}

/**
 * A regra da reserva de emergência (uma só, usada no questionário e na Trilha): 3 meses.
 * Sem gastos conhecidos: 3 meses de tudo o que entra em dinheiro (salário, estágio, bolsa… sem os vales). Com gastos: 3 meses do que a pessoa gasta.
 */
export function alvoDaReserva(fontes: FonteRenda[], fixos: GastoFixo[], metas: Pick<Meta, "tipo" | "parcela">[], saidaMedia = 0) {
  const renda = rendaEmDinheiro(fontes);
  const rendaVariavel = fontes.some((f) => f.forma !== "fixo");
  const meses = 3;
  const gastoFixo = fixos.reduce((total, f) => total + valorPorMes(f), 0);
  const parcelas = metas.filter((m) => m.tipo === "quitar" && m.parcela).reduce((t, m) => t + (m.parcela ?? 0), 0);
  const gastoMensal = Math.max(gastoFixo + parcelas, saidaMedia);
  const provisoria = !(gastoMensal > 0);
  const base = provisoria ? renda : gastoMensal;
  return { alvo: Math.round(base * meses), meses, gastoMensal, renda, rendaVariavel, provisoria };
}

export type Orientacao = {
  titulo: string;
  linhas: string[];
  metaDoMesSugerida?: number; // botão "usar como meta do mês"
  alvoSugerido?: number; // botão "usar como objetivo"
  alerta?: string;
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Reserva de emergência: quanto ter no total e quanto guardar por mês.
 * `saidaMediaLancada`: média do que saiu por mês nos lançamentos (pega gastos que não são fixos, como mercado).
 */
export function orientacaoReserva(
  meta: Meta,
  fontes: FonteRenda[],
  fixos: GastoFixo[],
  metas: Meta[],
  saidaMediaLancada: number,
): Orientacao {
  const { renda, rendaVariavel, meses, gastoMensal, alvo } = alvoDaReserva(fontes, fixos, metas, saidaMediaLancada);

  const linhas = [
    rendaVariavel
      ? `Como parte da sua renda varia, o ideal é ter ${meses} meses dos seus gastos guardados.`
      : `Com renda fixa, o ideal é ter de 3 a 6 meses dos seus gastos guardados (usamos ${meses}).`,
    gastoMensal > 0
      ? `Você gasta em média ${brl(gastoMensal)} por mês → reserva ideal de ${brl(alvo)}.`
      : `Ainda não sabemos seus gastos; por enquanto usamos o que entra (${brl(renda)}) como base → ${brl(alvo)} (estimativa provisória: cadastre os gastos fixos para ficar certinho).`,
  ];
  if (gastoMensal > 0 && renda > 0 && gastoMensal < renda * 0.5) {
    linhas.push(
      "Esse gasto parece baixo perto do que entra: confira se aluguel, contas e mercado já estão no app. Quanto mais completo, mais certa fica a conta.",
    );
  }
  if (renda > 0) {
    linhas.push(`Para formar a reserva, guarde de 10% (${brl(renda * 0.1)}) a 20% (${brl(renda * 0.2)}) do que entra por mês.`);
  }
  linhas.push("Deixe a reserva num lugar seguro e com saque na hora (ex.: CDB com liquidez diária, Tesouro Selic).");

  return {
    titulo: "Reserva de emergência",
    linhas,
    metaDoMesSugerida: renda > 0 ? renda * 0.1 : undefined,
    alvoSugerido: alvo > 0 && Math.abs(alvo - meta.alvo) > 1 ? alvo : undefined,
  };
}

/** Carro, moto ou casa: entrada, parcela que cabe no bolso e quanto guardar por mês. */
export function orientacaoBem(meta: Meta, tipo: TipoBem, fontes: FonteRenda[]): Orientacao {
  const renda = rendaEmDinheiro(fontes);
  const preco = meta.alvo;
  const falta = Math.max(preco - meta.guardado, 0);

  if (tipo === "casa") {
    const entrada = preco * 0.2;
    const custos = preco * 0.05;
    const juntar = entrada + custos;
    const guardarMes = renda * 0.2;
    const faltaEntrada = Math.max(juntar - meta.guardado, 0);
    const linhas = [
      `O banco financia até 80% do imóvel: junte a entrada de 20% (${brl(entrada)}) + uns 5% de custos de compra, como ITBI e cartório (${brl(custos)}).`,
      `Se for financiar pelo SAC, alguns bancos pedem 30% de entrada (${brl(preco * 0.3)}).`,
    ];
    if (renda > 0) {
      linhas.push(`A parcela não pode passar de 30% da renda: no seu caso, até ${brl(renda * 0.3)} por mês.`);
      linhas.push(
        `Guardando 20% do que entra (${brl(guardarMes)}/mês), a entrada fica pronta em ${Math.ceil(faltaEntrada / guardarMes)} meses.`,
      );
    }
    return { titulo: "Casa própria", linhas, metaDoMesSugerida: renda > 0 ? guardarMes : undefined };
  }

  // Carro e moto
  const nome = tipo === "carro" ? "Carro" : "Moto";
  const parcelaIdeal = renda * 0.15;
  const entrada = preco * 0.2;
  const parcelaFinanciando = (preco * 0.8) / 48; // sem contar juros
  const linhas = [`Dê pelo menos 20% de entrada (${brl(entrada)}) e financie em no máximo 48 meses.`];
  if (renda > 0) {
    linhas.push(
      tipo === "carro"
        ? `A parcela ideal é de até 15% da renda (${brl(parcelaIdeal)}), e todos os custos do carro juntos (parcela, seguro, combustível, IPVA) até uns 10% a 15%.`
        : `A parcela ideal é de até 15% da renda (${brl(parcelaIdeal)}); 30% (${brl(renda * 0.3)}) é o máximo que os especialistas toleram.`,
    );
    linhas.push(
      `Guardando ${brl(parcelaIdeal)} por mês (15%), dá para comprar à vista em ${Math.ceil(falta / parcelaIdeal)} meses, sem pagar juros.`,
    );
  }

  const alerta =
    renda > 0 && parcelaFinanciando > parcelaIdeal
      ? `Atenção: mesmo financiando 80% em 48x, a parcela ficaria em ${brl(parcelaFinanciando)} sem contar os juros, acima dos 15% da sua renda.`
      : undefined;

  return { titulo: nome, linhas, metaDoMesSugerida: renda > 0 ? parcelaIdeal : undefined, alerta };
}
