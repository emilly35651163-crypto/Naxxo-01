// Contas de juros para empréstimos, financiamentos e compras parceladas
// com parcelas iguais (Tabela Price, o mais comum no Brasil).

/**
 * Descobre a taxa de juros ao mês a partir do valor original (sem juros),
 * do valor da parcela e do número de parcelas. Ex.: 0.021 = 2,1% ao mês.
 * Devolve 0 quando não há juros e null quando os números não fecham.
 */
export function taxaImplicita(valorOriginal: number, parcela: number, parcelas: number): number | null {
  if (!(valorOriginal > 0) || !(parcela > 0) || !(parcelas > 0)) return null;
  if (parcela * parcelas <= valorOriginal) return 0;

  // Quanto valeria hoje a soma das parcelas, com a taxa i
  const valorHoje = (i: number) => (parcela * (1 - Math.pow(1 + i, -parcelas))) / i;

  // Busca a taxa por tentativa: cada passo corta o intervalo pela metade
  let baixo = 1e-9;
  let alto = 1;
  for (let passo = 0; passo < 100; passo++) {
    const meio = (baixo + alto) / 2;
    if (valorHoje(meio) > valorOriginal) baixo = meio;
    else alto = meio;
  }
  return (baixo + alto) / 2;
}

/**
 * Quanto custa hoje adiantar as últimas `quantas` parcelas, e quanto isso economiza de juros.
 * Considera que a próxima parcela vence agora (t = 0) e as seguintes, uma por mês.
 */
export function adiantarParcelas(parcela: number, restantes: number, quantas: number, taxa: number) {
  let custo = 0;
  for (let t = restantes - quantas; t < restantes; t++) {
    custo += parcela / Math.pow(1 + taxa, t);
  }
  const semDesconto = parcela * quantas;
  return { custo, economia: semDesconto - custo, semDesconto };
}

/** 0.021 -> "2,1%" */
export function formatarTaxa(taxa: number) {
  return `${(taxa * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}
