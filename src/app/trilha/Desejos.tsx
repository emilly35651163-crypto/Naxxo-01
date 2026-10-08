"use client";

import { useState } from "react";
import { adicionarDesejo, moverDesejo, removerDesejo, useDesejos, type Desejo } from "@/lib/store";
import { brl, lerValor } from "@/lib/formato";
import { avaliarDesejo } from "@/lib/desejos";
import { assumirGastoMensal, avaliarGastoMensal, planoDosDesejos } from "@/lib/cabe";
import { mesAtual, nomeMes } from "@/lib/formato";
import { useDados } from "@/lib/dados";
import { comDesfazer } from "@/lib/avisos";
import { CampoValor } from "@/components/Campos";
import FormLancamento from "@/components/FormLancamento";
import Icone, { TextoComIcones } from "@/components/Icone";

const IDEIAS = [
  { nome: "Perfume", icone: "🌸" },
  { nome: "Restaurante", icone: "🍝" },
  { nome: "Roupa", icone: "👗" },
  { nome: "Sapato", icone: "👟" },
  { nome: "Show", icone: "🎤" },
  { nome: "Presente", icone: "🎁" },
];

const COR = { agora: "text-entrada", credito: "text-azul", esperar: "text-amber-300", "nao-cabe": "text-saida" } as const;

// Desejos: coisinhas do dia a dia. Para cada uma, o app diz se é a hora, se dá no crédito ou até quando esperar.
export default function Desejos() {
  const desejos = useDesejos();
  const dados = useDados();
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [icone, setIcone] = useState("✨");
  const [valor, setValor] = useState("");
  const [comprando, setComprando] = useState<Desejo | null>(null);
  const plano = desejos.length > 1 ? planoDosDesejos(desejos, dados) : null;
  const mesCurto = (m: string) => (m === mesAtual() ? "este mês" : nomeMes(m).toLowerCase());

  /** Desejo mensal: cabe começar este mês? (a mesma conta do "Cabe no meu mês?") */
  function avaliarMensal(d: Desejo) {
    const a = avaliarGastoMensal(d.valor, mesAtual(), d.mensal?.vezes ?? null, dados);
    const mes = (m?: string) => (m ? nomeMes(m).split(" ")[0].toLowerCase() : "");
    if (a.veredito === "cabe")
      return {
        tipo: "agora" as const,
        titulo: "✅ Cabe começar agora",
        texto: "Mesmo com esse gasto todo mês, ainda sobra folga.",
      };
    if (a.veredito === "aperta")
      return {
        tipo: "esperar" as const,
        titulo: "⚠️ Cabe, mas aperta",
        texto: `Com folga, o ideal é até ${brl(a.cabeAte)} por mês.`,
      };
    if (a.veredito === "depois")
      return {
        tipo: "esperar" as const,
        titulo: `📅 A partir de ${mes(a.aPartirDe)}`,
        texto: "Este mês ainda falta; de lá em diante cabe.",
      };
    return {
      tipo: "nao-cabe" as const,
      titulo: "⛔ Ainda não cabe",
      texto: a.cabeAte > 0 ? `Hoje cabe até ${brl(a.cabeAte)} por mês.` : "Hoje não sobra para um gasto novo.",
    };
  }

  /** "Comecei": o desejo mensal vira gasto fixo a partir deste mês e sai da lista */
  function comecei(d: Desejo) {
    comDesfazer(`${d.nome} virou gasto fixo a partir de ${nomeMes(mesAtual()).split(" ")[0].toLowerCase()}`, () => {
      assumirGastoMensal({ nome: d.nome, icone: d.icone, valor: d.valor, inicio: mesAtual(), vezes: d.mensal?.vezes });
      removerDesejo(d.id);
    });
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !(lerValor(valor) > 0)) return;
    adicionarDesejo({ nome: nome.trim(), icone, valor: lerValor(valor) });
    setNome("");
    setValor("");
    setIcone("✨");
    setCriando(false);
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="titulo-secao mb-0">Desejos</h2>
        <button onClick={() => setCriando(!criando)} className="rounded-full border border-rosa/50 px-3 py-1.5 text-sm text-rosa">
          + Desejo
        </button>
      </div>

      {criando && (
        <form onSubmit={salvar} className="cartao mb-3 space-y-3 p-4">
          <div className="flex flex-wrap gap-2">
            {IDEIAS.map((i) => (
              <button
                key={i.nome}
                type="button"
                onClick={() => {
                  setNome(i.nome);
                  setIcone(i.icone);
                }}
                className={`rounded-full border px-3 py-1 text-sm ${nome === i.nome ? "border-rosa bg-rosa/15" : "border-white/10"}`}
              >
                <Icone e={i.icone} /> <TextoComIcones texto={i.nome} />
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="O que você quer?"
              className="campo min-w-0 flex-1"
            />
            <div className="w-36 shrink-0">
              <CampoValor valor={valor} onChange={setValor} rotulo="Quanto custa" />
            </div>
          </div>
          <button type="submit" className="botao-gradiente w-full rounded-full py-2.5 font-semibold">
            Adicionar desejo
          </button>
        </form>
      )}

      {plano && (
        <div className="cartao mb-3 space-y-3 p-4">
          <div>
            <h3 className="font-display font-bold">Plano dos desejos</h3>
            <p className="text-xs text-suave">
              Todos juntos, na ordem de prioridade (mude com as setinhas). A sobra de cada mês vai sendo usada e juntada, sempre
              com uma folga para imprevistos.
            </p>
          </div>
          <p className={`text-sm font-semibold ${plano.todosCabem ? "text-entrada" : "text-amber-300"}`}>
            {plano.todosCabem ? (
              <>
                <Icone e="✅" /> Dá para todos nos próximos 12 meses
              </>
            ) : (
              <>
                <Icone e="⚠️" /> Nem todos cabem nos próximos 12 meses
              </>
            )}
          </p>
          <ol className="space-y-2">
            {plano.linha.map((m) => (
              <li key={m.mes} className="flex gap-3 text-sm">
                <span className="w-24 shrink-0 font-semibold capitalize text-rosa">{mesCurto(m.mes)}</span>
                <span className="min-w-0 flex-1">
                  {m.itens.map((d) => (
                    <span key={d.id} className="block">
                      {d.mensal ? "começar" : "comprar"} <TextoComIcones texto={d.nome} />{" "}
                      <span className="text-suave tabular-nums">
                        ({brl(d.valor)}
                        {d.mensal && "/mês"})
                      </span>
                    </span>
                  ))}
                </span>
              </li>
            ))}
            {desejos
              .filter((d) => plano.quando[d.id] === null)
              .map((d) => (
                <li key={d.id} className="flex gap-3 text-sm">
                  <span className="w-24 shrink-0 font-semibold text-saida">não cabe</span>
                  <span className="min-w-0 flex-1 text-suave">
                    <TextoComIcones texto={d.nome} /> ({brl(d.valor)}
                    {d.mensal && "/mês"}): um preço menor ou subir na prioridade pode ajudar.
                  </span>
                </li>
              ))}
          </ol>
        </div>
      )}

      {desejos.length > 0 ? (
        <ul className="cartao divide-y divide-white/5 px-4">
          {desejos.map((d, i) => {
            const v = d.mensal ? avaliarMensal(d) : avaliarDesejo(d.valor, dados);
            return (
              <li key={d.id} className="flex items-center gap-3 py-3">
                {desejos.length > 1 && (
                  <div className="flex shrink-0 flex-col items-center text-suave">
                    <button
                      onClick={() => moverDesejo(d.id, -1)}
                      disabled={i === 0}
                      aria-label={`Subir ${d.nome} na prioridade`}
                      className="px-1 leading-none hover:text-rosa disabled:opacity-20"
                    >
                      ▲
                    </button>
                    <span className="text-[0.65rem] font-semibold tabular-nums">{i + 1}º</span>
                    <button
                      onClick={() => moverDesejo(d.id, 1)}
                      disabled={i === desejos.length - 1}
                      aria-label={`Descer ${d.nome} na prioridade`}
                      className="px-1 leading-none hover:text-rosa disabled:opacity-20"
                    >
                      ▼
                    </button>
                  </div>
                )}
                <span className="text-2xl" aria-hidden>
                  <Icone e={d.icone} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    <TextoComIcones texto={d.nome} />{" "}
                    <span className="text-sm text-suave tabular-nums">
                      · {brl(d.valor)}
                      {d.mensal && "/mês"}
                    </span>
                  </span>
                  <span className={`block text-sm font-semibold ${COR[v.tipo]}`}>
                    <TextoComIcones texto={v.titulo} />
                  </span>
                  <span className="block text-xs text-suave">
                    <TextoComIcones texto={v.texto} />
                  </span>
                  {plano && (
                    <span className="mt-0.5 block text-xs text-rosa">
                      No plano com os outros: {plano.quando[d.id] ? mesCurto(plano.quando[d.id]!) : "não cabe em 12 meses"}
                    </span>
                  )}
                </span>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <button
                    onClick={() => (d.mensal ? comecei(d) : setComprando(d))}
                    className="rounded-full bg-entrada/15 px-3 py-1 text-xs font-semibold text-entrada"
                  >
                    {d.mensal ? "Comecei" : "Comprei"}
                  </button>
                  <button
                    onClick={() => comDesfazer(`${d.nome} removido`, () => removerDesejo(d.id))}
                    className="text-xs text-suave hover:text-saida"
                  >
                    remover
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        !criando && (
          <p className="cartao p-4 text-sm text-suave">Um perfume, um restaurante, uma roupa… o app diz quando é uma boa hora.</p>
        )
      )}

      {comprando && (
        <FormLancamento
          inicial={{ descricao: comprando.nome, valor: comprando.valor, categoria: "Compras" }}
          onSalvo={() => removerDesejo(comprando.id)}
          onFechar={() => setComprando(null)}
        />
      )}
    </section>
  );
}
