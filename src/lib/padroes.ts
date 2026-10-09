// Padrões (docs/NOVO-SISTEMA.md, etapa 5): com o histórico do extrato, o app descobre sozinho o que se repete.
// - mensal: salário, aluguel, luz, assinatura (valor igual OU que muda todo mês: média dos últimos meses e a faixa);
// - semanal/quinzenal;
// - frequente sem dia certo (gasolina, uber): de quantos em quantos dias, em média, e quanto por vez;
// - anual (IPVA, anuidade).
// Também avisa o que parou de vir ("cancelou?") e assinatura que mudou de preço.

import { chaveDoItem } from "./regras";
import { mesAtual, somarMeses } from "./formato";
import type { CompraCartao, FonteRenda, GastoFixo, Lancamento, Tipo } from "./store";

export type FrequenciaPadrao = "mensal" | "semanal" | "quinzenal" | "frequente" | "anual";

export type Padrao = {
  chave: string;
  tipo: Tipo;
  nome: string;
  categoria: string;
  subcategoria?: string;
  frequencia: FrequenciaPadrao;
  /** mensal/anual: dia do mês em que costuma cair */
  dia?: number;
  /** frequente/semanal/quinzenal: de quantos em quantos dias */
  intervaloDias?: number;
  /** Quanto por vez (mensal: por mês). Valor que muda = média dos últimos 3 */
  valor: number;
  min: number;
  max: number;
  varia: boolean;
  /** Quanto pesa por mês (frequente: soma média do mês) */
  porMes: number;
  vezes: number;
  ultimaData: string;
  /** Veio no cartão (todas as vezes) */
  cartaoId?: string;
  contaId?: string;
  /** Vinha sempre e parou (o último mês esperado não veio) */
  parou?: boolean;
  /** Valor fixo que mudou na última vez */
  mudou?: { de: number; para: number };
};

type Ocorrencia = {
  data: string;
  valor: number;
  nome: string;
  categoria: string;
  subcategoria?: string;
  cartaoId?: string;
  contaId?: string;
};

const ESPECIAIS = ["Fatura do cartão", "Guardar (metas)", "Transferência"];
const diasEntre = (a: string, b: string) =>
  Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 864e5);
const mediana = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};
const media = (xs: number[]) => (xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : 0);
const centavos = (n: number) => Math.round(n * 100) / 100;
const mesesNoIntervalo = (de: string, ate: string) => {
  const [a, b] = [de.slice(0, 7), ate.slice(0, 7)];
  return (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7)) + 1;
};
const maisComum = <T>(xs: T[]) => {
  const n = new Map<T, number>();
  xs.forEach((x) => n.set(x, (n.get(x) ?? 0) + 1));
  return [...n].sort((a, b) => b[1] - a[1])[0]?.[0];
};

const POR_SUB = ["Combustível", "App de corrida", "Delivery"];

/** A chave do padrão de um item: a descrição do banco; combustível/corrida/delivery juntam pela subcategoria */
export const chaveDoPadrao = (texto: string, tipo: Tipo, sub?: string) =>
  sub && POR_SUB.includes(sub) ? `${tipo}|sub:${sub}` : chaveDoItem(texto, tipo);

/** Junta o que se repete: pela descrição do banco (chave) e, no caso de combustível/corrida, pela subcategoria (postos diferentes) */
function agrupar(lancamentos: Lancamento[], compras: CompraCartao[]) {
  const grupos = new Map<string, { tipo: Tipo; itens: Ocorrencia[] }>();
  const por = (chave: string, tipo: Tipo, o: Ocorrencia) => {
    const g = grupos.get(chave) ?? { tipo, itens: [] };
    g.itens.push(o);
    grupos.set(chave, g);
  };
  const chaveDe = chaveDoPadrao;

  for (const l of lancamentos) {
    if (!l.pago || l.transferenciaId || ESPECIAIS.includes(l.categoria) || l.metaId) continue;
    const chave = chaveDe(l.descricaoBanco ?? l.descricao, l.tipo, l.subcategoria);
    if (chave.endsWith("|")) continue;
    por(chave, l.tipo, {
      data: l.data,
      valor: l.valor,
      nome: l.descricao,
      categoria: l.categoria,
      subcategoria: l.subcategoria,
      contaId: l.contaId,
    });
  }
  for (const c of compras) {
    if (c.parcelas > 1 || c.metaId) continue; // parcelado tem a própria conta (quantas faltam)
    const chave = chaveDe(c.descricaoBanco ?? c.descricao, "saida", c.subcategoria);
    if (chave.endsWith("|")) continue;
    por(chave, "saida", {
      data: c.data,
      valor: c.valorTotal,
      nome: c.descricao,
      categoria: c.categoria,
      subcategoria: c.subcategoria,
      cartaoId: c.cartaoId,
    });
  }
  return grupos;
}

function analisar(chave: string, tipo: Tipo, itens: Ocorrencia[], hoje: string): Padrao | null {
  const os = [...itens].sort((a, b) => a.data.localeCompare(b.data));
  if (os.length < 2) return null;
  const ultima = os[os.length - 1];
  const subcategoria = maisComum(os.map((o) => o.subcategoria).filter(Boolean) as string[]);
  // Agrupado pela subcategoria (postos diferentes): o nome é a subcategoria ("Combustível")
  const nome = chave.includes("|sub:") && subcategoria ? subcategoria : ultima.nome;
  const categoria = maisComum(os.map((o) => o.categoria)) ?? ultima.categoria;
  const cartaoId = os.every((o) => o.cartaoId) ? ultima.cartaoId : undefined;
  const contaId = cartaoId ? undefined : maisComum(os.map((o) => o.contaId).filter(Boolean) as string[]);
  const base = { chave, tipo, nome, categoria, subcategoria, ultimaData: ultima.data, vezes: os.length, cartaoId, contaId };
  const intervalos = os.slice(1).map((o, i) => diasEntre(os[i].data, o.data));
  const passo = mediana(intervalos);
  const span = mesesNoIntervalo(os[0].data, ultima.data);

  // Anual: duas ou mais vezes, uma por ano
  if (intervalos.every((d) => d >= 330 && d <= 400)) {
    const valores = os.map((o) => o.valor);
    return {
      ...base,
      frequencia: "anual",
      dia: Number(ultima.data.slice(8, 10)),
      valor: centavos(valores[valores.length - 1]),
      min: Math.min(...valores),
      max: Math.max(...valores),
      varia: Math.max(...valores) - Math.min(...valores) > 1,
      porMes: centavos(valores[valores.length - 1] / 12),
    };
  }
  if (os.length < 3) return null;

  // Mensal: mais ou menos uma vez por mês, na maioria dos meses (soma por mês: salário dividido em duas vezes conta junto)
  const porMesMap = new Map<string, number>();
  os.forEach((o) => porMesMap.set(o.data.slice(0, 7), (porMesMap.get(o.data.slice(0, 7)) ?? 0) + o.valor));
  const meses = [...porMesMap.keys()].sort();
  const umPorMes = os.length / meses.length <= 1.5;
  if (umPorMes && passo >= 24 && passo <= 38 && meses.length >= 3 && meses.length / span >= 0.75) {
    const totais = meses.map((m) => porMesMap.get(m)!);
    const ultimos = totais.slice(-6);
    const valor = centavos(media(totais.slice(-3)));
    const min = Math.min(...ultimos);
    const max = Math.max(...ultimos);
    const varia = max - min > Math.max(valor * 0.05, 1);
    const dia = Math.round(mediana(os.map((o) => Number(o.data.slice(8, 10)))));
    // Parou: o mês passado devia ter vindo (e o dia dele já passou bem) e não veio
    const esperado = somarMeses(mesAtual(), -1);
    const parou = ultima.data.slice(0, 7) < esperado && diasEntre(ultima.data, hoje) > 45;
    // Assinatura/conta de valor fixo que mudou de preço na última cobrança
    const ant = totais[totais.length - 2];
    const ult = totais[totais.length - 1];
    const antes = totais.slice(0, -1);
    const fixoAntes = antes.length >= 2 && Math.max(...antes) - Math.min(...antes) <= 0.01 * Math.max(...antes);
    const mudou = fixoAntes && Math.abs(ult - ant) > 0.5 ? { de: ant, para: ult } : undefined;
    return {
      ...base,
      frequencia: "mensal",
      dia,
      valor: mudou ? centavos(ult) : valor,
      min,
      max,
      varia: mudou ? false : varia,
      porMes: mudou ? centavos(ult) : valor,
      parou,
      mudou,
    };
  }

  // Semanal / quinzenal: intervalos regulares
  const regular = intervalos.filter((d) => Math.abs(d - passo) <= 2).length >= intervalos.length * 0.7;
  const valores = os.map((o) => o.valor);
  const valorVez = centavos(media(valores.slice(-6)));
  const variaVez = Math.max(...valores) - Math.min(...valores) > Math.max(valorVez * 0.05, 1);
  if (regular && ((passo >= 6 && passo <= 8 && os.length >= 4) || (passo >= 13 && passo <= 16))) {
    return {
      ...base,
      frequencia: passo <= 8 ? "semanal" : "quinzenal",
      intervaloDias: passo <= 8 ? 7 : Math.round(passo),
      valor: valorVez,
      min: Math.min(...valores),
      max: Math.max(...valores),
      varia: variaVez,
      porMes: centavos((valorVez * 30) / (passo <= 8 ? 7 : Math.round(passo))),
    };
  }

  // Frequente sem dia certo (gasolina, uber): várias vezes por mês, por pelo menos 2 meses
  if (span >= 2 && os.length / span >= 1.5) {
    const dias = Math.max(Math.round(diasEntre(os[0].data, ultima.data) / (os.length - 1)), 1);
    // Só meses completos (o mês atual ainda está no meio)
    const completos = meses.filter((m) => m < hoje.slice(0, 7));
    const totalPorMes = centavos(media((completos.length ? completos : meses).slice(-3).map((m) => porMesMap.get(m)!)));
    return {
      ...base,
      frequencia: "frequente",
      intervaloDias: dias,
      valor: valorVez,
      min: Math.min(...valores),
      max: Math.max(...valores),
      varia: true,
      porMes: totalPorMes,
    };
  }
  return null;
}

/** Todos os padrões do histórico (os mais importantes primeiro: renda, depois o que pesa mais por mês) */
export function descobrirPadroes(lancamentos: Lancamento[], compras: CompraCartao[], hoje: string): Padrao[] {
  const lista: Padrao[] = [];
  for (const [chave, g] of agrupar(lancamentos, compras)) {
    const p = analisar(chave, g.tipo, g.itens, hoje);
    if (p) lista.push(p);
  }
  return lista.sort((a, b) => Number(b.tipo === "entrada") - Number(a.tipo === "entrada") || b.porMes - a.porMes);
}

/** O padrão já está sendo acompanhado (virou renda ou gasto fixo)? */
export const acompanhado = (p: Padrao, fontes: FonteRenda[], fixos: GastoFixo[]) =>
  p.tipo === "entrada" ? fontes.some((f) => f.padrao === p.chave) : fixos.some((f) => f.padrao === p.chave);

/** "todo dia 5" · "a cada 9 dias" · "toda semana" · "1 vez por ano" */
export function descreverPadrao(p: Padrao) {
  if (p.frequencia === "mensal") return `todo mês, por volta do dia ${p.dia}`;
  if (p.frequencia === "anual") return "1 vez por ano";
  if (p.frequencia === "semanal") return "toda semana";
  if (p.frequencia === "quinzenal") return "a cada 15 dias";
  return `a cada ${p.intervaloDias} dias, mais ou menos`;
}
