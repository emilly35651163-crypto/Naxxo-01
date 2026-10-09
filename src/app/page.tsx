"use client";

import Link from "next/link";
import { useMes, usePerfil } from "@/lib/store";
import { resumoDoMes } from "@/lib/previstos";
import { useDados } from "@/lib/dados";
import { brl, nomeMes } from "@/lib/formato";
import InstalarApp from "@/components/InstalarApp";
import RendaDoMes from "@/components/RendaDoMes";
import MovimentacoesDoMes from "@/components/MovimentacoesDoMes";
import ParaRevisar from "@/components/ParaRevisar";
import { AvisoPadroes } from "@/components/PadroesEncontrados";
import NaoEncontrados from "@/components/NaoEncontrados";
import Icone, { TextoComIcones } from "@/components/Icone";

// Início: o essencial e mais nada (docs/NOVO-SISTEMA.md, seção 9): o que revisar, a renda, o mês e como ele vai fechar.
// Saldos, faturas e limites ficam em Contas (um lugar só).
export default function Inicio() {
  const dados = useDados();
  const mes = useMes();
  const perfil = usePerfil();

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
          <Icone e="🏦" /> <b>Cadastre suas contas</b> e importe o extrato do banco para tudo funcionar ›
        </Link>
      )}

      <ParaRevisar dados={dados} />
      <AvisoPadroes dados={dados} />
      <NaoEncontrados dados={dados} />

      <RendaDoMes mes={mes} dados={dados} />

      <InstalarApp fechavel />

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
