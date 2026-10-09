// Padrão do extrato → renda ou gasto fixo que o app acompanha sozinho.
// - O valor se atualiza com o extrato (salário que muda, luz, água: média dos últimos meses; assinatura que subiu: o novo preço).
// - Os lançamentos do extrato daquele padrão se ligam a ele (assim a previsão não conta duas vezes).

import {
  adicionarFonte,
  adicionarGastoFixo,
  atualizarCompra,
  atualizarFonte,
  atualizarGastoFixo,
  iconeDaCategoria,
  lerCompras,
  lerFontes,
  lerGastosFixos,
  lerLancamentos,
  lerPreferencias,
  atualizarLancamento,
  mudarPreferencias,
  type CategoriaFixo,
  type GastoFixo,
} from "./store";
import { chaveDoPadrao, descobrirPadroes, type Padrao } from "./padroes";
import { hojeISO, mesAtual, somarMeses } from "./formato";

const CATEGORIA_FIXO: Record<string, CategoriaFixo> = {
  Moradia: "moradia",
  "Contas da casa": "contas",
  Assinaturas: "assinaturas",
  Saúde: "saude",
  "Cuidados pessoais": "saude",
  Educação: "educacao",
  Transporte: "transporte",
};

export function padroesAtuais() {
  return descobrirPadroes(lerLancamentos(), lerCompras(), hojeISO());
}

/** "Acompanhar": vira renda (entrada) ou gasto fixo (saída) e liga o histórico a ele */
export function acompanharPadrao(p: Padrao) {
  const intervalo = p.frequencia === "frequente" || p.frequencia === "semanal" || p.frequencia === "quinzenal";
  if (p.tipo === "entrada") {
    adicionarFonte({
      nome: p.nome,
      forma: p.varia ? "outro" : "fixo",
      valor: intervalo ? p.valor : p.porMes,
      valorHora: null,
      horasMes: null,
      diaRecebimento: String(p.dia ?? Number(p.ultimaData.slice(8, 10))),
      frequencia: p.frequencia === "semanal" ? "semanal" : p.frequencia === "quinzenal" ? "quinzenal" : "mensal",
      inicio: intervalo ? p.ultimaData : undefined,
      contaId: p.contaId,
      padrao: p.chave,
    });
  } else {
    const fixo: Omit<GastoFixo, "id"> = {
      nome: p.nome,
      icone: iconeDaCategoria("saida", p.categoria),
      categoria: CATEGORIA_FIXO[p.categoria] ?? "outros",
      valor: intervalo ? p.valor : p.frequencia === "anual" ? p.valor : p.porMes,
      varia: p.varia,
      dia: p.dia ?? Number(p.ultimaData.slice(8, 10)),
      pagamento: p.cartaoId ? "cartao" : "debito",
      cartaoId: p.cartaoId,
      contaId: p.contaId,
      desde: mesAtual(),
      padrao: p.chave,
      ...(intervalo ? { frequencia: "personalizada" as const, intervaloDias: p.intervaloDias, inicio: p.ultimaData } : {}),
      ...(p.frequencia === "anual" ? { frequencia: "anual" as const, mesReferencia: p.ultimaData.slice(0, 7) } : {}),
    };
    adicionarGastoFixo(fixo);
  }
  ligarAosPadroes();
}

/** "Não é fixo" (ou, com `parou`, "ainda tenho"): o app não pergunta mais */
export function ignorarPadrao(chave: string, parou = false) {
  const lista = lerPreferencias().padroesIgnorados ?? [];
  mudarPreferencias({ padroesIgnorados: [...lista, parou ? `${chave}|parou` : chave] });
}

/** Parou de vir e a pessoa confirmou "cancelei": o gasto fixo acaba no último mês em que veio */
export function cancelarPadrao(p: Padrao) {
  const fixo = lerGastosFixos().find((f) => f.padrao === p.chave);
  if (fixo)
    atualizarGastoFixo(fixo.id, {
      ate: p.ultimaData.slice(0, 7) < fixo.desde ? somarMeses(fixo.desde, -1) : p.ultimaData.slice(0, 7),
    });
  ignorarPadrao(p.chave, true);
}

/**
 * Pode rodar sempre (ao abrir o app, depois de importar):
 * - liga ao fixo/renda os lançamentos e compras do extrato daquele padrão;
 * - atualiza o valor dos que mudam (média dos últimos meses) e das assinaturas que mudaram de preço.
 */
export function ligarAosPadroes(padroes?: Padrao[]) {
  const fixos = lerGastosFixos().filter((f) => f.padrao);
  const fontes = lerFontes().filter((f) => f.padrao);
  if (fixos.length === 0 && fontes.length === 0) return;

  for (const l of lerLancamentos()) {
    if (l.transferenciaId || l.gastoFixoId || l.fonteId) continue;
    const chave = chaveDoPadrao(l.descricaoBanco ?? l.descricao, l.tipo, l.subcategoria);
    if (l.tipo === "saida") {
      const f = fixos.find((x) => x.padrao === chave && x.pagamento !== "cartao");
      if (f) atualizarLancamento(l.id, { gastoFixoId: f.id, competencia: l.data.slice(0, 7) });
    } else {
      const f = fontes.find((x) => x.padrao === chave);
      if (f) atualizarLancamento(l.id, { fonteId: f.id });
    }
  }
  for (const c of lerCompras()) {
    if (c.gastoFixoId || c.parcelas > 1) continue;
    const f = fixos.find((x) => x.padrao === chaveDoPadrao(c.descricaoBanco ?? c.descricao, "saida", c.subcategoria));
    if (f) atualizarCompra(c.id, { gastoFixoId: f.id, competencia: c.data.slice(0, 7) });
  }

  const ps = padroes ?? padroesAtuais();
  for (const f of fixos) {
    const p = ps.find((x) => x.chave === f.padrao);
    if (!p) continue;
    const novo = f.frequencia === "personalizada" || f.frequencia === "anual" ? p.valor : p.porMes;
    if ((f.varia || p.mudou) && Math.abs(novo - f.valor) >= 0.5) atualizarGastoFixo(f.id, { valor: novo });
  }
  for (const f of fontes) {
    const p = ps.find((x) => x.chave === f.padrao);
    if (!p) continue;
    const novo = f.frequencia && f.frequencia !== "mensal" ? p.valor : p.porMes;
    if (p.varia && Math.abs(novo - f.valor) >= 0.5) atualizarFonte(f.id, { valor: novo });
  }
}
