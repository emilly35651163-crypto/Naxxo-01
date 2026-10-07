"use client";

import { useState } from "react";
import {
  acabouHoje,
  CATEGORIAS_MERCADO,
  comprarItemDaLista,
  mudarPreferencias,
  removerDaLista,
  totalDoItemLista,
  atualizarItemLista,
  useCartoes,
  useComprasMercado,
  useItensMercado,
  useListaCompras,
  useMes,
  usePreferencias,
  type ItemLista,
} from "@/lib/store";
import { brl, nomeMes, soNumeros } from "@/lib/formato";
import { DURACOES, previsaoDoMes, situacaoDoItem } from "@/lib/mercado";
import { comDesfazer, mostrarAviso } from "@/lib/avisos";
import FormItemLista from "./FormItemLista";

export default function Mercado() {
  const lista = useListaCompras();
  const despensa = useItensMercado();
  const compras = useComprasMercado();
  const contas = useCartoes();
  const prefs = usePreferencias();
  const mes = useMes();
  const [adicionando, setAdicionando] = useState(false);
  const [editando, setEditando] = useState<ItemLista | null>(null);
  const [listaAberta, setListaAberta] = useState(true);

  // De qual conta sai quando aperta "comprei" (a última usada)
  const contaId = contas.find((c) => c.id === prefs.ultimaConta)?.id ?? contas[0]?.id;

  const gastoNoMes = compras.filter((c) => c.data.startsWith(mes)).reduce((t, c) => t + c.total, 0);
  const previsto = previsaoDoMes(despensa, mes).total;
  const totalLista = lista.reduce((t, l) => t + totalDoItemLista(l), 0);

  // Pós-compra: o que está em casa, do que acaba primeiro para o que acaba depois
  const emCasa = despensa
    .map((item) => ({ item, s: situacaoDoItem(item) }))
    .filter(({ item }) => !lista.some((l) => l.nome.trim().toLowerCase() === item.nome.trim().toLowerCase()))
    .sort((a, b) => (a.s.faltam ?? 9999) - (b.s.faltam ?? 9999));

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-3 gap-2 sm:gap-3">
        <Numero rotulo={`Gasto em ${nomeMes(mes).split(" ")[0].toLowerCase()}`} valor={brl(gastoNoMes)} destaque />
        <Numero rotulo="Repor este mês" valor={brl(previsto)} />
        <Numero rotulo="Na lista" valor={`${lista.length} ${lista.length === 1 ? "item" : "itens"}`} />
      </section>

      <button onClick={() => setAdicionando(true)} className="botao-gradiente w-full rounded-2xl py-4 text-base font-semibold">
        + Adicionar à lista de compras
      </button>

      {/* Lista de compras, por categoria */}
      {lista.length > 0 && (
        <section className="cartao p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display font-semibold">
              🛒 Lista de compras {totalLista > 0 && <span className="text-sm font-normal text-suave">≈ {brl(totalLista)}</span>}
            </h2>
            <button onClick={() => setListaAberta(!listaAberta)} className="text-sm text-rosa">
              {listaAberta ? "Mostrar menos" : "Mostrar"}
            </button>
          </div>

          {listaAberta && (
            <>
              {contas.length > 1 && (
                <label className="mt-3 flex items-center gap-2 text-xs text-suave">
                  Ao marcar como comprado, sai de
                  <select
                    value={contaId}
                    onChange={(e) => mudarPreferencias({ ultimaConta: e.target.value })}
                    className="rounded-full border border-white/10 bg-fundo px-2 py-1 text-white"
                  >
                    {contas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {CATEGORIAS_MERCADO.map((cat) => {
                const itens = lista.filter((l) => l.categoria === cat.id);
                if (itens.length === 0) return null;
                return (
                  <div key={cat.id} className="mt-4">
                    <p className="titulo-secao">
                      {cat.icone} {cat.nome}
                    </p>
                    <ul className="space-y-2">
                      {itens.map((l) => (
                        <LinhaLista key={l.id} item={l} onEditar={() => setEditando(l)} contaId={contaId} />
                      ))}
                    </ul>
                  </div>
                );
              })}
            </>
          )}
        </section>
      )}

      {/* Pós-compra: o que tem em casa e quando acaba */}
      {emCasa.length > 0 && (
        <section className="cartao p-4">
          <h2 className="mb-3 font-display font-semibold">🏠 Em casa</h2>
          <ul className="divide-y divide-white/5">
            {emCasa.map(({ item, s }) => (
              <li key={item.id} className="flex items-center gap-3 py-2.5">
                <span className="text-xl" aria-hidden>
                  {CATEGORIAS_MERCADO.find((c) => c.id === item.categoria)?.icone ?? item.icone}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{item.nome}</span>
                  <span
                    className={`block text-xs ${s.faltam !== null && s.faltam < 0 ? "text-saida" : s.faltam !== null && s.faltam <= 3 ? "text-amber-300" : "text-suave"}`}
                  >
                    {s.faltam === null
                      ? "sem previsão de acabar"
                      : s.faltam < 0
                        ? "já deve ter acabado"
                        : s.faltam === 0
                          ? "acaba hoje"
                          : `acaba em ${s.faltam} ${s.faltam === 1 ? "dia" : "dias"}`}
                  </span>
                </span>
                <button
                  onClick={() => {
                    acabouHoje(item.id);
                    mostrarAviso({ texto: `${item.nome} voltou para a lista 🛒` });
                  }}
                  className="shrink-0 rounded-full border border-rosa/50 px-3 py-1.5 text-xs text-rosa"
                >
                  Acabou hoje
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {lista.length === 0 && emCasa.length === 0 && (
        <p className="cartao p-5 text-center text-sm text-suave">Comece adicionando o que você costuma comprar. 🛒</p>
      )}

      {(adicionando || editando) && (
        <FormItemLista
          inicial={editando ?? undefined}
          onFechar={() => {
            setAdicionando(false);
            setEditando(null);
          }}
        />
      )}
    </div>
  );
}

function Numero({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="cartao p-3 sm:p-4">
      <p className="text-[0.7rem] text-suave sm:text-xs">{rotulo}</p>
      <p className={`mt-0.5 font-display text-base font-bold tabular-nums sm:text-xl ${destaque ? "gradiente-texto" : ""}`}>
        {valor}
      </p>
    </div>
  );
}

/** Um item da lista: preço e duração para preencher, ✓ comprado e ×. */
function LinhaLista({ item: l, onEditar, contaId }: { item: ItemLista; onEditar: () => void; contaId?: string }) {
  const duracaoAtual = DURACOES.find((d) => d.duracao === l.duracao && d.unidade === l.unidadeDuracao)?.rotulo ?? "";
  return (
    <li className="rounded-2xl bg-fundo/50 p-3">
      <div className="flex items-center gap-2">
        <button onClick={onEditar} className="min-w-0 flex-1 text-left">
          <span className="block truncate font-medium">{l.nome}</span>
          {l.qtd && (
            <span className="text-xs text-suave">
              {l.qtd} {l.unidadeQtd ?? "un"}
              {totalDoItemLista(l) > 0 && ` · ${brl(totalDoItemLista(l))}`}
            </span>
          )}
        </button>
        <button
          onClick={() => {
            comprarItemDaLista(l.id, contaId);
            mostrarAviso({
              texto: `✓ ${l.nome} comprado${totalDoItemLista(l) > 0 ? ` · ${brl(totalDoItemLista(l))} no gasto de hoje` : ""}`,
            });
          }}
          aria-label={`Marcar ${l.nome} como comprado`}
          className="shrink-0 rounded-full bg-entrada/15 px-3 py-1.5 text-sm font-semibold text-entrada"
        >
          ✓ Comprei
        </button>
        <button
          onClick={() => comDesfazer(`${l.nome} saiu da lista`, () => removerDaLista(l.id))}
          aria-label={`Tirar ${l.nome} da lista`}
          className="shrink-0 px-1 text-xl text-suave hover:text-saida"
        >
          ×
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="campo flex items-center gap-1 py-2">
          <span className="text-xs text-suave">R$</span>
          <input
            inputMode="decimal"
            value={l.valor ?? ""}
            onChange={(e) => atualizarItemLista(l.id, { valor: soNumeros(e.target.value) })}
            placeholder={`preço/${l.unidadeQtd ?? "un"}`}
            aria-label={`Preço de ${l.nome}`}
            className="w-full min-w-0 bg-transparent outline-none"
          />
        </label>
        <select
          value={duracaoAtual}
          onChange={(e) => {
            const d = DURACOES.find((x) => x.rotulo === e.target.value);
            atualizarItemLista(l.id, { duracao: d?.duracao, unidadeDuracao: d?.unidade });
          }}
          aria-label={`Quanto dura ${l.nome}`}
          className="campo cursor-pointer py-2"
        >
          <option value="">{l.duracao ? `dura ${l.duracao} ${l.unidadeDuracao}` : "dura quanto?"}</option>
          {DURACOES.map((d) => (
            <option key={d.rotulo} value={d.rotulo}>
              dura {d.rotulo}
            </option>
          ))}
        </select>
      </div>
    </li>
  );
}
