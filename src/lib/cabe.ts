// "Cabe no meu mês?": um gasto novo que vai se repetir (academia, curso, plano…) cabe sem apertar?
// Olha a previsão dos próximos meses (o que entra menos o que já sai) e tira o gasto novo de cada um.

import { mesAtual, somarMeses } from "./formato";
import { adicionarGastoFixo, lerCartoes, type Desejo } from "./store";
import { previstosDoMes, resumoDoMes, type Dados } from "./previstos";

export type Veredito = "cabe" | "aperta" | "depois" | "nao";

export type Avaliacao = {
  veredito: Veredito;
  /** "depois": o primeiro mês em que cabe (de lá em diante) */
  aPartirDe?: string;
  /** "nao": quanto faltaria no pior mês */
  falta?: number;
  /** Até quanto por mês caberia com folga, começando no mês escolhido */
  cabeAte: number;
  meses: { mes: string; sobra: number; depois: number }[];
};

/** Folga mínima: 10% do que entra no mês (para imprevistos), nunca menos que R$ 50 */
const folgaDo = (entra: number) => Math.max(entra * 0.1, 50);

/** Quanto sobra em cada mês a partir de `inicio` (o que ficou a pagar de antes conta uma vez só) e a folga de cada um */
function sobrasDosMeses(inicio: string, quantos: number, dados: Dados) {
  return Array.from({ length: quantos }, (_, i) => {
    const mes = somarMeses(inicio, i);
    const r = resumoDoMes(mes, dados);
    // O que ficou a pagar de meses anteriores aparece em todo mês seguinte até ser pago: aqui conta uma vez só (no primeiro)
    const arrastado =
      i === 0
        ? 0
        : previstosDoMes(mes, dados)
            .filter((p) => p.tipo === "saida" && p.data < `${mes}-01`)
            .reduce((t, p) => t + p.valor, 0);
    return { mes, sobra: r.sobra + arrastado, folga: folgaDo(r.entra) };
  });
}

export function avaliarGastoMensal(valor: number, inicio: string, vezes: number | null, dados: Dados, horizonte = 6): Avaliacao {
  const quantos = vezes ? Math.min(vezes, horizonte) : horizonte;
  const meses = sobrasDosMeses(inicio, quantos, dados).map((m) => ({ ...m, depois: m.sobra - valor }));
  const cabeAte = Math.max(Math.floor(Math.min(...meses.map((m) => m.sobra - m.folga))), 0);
  const lista = meses.map(({ mes, sobra, depois }) => ({ mes, sobra, depois }));

  if (meses.every((m) => m.depois >= m.folga)) return { veredito: "cabe", cabeAte, meses: lista };
  if (meses.every((m) => m.depois >= 0)) return { veredito: "aperta", cabeAte, meses: lista };

  // Não cabe no começo: a partir de qual mês cabe (e continua cabendo)?
  for (let i = 1; i < meses.length; i++)
    if (meses.slice(i).every((m) => m.depois >= 0)) return { veredito: "depois", aPartirDe: meses[i].mes, cabeAte, meses: lista };

  const falta = Math.max(...meses.map((m) => -m.depois));
  return { veredito: "nao", falta, cabeAte, meses: lista };
}

/** Assume o gasto: vira gasto fixo a partir do mês (todo dia 10, da primeira conta; dá para mudar em Contas). */
export function assumirGastoMensal(g: { nome: string; icone: string; valor: number; inicio: string; vezes?: number | null }) {
  const nome = g.nome.trim() || "Gasto mensal";
  adicionarGastoFixo({
    nome,
    icone: g.icone,
    categoria: /academia|plano|saude|saúde|medic|médic/i.test(nome)
      ? "saude"
      : /curso|escola|faculdade/i.test(nome)
        ? "educacao"
        : "outros",
    valor: g.valor,
    varia: false,
    dia: 10,
    pagamento: "debito",
    contaId: lerCartoes().find((c) => c.tipo !== "vale")?.id,
    desde: g.inicio,
    ate: g.vezes && g.vezes > 0 ? somarMeses(g.inicio, g.vezes - 1) : undefined,
  });
}

export type PlanoDesejos = {
  /** Mês de cada desejo no plano (comprar ou começar); null = não cabe nos próximos meses */
  quando: Record<string, string | null>;
  /** Os meses que têm alguma coisa, em ordem */
  linha: { mes: string; itens: Desejo[] }[];
  todosCabem: boolean;
};

/**
 * Todos os desejos juntos, pela prioridade (a ordem da lista). Mês a mês, a sobra (já com folga para imprevistos) vai sendo usada:
 * - mensal (academia…): começa no primeiro mês em que cabe todo mês dali em diante, já contando os mensais de antes;
 * - compra única (perfume…): no primeiro mês em que a sobra juntada até ali paga, sem deixar faltar depois.
 */
export function planoDosDesejos(desejos: Desejo[], dados: Dados, horizonte = 12): PlanoDesejos {
  const inicio = mesAtual();
  const base = sobrasDosMeses(inicio, horizonte, dados);
  const fluxo = base.map((m) => m.sobra - m.folga); // o que dá para usar em cada mês (depois dos mensais já planejados)
  const compras = base.map(() => 0); // compras únicas planejadas em cada mês
  // Juntando de um mês para o outro, o dinheiro nunca pode ficar negativo a partir de `desde`
  const semFaltar = (desde: number, f: number[], c: number[]) => {
    let juntado = 0;
    for (let i = 0; i < horizonte; i++) {
      juntado += f[i] - c[i];
      if (i >= desde && juntado < 0) return false;
    }
    return true;
  };

  const quando: Record<string, string | null> = {};
  for (const d of desejos) {
    let achou: number | null = null;
    for (let s = 0; s < horizonte && achou === null; s++) {
      if (d.mensal) {
        const fim = d.mensal.vezes ? Math.min(s + d.mensal.vezes, horizonte) : horizonte;
        const f = fluxo.map((v, i) => (i >= s && i < fim ? v - d.valor : v));
        if (f.slice(s, fim).every((v) => v >= 0) && semFaltar(s, f, compras)) {
          f.forEach((v, i) => (fluxo[i] = v));
          achou = s;
        }
      } else {
        const c = compras.map((v, i) => (i === s ? v + d.valor : v));
        if (semFaltar(s, fluxo, c)) {
          c.forEach((v, i) => (compras[i] = v));
          achou = s;
        }
      }
    }
    quando[d.id] = achou === null ? null : base[achou].mes;
  }

  const linha = base
    .map((m) => ({ mes: m.mes, itens: desejos.filter((d) => quando[d.id] === m.mes) }))
    .filter((m) => m.itens.length > 0);
  return { quando, linha, todosCabem: desejos.every((d) => quando[d.id] !== null) };
}
