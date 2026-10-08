// "Cabe no meu mês?": um gasto novo que vai se repetir (academia, curso, plano…) cabe sem apertar?
// Olha a previsão dos próximos meses (o que entra menos o que já sai) e tira o gasto novo de cada um.

import { somarMeses } from "./formato";
import { adicionarGastoFixo, lerCartoes } from "./store";
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

export function avaliarGastoMensal(valor: number, inicio: string, vezes: number | null, dados: Dados, horizonte = 6): Avaliacao {
  const quantos = vezes ? Math.min(vezes, horizonte) : horizonte;
  const meses = Array.from({ length: quantos }, (_, i) => {
    const mes = somarMeses(inicio, i);
    const r = resumoDoMes(mes, dados);
    // O que ficou a pagar de meses anteriores aparece em todo mês seguinte até ser pago: aqui conta uma vez só (no primeiro)
    const arrastado =
      i === 0
        ? 0
        : previstosDoMes(mes, dados)
            .filter((p) => p.tipo === "saida" && p.data < `${mes}-01`)
            .reduce((t, p) => t + p.valor, 0);
    const sobra = r.sobra + arrastado;
    return { mes, sobra, depois: sobra - valor, folga: folgaDo(r.entra) };
  });
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
