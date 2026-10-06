import type { Meta } from "./store";
import { mesAtual, mesesEntre, somarMeses } from "./formato";
import { taxaImplicita } from "./juros";

/** Todas as contas da trilha de uma meta: quanto falta, quanto guardar por mês, quando chega. */
export function calcularMeta(meta: Meta) {
  const hoje = mesAtual();
  const falta = Math.max(meta.alvo - meta.guardado, 0);
  const progresso = meta.alvo > 0 ? Math.min(meta.guardado / meta.alvo, 1) : 0;
  const concluida = meta.alvo > 0 && falta === 0;

  // Meses que ainda dá para guardar até o prazo, contando o mês atual
  const mesesAtePrazo = meta.prazo ? mesesEntre(hoje, meta.prazo) + 1 : null;
  const prazoPassou = !concluida && mesesAtePrazo !== null && mesesAtePrazo <= 0;

  // Quanto precisa guardar por mês para chegar no prazo
  const precisaPorMes = !concluida && mesesAtePrazo !== null && mesesAtePrazo > 0 ? falta / mesesAtePrazo : null;

  // O ritmo usado na previsão: o que a pessoa disse que consegue guardar, ou o necessário para o prazo
  const ritmo = meta.aporteMensal || precisaPorMes;
  const previsao = concluida ? hoje : ritmo ? somarMeses(hoje, Math.ceil(falta / ritmo) - 1) : null;

  // Guardando no ritmo dela, chega depois do prazo?
  const atrasaNoRitmo = !concluida && !!meta.aporteMensal && !!meta.prazo && !!previsao && previsao > meta.prazo;

  return { falta, progresso, concluida, precisaPorMes, ritmo, previsao, prazoPassou, atrasaNoRitmo };
}

/**
 * Monta uma meta de quitar algo parcelado.
 * Considera que a parcela deste mês ainda vai ser paga, então a última cai daqui a (restantes - 1) meses.
 */
export function metaDeQuitar(dados: {
  nome: string;
  icone: string;
  divida?: Meta["divida"];
  parcela: number;
  parcelas: number;
  parcelasPagas: number;
  valorOriginal?: number;
  jurosMes?: number;
  diaVencimento?: number;
}): Omit<Meta, "id"> {
  const pagas = Math.min(dados.parcelasPagas, dados.parcelas);
  const restantes = dados.parcelas - pagas;
  return {
    nome: dados.nome,
    icone: dados.icone,
    tipo: "quitar",
    divida: dados.divida ?? "parcelado",
    valorOriginal: dados.valorOriginal || undefined,
    jurosMes: dados.jurosMes || undefined,
    diaVencimento: dados.diaVencimento,
    parcela: dados.parcela,
    parcelas: dados.parcelas,
    parcelasPagas: pagas,
    alvo: dados.parcela * dados.parcelas,
    guardado: dados.parcela * pagas,
    aporteMensal: dados.parcela,
    prazo: somarMeses(mesAtual(), Math.max(restantes - 1, 0)),
  };
}

/** A taxa de juros ao mês de uma dívida: a do contrato, ou a calculada pelo valor original. */
export function taxaDaDivida(meta: Pick<Meta, "jurosMes" | "valorOriginal" | "parcela" | "parcelas">) {
  if (meta.jurosMes) return meta.jurosMes;
  if (meta.valorOriginal && meta.parcela && meta.parcelas) {
    return taxaImplicita(meta.valorOriginal, meta.parcela, meta.parcelas);
  }
  return null;
}

export function mensagemDaTrilha(progresso: number, tipo: Meta["tipo"] = "juntar") {
  if (tipo === "quitar") {
    if (progresso >= 1) return "Quitado! Livre dessa dívida 🎉";
    if (progresso >= 0.75) return "Reta final, faltam poucas parcelas! 🔥";
    if (progresso >= 0.5) return "Mais da metade já foi! 💪";
    if (progresso >= 0.25) return "Um quarto quitado. Bora! 🚀";
    if (progresso > 0) return "Cada parcela paga é um passo. ✨";
    return "A primeira parcela te espera.";
  }
  if (progresso >= 1) return "Conquista desbloqueada! 🎉";
  if (progresso >= 0.75) return "Reta final, falta pouquinho! 🔥";
  if (progresso >= 0.5) return "Metade do caminho percorrido! 💪";
  if (progresso >= 0.25) return "Primeiro marco alcançado. Bora! 🚀";
  if (progresso > 0) return "Você começou! Cada real conta. ✨";
  return "Primeiro passo: guarde qualquer valor para começar a trilha.";
}
