"use client";

import { useState } from "react";
import { adicionarNaDespensa, UNIDADES_DURACAO, type UnidadeDuracao } from "@/lib/store";
import { hojeISO, lerValor, soNumeros } from "@/lib/formato";
import type { OpcaoProduto } from "@/lib/mercado";
import Modal from "@/components/Modal";
import { Campo, CampoValor } from "@/components/Campos";
import BuscaProdutos from "@/components/BuscaProdutos";

// "Já tenho em casa": coloca um item na despensa sem registrar compra (não mexe no saldo).
export default function FormNaDespensa({ onFechar }: { onFechar: () => void }) {
  const [produto, setProduto] = useState<OpcaoProduto | null>(null);
  const [desde, setDesde] = useState(hojeISO());
  const [valor, setValor] = useState("");
  const [duracao, setDuracao] = useState("");
  const [unidade, setUnidade] = useState<UnidadeDuracao>("meses");

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!produto) return;
    adicionarNaDespensa({
      nome: produto.nome,
      icone: produto.icone,
      categoria: produto.categoria,
      quantidade: produto.quantidade,
      valor: lerValor(valor) || produto.preco || 0,
      duracao: Number(duracao) > 0 ? Number(duracao) : null,
      unidade,
      ultimaCompra: desde,
      repor: true,
      origemDuracao: Number(duracao) > 0 ? "informada" : undefined,
    });
    onFechar();
  }

  return (
    <Modal titulo="🏠 Já tenho em casa" onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-4">
        {!produto ? (
          <BuscaProdutos autoFocus placeholder="O que você tem em casa?" onEscolher={setProduto} />
        ) : (
          <>
            <p className="flex items-center gap-2 font-semibold">
              <span className="text-xl">{produto.icone}</span> {produto.nome}
              <button type="button" onClick={() => setProduto(null)} className="ml-auto text-xs font-normal text-suave">
                trocar
              </button>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Comprado / aberto em">
                <input type="date" value={desde} max={hojeISO()} onChange={(e) => setDesde(e.target.value)} className="campo" />
              </Campo>
              <Campo rotulo="Quanto costuma custar">
                <CampoValor
                  valor={valor}
                  onChange={setValor}
                  placeholder={produto.preco ? String(produto.preco).replace(".", ",") : "0,00"}
                />
              </Campo>
            </div>
            <Campo rotulo="Dura (opcional)">
              <div className="flex gap-2">
                <input
                  inputMode="numeric"
                  value={duracao}
                  onChange={(e) => setDuracao(soNumeros(e.target.value, false))}
                  placeholder="?"
                  className="campo w-16 text-center"
                />
                <select
                  value={unidade}
                  onChange={(e) => setUnidade(e.target.value as UnidadeDuracao)}
                  className="campo w-auto cursor-pointer"
                >
                  {UNIDADES_DURACAO.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
                </select>
              </div>
            </Campo>
            <p className="text-xs text-suave">Não mexe no saldo: só passa a acompanhar quando vai acabar.</p>
            <button type="submit" className="botao-gradiente w-full rounded-full py-3 font-semibold">
              Pôr na despensa
            </button>
          </>
        )}
      </form>
    </Modal>
  );
}
