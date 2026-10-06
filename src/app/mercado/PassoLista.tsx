"use client";

import { useState } from "react";
import {
  adicionarNaLista,
  atualizarItemLista,
  planejarCompra,
  removerDaLista,
  useCompraPlanejada,
  useComprasMercado,
  useItensMercado,
  useListaCompras,
} from "@/lib/store";
import { brl, dataDoRecebimento, formatarData, hojeISO, mesAtual } from "@/lib/formato";
import { datasDeReposicao, situacaoDoItem } from "@/lib/mercado";
import { totalDaLista } from "@/lib/previstos";
import BuscaProdutos from "@/components/BuscaProdutos";
import { CampoValor } from "@/components/Campos";
import FormNaDespensa from "./FormNaDespensa";

// Passo 1: montar a lista. Só o nome; o preço estimado já vem do último que você pagou (dá para mudar).
// Com o dia marcado, a lista entra como gasto previsto nesse dia.
export default function PassoLista({ onIrAoMercado }: { onIrAoMercado: () => void }) {
  const lista = useListaCompras();
  const itens = useItensMercado();
  const compras = useComprasMercado();
  const { data: dataPlanejada } = useCompraPlanejada();
  const [naDespensa, setNaDespensa] = useState(false);

  const naLista = (nome: string) => lista.some((l) => l.nome.trim().toLowerCase() === nome.trim().toLowerCase());
  const ultimoPreco = (nome: string) => itens.find((i) => i.nome.trim().toLowerCase() === nome.trim().toLowerCase())?.valor;

  // Sugestões: o que acabou ou acaba em até 7 dias e ainda não está na lista
  const acabando = itens
    .map((item) => ({ item, s: situacaoDoItem(item) }))
    .filter(({ item, s }) => item.repor && s.faltam !== null && s.faltam <= 7 && !naLista(item.nome))
    .sort((a, b) => (a.s.faltam ?? 0) - (b.s.faltam ?? 0));

  // Lista automática: tudo o que deve acabar até o dia da compra (ou até o fim do mês)
  const ate = dataPlanejada ?? dataDoRecebimento("31", mesAtual());
  const vaoAcabar = itens.filter((i) => !naLista(i.nome) && datasDeReposicao(i, ate).length > 0);
  const jaComprouEsteMes = compras.some((c) => c.data.startsWith(mesAtual()));

  const total = totalDaLista(lista, itens);

  return (
    <div className="space-y-4">
      <p className="text-sm text-suave">
        Monte a lista: só o nome. O preço estimado vem do último que você pagou e dá para mudar. Com o dia marcado, a lista já
        entra como gasto previsto.
      </p>

      {/* Quando vai ao mercado */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-fundo/50 p-3">
        <span className="text-sm">🗓️ Vou ao mercado em</span>
        <input
          type="date"
          value={dataPlanejada ?? ""}
          min={hojeISO()}
          onChange={(e) => planejarCompra(e.target.value || null)}
          className="campo w-auto py-1.5"
        />
        {dataPlanejada && (
          <button onClick={() => planejarCompra(null)} className="text-xs text-suave hover:text-saida">
            tirar data
          </button>
        )}
        {dataPlanejada && lista.length > 0 && (
          <span className="text-xs text-entrada">entra como previsto em {formatarData(dataPlanejada)}</span>
        )}
      </div>

      <BuscaProdutos
        placeholder="O que precisa comprar?"
        jaEscolhidos={lista.map((l) => l.nome)}
        onEscolher={(o) => adicionarNaLista({ nome: o.nome, icone: o.icone, categoria: o.categoria })}
      />

      <div className="flex flex-wrap gap-2">
        {vaoAcabar.length > 0 && (
          <button
            onClick={() => vaoAcabar.forEach((i) => adicionarNaLista({ nome: i.nome, icone: i.icone, categoria: i.categoria }))}
            className="rounded-full border border-rosa/50 px-3 py-1.5 text-sm text-rosa hover:bg-rosa/10"
          >
            ✨ Montar lista com o que vai acabar até {formatarData(ate)} ({vaoAcabar.length})
          </button>
        )}
        <button
          onClick={() => setNaDespensa(true)}
          className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-suave hover:text-white"
        >
          + Já tenho em casa
        </button>
      </div>
      {!jaComprouEsteMes && vaoAcabar.length === 0 && itens.length === 0 && (
        <p className="text-xs text-suave">
          💡 Depois da primeira compra, o app passa a montar a lista sozinho com o que vai acabar.
        </p>
      )}

      {acabando.length > 0 && (
        <div className="rounded-2xl border border-amber-300/30 bg-amber-300/5 p-3">
          <p className="mb-2 text-xs text-amber-300">Está acabando em casa. Pôr na lista?</p>
          <div className="flex flex-wrap gap-2">
            {acabando.map(({ item, s }) => (
              <button
                key={item.id}
                onClick={() => adicionarNaLista({ nome: item.nome, icone: item.icone, categoria: item.categoria })}
                className="rounded-full border border-amber-300/40 px-3 py-1.5 text-sm hover:bg-amber-300/10"
              >
                + {item.icone} {item.nome}{" "}
                <span className="text-xs text-suave">
                  {(s.faltam ?? 0) < 0 ? "acabou" : s.faltam === 0 ? "hoje" : `${s.faltam}d`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {lista.length > 0 ? (
        <>
          <ul className="divide-y divide-white/5">
            {lista.map((l) => {
              const ultimo = ultimoPreco(l.nome);
              return (
                <li key={l.id} className="flex items-center gap-3 py-2">
                  <span className="text-lg">{l.icone}</span>
                  <span className="min-w-0 flex-1 truncate">{l.nome}</span>
                  <div className="w-32 shrink-0">
                    <CampoValor
                      valor={l.valor ?? ""}
                      onChange={(valor) => atualizarItemLista(l.id, { valor })}
                      placeholder={ultimo ? String(ultimo).replace(".", ",") : "preço?"}
                    />
                  </div>
                  <button
                    onClick={() => removerDaLista(l.id)}
                    aria-label={`Tirar ${l.nome} da lista`}
                    className="px-1 text-lg text-suave hover:text-saida"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex items-baseline justify-between rounded-2xl bg-fundo/50 px-4 py-3">
            <span className="text-sm text-suave">
              {lista.length} {lista.length === 1 ? "item" : "itens"} · estimativa
            </span>
            <span className="gradiente-texto font-display text-xl font-bold tabular-nums">≈ {brl(total)}</span>
          </div>
          <button onClick={onIrAoMercado} className="botao-gradiente w-full rounded-full py-3 font-semibold">
            Estou no mercado →
          </button>
        </>
      ) : (
        <p className="rounded-2xl bg-fundo/50 p-4 text-center text-sm text-suave">
          A lista está vazia. Busque acima para adicionar.
        </p>
      )}

      {naDespensa && <FormNaDespensa onFechar={() => setNaDespensa(false)} />}
    </div>
  );
}
