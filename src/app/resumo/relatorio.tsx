"use client";

import { useState } from "react";
import Link from "next/link";
import { doMes, iconeDaCategoria, somar, useMes, usePreferencias } from "@/lib/store";
import { itensAPagar } from "@/lib/apagar";
import { itensDaFatura } from "@/lib/cartoes";
import { calcularMeta } from "@/lib/metas";
import { fixosDoMes, valorNoMes } from "@/lib/fixos";
import { balancoDoMes, despesasPorCategoria, gastosDoMes, NECESSIDADES_PADRAO } from "@/lib/analise";
import { useDados } from "@/lib/dados";
import { brl, nomeMes } from "@/lib/formato";

function porcento(parte: number, total: number) {
  return total > 0 ? Math.round((parte / total) * 100) : 0;
}

// Relatório "sério" do mês, com os dados de verdade (as mesmas contas dos Gráficos).
// Cada categoria abre o detalhe do que foi gasto nela.
export default function Relatorio() {
  const dados = useDados();
  const { lancamentos, fixos, cartoes, compras, pagamentos, metas } = dados;
  const mes = useMes();
  // Regra 50/30/20: o que é necessidade (a pessoa escolhe em Configurações; o resto é desejo)
  const NECESSIDADES = usePreferencias().necessidades ?? NECESSIDADES_PADRAO;

  const doMesSelecionado = doMes(lancamentos, mes);
  const balanco = balancoDoMes(mes, dados);
  const recebido = balanco.entrouFeito;
  const aReceber = balanco.vaiEntrar;
  const totalEntradas = recebido + aReceber;

  const porCategoria = despesasPorCategoria(mes, dados);
  // Lista por categoria: tudo, só débito (saiu da conta) ou só crédito (fatura do cartão)
  const [forma, setForma] = useState<"tudo" | "debito" | "credito">("tudo");
  const listaPorCategoria =
    forma === "tudo"
      ? porCategoria
      : Object.entries(
          gastosDoMes(mes, dados)
            .filter((g) => (forma === "credito" ? !!g.compra || g.onde.startsWith("💳") : !g.compra && !g.onde.startsWith("💳")))
            .reduce<Record<string, number>>((acc, g) => ({ ...acc, [g.categoria]: (acc[g.categoria] ?? 0) + g.valor }), {}),
        )
          .map(([categoria, valor]) => ({ categoria, valor }))
          .sort((a, b) => b.valor - a.valor);
  const totalDaLista = somar(listaPorCategoria);
  const pendentes = itensAPagar(mes, { lancamentos, fixos, cartoes, compras, pagamentos, metas });
  const totalDespesas = somar(porCategoria);
  const maiorCategoria = listaPorCategoria[0]?.valor ?? 1;

  const resultado = totalEntradas - totalDespesas;
  const necessidades = somar(porCategoria.filter((c) => NECESSIDADES.includes(c.categoria)));
  const desejos = totalDespesas - necessidades;

  const metasAtivas = metas.filter((m) => !m.arquivada && !calcularMeta(m).concluida);

  // Compromissos: o que já está "contratado" para o mês
  const contasFixas = fixosDoMes(fixos, mes)
    .filter((f) => f.pagamento !== "cartao")
    .reduce((t, f) => t + valorNoMes(f, mes), 0);
  const faturas = cartoes.reduce((t, c) => t + somar(itensDaFatura(c, mes, { compras, fixos, pagamentos })), 0);
  const parcelasDoMes =
    somar(pendentes.filter((p) => p.tipo === "parcela")) +
    somar(doMesSelecionado.filter((l) => l.tipo === "saida" && l.categoria === "Parcelas e dívidas"));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">Relatório de {nomeMes(mes).toLowerCase()}</h2>
        <button
          onClick={() => window.print()}
          className="rounded-full border border-white/15 px-4 py-1.5 text-sm text-suave hover:text-white print:hidden"
        >
          🖨️ Imprimir / salvar PDF
        </button>
      </div>

      {/* Balanço */}
      <section className="cartao p-5">
        <h3 className="titulo-secao">Balanço do mês</h3>
        <dl className="divide-y divide-white/5 text-sm">
          <Linha rotulo="Entradas recebidas" valor={brl(recebido)} cor="text-entrada" />
          {aReceber > 0 && <Linha rotulo="Entradas a receber" valor={brl(aReceber)} cor="text-amber-300" />}
          <Linha rotulo="Despesas do mês (pagas e previstas)" valor={`− ${brl(totalDespesas)}`} cor="text-saida" />
          <Linha
            rotulo="Resultado previsto"
            valor={`${resultado >= 0 ? "+ " : "− "}${brl(Math.abs(resultado))}`}
            cor={resultado >= 0 ? "text-entrada" : "text-saida"}
            destaque
          />
        </dl>
        {totalEntradas > 0 && (
          <p className="mt-3 text-sm text-suave">
            {resultado >= 0
              ? `Sobram ${porcento(resultado, totalEntradas)}% do que entrou. O recomendado é guardar ao menos 10% a 20%.`
              : `As despesas passam ${porcento(-resultado, totalEntradas)}% do que entrou. Vale rever os maiores gastos abaixo.`}
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Despesas por categoria */}
        <section className="cartao p-5">
          <h3 className="titulo-secao">Despesas por categoria</h3>
          <div
            className="mb-3 grid grid-cols-3 gap-1 rounded-full bg-fundo p-1 text-xs"
            role="radiogroup"
            aria-label="Forma de pagamento"
          >
            {(
              [
                ["tudo", "Tudo"],
                ["debito", "🏦 Débito"],
                ["credito", "💳 Crédito"],
              ] as const
            ).map(([id, nome]) => (
              <button
                key={id}
                role="radio"
                aria-checked={forma === id}
                onClick={() => setForma(id)}
                className={`rounded-full py-1.5 ${forma === id ? "bg-white font-semibold text-fundo" : "text-suave"}`}
              >
                {nome}
              </button>
            ))}
          </div>
          {forma !== "tudo" && <p className="-mt-1 mb-2 text-xs text-suave">Total: {brl(totalDaLista)}</p>}
          {listaPorCategoria.length > 0 ? (
            <ul className="space-y-3">
              {listaPorCategoria.map((c) => (
                <li key={c.categoria} className="text-sm">
                  <Link
                    href={`/resumo/categoria?nome=${encodeURIComponent(c.categoria)}&de=relatorio`}
                    className="group -mx-2 block rounded-lg px-2 py-1 hover:bg-white/5"
                  >
                    <div className="flex items-center gap-2">
                      <span>{iconeDaCategoria("saida", c.categoria)}</span>
                      <span className="flex-1">{c.categoria}</span>
                      <span className="tabular-nums text-suave">
                        {porcento(c.valor, forma === "tudo" ? totalDespesas : totalDaLista)}%
                      </span>
                      <span className="w-24 text-right tabular-nums">{brl(c.valor)}</span>
                      <span className="text-suave group-hover:text-rosa">›</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-linear-to-r from-roxo to-rosa"
                        style={{ width: `${(c.valor / maiorCategoria) * 100}%` }}
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-suave">Nenhuma despesa neste mês.</p>
          )}
        </section>

        {/* Regra 50/30/20 */}
        <section className="cartao p-5">
          <h3 className="titulo-secao">Regra 50/30/20</h3>
          {totalEntradas > 0 ? (
            <>
              <p className="mb-4 text-sm text-suave">
                Referência dos especialistas: até 50% do que entra em necessidades, até 30% em desejos e pelo menos 20% para metas
                e poupança.
              </p>
              <Faixa
                rotulo="Necessidades"
                detalhe={NECESSIDADES.join(", ").toLowerCase()}
                valor={necessidades}
                total={totalEntradas}
                ideal={50}
                limite
              />
              <Faixa
                rotulo="Desejos"
                detalhe="o resto (lazer, compras, comer fora…)"
                valor={desejos}
                total={totalEntradas}
                ideal={30}
                limite
              />
              <Faixa
                rotulo="Sobra para metas"
                detalhe="o que sobra para guardar"
                valor={Math.max(resultado, 0)}
                total={totalEntradas}
                ideal={20}
              />
            </>
          ) : (
            <p className="text-sm text-suave">Registre o que entrou no mês para ver a comparação.</p>
          )}
          <Link href="/configuracoes" className="mt-3 inline-block text-xs text-rosa">
            Escolher o que é necessidade (ex.: internet, plano de celular) ›
          </Link>
        </section>
      </div>

      {/* Compromissos */}
      <section className="cartao p-5">
        <h3 className="titulo-secao">Compromissos do mês</h3>
        <div className="grid gap-4 text-sm sm:grid-cols-3">
          <Compromisso rotulo="Gastos fixos (fora do cartão)" valor={contasFixas} total={totalEntradas} href="/fixos" />
          <Compromisso rotulo="Faturas de cartão" valor={faturas} total={totalEntradas} href="/contas" />
          <Compromisso rotulo="Parcelas a quitar" valor={parcelasDoMes} total={totalEntradas} href="/trilha" />
        </div>
        <p className="mt-3 text-xs text-suave">
          Compromissos são o que já está “contratado” para o mês. Quanto menor a parte da renda presa neles, mais folga para
          imprevistos e metas.
        </p>
      </section>

      {/* Metas */}
      <section className="cartao p-5">
        <h3 className="titulo-secao">Metas</h3>
        {metasAtivas.length > 0 ? (
          <ul className="divide-y divide-white/5 text-sm">
            {metasAtivas.map((m) => {
              const c = calcularMeta(m);
              return (
                <li key={m.id}>
                  <Link href="/trilha" className="flex items-center gap-3 py-2.5 hover:text-rosa">
                    <span>{m.icone}</span>
                    <span className="min-w-0 flex-1 truncate">{m.nome}</span>
                    <span className="text-suave tabular-nums">
                      {brl(m.guardado)} de {brl(m.alvo)}
                    </span>
                    <span className="w-12 text-right font-semibold tabular-nums">{Math.round(c.progresso * 100)}%</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-suave">Nenhuma meta em andamento.</p>
        )}
      </section>
    </div>
  );
}

function Linha({ rotulo, valor, cor, destaque }: { rotulo: string; valor: string; cor: string; destaque?: boolean }) {
  return (
    <div className={`flex justify-between py-2 ${destaque ? "font-semibold" : ""}`}>
      <dt className={destaque ? "" : "text-suave"}>{rotulo}</dt>
      <dd className={`tabular-nums ${cor}`}>{valor}</dd>
    </div>
  );
}

function Faixa({
  rotulo,
  detalhe,
  valor,
  total,
  ideal,
  limite,
}: {
  rotulo: string;
  detalhe: string;
  valor: number;
  total: number;
  ideal: number;
  limite?: boolean; // true: o ideal é um teto (não passar); false: é um piso (chegar pelo menos)
}) {
  const p = porcento(valor, total);
  const ok = limite ? p <= ideal : p >= ideal;
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-baseline justify-between text-sm">
        <span>
          {rotulo} <span className="text-xs text-suave">· {detalhe}</span>
        </span>
        <span className={`font-semibold tabular-nums ${ok ? "text-entrada" : "text-amber-300"}`}>
          {p}%{" "}
          <span className="text-xs font-normal text-suave">
            / {limite ? "até" : "pelo menos"} {ideal}%
          </span>
        </span>
      </div>
      <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-white/5">
        <div
          className={`h-full rounded-full ${ok ? "bg-entrada/70" : "bg-amber-300/70"}`}
          style={{ width: `${Math.min(p, 100)}%` }}
        />
        <div className="absolute inset-y-0 w-0.5 bg-white/60" style={{ left: `${ideal}%` }} title={`Referência: ${ideal}%`} />
      </div>
      <p className="mt-1 text-xs text-suave tabular-nums">{brl(valor)}</p>
    </div>
  );
}

function Compromisso({ rotulo, valor, total, href }: { rotulo: string; valor: number; total: number; href: string }) {
  return (
    <Link href={href} className="group -m-2 block rounded-xl p-2 hover:bg-white/5">
      <p className="text-xs text-suave">
        {rotulo} <span className="group-hover:text-rosa">›</span>
      </p>
      <p className="font-display text-lg font-semibold tabular-nums">{brl(valor)}</p>
      {total > 0 && <p className="text-xs text-suave">{porcento(valor, total)}% do que entrou</p>}
    </Link>
  );
}
