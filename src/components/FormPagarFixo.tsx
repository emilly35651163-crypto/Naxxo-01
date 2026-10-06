"use client";

import { useState } from "react";
import { pagarGastoFixo, type GastoFixo } from "@/lib/store";
import { brl, dataDoRecebimento, hojeISO, lerValor, valorParaCampo } from "@/lib/formato";
import { mostrarAviso } from "@/lib/avisos";
import Modal from "./Modal";
import { Campo, CampoValor } from "./Campos";
import EscolhaConta, { lerEscolha } from "./EscolhaConta";

// Confirmar o pagamento de um gasto fixo (com o valor real, para os que variam) e de qual conta saiu.
export default function FormPagarFixo({
  fixo,
  mes,
  vencimento: vencimentoDaVez,
  onFechar,
}: {
  fixo: GastoFixo;
  mes: string;
  vencimento?: string; // qual das vezes está pagando (gastos "a cada X dias" caem mais de uma vez no mês)
  onFechar: () => void;
}) {
  const vencimento = vencimentoDaVez ?? dataDoRecebimento(String(fixo.dia), mes);
  const [valor, setValor] = useState(fixo.varia ? "" : valorParaCampo(fixo.valor));
  // A data é a do pagamento de verdade; o mês da conta (competência) fica guardado à parte
  const [data, setData] = useState(vencimento < hojeISO() ? hojeISO() : vencimento);
  const [conta, setConta] = useState(fixo.contaId ? `debito:${fixo.contaId}` : "");
  const [erro, setErro] = useState("");

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    const numero = lerValor(valor);
    if (!(numero > 0)) return setErro("Digite o valor pago.");
    const escolha = lerEscolha(conta);
    // No crédito, vai para a fatura do cartão; no débito/Pix, sai da conta. A conta é do mês `mes`, mesmo pagando depois.
    if (escolha.credito) pagarGastoFixo(fixo, numero, data, undefined, escolha.id, mes);
    else pagarGastoFixo(fixo, numero, data, escolha.id || undefined, undefined, mes);
    mostrarAviso({ texto: `${fixo.nome} pago ✓` });
    onFechar();
  }

  return (
    <Modal titulo={`${fixo.icone} Pagar ${fixo.nome}`} onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <Campo rotulo={fixo.varia ? `Quanto foi desta vez? (média: ${brl(fixo.valor)})` : "Valor pago"}>
          <CampoValor valor={valor} onChange={setValor} autoFocus />
        </Campo>
        <EscolhaConta valor={conta} onChange={setConta} modo="ambos" rotulo="Como pagou?" />
        <Campo rotulo="Data do pagamento">
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="campo" />
        </Campo>
        {erro && <p className="text-sm text-saida">{erro}</p>}
        <button type="submit" className="botao-gradiente w-full rounded-full py-3 font-semibold">
          Paguei
        </button>
      </form>
    </Modal>
  );
}
