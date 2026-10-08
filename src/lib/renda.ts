// O que cada fonte de renda paga em um mês: salário (ou a média), adiantamento, 13º, férias e benefícios.
// Usado pela previsão (Lançamentos, Início, Projeção) e pela aba Renda, para os números serem os mesmos.

import {
  beneficioEmDinheiro,
  iconeDoBeneficio,
  rendaFixa,
  totalBeneficios,
  type Beneficio,
  type FonteRenda,
  type Lancamento,
  type ParteRenda,
} from "./store";
import { dataDoRecebimento, diasEntre, hojeISO, somarDias } from "./formato";

/** Freela semanal (7 dias) ou quinzenal (14 dias): de quantos em quantos dias cai. */
export function intervaloDaRenda(f: FonteRenda) {
  return f.frequencia === "semanal" ? 7 : f.frequencia === "quinzenal" ? 14 : 0;
}

/** As datas em que uma renda semanal/quinzenal cai no mês. */
function datasDaRendaNoMes(f: FonteRenda, mes: string) {
  const intervalo = intervaloDaRenda(f);
  const inicio = f.inicio ?? `${mes}-01`;
  const inicioMes = `${mes}-01`;
  const fimMes = dataDoRecebimento("31", mes);
  if (inicio > fimMes) return [];
  let data = inicio < inicioMes ? somarDias(inicio, Math.ceil(diasEntre(inicio, inicioMes) / intervalo) * intervalo) : inicio;
  const datas: string[] = [];
  while (data <= fimMes) {
    datas.push(data);
    data = somarDias(data, intervalo);
  }
  return datas;
}

export type ParteDaRenda = {
  chave: string;
  parte: ParteRenda;
  nome: string;
  icone: string;
  data: string;
  valor: number;
  dinheiro: boolean; // false = vale (VR/VA): não é dinheiro livre
  contaId?: string; // onde cai
  beneficio?: Beneficio;
};

const NOMES: Record<Exclude<ParteRenda, "beneficio">, string> = {
  salario: "",
  adiantamento: "Adiantamento",
  decimo1: "13º salário (1ª parcela)",
  decimo2: "13º salário (2ª parcela, aprox.)",
  ferias: "1/3 de férias",
};

/** Tudo o que a fonte paga no mês (sem olhar o que já caiu). */
export function partesDaRenda(f: FonteRenda, mes: string): ParteDaRenda[] {
  const partes: ParteDaRenda[] = [];
  const dataSalario = dataDoRecebimento(f.diaRecebimento ?? "31", mes);
  const fixa = rendaFixa(f.forma);
  const base = { dinheiro: true, contaId: f.contaId, icone: "💼" };
  const numeroDoMes = Number(mes.slice(5, 7));

  // Freela que cai toda semana / a cada 15 dias: uma entrada para cada data do mês
  if (intervaloDaRenda(f)) {
    for (const data of datasDaRendaNoMes(f, mes))
      partes.push({
        ...base,
        chave: `renda-${f.id}-${data}`,
        parte: "salario",
        nome: `${f.nome}${fixa ? "" : " (média)"}`,
        data,
        valor: f.valor,
      });
  }

  // Vale-transporte: vem dentro do salário (uma entrada só, no dia e na conta do salário)
  const vt = intervaloDaRenda(f)
    ? 0
    : (f.beneficios ?? []).filter((b) => b.tipo === "transporte").reduce((t, b) => t + b.valor, 0);

  // Salário (com adiantamento no meio do mês, se tiver)
  const pct = fixa && f.adiantamento ? Math.min(Math.max(f.adiantamento.percentual, 0), 100) / 100 : 0;
  if (pct > 0 && f.adiantamento) {
    partes.push({
      ...base,
      chave: `adiantamento-${f.id}-${mes}`,
      parte: "adiantamento",
      nome: `${NOMES.adiantamento} · ${f.nome}`,
      data: dataDoRecebimento(f.adiantamento.dia, mes),
      valor: round(f.valor * pct),
    });
  }
  if (!intervaloDaRenda(f))
    partes.push({
      ...base,
      chave: `renda-${f.id}-${mes}`,
      parte: "salario",
      nome: fixa ? f.nome : `${f.nome} (média)`,
      data: dataSalario,
      valor: round(f.valor * (1 - pct) + vt),
    });

  // 13º (novembro e dezembro) e 1/3 de férias, para quem é CLT
  if (fixa && f.decimoTerceiro && numeroDoMes === 11)
    partes.push({
      ...base,
      chave: `decimo1-${f.id}-${mes}`,
      parte: "decimo1",
      nome: `${NOMES.decimo1} · ${f.nome}`,
      data: dataDoRecebimento("30", mes),
      valor: round(f.valor / 2),
      icone: "🎄",
    });
  if (fixa && f.decimoTerceiro && numeroDoMes === 12)
    partes.push({
      ...base,
      chave: `decimo2-${f.id}-${mes}`,
      parte: "decimo2",
      nome: `${NOMES.decimo2} · ${f.nome}`,
      data: dataDoRecebimento("20", mes),
      valor: round(f.valor / 2),
      icone: "🎄",
    });
  if (fixa && f.mesFerias === numeroDoMes)
    partes.push({
      ...base,
      chave: `ferias-${f.id}-${mes}`,
      parte: "ferias",
      nome: `${NOMES.ferias} · ${f.nome}`,
      data: dataSalario,
      valor: round(f.valor / 3),
      icone: "🏖️",
    });

  // Benefícios (vale-transporte, VR, VA…): vale vai para a conta de vale e não conta como dinheiro
  for (const b of f.beneficios ?? []) {
    if (vt > 0 && b.tipo === "transporte") continue; // já está no salário
    const dinheiro = beneficioEmDinheiro(b);
    partes.push({
      chave: `ben-${f.id}-${b.tipo}-${b.nome}-${mes}`,
      parte: "beneficio",
      nome: `${b.nome} · ${f.nome}`,
      icone: iconeDoBeneficio(b.tipo),
      data: dataSalario,
      valor: b.valor,
      dinheiro,
      contaId: b.contaId ?? (dinheiro ? f.contaId : undefined),
      beneficio: b,
    });
  }
  return partes;
}

/**
 * O que ainda vai cair da fonte no mês: tira o que já foi registrado e o que já passou
 * (dia que já passou = já caiu; ele é registrado sozinho por `registrarRendaQueJaCaiu`).
 */
export function rendaPendente(f: FonteRenda, mes: string, lancamentos: Lancamento[], hoje = hojeISO()): ParteDaRenda[] {
  return rendaNaoRegistrada(f, mes, lancamentos).filter((p) => p.data >= hoje);
}

/** O que a fonte paga no mês e ainda não tem lançamento (já tendo passado ou não). */
export function rendaNaoRegistrada(f: FonteRenda, mes: string, lancamentos: Lancamento[]): ParteDaRenda[] {
  const doMes = lancamentos.filter((l) => l.tipo === "entrada" && l.fonteId === f.id && l.data.startsWith(mes));
  // Recebimentos antigos (sem dizer qual parte) contam para o salário/adiantamento, na ordem das datas
  let semParte = doMes.filter((l) => !l.parteRenda && !l.beneficio).reduce((t, l) => t + l.valor, 0);
  return partesDaRenda(f, mes)
    .sort((a, b) => a.data.localeCompare(b.data))
    .filter((p) => {
      if (p.parte === "beneficio") return !doMes.some((l) => l.beneficio === p.beneficio?.tipo);
      if (doMes.some((l) => l.parteRenda === p.parte)) return false;
      if ((p.parte === "salario" || p.parte === "adiantamento") && semParte > 0.005) {
        semParte -= p.valor;
        return false;
      }
      return true;
    });
}

/** Quanto a fonte rende por mês. Com `soDinheiro`, sem os vales (é o que entra na sobra e na % da renda). */
export function rendaMensal(f: FonteRenda, soDinheiro = false) {
  const intervalo = intervaloDaRenda(f);
  const salario = intervalo ? (f.valor * 30) / intervalo : f.valor;
  return round(salario + totalBeneficios(f, soDinheiro));
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
