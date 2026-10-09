"use client";

import {
  adicionarCartao,
  agoraLocal,
  atualizarLancamento,
  lerCartoes,
  removerLancamento,
  type Cartao,
  type Lancamento,
} from "@/lib/store";
import { brl, diasEntre, formatarData, hojeISO, somarDias } from "@/lib/formato";
import { comDesfazer, mostrarAviso } from "@/lib/avisos";
import type { Dados } from "@/lib/previstos";
import Icone from "./Icone";

/**
 * Lançado à mão numa conta de banco que tem extrato (docs/NOVO-SISTEMA.md, seção 7):
 * - "aguardando": o extrato ainda não chegou até essa data;
 * - "nao-achou": o extrato já cobre a data (3 dias depois) e passaram 10 dias, e ele não veio.
 */
export function situacaoNoBanco(l: Lancamento, contas: Cartao[], ultimaDoExtrato: Map<string, string>) {
  if (l.extratoId || l.importado || l.transferenciaId || l.semBanco || !l.pago || !l.contaId) return null;
  const conta = contas.find((c) => c.id === l.contaId);
  const ultima = ultimaDoExtrato.get(l.contaId);
  if (!conta || (conta.tipo ?? "banco") !== "banco" || !ultima) return null;
  if (ultima >= somarDias(l.data, 3) && diasEntre(l.data, hojeISO()) >= 10) return "nao-achou" as const;
  return "aguardando" as const;
}

/** A última data que veio no extrato de cada conta */
export function ultimasDoExtrato(lancamentos: Lancamento[]) {
  const m = new Map<string, string>();
  for (const l of lancamentos) if (l.importado && l.contaId && l.data > (m.get(l.contaId) ?? "")) m.set(l.contaId, l.data);
  return m;
}

// Início: o que foi lançado à mão e não apareceu no extrato do banco. Foi em dinheiro? Apagar? Manter?
export default function NaoEncontrados({ dados }: { dados: Dados }) {
  const ultimas = ultimasDoExtrato(dados.lancamentos);
  const itens = dados.lancamentos.filter((l) => situacaoNoBanco(l, dados.cartoes, ultimas) === "nao-achou");
  if (itens.length === 0) return null;

  function foiEmDinheiro(l: Lancamento) {
    comDesfazer(`${l.descricao} foi para o dinheiro`, () => {
      if (!lerCartoes().some((c) => c.tipo === "dinheiro")) {
        adicionarCartao({
          nome: "Dinheiro",
          cor: "",
          tipo: "dinheiro",
          temCredito: false,
          limite: 0,
          diaFechamento: 0,
          diaVencimento: 0,
          criadoEm: hojeISO(),
          saldo: 0,
          saldoAtualizadoEm: agoraLocal(),
        });
        mostrarAviso({ texto: "Criei a conta Dinheiro (informe quanto tem na carteira em Contas)" });
      }
      const carteira = lerCartoes().find((c) => c.tipo === "dinheiro");
      atualizarLancamento(l.id, { contaId: carteira?.id, semBanco: true });
    });
  }

  const nomeDaConta = (id?: string) => dados.cartoes.find((c) => c.id === id)?.nome ?? "banco";
  return (
    <section className="cartao space-y-3 border-amber-300/40 p-4">
      <p className="text-sm">
        <Icone e="🔍" /> <b>Não encontrei no extrato</b>
        <span className="block text-xs text-suave">Você lançou à mão, mas o banco não mostrou. O que foi?</span>
      </p>
      <ul className="divide-y divide-white/5">
        {itens.map((l) => (
          <li key={l.id} className="space-y-2 py-2.5">
            <p className="text-sm">
              <b>{l.descricao}</b> · {brl(l.valor)} · {formatarData(l.data)}{" "}
              <span className="text-xs text-suave">(no {nomeDaConta(l.contaId)})</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => foiEmDinheiro(l)}
                className="rounded-full bg-entrada/15 px-3 py-1.5 text-xs font-semibold text-entrada"
              >
                Foi em dinheiro
              </button>
              <button
                onClick={() => comDesfazer(`${l.descricao} apagado`, () => removerLancamento(l.id))}
                className="rounded-full px-3 py-1.5 text-xs text-suave hover:text-saida"
              >
                Apagar
              </button>
              <button
                onClick={() => atualizarLancamento(l.id, { semBanco: true })}
                className="rounded-full px-3 py-1.5 text-xs text-suave"
              >
                Manter
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
