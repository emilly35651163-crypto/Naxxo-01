"use client";

import Link from "next/link";
import {
  maisRecentesPrimeiro,
  mudarPreferencias,
  useMes,
  useOrcamentos,
  usePerfil,
  usePreferencias,
  jaAconteceu,
} from "@/lib/store";
import { ehVale, iconeDaConta, saldoDaConta, saldoDosVales, saldoTotal, temCredito } from "@/lib/contas";
import { previstosDoMes, resumoDoMes } from "@/lib/previstos";
import { despesasPorCategoria } from "@/lib/analise";
import { calcularMeta } from "@/lib/metas";
import { useDados } from "@/lib/dados";
import { brl, diasAte, formatarData, mesAtual, nomeMes } from "@/lib/formato";
import ItemLancamento from "@/components/ItemLancamento";
import EstadoVazio from "@/components/EstadoVazio";

export default function Inicio() {
  const dados = useDados();
  const mes = useMes();
  const perfil = usePerfil();
  const prefs = usePreferencias();
  const orcamentos = useOrcamentos();
  const objetivos = perfil?.objetivos ?? [];

  // Saldo de hoje: a soma do saldo das contas (os vales aparecem à parte: não são dinheiro livre)
  const saldo = saldoTotal(dados.cartoes, dados.lancamentos);
  const vales = saldoDosVales(dados.cartoes, dados.lancamentos);

  // O mês, com a mesma conta de todas as telas (sem transferências, metas e vales)
  const r = resumoDoMes(mes, dados);
  const previstos = previstosDoMes(mes, dados);
  const vaiGuardar = previstos.filter((p) => p.origem === "guardar").reduce((t, p) => t + p.valor, 0);
  const mercado = previstos.filter((p) => p.origem === "mercado").reduce((t, p) => t + p.valor, 0);
  const proximos = previstos.filter((p) => p.tipo === "saida" && p.origem !== "guardar").slice(0, 5);
  const ultimos = dados.lancamentos
    .filter((l) => l.data.startsWith(mes) && jaAconteceu(l))
    .sort(maisRecentesPrimeiro)
    .slice(0, 5);

  // Primeiros passos: o que falta para o app ficar completo
  const passos = [
    { feito: dados.cartoes.length > 0, texto: "Cadastrar suas contas e o saldo de cada uma", href: "/contas" },
    { feito: dados.fixos.length > 0, texto: "Cadastrar os gastos fixos (aluguel, luz, assinaturas…)", href: "/fixos" },
    {
      feito: dados.cartoes.some(temCredito) || !!prefs.semCartao,
      texto: "Cadastrar o cartão de crédito (ou dizer que não tem)",
      href: "/contas",
      semCartao: true,
    },
    {
      feito: dados.lancamentos.some((l) => l.tipo === "entrada"),
      texto: "Registrar a primeira entrada (salário, freela…)",
      href: "/renda",
    },
  ];
  const faltam = passos.filter((p) => !p.feito).length;

  // Personalizado pelos objetivos do questionário
  const maiores = despesasPorCategoria(mes, dados).slice(0, 3);
  const metasAtivas = dados.metas.filter((m) => !m.arquivada && !calcularMeta(m).concluida);
  const reserva = dados.metas.find((m) => m.reserva);

  return (
    <div className="space-y-6">
      {perfil?.nome && (
        <p className="font-display text-xl">
          Oi, <span className="gradiente-texto font-semibold">{perfil.nome.split(" ")[0]}</span> 👋
        </p>
      )}

      {/* Checklist dos primeiros passos */}
      {faltam > 0 && !prefs.checklistFechado && (
        <section className="cartao p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display font-semibold">🚀 Primeiros passos</h2>
            <span className="text-xs text-suave">
              {passos.length - faltam} de {passos.length}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-linear-to-r from-rosa via-roxo to-azul"
              style={{ width: `${((passos.length - faltam) / passos.length) * 100}%` }}
            />
          </div>
          <ul className="mt-3 space-y-1.5 text-sm">
            {passos.map((p) => (
              <li key={p.texto} className="flex items-center gap-2">
                <span aria-hidden>{p.feito ? "✅" : "⬜"}</span>
                {p.feito ? (
                  <span className="text-suave line-through">{p.texto}</span>
                ) : (
                  <>
                    <Link href={p.href} className="min-w-0 flex-1 hover:text-rosa">
                      {p.texto} <span className="text-rosa">›</span>
                    </Link>
                    {p.semCartao && (
                      <button
                        onClick={() => mudarPreferencias({ semCartao: true })}
                        className="shrink-0 text-xs text-suave hover:text-white"
                      >
                        não tenho
                      </button>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
          <button
            onClick={() => mudarPreferencias({ checklistFechado: true })}
            className="mt-3 text-xs text-suave hover:text-white"
          >
            Esconder
          </button>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="cartao relative overflow-hidden p-5 lg:col-span-2 lg:p-7">
          <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-rosa/20 blur-3xl" />
          <Link href="/contas" className="text-sm text-suave hover:text-rosa">
            Saldo hoje (contas) ›
          </Link>
          <p className={`mt-1 font-display text-4xl font-bold tabular-nums ${saldo < 0 ? "text-saida" : ""}`}>{brl(saldo)}</p>
          {dados.cartoes.some(ehVale) && <p className="text-xs text-suave">🍽️ + {brl(vales)} em vale (só para comida)</p>}

          <div className="mt-5 grid grid-cols-2 gap-4">
            <div>
              <p className="flex items-center gap-1.5 text-xs text-suave">
                <span className="size-2 rounded-full bg-entrada" /> Entrou em {nomeMes(mes).split(" ")[0].toLowerCase()}
              </p>
              <p className="font-display font-semibold tabular-nums text-entrada">{brl(r.entrou)}</p>
              {r.vaiEntrar > 0 && <p className="text-xs tabular-nums text-amber-300">+ {brl(r.vaiEntrar)} ainda vai entrar</p>}
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-xs text-suave">
                <span className="size-2 rounded-full bg-saida" /> Saiu
              </p>
              <p className="font-display font-semibold tabular-nums text-saida">{brl(r.saiu)}</p>
              {r.vaiSair > 0 && <p className="text-xs tabular-nums text-amber-300">+ {brl(r.vaiSair)} ainda vai sair</p>}
              {mercado > 0 && <p className="text-xs text-suave">🛒 inclui {brl(mercado)} de mercado previsto</p>}
            </div>
          </div>

          <div className="mt-4 space-y-1 border-t border-white/10 pt-3 text-sm">
            <p className="flex items-center justify-between">
              <span className="text-suave">Sobra prevista no fim do mês</span>
              <span className={`font-semibold tabular-nums ${r.sobra >= 0 ? "text-entrada" : "text-saida"}`}>
                {r.sobra > 0 ? "+ " : ""}
                {brl(r.sobra)}
              </span>
            </p>
            {(r.guardado > 0 || vaiGuardar > 0) && (
              <p className="flex items-center justify-between text-xs text-suave">
                <span>
                  🎯 Metas: {brl(Math.max(r.guardado, 0))} guardado{vaiGuardar > 0 ? ` · ${brl(vaiGuardar)} a guardar` : ""}
                </span>
                <Link href="/trilha" className="text-rosa">
                  Trilha ›
                </Link>
              </p>
            )}
          </div>
        </section>

        <Link href="/lancamentos" className="cartao flex flex-col p-4 hover:border-rosa/50 lg:p-6">
          <p className="text-xs text-suave lg:text-sm">Próximas contas</p>
          {proximos.length > 0 ? (
            <ul className="mt-2 space-y-2 text-sm">
              {proximos.map((p) => {
                const dias = diasAte(p.data);
                const atrasada = dias < 0 || !!p.item?.atrasado;
                return (
                  <li key={p.chave} className="flex items-center gap-2">
                    <span>{p.icone}</span>
                    <span className={`min-w-0 flex-1 truncate ${atrasada ? "text-saida" : ""}`}>{p.nome}</span>
                    <span
                      className={`text-xs ${atrasada ? "font-semibold text-saida" : dias <= 3 ? "text-amber-300" : "text-suave"}`}
                    >
                      {atrasada ? `era para ${formatarData(p.data)}` : dias === 0 ? "hoje" : formatarData(p.data)}
                    </span>
                    <span className="tabular-nums text-saida">{brl(p.valor)}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-suave">Nada para pagar. ✨</p>
          )}
          <span className="mt-auto pt-3 text-sm text-rosa">Ver tudo em Lançamentos ›</span>
        </Link>
      </div>

      {/* Contas, metas e o que os objetivos pedem (no computador, lado a lado) */}
      <div className="grid gap-6 lg:grid-cols-3">
        {dados.cartoes.length > 0 && (
          <Link href="/contas" className="cartao block p-5 hover:border-rosa/50">
            <h2 className="titulo-secao">Suas contas</h2>
            <ul className="space-y-1.5 text-sm">
              {dados.cartoes.map((c) => {
                const s = saldoDaConta(c, dados.lancamentos);
                return (
                  <li key={c.id} className="flex items-center gap-2">
                    <span>{iconeDaConta(c)}</span>
                    <span className="min-w-0 flex-1 truncate">{c.nome}</span>
                    <span className={`tabular-nums ${s < 0 ? "text-saida" : ""}`}>{brl(s)}</span>
                  </li>
                );
              })}
            </ul>
          </Link>
        )}

        {metasAtivas.length > 0 && (
          <Link href="/trilha" className="cartao block p-5 hover:border-rosa/50">
            <h2 className="titulo-secao">Suas metas</h2>
            <ul className="space-y-3 text-sm">
              {metasAtivas.slice(0, 3).map((m) => {
                const c = calcularMeta(m);
                return (
                  <li key={m.id}>
                    <div className="flex justify-between gap-2">
                      <span className="truncate">
                        {m.icone} {m.nome}
                      </span>
                      <span className="text-suave tabular-nums">{Math.round(c.progresso * 100)}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-linear-to-r from-rosa via-roxo to-azul"
                        style={{ width: `${c.progresso * 100}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Link>
        )}

        {/* Economizar / me organizar: onde mais está indo o dinheiro, com o limite de cada categoria */}
        {(objetivos.includes("economizar") || objetivos.includes("organizar")) && maiores.length > 0 && (
          <section className="cartao p-5">
            <h2 className="titulo-secao">Onde mais está indo o dinheiro</h2>
            <ul className="space-y-2.5 text-sm">
              {maiores.map((c) => {
                const limite = orcamentos[c.categoria];
                return (
                  <li key={c.categoria}>
                    <Link
                      href={`/resumo/categoria?nome=${encodeURIComponent(c.categoria)}`}
                      className="flex justify-between gap-2 hover:text-rosa"
                    >
                      <span>{c.categoria}</span>
                      <span className={`tabular-nums ${limite && c.valor > limite ? "text-saida" : ""}`}>
                        {brl(c.valor)}
                        {limite ? <span className="text-xs text-suave"> / {brl(limite)}</span> : null}
                      </span>
                    </Link>
                    {limite ? (
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full rounded-full ${c.valor > limite ? "bg-saida" : "bg-entrada/80"}`}
                          style={{ width: `${Math.min(c.valor / limite, 1) * 100}%` }}
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-suave">Toque numa categoria para ver o que foi e definir um limite por mês.</p>
          </section>
        )}

        {/* Começar a investir: primeiro a reserva */}
        {objetivos.includes("investir") && (
          <section className="cartao p-5 text-sm">
            <h2 className="titulo-secao">📈 Começar a investir</h2>
            {reserva && !calcularMeta(reserva).concluida ? (
              <p className="text-suave">
                O primeiro passo de quem investe é a <b className="text-white">reserva de emergência</b> (está em{" "}
                {Math.round(calcularMeta(reserva).progresso * 100)}%). Com ela pronta, o dinheiro que sobra pode ir para
                investimentos de longo prazo.{" "}
                <Link href="/trilha" className="text-rosa">
                  Ver reserva ›
                </Link>
              </p>
            ) : reserva ? (
              <p className="text-suave">
                Reserva pronta! 🎉 O que sobrar todo mês pode ir para investimentos. Crie uma meta “Investir” na Trilha para
                acompanhar.
              </p>
            ) : (
              <p className="text-suave">
                Antes de investir, monte uma reserva de emergência (dinheiro para imprevistos).{" "}
                <Link href="/trilha" className="text-rosa">
                  Criar na Trilha ›
                </Link>
              </p>
            )}
          </section>
        )}

        {/* Sair das dívidas */}
        {objetivos.includes("dividas") && (
          <Link href="/contas" className="cartao block p-5 text-sm hover:border-rosa/50">
            <h2 className="titulo-secao">🔓 Sair das dívidas</h2>
            {dados.metas.filter((m) => m.tipo === "quitar" && !calcularMeta(m).concluida).length > 0 ? (
              <p className="text-suave">
                Falta quitar{" "}
                <b className="text-white">
                  {brl(dados.metas.filter((m) => m.tipo === "quitar").reduce((t, m) => t + calcularMeta(m).falta, 0))}
                </b>
                . Pagar as parcelas em dia evita juros e multa.
              </p>
            ) : (
              <p className="text-suave">Cadastre suas dívidas em Contas para acompanhar quanto falta.</p>
            )}
          </Link>
        )}
      </div>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="titulo-secao">Últimos lançamentos</h2>
          {ultimos.length > 0 && (
            <Link href="/lancamentos" className="text-xs text-rosa">
              ver todos
            </Link>
          )}
        </div>
        {ultimos.length > 0 ? (
          <ul className="cartao divide-y divide-white/5 px-4">
            {ultimos.map((l) => (
              <ItemLancamento key={l.id} lancamento={l} contas={dados.cartoes} lancamentos={dados.lancamentos} />
            ))}
          </ul>
        ) : (
          <div className="cartao">
            <EstadoVazio
              icone="✨"
              titulo="Comece por aqui"
              texto={
                mes === mesAtual()
                  ? "Toque no + lá em cima para registrar sua primeira entrada ou saída."
                  : "Nada registrado neste mês."
              }
            />
          </div>
        )}
      </section>
    </div>
  );
}
