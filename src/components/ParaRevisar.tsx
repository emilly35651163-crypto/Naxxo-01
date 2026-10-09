"use client";

import { useState } from "react";
import {
  atualizarCompra,
  atualizarLancamento,
  categoriasDe,
  iconeDaCategoria,
  useCategoriasPersonalizadas,
  type CompraCartao,
  type Lancamento,
  type Tipo,
} from "@/lib/store";
import { aprender, chaveDaDescricao } from "@/lib/regras";
import { brl, formatarData } from "@/lib/formato";
import type { Dados } from "@/lib/previstos";
import Modal from "./Modal";
import Icone from "./Icone";

type Item = {
  id: string;
  de: "lancamento" | "compra";
  tipo: Tipo;
  nome: string;
  valor: number;
  data: string;
  banco?: string;
  categoria: string;
};

/** Os itens de que o app não teve certeza da categoria (do extrato) */
export function itensParaRevisar(d: Dados): Item[] {
  const ls = d.lancamentos
    .filter((l: Lancamento) => l.revisar && !l.transferenciaId)
    .map((l) => ({
      id: l.id,
      de: "lancamento" as const,
      tipo: l.tipo,
      nome: l.descricao,
      valor: l.valor,
      data: l.data,
      banco: l.descricaoBanco,
      categoria: l.categoria,
    }));
  const cs = d.compras
    .filter((c: CompraCartao) => c.revisar)
    .map((c) => ({
      id: c.id,
      de: "compra" as const,
      tipo: "saida" as Tipo,
      nome: c.descricao,
      valor: c.valorTotal / c.parcelas,
      data: c.data,
      banco: c.descricaoBanco,
      categoria: c.categoria,
    }));
  return [...ls, ...cs].sort((a, b) => b.data.localeCompare(a.data));
}

const NAO_SUGERIR = ["Outros", "Fatura do cartão", "Guardar (metas)", "Transferência"];
const PADRAO: Record<Tipo, string[]> = {
  saida: ["Compras", "Alimentação fora", "Mercado", "Doações e ajuda"],
  entrada: ["Recebido de pessoas", "Trabalho por conta", "Reembolso e estorno", "Outras rendas"],
};

/** 3 sugestões: a aposta do app (se não for "Outros"), as que a pessoa mais usa e as mais comuns */
function sugestoes(item: Item, d: Dados) {
  const usadas = new Map<string, number>();
  d.lancamentos
    .filter((l) => l.tipo === item.tipo && !l.revisar && !NAO_SUGERIR.includes(l.categoria))
    .forEach((l) => usadas.set(l.categoria, (usadas.get(l.categoria) ?? 0) + 1));
  const maisUsadas = [...usadas].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  return [...new Set([item.categoria, ...maisUsadas, ...PADRAO[item.tipo]])].filter((c) => !NAO_SUGERIR.includes(c)).slice(0, 3);
}

// Início → "N para revisar": um item por vez, três categorias em botões grandes. Um toque resolve (e o app aprende).
export default function ParaRevisar({ dados }: { dados: Dados }) {
  const itens = itensParaRevisar(dados);
  const [aberto, setAberto] = useState(false);

  if (itens.length === 0) return null;
  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-amber-300/40 bg-amber-300/10 p-4 text-left text-sm"
      >
        <Icone e="🔍" />
        <span className="flex-1">
          <b>
            {itens.length} {itens.length === 1 ? "item" : "itens"} para revisar
          </b>
          <span className="block text-xs text-suave">Do extrato, sem certeza da categoria. Um toque em cada um resolve.</span>
        </span>
        <span className="text-rosa">›</span>
      </button>
      {aberto && <Revisao itens={itens} dados={dados} onFechar={() => setAberto(false)} />}
    </>
  );
}

function Revisao({ itens, dados, onFechar }: { itens: Item[]; dados: Dados; onFechar: () => void }) {
  const item = itens[0];
  const personalizadas = useCategoriasPersonalizadas();
  const [nome, setNome] = useState(item?.nome ?? "");
  const [sempre, setSempre] = useState(true);
  const [outra, setOutra] = useState(false);
  const [atual, setAtual] = useState(item?.id);
  // Trocou de item (o anterior foi resolvido): campos do novo
  if (item && item.id !== atual) {
    setAtual(item.id);
    setNome(item.nome);
    setSempre(true);
    setOutra(false);
  }

  function escolher(categoria: string) {
    const novoNome = nome.trim() || item.nome;
    const mudar = { categoria, subcategoria: undefined, descricao: novoNome, revisar: undefined };
    if (item.de === "lancamento") atualizarLancamento(item.id, mudar);
    else atualizarCompra(item.id, mudar);
    if (itens.length === 1) onFechar(); // era o último
    if (item.banco)
      aprender({ descricaoBanco: item.banco, tipo: item.tipo, nome: novoNome, categoria }, sempre ? "todos" : "so-este");
  }

  const chave = item.banco ? chaveDaDescricao(item.banco) : "";
  return (
    <Modal titulo={`Para revisar (${itens.length})`} onFechar={onFechar}>
      <div className="space-y-4">
        <div className="rounded-2xl bg-fundo/60 p-4">
          <p className={`font-display text-2xl font-bold tabular-nums ${item.tipo === "entrada" ? "text-entrada" : ""}`}>
            {item.tipo === "entrada" ? "+" : "−"} {brl(item.valor)}
          </p>
          <p className="text-xs text-suave">
            {formatarData(item.data)}
            {item.banco && <> · no banco: “{item.banco}”</>}
          </p>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            aria-label="Nome"
            className="campo mt-3 w-full"
            placeholder="Nome (ex.: Pix para a Ana)"
          />
        </div>

        <p className="text-sm font-semibold">O que foi?</p>
        <div className="grid gap-2">
          {sugestoes(item, dados).map((c) => (
            <button
              key={c}
              onClick={() => escolher(c)}
              className="flex items-center gap-3 rounded-2xl border border-white/10 px-4 py-3.5 text-left font-semibold hover:border-rosa hover:bg-rosa/10"
            >
              <Icone e={iconeDaCategoria(item.tipo, c)} /> {c}
            </button>
          ))}
          {outra ? (
            <select
              autoFocus
              defaultValue=""
              onChange={(e) => e.target.value && escolher(e.target.value)}
              aria-label="Outra categoria"
              className="campo"
            >
              <option value="" disabled>
                Escolha a categoria…
              </option>
              {categoriasDe(item.tipo, personalizadas)
                .filter((c) => c.nome !== "Fatura do cartão")
                .map((c) => (
                  <option key={c.nome} value={c.nome}>
                    {c.nome}
                  </option>
                ))}
            </select>
          ) : (
            <button onClick={() => setOutra(true)} className="py-2 text-sm text-rosa">
              Outra categoria…
            </button>
          )}
        </div>

        {chave && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={sempre} onChange={(e) => setSempre(e.target.checked)} className="mt-1 accent-rosa" />
            <span>
              Fazer isso sempre que aparecer <b>“{chave}”</b>
            </span>
          </label>
        )}
        <button onClick={onFechar} className="w-full text-sm text-suave">
          Depois
        </button>
      </div>
    </Modal>
  );
}
