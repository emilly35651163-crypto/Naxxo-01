"use client";

import { useState } from "react";
import { adicionarAoCarrinho } from "@/lib/store";
import { itensDoCarrinho, lojaDoTexto, LOJAS_APP } from "@/lib/notinha";
import { lerTextoDosPrints } from "@/lib/ocr";
import { lerComIA, type CarrinhoIA } from "@/lib/lerComIA";
import { brl, lerValor, valorParaCampo } from "@/lib/formato";
import { mostrarAviso } from "@/lib/avisos";
import { Chip } from "@/components/Campos";
import Modal from "@/components/Modal";
import Icone from "@/components/Icone";

type Linha = { nome: string; valor: string; quantidade: number; marcado: boolean };

// Apps → "📸 Ler print do carrinho": print da tela do carrinho (Shein, Mercado Livre…) → produtos e preços →
// a pessoa confere → vão para o carrinho da loja certa.
export default function LerPrintCarrinho() {
  const [lendo, setLendo] = useState("");
  const [erro, setErro] = useState("");
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [loja, setLoja] = useState("");

  async function ler(arquivos: FileList | null) {
    if (!arquivos?.length) return;
    setErro("");
    try {
      // A IA lê muito melhor (logado e com a chave); sem ela, o leitor do celular
      const ia = await lerComIA<CarrinhoIA>("carrinho", [...arquivos], setLendo);
      const texto = ia
        ? (ia.loja ?? "")
        : (await lerTextoDosPrints([...arquivos], setLendo, (t) => /\d+,\d{2}/.test(t))).join("\n");
      const itens = ia ? ia.itens.map((i) => ({ ...i, quantidade: Math.max(1, i.quantidade || 1) })) : itensDoCarrinho(texto);
      if (itens.length === 0) {
        setErro("Não achei produtos com preço nesse print. Tente um print só da lista do carrinho (sem o resumo do pedido).");
        return;
      }
      setLoja((ia ? (lojaDoTexto(ia.loja ?? "") ?? ia.loja) : lojaDoTexto(texto)) ?? "");
      setLinhas(itens.map((i) => ({ nome: i.nome, valor: valorParaCampo(i.valor), quantidade: i.quantidade, marcado: true })));
    } catch (e) {
      setErro(e instanceof Error && e.message.startsWith("A leitura") ? e.message : "Não consegui ler o print. Tente de novo.");
    } finally {
      setLendo("");
    }
  }

  const marcadas = linhas?.filter((l) => l.marcado && lerValor(l.valor) > 0 && l.nome.trim()) ?? [];
  const total = marcadas.reduce((t, l) => t + lerValor(l.valor) * l.quantidade, 0);

  function salvar() {
    if (!loja.trim() || marcadas.length === 0) return;
    for (const l of marcadas)
      adicionarAoCarrinho({ nome: l.nome.trim(), loja: loja.trim(), valor: lerValor(l.valor), quantidade: l.quantidade });
    mostrarAviso({ texto: `🛍️ ${marcadas.length} itens no carrinho da ${loja}` });
    setLinhas(null);
  }

  function mudar(i: number, m: Partial<Linha>) {
    setLinhas((atual) => atual && atual.map((l, j) => (j === i ? { ...l, ...m } : l)));
  }

  return (
    <>
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-rosa/50 px-4 py-3 text-sm text-rosa hover:bg-rosa/5">
        <Icone e="📸" /> {lendo || "Ler print do carrinho do app"}
        <input
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          disabled={!!lendo}
          onChange={(e) => {
            void ler(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {erro && <p className="text-sm text-saida">{erro}</p>}

      {linhas && (
        <Modal titulo="Print do carrinho" onFechar={() => setLinhas(null)}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <span className="text-xs text-suave">De qual loja?</span>
              <div className="flex flex-wrap gap-2">
                {LOJAS_APP.map(([nome]) => (
                  <Chip key={nome} ativo={loja === nome} onClick={() => setLoja(nome)}>
                    {nome}
                  </Chip>
                ))}
              </div>
              <input
                value={loja}
                onChange={(e) => setLoja(e.target.value)}
                placeholder="ou escreva a loja"
                aria-label="Loja"
                className="campo w-full"
              />
            </div>
            <p className="text-xs text-suave">
              Confira (o leitor às vezes erra uma letra ou um número). O preço é o de uma unidade.
            </p>
            <ul className="max-h-[45vh] divide-y divide-white/5 overflow-y-auto">
              {linhas.map((l, i) => (
                <li key={i} className={`flex items-center gap-2 py-2 ${l.marcado ? "" : "opacity-50"}`}>
                  <input
                    type="checkbox"
                    checked={l.marcado}
                    onChange={(e) => mudar(i, { marcado: e.target.checked })}
                    className="size-4 shrink-0 accent-rosa"
                    aria-label={`Incluir ${l.nome}`}
                  />
                  <span className="min-w-0 flex-1">
                    <input
                      value={l.nome}
                      onChange={(e) => mudar(i, { nome: e.target.value })}
                      aria-label="Produto"
                      className="w-full bg-transparent text-sm font-medium outline-none"
                    />
                    <span className="flex items-center gap-1 text-xs text-suave">
                      Qtd.
                      <button
                        type="button"
                        onClick={() => mudar(i, { quantidade: Math.max(1, l.quantidade - 1) })}
                        className="size-6 rounded-full border border-white/10"
                      >
                        −
                      </button>
                      <span className="w-4 text-center tabular-nums">{l.quantidade}</span>
                      <button
                        type="button"
                        onClick={() => mudar(i, { quantidade: l.quantidade + 1 })}
                        className="size-6 rounded-full border border-white/10"
                      >
                        +
                      </button>
                    </span>
                  </span>
                  <input
                    inputMode="decimal"
                    value={l.valor}
                    onChange={(e) => mudar(i, { valor: e.target.value })}
                    aria-label={`Preço de ${l.nome}`}
                    className="campo w-24 shrink-0 px-2 py-1 text-right text-sm tabular-nums"
                  />
                </li>
              ))}
            </ul>
            <button
              onClick={salvar}
              disabled={!loja.trim() || marcadas.length === 0}
              className="botao-gradiente w-full rounded-full py-3 font-semibold disabled:opacity-40"
            >
              {loja.trim() ? `Pôr ${marcadas.length} no carrinho da ${loja} · ${brl(total)}` : "Escolha a loja"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
