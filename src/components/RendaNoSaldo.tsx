"use client";

import { adicionarLancamento, rendaFixa, useFontes, useLancamentos, type FonteRenda } from "@/lib/store";
import { formatarData, hojeISO, lerValor, mesAtual, valorParaCampo } from "@/lib/formato";
import { CampoValor } from "./Campos";
import { rendaPendente, type ParteDaRenda } from "@/lib/renda";

/** O que já devia ter caído este mês (até hoje) e ainda não foi marcado como recebido. */
export function useRendaQueJaCaiu() {
  const fontes = useFontes();
  const lancamentos = useLancamentos();
  return fontes.flatMap((f) =>
    rendaPendente(f, mesAtual(), lancamentos)
      .filter((p) => p.dinheiro && p.data <= hojeISO())
      .map((parte) => ({ fonte: f, parte })),
  );
}

/** Valor de cada parte marcada (chave → texto do campo). Desmarcado = não está no objeto. */
export type MarcadosNoSaldo = Record<string, string>;

export function marcarTodos(itens: { parte: ParteDaRenda }[]): MarcadosNoSaldo {
  return Object.fromEntries(itens.map(({ parte }) => [parte.chave, valorParaCampo(parte.valor)]));
}

/** Marca como recebido o que já está dentro do saldo informado (não soma de novo no saldo), com o valor que a pessoa confirmou. */
export function registrarRendaNoSaldo(
  itens: { fonte: FonteRenda; parte: ParteDaRenda }[],
  marcados: MarcadosNoSaldo,
  contaId: string,
) {
  for (const { fonte, parte } of itens) {
    if (!(parte.chave in marcados)) continue;
    const valor = lerValor(marcados[parte.chave]) || 0;
    if (!(valor > 0)) continue;
    adicionarLancamento({
      tipo: "entrada",
      valor,
      descricao: parte.nome,
      categoria: parte.parte === "beneficio" ? "Benefícios" : rendaFixa(fonte.forma) ? "Salário" : "Trabalho por conta",
      data: parte.data,
      pago: true,
      fonteId: fonte.id,
      contaId,
      parteRenda: parte.parte,
      beneficio: parte.beneficio?.tipo,
      jaNoSaldo: true,
    });
  }
}

// "Esse saldo já inclui…?" — para quem cria a conta (ou corrige o saldo) depois do salário cair.
export default function RendaNoSaldo({
  itens,
  marcados,
  onChange,
}: {
  itens: { fonte: FonteRenda; parte: ParteDaRenda }[];
  marcados: MarcadosNoSaldo;
  onChange: (marcados: MarcadosNoSaldo) => void;
}) {
  if (itens.length === 0) return null;
  return (
    <div className="space-y-2 rounded-2xl border border-entrada/30 bg-entrada/5 p-3 text-sm">
      <p className="font-semibold">Esse saldo já inclui o que caiu este mês?</p>
      {itens.map(({ parte }) => {
        const marcado = parte.chave in marcados;
        return (
          <div key={parte.chave} className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={marcado}
              aria-label={parte.nome}
              onChange={(e) => {
                const novo = { ...marcados };
                if (e.target.checked) novo[parte.chave] = valorParaCampo(parte.valor);
                else delete novo[parte.chave];
                onChange(novo);
              }}
              className="size-5 shrink-0 accent-rosa"
            />
            <span className="min-w-0 flex-1">
              {parte.nome} <span className="text-xs text-suave">· {formatarData(parte.data)}</span>
            </span>
            {/* O valor é editável: quem ganha por hora recebe diferente da estimativa */}
            {marcado && (
              <div className="w-32 shrink-0">
                <CampoValor
                  valor={marcados[parte.chave]}
                  onChange={(v) => onChange({ ...marcados, [parte.chave]: v })}
                  rotulo={`Valor de ${parte.nome}`}
                />
              </div>
            )}
          </div>
        );
      })}
      <p className="text-xs text-suave">
        Marcados ficam como recebidos e não somam de novo no saldo. Ajuste o valor se foi diferente.
      </p>
    </div>
  );
}
