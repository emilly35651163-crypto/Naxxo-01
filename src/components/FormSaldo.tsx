"use client";

import { useState } from "react";
import { informarSaldo, useLancamentos, type Conta } from "@/lib/store";
import { brl, lerValor, valorParaCampo } from "@/lib/formato";
import { saldoDaConta } from "@/lib/contas";
import Modal from "./Modal";
import { Campo, CampoValor } from "./Campos";

// Conferir/ajustar o saldo de uma conta com o que aparece no app do banco.
export default function FormSaldo({ cartao: conta, onFechar }: { cartao: Conta; onFechar: () => void }) {
  const lancamentos = useLancamentos();
  const calculado = saldoDaConta(conta, lancamentos);
  const [saldo, setSaldo] = useState(valorParaCampo(Math.round(calculado * 100) / 100));

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    informarSaldo(conta.id, lerValor(saldo) || 0);
    onFechar();
  }

  const diferenca = (lerValor(saldo) || 0) - calculado;

  return (
    <Modal titulo={`Saldo · ${conta.nome}`} onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <p className="text-sm text-suave">
          Pelo app, o saldo está em <b className="text-white">{brl(calculado)}</b>. Se no banco estiver diferente, corrija aqui.
        </p>
        <Campo rotulo="Quanto tem na conta agora?">
          <CampoValor valor={saldo} onChange={setSaldo} autoFocus negativo={conta.tipo !== "vale" && conta.tipo !== "dinheiro"} />
        </Campo>
        {Math.abs(diferenca) >= 0.01 && (
          <p className="text-xs text-amber-300">
            Diferença de {brl(Math.abs(diferenca))}: talvez algum gasto ou entrada não foi lançado.
          </p>
        )}
        <button type="submit" className="botao-gradiente w-full rounded-full py-3 font-semibold">
          Salvar saldo
        </button>
      </form>
    </Modal>
  );
}
