"use client";

import { useState } from "react";
import {
  CATEGORIAS_FIXO,
  FORMAS_PAGAMENTO,
  somar,
  useCartoes,
  useCompras,
  useFontes,
  useGastosFixos,
  useLancamentos,
  useMes,
  type GastoFixo,
} from "@/lib/store";
import Link from "next/link";
import { gastosDoMes } from "@/lib/analise";
import { rendaMensal } from "@/lib/renda";
import { useDados } from "@/lib/dados";
import { descreverCobranca, fixosDoMes, porIntervalo, situacaoDoFixo, valorNoMes } from "@/lib/fixos";
import { brl, formatarData, nomeMes } from "@/lib/formato";
import FormGastoFixo from "@/components/FormGastoFixo";
import FormPagarFixo from "@/components/FormPagarFixo";
import EstadoVazio from "@/components/EstadoVazio";
import Icone from "@/components/Icone";

export default function Fixos() {
  const todos = useGastosFixos();
  const lancamentos = useLancamentos();
  const compras = useCompras();
  const cartoes = useCartoes();
  const fontes = useFontes();
  const dados = useDados();
  const mes = useMes();
  const [editando, setEditando] = useState<GastoFixo | "novo" | null>(null);
  const [pagando, setPagando] = useState<{ fixo: GastoFixo; vencimento: string } | null>(null);

  const fixos = fixosDoMes(todos, mes);
  const foraDoMes = todos.filter((f) => !fixos.includes(f));
  const situacoes = new Map(
    fixos.map((f) => [f.id, situacaoDoFixo(f, mes, [...lancamentos, ...compras.map((c) => ({ ...c, valor: c.valorTotal }))])]),
  );

  // Mercado (alimentação): quase fixo. Usa a mesma conta do Resumo: o que já foi gasto + compras programadas,
  // compras no cartão e a reposição prevista pela aba Mercado
  const mercado = gastosDoMes(mes, dados).filter((g) => g.categoria === "Mercado");
  const mercadoGasto = somar(mercado.filter((g) => !g.previsto));
  const mercadoPrevisto = somar(mercado.filter((g) => g.previsto));
  const mercadoDoMes = mercadoGasto + mercadoPrevisto;

  // No mês: o valor × quantas vezes cai (gasolina a cada 15 dias = 2 vezes), mais o mercado
  const total = fixos.reduce((t, f) => t + valorNoMes(f, mes), 0) + mercadoDoMes;
  const pago = somar(
    lancamentos.filter((l) => l.gastoFixoId && l.data.startsWith(mes) && fixos.some((f) => f.id === l.gastoFixoId)),
  );
  const noCartao = fixos.filter((f) => f.pagamento === "cartao").reduce((t, f) => t + valorNoMes(f, mes), 0);
  const falta = Math.max(total - pago - noCartao - mercadoGasto, 0);
  // Só dinheiro (os vales VR/VA não pagam aluguel nem conta de luz)
  const renda = fontes.reduce((t, f) => t + rendaMensal(f, true), 0);
  const parteDaRenda = renda > 0 ? total / renda : null;

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="cartao p-4">
          <p className="text-xs text-suave">Fixos por mês</p>
          <p className="gradiente-texto mt-1 font-display text-xl font-bold tabular-nums">{brl(total)}</p>
          {noCartao > 0 && <p className="text-xs text-suave">{brl(noCartao)} no cartão</p>}
        </div>
        <div className="cartao p-4">
          <p className="text-xs text-suave">Falta pagar em {nomeMes(mes).toLowerCase()}</p>
          <p className={`mt-1 font-display text-xl font-bold tabular-nums ${falta > 0 ? "" : "text-entrada"}`}>
            {falta > 0 ? brl(falta) : "Tudo pago ✓"}
          </p>
          <p className="text-xs text-suave">{brl(pago)} já pago</p>
        </div>
        <div className="cartao p-4">
          <p className="text-xs text-suave">Do que entra por mês</p>
          {parteDaRenda !== null ? (
            <>
              <p className={`mt-1 font-display text-xl font-bold tabular-nums ${parteDaRenda > 0.6 ? "text-saida" : ""}`}>
                {Math.round(parteDaRenda * 100)}%
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full ${parteDaRenda > 0.6 ? "bg-saida" : "bg-linear-to-r from-rosa via-roxo to-azul"}`}
                  style={{ width: `${Math.min(parteDaRenda, 1) * 100}%` }}
                />
              </div>
            </>
          ) : (
            <p className="mt-1 text-sm text-suave">Cadastre o que entra na aba Renda</p>
          )}
        </div>
      </section>

      <div className="flex items-center justify-between">
        <h2 className="titulo-secao mb-0">Seus gastos fixos</h2>
        <button
          onClick={() => setEditando("novo")}
          className="rounded-full border border-rosa/50 px-4 py-1.5 text-sm text-rosa hover:bg-rosa/10"
        >
          + Novo gasto fixo
        </button>
      </div>

      {/* Mercado / alimentação: vem da aba Mercado */}
      <Link href="/mercado" className="cartao flex items-center gap-3 p-4 hover:border-rosa/50">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-superficie-2 text-lg">🛒</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Mercado / alimentação</span>
          <span className="block text-xs text-suave">
            {mercadoGasto > 0 ? `${brl(mercadoGasto)} já gasto · ` : ""}
            {mercadoPrevisto > 0
              ? `${brl(mercadoPrevisto)} previsto${mercado.some((g) => g.previsto && g.lancamento) ? " (compra programada)" : ""}`
              : "nada previsto ainda (aba Mercado)"}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-display font-semibold tabular-nums">≈ {brl(mercadoDoMes)}</span>
          <span className="block text-xs text-rosa">ver mercado ›</span>
        </span>
      </Link>

      {fixos.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {CATEGORIAS_FIXO.map((categoria) => {
            const daCategoria = fixos.filter((f) => f.categoria === categoria.id).sort((a, b) => a.dia - b.dia);
            if (daCategoria.length === 0) return null;
            return (
              <section key={categoria.id} className="cartao p-4">
                <div className="mb-1 flex items-baseline justify-between px-1">
                  <h3 className="font-semibold">
                    <Icone e={categoria.icone} /> {categoria.nome}
                  </h3>
                  <span className="text-sm tabular-nums text-suave">
                    {brl(daCategoria.reduce((t, f) => t + valorNoMes(f, mes), 0))}
                  </span>
                </div>
                <ul className="divide-y divide-white/5">
                  {daCategoria.map((f) => (
                    <LinhaFixo
                      key={f.id}
                      fixo={f}
                      situacao={situacoes.get(f.id)!}
                      nomeCartao={cartoes.find((c) => c.id === f.cartaoId)?.nome}
                      onPagar={() => setPagando({ fixo: f, vencimento: situacoes.get(f.id)!.vencimento })}
                      onEditar={() => setEditando(f)}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="cartao">
          <EstadoVazio
            icone="📌"
            titulo="Nenhum gasto fixo ainda"
            texto="Aluguel, contas da casa, Netflix, academia… tudo o que se repete todo mês. Toque em “+ Novo gasto fixo”."
          />
        </div>
      )}

      {/* Os que não cobram neste mês: começam depois, foram cancelados ou estão pausados */}
      {foraDoMes.length > 0 && (
        <section>
          <h2 className="titulo-secao">Fora de {nomeMes(mes).split(" ")[0].toLowerCase()}</h2>
          <ul className="cartao divide-y divide-white/5 px-4">
            {foraDoMes.map((f) => (
              <li key={f.id}>
                <button onClick={() => setEditando(f)} className="flex w-full items-center gap-3 py-3 text-left">
                  <span
                    className="grid size-10 shrink-0 place-items-center rounded-full bg-superficie-2 text-lg opacity-60"
                    aria-hidden
                  >
                    <Icone e={f.icone} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{f.nome}</span>
                    <span className="block text-xs text-suave">
                      {f.desde > mes
                        ? `começa em ${nomeMes(f.desde).toLowerCase()}`
                        : f.ate && mes > f.ate
                          ? `cancelado (última cobrança em ${nomeMes(f.ate).toLowerCase()})`
                          : (f.pausas ?? []).includes(mes)
                            ? "pausado neste mês"
                            : "não cobra neste mês (semestral/anual)"}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-suave">{brl(f.valor)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {editando && <FormGastoFixo fixo={editando === "novo" ? undefined : editando} onFechar={() => setEditando(null)} />}
      {pagando && (
        <FormPagarFixo fixo={pagando.fixo} mes={mes} vencimento={pagando.vencimento} onFechar={() => setPagando(null)} />
      )}
    </div>
  );
}

function LinhaFixo({
  fixo,
  situacao: s,
  nomeCartao,
  onPagar,
  onEditar,
}: {
  fixo: GastoFixo;
  situacao: ReturnType<typeof situacaoDoFixo>;
  nomeCartao?: string;
  onPagar: () => void;
  onEditar: () => void;
}) {
  const forma = FORMAS_PAGAMENTO.find((p) => p.id === fixo.pagamento);
  const valor = s.situacao === "pago" && s.pagamento ? s.pagamento.valor : fixo.valor;

  return (
    <li className="flex items-center gap-3 py-3">
      <button onClick={onEditar} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Editar ${fixo.nome}`}>
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-superficie-2 text-lg">
          <Icone e={fixo.icone} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{fixo.nome}</span>
          <span className="block truncate text-xs text-suave">
            {fixo.pagamento === "cartao"
              ? `💳 ${nomeCartao ?? "Cartão"} · ${porIntervalo(fixo) ? descreverCobranca(fixo) : `cobra dia ${fixo.dia}`}`
              : `${forma?.icone} ${porIntervalo(fixo) ? `${descreverCobranca(fixo)} · próxima` : "vence"} ${formatarData(s.vencimento)}`}
            {fixo.frequencia && fixo.frequencia !== "mensal" && !porIntervalo(fixo) && ` · ${fixo.frequencia}`}
          </span>
        </span>
      </button>

      <div className="shrink-0 text-right">
        <p className="font-display font-semibold tabular-nums">
          {fixo.varia && s.situacao !== "pago" ? "≈ " : ""}
          {brl(valor)}
          {s.vezes > 1 && <span className="text-xs font-normal text-suave"> ×{s.vezes}</span>}
        </p>
        {s.vezes > 1 && s.situacao !== "cartao" && s.situacao !== "pago" && (
          <span className="block text-xs text-suave">
            {s.pagos} de {s.vezes} pagas
          </span>
        )}
        {s.situacao === "pago" && <span className="text-xs text-entrada">✓ pago</span>}
        {s.situacao === "cartao" && <span className="text-xs text-suave">na fatura</span>}
        {(s.situacao === "pendente" || s.situacao === "hoje" || s.situacao === "atrasado") && (
          <button
            onClick={onPagar}
            className={`text-xs font-medium ${
              s.situacao === "atrasado" ? "text-saida" : s.situacao === "hoje" ? "text-amber-300" : "text-rosa"
            }`}
          >
            {s.situacao === "atrasado" ? "atrasado · paguei" : s.situacao === "hoje" ? "vence hoje · paguei" : "paguei"}
          </button>
        )}
      </div>
    </li>
  );
}
