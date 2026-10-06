// Projeção: "se tudo acontecer como programado, como vão estar as coisas em tal dia?"
// Usa os mesmos previstos dos Lançamentos (rendas, fixos, faturas, parcelas, mercado, metas…).

import { hojeISO, mesAtual, somarMeses } from "./formato";
import { limiteUsado } from "./cartoes";
import { calcularMeta } from "./metas";
import { saldoTotal } from "./contas";
import { previstosDoMes, type Dados, type Previsto } from "./previstos";

export type Evento = Previsto & { atrasado?: boolean };
export type DadosProjecao = Dados;

/** Tudo o que deve entrar ou sair de hoje até `ate`, em ordem de data (o que está atrasado conta como hoje). */
export function eventosAte(ate: string, d: Dados): Evento[] {
  const hoje = hojeISO();
  const eventos: Evento[] = [];
  for (let mes = mesAtual(); mes <= ate.slice(0, 7); mes = somarMeses(mes, 1)) {
    for (const p of previstosDoMes(mes, d)) {
      if (p.data > ate || p.dinheiro === false) continue;
      const atrasado = p.data < hoje;
      eventos.push({ ...p, data: atrasado ? hoje : p.data, atrasado });
    }
  }
  return eventos.sort((a, b) => a.data.localeCompare(b.data) || (a.tipo === "entrada" ? -1 : 1));
}

/** Como vão estar as contas no fim do dia `data`, se tudo acontecer como programado. */
export function projetarDia(data: string, d: Dados) {
  const inicial = saldoTotal(d.cartoes, d.lancamentos);
  const eventos = eventosAte(data, d);

  // Saldo dia a dia, para achar o ponto mais baixo do caminho
  let saldo = inicial;
  let menor = { valor: inicial, data: hojeISO() };
  for (const e of eventos) {
    saldo += e.tipo === "entrada" ? e.valor : -e.valor;
    if (saldo < menor.valor) menor = { valor: saldo, data: e.data };
  }

  const entra = eventos.filter((e) => e.tipo === "entrada").reduce((t, e) => t + e.valor, 0);
  const sai = eventos.filter((e) => e.tipo === "saida").reduce((t, e) => t + e.valor, 0);
  const guardado = eventos.filter((e) => e.origem === "guardar").reduce((t, e) => t + e.valor, 0);

  // Dívidas: o que ainda vai estar devendo nos cartões e nas parcelas a quitar
  const usadoNosCartoes = d.cartoes.reduce((t, c) => t + limiteUsado(c, d), 0);
  const faturasPagasAte = eventos.filter((e) => e.origem === "fatura").reduce((t, e) => t + e.valor, 0);
  const faltaQuitar = d.metas.filter((m) => m.tipo === "quitar").reduce((t, m) => t + calcularMeta(m).falta, 0);
  const parcelasPagasAte = eventos.filter((e) => e.origem === "parcela").reduce((t, e) => t + e.valor, 0);

  return {
    saldoInicial: inicial,
    saldoFinal: saldo,
    entra,
    sai,
    guardado,
    eventos,
    menor,
    devendoCartoes: Math.max(usadoNosCartoes - faturasPagasAte, 0),
    devendoParcelas: Math.max(faltaQuitar - parcelasPagasAte, 0),
  };
}
