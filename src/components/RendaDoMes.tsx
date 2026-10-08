"use client";

import { useState } from "react";
import Link from "next/link";
import { atualizarLancamento } from "@/lib/store";
import { brl, diasAte, formatarData, hojeISO, lerValor, nomeMes, valorParaCampo } from "@/lib/formato";
import { previstosDoMes, resumoDoMes, type Dados, type Previsto } from "@/lib/previstos";
import { mostrarAviso } from "@/lib/avisos";
import { CampoValor } from "./Campos";
import Icone from "./Icone";
import ConfirmarPrevisto from "./ConfirmarPrevisto";

// Renda do mês no Início. A regra é simples: o dia passou, caiu (o app registra sozinho).
// O que já caiu tem "corrigir" para pôr o valor exato (freela, hora extra, desconto…). O que vai cair mostra em quantos dias.
export default function RendaDoMes({ mes, dados }: { mes: string; dados: Dados }) {
  const [editando, setEditando] = useState<string | null>(null);
  const [valor, setValor] = useState("");
  const [confirmando, setConfirmando] = useState<Previsto[]>([]);

  const r = resumoDoMes(mes, dados);
  const caiu = dados.lancamentos
    .filter((l) => l.tipo === "entrada" && l.fonteId && l.data.startsWith(mes))
    .sort((a, b) => a.data.localeCompare(b.data));
  const vaiCair = previstosDoMes(mes, dados).filter((p) => p.origem === "renda" || p.origem === "benefício");
  // Da mesma renda e no mesmo dia (ex.: estágio + vale-transporte): uma linha só
  const grupos: Previsto[][] = [];
  for (const p of vaiCair) {
    const g = p.fonte && grupos.find((x) => x[0].fonte?.id === p.fonte!.id && x[0].data === p.data);
    if (g) g.push(p);
    else grupos.push([p]);
  }
  const nomeDoMes = nomeMes(mes).split(" ")[0].toLowerCase();

  return (
    <section className="cartao p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="titulo-secao mb-0">Renda de {nomeDoMes}</h2>
        <Link href="/renda" className="text-xs text-rosa">
          editar ›
        </Link>
      </div>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums text-entrada">{brl(r.entrou)}</p>

      <ul className="mt-3 space-y-2 text-sm">
        {caiu.map((l) =>
          editando === l.id ? (
            <li key={l.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate">Quanto caiu de {l.descricao}?</span>
              <div className="w-32">
                <CampoValor valor={valor} onChange={setValor} autoFocus rotulo={`Quanto caiu de ${l.descricao}`} />
              </div>
              <button
                onClick={() => {
                  const n = lerValor(valor);
                  if (n > 0) {
                    atualizarLancamento(l.id, { valor: n });
                    mostrarAviso({ texto: "Valor corrigido ✓" });
                  }
                  setEditando(null);
                }}
                className="rounded-full bg-entrada/15 px-3 py-1 text-xs font-semibold text-entrada"
              >
                ok
              </button>
            </li>
          ) : (
            <li key={l.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate">
                ✓ {l.descricao}
                <span className="text-xs text-suave"> · caiu {formatarData(l.data)}</span>
              </span>
              <span className="tabular-nums">{brl(l.valor)}</span>
              <button
                onClick={() => {
                  setEditando(l.id);
                  setValor(valorParaCampo(l.valor));
                }}
                className="rounded-full bg-white/5 px-3 py-1 text-xs text-suave hover:text-white"
              >
                corrigir
              </button>
            </li>
          ),
        )}
        {grupos.map((grupo) => {
          const g = [...grupo].sort((a, b) => Number(a.origem === "benefício") - Number(b.origem === "benefício"));
          const p = g[0];
          const nome = g.length === 1 ? p.nome : g.map((x) => x.nome.replace(` · ${p.fonte?.nome}`, "")).join(" + ");
          const dias = diasAte(p.data);
          return (
            <li key={p.chave} className="flex items-center gap-2 text-suave">
              <span className="min-w-0 flex-1 truncate">
                {g.map((x) => (
                  <Icone key={x.chave} e={x.icone} className="mr-0.5" />
                ))}{" "}
                {nome}
                <span className="text-xs"> · {formatarData(p.data)}</span>
              </span>
              <span className="tabular-nums">{brl(g.reduce((t, x) => t + x.valor, 0))}</span>
              {p.data <= hojeISO() ? (
                <button
                  onClick={() => setConfirmando(g)}
                  className="rounded-full bg-entrada/15 px-3 py-1 text-xs font-semibold text-entrada"
                >
                  caiu hoje
                </button>
              ) : (
                <span className="rounded-full bg-white/5 px-3 py-1 text-xs">{dias === 1 ? "amanhã" : `em ${dias} dias`}</span>
              )}
            </li>
          );
        })}
      </ul>
      {caiu.length === 0 && grupos.length === 0 && (
        <p className="mt-1 text-xs text-suave">
          {dados.fontes.length ? "Nada previsto para este mês." : "Cadastre o que você recebe em “editar”."}
        </p>
      )}

      {confirmando[0] && (
        <ConfirmarPrevisto
          key={confirmando[0].chave}
          previsto={confirmando[0]}
          onFechar={() => setConfirmando((f) => f.slice(1))}
        />
      )}
    </section>
  );
}
