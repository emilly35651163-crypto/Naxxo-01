"use client";

import { useState } from "react";
import { CATEGORIAS_MERCADO, useItensMercado, useOpcoesMercado, type CategoriaMercado, semAcento } from "@/lib/store";
import { brl } from "@/lib/formato";
import { filtrarOpcoes, iconeDaCategoriaMercado, todasAsOpcoes, type OpcaoProduto } from "@/lib/mercado";
import { Chip } from "./Campos";

// Buscar um produto (da despensa, criado antes ou sugestão) ou criar um novo.
// Produtos novos viram opção para sempre (quem salva é quem usa: lista ou compra).
export default function BuscaProdutos({
  onEscolher,
  jaEscolhidos = [],
  placeholder = "O que você comprou? (ex.: arroz, shampoo)",
  autoFocus,
}: {
  onEscolher: (opcao: OpcaoProduto) => void;
  jaEscolhidos?: string[];
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const despensa = useItensMercado();
  const criadas = useOpcoesMercado();
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<CategoriaMercado | null>(null);

  const opcoes = filtrarOpcoes(todasAsOpcoes(despensa, criadas), busca, categoria, jaEscolhidos);
  const existeIgual = todasAsOpcoes(despensa, criadas).some((o) => semAcento(o.nome) === semAcento(busca));

  function escolher(o: OpcaoProduto) {
    onEscolher(o);
    setBusca("");
  }

  function criarNovo() {
    const nome = busca.trim();
    if (!nome) return;
    const cat = categoria ?? "outros";
    escolher({
      nome,
      icone: iconeDaCategoriaMercado(cat),
      categoria: cat,
      quantidade: "",
      duracao: null,
      unidade: "meses",
      daDespensa: false,
    });
  }

  return (
    <div className="space-y-3">
      <div className="campo flex items-center gap-2">
        <span className="text-suave">🔍</span>
        <input
          autoFocus={autoFocus}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (busca.trim() && !existeIgual && (opcoes.length === 0 || categoria)) criarNovo();
              else if (opcoes[0]) escolher(opcoes[0]);
              else criarNovo();
            }
          }}
          placeholder={placeholder}
          className="w-full bg-transparent outline-none placeholder:text-white/45"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Chip ativo={categoria === null} onClick={() => setCategoria(null)}>
          Tudo
        </Chip>
        {CATEGORIAS_MERCADO.map((c) => (
          <Chip key={c.id} ativo={categoria === c.id} onClick={() => setCategoria(categoria === c.id ? null : c.id)}>
            {c.icone} {c.nome}
          </Chip>
        ))}
      </div>

      <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
        {busca.trim() && !existeIgual && (
          <button
            type="button"
            onClick={criarNovo}
            className="rounded-full border border-dashed border-rosa/60 px-3 py-1.5 text-sm text-rosa"
          >
            + Adicionar “{busca.trim()}”{categoria ? ` em ${CATEGORIAS_MERCADO.find((c) => c.id === categoria)?.nome}` : ""}
          </button>
        )}
        {opcoes.slice(0, 30).map((o) => (
          <button
            key={o.nome}
            type="button"
            onClick={() => escolher(o)}
            className={`rounded-full border px-3 py-1.5 text-sm hover:border-rosa ${
              o.daDespensa ? "border-roxo/40 bg-roxo/10" : "border-white/10"
            }`}
          >
            + {o.icone} {o.nome}
            {o.preco !== undefined && <span className="ml-1 text-xs text-suave">{brl(o.preco)}</span>}
          </button>
        ))}
      </div>
      {busca.trim() && !existeIgual && !categoria && (
        <p className="text-xs text-suave">
          💡 Escolha a categoria acima antes de adicionar, para o item novo ficar no lugar certo.
        </p>
      )}
    </div>
  );
}
