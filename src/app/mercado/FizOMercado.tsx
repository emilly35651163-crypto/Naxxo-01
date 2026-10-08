"use client";

import { useState } from "react";
import { comprarItemDaLista, totalDoItemLista, type ItemLista } from "@/lib/store";
import { brl } from "@/lib/formato";
import { mostrarAviso } from "@/lib/avisos";
import Icone from "@/components/Icone";

// Fim da lista: "Fiz o mercado". Pergunta se faltou algo; o resto vai para o gasto de hoje e para "Em casa".
export default function FizOMercado({ lista, contaId }: { lista: ItemLista[]; contaId?: string }) {
  const [etapa, setEtapa] = useState<"botao" | "pergunta" | "faltou">("botao");
  const [faltaram, setFaltaram] = useState<string[]>([]);

  const comprados = lista.filter((l) => !faltaram.includes(l.id));
  const total = comprados.reduce((t, l) => t + totalDoItemLista(l), 0);
  const semPreco = comprados.filter((l) => !(totalDoItemLista(l) > 0)).length;

  function registrar() {
    for (const l of comprados) comprarItemDaLista(l.id, contaId);
    mostrarAviso({
      texto: `🛒 ${comprados.length} itens comprados · ${brl(total)} no gasto de hoje${faltaram.length ? ` · ${faltaram.length} ficaram na lista` : ""}`,
    });
    setEtapa("botao");
    setFaltaram([]);
  }

  if (etapa === "botao")
    return (
      <button onClick={() => setEtapa("pergunta")} className="botao-gradiente mt-5 w-full rounded-2xl py-3.5 font-semibold">
        <Icone e="🛒" /> Fiz o mercado: comprei tudo hoje
      </button>
    );

  return (
    <div className="mt-5 space-y-3 rounded-2xl border border-rosa/40 bg-rosa/5 p-4">
      {etapa === "pergunta" ? (
        <>
          <p className="text-center font-semibold">Faltou algum item?</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setEtapa("faltou")} className="rounded-full border border-white/15 py-2.5 text-sm">
              Sim, faltou
            </button>
            <button onClick={registrar} className="botao-gradiente rounded-full py-2.5 text-sm font-semibold">
              Não, comprei tudo
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="font-semibold">Marque o que não foi comprado:</p>
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {lista.map((l) => (
              <li key={l.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-white/5">
                  <input
                    type="checkbox"
                    checked={faltaram.includes(l.id)}
                    onChange={(e) => setFaltaram(e.target.checked ? [...faltaram, l.id] : faltaram.filter((x) => x !== l.id))}
                    className="size-5 accent-rosa"
                  />
                  <span className="min-w-0 flex-1">
                    <Icone e={l.icone} /> {l.nome}
                  </span>
                  <span className="text-xs tabular-nums text-suave">
                    {totalDoItemLista(l) > 0 ? brl(totalDoItemLista(l)) : ""}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button
            onClick={registrar}
            disabled={comprados.length === 0}
            className="botao-gradiente w-full rounded-full py-2.5 font-semibold disabled:opacity-40"
          >
            Registrar {comprados.length} {comprados.length === 1 ? "item" : "itens"} · {brl(total)}
          </button>
        </>
      )}
      {semPreco > 0 && (
        <p className="text-center text-xs text-amber-300">
          <Icone e="⚠️" /> {semPreco} {semPreco === 1 ? "item está" : "itens estão"} sem preço e entram com R$ 0.
        </p>
      )}
      <button onClick={() => setEtapa("botao")} className="w-full text-xs text-suave">
        cancelar
      </button>
    </div>
  );
}
