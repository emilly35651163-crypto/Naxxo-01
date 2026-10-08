"use client";

import { useState } from "react";
import { adicionarDesejo, removerDesejo, useDesejos, type Desejo } from "@/lib/store";
import { brl, lerValor } from "@/lib/formato";
import { avaliarDesejo } from "@/lib/desejos";
import { useDados } from "@/lib/dados";
import { comDesfazer } from "@/lib/avisos";
import { CampoValor } from "@/components/Campos";
import FormLancamento from "@/components/FormLancamento";
import Icone from "@/components/Icone";

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
                <Icone e={i.icone} /> {i.nome}
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

      {desejos.length > 0 ? (
        <ul className="cartao divide-y divide-white/5 px-4">
          {desejos.map((d) => {
            const v = avaliarDesejo(d.valor, dados);
            return (
              <li key={d.id} className="flex items-center gap-3 py-3">
                <span className="text-2xl" aria-hidden>
                  <Icone e={d.icone} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {d.nome} <span className="text-sm text-suave tabular-nums">· {brl(d.valor)}</span>
                  </span>
                  <span className={`block text-sm font-semibold ${COR[v.tipo]}`}>{v.titulo}</span>
                  <span className="block text-xs text-suave">{v.texto}</span>
                </span>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <button
                    onClick={() => setComprando(d)}
                    className="rounded-full bg-entrada/15 px-3 py-1 text-xs font-semibold text-entrada"
                  >
                    Comprei
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
