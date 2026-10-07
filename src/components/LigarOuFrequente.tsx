"use client";

import { useState } from "react";
import type { CategoriaFixo, Lancamento } from "@/lib/store";
import type { Previsto } from "@/lib/previstos";
import type { LinhaExtrato } from "@/lib/extrato";
import { brl, formatarData } from "@/lib/formato";

// Dois atalhos de cada linha do extrato:
// - 🔗 "Já está no app": liga a linha a um lançamento ou a algo previsto (salário, aluguel, parcela…), sem duplicar;
// - 🔁 "Gasto frequente": a linha vira um gasto que se repete (dívida, gasolina…) e já fica como o primeiro pagamento.

export type Ligacao = { tipo: "lancamento"; id: string; descricao: string } | { tipo: "previsto"; previsto: Previsto };

export type Frequente = {
  nome: string;
  icone: string;
  categoria: CategoriaFixo;
  varia: boolean;
  /** 0 = todo mês, no mesmo dia; senão, a cada X dias */
  intervaloDias: number;
  /** Dívida: quantas parcelas faltam, contando esta ("" = sem fim) */
  restantes: string;
};

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const dias = (a: string, b: string) =>
  Math.abs(new Date(`${a}T12:00:00`).getTime() - new Date(`${b}T12:00:00`).getTime()) / 864e5;

type Candidato = { chave: string; nome: string; data: string; valor: number; detalhe: string; ligacao: Ligacao };

/** O que pode ser esta linha: previstos do mês e lançamentos perto da data, os mais parecidos primeiro. */
function candidatos(l: LinhaExtrato, previstos: Previsto[], lancamentos: Lancamento[], busca: string): Candidato[] {
  const lista: Candidato[] = [
    ...previstos
      .filter((p) => p.tipo === l.tipo && p.origem !== "guardar")
      .map((p) => ({
        chave: `p-${p.chave}`,
        nome: `${p.icone} ${p.nome}`,
        data: p.data,
        valor: p.valor,
        detalhe: "previsto",
        ligacao: { tipo: "previsto" as const, previsto: p },
      })),
    ...lancamentos
      .filter((x) => x.tipo === l.tipo && !x.extratoId && dias(x.data, l.data) <= 20)
      .map((x) => ({
        chave: `l-${x.id}`,
        nome: x.descricao,
        data: x.data,
        valor: x.valor,
        detalhe: x.pago ? "lançado" : "lançado (a pagar)",
        ligacao: { tipo: "lancamento" as const, id: x.id, descricao: x.descricao },
      })),
  ];
  const termo = semAcento(busca.trim());
  return lista
    .filter((c) => !termo || semAcento(c.nome).includes(termo))
    .sort((a, b) => Math.abs(a.valor - l.valor) - Math.abs(b.valor - l.valor) || dias(a.data, l.data) - dias(b.data, l.data))
    .slice(0, 8);
}

/** Previsto que parece ser esta linha (para sugerir): mesmo tipo, até 5 dias, valor quase igual ou nome parecido. */
export function previstoParecido(l: LinhaExtrato, previstos: Previsto[], usados: Set<string>) {
  const texto = semAcento(l.descricao);
  return previstos.find((p) => {
    if (usados.has(p.chave) || p.tipo !== l.tipo || p.origem === "guardar" || dias(p.data, l.data) > 5) return false;
    const diferenca = Math.abs(p.valor - l.valor) / Math.max(p.valor, l.valor);
    const nome = semAcento(p.nome)
      .split(/\W+/)
      .some((palavra) => palavra.length >= 4 && texto.includes(palavra));
    return diferenca <= 0.02 || (nome && diferenca <= 0.25);
  });
}

const TIPOS_FREQUENTE = [
  { id: "gasolina", nome: "⛽ Gasolina", icone: "⛽", categoria: "transporte", varia: true, intervaloDias: 15 },
  { id: "divida", nome: "💸 Dívida / parcela", icone: "💸", categoria: "outros", varia: false, intervaloDias: 0 },
  { id: "outro", nome: "🔁 Outro", icone: "🔁", categoria: "outros", varia: true, intervaloDias: 0 },
] as const;

export function PainelLigar({
  linha: l,
  previstos,
  lancamentos,
  onLigar,
  onFechar,
}: {
  linha: LinhaExtrato;
  previstos: Previsto[];
  lancamentos: Lancamento[];
  onLigar: (ligacao: Ligacao) => void;
  onFechar: () => void;
}) {
  const [busca, setBusca] = useState("");
  const lista = candidatos(l, previstos, lancamentos, busca);
  return (
    <div className="mt-2 space-y-2 rounded-xl border border-roxo/40 bg-roxo/10 p-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">🔗 Qual destes é essa movimentação?</span>
        <button type="button" onClick={onFechar} className="text-suave hover:text-white">
          fechar
        </button>
      </div>
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="🔍 Buscar pelo nome"
        className="w-full rounded-lg bg-superficie px-2 py-1.5 text-xs"
      />
      {lista.length === 0 ? (
        <p className="text-suave">Nada parecido por aqui. Se for novo, deixe marcado para incluir.</p>
      ) : (
        <ul className="space-y-1">
          {lista.map((c) => (
            <li key={c.chave}>
              <button
                type="button"
                onClick={() => onLigar(c.ligacao)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 px-2 py-1.5 text-left hover:border-rosa"
              >
                <span className="min-w-0 truncate">
                  {c.nome}
                  <span className="block text-[0.65rem] text-suave">
                    {c.detalhe} · {formatarData(c.data)}
                  </span>
                </span>
                <span className="shrink-0 font-semibold">{brl(c.valor)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PainelFrequente({
  linha: l,
  onSalvar,
  onFechar,
}: {
  linha: LinhaExtrato;
  onSalvar: (f: Frequente) => void;
  onFechar: () => void;
}) {
  const sugerido = /posto|combust|gasolina|shell|ipiranga|petrobras/.test(semAcento(l.descricao)) ? "gasolina" : "divida";
  const [tipo, setTipo] = useState<(typeof TIPOS_FREQUENTE)[number]["id"]>(sugerido);
  const base = TIPOS_FREQUENTE.find((t) => t.id === tipo)!;
  const [nome, setNome] = useState(sugerido === "gasolina" ? "Gasolina" : l.descricao);
  const [aCadaDias, setACadaDias] = useState(sugerido === "gasolina");
  const [intervalo, setIntervalo] = useState(sugerido === "gasolina" ? "15" : "30");
  const [restantes, setRestantes] = useState("");

  function escolherTipo(id: (typeof TIPOS_FREQUENTE)[number]["id"]) {
    const t = TIPOS_FREQUENTE.find((x) => x.id === id)!;
    setTipo(id);
    setACadaDias(t.intervaloDias > 0);
    if (t.intervaloDias) setIntervalo(String(t.intervaloDias));
    if (id === "gasolina" && nome === l.descricao) setNome("Gasolina");
  }

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-roxo/40 bg-roxo/10 p-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">🔁 Gasto que se repete</span>
        <button type="button" onClick={onFechar} className="text-suave hover:text-white">
          fechar
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TIPOS_FREQUENTE.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => escolherTipo(t.id)}
            className={`rounded-full border px-2.5 py-1 ${tipo === t.id ? "border-rosa bg-rosa/20 text-white" : "border-white/15 text-suave"}`}
          >
            {t.nome}
          </button>
        ))}
      </div>
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        aria-label="Nome do gasto"
        placeholder="Nome (ex.: Empréstimo, Gasolina)"
        className="w-full rounded-lg bg-superficie px-2 py-1.5 text-xs"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setACadaDias(false)}
          className={`rounded-full border px-2.5 py-1 ${!aCadaDias ? "border-rosa bg-rosa/20 text-white" : "border-white/15 text-suave"}`}
        >
          Todo mês, dia {Number(l.data.slice(8))}
        </button>
        <button
          type="button"
          onClick={() => setACadaDias(true)}
          className={`rounded-full border px-2.5 py-1 ${aCadaDias ? "border-rosa bg-rosa/20 text-white" : "border-white/15 text-suave"}`}
        >
          A cada
        </button>
        {aCadaDias && (
          <>
            <input
              inputMode="numeric"
              value={intervalo}
              onChange={(e) => setIntervalo(e.target.value.replace(/\D/g, "").slice(0, 3))}
              aria-label="De quantos em quantos dias"
              className="w-12 rounded-lg bg-superficie px-2 py-1 text-center text-xs"
            />
            <span>dias</span>
          </>
        )}
      </div>
      {tipo === "divida" && (
        <label className="flex items-center gap-2">
          <span className="flex-1">Quantas parcelas faltam, contando esta? (vazio = sem fim)</span>
          <input
            inputMode="numeric"
            value={restantes}
            onChange={(e) => setRestantes(e.target.value.replace(/\D/g, "").slice(0, 3))}
            className="w-14 rounded-lg bg-superficie px-2 py-1 text-center text-xs"
          />
        </label>
      )}
      <p className="text-[0.65rem] text-suave">
        Esta movimentação vira o pagamento de agora. As próximas aparecem como previstas (e o valor
        {base.varia ? " pode mudar a cada vez" : " é sempre o mesmo"}).
      </p>
      <button
        type="button"
        disabled={!nome.trim() || (aCadaDias && !(Number(intervalo) > 0))}
        onClick={() =>
          onSalvar({
            nome: nome.trim(),
            icone: base.icone,
            categoria: base.categoria,
            varia: base.varia,
            intervaloDias: aCadaDias ? Number(intervalo) : 0,
            restantes: tipo === "divida" ? restantes : "",
          })
        }
        className="botao-gradiente w-full rounded-full py-1.5 font-semibold disabled:opacity-40"
      >
        Criar gasto frequente
      </button>
    </div>
  );
}
