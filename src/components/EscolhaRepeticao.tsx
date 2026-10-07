"use client";

import { brl, soNumeros } from "@/lib/formato";
import type { Repetir } from "@/lib/repeticao";
import { Chip } from "./Campos";

// "Vai se repetir?": a MESMA escolha em todo lugar (novo lançamento, editar um gasto da conta, editar uma compra do cartão).
// Só desta vez · Toda semana · A cada 15 dias · Todo mês · Todo ano · A cada X dias, + quantas vezes ao todo e se o valor muda.

export type Repeticao = "nao" | "semana" | "quinzena" | "mes" | "ano" | "outro";

export const REPETICOES: { id: Repeticao; nome: string }[] = [
  { id: "nao", nome: "Só desta vez" },
  { id: "semana", nome: "Toda semana" },
  { id: "quinzena", nome: "A cada 15 dias" },
  { id: "mes", nome: "Todo mês" },
  { id: "ano", nome: "Todo ano" },
  { id: "outro", nome: "A cada…" },
];

/** A escolha da tela → como o gasto fixo se repete. null = não repete (ou faltou dizer os dias). */
export function lerRepeticao(repete: Repeticao, aCadaDias: string, vezesTotal: string, varia: boolean): Repetir | null {
  if (repete === "nao") return null;
  const vezes = Number(vezesTotal) || null;
  if (repete === "mes") return { modo: "mes", intervalo: 0, vezes, varia };
  if (repete === "ano") return { modo: "ano", intervalo: 0, vezes, varia };
  const intervalo = repete === "semana" ? 7 : repete === "quinzena" ? 15 : Number(aCadaDias);
  return intervalo > 0 ? { modo: "dias", intervalo, vezes, varia } : null;
}

export default function EscolhaRepeticao({
  titulo,
  repete,
  onRepete,
  aCadaDias,
  onACadaDias,
  vezesTotal,
  onVezesTotal,
  varia,
  onVaria,
  valor,
  entrada = false,
  erroDias = false,
}: {
  titulo: string;
  repete: Repeticao;
  onRepete: (r: Repeticao) => void;
  aCadaDias: string;
  onACadaDias: (v: string) => void;
  vezesTotal: string;
  onVezesTotal: (v: string) => void;
  varia: boolean;
  onVaria: (v: boolean) => void;
  valor: number;
  /** Entrada que se repete vira renda: sem "todo ano", "a cada X dias" e "quantas vezes" */
  entrada?: boolean;
  erroDias?: boolean;
}) {
  const opcoes = entrada ? REPETICOES.filter((r) => r.id !== "ano" && r.id !== "outro") : REPETICOES;
  return (
    <div className="space-y-1.5">
      <span className="text-xs text-suave">{titulo}</span>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((r) => (
          <Chip key={r.id} ativo={repete === r.id} onClick={() => onRepete(r.id)}>
            {entrada && r.id !== "nao" ? `${r.nome} (renda)` : r.nome}
          </Chip>
        ))}
      </div>
      {repete === "outro" && (
        <div className="flex items-center gap-2 pt-1 text-sm">
          a cada
          <input
            inputMode="numeric"
            value={aCadaDias}
            aria-label="A cada quantos dias"
            onChange={(e) => onACadaDias(soNumeros(e.target.value, false).slice(0, 3))}
            className={`campo w-16 px-2 py-1.5 text-center ${erroDias ? "campo-erro" : ""}`}
          />
          dias
        </div>
      )}
      {repete !== "nao" && !entrada && (
        <div className="flex flex-wrap items-center gap-2 pt-1 text-sm">
          Quantas vezes ao todo, contando esta?
          <input
            inputMode="numeric"
            value={vezesTotal}
            onChange={(e) => onVezesTotal(soNumeros(e.target.value, false).slice(0, 3))}
            placeholder="sem fim"
            aria-label="Quantas vezes ao todo"
            className="campo w-24 px-2 py-1.5 text-center"
          />
          {Number(vezesTotal) > 1 && valor > 0 && (
            <span className="text-xs text-suave">= {brl(valor * Number(vezesTotal))} no total</span>
          )}
        </div>
      )}
      {repete !== "nao" && (
        <label className="flex cursor-pointer items-center gap-2 pt-1 text-sm">
          <input type="checkbox" checked={varia} onChange={(e) => onVaria(e.target.checked)} className="size-4 accent-rosa" />O
          valor muda a cada vez
        </label>
      )}
    </div>
  );
}
