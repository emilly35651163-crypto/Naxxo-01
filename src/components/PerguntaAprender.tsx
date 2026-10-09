"use client";

import { useState } from "react";
import { aprender, chaveDaDescricao, type Alcance } from "@/lib/regras";
import { mostrarAviso } from "@/lib/avisos";
import type { Tipo } from "@/lib/store";

export type ItemAprender = { descricaoBanco: string; tipo: Tipo; nome: string; categoria: string; subcategoria?: string };

const OPCOES: { id: Alcance; titulo: string; texto: string }[] = [
  { id: "todos", titulo: "Todos iguais", texto: "Os que já estão no app e os próximos que vierem no extrato" },
  { id: "proximos", titulo: "Só os próximos", texto: "Os que já estão ficam como estão" },
  { id: "so-este", titulo: "Só este", texto: "Não muda mais nenhum" },
];

// Depois de mudar o nome ou a categoria de algo que veio do extrato: o app aprende? (docs/NOVO-SISTEMA.md, 5.2)
export default function PerguntaAprender({ item, onFim }: { item: ItemAprender; onFim: () => void }) {
  const [alcance, setAlcance] = useState<Alcance>("todos");

  function confirmar() {
    const mudados = aprender(item, alcance);
    if (alcance !== "so-este")
      mostrarAviso({
        texto:
          alcance === "todos" && mudados > 1
            ? `Aprendi ✓ Mudei ${mudados} iguais e os próximos já vêm assim`
            : "Aprendi ✓ Os próximos já vêm assim",
      });
    onFim();
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="font-display text-lg font-bold">Fazer isso sempre?</p>
        <p className="mt-1 text-sm text-suave">
          Sempre que aparecer <b className="text-texto">“{chaveDaDescricao(item.descricaoBanco) || item.descricaoBanco}”</b> no
          extrato, ele vira <b className="text-texto">{item.nome}</b> em{" "}
          <b className="text-texto">
            {item.categoria}
            {item.subcategoria ? ` › ${item.subcategoria}` : ""}
          </b>
          .
        </p>
      </div>
      <div className="space-y-2" role="radiogroup" aria-label="Para quais">
        {OPCOES.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={alcance === o.id}
            onClick={() => setAlcance(o.id)}
            className={`block w-full rounded-2xl border px-4 py-3 text-left ${alcance === o.id ? "border-rosa bg-rosa/10" : "border-white/10"}`}
          >
            <span className="block font-semibold">{o.titulo}</span>
            <span className="block text-xs text-suave">{o.texto}</span>
          </button>
        ))}
      </div>
      <button type="button" onClick={confirmar} className="botao-gradiente w-full rounded-full py-3 font-semibold">
        Pronto
      </button>
    </div>
  );
}
