"use client";

import { dataDoRecebimento, formatarData, mesAtual } from "@/lib/formato";

type Modo = "dia" | "util" | "ultimo";

/** "20" → dia 20 · "5u" → 5º dia útil · "ultimo-util" → último dia útil */
function ler(valor: string): { numero: string; modo: Modo } {
  if (valor === "ultimo-util") return { numero: "", modo: "ultimo" };
  if (valor.endsWith("u")) return { numero: valor.slice(0, -1), modo: "util" };
  return { numero: valor, modo: "dia" };
}

// Que dia o dinheiro cai: o número e, do lado, se é dia do mês ou dia útil (que pula fim de semana e feriado).
export default function CampoDiaRecebimento({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  const { numero, modo } = ler(valor);
  const montar = (n: string, m: Modo) => (m === "ultimo" ? "ultimo-util" : n ? (m === "util" ? `${n}u` : n) : "");
  const maximo = modo === "util" ? 23 : 31;

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        {modo !== "ultimo" && (
          <select
            value={numero}
            onChange={(e) => onChange(montar(e.target.value, modo))}
            aria-label="Dia"
            className="campo w-24 cursor-pointer"
          >
            <option value="">Dia</option>
            {Array.from({ length: maximo }, (_, i) => String(i + 1)).map((n) => (
              <option key={n} value={n}>
                {modo === "util" ? `${n}º` : n}
              </option>
            ))}
          </select>
        )}
        <div
          className="grid flex-1 grid-cols-3 gap-1 rounded-2xl bg-fundo p-1 text-sm"
          role="radiogroup"
          aria-label="Tipo de dia"
        >
          {(
            [
              ["dia", "Dia do mês"],
              ["util", "Dia útil"],
              ["ultimo", "Último útil"],
            ] as const
          ).map(([m, nome]) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={modo === m}
              onClick={() =>
                onChange(montar(m === "util" && Number(numero) > 23 ? "5" : numero || (m === "ultimo" ? "" : "1"), m))
              }
              className={`rounded-xl px-1 py-2 transition-colors ${modo === m ? "bg-white font-semibold text-fundo" : "text-suave"}`}
            >
              {nome}
            </button>
          ))}
        </div>
      </div>
      {modo !== "dia" && valor && (
        <p className="text-xs text-suave">
          📅 Neste mês cai em {formatarData(dataDoRecebimento(valor, mesAtual()))} (já pula fim de semana e feriado).
        </p>
      )}
    </div>
  );
}
