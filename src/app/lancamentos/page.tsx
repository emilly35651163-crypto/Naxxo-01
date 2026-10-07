"use client";

import { useState } from "react";
import Link from "next/link";
import {
  categoriasDe,
  jaAconteceu,
  maisRecentesPrimeiro,
  semAcento,
  useCategoriasPersonalizadas,
  useMes,
  type Tipo,
} from "@/lib/store";
import { brl, diasAte, formatarData, lerValor, nomeMes, somarMeses, soNumeros } from "@/lib/formato";
import { previstosDoMes, resumoDoMes, type Previsto } from "@/lib/previstos";
import { itensDaFatura } from "@/lib/cartoes";
import { useDados } from "@/lib/dados";
import ItemLancamento from "@/components/ItemLancamento";
import ConfirmarPrevisto from "@/components/ConfirmarPrevisto";
import EstadoVazio from "@/components/EstadoVazio";

const FILTROS: { valor: Tipo | "tudo"; rotulo: string }[] = [
  { valor: "tudo", rotulo: "Tudo" },
  { valor: "entrada", rotulo: "Entradas" },
  { valor: "saida", rotulo: "Saídas" },
];

const ORIGEM: Record<Previsto["origem"], string> = {
  lançamento: "lançamento",
  renda: "renda",
  benefício: "benefício",
  fixo: "fixo",
  fatura: "fatura",
  parcela: "quitar",
  guardar: "meta",
  mercado: "mercado",
};

type Periodo = "mes" | "3meses" | "ano" | "tudo";

// Lançamentos: o que já aconteceu e o que está previsto no mês, juntos.
// O previsto tem o botão "Pago"/"Recebi", que pergunta de qual conta saiu (ou em qual entrou).
export default function Lancamentos() {
  const dados = useDados();
  const mes = useMes();
  const personalizadas = useCategoriasPersonalizadas();
  const [filtro, setFiltro] = useState<Tipo | "tudo">("tudo");
  const [busca, setBusca] = useState("");
  const [maisFiltros, setMaisFiltros] = useState(false);
  const [contaFiltro, setContaFiltro] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");
  const [confirmando, setConfirmando] = useState<Previsto | null>(null);
  const [faturaAberta, setFaturaAberta] = useState<string | null>(null);

  // Busca sem acento: "acucar" acha "Açúcar"
  const termo = semAcento(busca);
  const min = lerValor(valorMin) || 0;
  const max = lerValor(valorMax) || Infinity;
  const filtrando = !!termo || !!contaFiltro || !!categoriaFiltro || periodo !== "mes" || min > 0 || max < Infinity;
  const passaFiltro = (tipo: Tipo, texto: string, valor: number, categoria?: string, contaId?: string) =>
    (filtro === "tudo" || tipo === filtro) &&
    (!termo || semAcento(texto).includes(termo)) &&
    (!categoriaFiltro || categoria === categoriaFiltro) &&
    (!contaFiltro || contaId === contaFiltro) &&
    valor >= min &&
    valor <= max;

  // Período: a partir de qual mês (com busca ou filtro, dá para olhar mais para trás)
  const desde =
    periodo === "mes"
      ? mes
      : periodo === "3meses"
        ? somarMeses(mes, -2)
        : periodo === "ano"
          ? `${mes.slice(0, 4)}-01`
          : "0000-00";

  const previstos = previstosDoMes(mes, dados).filter((p) =>
    passaFiltro(p.tipo, p.nome, p.valor, p.lancamento?.categoria, p.lancamento?.contaId ?? p.fonte?.contaId),
  );
  const feitos = dados.lancamentos
    .filter((l) => jaAconteceu(l) && l.data.slice(0, 7) >= desde && l.data.slice(0, 7) <= mes)
    // Transferência: uma linha só (a ponta de saída), e só no filtro "Tudo"
    .filter((l) => !l.transferenciaId || (l.tipo === "saida" && filtro === "tudo"))
    .filter((l) => passaFiltro(l.tipo, `${l.descricao} ${l.categoria} ${l.subcategoria ?? ""}`, l.valor, l.categoria, l.contaId))
    .sort(maisRecentesPrimeiro);

  // Os números do mês: a mesma conta de todas as telas
  const r = resumoDoMes(mes, dados);
  const semConta = dados.lancamentos.filter((l) => !l.contaId || !dados.cartoes.some((c) => c.id === l.contaId));
  const categorias = [...categoriasDe("saida", personalizadas), ...categoriasDe("entrada", personalizadas)];

  return (
    <div className="space-y-5">
      {/* Números do mês */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero rotulo="Entrou" valor={r.entrou} cor="text-entrada" />
        <Numero rotulo="Ainda vai entrar" valor={r.vaiEntrar} cor="text-entrada/80" />
        <Numero rotulo="Saiu" valor={r.saiu} cor="text-saida" />
        <Numero rotulo="Ainda vai sair" valor={r.vaiSair} cor="text-saida/80" />
      </section>
      <p className="-mt-2 text-xs text-suave">
        Transferências entre contas, dinheiro guardado em metas e vales (VR/VA) não contam como entrada nem saída.
      </p>

      {semConta.length > 0 && dados.cartoes.length > 0 && (
        <p className="rounded-2xl border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-sm">
          ⚠️ {semConta.length} lançamentos estão <b>sem conta</b>. Toque em cada um para escolher, ou escolha para todos de uma
          vez na aba{" "}
          <Link href="/contas" className="text-rosa">
            Contas
          </Link>
          .
        </p>
      )}

      <div className="space-y-3">
        <div className="space-y-3 lg:flex lg:items-center lg:gap-4 lg:space-y-0">
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="🔍  Buscar (sem precisar de acento)"
            aria-label="Buscar lançamentos"
            className="campo rounded-full bg-superficie lg:flex-1"
          />
          <div className="flex gap-2 lg:w-96">
            {FILTROS.map((f) => (
              <button
                key={f.valor}
                aria-pressed={filtro === f.valor}
                onClick={() => setFiltro(f.valor)}
                className={`flex-1 rounded-full py-2 text-sm transition-colors ${filtro === f.valor ? "bg-white font-semibold text-fundo" : "bg-superficie text-suave"}`}
              >
                {f.rotulo}
              </button>
            ))}
          </div>
        </div>

        <button onClick={() => setMaisFiltros(!maisFiltros)} aria-expanded={maisFiltros} className="text-sm text-rosa">
          {maisFiltros ? "▴ Menos filtros" : "▾ Mais filtros (conta, categoria, período, valor)"}
          {filtrando && !maisFiltros && <span className="ml-2 rounded-full bg-rosa/20 px-2 py-0.5 text-xs">ativos</span>}
        </button>

        {maisFiltros && (
          <div className="cartao grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1 text-xs text-suave">
              Conta
              <select
                value={contaFiltro}
                onChange={(e) => setContaFiltro(e.target.value)}
                className="campo cursor-pointer py-2 text-sm text-white"
              >
                <option value="">Todas</option>
                {dados.cartoes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-suave">
              Categoria
              <select
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.target.value)}
                className="campo cursor-pointer py-2 text-sm text-white"
              >
                <option value="">Todas</option>
                {[...new Set(categorias.map((c) => c.nome))].map((nome) => (
                  <option key={nome} value={nome}>
                    {nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-suave">
              Período (até {nomeMes(mes).toLowerCase()})
              <select
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value as Periodo)}
                className="campo cursor-pointer py-2 text-sm text-white"
              >
                <option value="mes">Só este mês</option>
                <option value="3meses">Últimos 3 meses</option>
                <option value="ano">Este ano</option>
                <option value="tudo">Tudo</option>
              </select>
            </label>
            <div className="space-y-1 text-xs text-suave">
              Valor (R$)
              <div className="flex gap-2">
                <input
                  inputMode="decimal"
                  value={valorMin}
                  onChange={(e) => setValorMin(soNumeros(e.target.value))}
                  placeholder="de"
                  aria-label="Valor mínimo"
                  className="campo py-2 text-sm"
                />
                <input
                  inputMode="decimal"
                  value={valorMax}
                  onChange={(e) => setValorMax(soNumeros(e.target.value))}
                  placeholder="até"
                  aria-label="Valor máximo"
                  className="campo py-2 text-sm"
                />
              </div>
            </div>
            {filtrando && (
              <button
                onClick={() => {
                  setBusca("");
                  setContaFiltro("");
                  setCategoriaFiltro("");
                  setPeriodo("mes");
                  setValorMin("");
                  setValorMax("");
                }}
                className="text-left text-sm text-suave hover:text-white sm:col-span-2 lg:col-span-4"
              >
                ✕ Limpar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* Previsto */}
      <section>
        <h2 className="titulo-secao">📌 Previsto em {nomeMes(mes).toLowerCase()}</h2>
        {previstos.length > 0 ? (
          <ul className="cartao divide-y divide-white/5 px-4">
            {previstos.map((p) => {
              const dias = diasAte(p.data);
              const entrada = p.tipo === "entrada";
              const fatura = p.item?.tipo === "fatura" ? p.item : null;
              const atrasado = !entrada && (dias < 0 || !!p.item?.atrasado);
              return (
                <li key={p.chave} className="py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-superficie-2 text-lg" aria-hidden>
                      {p.icone}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {p.nome}
                        {atrasado && (
                          <span className="ml-2 rounded-full bg-saida/15 px-2 py-0.5 text-[0.65rem] font-semibold text-saida">
                            atrasado
                          </span>
                        )}
                        {p.dinheiro === false && (
                          <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[0.65rem] text-suave">vale</span>
                        )}
                      </p>
                      <p className="text-xs text-suave">
                        {ORIGEM[p.origem]} ·{" "}
                        <span className={atrasado ? "text-saida" : dias <= 3 && dias >= 0 ? "text-amber-300" : ""}>
                          {dias < 0 ? `era para ${formatarData(p.data)}` : dias === 0 ? "hoje" : formatarData(p.data)}
                        </span>
                        {fatura && (
                          <button
                            onClick={() => setFaturaAberta(faturaAberta === p.chave ? null : p.chave)}
                            className="ml-2 text-rosa"
                          >
                            {faturaAberta === p.chave ? "esconder compras" : "ver compras"}
                          </button>
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`font-display font-semibold tabular-nums ${entrada ? "text-entrada" : "text-saida"}`}>
                        {entrada ? "+" : "−"} {brl(p.valor)}
                      </p>
                      {p.origem === "mercado" ? (
                        <Link href="/mercado" className="text-xs font-medium text-rosa">
                          ver mercado
                        </Link>
                      ) : (
                        <button onClick={() => setConfirmando(p)} className="text-xs font-medium text-rosa">
                          {entrada ? "recebi" : p.origem === "guardar" ? "guardei" : "pago"}
                        </button>
                      )}
                    </div>
                  </div>
                  {/* As compras no crédito que estão dentro da fatura */}
                  {fatura && faturaAberta === p.chave && (
                    <ul className="ml-13 mt-2 space-y-1 border-l border-white/10 pl-3 text-sm">
                      {itensDaFatura(fatura.cartao, fatura.fatura, dados).map((i) => (
                        <li key={i.chave} className="flex gap-2">
                          <span className="min-w-0 flex-1 truncate text-suave">{i.descricao}</span>
                          <span className="text-xs text-suave">{i.detalhe}</span>
                          <span className="tabular-nums">{brl(i.valor)}</span>
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
            Nada previsto{filtrando || filtro !== "tudo" ? " com esses filtros" : ""}. ✨
          </p>
        )}
      </section>

      {/* Feito */}
      <section>
        <h2 className="titulo-secao">
          ✅ {filtrando ? `Encontrado (${feitos.length})` : "Já aconteceu"}
          {periodo !== "mes" && ` · ${periodo === "3meses" ? "últimos 3 meses" : periodo === "ano" ? "este ano" : "tudo"}`}
        </h2>
        {feitos.length > 0 ? (
          <ul className="cartao divide-y divide-white/5 px-4">
            {feitos.map((l) => (
              <ItemLancamento key={l.id} lancamento={l} contas={dados.cartoes} lancamentos={dados.lancamentos} />
            ))}
          </ul>
        ) : (
          <div className="cartao">
            <EstadoVazio
              icone="📭"
              titulo={filtrando ? "Nada encontrado" : `Nada ainda em ${nomeMes(mes).toLowerCase()}`}
              texto={filtrando ? "Tente outra palavra ou mude os filtros." : "Toque no + para registrar uma entrada ou saída."}
            />
          </div>
        )}
      </section>

      {confirmando && <ConfirmarPrevisto previsto={confirmando} onFechar={() => setConfirmando(null)} />}
    </div>
  );
}

function Numero({ rotulo, valor, cor }: { rotulo: string; valor: number; cor: string }) {
  return (
    <div className="cartao p-4">
      <p className="text-xs text-suave">{rotulo}</p>
      <p className={`mt-1 font-display text-lg font-bold tabular-nums ${cor}`}>{brl(valor)}</p>
    </div>
  );
}
