"use client";

import { useState } from "react";
import {
  iconeDaCategoria,
  jaAconteceu,
  podeReabrir,
  reabrirLancamento,
  removerLancamento,
  type Conta,
  type Lancamento,
} from "@/lib/store";
import { brl, formatarData } from "@/lib/formato";
import { comDesfazer, mostrarAviso } from "@/lib/avisos";
import FormLancamento from "./FormLancamento";
import Icone from "@/components/Icone";

// Uma linha de lançamento. Tocar abre o formulário para editar (e excluir).
// Transferência aparece como "Conta A → Conta B". Dentro de uma conta (daConta), mostra se saiu ou entrou nela.
// As contas e os lançamentos vêm da tela (assim cada linha não precisa ler tudo de novo).
export default function ItemLancamento({
  lancamento: l,
  daConta,
  contas,
  lancamentos,
}: {
  lancamento: Lancamento;
  daConta?: string;
  contas: Conta[];
  lancamentos: Lancamento[];
}) {
  const [editando, setEditando] = useState(false);
  const entrada = l.tipo === "entrada";
  const conta = contas.find((c) => c.id === l.contaId);
  const transferencia = !!l.transferenciaId;
  const pontas = transferencia ? lancamentos.filter((x) => x.transferenciaId === l.transferenciaId) : [];
  const nomeDe = contas.find((c) => c.id === pontas.find((x) => x.tipo === "saida")?.contaId)?.nome ?? "?";
  const nomePara = contas.find((c) => c.id === pontas.find((x) => x.tipo === "entrada")?.contaId)?.nome ?? "?";
  // Fora de uma conta, a transferência não é entrada nem saída: fica neutra (azul)
  const neutra = transferencia && !daConta;
  // Data no futuro (ex.: compra do mercado programada): ainda não saiu da conta, é previsto
  const previsto = !jaAconteceu(l);

  return (
    <li className="flex items-center gap-3 py-3">
      <button onClick={() => setEditando(true)} className="group flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-superficie-2 text-lg" aria-hidden>
          <Icone e={iconeDaCategoria(l.tipo, l.categoria)} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium group-hover:text-rosa">{l.descricao}</span>
          <span className="block text-xs text-suave">
            {transferencia ? (
              <>
                <Icone e="🔁" /> {nomeDe} → {nomePara} · {formatarData(l.data)}
              </>
            ) : (
              <>
                {previsto && (
                  <span className="text-amber-300">
                    <Icone e="📌" /> previsto ·{" "}
                  </span>
                )}
                {l.categoria}
                {l.subcategoria && ` › ${l.subcategoria}`} · {formatarData(l.data)} ·{" "}
                {conta ? conta.nome : contas.length > 0 ? <span className="text-amber-300">sem conta</span> : null}
              </>
            )}
          </span>
        </span>
      </button>

      <div className="shrink-0 text-right">
        <p
          className={`font-display font-semibold tabular-nums ${neutra ? "text-azul" : previsto ? "text-amber-300" : entrada ? "text-entrada" : "text-saida"}`}
        >
          {neutra ? "" : entrada ? "+ " : "− "}
          {brl(l.valor)}
        </p>
        <div className="mt-0.5 flex justify-end gap-3 text-xs">
          {/* Volta para "a pagar"/"a receber" (o que mexeu numa meta ou fatura só sai excluindo, que desfaz tudo) */}
          {jaAconteceu(l) && podeReabrir(l) && (
            <button
              onClick={() => {
                reabrirLancamento(l.id);
                mostrarAviso({ texto: `“${l.descricao}” voltou para ${entrada ? "a receber" : "a pagar"}` });
              }}
              className="text-suave hover:text-white"
              title={entrada ? "Voltar para a receber" : "Voltar para a pagar"}
            >
              {entrada ? "não recebi" : "não paguei"}
            </button>
          )}
          <button onClick={() => setEditando(true)} className="text-suave hover:text-white">
            editar
          </button>
          {/* Excluir: como se nunca tivesse acontecido (o dinheiro volta para a conta) */}
          <button
            onClick={() => comDesfazer(`“${l.descricao}” excluído`, () => removerLancamento(l.id))}
            className="text-suave hover:text-saida"
          >
            excluir
          </button>
        </div>
      </div>

      {editando && <FormLancamento lancamento={l} onFechar={() => setEditando(false)} />}
    </li>
  );
}
