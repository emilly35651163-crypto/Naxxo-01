"use client";

import { useState } from "react";
import Link from "next/link";
import { jaAconteceu, maisRecentesPrimeiro, semAcento } from "@/lib/store";
import { brl, diasAte, formatarData, nomeMes } from "@/lib/formato";
import { previstosDoMes, resumoDoMes, type Previsto } from "@/lib/previstos";
import { itensDaFatura } from "@/lib/cartoes";
import type { Dados } from "@/lib/previstos";
import ItemLancamento from "./ItemLancamento";
import ConfirmarPrevisto from "./ConfirmarPrevisto";

// "Este mês" no Início: fechado, só o essencial (quanto entrou/saiu, o que falta e as próximas contas).
// Aberto: tudo o que está previsto (com "pago") e tudo o que já aconteceu nas contas (editável).
export default function MovimentacoesDoMes({ mes, dados }: { mes: string; dados: Dados }) {
  const [aberto, setAberto] = useState(false);
  const [aba, setAba] = useState<"falta" | "feito">("falta");
  const [busca, setBusca] = useState("");
  const [confirmando, setConfirmando] = useState<Previsto | null>(null);
  const [faturaAberta, setFaturaAberta] = useState<string | null>(null);

  const r = resumoDoMes(mes, dados);
  // Renda tem o próprio quadro (e cai sozinha): aqui ficam as contas, o mercado, as faturas…
  const previstos = previstosDoMes(mes, dados).filter((p) => p.origem !== "renda" && p.origem !== "benefício");
  const aPagar = previstos.filter((p) => p.tipo === "saida" && p.origem !== "guardar");
  const termo = semAcento(busca);
  const feitos = dados.lancamentos
    .filter((l) => l.data.startsWith(mes) && jaAconteceu(l))
    .filter((l) => !l.transferenciaId || l.tipo === "saida") // transferência: uma linha só
    .filter((l) => !termo || semAcento(`${l.descricao} ${l.categoria}`).includes(termo))
    .sort(maisRecentesPrimeiro);

  return (
    <section className="cartao p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="titulo-secao mb-0">{nomeMes(mes).split(" ")[0]}</h2>
        <button onClick={() => setAberto(!aberto)} className="text-xs text-rosa" aria-expanded={aberto}>
          {aberto ? "fechar ▴" : "ver tudo ▾"}
        </button>
      </div>

      {/* A prévia: quatro números e as próximas contas */}
      <div className="mt-2 grid grid-cols-4 gap-2 text-center">
        {[
          ["Entrou", r.entrou, "text-entrada"],
          ["Saiu", r.saiu, "text-saida"],
          ["Vai entrar", r.vaiEntrar, "text-entrada/80"],
          ["Vai sair", r.vaiSair, "text-saida/80"],
        ].map(([rotulo, valor, cor]) => (
          <div key={rotulo as string} className="rounded-xl bg-fundo/60 px-1 py-2">
            <p className="text-[0.65rem] text-suave">{rotulo}</p>
            <p className={`font-display text-sm font-bold tabular-nums ${cor}`}>
              {brl(valor as number)
                .replace("R$", "")
                .trim()}
            </p>
          </div>
        ))}
      </div>

      {!aberto && aPagar.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-sm">
          {aPagar.slice(0, 3).map((p) => {
            const dias = diasAte(p.data);
            const atrasada = dias < 0 || !!p.item?.atrasado;
            return (
              <li key={p.chave} className="flex items-center gap-2">
                <span aria-hidden>{p.icone}</span>
                <span className={`min-w-0 flex-1 truncate ${atrasada ? "text-saida" : ""}`}>{p.nome}</span>
                <span
                  className={`text-xs ${atrasada ? "font-semibold text-saida" : dias <= 3 ? "text-amber-300" : "text-suave"}`}
                >
                  {atrasada ? "atrasada" : dias === 0 ? "hoje" : formatarData(p.data)}
                </span>
                <span className="w-20 text-right tabular-nums">{brl(p.valor)}</span>
              </li>
            );
          })}
          {aPagar.length > 3 && (
            <li>
              <button onClick={() => setAberto(true)} className="text-xs text-suave hover:text-rosa">
                + {aPagar.length - 3} para pagar este mês
              </button>
            </li>
          )}
        </ul>
      )}
      {!aberto && aPagar.length === 0 && <p className="mt-3 text-sm text-suave">Nada para pagar. ✨</p>}

      {aberto && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-1 rounded-full bg-fundo p-1 text-sm">
            {(
              [
                ["falta", `Falta (${previstos.length})`],
                ["feito", `Já aconteceu (${feitos.length})`],
              ] as const
            ).map(([id, nome]) => (
              <button
                key={id}
                onClick={() => setAba(id)}
                className={`rounded-full py-1.5 ${aba === id ? "bg-white font-semibold text-fundo" : "text-suave"}`}
              >
                {nome}
              </button>
            ))}
          </div>

          {aba === "falta" &&
            (previstos.length ? (
              <ul className="divide-y divide-white/5">
                {previstos.map((p) => {
                  const dias = diasAte(p.data);
                  const entrada = p.tipo === "entrada";
                  const fatura = p.item?.tipo === "fatura" ? p.item : null;
                  const atrasado = !entrada && (dias < 0 || !!p.item?.atrasado);
                  return (
                    <li key={p.chave} className="py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="text-lg" aria-hidden>
                          {p.icone}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-sm font-medium ${atrasado ? "text-saida" : ""}`}>{p.nome}</p>
                          <p className="text-xs text-suave">
                            {dias < 0 ? `era para ${formatarData(p.data)}` : dias === 0 ? "hoje" : formatarData(p.data)}
                            {fatura && (
                              <button
                                onClick={() => setFaturaAberta(faturaAberta === p.chave ? null : p.chave)}
                                className="ml-2 text-rosa"
                              >
                                {faturaAberta === p.chave ? "esconder compras" : "ver compras"}
                              </button>
                            )}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={`text-sm font-semibold tabular-nums ${entrada ? "text-entrada" : "text-saida"}`}>
                            {entrada ? "+" : "−"} {brl(p.valor)}
                          </p>
                          {p.origem === "mercado" ? (
                            <Link href="/mercado" className="text-xs font-medium text-rosa">
                              ver mercado
                            </Link>
                          ) : (
                            <button onClick={() => setConfirmando(p)} className="text-xs font-medium text-rosa">
                              {entrada ? "recebi" : p.origem === "guardar" ? "guardei" : "pago"}
                            </button>
                          )}
                        </div>
                      </div>
                      {fatura && faturaAberta === p.chave && (
                        <ul className="ml-8 mt-2 space-y-1 border-l border-white/10 pl-3 text-xs">
                          {itensDaFatura(fatura.cartao, fatura.fatura, dados).map((i) => (
                            <li key={i.chave} className="flex gap-2">
                              <span className="min-w-0 flex-1 truncate text-suave">{i.descricao}</span>
                              <span className="text-suave">{i.detalhe}</span>
                              <span className="tabular-nums">{brl(i.valor)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-suave">Nada previsto. ✨</p>
            ))}

          {aba === "feito" && (
            <>
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="🔍 Buscar"
                aria-label="Buscar no que já aconteceu"
                className="campo rounded-full py-2 text-sm"
              />
              {feitos.length ? (
                <ul className="divide-y divide-white/5">
                  {feitos.map((l) => (
                    <ItemLancamento key={l.id} lancamento={l} contas={dados.cartoes} lancamentos={dados.lancamentos} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-suave">{busca ? "Nada encontrado." : "Nada ainda neste mês."}</p>
              )}
              <p className="text-xs text-suave">
                💳 As compras no crédito ficam na fatura de cada cartão, em{" "}
                <Link href="/contas" className="text-rosa">
                  Contas
                </Link>
                .
              </p>
            </>
          )}
        </div>
      )}

      {confirmando && <ConfirmarPrevisto previsto={confirmando} onFechar={() => setConfirmando(null)} />}
    </section>
  );
}
