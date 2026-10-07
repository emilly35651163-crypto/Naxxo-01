"use client";

import { adicionarLancamento, rendaFixa, useFontes, useLancamentos, type FonteRenda } from "@/lib/store";
import { brl, formatarData, hojeISO, mesAtual } from "@/lib/formato";
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

/** Marca como recebido o que já está dentro do saldo informado (não soma de novo no saldo). */
export function registrarRendaNoSaldo(itens: { fonte: FonteRenda; parte: ParteDaRenda }[], contaId: string) {
  for (const { fonte, parte } of itens) {
    adicionarLancamento({
      tipo: "entrada",
      valor: parte.valor,
      descricao: parte.nome,
      categoria: parte.parte === "beneficio" ? "Benefícios" : rendaFixa(fonte.forma) ? "Salário" : "Freelance",
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
  marcados: string[];
  onChange: (chaves: string[]) => void;
}) {
  if (itens.length === 0) return null;
  return (
    <div className="space-y-2 rounded-2xl border border-entrada/30 bg-entrada/5 p-3 text-sm">
      <p className="font-semibold">Esse saldo já inclui o que caiu este mês?</p>
      {itens.map(({ parte }) => (
        <label key={parte.chave} className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={marcados.includes(parte.chave)}
            onChange={(e) => onChange(e.target.checked ? [...marcados, parte.chave] : marcados.filter((c) => c !== parte.chave))}
            className="size-5 accent-rosa"
          />
          <span className="min-w-0 flex-1">
            {parte.nome} <span className="text-xs text-suave">· caiu {formatarData(parte.data)}</span>
          </span>
          <span className="tabular-nums">{brl(parte.valor)}</span>
        </label>
      ))}
      <p className="text-xs text-suave">Marcados: ficam como recebidos e não são somados de novo no saldo.</p>
    </div>
  );
}
