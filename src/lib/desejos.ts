// Desejos: coisas pequenas (um perfume, um restaurante, uma roupa…).
// O app olha a sobra do mês e o cartão e diz se é a hora de comprar, se dá no crédito sem apertar, ou até quando esperar.

import { resumoDoMes, type Dados } from "./previstos";
import { limiteUsado } from "./cartoes";
import { temCredito } from "./contas";
import { brl, mesAtual, nomeMes, somarMeses } from "./formato";

export type Veredito = { tipo: "agora" | "credito" | "esperar" | "nao-cabe"; titulo: string; texto: string };

export function avaliarDesejo(valor: number, d: Dados): Veredito {
  const mes = mesAtual();
  const r = resumoDoMes(mes, d);
  // Agora: depois de comprar, ainda sobra uma folga (10% do que entra)
  const folga = Math.max(r.entra * 0.1, 0);
  if (r.sobra - valor >= folga)
    return {
      tipo: "agora",
      titulo: "✅ Bom momento",
      texto: `Depois de comprar, ainda sobram ${brl(r.sobra - valor)} este mês.`,
    };

  // No crédito: parcelas que caibam na metade da sobra dos próximos meses, num cartão com limite
  const cartao = d.cartoes.filter(temCredito).find((c) => c.limite - limiteUsado(c, d) >= valor);
  if (cartao) {
    for (let n = 1; n <= 6; n++) {
      const parcela = valor / n;
      const cabe = Array.from({ length: n }, (_, i) => resumoDoMes(somarMeses(mes, i + 1), d).sobra).every(
        (s) => parcela <= s * 0.5,
      );
      if (cabe)
        return {
          tipo: "credito",
          titulo: "💳 Dá no crédito",
          texto: `${n === 1 ? "À vista" : `Em ${n}x de ${brl(parcela)}`} no ${cartao.nome}, sem apertar os próximos meses.`,
        };
    }
  }

  // Esperar: o primeiro mês em que a sobra paga sem sufoco
  for (let i = 1; i <= 12; i++) {
    const m = somarMeses(mes, i);
    if (resumoDoMes(m, d).sobra - valor >= 0)
      return {
        tipo: "esperar",
        titulo: "⏳ Melhor esperar",
        texto: `Em ${nomeMes(m).toLowerCase()} sobra o suficiente para comprar sem aperto.`,
      };
  }
  return { tipo: "nao-cabe", titulo: "😬 Ainda não cabe", texto: "Guarde um pouquinho por mês ou procure um preço menor." };
}
