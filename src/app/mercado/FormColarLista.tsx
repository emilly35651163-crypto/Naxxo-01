"use client";

import { useState } from "react";
import {
  adicionarNaDespensa,
  adicionarNaLista,
  CATEGORIAS_MERCADO,
  comprarItemDaLista,
  lerListaDeCompras,
  mudarPreferencias,
  semAcento,
  useCartoes,
  usePreferencias,
} from "@/lib/store";
import { brl, hojeISO, valorParaCampo } from "@/lib/formato";
import { lerListaColada } from "@/lib/mercado";
import { mostrarAviso } from "@/lib/avisos";
import Modal from "@/components/Modal";
import Icone from "@/components/Icone";

// Colar uma lista (ou a nota do mercado) de uma vez: "5kg Arroz 24,99", "4 Sabonete de 5,88"…
// Com `emCasa`: é o que a pessoa já tem em casa (vai direto para "Em casa", sem lista e sem gasto).
export default function FormColarLista({ onFechar, emCasa = false }: { onFechar: () => void; emCasa?: boolean }) {
  const contas = useCartoes();
  const prefs = usePreferencias();
  const [texto, setTexto] = useState("");
  const [comprei, setComprei] = useState(false); // começa em "Só na lista": colar costuma ser para montar a lista
  const [contaId, setContaId] = useState(contas.find((c) => c.id === prefs.ultimaConta)?.id ?? contas[0]?.id ?? "");
  const itens = lerListaColada(texto);
  // Itens que aparecem duas vezes no texto (pode ter sido sem querer)
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.trim().toLowerCase())
    .filter(Boolean);
  const repetidas = [...new Set(linhas.filter((l, i) => linhas.indexOf(l) !== i))];
  const total = itens.reduce((t, i) => t + i.total, 0);

  function salvar() {
    if (itens.length === 0) return;
    if (emCasa) {
      for (const i of itens)
        adicionarNaDespensa({
          nome: i.nome,
          icone: CATEGORIAS_MERCADO.find((c) => c.id === i.categoria)!.icone,
          categoria: i.categoria,
          quantidade: `${i.qtd} ${i.unidadeQtd}`,
          valor: Math.round(i.total * 100) / 100,
          // Quanto dura ainda não se sabe: o app descobre quando acabar ("Acabou hoje")
          duracao: null,
          unidade: "meses",
          ultimaCompra: hojeISO(),
          repor: true,
        });
      mostrarAviso({ texto: `${itens.length} itens em casa 🏠` });
      return onFechar();
    }
    for (const i of itens) {
      adicionarNaLista({
        nome: i.nome,
        icone: CATEGORIAS_MERCADO.find((c) => c.id === i.categoria)!.icone,
        categoria: i.categoria,
        qtd: i.qtd,
        unidadeQtd: i.unidadeQtd,
        valor: valorParaCampo(Math.round(i.precoUnidade * 100) / 100),
      });
    }
    if (comprei) {
      if (contaId) mudarPreferencias({ ultimaConta: contaId });
      const nomes = new Set(itens.map((i) => semAcento(i.nome)));
      for (const l of lerListaDeCompras().filter((x) => nomes.has(semAcento(x.nome))))
        comprarItemDaLista(l.id, contaId || undefined, hojeISO());
    }
    mostrarAviso({
      texto: comprei ? `${itens.length} itens comprados · ${brl(total)} no gasto de hoje` : `${itens.length} itens na lista ✓`,
    });
    onFechar();
  }

  return (
    <Modal titulo={emCasa ? "Colar o que já tem em casa" : "Colar uma lista"} onFechar={onFechar}>
      <div className="space-y-4">
        <textarea
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={7}
          placeholder={"Um item por linha (o preço no fim é opcional):\n5kg Arroz 24,99\n4 Sabonete 23,52\n2 Pão\nAlface"}
          className="campo resize-y"
        />

        {itens.length > 0 && (
          <>
            <p className="text-xs text-suave">
              Confira a conta de cada item: “6,88” sozinho é o total; “6,88 cada” ou “de 6,88” é o preço de cada um.
            </p>
            {repetidas.length > 0 && (
              <p className="rounded-2xl border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-xs">
                ⚠️ Aparece duas vezes: <b>{repetidas.join(", ")}</b>. Se foi sem querer, apague uma das linhas.
              </p>
            )}
            <ul className="max-h-56 divide-y divide-white/5 overflow-y-auto rounded-2xl bg-fundo/50 px-3 text-sm">
              {itens.map((i) => (
                <li key={i.nome} className="flex items-center gap-2 py-1.5">
                  <span aria-hidden>
                    <Icone e={CATEGORIAS_MERCADO.find((c) => c.id === i.categoria)?.icone} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {i.nome}{" "}
                    <span className="text-xs text-suave">
                      {i.qtd} {i.unidadeQtd}
                      {i.total > 0 && ` × ${brl(i.precoUnidade)}`}
                    </span>
                  </span>
                  <span className="tabular-nums">
                    {i.total > 0 ? brl(i.total) : <span className="text-xs text-suave">sem preço</span>}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-right text-sm">
              {itens.length} itens · <b className="tabular-nums">{brl(total)}</b>
            </p>

            {emCasa ? (
              <p className="rounded-2xl bg-roxo/10 px-3 py-2 text-xs text-suave">
                🏠 Vão direto para “Em casa” (não entram na lista nem no gasto). Quando acabar, toque em “Acabou hoje”.
              </p>
            ) : (
              <div
                className="grid grid-cols-2 gap-1 rounded-full bg-fundo p-1 text-sm"
                role="radiogroup"
                aria-label="O que fazer"
              >
                {[true, false].map((v) => (
                  <button
                    key={String(v)}
                    role="radio"
                    aria-checked={comprei === v}
                    onClick={() => setComprei(v)}
                    className={`rounded-full py-2 ${comprei === v ? "bg-white font-semibold text-fundo" : "text-suave"}`}
                  >
                    {v ? "✓ Já comprei hoje" : "Só na lista"}
                  </button>
                ))}
              </div>
            )}
            {!emCasa && comprei && contas.length > 0 && (
              <label className="flex items-center gap-2 text-sm text-suave">
                Pago com
                <select value={contaId} onChange={(e) => setContaId(e.target.value)} className="campo w-auto cursor-pointer py-2">
                  {contas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}

        <button
          onClick={salvar}
          disabled={itens.length === 0}
          className="botao-gradiente w-full rounded-full py-3 font-semibold disabled:opacity-40"
        >
          {itens.length === 0
            ? "Cole os itens acima"
            : emCasa
              ? `Pôr ${itens.length} itens em casa`
              : comprei
                ? `Registrar compra de ${brl(total)}`
                : `Pôr ${itens.length} itens na lista`}
        </button>
      </div>
    </Modal>
  );
}
