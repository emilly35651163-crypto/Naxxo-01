// A regra da renda, simples: se o dia em que ela cai já passou, ela já caiu.
// Então o app registra sozinho (uma vez só) e ela nunca fica "a receber" depois do dia.
// Se já existe uma entrada parecida (ex.: veio do extrato), liga a renda a ela em vez de criar outra.
// O valor fica fácil de corrigir no Início (freela, hora extra, desconto…).

import {
  adicionarLancamentos,
  atualizarLancamento,
  lerCartoes,
  lerFontes,
  lerLancamentos,
  removerLancamento,
  rendaFixa,
  type Lancamento,
} from "./store";
import { diasEntre, hojeISO, mesAtual, somarMeses } from "./formato";
import { rendaNaoRegistrada } from "./renda";
import { marcoDoSaldo } from "./contas";

/**
 * O vale-transporte agora vem dentro do salário. As entradas de VT separadas que já existiam somem;
 * o valor delas vai para o salário do mesmo mês (se o salário já foi registrado), uma vez só.
 */
function juntarValeTransporteNoSalario() {
  const lancamentos = lerLancamentos();
  const vts = lancamentos.filter((l) => l.tipo === "entrada" && l.fonteId && l.beneficio === "transporte");
  if (!vts.length) return;
  // Agrupa por renda e mês: duas entradas de VT no mesmo mês (o problema de contar duas vezes) viram uma só
  const grupos = new Map<string, typeof vts>();
  for (const v of vts) {
    const chave = `${v.fonteId}|${v.data.slice(0, 7)}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), v]);
  }
  for (const [chave, lista] of grupos) {
    const [fonteId, mes] = chave.split("|");
    const salario = lancamentos.find(
      (l) =>
        l.tipo === "entrada" &&
        l.fonteId === fonteId &&
        l.data.startsWith(mes) &&
        !l.beneficio &&
        l.parteRenda !== "adiantamento" &&
        !l.vtJuntado,
    );
    // O VT do mês é um só: o valor da primeira entrada (as repetidas eram o erro)
    if (salario)
      atualizarLancamento(salario.id, { valor: Math.round((salario.valor + lista[0].valor) * 100) / 100, vtJuntado: true });
    lista.forEach((v) => removerLancamento(v.id));
  }
}

export function registrarRendaQueJaCaiu(hoje = hojeISO()) {
  juntarValeTransporteNoSalario();
  const fontes = lerFontes();
  if (!fontes.length) return;
  const lancamentos = lerLancamentos();
  const contas = lerCartoes();
  const novos: Omit<Lancamento, "id">[] = [];
  // Renda sem conta e a pessoa só tem uma conta de dinheiro: cai nela
  const contasDeDinheiro = contas.filter((c) => c.tipo !== "vale");
  const unica = contasDeDinheiro.length === 1 ? contasDeDinheiro[0].id : undefined;
  const usados = new Set<string>();

  // O mês passado também (se o app ficou fechado na virada), mas só depois do cadastro da fonte
  for (const mes of [somarMeses(mesAtual(), -1), mesAtual()])
    for (const f of fontes)
      for (const p of rendaNaoRegistrada(f, mes, lancamentos)) {
        if (p.data >= hoje || !(p.valor > 0)) continue;
        if (mes < mesAtual() && !(f.criadoEm && p.data >= f.criadoEm)) continue;
        const contaId = p.contaId ?? f.contaId ?? (p.dinheiro ? unica : undefined);
        const ligacao = { fonteId: f.id, parteRenda: p.parte, beneficio: p.beneficio?.tipo };

        // Já tem uma entrada parecida (do extrato ou lançada à mão): é ela
        const parecida = lancamentos.find(
          (l) =>
            l.tipo === "entrada" &&
            !l.fonteId &&
            !l.transferenciaId &&
            !usados.has(l.id) &&
            (!contaId || !l.contaId || l.contaId === contaId) &&
            Math.abs(diasEntre(l.data, p.data)) <= 5 &&
            Math.abs(l.valor - p.valor) <= p.valor * 0.4,
        );
        if (parecida) {
          usados.add(parecida.id);
          atualizarLancamento(parecida.id, ligacao);
          continue;
        }

        const conta = contas.find((c) => c.id === contaId);
        novos.push({
          tipo: "entrada",
          valor: p.valor,
          descricao: p.nome,
          categoria: p.parte === "beneficio" ? "Benefícios" : rendaFixa(f.forma) ? "Salário" : "Freelance",
          data: p.data,
          pago: true,
          contaId,
          ...ligacao,
          // Caiu antes de a pessoa informar o saldo da conta: já está dentro dele
          jaNoSaldo: (conta && p.data <= marcoDoSaldo(conta).slice(0, 10)) || undefined,
        });
      }
  if (novos.length) adicionarLancamentos(novos);
}
