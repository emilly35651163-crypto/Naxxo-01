"use client";

import { useState } from "react";
import {
  acabouHoje,
  CATEGORIAS_MERCADO,
  comprarItemDaLista,
  mudarPreferencias,
  excluirItemDeTudo,
  totalDoItemLista,
  atualizarItemLista,
  useCartoes,
  excluirDaDespensa,
  removerCompra,
  removerLancamento,
  useItensMercado,
  useListaCompras,
  useMes,
  usePreferencias,
  type ItemLista,
} from "@/lib/store";
import { brl, formatarData, nomeMes } from "@/lib/formato";
import { DURACOES, previsaoDoMes, situacaoDoItem } from "@/lib/mercado";
import { comDesfazer, mostrarAviso } from "@/lib/avisos";
import FormItemLista from "./FormItemLista";
import FormColarLista from "./FormColarLista";
import { gastosDoMes } from "@/lib/analise";
import { useDados } from "@/lib/dados";
import CamposPreco from "./CamposPreco";

export default function Mercado() {
  const lista = useListaCompras();
  const despensa = useItensMercado();
  const dados = useDados();
  const contas = useCartoes();
  const prefs = usePreferencias();
  const mes = useMes();
  const [adicionando, setAdicionando] = useState(false);
  const [colando, setColando] = useState(false);
  const [editando, setEditando] = useState<ItemLista | null>(null);
  const [listaAberta, setListaAberta] = useState(true);

  // De qual conta sai quando aperta "comprei" (a última usada)
  const contaId = contas.find((c) => c.id === prefs.ultimaConta)?.id ?? contas[0]?.id;

  // Gasto do mês: o que está nos lançamentos e no cartão (o mesmo número do Resumo, já sem o que foi excluído)
  const gastosMercado = gastosDoMes(mes, dados).filter((g) => g.categoria === "Mercado" && !g.previsto);
  const gastoNoMes = gastosMercado.reduce((t, g) => t + g.valor, 0);
  const [verGastos, setVerGastos] = useState(false);
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
        <button onClick={() => setVerGastos(!verGastos)} aria-expanded={verGastos} className="text-left">
          <Numero
            rotulo={`Gasto em ${nomeMes(mes).split(" ")[0].toLowerCase()} ${verGastos ? "▴" : "▾"}`}
            valor={brl(gastoNoMes)}
            destaque
          />
        </button>
        <Numero rotulo="Repor este mês" valor={brl(previsto)} />
        <Numero rotulo="Na lista" valor={`${lista.length} ${lista.length === 1 ? "item" : "itens"}`} />
      </section>

      {/* As compras do mês (tocando no gasto): dá para excluir uma compra feita por engano */}
      {verGastos && (
        <section className="cartao p-4">
          <h2 className="mb-2 font-display font-semibold">Compras de {nomeMes(mes).split(" ")[0].toLowerCase()}</h2>
          {gastosMercado.length > 0 ? (
            <ul className="divide-y divide-white/5 text-sm">
              {gastosMercado.map((g) => (
                <li key={g.chave} className="flex items-center gap-2 py-2">
                  <span className="min-w-0 flex-1 truncate">
                    {g.descricao}{" "}
                    <span className="text-xs text-suave">
                      · {formatarData(g.data)} · {g.onde}
                    </span>
                  </span>
                  <span className="tabular-nums">{brl(g.valor)}</span>
                  {(g.lancamento || g.compra) && (
                    <button
                      onClick={() =>
                        comDesfazer(`Compra de ${brl(g.valor)} excluída`, () =>
                          g.lancamento ? removerLancamento(g.lancamento.id) : removerCompra(g.compra!.id),
                        )
                      }
                      className="text-xs text-suave hover:text-saida"
                    >
                      excluir
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-suave">Nenhuma compra no mercado este mês.</p>
          )}
        </section>
      )}

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button onClick={() => setAdicionando(true)} className="botao-gradiente rounded-2xl py-4 text-base font-semibold">
          + Adicionar à lista
        </button>
        <button
          onClick={() => setColando(true)}
          className="rounded-2xl border border-rosa/50 px-4 text-sm font-semibold text-rosa"
        >
          📋 Colar lista
        </button>
      </div>

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
                <ExcluirDeCasa
                  nome={item.nome}
                  onExcluir={() => comDesfazer(`${item.nome} excluído`, () => excluirDaDespensa(item.id))}
                />
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

      {colando && <FormColarLista onFechar={() => setColando(false)} />}
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
  const [excluindo, setExcluindo] = useState(false);
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
          onClick={() => setExcluindo(true)}
          aria-label={`Tirar ${l.nome} da lista`}
          className="shrink-0 px-1 text-xl text-suave hover:text-saida"
        >
          ×
        </button>
      </div>
      <div className="mt-2">
        <CamposPreco
          valor={l.valor ?? ""}
          qtd={l.qtd ?? ""}
          unidade={l.unidadeQtd ?? "un"}
          compacto
          onChange={(m) => atualizarItemLista(l.id, m)}
        />
      </div>
      <div className="mt-2">
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
      {/* Excluir pede confirmação e tira o item de tudo (lista e "em casa") */}
      {excluindo && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-saida/10 p-2 text-xs">
          <span className="min-w-0 flex-1">Excluir {l.nome} da lista e de “em casa”?</span>
          <button onClick={() => setExcluindo(false)} className="rounded-full px-3 py-1 text-suave">
            Cancelar
          </button>
          <button
            onClick={() => comDesfazer(`${l.nome} excluído`, () => excluirItemDeTudo(l.id))}
            className="rounded-full bg-saida px-3 py-1 font-semibold text-fundo"
          >
            Excluir
          </button>
        </div>
      )}
    </li>
  );
}

/** × de "Em casa": confirma e exclui de vez (a compra também é desfeita). */
function ExcluirDeCasa({ nome, onExcluir }: { nome: string; onExcluir: () => void }) {
  const [confirmando, setConfirmando] = useState(false);
  if (!confirmando)
    return (
      <button
        onClick={() => setConfirmando(true)}
        aria-label={`Excluir ${nome}`}
        className="shrink-0 px-1 text-xl text-suave hover:text-saida"
      >
        ×
      </button>
    );
  return (
    <span className="flex shrink-0 items-center gap-1 text-xs">
      <button onClick={() => setConfirmando(false)} className="rounded-full px-2 py-1 text-suave">
        não
      </button>
      <button onClick={onExcluir} className="rounded-full bg-saida px-2 py-1 font-semibold text-fundo">
        excluir de tudo
      </button>
    </span>
  );
}
