"use client";

import { useState } from "react";
import { pagarFatura, type Cartao } from "@/lib/store";
import { brl, hojeISO, lerValor, nomeMes, valorParaCampo } from "@/lib/formato";
import { mostrarAviso } from "@/lib/avisos";
import Modal from "./Modal";
import { Campo, CampoValor, Chip } from "./Campos";
import EscolhaConta, { lerEscolha } from "./EscolhaConta";

// Pagar uma fatura (inteira ou só uma parte), escolhendo de qual conta sai o dinheiro.
export default function FormPagarFatura({
  cartao,
  fatura,
  restante,
  onFechar,
}: {
  cartao: Cartao;
  fatura: string;
  restante: number;
  onFechar: () => void;
}) {
  const [valor, setValor] = useState(valorParaCampo(restante));
  const [data, setData] = useState(hojeISO());
  // Normalmente sai da conta do próprio banco do cartão
  const [conta, setConta] = useState(`debito:${cartao.id}`);
  const [erro, setErro] = useState("");
  const numero = lerValor(valor);

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!(numero > 0)) return setErro("Digite o valor pago.");
    // Pagar mais do que falta não abate a próxima fatura: avisa antes
    if (numero > restante + 0.009) return setErro(`Faltam só ${brl(restante)} nesta fatura. Confira o valor.`);
    pagarFatura(cartao, fatura, numero, data, lerEscolha(conta).id || cartao.id);
    mostrarAviso({ texto: "Fatura paga ✓" });
    onFechar();
  }

  return (
    <Modal titulo={`💳 Fatura ${cartao.nome} · ${nomeMes(fatura)}`} onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <p className="text-sm text-suave">
          Falta pagar <b className="text-white">{brl(restante)}</b> desta fatura.
        </p>
        <div className="flex gap-2">
          <Chip ativo={Math.abs(numero - restante) < 0.005} onClick={() => setValor(valorParaCampo(restante))}>
            Valor total
          </Chip>
          <Chip ativo={numero > 0 && numero < restante - 0.005} onClick={() => setValor("")}>
            Outro valor
          </Chip>
        </div>
        <Campo rotulo="Valor pago">
          <CampoValor valor={valor} onChange={setValor} autoFocus />
        </Campo>
        {numero > 0 && numero < restante - 0.005 && (
          <p className="text-xs text-amber-300">
            ⚠️ Pagando menos que o total, o resto ({brl(restante - numero)}) costuma ir para o rotativo, com juros altos.
          </p>
        )}
        <EscolhaConta valor={conta} onChange={setConta} rotulo="Pagou com o dinheiro de qual conta?" />
        <Campo rotulo="Data do pagamento">
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="campo" />
        </Campo>
        <p className="text-xs text-suave">Sai do saldo da conta escolhida e libera o limite do cartão.</p>
        {numero > restante + 0.009 && <p className="text-xs text-saida">⚠️ Valor maior do que falta pagar ({brl(restante)}).</p>}
        {erro && <p className="text-sm text-saida">{erro}</p>}
        <button type="submit" className="botao-gradiente w-full rounded-full py-3 font-semibold">
          Paguei
        </button>
      </form>
    </Modal>
  );
}
