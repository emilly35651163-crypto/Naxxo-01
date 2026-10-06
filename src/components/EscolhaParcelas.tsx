"use client";

import { brl, soNumeros } from "@/lib/formato";
import { valorDaParcela } from "@/lib/cartoes";
import { Chip } from "./Campos";

const PARCELAS_RAPIDAS = [1, 2, 3, 4, 5, 6, 10, 12];

// "Em quantas vezes?": os números mais comuns e um campo para qualquer outro (ex.: 18x, 24x).
// O mesmo nos dois lugares que lançam compra no crédito (+ Novo lançamento e Contas → Incluir no cartão).
export default function EscolhaParcelas({
  valor,
  onChange,
  valorTotal,
}: {
  valor: string;
  onChange: (texto: string) => void;
  valorTotal?: number;
}) {
  const parcelas = Math.max(Number(valor) || 1, 1);
  return (
    <div className="space-y-1.5">
      <span className="text-xs text-suave">Em quantas vezes?</span>
      <div className="flex flex-wrap items-center gap-2">
        {PARCELAS_RAPIDAS.map((p) => (
          <Chip key={p} ativo={parcelas === p} onClick={() => onChange(String(p))}>
            {p === 1 ? "À vista" : `${p}x`}
          </Chip>
        ))}
        <input
          inputMode="numeric"
          value={PARCELAS_RAPIDAS.includes(parcelas) ? "" : valor}
          onChange={(e) => onChange(soNumeros(e.target.value, false).slice(0, 3) || "1")}
          placeholder="outra"
          aria-label="Outro número de parcelas"
          className="campo w-20 py-1.5 text-sm"
        />
      </div>
      {valorTotal && valorTotal > 0 && parcelas > 1 ? (
        <p className="text-xs text-suave">
          {parcelas}x de {brl(valorDaParcela({ valorTotal, parcelas }, 1))}
          {valorDaParcela({ valorTotal, parcelas }, 0) !== valorDaParcela({ valorTotal, parcelas }, 1) &&
            ` (a 1ª de ${brl(valorDaParcela({ valorTotal, parcelas }, 0))})`}
        </p>
      ) : null}
    </div>
  );
}
