"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { iconeDaCategoria, irParaMes, useMes, useOrcamentos } from "@/lib/store";
import { brl, dataDoRecebimento, mesAtual, nomeMes, nomeMesCurto, somarMeses } from "@/lib/formato";
import { balancoDoMes, despesasPorCategoria } from "@/lib/analise";
import { eventosAte, projetarDia } from "@/lib/projecao";
import { calcularMeta } from "@/lib/metas";
import { planoDoMes } from "@/lib/previstos";
import { useDados } from "@/lib/dados";

const CORES = ["#ff4ed8", "#8b5cf6", "#3b82f6", "#34d399", "#fbbf24", "#fb7185", "#22d3ee", "#a3e635", "#9aa3b8"];

// Gráficos com os dados de verdade do mês escolhido no topo.
export default function Graficos() {
  const dados = useDados();
  const mes = useMes();
  const orcamentos = useOrcamentos();
  const router = useRouter();
  // Tocar numa categoria abre o que exatamente foi gasto nela
  const detalhe = (categoria: string) => `/resumo/categoria?nome=${encodeURIComponent(categoria)}&de=graficos`;
  const abrirCategoria = (categoria: string) => categoria !== "Outras" && router.push(detalhe(categoria));

  // 1. Para onde foi o dinheiro
  const categorias = despesasPorCategoria(mes, dados);
  const principais = categorias.slice(0, 8);
  const resto = categorias.slice(8).reduce((t, c) => t + c.valor, 0);
  const fatias = resto > 0 ? [...principais, { categoria: "Outras", valor: resto }] : principais;
  const totalGasto = fatias.reduce((t, c) => t + c.valor, 0);
  // Cada fatia começa onde a anterior terminou
  const arcos = fatias.map((c, i) => ({
    ...c,
    inicio: totalGasto > 0 ? fatias.slice(0, i).reduce((t, x) => t + x.valor, 0) / totalGasto : 0,
    tamanho: totalGasto > 0 ? c.valor / totalGasto : 0,
    cor: CORES[i % CORES.length],
  }));

  // 2. Entradas × saídas dos últimos 6 meses (o mês atual inclui o previsto)
  const meses = Array.from({ length: 6 }, (_, i) => somarMeses(mes, i - 5)).map((m) => ({ mes: m, ...balancoDoMes(m, dados) }));
  const maiorMes = Math.max(...meses.flatMap((m) => [m.entra, m.sai]), 1);

  // 3. Saldo previsto dia a dia no mês (de hoje até o fim)
  const fimDoMes = dataDoRecebimento("31", mes);
  const inicial = projetarDia(mes === mesAtual() ? fimDoMes : `${mes}-01`, dados).saldoInicial;
  const pontos: { dia: number; saldo: number }[] = [];
  if (mes >= mesAtual()) {
    let saldo = inicial;
    const eventos = eventosAte(fimDoMes, dados);
    const diasNoMes = Number(fimDoMes.slice(8));
    for (let dia = 1; dia <= diasNoMes; dia++) {
      const data = `${mes}-${String(dia).padStart(2, "0")}`;
      for (const e of eventos.filter((x) => x.data === data)) saldo += e.tipo === "entrada" ? e.valor : -e.valor;
      if (data >= `${mesAtual()}-${String(new Date().getDate()).padStart(2, "0")}` || mes > mesAtual())
        pontos.push({ dia, saldo });
    }
  }
  const minSaldo = Math.min(...pontos.map((p) => p.saldo), 0);
  const maxSaldo = Math.max(...pontos.map((p) => p.saldo), 1);
  const x = (dia: number) => ((dia - 1) / 30) * 100;
  const y = (saldo: number) => 100 - ((saldo - minSaldo) / (maxSaldo - minSaldo || 1)) * 100;

  // 4. Metas
  const plano = planoDoMes(mesAtual(), dados);
  const metas = dados.metas.filter((m) => !m.arquivada && !calcularMeta(m).concluida);

  // 5. Limites por categoria (orçamento)
  const comLimite = categorias
    .filter((c) => orcamentos[c.categoria])
    .concat(
      Object.keys(orcamentos)
        .filter((nome) => !categorias.some((c) => c.categoria === nome))
        .map((nome) => ({ categoria: nome, valor: 0 })),
    );

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="cartao p-5">
          <h2 className="titulo-secao">Para onde vai o dinheiro em {nomeMes(mes).split(" ")[0].toLowerCase()}</h2>
          {totalGasto > 0 && (
            <p className="-mt-2 mb-3 text-xs text-suave">
              Toque numa categoria para ver o que foi gasto. Compras no cartão contam no mês em que a fatura vence.
            </p>
          )}
          {totalGasto > 0 ? (
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <div className="relative shrink-0">
                <svg viewBox="0 0 42 42" className="size-44 -rotate-90">
                  <circle cx="21" cy="21" r="15.9" fill="none" stroke="rgb(255 255 255 / 0.06)" strokeWidth="6" />
                  {arcos.map((f) => (
                    <circle
                      key={f.categoria}
                      cx="21"
                      cy="21"
                      r="15.9"
                      fill="none"
                      stroke={f.cor}
                      strokeWidth="6"
                      pathLength="100"
                      strokeDasharray={`${Math.max(f.tamanho * 100 - 0.8, 0.1)} ${100 - f.tamanho * 100 + 0.8}`}
                      strokeDashoffset={-f.inicio * 100}
                      onClick={() => abrirCategoria(f.categoria)}
                      className={f.categoria !== "Outras" ? "cursor-pointer transition-opacity hover:opacity-80" : ""}
                    >
                      <title>{`${f.categoria}: ${brl(f.valor)}`}</title>
                    </circle>
                  ))}
                </svg>
                <div className="absolute inset-0 grid place-items-center text-center">
                  <span>
                    <span className="block text-[0.6rem] text-suave">total</span>
                    <span className="font-display text-sm font-bold">{brl(totalGasto).replace(",00", "")}</span>
                  </span>
                </div>
              </div>
              <ul className="w-full space-y-1.5 text-sm">
                {arcos.map((c) => {
                  const conteudo = (
                    <>
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: c.cor }} />
                      <span className="min-w-0 flex-1 truncate">
                        {iconeDaCategoria("saida", c.categoria)} {c.categoria}
                      </span>
                      <span className="tabular-nums text-suave">{brl(c.valor).replace(",00", "")}</span>
                      <span className="w-9 text-right tabular-nums text-suave">{Math.round(c.tamanho * 100)}%</span>
                    </>
                  );
                  return (
                    <li key={c.categoria}>
                      {c.categoria === "Outras" ? (
                        <span className="flex items-center gap-2 px-2 py-1">{conteudo}</span>
                      ) : (
                        <Link
                          href={detalhe(c.categoria)}
                          className="group flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-white/5"
                        >
                          {conteudo}
                          <span className="text-suave group-hover:text-rosa">›</span>
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-suave">Nenhum gasto neste mês ainda.</p>
          )}
        </section>

        <section className="cartao p-5">
          <h2 className="titulo-secao">Entradas × saídas</h2>
          <div className="flex h-44 items-end gap-3">
            {meses.map((m) => (
              <button
                key={m.mes}
                onClick={() => {
                  irParaMes(m.mes);
                  router.push("/lancamentos");
                }}
                className="flex h-full flex-1 items-end justify-center gap-1 rounded-md transition-colors hover:bg-white/5"
                title={`${nomeMes(m.mes)}: entra ${brl(m.entra)}, sai ${brl(m.sai)} — toque para ver os lançamentos`}
              >
                <div
                  className={`w-1/2 rounded-t-md ${m.vaiEntrar > 0 ? "bg-entrada/50" : "bg-entrada/80"}`}
                  style={{ height: `${(m.entra / maiorMes) * 100}%` }}
                />
                <div
                  className={`w-1/2 rounded-t-md ${m.vaiSair > 0 ? "bg-saida/50" : "bg-saida/80"}`}
                  style={{ height: `${(m.sai / maiorMes) * 100}%` }}
                />
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-3">
            {meses.map((m) => (
              <span key={m.mes} className={`flex-1 text-center text-xs ${m.mes === mes ? "text-rosa" : "text-suave"}`}>
                {nomeMesCurto(m.mes)}
              </span>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-suave">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-entrada" /> Entradas
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-saida" /> Saídas
            </span>
            <span>mais claro = inclui previsto · toque num mês para ver os lançamentos</span>
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="cartao p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="titulo-secao">Saldo previsto dia a dia</h2>
            <Link href="/resumo?aba=projecao" className="text-xs text-rosa">
              ver na projeção ›
            </Link>
          </div>
          {pontos.length > 1 ? (
            <>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-40 w-full overflow-visible">
                {minSaldo < 0 && (
                  <line
                    x1="0"
                    x2="100"
                    y1={y(0)}
                    y2={y(0)}
                    stroke="rgb(251 113 133 / 0.5)"
                    strokeDasharray="2 2"
                    strokeWidth="0.5"
                  />
                )}
                <polyline
                  fill="none"
                  stroke="url(#linhaSaldo)"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                  points={pontos.map((p) => `${x(p.dia)},${y(p.saldo)}`).join(" ")}
                />
                <defs>
                  <linearGradient id="linhaSaldo" x1="0" x2="1">
                    <stop offset="0" stopColor="#ff4ed8" />
                    <stop offset="1" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="mt-2 flex justify-between text-xs text-suave">
                <span>
                  dia {pontos[0].dia}: {brl(pontos[0].saldo)}
                </span>
                <span className={pontos[pontos.length - 1].saldo < 0 ? "text-saida" : ""}>
                  dia {pontos[pontos.length - 1].dia}: {brl(pontos[pontos.length - 1].saldo)}
                </span>
              </div>
            </>
          ) : (
            <p className="text-sm text-suave">Escolha este mês ou um mês que ainda vai chegar para ver o saldo previsto.</p>
          )}
        </section>

        <section className="cartao p-5">
          <h2 className="titulo-secao">Metas</h2>
          {metas.length > 0 ? (
            <ul className="space-y-4">
              {metas.map((m) => {
                const valorDoMes =
                  m.tipo === "quitar" ? (m.planoMensal?.[mesAtual()] ?? m.parcela ?? 0) : (plano.valores.get(m.id)?.valor ?? 0);
                const c = calcularMeta(valorDoMes > 0 ? { ...m, aporteMensal: valorDoMes } : m);
                return (
                  <li key={m.id}>
                    <Link href="/trilha" className="block rounded-lg p-1 -m-1 hover:bg-white/5">
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate">
                          {m.icone} {m.nome}
                        </span>
                        <span className="shrink-0 text-xs text-suave">
                          {c.previsao
                            ? `${m.tipo === "quitar" ? "quita" : "chega"} em ${nomeMes(c.previsao).toLowerCase()}`
                            : "sem previsão"}
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-linear-to-r from-rosa via-roxo to-azul"
                          style={{ width: `${c.progresso * 100}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-suave tabular-nums">
                        {Math.round(c.progresso * 100)}% · falta {brl(c.falta)} · este mês {brl(valorDoMes)}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-suave">Nenhuma meta em andamento. Crie uma na aba Trilha.</p>
          )}
        </section>
      </div>
      <section className="cartao p-5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="titulo-secao">Limites por categoria</h2>
          <Link href="/configuracoes" className="text-xs text-rosa">
            definir limites ›
          </Link>
        </div>
        {comLimite.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2">
            {comLimite.map((c) => {
              const limite = orcamentos[c.categoria];
              const parte = Math.min(c.valor / limite, 1);
              const passou = c.valor > limite;
              return (
                <li key={c.categoria}>
                  <Link href={detalhe(c.categoria)} className="block hover:text-rosa">
                    <div className="flex justify-between gap-2 text-sm">
                      <span>
                        {iconeDaCategoria("saida", c.categoria)} {c.categoria}
                      </span>
                      <span className={`tabular-nums ${passou ? "text-saida" : "text-suave"}`}>
                        {brl(c.valor)} / {brl(limite)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/5">
                      <div
                        className={`h-full rounded-full ${passou ? "bg-saida" : parte > 0.8 ? "bg-amber-300" : "bg-entrada/80"}`}
                        style={{ width: `${parte * 100}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-suave">
                      {passou ? `passou ${brl(c.valor - limite)}` : `ainda pode ${brl(limite - c.valor)}`}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-suave">
            Defina quanto quer gastar por mês em cada categoria (ex.: Lazer até R$ 300) para acompanhar aqui.
          </p>
        )}
      </section>
    </div>
  );
}
