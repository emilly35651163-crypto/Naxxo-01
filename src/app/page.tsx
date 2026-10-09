"use client";

import Link from "next/link";
import { useMes, usePerfil } from "@/lib/store";
import { saldoDosVales, saldoTotal, ehVale } from "@/lib/contas";
import { resumoDoMes } from "@/lib/previstos";
import { useDados } from "@/lib/dados";
import { brl, nomeMes } from "@/lib/formato";
import InstalarApp from "@/components/InstalarApp";
import RendaDoMes from "@/components/RendaDoMes";
import MovimentacoesDoMes from "@/components/MovimentacoesDoMes";
import ParaRevisar from "@/components/ParaRevisar";
import { AvisoPadroes } from "@/components/PadroesEncontrados";
import Icone, { TextoComIcones } from "@/components/Icone";

// Início: o essencial e mais nada. Renda, saldo, o mês (entradas, saídas, o que falta) e como ele vai fechar.
export default function Inicio() {
  const dados = useDados();
  const mes = useMes();
  const perfil = usePerfil();

  const saldo = saldoTotal(dados.cartoes, dados.lancamentos);
  const vales = saldoDosVales(dados.cartoes, dados.lancamentos);
  const r = resumoDoMes(mes, dados);
  const nomeDoMes = nomeMes(mes).split(" ")[0].toLowerCase();

  return (
    <div className="space-y-4">
      {perfil?.nome && (
        <p className="font-display text-xl">
          Oi, <span className="gradiente-texto font-semibold">{perfil.nome.split(" ")[0]}</span>
        </p>
      )}

      {dados.cartoes.length === 0 && (
        <Link href="/contas" className="block rounded-2xl border border-rosa/50 bg-rosa/10 p-4 text-sm">
          <Icone e="🏦" /> <b>Cadastre suas contas</b> e o saldo de hoje para tudo funcionar ›
        </Link>
      )}

      <ParaRevisar dados={dados} />
      <AvisoPadroes dados={dados} />

      <RendaDoMes mes={mes} dados={dados} />

      <InstalarApp fechavel />

      {/* Saldo */}
      <Link href="/contas" className="cartao block p-5 hover:border-rosa/50">
        <p className="titulo-secao mb-0">Saldo em conta hoje</p>
        <p className={`mt-1 font-display text-4xl font-bold tabular-nums ${saldo < 0 ? "text-saida" : ""}`}>{brl(saldo)}</p>
        {dados.cartoes.some(ehVale) && (
          <p className="text-xs text-suave">
            <Icone e="🍽️" /> + {brl(vales)} no vale
          </p>
        )}
      </Link>

      {/* O mês: prévia pequena; "ver tudo" abre o que falta e o que já aconteceu */}
      <MovimentacoesDoMes mes={mes} dados={dados} />

      {/* Fim do mês */}
      <section className={`cartao p-5 ${r.sobra < 0 ? "border-saida/50" : "border-entrada/40"}`}>
        <p className="titulo-secao mb-0">Fim de {nomeDoMes}</p>
        <p className={`mt-1 font-display text-2xl font-bold ${r.sobra < 0 ? "text-saida" : "text-entrada"}`}>
          <TextoComIcones texto={r.sobra < 0 ? `Vai faltar ${brl(-r.sobra)} 😟` : `Vai sobrar ${brl(r.sobra)} 🙂`} />
        </p>
        <p className="mt-1 text-xs text-suave tabular-nums">
          Entra {brl(r.entra)} · sai {brl(r.sai)}
        </p>
      </section>
    </div>
  );
}
