"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  definirContaDosLancamentos,
  iconeDaCategoria,
  removerLancamento,
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
  contarExtratoNoSaldo,
  tirarDoExtrato,
  zerarCartao,
} from "@/lib/store";
import FormGastoFixo from "@/components/FormGastoFixo";
import FormSaldo from "@/components/FormSaldo";
import FormConta from "@/components/FormConta";
import FormCompra from "@/components/FormCompra";
import FormPagarFatura from "@/components/FormPagarFatura";
import FormMeta from "@/components/FormMeta";
import FormPagarFixo from "@/components/FormPagarFixo";
import FormLancamento from "@/components/FormLancamento";
import ItemLancamento from "@/components/ItemLancamento";
import EstadoVazio from "@/components/EstadoVazio";
import BotaoImportarExtrato from "@/components/BotaoImportarExtrato";
import { ativoNoMes, descreverCobranca, situacaoDoFixo } from "@/lib/fixos";
import { faturaAberta, faturasAtrasadas, limiteUsado, resumoDaFatura, type ItemFatura, type SituacaoFatura } from "@/lib/cartoes";
import { cartoesDeCredito, contaNoSaldo, ehVale, iconeDaConta, saldoDaConta, temCredito } from "@/lib/contas";
import { calcularMeta } from "@/lib/metas";
import { brl, diasAte, formatarData, hojeISO, nomeMes } from "@/lib/formato";
import { comDesfazer } from "@/lib/avisos";
import Icone from "@/components/Icone";

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
  const [aberta, setAberta] = useState<string | null>(null);
  const [comprando, setComprando] = useState<Conta | null>(null);
  const [pagando, setPagando] = useState<{ cartao: Conta; restante: number; fatura: string } | null>(null);
  const [fixoAberto, setFixoAberto] = useState<GastoFixo | "nova" | "assinatura" | null>(null);
  const [pagandoFixo, setPagandoFixo] = useState<{ fixo: GastoFixo; vencimento: string } | null>(null);
  const [divida, setDivida] = useState<Meta | "nova" | null>(null);
  const [contaDosAntigos, setContaDosAntigos] = useState("");
  const [vendoSemConta, setVendoSemConta] = useState(false);
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

  // Os 4 números: saldo (sem vale), faturas do mês, limite disponível e limite usado
  const saldoTotal = contas.filter((c) => !ehVale(c)).reduce((t, c) => t + saldoDaConta(c, lancamentos), 0);
  const resumos = cartoes.map((c) => ({ cartao: c, fatura: resumoDaFatura(c, mes, dados), usado: limiteUsado(c, dados) }));
  const totalFaturas = resumos.reduce((t, r) => t + r.fatura.valor, 0);
  const totalDisponivel = resumos.reduce((t, r) => t + Math.max(r.cartao.limite - r.usado, 0), 0);
  const totalUsado = resumos.reduce((t, r) => t + r.usado, 0);

  // Fora do cartão, tudo junto: contas fixas (aluguel, luz, transporte…) e dívidas (empréstimo, financiamento…)
  const contasFixas = fixos.filter((f) => f.pagamento !== "cartao" && ativoNoMes(f, mes)).sort((a, b) => a.dia - b.dia);
  const pagamentosDeFixos = [...lancamentos, ...compras.map((c) => ({ ...c, valor: c.valorTotal }))];
  const dividas = metas.filter(
    (m) => m.tipo === "quitar" && !compras.some((c) => c.metaId === m.id) && !calcularMeta(m).concluida,
  );
  const assinaturas = fixos
    .filter((f) => f.pagamento === "cartao" && cartoes.some((c) => c.id === f.cartaoId))
    .sort((a, b) => a.dia - b.dia);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero rotulo="Saldo em conta" valor={saldoTotal} destaque={saldoTotal >= 0} vermelho={saldoTotal < 0} />
        <Numero rotulo={`Faturas de ${nomeMes(mes).split(" ")[0].toLowerCase()}`} valor={totalFaturas} />
        <Numero rotulo="Limite disponível" valor={totalDisponivel} />
        <Numero rotulo="Limite usado" valor={totalUsado} vermelho={totalUsado > 0} />
      </section>

      {contas.length > 0 && <BotaoImportarExtrato />}

      {semConta.length > 0 && contas.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-amber-300/40 bg-amber-300/10 p-3 text-sm">
          <button onClick={() => setVendoSemConta(!vendoSemConta)} className="flex w-full items-center gap-2 text-left">
            <span className="min-w-0 flex-1">
              ⚠️ <b>{semConta.length}</b> {semConta.length === 1 ? "lançamento está" : "lançamentos estão"} sem conta: não sei de
              qual conta {semConta.length === 1 ? "saiu ou entrou" : "saíram ou entraram"}.
            </span>
            <span className="shrink-0 text-xs text-rosa">{vendoSemConta ? "esconder ▴" : "ver quais ▾"}</span>
          </button>
          {vendoSemConta && (
            <ul className="divide-y divide-amber-300/20">
              {semConta
                .slice()
                .sort((x, y) => y.data.localeCompare(x.data))
                .map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-2 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        <Icone e={iconeDaCategoria(l.tipo, l.categoria)} /> {l.descricao}
                      </span>
                      <span className="text-xs text-suave">
                        {formatarData(l.data)} · {l.categoria}
                      </span>
                    </span>
                    <span className={`tabular-nums ${l.tipo === "entrada" ? "text-entrada" : "text-saida"}`}>
                      {l.tipo === "entrada" ? "+" : "−"} {brl(l.valor)}
                    </span>
                    <select
                      value=""
                      onChange={(e) => {
                        const nome = contas.find((c) => c.id === e.target.value)?.nome;
                        comDesfazer(`“${l.descricao}” foi para ${nome}`, () =>
                          definirContaDosLancamentos([l.id], e.target.value),
                        );
                      }}
                      aria-label={`Conta de ${l.descricao}`}
                      className="campo w-auto cursor-pointer py-1 text-xs"
                    >
                      <option value="">Colocar na conta…</option>
                      {contas.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => comDesfazer(`“${l.descricao}” excluído`, () => removerLancamento(l.id))}
                      aria-label={`Excluir ${l.descricao}`}
                      className="text-lg leading-none text-suave hover:text-saida"
                    >
                      ×
                    </button>
                  </li>
                ))}
            </ul>
          )}
          {semConta.some((l) => l.fonteId) && (
            <p className="text-xs text-suave">
              💡 Os que são de renda ficam sem conta porque a renda não diz onde cai. Em{" "}
              <Link href="/renda" className="text-rosa underline">
                Renda
              </Link>
              , edite cada uma e escolha a conta: os próximos meses já caem no lugar certo.
            </p>
          )}
          {semConta.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-suave">Todos de uma vez:</span>
              <select
                value={contaDosAntigos}
                onChange={(e) => setContaDosAntigos(e.target.value)}
                className="campo w-auto cursor-pointer py-1.5"
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
                className="botao-gradiente rounded-full px-4 py-1.5 font-semibold disabled:opacity-40"
              >
                Aplicar
              </button>
            </div>
          )}
        </section>
      )}

      {/* Suas contas: uma linha cada; tocando, abre tudo */}
      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="titulo-secao mb-0">Suas contas</h2>
          <div className="flex gap-2">
            {contas.length >= 2 && (
              <button
                onClick={() => setTransferindo(true)}
                className="rounded-full border border-azul/50 px-3 py-1.5 text-sm text-azul"
              >
                🔁 Transferir
              </button>
            )}
            <button
              onClick={() => setEditando("nova")}
              className="rounded-full border border-rosa/50 px-3 py-1.5 text-sm text-rosa"
            >
              + Conta
            </button>
          </div>
        </div>
        {contas.length > 0 ? (
          <ul className="cartao divide-y divide-white/5 px-4">
            {contas.map((conta) => {
              const resumo = resumos.find((r) => r.cartao.id === conta.id);
              const saldo = saldoDaConta(conta, lancamentos);
              const estaAberta = aberta === conta.id;
              return (
                <li key={conta.id} className="py-3">
                  <button
                    onClick={() => setAberta(estaAberta ? null : conta.id)}
                    aria-expanded={estaAberta}
                    className="flex w-full items-center gap-3 text-left"
                  >
                    <span
                      className="sobre-cor grid size-10 shrink-0 place-items-center rounded-full text-lg"
                      style={{ background: conta.cor }}
                      aria-hidden
                    >
                      <Icone e={iconeDaConta(conta)} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{conta.nome}</span>
                      {resumo && (
                        <span className="block text-xs text-suave">
                          limite {brl(Math.max(conta.limite - resumo.usado, 0))} livre · fecha dia {conta.diaFechamento} · vence
                          dia {conta.diaVencimento}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className={`block font-display font-semibold tabular-nums ${saldo < 0 ? "text-saida" : ""}`}>
                        {brl(saldo)}
                      </span>
                      {resumo && resumo.fatura.valor > 0 && (
                        <span className="block text-xs text-suave">fatura {brl(resumo.fatura.valor)}</span>
                      )}
                    </span>
                    <span className="text-suave" aria-hidden>
                      {estaAberta ? "▴" : "▾"}
                    </span>
                  </button>
                  {estaAberta && (
                    <div className="mt-3">
                      <CartaoConta
                        conta={conta}
                        saldo={saldo}
                        mes={mes}
                        fatura={resumo?.fatura}
                        usado={resumo?.usado ?? 0}
                        onEditar={() => setEditando(conta)}
                        onComprar={() => setComprando(conta)}
                        onPagar={(fatura, restante) => setPagando({ cartao: conta, restante, fatura })}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="cartao">
            <EstadoVazio icone="🏦" titulo="Cadastre suas contas" texto="Banco, carteira, vale… com o saldo de hoje." />
          </div>
        )}
      </section>

      {/* Assinaturas no cartão */}
      {cartoes.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="titulo-secao mb-0">Assinaturas no cartão</h2>
            <button
              onClick={() => setFixoAberto("assinatura")}
              className="rounded-full border border-rosa/50 px-3 py-1.5 text-sm text-rosa"
            >
              + Assinatura
            </button>
          </div>
          {assinaturas.length > 0 ? (
            <ul className="cartao divide-y divide-white/5 px-4">
              {assinaturas.map((f) => (
                <li key={f.id}>
                  <button onClick={() => setFixoAberto(f)} className="flex w-full items-center gap-3 py-3 text-left">
                    <span className="text-lg" aria-hidden>
                      <Icone e={f.icone} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{f.nome}</span>
                      <span className="block text-xs text-suave">
                        💳 {contas.find((c) => c.id === f.cartaoId)?.nome} · {descreverCobranca(f)}
                      </span>
                    </span>
                    <span className="font-display font-semibold tabular-nums">{brl(f.valor)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="cartao p-4 text-sm text-suave">Netflix, Spotify… entram sozinhas na fatura.</p>
          )}
        </section>
      )}

      {/* Fora do cartão: contas fixas e dívidas, juntas */}
      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="titulo-secao mb-0">Contas e dívidas fora do cartão</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setFixoAberto("nova")}
              className="rounded-full border border-rosa/50 px-3 py-1.5 text-sm text-rosa"
            >
              + Conta fixa
            </button>
            <button
              onClick={() => setDivida("nova")}
              className="rounded-full border border-rosa/50 px-3 py-1.5 text-sm text-rosa"
            >
              + Dívida
            </button>
          </div>
        </div>
        {contasFixas.length + dividas.length > 0 ? (
          <ul className="cartao divide-y divide-white/5 px-4">
            {contasFixas.map((f) => {
              const s = situacaoDoFixo(f, mes, pagamentosDeFixos);
              return (
                <li key={f.id} className="flex items-center gap-3 py-3">
                  <button onClick={() => setFixoAberto(f)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span className="text-lg" aria-hidden>
                      <Icone e={f.icone} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{f.nome}</span>
                      <span className={`block text-xs ${s.situacao === "atrasado" ? "text-saida" : "text-suave"}`}>
                        {s.situacao === "pago"
                          ? "pago ✓"
                          : s.situacao === "atrasado"
                            ? `atrasado (${formatarData(s.vencimento)})`
                            : `vence ${formatarData(s.vencimento)}`}
                      </span>
                    </span>
                    <span className="font-display font-semibold tabular-nums">{brl(f.valor)}</span>
                  </button>
                  {s.situacao !== "pago" && (
                    <button
                      onClick={() => setPagandoFixo({ fixo: f, vencimento: s.vencimento })}
                      className="shrink-0 rounded-full bg-entrada/15 px-3 py-1 text-xs font-semibold text-entrada"
                    >
                      Paguei
                    </button>
                  )}
                </li>
              );
            })}
            {dividas.map((m) => {
              const c = calcularMeta(m);
              return (
                <li key={m.id}>
                  <button onClick={() => setDivida(m)} className="flex w-full items-center gap-3 py-3 text-left">
                    <span className="text-lg" aria-hidden>
                      <Icone e={m.icone} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{m.nome}</span>
                      <span className="block text-xs text-suave">
                        {m.parcelasPagas ?? 0}/{m.parcelas} pagas · {brl(m.parcela ?? 0)}/mês
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
          <p className="cartao p-4 text-sm text-suave">Aluguel, luz, internet, transporte, empréstimo…</p>
        )}
      </section>

      {transferindo && <FormLancamento modoInicial="transferencia" onFechar={() => setTransferindo(false)} />}
      {editando && <FormConta conta={editando === "nova" ? undefined : editando} onFechar={() => setEditando(null)} />}
      {fixoAberto === "assinatura" && (
        <FormCompra cartoes={cartoes} tipoInicial="assinatura" onFechar={() => setFixoAberto(null)} />
      )}
      {fixoAberto && fixoAberto !== "assinatura" && (
        <FormGastoFixo fixo={fixoAberto === "nova" ? undefined : fixoAberto} onFechar={() => setFixoAberto(null)} />
      )}
      {pagandoFixo && (
        <FormPagarFixo
          fixo={pagandoFixo.fixo}
          mes={mes}
          vencimento={pagandoFixo.vencimento}
          onFechar={() => setPagandoFixo(null)}
        />
      )}
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

function Numero({
  rotulo,
  valor,
  destaque,
  vermelho,
}: {
  rotulo: string;
  valor: number;
  destaque?: boolean;
  vermelho?: boolean;
}) {
  return (
    <div className="cartao p-4">
      <p className="text-xs text-suave">{rotulo}</p>
      <p
        className={`mt-1 font-display text-xl font-bold tabular-nums ${vermelho ? "text-saida" : destaque ? "gradiente-texto" : ""}`}
      >
        {brl(valor)}
      </p>
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
  // Para zerar o cartão / tirar o que veio do extrato
  const comprasDoCartao = credito ? compras.filter((c) => c.cartaoId === conta.id && !c.metaId).length : 0;
  const doExtrato =
    lancamentos.filter((l) => l.contaId === conta.id && l.importado).length +
    compras.filter((c) => c.cartaoId === conta.id && c.importado).length;
  // Veio do extrato mas não mexe no saldo ("já estava no saldo")
  const foraDoSaldo = lancamentos.filter(
    (l) => l.contaId === conta.id && l.extratoId && l.pago && l.data <= hojeISO() && !contaNoSaldo(l, conta),
  );
  const [avisoFechadoEm, setAvisoFechadoEm] = useState(() => {
    try {
      return Number(localStorage.getItem(`naxxo:aviso-fora-saldo:${conta.id}`)) || 0;
    } catch {
      return 0;
    }
  });
  const efeitoForaDoSaldo = foraDoSaldo.reduce((t, l) => t + (l.tipo === "entrada" ? l.valor : -l.valor), 0);
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
              <Icone e={iconeDaConta(conta)} /> {conta.nome}
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
                        <Icone e={m.item.fixo?.icone ?? iconeDaCategoria("saida", m.item.compra?.categoria ?? "Outros")} />
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

        {foraDoSaldo.length > 0 && avisoFechadoEm !== foraDoSaldo.length && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-300/40 bg-amber-300/10 p-3 text-xs">
            <span className="min-w-0 flex-1">
              ⚠️ {foraDoSaldo.length} movimentaç{foraDoSaldo.length > 1 ? "ões" : "ão"} do extrato não mexe
              {foraDoSaldo.length > 1 ? "m" : ""} no saldo (ficaram como &quot;já estavam no saldo&quot;). Contando, o saldo vai
              para <b>{brl(saldo + efeitoForaDoSaldo)}</b>.
            </span>
            <button
              onClick={() =>
                comDesfazer(`Extrato contado no saldo de ${conta.nome}`, () =>
                  contarExtratoNoSaldo(
                    conta.id,
                    foraDoSaldo.map((l) => l.id),
                  ),
                )
              }
              className="botao-gradiente rounded-full px-3 py-1.5 font-semibold"
            >
              Contar no saldo
            </button>
            <button
              onClick={() => {
                // Fechado: só volta se aparecerem outras movimentações nessa situação
                setAvisoFechadoEm(foraDoSaldo.length);
                try {
                  localStorage.setItem(`naxxo:aviso-fora-saldo:${conta.id}`, String(foraDoSaldo.length));
                } catch {}
              }}
              aria-label="Fechar aviso"
              className="text-lg leading-none text-suave hover:text-white"
            >
              ×
            </button>
          </div>
        )}

        {(comprasDoCartao > 0 || doExtrato > 0) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-white/5 pt-3 text-xs">
            {doExtrato > 0 && (
              <button
                onClick={() => {
                  if (
                    !confirm(
                      `Tirar de ${conta.nome} tudo o que veio do extrato (${doExtrato})? O que você tinha lançado à mão fica.`,
                    )
                  )
                    return;
                  comDesfazer(`Extrato tirado de ${conta.nome}`, () => tirarDoExtrato(conta.id));
                }}
                className="text-suave hover:text-saida"
              >
                ↩️ Tirar o que veio do extrato ({doExtrato})
              </button>
            )}
            {comprasDoCartao > 0 && (
              <button
                onClick={() => {
                  if (
                    !confirm(
                      `Zerar o cartão ${conta.nome}? Saem as ${comprasDoCartao} compras dele (as ligadas a dívidas da Trilha ficam). Dá para desfazer logo depois.`,
                    )
                  )
                    return;
                  comDesfazer(`Cartão ${conta.nome} zerado`, () => zerarCartao(conta.id));
                }}
                className="text-suave hover:text-saida"
              >
                🧹 Zerar cartão ({comprasDoCartao} compras)
              </button>
            )}
          </div>
        )}
      </div>

      {editandoCompra && (
        <FormCompra cartoes={cartoesDeCredito(contas)} compra={editandoCompra} onFechar={() => setEditandoCompra(null)} />
      )}
      {editandoFixo && <FormGastoFixo fixo={editandoFixo} onFechar={() => setEditandoFixo(null)} />}
      {editandoSaldo && <FormSaldo cartao={conta} onFechar={() => setEditandoSaldo(false)} />}
    </article>
  );
}
