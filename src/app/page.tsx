"use client";

import { useState } from "react";
import Link from "next/link";
import { useMes, usePerfil } from "@/lib/store";
import { saldoDosVales, saldoTotal, ehVale } from "@/lib/contas";
import { previstosDoMes, resumoDoMes, type Previsto } from "@/lib/previstos";
import { useDados } from "@/lib/dados";
import { brl, diasAte, formatarData, hojeISO, nomeMes } from "@/lib/formato";
import ConfirmarPrevisto from "@/components/ConfirmarPrevisto";

// Início: o essencial e mais nada. Renda, saldo, próximas contas e como o mês vai fechar.
export default function Inicio() {
  const dados = useDados();
  const mes = useMes();
  const perfil = usePerfil();
  // "Recebi" de um grupo (ex.: estágio + vale-transporte no mesmo dia): confirma um de cada vez
  const [fila, setFila] = useState<Previsto[]>([]);
  const confirmando = fila[0] ?? null;

  const saldo = saldoTotal(dados.cartoes, dados.lancamentos);
  const vales = saldoDosVales(dados.cartoes, dados.lancamentos);
  const r = resumoDoMes(mes, dados);
  const previstos = previstosDoMes(mes, dados);
  const aReceber = previstos.filter((p) => p.tipo === "entrada");
  // Da mesma renda e no mesmo dia (ex.: estágio + vale-transporte): uma linha só; em dias diferentes, separado
  const grupos: Previsto[][] = [];
  for (const p of aReceber) {
    const grupo = p.fonte && grupos.find((g) => g[0].fonte?.id === p.fonte!.id && g[0].data === p.data);
    if (grupo) grupo.push(p);
    else grupos.push([p]);
  }
  const proximas = previstos.filter((p) => p.tipo === "saida" && p.origem !== "guardar").slice(0, 5);
  const nomeDoMes = nomeMes(mes).split(" ")[0].toLowerCase();

  return (
    <div className="space-y-4">
      {perfil?.nome && (
        <p className="font-display text-xl">
          Oi, <span className="gradiente-texto font-semibold">{perfil.nome.split(" ")[0]}</span> 👋
        </p>
      )}

      {dados.cartoes.length === 0 && (
        <Link href="/contas" className="block rounded-2xl border border-rosa/50 bg-rosa/10 p-4 text-sm">
          🏦 <b>Cadastre suas contas</b> e o saldo de hoje para tudo funcionar ›
        </Link>
      )}

      {/* Renda */}
      <section className="cartao p-5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="titulo-secao mb-0">Renda de {nomeDoMes}</h2>
          <Link href="/renda" className="text-xs text-rosa">
            editar ›
          </Link>
        </div>
        <p className="mt-1 font-display text-2xl font-bold tabular-nums text-entrada">{brl(r.entrou)}</p>
        {aReceber.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm">
            {grupos.map((grupo) => {
              // O salário/estágio primeiro, os vales depois
              const g = [...grupo].sort((a, b) => Number(a.origem === "benefício") - Number(b.origem === "benefício"));
              const p = g[0];
              const nome =
                g.length === 1
                  ? `${p.icone} ${p.nome}`
                  : `${g.map((x) => x.icone).join("")} ${g.map((x) => x.nome.replace(` · ${p.fonte?.nome}`, "")).join(" + ")}`;
              return (
                <li key={p.chave} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">
                    {nome}
                    <span className="text-xs text-suave"> · {formatarData(p.data)}</span>
                  </span>
                  <span className="tabular-nums text-suave">{brl(g.reduce((t, x) => t + x.valor, 0))}</span>
                  {p.data <= hojeISO() ? (
                    <button
                      onClick={() => setFila(g)}
                      className="rounded-full bg-entrada/15 px-3 py-1 text-xs font-semibold text-entrada"
                    >
                      Recebi
                    </button>
                  ) : (
                    <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-suave">
                      {diasAte(p.data) === 1 ? "amanhã" : `em ${diasAte(p.data)} dias`}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-suave">
            {dados.fontes.length ? "Tudo o que era previsto já caiu ✓" : "Cadastre o que você recebe em “editar”."}
          </p>
        )}
      </section>

      {/* Saldo */}
      <Link href="/contas" className="cartao block p-5 hover:border-rosa/50">
        <p className="titulo-secao mb-0">Saldo em conta hoje</p>
        <p className={`mt-1 font-display text-4xl font-bold tabular-nums ${saldo < 0 ? "text-saida" : ""}`}>{brl(saldo)}</p>
        {dados.cartoes.some(ehVale) && <p className="text-xs text-suave">🍽️ + {brl(vales)} no vale</p>}
      </Link>

      {/* Próximas contas */}
      <Link href="/lancamentos" className="cartao block p-5 hover:border-rosa/50">
        <p className="titulo-secao">Próximas contas</p>
        {proximas.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {proximas.map((p) => {
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
                  <span className="w-24 text-right tabular-nums">{brl(p.valor)}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-suave">Nada para pagar. ✨</p>
        )}
      </Link>

      {/* Fim do mês */}
      <section className={`cartao p-5 ${r.sobra < 0 ? "border-saida/50" : "border-entrada/40"}`}>
        <p className="titulo-secao mb-0">Fim de {nomeDoMes}</p>
        <p className={`mt-1 font-display text-2xl font-bold ${r.sobra < 0 ? "text-saida" : "text-entrada"}`}>
          {r.sobra < 0 ? `Vai faltar ${brl(-r.sobra)} 😟` : `Vai sobrar ${brl(r.sobra)} 🙂`}
        </p>
        <p className="mt-1 text-xs text-suave tabular-nums">
          Entra {brl(r.entra)} · sai {brl(r.sai)}
        </p>
      </section>

      {confirmando && (
        <ConfirmarPrevisto key={confirmando.chave} previsto={confirmando} onFechar={() => setFila((f) => f.slice(1))} />
      )}
    </div>
  );
}
