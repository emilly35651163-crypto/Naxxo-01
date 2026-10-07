"use client";

import { useState } from "react";
import {
  adicionarLancamento,
  atualizarLancamento,
  guardarNaMeta,
  lancamentoParaCredito,
  pagarFatura,
  pagarGastoFixo,
  pagarParcela,
  rendaFixa,
  useCartoes,
} from "@/lib/store";
import type { Previsto } from "@/lib/previstos";
import { brl, formatarData, hojeISO, lerValor, nomeMes, valorParaCampo } from "@/lib/formato";
import { mostrarAviso } from "@/lib/avisos";
import Modal from "./Modal";
import { Campo, CampoValor } from "./Campos";
import EscolhaConta, { lerEscolha } from "./EscolhaConta";

/** A conta que já vem marcada: a do próprio lançamento, renda (ou vale), gasto fixo, meta ou cartão. */
function contaSugerida(p: Previsto) {
  const id =
    p.lancamento?.contaId ??
    p.parte?.contaId ??
    p.fonte?.contaId ??
    (p.item?.tipo === "fixo" ? p.item.fixo.contaId : undefined) ??
    (p.item?.tipo === "fatura" ? p.item.cartao.id : undefined) ??
    p.meta?.contaId;
  return id ? `debito:${id}` : "";
}

/** Confirma um previsto (pago/recebido) no débito/Pix, com o valor, a data e a conta reais. Também usado ao importar extrato. */
export function confirmarPrevisto(p: Previsto, numero: number, data: string, contaId?: string) {
  const competencia = p.item?.tipo === "fixo" ? p.item.competencia : undefined;
  if (p.origem === "lançamento" && p.lancamento) {
    atualizarLancamento(p.lancamento.id, { pago: true, valor: numero, data, contaId });
  } else if ((p.origem === "renda" || p.origem === "benefício") && p.fonte) {
    const parte = p.parte;
    adicionarLancamento({
      tipo: "entrada",
      valor: numero,
      descricao: p.nome,
      categoria: p.origem === "benefício" ? "Benefícios" : rendaFixa(p.fonte.forma) ? "Salário" : "Freelance",
      data,
      pago: true,
      fonteId: p.fonte.id,
      contaId,
      parteRenda: parte?.parte,
      beneficio: parte?.beneficio?.tipo,
    });
  } else if (p.item?.tipo === "fixo") {
    pagarGastoFixo(p.item.fixo, numero, data, contaId, undefined, competencia);
  } else if (p.item?.tipo === "fatura") {
    pagarFatura(p.item.cartao, p.item.fatura, numero, data, contaId);
  } else if (p.origem === "parcela" && p.meta) {
    pagarParcela(p.meta.id, contaId, numero);
  } else if (p.origem === "guardar" && p.meta) {
    guardarNaMeta(p.meta.id, numero, contaId, data.slice(0, 7) === p.data.slice(0, 7) ? data : p.data);
  }
}

// "Pago" / "Recebi": confirma um previsto, com o valor real e a conta de onde saiu (ou onde entrou).
export default function ConfirmarPrevisto({ previsto: p, onFechar }: { previsto: Previsto; onFechar: () => void }) {
  const contas = useCartoes();
  const entrada = p.tipo === "entrada";
  const [valor, setValor] = useState(valorParaCampo(Math.round(p.valor * 100) / 100));
  // A data é a real (hoje); o mês da conta (competência) é guardado à parte para fixos atrasados
  const [data, setData] = useState(p.data > hojeISO() || p.data < hojeISO() ? hojeISO() : p.data);
  const [conta, setConta] = useState(contaSugerida(p));
  const [erro, setErro] = useState("");
  // Um gasto (lançamento previsto ou fixo) pode ser pago no débito/Pix ou no crédito
  const podeCredito = !entrada && (p.item?.tipo === "fixo" || (p.origem === "lançamento" && !!p.lancamento));
  const escolha = lerEscolha(conta);
  const noCredito = podeCredito && escolha.credito;
  const competencia = p.item?.tipo === "fixo" ? p.item.competencia : undefined;
  const ehVale = p.dinheiro === false;

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    const numero = lerValor(valor);
    const contaId = escolha.id || undefined;
    if (!(numero > 0)) return setErro("Digite o valor.");
    // Fatura: não dá para pagar mais do que falta
    if (p.item?.tipo === "fatura" && numero > p.valor + 0.009)
      return setErro(`Faltam só ${brl(p.valor)} nesta fatura. Confira o valor (pagar a mais não abate a próxima).`);
    // Guardar sem conta: o dinheiro "apareceria" na meta sem sair de lugar nenhum
    if (p.origem === "guardar" && contas.length > 0 && !contaId) return setErro("De qual conta saiu o dinheiro guardado?");
    if (!ehVale && contas.length > 0 && !contaId) return setErro(entrada ? "Em qual conta entrou?" : "De qual conta saiu?");

    // Pago no crédito: vai para a fatura do cartão
    if (noCredito) {
      if (p.item?.tipo === "fixo") pagarGastoFixo(p.item.fixo, numero, data, undefined, escolha.id, competencia);
      else if (p.lancamento) lancamentoParaCredito(p.lancamento.id, escolha.id, 1, { valor: numero, data });
      mostrarAviso({ texto: "💳 Foi para a fatura do cartão" });
      return onFechar();
    }

    confirmarPrevisto(p, numero, data, contaId);
    mostrarAviso({ texto: entrada ? "Recebido ✓" : p.origem === "guardar" ? "Guardado 🎯" : "Pago ✓" });
    onFechar();
  }

  return (
    <Modal titulo={`${p.icone} ${p.nome}`} onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <p className="text-sm text-suave">
          Previsto para {formatarData(p.data)}: <b className="text-white">{brl(p.valor)}</b>
          {competencia && competencia < hojeISO().slice(0, 7) && (
            <span className="block text-xs text-saida">
              Conta de {nomeMes(competencia).toLowerCase()} (atrasada). A data do pagamento fica a de hoje.
            </span>
          )}
        </p>
        {ehVale && (
          <p className="rounded-2xl bg-roxo/10 px-4 py-3 text-xs text-suave">
            🍽️ Vale (VR/VA): cai na conta do vale e não conta como dinheiro livre na sobra do mês.
          </p>
        )}
        <Campo rotulo={entrada ? "Quanto entrou?" : p.origem === "guardar" ? "Quanto guardou?" : "Quanto pagou?"}>
          <CampoValor valor={valor} onChange={setValor} autoFocus />
        </Campo>
        <EscolhaConta
          valor={conta}
          onChange={setConta}
          modo={podeCredito ? "ambos" : "debito"}
          rotulo={
            entrada
              ? "Entrou em qual conta?"
              : p.origem === "guardar"
                ? "Saiu de qual conta?"
                : podeCredito
                  ? "Como pagou?"
                  : "Pagou com qual conta?"
          }
        />
        <Campo rotulo="Data">
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="campo" />
        </Campo>
        {noCredito && <p className="rounded-2xl bg-roxo/10 px-4 py-3 text-xs text-suave">💳 Vai para a fatura do cartão.</p>}
        {erro && (
          <p role="alert" className="text-sm text-saida">
            {erro}
          </p>
        )}
        <button type="submit" className="botao-gradiente w-full rounded-full py-3 font-semibold">
          {entrada ? "Recebi" : p.origem === "guardar" ? "Guardei" : "Pago"}
        </button>
      </form>
    </Modal>
  );
}
