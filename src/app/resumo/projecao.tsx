"use client";

import { useState } from "react";
import { iconeDaCategoria, jaAconteceu, mudarMes, somar, useMes } from "@/lib/store";
import { brl, dataDoRecebimento, formatarData, hojeISO, mesAtual, nomeMes } from "@/lib/formato";
import { eventosAte, projetarDia, type Evento } from "@/lib/projecao";
import { previstosDoMes, resumoDoMes } from "@/lib/previstos";
import { useDados } from "@/lib/dados";

const DIAS_DA_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const ORIGEM: Record<Evento["origem"], string> = {
  lançamento: "lançamento",
  renda: "renda",
  benefício: "benefício",
  fixo: "fixo",
  fatura: "fatura",
  parcela: "quitar",
  guardar: "meta",
  mercado: "mercado",
};

function nomeDoDia(data: string) {
  const [a, m, d] = data.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}

// "Se tudo acontecer como programado, como vão estar as coisas em tal dia?"
export default function Projecao() {
  const dados = useDados();
  const mes = useMes();
  const hoje = hojeISO();
  const fimDoMes = dataDoRecebimento("31", mes);
  const [escolhido, setEscolhido] = useState<string | null>(null);

  if (mes < mesAtual()) {
    return (
      <div className="cartao space-y-3 p-6 text-center text-sm text-suave">
        <p>A projeção olha para frente.</p>
        <button onClick={() => mudarMes(1)} className="text-rosa">
          Ver o próximo mês ›
        </button>
      </div>
    );
  }

  // Dia tocado (pode ser um dia que já passou: mostra o que aconteceu nele). A projeção usa o dia, ou o fim do mês.
  const tocado = escolhido && escolhido.startsWith(mes) ? escolhido : null;
  const dia = tocado && tocado >= hoje ? tocado : fimDoMes;
  const projecao = projetarDia(dia, dados);

  // Eventos do mês, para as bolinhas e o saldo de cada dia do calendário
  const eventosDoMes = eventosAte(fimDoMes, dados);
  const porDia = new Map<string, Evento[]>();
  for (const e of eventosDoMes) porDia.set(e.data, [...(porDia.get(e.data) ?? []), e]);
  // Dias que já passaram: as bolinhas mostram o que aconteceu de verdade
  for (const l of dados.lancamentos.filter(
    (x) => x.data.startsWith(mes) && x.data < hoje && jaAconteceu(x) && !x.transferenciaId,
  ))
    porDia.set(l.data, [
      ...(porDia.get(l.data) ?? []),
      { chave: l.id, data: l.data, tipo: l.tipo, valor: l.valor, nome: l.descricao, icone: "", origem: "lançamento" } as Evento,
    ]);
  function porDiaDoMes(data: string) {
    return eventosDoMes.filter((e) => e.data === data);
  }
  // O que entra e sai no dia tocado: o que já aconteceu (lançamentos) + o que está previsto
  const doDia = tocado
    ? [
        ...dados.lancamentos
          .filter((l) => l.data === tocado && jaAconteceu(l) && !l.transferenciaId)
          .map((l) => ({
            chave: l.id,
            nome: l.descricao,
            icone: iconeDaCategoria(l.tipo, l.categoria),
            tipo: l.tipo,
            valor: l.valor,
            feito: true,
          })),
        ...(tocado >= hoje ? (porDiaDoMes(tocado) ?? []) : []).map((e) => ({
          chave: e.chave,
          nome: e.nome,
          icone: e.icone,
          tipo: e.tipo,
          valor: e.valor,
          feito: false,
        })),
      ]
    : [];
  const saldoNoFimDoDia = new Map<string, number>();
  let corrente = projecao.saldoInicial;
  for (const e of eventosDoMes) {
    corrente += e.tipo === "entrada" ? e.valor : -e.valor;
    saldoNoFimDoDia.set(e.data, corrente);
  }
  function saldoAte(data: string) {
    let valor = projecao.saldoInicial;
    for (const [d, s] of saldoNoFimDoDia) if (d <= data) valor = s;
    return valor;
  }

  // Grade do mês (começando no domingo)
  const [ano, m] = mes.split("-").map(Number);
  const diasNoMes = new Date(ano, m, 0).getDate();
  const vazios = new Date(ano, m - 1, 1).getDay();
  const celulas = [
    ...Array(vazios).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`),
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Calendário */}
      <section className="cartao p-4 sm:p-5 lg:col-span-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            onClick={() => mudarMes(-1)}
            disabled={mes <= mesAtual()}
            aria-label="Mês anterior"
            className="grid size-9 place-items-center rounded-full text-2xl text-roxo hover:bg-superficie-2 disabled:opacity-20"
          >
            ‹
          </button>
          <h2 className="font-display text-lg font-semibold">{nomeMes(mes)}</h2>
          <button
            onClick={() => mudarMes(1)}
            aria-label="Próximo mês"
            className="grid size-9 place-items-center rounded-full text-2xl text-roxo hover:bg-superficie-2"
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[0.65rem] uppercase tracking-wider text-suave">
          {DIAS_DA_SEMANA.map((d) => (
            <span key={d} className="py-1">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {celulas.map((data, i) => {
            if (!data) return <span key={`vazio-${i}`} />;
            const passado = data < hoje;
            const eventos = porDia.get(data) ?? [];
            const entra = eventos.some((e) => e.tipo === "entrada");
            const sai = eventos.some((e) => e.tipo === "saida");
            const saldo = passado ? null : saldoAte(data);
            const selecionado = data === dia;
            return (
              <button
                key={data}
                onClick={() => setEscolhido(data)}
                className={`flex aspect-square flex-col items-center justify-between rounded-xl border p-1 text-sm transition-colors sm:aspect-auto sm:min-h-16 ${
                  selecionado
                    ? "border-rosa bg-rosa/15"
                    : passado
                      ? "border-transparent text-white/50 hover:border-white/10"
                      : "border-white/5 bg-fundo/40 hover:border-roxo/60"
                } ${data === hoje ? "ring-1 ring-azul" : ""}`}
              >
                <span className={data === hoje ? "font-bold text-azul" : ""}>{Number(data.slice(8))}</span>
                <span className="flex gap-0.5">
                  {entra && <span className="size-1.5 rounded-full bg-entrada" />}
                  {sai && <span className="size-1.5 rounded-full bg-saida" />}
                </span>
                {saldo !== null && (
                  <span className={`hidden text-[0.6rem] tabular-nums sm:block ${saldo < 0 ? "text-saida" : "text-suave"}`}>
                    {Math.round(saldo).toLocaleString("pt-BR")}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-suave">
          <span>Toque num dia para ver o que entra e sai nele.</span>
          <span className="flex gap-3">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-entrada" /> entra
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-saida" /> sai
            </span>
          </span>
        </div>
      </section>

      {/* Como vai estar no dia escolhido */}
      <section className="space-y-4 lg:col-span-2">
        {/* O dia tocado, em detalhe */}
        {tocado && (
          <div className="cartao p-5">
            <h3 className="titulo-secao capitalize">{nomeDoDia(tocado)}</h3>
            {doDia.length > 0 ? (
              <ul className="space-y-1.5 text-sm">
                {doDia.map((e) => (
                  <li key={e.chave} className="flex items-center gap-2">
                    <span aria-hidden>{e.icone}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {e.nome}
                      {!e.feito && <span className="ml-1 text-xs text-suave">· previsto</span>}
                    </span>
                    <span className={`tabular-nums ${e.tipo === "entrada" ? "text-entrada" : "text-saida"}`}>
                      {e.tipo === "entrada" ? "+" : "−"} {brl(e.valor)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-suave">Nada nesse dia.</p>
            )}
          </div>
        )}

        <FechamentoDoMes mes={mes} />

        <div className="cartao relative overflow-hidden p-5">
          <div className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-roxo/25 blur-3xl" />
          <p className="text-xs text-suave">Se tudo acontecer como programado, em</p>
          <p className="font-display text-lg font-semibold capitalize">{nomeDoDia(dia)}</p>

          <p className="mt-4 text-xs text-suave">Saldo previsto nas contas</p>
          <p
            className={`font-display text-4xl font-bold tabular-nums ${projecao.saldoFinal < 0 ? "text-saida" : "gradiente-texto"}`}
          >
            {brl(projecao.saldoFinal)}
          </p>
          <p className="text-xs text-suave">hoje: {brl(projecao.saldoInicial)}</p>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-3 text-sm">
            <div>
              <p className="text-xs text-suave">Vai entrar até lá</p>
              <p className="font-semibold tabular-nums text-entrada">+ {brl(projecao.entra)}</p>
            </div>
            <div>
              <p className="text-xs text-suave">Vai sair até lá</p>
              <p className="font-semibold tabular-nums text-saida">− {brl(projecao.sai)}</p>
              {projecao.guardado > 0 && <p className="text-xs text-suave">(sendo {brl(projecao.guardado)} para metas)</p>}
            </div>
          </div>

          {projecao.menor.valor < 0 && (
            <p className="mt-3 rounded-xl bg-saida/10 px-3 py-2 text-xs text-saida">
              ⚠️ No dia {formatarData(projecao.menor.data)} o saldo fica em {brl(projecao.menor.valor)}. Vale adiar alguma conta,
              mudar a meta do mês ou guardar antes.
            </p>
          )}
        </div>

        <div className="cartao p-5">
          <h3 className="titulo-secao">O que acontece até lá</h3>
          {projecao.eventos.length > 0 ? (
            <ul className="max-h-96 space-y-3 overflow-y-auto pr-1 text-sm">
              {agruparPorData(projecao.eventos).map(([data, eventos]) => (
                <li key={data}>
                  <p className="mb-1 text-xs font-semibold text-suave">
                    {data === hoje ? "Hoje" : formatarData(data)}
                    {eventos.some((e) => e.atrasado) && <span className="ml-1 text-saida">· inclui atrasados</span>}
                  </p>
                  <ul className="space-y-1">
                    {eventos.map((e) => (
                      <li key={e.chave} className="flex items-center gap-2">
                        <span>{e.icone}</span>
                        <span className="min-w-0 flex-1 truncate">
                          {e.nome}
                          <span className="ml-1 text-xs text-suave">· {ORIGEM[e.origem]}</span>
                        </span>
                        <span className={`tabular-nums ${e.tipo === "entrada" ? "text-entrada" : "text-saida"}`}>
                          {e.tipo === "entrada" ? "+" : "−"} {brl(e.valor)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-suave">Nada programado até esse dia.</p>
          )}
        </div>

        <div className="cartao p-5">
          <h3 className="titulo-secao">Dívidas nesse dia</h3>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-suave">Devendo nos cartões</dt>
              <dd className="font-display text-lg font-semibold tabular-nums">{brl(projecao.devendoCartoes)}</dd>
            </div>
            <div>
              <dt className="text-xs text-suave">Parcelas a quitar</dt>
              <dd className="font-display text-lg font-semibold tabular-nums">{brl(projecao.devendoParcelas)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-suave">Já descontando as faturas e parcelas que vão ser pagas até lá.</p>
        </div>
      </section>
    </div>
  );
}

/** Mini relatório do último dia do mês: o que sobrou e se o mês foi bom. */
function FechamentoDoMes({ mes }: { mes: string }) {
  const dados = useDados();
  // A mesma conta de todas as telas: sem transferências, sem guardar/retirar de meta e sem vales
  const r = resumoDoMes(mes, dados);
  const previstos = previstosDoMes(mes, dados);
  const entra = r.entra;
  const guardado = Math.max(r.guardado, 0) + somar(previstos.filter((p) => p.origem === "guardar"));
  const gastos = r.sai;
  const sobra = r.sobra; // antes de guardar: quanto o mês "rendeu"
  const parte = entra > 0 ? sobra / entra : 0;

  const avaliacao =
    sobra < 0
      ? {
          titulo: "Ruim",
          cor: "text-saida",
          fundo: "bg-saida/10",
          texto: "Os gastos passaram do que entrou. Dá para rever as maiores despesas no Relatório.",
        }
      : parte >= 0.2
        ? {
            titulo: "Ótimo",
            cor: "text-entrada",
            fundo: "bg-entrada/10",
            texto: "Sobrou 20% ou mais do que entrou, como recomendam os especialistas.",
          }
        : parte >= 0.1
          ? {
              titulo: "Bom",
              cor: "text-entrada",
              fundo: "bg-entrada/10",
              texto: "Sobrou entre 10% e 20%: um bom começo. Dá para chegar nos 20%.",
            }
          : {
              titulo: "Aceitável",
              cor: "text-amber-300",
              fundo: "bg-amber-300/10",
              texto: "Fechou no azul, mas com pouca folga (menos de 10% do que entrou).",
            };

  return (
    <div className={`cartao space-y-3 p-5 ${avaliacao.fundo}`}>
      <div className="flex items-baseline justify-between">
        <h3 className="titulo-secao mb-0">Fechamento de {nomeMes(mes).split(" ")[0].toLowerCase()}</h3>
        <span className={`font-display text-lg font-bold ${avaliacao.cor}`}>{avaliacao.titulo}</span>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-suave">Entrou</dt>
        <dd className="text-right tabular-nums text-entrada">{brl(entra)}</dd>
        <dt className="text-suave">Gastos</dt>
        <dd className="text-right tabular-nums text-saida">− {brl(gastos)}</dd>
        <dt className="font-semibold">Sobrou</dt>
        <dd className={`text-right font-semibold tabular-nums ${sobra < 0 ? "text-saida" : "text-entrada"}`}>
          {brl(sobra)} ({Math.round(parte * 100)}%)
        </dd>
        {guardado > 0 && (
          <>
            <dt className="text-suave">…sendo guardado em metas</dt>
            <dd className="text-right tabular-nums">{brl(guardado)}</dd>
          </>
        )}
      </dl>
      <p className="text-xs text-suave">{avaliacao.texto}</p>
    </div>
  );
}

function agruparPorData(eventos: Evento[]) {
  const grupos = new Map<string, Evento[]>();
  for (const e of eventos) grupos.set(e.data, [...(grupos.get(e.data) ?? []), e]);
  return [...grupos.entries()];
}
