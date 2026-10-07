"use client";

import { useCallback, useEffect, useState } from "react";
import Tutorial, { type Etapa } from "./Tutorial";

// Painel de controle (localhost): quantas pessoas criaram conta, quem está usando e o quanto.
// Os dados vêm de /api/painel, que só funciona no seu computador (com a chave secreta no .env.local).

type Pessoa = {
  email: string;
  nome: string;
  criadoEm: string;
  ultimoLogin: string | null;
  ultimaAtividade: string | null;
  questionario: boolean;
  lancamentos: number;
  contas: number;
  compras: number;
  mercado: number;
  metas: number;
};

const DIA = 86_400_000;
const quando = (iso: string | null) => {
  if (!iso) return "—";
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / DIA);
  return dias <= 0 ? "hoje" : dias === 1 ? "ontem" : `há ${dias} dias`;
};
const data = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

export default function Painel() {
  const [pessoas, setPessoas] = useState<Pessoa[] | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [geradoEm, setGeradoEm] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [agora, setAgora] = useState(0);
  const [etapa, setEtapa] = useState<Etapa | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await fetch("/api/painel", { cache: "no-store" });
      const j = r.status === 404 ? { erro: "O painel só funciona no seu computador (localhost)." } : await r.json();
      if (j.erro) {
        setErro(j.erro);
        setEtapa(j.etapa ?? null);
        setPessoas(null);
      } else {
        setErro("");
        setPessoas(j.pessoas);
        setAviso(j.avisoDados ?? "");
        setEtapa(j.avisoDados ? "sem-permissao" : "pronto");
        setGeradoEm(j.geradoEm);
        setAgora(Date.now());
      }
    } catch {
      setErro("Não consegui falar com o servidor local. O npm run dev está rodando?");
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void carregar(), 0);
    return () => clearTimeout(t);
  }, [carregar]);

  // "agora" é o momento em que os dados chegaram (fica igual entre um desenho e outro)
  const ativa = (p: Pessoa) => {
    const ultima = [p.ultimaAtividade, p.ultimoLogin].filter(Boolean).sort().pop();
    return ultima ? agora - new Date(ultima).getTime() : Infinity;
  };
  const lista = [...(pessoas ?? [])].sort((a, b) => ativa(a) - ativa(b));
  const numeros = pessoas && [
    ["Contas criadas", pessoas.length],
    ["Ativas hoje", pessoas.filter((p) => ativa(p) < DIA).length],
    ["Ativas em 7 dias", pessoas.filter((p) => ativa(p) < 7 * DIA).length],
    ["Novas em 7 dias", pessoas.filter((p) => agora - new Date(p.criadoEm).getTime() < 7 * DIA).length],
    ["Fizeram o questionário", pessoas.filter((p) => p.questionario).length],
    ["Lançamentos no total", pessoas.reduce((t, p) => t + p.lancamentos, 0)],
  ];

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">
            Painel <span className="gradiente-texto">NAXXO</span>
          </h1>
          <p className="text-sm text-suave">
            Quem está usando o naxxo.com.br (contas com login).
            {geradoEm && ` Atualizado ${new Date(geradoEm).toLocaleTimeString("pt-BR")}.`}
          </p>
        </div>
        <button
          onClick={() => void carregar()}
          disabled={carregando}
          className="botao-gradiente rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {carregando ? "Atualizando…" : "↻ Atualizar"}
        </button>
      </div>

      {erro && !etapa && <p className="cartao border-saida/50 p-4 text-sm text-saida">⚠️ {erro}</p>}
      {aviso && <p className="cartao border-amber-300/40 p-4 text-sm text-amber-300">⚠️ {aviso}</p>}
      {etapa && etapa !== "pronto" && <Tutorial etapa={etapa} onTestar={() => void carregar()} testando={carregando} />}

      {numeros && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {numeros.map(([rotulo, valor]) => (
            <div key={rotulo} className="cartao p-4">
              <p className="text-xs text-suave">{rotulo}</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums">{valor}</p>
            </div>
          ))}
        </section>
      )}

      {pessoas && (
        <section className="cartao overflow-x-auto p-0">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="text-xs text-suave">
              <tr className="border-b border-white/10">
                {[
                  "Pessoa",
                  "Criou",
                  "Último login",
                  "Última atividade",
                  "Questionário",
                  "Lançamentos",
                  "Contas",
                  "Cartão",
                  "Mercado",
                  "Metas",
                ].map((c) => (
                  <th key={c} className="px-4 py-3 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {lista.map((p) => (
                <tr key={p.email}>
                  <td className="px-4 py-3">
                    <span className="block font-medium">{p.nome || "—"}</span>
                    <span className="text-xs text-suave">{p.email}</span>
                  </td>
                  <td className="px-4 py-3 text-suave">{data(p.criadoEm)}</td>
                  <td className="px-4 py-3">{quando(p.ultimoLogin)}</td>
                  <td className={`px-4 py-3 ${ativa(p) < DIA ? "font-semibold text-entrada" : ""}`}>
                    {quando(p.ultimaAtividade)}
                  </td>
                  <td className="px-4 py-3">{p.questionario ? "✓" : "—"}</td>
                  <td className="px-4 py-3 tabular-nums">{p.lancamentos}</td>
                  <td className="px-4 py-3 tabular-nums">{p.contas}</td>
                  <td className="px-4 py-3 tabular-nums">{p.compras}</td>
                  <td className="px-4 py-3 tabular-nums">{p.mercado}</td>
                  <td className="px-4 py-3 tabular-nums">{p.metas}</td>
                </tr>
              ))}
              {lista.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-suave">
                    Ninguém criou conta ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      <p className="text-xs text-suave">
        Só aparece quem usa com login (naxxo.com.br). Quem abre pelo naxxo-01.vercel.app usa sem conta, e os dados ficam só no
        navegador da pessoa.
      </p>
    </main>
  );
}
