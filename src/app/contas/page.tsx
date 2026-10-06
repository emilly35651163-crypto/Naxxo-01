"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  definirContaDosLancamentos,
  iconeDaCategoria,
  useCartoes,
  useCompras,
  useGastosFixos,
  useLancamentos,
  useMes,
  useMetas,
  usePagamentosFatura,
  type CompraCartao,
  type Conta,
  type GastoFixo,
  type Lancamento,
  type Meta,
} from "@/lib/store";
import FormGastoFixo from "@/components/FormGastoFixo";
import FormSaldo from "@/components/FormSaldo";
import FormConta from "@/components/FormConta";
import FormCompra from "@/components/FormCompra";
import FormPagarFatura from "@/components/FormPagarFatura";
import FormMeta from "@/components/FormMeta";
import FormLancamento from "@/components/FormLancamento";
import ItemLancamento from "@/components/ItemLancamento";
import EstadoVazio from "@/components/EstadoVazio";
import { descreverCobranca, mesesEntreCobrancas, valorPorMes } from "@/lib/fixos";
import {
  faturaAberta,
  faturasAtrasadas,
  limiteUsado,
  parcelasPagasDaCompra,
  resumoDaFatura,
  valorDaParcela,
  type ItemFatura,
  type SituacaoFatura,
} from "@/lib/cartoes";
import { cartoesDeCredito, ehVale, iconeDaConta, saldoDaConta, temCredito } from "@/lib/contas";
import { calcularMeta } from "@/lib/metas";
import { brl, diasAte, formatarData, nomeMes } from "@/lib/formato";
import { comDesfazer } from "@/lib/avisos";

const ROTULO_SITUACAO: Record<SituacaoFatura, { texto: string; cor: string }> = {
  aberta: { texto: "Aberta", cor: "bg-azul/20 text-azul" },
  fechada: { texto: "Fechada", cor: "bg-amber-300/15 text-amber-300" },
  futura: { texto: "Futura", cor: "bg-white/10 text-suave" },
  paga: { texto: "Paga ✓", cor: "bg-entrada/15 text-entrada" },
  vazia: { texto: "Sem gastos", cor: "bg-white/10 text-suave" },
};

export default function Contas() {
  const contas = useCartoes();
  const compras = useCompras();
  const fixos = useGastosFixos();
  const pagamentos = usePagamentosFatura();
  const lancamentos = useLancamentos();
  const metas = useMetas();
  const mes = useMes();
  const dados = { compras, fixos, pagamentos };
  const cartoes = cartoesDeCredito(contas);

  const [editando, setEditando] = useState<Conta | "nova" | null>(null);
  const [comprando, setComprando] = useState<Conta | null>(null);
  const [pagando, setPagando] = useState<{ cartao: Conta; restante: number; fatura: string } | null>(null);
  const [assinatura, setAssinatura] = useState<GastoFixo | "nova" | null>(null);
  const [divida, setDivida] = useState<Meta | "nova" | null>(null);
  const [contaDosAntigos, setContaDosAntigos] = useState("");
  const [transferindo, setTransferindo] = useState(false);

  // Chegou do questionário (/contas?nova=1): já abre o cadastro da primeira conta
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("nova") !== "1") return;
    const abrir = setTimeout(() => {
      window.history.replaceState(null, "", "/contas");
      setEditando("nova");
    }, 0);
    return () => clearTimeout(abrir);
  }, []);

  // Lançamentos sem conta (antigos ou de conta excluída): a pessoa escolhe a conta deles
  const idsDasContas = new Set(contas.map((c) => c.id));
  const semConta = lancamentos.filter((l) => !l.contaId || !idsDasContas.has(l.contaId));

  // Saldo em dinheiro (os vales ficam à parte: só pagam comida)
  const saldoTotal = contas.filter((c) => !ehVale(c)).reduce((t, c) => t + saldoDaConta(c, lancamentos), 0);
  const saldoVales = contas.filter(ehVale).reduce((t, c) => t + saldoDaConta(c, lancamentos), 0);
  const resumos = cartoes.map((c) => ({ cartao: c, fatura: resumoDaFatura(c, mes, dados), usado: limiteUsado(c, dados) }));
  const totalFaturas = resumos.reduce((t, r) => t + r.fatura.valor, 0);
  const totalDisponivel = resumos.reduce((t, r) => t + Math.max(r.cartao.limite - r.usado, 0), 0);

  // Dívidas fora do cartão (as do cartão já estão na fatura): o que falta quitar
  const dividas = metas.filter(
    (m) => m.tipo === "quitar" && !compras.some((c) => c.metaId === m.id) && !calcularMeta(m).concluida,
  );
  // + o que falta pagar das compras parceladas no cartão (parcelas que ainda vão vir)
  const parceladoNoCartao = compras
    .filter((c) => c.parcelas > 1)
    .reduce((total, c) => {
      const cartao = cartoes.find((x) => x.id === c.cartaoId);
      if (!cartao) return total;
      const pagas = parcelasPagasDaCompra(c, cartao, dados);
      let falta = 0;
      for (let i = pagas; i < c.parcelas; i++) falta += valorDaParcela(c, i);
      return total + falta;
    }, 0);
  const totalDividas = dividas.reduce((t, m) => t + calcularMeta(m).falta, 0) + parceladoNoCartao;

  // Assinaturas no cartão
  const assinaturas = fixos
    .filter((f) => f.pagamento === "cartao" && cartoes.some((c) => c.id === f.cartaoId))
    .sort((a, b) => a.dia - b.dia);
  const totalAssinaturas = assinaturas.reduce((t, f) => t + valorPorMes(f), 0);

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="cartao p-4">
          <p className="text-xs text-suave">Saldo nas contas</p>
          <p className={`mt-1 font-display text-2xl font-bold tabular-nums ${saldoTotal < 0 ? "text-saida" : "gradiente-texto"}`}>
            {brl(saldoTotal)}
          </p>
          {contas.some(ehVale) && <p className="text-xs text-suave">🍽️ + {brl(saldoVales)} em vale</p>}
        </div>
        <div className="cartao p-4">
          <p className="text-xs text-suave">Faturas que vencem em {nomeMes(mes).toLowerCase()}</p>
          <p className="mt-1 font-display text-xl font-bold tabular-nums">{brl(totalFaturas)}</p>
        </div>
        <div className="cartao p-4">
          <p className="text-xs text-suave">Limite disponível</p>
          <p className="mt-1 font-display text-xl font-bold tabular-nums">{brl(totalDisponivel)}</p>
        </div>
        <div className="cartao p-4">
          <p className="text-xs text-suave">Dívidas a quitar</p>
          <p className="mt-1 font-display text-xl font-bold tabular-nums">{brl(totalDividas)}</p>
          {parceladoNoCartao > 0 && <p className="text-xs text-suave">inclui {brl(parceladoNoCartao)} parcelado no cartão</p>}
        </div>
      </section>

      {/* Lançamentos antigos sem conta */}
      {semConta.length > 0 && contas.length > 0 && (
        <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-300/40 bg-amber-300/10 p-4 text-sm">
          <span className="text-xl">⚠️</span>
          <p className="min-w-0 flex-1">
            <b>{semConta.length} lançamentos sem conta.</b>{" "}
            <span className="text-suave">Escolha a conta de todos de uma vez, ou um por um em </span>
            <Link href="/lancamentos" className="text-rosa">
              Lançamentos
            </Link>
            .
          </p>
          <select
            value={contaDosAntigos}
            onChange={(e) => setContaDosAntigos(e.target.value)}
            className="campo w-auto cursor-pointer py-2 text-sm"
          >
            <option value="">Escolher conta…</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          <button
            disabled={!contaDosAntigos}
            onClick={() => {
              const nome = contas.find((c) => c.id === contaDosAntigos)?.nome;
              comDesfazer(`${semConta.length} lançamentos colocados na conta ${nome}`, () =>
                definirContaDosLancamentos(
                  semConta.map((l) => l.id),
                  contaDosAntigos,
                ),
              );
              setContaDosAntigos("");
            }}
            className="botao-gradiente rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-40"
          >
            Aplicar a todos
          </button>
        </section>
      )}

      {/* Contas */}
      <div className="flex items-center justify-between">
        <h2 className="titulo-secao mb-0">Suas contas</h2>
        <div className="flex gap-2">
          {contas.length >= 2 && (
            <button
              onClick={() => setTransferindo(true)}
              className="rounded-full border border-azul/50 px-4 py-1.5 text-sm text-azul hover:bg-azul/10"
            >
              🔁 Transferir
            </button>
          )}
          <button
            onClick={() => setEditando("nova")}
            className="rounded-full border border-rosa/50 px-4 py-1.5 text-sm text-rosa hover:bg-rosa/10"
          >
            + Nova conta
          </button>
        </div>
      </div>

      {contas.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {contas.map((conta) => {
            const resumo = resumos.find((r) => r.cartao.id === conta.id);
            return (
              <CartaoConta
                key={conta.id}
                conta={conta}
                saldo={saldoDaConta(conta, lancamentos)}
                mes={mes}
                fatura={resumo?.fatura}
                usado={resumo?.usado ?? 0}
                onEditar={() => setEditando(conta)}
                onComprar={() => setComprando(conta)}
                onPagar={(fatura, restante) => setPagando({ cartao: conta, restante, fatura })}
              />
            );
          })}
        </div>
      ) : (
        <div className="cartao">
          <EstadoVazio
            icone="🏦"
            titulo="Cadastre suas contas"
            texto="Banco, conta digital, dinheiro na carteira… Com o saldo de cada uma, tudo o que entra e sai vai direto para o lugar certo."
          />
        </div>
      )}

      {/* Dívidas */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="titulo-secao mb-0">Dívidas e parcelas (fora do cartão)</h2>
          <button
            onClick={() => setDivida("nova")}
            className="rounded-full border border-rosa/50 px-4 py-1.5 text-sm text-rosa hover:bg-rosa/10"
          >
            + Nova dívida
          </button>
        </div>
        {dividas.length > 0 ? (
          <ul className="cartao divide-y divide-white/5 px-4">
            {dividas.map((m) => {
              const c = calcularMeta(m);
              return (
                <li key={m.id}>
                  <button onClick={() => setDivida(m)} className="flex w-full items-center gap-3 py-3 text-left">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-superficie-2 text-lg">
                      {m.icone}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{m.nome}</span>
                      <span className="block text-xs text-suave">
                        {m.parcelasPagas ?? 0} de {m.parcelas} pagas · {brl(m.parcela ?? 0)} por mês
                        {m.contaId && ` · sai de ${contas.find((x) => x.id === m.contaId)?.nome ?? "?"}`}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-display font-semibold tabular-nums">{brl(c.falta)}</span>
                      <span className="block text-xs text-suave">falta</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="cartao p-4 text-sm text-suave">
            Empréstimo, financiamento, algo parcelado no boleto… Compras parceladas no cartão ficam no próprio cartão.
          </p>
        )}
      </section>

      {/* Assinaturas */}
      {cartoes.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="titulo-secao mb-0">Assinaturas no cartão</h2>
            <button
              onClick={() => setAssinatura("nova")}
              className="rounded-full border border-rosa/50 px-4 py-1.5 text-sm text-rosa hover:bg-rosa/10"
            >
              + Nova assinatura
            </button>
          </div>

          {assinaturas.length > 0 ? (
            <div className="cartao p-4">
              <div className="mb-2 flex flex-wrap items-baseline gap-x-6 gap-y-1 px-1">
                <p>
                  <span className="gradiente-texto font-display text-2xl font-bold tabular-nums">{brl(totalAssinaturas)}</span>
                  <span className="text-sm text-suave">
                    {" "}
                    por mês{assinaturas.some((f) => mesesEntreCobrancas(f) > 1) ? " (média)" : ""}
                  </span>
                </p>
                <p className="text-sm text-suave">
                  = <b className="text-white">{brl(totalAssinaturas * 12)}</b> por ano
                </p>
              </div>
              <ul className="divide-y divide-white/5">
                {assinaturas.map((f) => (
                  <li key={f.id}>
                    <button onClick={() => setAssinatura(f)} className="flex w-full items-center gap-3 py-3 text-left">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-superficie-2 text-lg">
                        {f.icone}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{f.nome}</span>
                        <span className="block truncate text-xs text-suave">
                          💳 {contas.find((c) => c.id === f.cartaoId)?.nome ?? "Cartão"} · {descreverCobranca(f)}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-display font-semibold tabular-nums">{brl(f.valor)}</span>
                        {mesesEntreCobrancas(f) > 1 && (
                          <span className="block text-xs text-suave">
                            {f.frequencia === "anual" ? "por ano" : "por semestre"}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="cartao p-4 text-sm text-suave">
              Netflix, Spotify, Prime… cadastre aqui e elas entram sozinhas na fatura.
            </p>
          )}
        </section>
      )}

      {transferindo && <FormLancamento modoInicial="transferencia" onFechar={() => setTransferindo(false)} />}
      {editando && <FormConta conta={editando === "nova" ? undefined : editando} onFechar={() => setEditando(null)} />}
      {assinatura === "nova" && <FormCompra cartoes={cartoes} tipoInicial="assinatura" onFechar={() => setAssinatura(null)} />}
      {assinatura && assinatura !== "nova" && <FormGastoFixo fixo={assinatura} onFechar={() => setAssinatura(null)} />}
      {divida && <FormMeta meta={divida === "nova" ? undefined : divida} tipoInicial="quitar" onFechar={() => setDivida(null)} />}
      {comprando && <FormCompra cartoes={cartoes} cartaoInicial={comprando} onFechar={() => setComprando(null)} />}
      {pagando && (
        <FormPagarFatura
          cartao={pagando.cartao}
          fatura={pagando.fatura}
          restante={pagando.restante}
          onFechar={() => setPagando(null)}
        />
      )}
    </div>
  );
}

function CartaoConta({
  conta,
  saldo,
  mes,
  fatura,
  usado,
  onEditar,
  onComprar,
  onPagar,
}: {
  conta: Conta;
  saldo: number;
  mes: string;
  fatura?: ReturnType<typeof resumoDaFatura>;
  usado: number;
  onEditar: () => void;
  onComprar: () => void;
  onPagar: (fatura: string, restante: number) => void;
}) {
  const [aberta, setAberta] = useState(false);
  const [editandoCompra, setEditandoCompra] = useState<CompraCartao | null>(null);
  const [editandoFixo, setEditandoFixo] = useState<GastoFixo | null>(null);
  const [editandoSaldo, setEditandoSaldo] = useState(false);
  const contas = useCartoes();
  const compras = useCompras();
  const fixos = useGastosFixos();
  const lancamentos = useLancamentos();
  const credito = temCredito(conta) && fatura;
  const pagamentos = usePagamentosFatura();
  // Faturas de meses anteriores que ficaram sem pagar
  const atrasadas = credito ? faturasAtrasadas(conta, { compras, fixos, pagamentos }) : [];
  const disponivel = Math.max(conta.limite - usado, 0);
  const uso = conta.limite > 0 ? Math.min(usado / conta.limite, 1) : 0;

  // Tudo o que mexeu nesta conta no mês, numa lista só: débito/Pix/transferências + o que está na fatura do cartão
  type Movimento =
    | { chave: string; data: string; lancamento: Lancamento; item?: undefined }
    | { chave: string; data: string; lancamento?: undefined; item: ItemFatura & { compra?: CompraCartao; fixo?: GastoFixo } };
  const movimentos: Movimento[] = [
    ...lancamentos
      .filter((l) => l.contaId === conta.id && l.data.startsWith(mes))
      .map((l) => ({ chave: l.id, data: l.data, lancamento: l })),
    ...(credito ? fatura.itens : []).map((item) => {
      const compra = compras.find((c) => c.id === item.compraId);
      const fixo = fixos.find((x) => x.id === item.fixoId);
      const data = compra?.data ?? `${mes}-${String(fixo?.dia ?? 1).padStart(2, "0")}`;
      return { chave: item.chave, data, item: { ...item, compra, fixo } };
    }),
  ].sort((a, b) => b.data.localeCompare(a.data));

  return (
    <article className="space-y-4">
      {/* A conta desenhada */}
      <div
        className="sobre-cor relative overflow-hidden rounded-3xl p-5 shadow-[0_10px_40px_-10px_rgb(139_92_246/0.5)]"
        style={{ background: conta.cor }}
      >
        <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 size-44 rounded-full bg-black/10" />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="font-display text-lg font-bold">
              {iconeDaConta(conta)} {conta.nome}
            </p>
            {credito && (
              <p className="text-xs text-white/75">
                Cartão fecha dia {conta.diaFechamento} · vence dia {conta.diaVencimento}
              </p>
            )}
          </div>
          <button onClick={onEditar} className="rounded-full bg-black/20 px-3 py-1 text-xs hover:bg-black/30">
            Editar
          </button>
        </div>

        <div className="relative mt-5 flex items-end justify-between gap-4">
          <button onClick={() => setEditandoSaldo(true)} className="text-left" title="Conferir o saldo">
            <span className="block text-xs text-white/75">Saldo</span>
            <span className={`block font-display text-3xl font-bold tabular-nums ${saldo < 0 ? "text-red-200" : ""}`}>
              {brl(saldo)}
            </span>
          </button>
          {credito && (
            <div className="text-right">
              <span className="block text-[0.65rem] text-white/75">Fatura de {nomeMes(mes).toLowerCase()}</span>
              <span className="block font-display text-lg font-semibold tabular-nums">{brl(fatura.valor)}</span>
            </div>
          )}
        </div>

        {credito && (
          <div className="relative mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-black/25">
              <div className="h-full rounded-full bg-white/90" style={{ width: `${uso * 100}%` }} />
            </div>
            <div className="mt-1.5 flex justify-between text-xs text-white/85">
              <span>Limite usado {brl(usado)}</span>
              <span>Disponível {brl(disponivel)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Detalhes */}
      <div className="cartao space-y-4 p-4">
        {credito && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded-full px-3 py-1 font-medium ${ROTULO_SITUACAO[fatura.situacao].cor}`}>
                {ROTULO_SITUACAO[fatura.situacao].texto}
              </span>
              {fatura.situacao === "aberta" && <span className="text-suave">fecha em {formatarData(fatura.fechamento)}</span>}
              {fatura.situacao !== "paga" && fatura.situacao !== "vazia" && (
                <span className={diasAte(fatura.vencimento) < 0 ? "text-saida" : "text-suave"}>
                  vence em {formatarData(fatura.vencimento)}
                </span>
              )}
              {fatura.pago > 0 && fatura.situacao !== "paga" && <span className="text-entrada">{brl(fatura.pago)} já pago</span>}
            </div>

            {atrasadas.map((a) => (
              <div
                key={a.fatura}
                className="flex items-center gap-3 rounded-2xl border border-saida/40 bg-saida/10 px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1">
                  ⏰ Fatura de {nomeMes(a.fatura).toLowerCase()} <b>atrasada</b>: falta {brl(a.restante)}
                  <span className="block text-xs text-suave">venceu em {formatarData(a.vencimento)}</span>
                </span>
                <button
                  onClick={() => onPagar(a.fatura, a.restante)}
                  className="shrink-0 rounded-full border border-saida/50 px-3 py-1 text-xs text-saida"
                >
                  Paguei
                </button>
              </div>
            ))}

            <div className="flex gap-2">
              <button onClick={onComprar} className="botao-gradiente flex-1 rounded-full py-2.5 text-sm font-semibold">
                + Incluir no cartão
              </button>
              {fatura.restante > 0.005 && (
                <button
                  onClick={() => onPagar(mes, fatura.restante)}
                  className="flex-1 rounded-full border border-rosa/50 py-2.5 text-sm text-rosa hover:bg-rosa/10"
                >
                  {mes === faturaAberta(conta) ? "Adiantar fatura" : "Pagar fatura"}
                </button>
              )}
            </div>
          </>
        )}

        {/* Movimentações do mês: conta e cartão juntos, tudo editável */}
        <div>
          {/* Fechada por padrão, para a página ficar organizada; abre tudo de uma vez */}
          <button
            onClick={() => setAberta(!aberta)}
            disabled={movimentos.length === 0}
            className="flex w-full items-center justify-between gap-2 rounded-xl py-1 text-left text-sm disabled:cursor-default"
          >
            <span className="text-suave">
              Movimentações de {nomeMes(mes).toLowerCase()}
              {movimentos.length > 0 && (
                <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-xs">{movimentos.length}</span>
              )}
            </span>
            {movimentos.length > 0 ? (
              <span className="text-rosa">{aberta ? "Esconder ▴" : "Ver ▾"}</span>
            ) : (
              <span className="text-xs text-suave">nada ainda</span>
            )}
          </button>
          {aberta && movimentos.length > 0 && (
            <ul className="mt-1 divide-y divide-white/5">
              {movimentos.map((m) =>
                m.lancamento ? (
                  <ItemLancamento
                    key={m.chave}
                    lancamento={m.lancamento}
                    daConta={conta.id}
                    contas={contas}
                    lancamentos={lancamentos}
                  />
                ) : (
                  <li key={m.chave}>
                    <button
                      onClick={() => {
                        if (m.item.compra) setEditandoCompra(m.item.compra);
                        else if (m.item.fixo) setEditandoFixo(m.item.fixo);
                      }}
                      className="group flex w-full items-center gap-3 py-3 text-left"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-superficie-2 text-lg">
                        {m.item.fixo?.icone ?? iconeDaCategoria("saida", m.item.compra?.categoria ?? "Outros")}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium group-hover:text-rosa">{m.item.descricao}</span>
                        <span className="block text-xs text-suave">
                          💳 crédito · {m.item.detalhe}
                          {m.item.compra && ` · ${formatarData(m.item.compra.data)}`}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-display font-semibold tabular-nums">{brl(m.item.valor)}</span>
                        <span className="text-xs text-suave group-hover:text-white">editar</span>
                      </span>
                    </button>
                  </li>
                ),
              )}
            </ul>
          )}
        </div>
      </div>

      {editandoCompra && (
        <FormCompra cartoes={cartoesDeCredito(contas)} compra={editandoCompra} onFechar={() => setEditandoCompra(null)} />
      )}
      {editandoFixo && <FormGastoFixo fixo={editandoFixo} onFechar={() => setEditandoFixo(null)} />}
      {editandoSaldo && <FormSaldo cartao={conta} onFechar={() => setEditandoSaldo(false)} />}
    </article>
  );
}
