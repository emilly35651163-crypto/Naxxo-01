"use client";

import { precoPorUnidade, totalDoItemLista } from "@/lib/store";
import { lerValor, valorParaCampo } from "@/lib/formato";
import { CampoValor } from "@/components/Campos";

/**
 * Preço por kg/unidade/litro OU total: preencheu um, o outro é calculado pela quantidade.
 * Guarda sempre o preço por unidade (`valor`).
 */
export default function CamposPreco({
  valor,
  qtd,
  unidade,
  onChange,
  compacto,
}: {
  valor: string;
  qtd: string;
  unidade: string;
  onChange: (mudancas: { valor: string; qtd?: string }) => void;
  compacto?: boolean;
}) {
  const total = totalDoItemLista({ valor, qtd });
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="block space-y-1">
        {!compacto && <span className="text-xs text-suave">Preço por {unidade}</span>}
        <CampoValor
          valor={valor}
          onChange={(v) => onChange({ valor: v })}
          placeholder={compacto ? `por ${unidade}` : "0,00"}
          rotulo={`Preço por ${unidade}`}
        />
      </label>
      <label className="block space-y-1">
        {!compacto && <span className="text-xs text-suave">ou o total</span>}
        <CampoValor
          valor={total > 0 ? valorParaCampo(total) : ""}
          onChange={(v) => {
            const t = lerValor(v) || 0;
            onChange({ valor: t > 0 ? valorParaCampo(precoPorUnidade(t, qtd)) : "", qtd: qtd || (t > 0 ? "1" : qtd) });
          }}
          placeholder={compacto ? "total" : "0,00"}
          rotulo="Total"
        />
      </label>
    </div>
  );
}
