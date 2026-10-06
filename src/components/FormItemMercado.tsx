"use client";

import { useState } from "react";
import {
  atualizarItemMercado,
  CATEGORIAS_MERCADO,
  removerItemMercado,
  UNIDADES_DURACAO,
  type CategoriaMercado,
  type ItemMercado,
  type UnidadeDuracao,
} from "@/lib/store";
import { lerValor, soNumeros } from "@/lib/formato";
import Modal from "./Modal";
import { Campo, CampoValor, Chip } from "./Campos";
import { comDesfazer } from "@/lib/avisos";

// Editar um item da despensa (nome, preço, quanto dura, quando foi comprado).
export default function FormItemMercado({ item, onFechar }: { item: ItemMercado; onFechar: () => void }) {
  const [nome, setNome] = useState(item.nome);
  const [categoria, setCategoria] = useState<CategoriaMercado>(item.categoria);
  const [quantidade, setQuantidade] = useState(item.quantidade);
  const [valor, setValor] = useState(String(item.valor).replace(".", ","));
  const [duracao, setDuracao] = useState(item.duracao ? String(item.duracao) : "");
  const [unidade, setUnidade] = useState<UnidadeDuracao>(item.unidade);
  const [ultimaCompra, setUltimaCompra] = useState(item.ultimaCompra);
  const [repor, setRepor] = useState(item.repor);
  const [erro, setErro] = useState("");

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return setErro("Dê um nome para o item.");
    if (!(lerValor(valor) > 0)) return setErro("Digite o valor.");
    atualizarItemMercado(item.id, {
      nome: nome.trim(),
      categoria,
      quantidade: quantidade.trim(),
      valor: lerValor(valor),
      duracao: Number(duracao) > 0 ? Number(duracao) : null,
      unidade,
      // Editou à mão: a duração passa a ser "informada" (confirmada pela pessoa)
      origemDuracao: Number(duracao) > 0 ? "informada" : undefined,
      ultimaCompra,
      repor,
    });
    onFechar();
  }

  return (
    <Modal titulo={`${item.icone} ${item.nome}`} onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <Campo rotulo="Nome">
          <input value={nome} onChange={(e) => setNome(e.target.value)} className="campo" />
        </Campo>

        <div className="flex flex-wrap gap-2">
          {CATEGORIAS_MERCADO.map((c) => (
            <Chip key={c.id} ativo={categoria === c.id} onClick={() => setCategoria(c.id)}>
              {c.icone} {c.nome}
            </Chip>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Quantidade">
            <input value={quantidade} onChange={(e) => setQuantidade(e.target.value)} placeholder="Ex.: 2 kg" className="campo" />
          </Campo>
          <Campo rotulo="Valor (última compra)">
            <CampoValor valor={valor} onChange={setValor} />
          </Campo>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Dura (vazio = ainda não sei)">
            <div className="flex gap-2">
              <input
                inputMode="numeric"
                value={duracao}
                onChange={(e) => setDuracao(soNumeros(e.target.value, false))}
                placeholder="?"
                className="campo w-16 text-center placeholder:text-white/45"
              />
              <select
                value={unidade}
                onChange={(e) => setUnidade(e.target.value as UnidadeDuracao)}
                className="campo min-w-0 flex-1 cursor-pointer"
              >
                {UNIDADES_DURACAO.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
            </div>
          </Campo>
          <Campo rotulo="Comprado em">
            <input type="date" value={ultimaCompra} onChange={(e) => setUltimaCompra(e.target.value)} className="campo" />
          </Campo>
        </div>

        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" checked={repor} onChange={(e) => setRepor(e.target.checked)} className="size-5 accent-rosa" />
          Repor quando acabar (entra na previsão de gastos)
        </label>

        {erro && <p className="text-sm text-saida">{erro}</p>}

        <button type="submit" className="botao-gradiente w-full rounded-full py-3 font-semibold">
          Salvar
        </button>
        <button
          type="button"
          onClick={() => {
            comDesfazer(`“${item.nome}” saiu da despensa`, () => removerItemMercado(item.id));
            onFechar();
          }}
          className="w-full py-1 text-sm text-suave hover:text-saida"
        >
          Tirar da despensa
        </button>
      </form>
    </Modal>
  );
}
