"use client";

import Link from "next/link";
import { useMemo } from "react";
import { iconeDaCategoria, usePreferencias } from "@/lib/store";
import { descobrirPadroes, descreverPadrao, acompanhado, type Padrao } from "@/lib/padroes";
import { acompanharPadrao, cancelarPadrao, ignorarPadrao } from "@/lib/acompanhar";
import { brl, formatarData, hojeISO } from "@/lib/formato";
import { mostrarAviso } from "@/lib/avisos";
import type { Dados } from "@/lib/previstos";
import Icone from "./Icone";

/** Os padrões do extrato, separados: novos (perguntar), acompanhados, e os avisos (parou, mudou de preço) */
export function usePadroes(dados: Dados) {
  const { padroesIgnorados = [] } = usePreferencias();
  return useMemo(() => {
    const todos = descobrirPadroes(dados.lancamentos, dados.compras, hojeISO());
    const ja = (p: Padrao) => acompanhado(p, dados.fontes, dados.fixos);
    return {
      novos: todos.filter((p) => !p.parou && !ja(p) && !padroesIgnorados.includes(p.chave)),
      acompanhados: todos.filter(ja),
      pararam: todos.filter((p) => p.parou && p.tipo === "saida" && !padroesIgnorados.includes(`${p.chave}|parou`)),
      mudaram: todos.filter((p) => p.mudou && !p.parou),
    };
  }, [dados, padroesIgnorados]);
}

/** "~R$ 203 por mês (de R$ 175 a R$ 240)" · "R$ 1.200 por mês" · "~R$ 730 por mês (R$ 177 por vez)" */
function quanto(p: Padrao) {
  if (p.frequencia === "anual") return `${brl(p.valor)} por ano`;
  const principal = `${p.varia ? "~" : ""}${brl(p.porMes)} por mês`;
  return principal;
}

/** A linha pequena de baixo: "~R$ 168 por vez" ou "de R$ 182 a R$ 242" (o que muda) */
function detalheDoValor(p: Padrao) {
  if (p.frequencia !== "mensal" && p.frequencia !== "anual") return `${p.varia ? "~" : ""}${brl(p.valor)} por vez`;
  return p.varia ? `varia de ${brl(p.min)} a ${brl(p.max)}` : "";
}

// Início: um aviso só quando o extrato mostrou algo que se repete e a pessoa ainda não viu
export function AvisoPadroes({ dados }: { dados: Dados }) {
  const { novos, pararam } = usePadroes(dados);
  const n = novos.length + pararam.length;
  if (n === 0) return null;
  return (
    <Link
      href="/resumo?aba=recorrentes"
      className="flex items-center gap-3 rounded-2xl border border-rosa/40 bg-rosa/10 p-4 text-sm"
    >
      <Icone e="🔁" />
      <span className="flex-1">
        <b>
          Encontrei {n} {n === 1 ? "coisa que se repete" : "coisas que se repetem"} no seu extrato
        </b>
        <span className="block text-xs text-suave">Renda, contas, assinaturas… confirme para entrarem na previsão.</span>
      </span>
      <span className="text-rosa">›</span>
    </Link>
  );
}

// Resumo → Recorrentes: o que o extrato mostra que se repete (renda, contas, assinaturas, gasolina…)
export default function PadroesEncontrados({ dados }: { dados: Dados }) {
  const { novos, acompanhados, pararam, mudaram } = usePadroes(dados);

  if (novos.length + acompanhados.length + pararam.length === 0)
    return (
      <p className="cartao p-5 text-sm text-suave">
        Ainda não encontrei nada que se repete. Importe pelo menos 3 meses de extrato em <b>Contas</b> (o ideal são 6): eu acho
        sozinho seu salário, as contas fixas, as assinaturas e os gastos frequentes, como gasolina.
      </p>
    );

  return (
    <div className="space-y-4">
      {pararam.map((p) => (
        <div key={p.chave} className="cartao space-y-2 border-amber-300/40 p-4 text-sm">
          <p>
            <Icone e="⚠️" /> <b>{p.nome}</b> vinha todo mês e não veio desde {formatarData(p.ultimaData)}. Você cancelou?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                cancelarPadrao(p);
                mostrarAviso({ texto: `${p.nome} saiu da previsão ✓` });
              }}
              className="rounded-full bg-entrada/15 px-3 py-1.5 text-xs font-semibold text-entrada"
            >
              Cancelei
            </button>
            <button onClick={() => ignorarPadrao(p.chave, true)} className="rounded-full px-3 py-1.5 text-xs text-suave">
              Ainda tenho
            </button>
          </div>
        </div>
      ))}

      {mudaram.map((p) => (
        <p key={p.chave} className="cartao p-4 text-sm">
          <Icone e="📈" /> <b>{p.nome}</b> {p.mudou!.para > p.mudou!.de ? "subiu" : "baixou"} de {brl(p.mudou!.de)} para{" "}
          <b>{brl(p.mudou!.para)}</b>.
        </p>
      ))}

      {novos.length > 0 && (
        <section className="cartao p-4">
          <h2 className="titulo-secao">Encontrei no seu extrato</h2>
          <p className="mb-2 text-xs text-suave">
            Confirme o que é fixo: entra na previsão, e o valor se atualiza sozinho com o extrato (salário e contas que mudam usam
            a média dos últimos meses).
          </p>
          <ul className="divide-y divide-white/5">
            {novos.map((p) => (
              <Linha key={p.chave} p={p}>
                <button
                  onClick={() => {
                    acompanharPadrao(p);
                    mostrarAviso({ texto: `${p.nome} entrou na previsão ✓` });
                  }}
                  className="rounded-full bg-entrada/15 px-3 py-1.5 text-xs font-semibold text-entrada"
                >
                  É fixo
                </button>
                <button onClick={() => ignorarPadrao(p.chave)} className="px-2 py-1 text-xs text-suave hover:text-saida">
                  não é
                </button>
              </Linha>
            ))}
          </ul>
        </section>
      )}

      {acompanhados.length > 0 && (
        <section className="cartao p-4">
          <h2 className="titulo-secao">Acompanhando</h2>
          <ul className="divide-y divide-white/5">
            {acompanhados.map((p) => (
              <Linha key={p.chave} p={p} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Linha({ p, children }: { p: Padrao; children?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <span className="text-xl" aria-hidden>
        <Icone e={p.tipo === "entrada" ? "💰" : iconeDaCategoria("saida", p.categoria)} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{p.nome}</span>
        <span className={`block text-sm tabular-nums ${p.tipo === "entrada" ? "text-entrada" : ""}`}>{quanto(p)}</span>
        {detalheDoValor(p) && <span className="block text-xs tabular-nums text-suave">{detalheDoValor(p)}</span>}
        <span className="block text-xs text-suave">
          {descreverPadrao(p)} · {p.vezes} vezes no extrato
        </span>
      </span>
      {children && <span className="flex shrink-0 flex-col items-end gap-1">{children}</span>}
    </li>
  );
}
