"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  definirOrcamento,
  iconeDaCategoria,
  useComprasMercado,
  useMes,
  useOrcamentos,
  type CompraCartao,
  type GastoFixo,
  type Lancamento,
} from "@/lib/store";
import { brl, formatarData, lerValor, nomeMes, somarMeses, valorParaCampo } from "@/lib/formato";
import { CampoValor } from "@/components/Campos";
import { despesasPorCategoria, gastosDoMes, itensDoMercado, type Gasto } from "@/lib/analise";
import { cartoesDeCredito } from "@/lib/contas";
import { useDados } from "@/lib/dados";
import FormLancamento from "@/components/FormLancamento";
import FormCompra from "@/components/FormCompra";
import FormGastoFixo from "@/components/FormGastoFixo";
import Icone, { TextoComIcones } from "@/components/Icone";

// Onde ver (e mexer) mais sobre cada categoria
const LINKS: Record<string, { href: string; texto: string }> = {
  Mercado: { href: "/mercado", texto: "🛒 Abrir o Mercado" },
  "Dívidas e juros": { href: "/trilha", texto: "🧭 Ver na Trilha" },
  Moradia: { href: "/fixos", texto: "📌 Ver gastos fixos" },
  Contas: { href: "/fixos", texto: "📌 Ver gastos fixos" },
  Assinaturas: { href: "/contas", texto: "💳 Ver assinaturas" },
};

// O que exatamente foi gasto numa categoria no mês (aberto ao tocar numa categoria do Resumo)
export default function DetalheCategoria() {
  return (
    <Suspense fallback={<p className="text-sm text-suave">Carregando…</p>}>
      <Detalhe />
    </Suspense>
  );
}

function Detalhe() {
  const parametros = useSearchParams();
  const nome = parametros.get("nome") ?? "Outros";
  const voltar = `/resumo?aba=${parametros.get("de") ?? "graficos"}`;
  const dados = useDados();
  const comprasMercado = useComprasMercado();
  const mes = useMes();
  const [editando, setEditando] = useState<{ lancamento: Lancamento } | { compra: CompraCartao } | { fixo: GastoFixo } | null>(
    null,
  );

  const todas = despesasPorCategoria(mes, dados);
  const totalDoMes = todas.reduce((t, c) => t + c.valor, 0);
  const gastos = gastosDoMes(mes, dados).filter((g) => g.categoria === nome);
  const total = gastos.reduce((t, g) => t + g.valor, 0);
  const jaFoi = gastos.filter((g) => !g.previsto).reduce((t, g) => t + g.valor, 0);
  const mesPassado = despesasPorCategoria(somarMeses(mes, -1), dados).find((c) => c.categoria === nome)?.valor ?? 0;
  const diferenca = total - mesPassado;
  const link = LINKS[nome];
  const orcamentos = useOrcamentos();
  const limite = orcamentos[nome];
  const [mudandoLimite, setMudandoLimite] = useState(false);
  const [novoLimite, setNovoLimite] = useState(limite ? valorParaCampo(limite) : "");
  // Por subcategoria (ex.: Lazer › Cinema, Bar)
  const porSub = Object.entries(
    gastos.reduce<Record<string, number>>((acc, g) => {
      const sub = g.lancamento?.subcategoria ?? g.compra?.subcategoria;
      return sub ? { ...acc, [sub]: (acc[sub] ?? 0) + g.valor } : acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  function abrir(g: Gasto) {
    if (g.lancamento) setEditando({ lancamento: g.lancamento });
    else if (g.compra) setEditando({ compra: g.compra });
    else if (g.fixo) setEditando({ fixo: g.fixo });
  }

  return (
    <div className="space-y-5">
      <Link href={voltar} className="text-sm text-suave hover:text-white">
        ← Voltar ao resumo
      </Link>

      {/* Cabeçalho */}
      <section className="cartao p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-superficie-2 text-2xl">
            <Icone e={iconeDaCategoria("saida", nome)} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl font-bold">
              <TextoComIcones texto={nome} />
            </h1>
            <p className="text-xs text-suave">{nomeMes(mes)}</p>
          </div>
          <div className="text-right">
            <p className="gradiente-texto font-display text-2xl font-bold tabular-nums">{brl(total)}</p>
            <p className="text-xs text-suave">
              <TextoComIcones texto={totalDoMes > 0 ? `${Math.round((total / totalDoMes) * 100)}% dos gastos` : ""} />
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>
            <span className="text-suave">Já foi: </span>
            {brl(jaFoi)}
          </span>
          {total - jaFoi > 0.005 && (
            <span>
              <span className="text-suave">Ainda vai: </span>
              {brl(total - jaFoi)}
            </span>
          )}
          {mesPassado > 0 && (
            <span className={diferenca > 0 ? "text-saida" : "text-entrada"}>
              <TextoComIcones texto={diferenca > 0 ? "▲" : "▼"} /> {brl(Math.abs(diferenca))}{" "}
              <TextoComIcones texto={diferenca > 0 ? "a mais" : "a menos"} /> que{" "}
              {nomeMes(somarMeses(mes, -1)).split(" ")[0].toLowerCase()}
            </span>
          )}
        </div>
        {/* Limite por mês (orçamento) */}
        <div className="mt-4 rounded-2xl bg-fundo/60 p-3 text-sm">
          {mudandoLimite ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-suave">Limite por mês:</span>
              <div className="w-36">
                <CampoValor valor={novoLimite} onChange={setNovoLimite} autoFocus rotulo={`Limite de ${nome}`} />
              </div>
              <button
                onClick={() => {
                  definirOrcamento(nome, lerValor(novoLimite) || null);
                  setMudandoLimite(false);
                }}
                className="rounded-full border border-rosa/50 px-3 py-1.5 text-xs text-rosa"
              >
                Salvar
              </button>
              <button onClick={() => setMudandoLimite(false)} className="text-xs text-suave">
                cancelar
              </button>
            </div>
          ) : limite ? (
            <>
              <div className="flex justify-between gap-2">
                <span className="text-suave">Limite de {brl(limite)}/mês</span>
                <button onClick={() => setMudandoLimite(true)} className="text-xs text-rosa">
                  mudar
                </button>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/5">
                <div
                  className={`h-full rounded-full ${total > limite ? "bg-saida" : "bg-entrada/80"}`}
                  style={{ width: `${Math.min(total / limite, 1) * 100}%` }}
                />
              </div>
              <p className={`mt-1 text-xs ${total > limite ? "text-saida" : "text-suave"}`}>
                {total > limite ? `Passou ${brl(total - limite)} do limite` : `Ainda pode ${brl(limite - total)}`}
              </p>
            </>
          ) : (
            <button onClick={() => setMudandoLimite(true)} className="text-xs text-rosa">
              + Definir um limite por mês para <TextoComIcones texto={nome} />
            </button>
          )}
        </div>
        {porSub.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2 text-xs">
            {porSub.map(([sub, valor]) => (
              <li key={sub} className="rounded-full bg-white/5 px-3 py-1">
                <TextoComIcones texto={sub} /> · <b className="tabular-nums">{brl(valor)}</b>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-suave">Compras no cartão contam no mês em que a fatura vence.</p>
        {link && (
          <Link
            href={link.href}
            className="mt-4 inline-block rounded-full border border-rosa/50 px-4 py-1.5 text-sm text-rosa hover:bg-rosa/10"
          >
            <TextoComIcones texto={link.texto} />
          </Link>
        )}
      </section>

      {/* O que foi */}
      <section>
        <h2 className="titulo-secao">O que entrou aqui</h2>
        {gastos.length > 0 ? (
          <ul className="cartao divide-y divide-white/5 px-4">
            {gastos.map((g) => {
              const produtos = itensDoMercado(g, comprasMercado);
              const editavel = !!(g.lancamento || g.compra || g.fixo);
              return (
                <li key={g.chave} className="py-3">
                  <button
                    onClick={() => abrir(g)}
                    disabled={!editavel}
                    className="group flex w-full items-center gap-3 text-left disabled:cursor-default"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-superficie-2 text-lg">
                      <Icone e={g.icone} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium group-enabled:group-hover:text-rosa">
                        <TextoComIcones texto={g.descricao} />
                      </span>
                      <span className="block text-xs text-suave">
                        {formatarData(g.data)} · {g.previsto ? <span className="text-amber-300">previsto</span> : g.onde}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-display font-semibold tabular-nums">{brl(g.valor)}</span>
                      {editavel && <span className="text-xs text-suave group-hover:text-white">editar</span>}
                    </span>
                  </button>
                  {/* No mercado: o que foi comprado */}
                  {produtos && produtos.length > 0 && (
                    <ul className="ml-13 mt-2 space-y-1 border-l border-white/10 pl-3 text-sm">
                      {[...produtos]
                        .sort((a, b) => b.valor - a.valor)
                        .map((p, i) => (
                          <li key={`${p.itemId}-${i}`} className="flex gap-2">
                            <span className="min-w-0 flex-1 truncate text-suave">
                              <TextoComIcones texto={p.nome} />
                            </span>
                            <span className="tabular-nums">{brl(p.valor)}</span>
                          </li>
                        ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="cartao p-4 text-sm text-suave">
            Nada em <TextoComIcones texto={nome} /> neste mês.
          </p>
        )}
      </section>

      {/* Ir para outra categoria */}
      {todas.length > 1 && (
        <section>
          <h2 className="titulo-secao">Outras categorias</h2>
          <div className="flex flex-wrap gap-2">
            {todas
              .filter((c) => c.categoria !== nome)
              .map((c) => (
                <Link
                  key={c.categoria}
                  href={`/resumo/categoria?nome=${encodeURIComponent(c.categoria)}&de=${parametros.get("de") ?? "graficos"}`}
                  className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-suave hover:border-rosa/50 hover:text-white"
                >
                  <Icone e={iconeDaCategoria("saida", c.categoria)} /> <TextoComIcones texto={c.categoria} /> · {brl(c.valor)}
                </Link>
              ))}
          </div>
        </section>
      )}

      {editando && "lancamento" in editando && (
        <FormLancamento lancamento={editando.lancamento} onFechar={() => setEditando(null)} />
      )}
      {editando && "compra" in editando && (
        <FormCompra cartoes={cartoesDeCredito(dados.cartoes)} compra={editando.compra} onFechar={() => setEditando(null)} />
      )}
      {editando && "fixo" in editando && <FormGastoFixo fixo={editando.fixo} onFechar={() => setEditando(null)} />}
    </div>
  );
}
