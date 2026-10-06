"use client";

import { useState } from "react";
import {
  CATEGORIAS_MERCADO,
  doMes,
  somar,
  useCartoes,
  useCompras,
  useComprasMercado,
  useItensMercado,
  useLancamentos,
  useListaCompras,
  useMes,
  type ItemMercado,
} from "@/lib/store";
import { brl, formatarData, hojeISO, mesAtual, nomeMes, nomeMesCurto, somarMeses } from "@/lib/formato";
import { descreverDuracao, previsaoDoMes, situacaoDoItem, type EstadoItem } from "@/lib/mercado";
import FormItemMercado from "@/components/FormItemMercado";
import FormAcabou from "@/components/FormAcabou";
import EstadoVazio from "@/components/EstadoVazio";
import PassoLista from "./PassoLista";
import PassoMercado from "./PassoMercado";
import PassoDepois from "./PassoDepois";

const COR_ESTADO: Record<EstadoItem, { barra: string; texto: string }> = {
  acabou: { barra: "bg-saida", texto: "text-saida" },
  acabando: { barra: "bg-saida", texto: "text-saida" },
  semana: { barra: "bg-amber-300", texto: "text-amber-300" },
  ok: { barra: "bg-linear-to-r from-roxo to-rosa", texto: "text-suave" },
  "sem-prazo": { barra: "bg-white/20", texto: "text-suave" },
  programado: { barra: "bg-azul/40", texto: "text-azul" },
};

type Passo = 1 | 2 | 3;

export default function Mercado() {
  const itens = useItensMercado();
  const compras = useComprasMercado();
  const lista = useListaCompras();
  const lancamentos = useLancamentos();
  const comprasCartao = useCompras();
  const cartoes = useCartoes();
  const mes = useMes();
  // Começa no passo que faz sentido: no meio de uma compra → 2; senão → 1
  const [passo, setPasso] = useState<Passo>(() => (lista.some((l) => l.noCarrinho) ? 2 : 1));
  const [editando, setEditando] = useState<ItemMercado | null>(null);
  const [acabouItem, setAcabouItem] = useState<ItemMercado | null>(null);

  // Gasto do mês no mercado: lançamentos da categoria + compras de mercado no cartão
  const gastoNoMes =
    somar(doMes(lancamentos, mes).filter((l) => l.tipo === "saida" && l.categoria === "Mercado")) +
    somar(
      comprasCartao
        .filter((c) => c.categoria === "Mercado" && c.data.startsWith(mes) && cartoes.some((k) => k.id === c.cartaoId))
        .map((c) => ({ valor: c.valorTotal })),
    );
  const previsao = previsaoDoMes(itens, mes);
  const comSituacao = itens.map((item) => ({ item, s: situacaoDoItem(item) }));
  const pendentesDeDuracao = itens.filter(
    (i) => i.ultimaCompra <= hojeISO() && (i.duracao === null || i.origemDuracao === "calculada"),
  ).length;

  // Compra do mês: todas as compras marcadas como "compra do mês" no mês escolhido, juntas
  const comprasDoMes = compras.filter((c) => c.tipo === "mes" && c.data.startsWith(mes));
  const itensCompraDoMes = comprasDoMes.flatMap((c) => c.itens.map((i) => ({ ...i, data: c.data })));
  const totalCompraDoMes = somar(comprasDoMes.map((c) => ({ valor: c.total })));
  const avulsasDoMes = compras.filter((c) => c.tipo !== "mes" && c.data.startsWith(mes));

  // Previsão dos próximos 6 meses
  const proximosMeses = Array.from({ length: 6 }, (_, i) => {
    const m = somarMeses(mesAtual(), i);
    return { mes: m, total: previsaoDoMes(itens, m).total };
  });
  const maiorPrevisao = Math.max(...proximosMeses.map((p) => p.total), 1);

  const PASSOS: { id: Passo; titulo: string; descricao: string; contador?: number }[] = [
    { id: 1, titulo: "Criar lista", descricao: "só os nomes", contador: lista.length },
    { id: 2, titulo: "No mercado", descricao: "preços e quantidades", contador: lista.filter((l) => l.noCarrinho).length },
    { id: 3, titulo: "Depois", descricao: "confirmar duração", contador: pendentesDeDuracao },
  ];

  return (
    <div className="space-y-6">
      {/* Números do mês (no celular, uma faixa compacta para a lista aparecer logo) */}
      <section className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="cartao p-3 sm:p-4">
          <p className="text-[0.65rem] text-suave sm:text-xs">Gasto em {nomeMes(mes).split(" ")[0].toLowerCase()}</p>
          <p className="gradiente-texto mt-0.5 font-display text-base font-bold tabular-nums sm:text-xl">{brl(gastoNoMes)}</p>
        </div>
        <div className="cartao p-3 sm:p-4">
          <p className="text-[0.65rem] text-suave sm:text-xs">Previsto repor</p>
          <p className="mt-0.5 font-display text-base font-bold tabular-nums sm:text-xl">{brl(previsao.total)}</p>
          <p className="hidden text-xs text-suave sm:block">{previsao.lista.length} itens vão acabar</p>
        </div>
        <div className="cartao p-3 sm:p-4">
          <p className="text-[0.65rem] text-suave sm:text-xs">Na despensa</p>
          <p className="mt-0.5 font-display text-base font-bold tabular-nums sm:text-xl">{itens.length} itens</p>
        </div>
      </section>

      {/* O processo em 3 passos */}
      <section className="cartao p-4 sm:p-5">
        <ol className="mb-5 grid grid-cols-3 gap-2">
          {PASSOS.map((p) => {
            const ativo = passo === p.id;
            return (
              <li key={p.id}>
                <button
                  onClick={() => setPasso(p.id)}
                  className={`flex w-full items-center gap-2 rounded-2xl border p-2.5 text-left transition-colors sm:gap-3 sm:p-3 ${
                    ativo ? "border-rosa bg-rosa/10" : "border-white/10 hover:border-roxo/50"
                  }`}
                >
                  <span
                    className={`grid size-8 shrink-0 place-items-center rounded-full font-display font-bold ${
                      ativo ? "botao-gradiente" : "bg-superficie-2 text-suave"
                    }`}
                  >
                    {p.id}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{p.titulo}</span>
                    <span className="hidden truncate text-xs text-suave sm:block">{p.descricao}</span>
                  </span>
                  {!!p.contador && (
                    <span className="ml-auto hidden rounded-full bg-white/10 px-2 py-0.5 text-xs sm:inline">{p.contador}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>

        {passo === 1 && <PassoLista onIrAoMercado={() => setPasso(2)} />}
        {passo === 2 && <PassoMercado onConcluir={() => setPasso(3)} />}
        {passo === 3 && <PassoDepois />}
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Despensa por categoria */}
        <div className="space-y-6 lg:col-span-3">
          <h2 className="titulo-secao mb-0">🏠 Sua despensa</h2>
          {itens.length === 0 ? (
            <div className="cartao">
              <EstadoVazio
                icone="🛒"
                titulo="Sua despensa começa aqui"
                texto="Depois da primeira compra, cada item aparece aqui com um marcador de quanto ainda resta."
              />
            </div>
          ) : (
            CATEGORIAS_MERCADO.map((cat) => {
              const daCategoria = comSituacao
                .filter(({ item }) => item.categoria === cat.id)
                .sort((a, b) => (a.s.faltam ?? 9999) - (b.s.faltam ?? 9999));
              if (daCategoria.length === 0) return null;
              return (
                <section key={cat.id} className="cartao p-5">
                  <h3 className="titulo-secao">
                    {cat.icone} {cat.nome}
                  </h3>
                  <ul className="space-y-4">
                    {daCategoria.map(({ item, s }) => (
                      <li key={item.id}>
                        <div className="flex items-center gap-3">
                          <button onClick={() => setEditando(item)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                            <span className="text-xl">{item.icone}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium hover:text-rosa">
                                {item.nome}{" "}
                                {item.quantidade && <span className="text-xs font-normal text-suave">· {item.quantidade}</span>}
                              </span>
                              <span className="block text-xs text-suave">
                                {brl(item.valor)} ·{" "}
                                {item.duracao
                                  ? `dura ${descreverDuracao(item.duracao, item.unidade)}${item.origemDuracao === "calculada" ? " (calculado)" : ""}`
                                  : "⏳ duração: ainda não sei"}
                                {!item.repor && " · não repõe"}
                              </span>
                            </span>
                          </button>
                          <span className={`shrink-0 text-right text-xs ${COR_ESTADO[s.estado].texto}`}>
                            {s.estado === "programado"
                              ? "🗓️ programado"
                              : s.faltam === null
                                ? s.diasDeUso === 0
                                  ? "comprado hoje"
                                  : s.diasDeUso === 1
                                    ? "comprado ontem"
                                    : `há ${s.diasDeUso} dias`
                                : s.faltam < 0
                                  ? "acabou"
                                  : s.faltam === 0
                                    ? "acaba hoje"
                                    : `${s.faltam} dias`}
                            <span className="block text-suave">
                              {s.estado === "programado"
                                ? `compra em ${formatarData(item.ultimaCompra)}`
                                : s.acabaEm
                                  ? formatarData(s.acabaEm)
                                  : `desde ${formatarData(item.ultimaCompra)}`}
                            </span>
                          </span>
                          {s.estado !== "programado" && (s.faltam === null || s.faltam > 0) && (
                            <button
                              onClick={() => setAcabouItem(item)}
                              className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-xs text-suave hover:border-saida hover:text-saida"
                            >
                              Acabou
                            </button>
                          )}
                        </div>
                        {/* Quanto ainda resta, como um marcador de combustível */}
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                          {s.resta === null ? (
                            <div className="h-full w-full bg-[repeating-linear-gradient(90deg,rgb(255_255_255/0.12)_0_6px,transparent_6px_12px)]" />
                          ) : (
                            <div
                              className={`h-full rounded-full ${COR_ESTADO[s.estado].barra}`}
                              style={{ width: `${s.resta * 100}%` }}
                            />
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })
          )}
        </div>

        <div className="space-y-6 lg:col-span-2">
          {/* Compra do mês */}
          <section className="cartao p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="titulo-secao mb-0">🛒 Compra do mês · {nomeMesCurto(mes)}</h2>
              {totalCompraDoMes > 0 && (
                <span className="gradiente-texto font-display font-bold tabular-nums">{brl(totalCompraDoMes)}</span>
              )}
            </div>
            {itensCompraDoMes.length > 0 ? (
              <>
                <ul className="max-h-72 divide-y divide-white/5 overflow-y-auto text-sm">
                  {itensCompraDoMes.map((i, n) => (
                    <li key={`${i.itemId}-${n}`} className="flex items-center gap-2 py-1.5">
                      <span className="min-w-0 flex-1 truncate">{i.nome}</span>
                      <span className="tabular-nums text-suave">{brl(i.valor)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-suave">
                  {itensCompraDoMes.length} itens · {comprasDoMes.map((c) => formatarData(c.data)).join(", ")}
                </p>
              </>
            ) : (
              <p className="text-sm text-suave">
                Nenhuma compra do mês em {nomeMes(mes).toLowerCase()}. No passo 2, finalize como “🛒 Compra do mês” para os itens
                ficarem todos juntos aqui.
              </p>
            )}
            {avulsasDoMes.length > 0 && (
              <p className="mt-3 border-t border-white/10 pt-3 text-xs text-suave">
                + {avulsasDoMes.length} compra{avulsasDoMes.length > 1 ? "s" : ""} avulsa{avulsasDoMes.length > 1 ? "s" : ""} no
                mês ({brl(somar(avulsasDoMes.map((c) => ({ valor: c.total }))))})
              </p>
            )}
          </section>

          {/* Previsão */}
          <section className="cartao p-5">
            <h2 className="titulo-secao">🔮 Previsão de reposição</h2>
            <div className="flex h-36 items-end gap-2">
              {proximosMeses.map((p) => (
                <div key={p.mes} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[0.6rem] text-suave tabular-nums">
                    {p.total > 0 ? brl(p.total).replace(",00", "") : ""}
                  </span>
                  <div
                    title={`${nomeMes(p.mes)}: ${brl(p.total)}`}
                    className={`w-full rounded-t-lg ${p.mes === mes ? "bg-linear-to-t from-roxo to-rosa" : "bg-roxo/35"}`}
                    style={{ height: `${Math.max((p.total / maiorPrevisao) * 100, 3)}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              {proximosMeses.map((p) => (
                <span key={p.mes} className={`flex-1 text-center text-xs ${p.mes === mes ? "text-rosa" : "text-suave"}`}>
                  {nomeMesCurto(p.mes)}
                </span>
              ))}
            </div>
            {previsao.lista.length > 0 && (
              <ul className="mt-4 space-y-1.5 border-t border-white/10 pt-3 text-sm">
                {previsao.lista.map(({ item, vezes }) => (
                  <li key={item.id} className="flex items-center gap-2">
                    <span>{item.icone}</span>
                    <span className="flex-1 truncate">
                      {item.nome}
                      {vezes > 1 && <span className="text-xs text-suave"> ×{vezes}</span>}
                    </span>
                    <span className="tabular-nums text-suave">{brl(item.valor * vezes)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-suave">
              Entra nos gastos previstos do mês (Início e Relatório). Itens sem duração ainda não entram: confirme no passo 3.
            </p>
          </section>
        </div>
      </div>

      {editando && <FormItemMercado item={editando} onFechar={() => setEditando(null)} />}
      {acabouItem && <FormAcabou item={acabouItem} onFechar={() => setAcabouItem(null)} />}
    </div>
  );
}
