"use client";

import { useState } from "react";
import {
  adicionarFonte,
  adicionarLancamento,
  atualizarFonte,
  FORMAS_RENDA,
  iconeDoBeneficio,
  jaAconteceu,
  removerFonte,
  rendaFixa,
  useCartoes,
  useFontes,
  useLancamentos,
  useMes,
  type FonteRenda,
} from "@/lib/store";
import {
  brl,
  diasAte,
  formatarData,
  hojeISO,
  lerValor,
  mesAtual,
  nomeDoDia,
  nomeMes,
  nomeMesCurto,
  somarMeses,
  soNumeros,
  valorParaCampo,
} from "@/lib/formato";
import { ehDinheiro } from "@/lib/contas";
import { intervaloDaRenda, rendaMensal, rendaPendente, type ParteDaRenda } from "@/lib/renda";
import { comDesfazer, mostrarAviso } from "@/lib/avisos";
import Modal from "@/components/Modal";
import { Campo, CampoValor, Chip } from "@/components/Campos";
import CamposFonte, {
  fonteParaRascunho,
  problemaDoRascunho,
  RASCUNHO_FONTE_VAZIO,
  rascunhoParaFonte,
} from "@/components/CamposFonte";
import EscolhaConta, { lerEscolha } from "@/components/EscolhaConta";
import EstadoVazio from "@/components/EstadoVazio";

export default function Renda() {
  const fontes = useFontes();
  const contas = useCartoes();
  const lancamentos = useLancamentos();
  const mes = useMes();
  const [editandoFonte, setEditandoFonte] = useState<FonteRenda | "nova" | null>(null);
  const [registrando, setRegistrando] = useState<FonteRenda | null>(null);

  // Renda = o que entra das fontes e das categorias de renda (salário, freela, benefícios…).
  // Não são renda: transferências, dinheiro tirado de metas e entradas em "Outros" (presente, reembolso).
  const entradas = lancamentos.filter(
    (l) =>
      l.tipo === "entrada" && !l.transferenciaId && l.categoria !== "Guardar (metas)" && (l.fonteId || l.categoria !== "Outros"),
  );
  // Esperado por mês: tudo o que entra, somado (salários, freelas e benefícios). Vales à parte.
  const esperado = fontes.reduce((total, f) => total + rendaMensal(f, true), 0);
  const esperadoVales = fontes.reduce((total, f) => total + rendaMensal(f) - rendaMensal(f, true), 0);

  /** Quanto já entrou no mês e quanto ainda vai entrar (a mesma conta da previsão dos Lançamentos). */
  function rendaDoMes(m: string) {
    const doM = entradas.filter((l) => l.data.startsWith(m));
    const recebidas = doM.filter((l) => jaAconteceu(l));
    const recebido = recebidas.filter((l) => ehDinheiro(l, contas, fontes)).reduce((t, l) => t + l.valor, 0);
    const vales = recebidas.filter((l) => !ehDinheiro(l, contas, fontes)).reduce((t, l) => t + l.valor, 0);
    let aReceber = doM.filter((l) => !jaAconteceu(l) && ehDinheiro(l, contas, fontes)).reduce((t, l) => t + l.valor, 0);
    if (m >= mesAtual()) {
      for (const f of fontes)
        aReceber += rendaPendente(f, m, lancamentos)
          .filter((p) => p.dinheiro)
          .reduce((t, p) => t + p.valor, 0);
    }
    return { recebido, aReceber, vales, total: recebido + aReceber };
  }

  const doMesAtual = rendaDoMes(mes);

  // Os últimos 6 meses, terminando no mês selecionado
  const historico = Array.from({ length: 6 }, (_, i) => {
    const m = somarMeses(mes, i - 5);
    return { mes: m, ...rendaDoMes(m) };
  });
  const maior = Math.max(...historico.map((h) => h.total), 1);

  // Média: só meses que já fecharam e tiveram recebimento de verdade (sem contar previsão); com menos de 2, "—"
  const fechados = Array.from({ length: 6 }, (_, i) => somarMeses(mesAtual(), -(i + 1)))
    .map((m) => rendaDoMes(m).recebido)
    .filter((v) => v > 0);
  const media = fechados.length >= 2 ? fechados.reduce((a, b) => a + b, 0) / fechados.length : null;

  // A próxima entrada prevista
  const proxima = fontes
    .flatMap((f) =>
      [mesAtual(), somarMeses(mesAtual(), 1)].flatMap((m) =>
        rendaPendente(f, m, lancamentos).map((p) => ({ fonte: f, parte: p })),
      ),
    )
    .filter((x) => x.parte.data >= hojeISO())
    .sort((a, b) => a.parte.data.localeCompare(b.parte.data))[0];

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="cartao p-4">
          <p className="text-xs text-suave">Recebido em {nomeMes(mes).toLowerCase()}</p>
          <p className="gradiente-texto mt-1 font-display text-xl font-bold tabular-nums">{brl(doMesAtual.recebido)}</p>
          {doMesAtual.aReceber > 0 && <p className="text-xs text-amber-300">+ {brl(doMesAtual.aReceber)} a receber</p>}
          {doMesAtual.vales > 0 && <p className="text-xs text-suave">🍽️ + {brl(doMesAtual.vales)} em vale</p>}
        </div>
        <div className="cartao p-4">
          <p className="text-xs text-suave">Esperado por mês</p>
          <p className="mt-1 font-display text-xl font-bold tabular-nums">{esperado > 0 ? `~ ${brl(esperado)}` : "—"}</p>
          <p className="text-xs text-suave">
            salários, extras e benefícios em dinheiro{esperadoVales > 0 ? ` · + ${brl(esperadoVales)} em vale` : ""}
          </p>
        </div>
        <div className="cartao p-4">
          <p className="text-xs text-suave">Média dos meses que já fecharam</p>
          <p className="mt-1 font-display text-xl font-bold tabular-nums">{media !== null ? brl(media) : "—"}</p>
          {media === null && <p className="text-xs text-suave">aparece depois de 2 meses com recebimentos</p>}
        </div>
      </section>

      {proxima && (
        <div className="flex items-center gap-3 rounded-2xl border border-roxo/30 bg-roxo/10 px-4 py-3 text-sm">
          <span className="text-xl" aria-hidden>
            📅
          </span>
          <p>
            Próxima entrada: <b>{proxima.parte.nome}</b>{" "}
            <span className="text-suave">
              ·{" "}
              {diasAte(proxima.parte.data) === 0
                ? "hoje!"
                : diasAte(proxima.parte.data) === 1
                  ? "amanhã"
                  : `em ${diasAte(proxima.parte.data)} dias (${formatarData(proxima.parte.data)})`}
            </span>
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="space-y-3 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="titulo-secao mb-0">O que entra</h2>
            <button
              onClick={() => setEditandoFonte("nova")}
              className="rounded-full border border-rosa/50 px-4 py-1.5 text-sm text-rosa hover:bg-rosa/10"
            >
              + Nova fonte
            </button>
          </div>

          {fontes.length > 0 ? (
            fontes.map((f) => {
              const recebido = entradas
                .filter((l) => l.fonteId === f.id && l.data.startsWith(mes) && jaAconteceu(l))
                .reduce((t, l) => t + l.valor, 0);
              const pendentes = mes >= mesAtual() ? rendaPendente(f, mes, lancamentos) : [];
              const forma = FORMAS_RENDA.find((x) => x.id === f.forma);
              const intervalo = intervaloDaRenda(f);
              return (
                <article key={f.id} className="cartao p-5">
                  <div className="flex items-start gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-superficie-2 text-xl" aria-hidden>
                      {forma?.icone}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold">{f.nome}</h3>
                      <p className="text-xs text-suave">
                        {forma?.nome}
                        {f.forma === "hora" && f.valorHora && f.horasMes && ` · ${brl(f.valorHora)}/h × ${f.horasMes}h`}
                        {intervalo
                          ? ` · ${intervalo === 7 ? "toda semana" : "a cada 15 dias"}`
                          : f.diaRecebimento && ` · 📅 ${nomeDoDia(f.diaRecebimento)}`}
                        {f.adiantamento && ` · adiantamento dia ${f.adiantamento.dia} (${f.adiantamento.percentual}%)`}
                        {f.decimoTerceiro && " · 13º"}
                        {f.mesFerias && ` · férias em ${nomeMesCurto(`2000-${String(f.mesFerias).padStart(2, "0")}`)}`}
                      </p>
                      {contas.length > 0 && (
                        <label className="mt-1 flex items-center gap-2 text-xs text-suave">
                          cai em
                          <select
                            value={f.contaId ?? ""}
                            onChange={(e) => atualizarFonte(f.id, { contaId: e.target.value || undefined })}
                            className={`rounded-full border bg-fundo px-2 py-0.5 ${f.contaId ? "border-white/10 text-white" : "border-amber-300/50 text-amber-300"}`}
                          >
                            <option value="">escolher conta…</option>
                            {contas.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.nome}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                      <button onClick={() => setEditandoFonte(f)} className="text-rosa hover:underline">
                        editar
                      </button>
                      <button
                        onClick={() =>
                          comDesfazer(`Fonte “${f.nome}” removida (os recebimentos continuam)`, () => removerFonte(f.id))
                        }
                        className="text-suave hover:text-saida"
                      >
                        remover
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-suave">
                        {rendaFixa(f.forma)
                          ? intervalo
                            ? "Por vez"
                            : "Valor por mês"
                          : intervalo
                            ? "Média por vez"
                            : "Média estimada"}
                      </p>
                      <p className="font-semibold tabular-nums">{brl(f.valor)}</p>
                      {intervalo ? <p className="text-xs text-suave">≈ {brl((f.valor * 30) / intervalo)} por mês</p> : null}
                    </div>
                    <div>
                      <p className="text-xs text-suave">Recebido em {nomeMesCurto(mes)}</p>
                      <p className={`font-semibold tabular-nums ${recebido > 0 ? "text-entrada" : "text-suave"}`}>
                        {recebido > 0
                          ? brl(recebido)
                          : pendentes[0]
                            ? `Previsto ${formatarData(pendentes[0].data)}`
                            : "Nada ainda"}
                      </p>
                    </div>
                  </div>

                  {(f.beneficios ?? []).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(f.beneficios ?? []).map((b, i) => (
                        <span key={i} className="rounded-full bg-superficie-2 px-3 py-1 text-xs">
                          {iconeDoBeneficio(b.tipo)} {b.nome} <span className="tabular-nums text-suave">{brl(b.valor)}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {pendentes.length > 0 && (
                    <ul className="mt-3 space-y-1 text-xs text-suave">
                      {pendentes.map((p) => (
                        <li key={p.chave} className="flex gap-2">
                          <span className="min-w-0 flex-1 truncate">
                            ⏳ {p.nome}
                            {!p.dinheiro && " (vale)"}
                          </span>
                          <span>{formatarData(p.data)}</span>
                          <span className="tabular-nums">{brl(p.valor)}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <button
                    onClick={() => setRegistrando(f)}
                    className="botao-gradiente mt-4 w-full rounded-full py-2.5 text-sm font-semibold"
                  >
                    Registrar recebimento
                  </button>
                </article>
              );
            })
          ) : (
            <div className="cartao">
              <EstadoVazio
                icone="💰"
                titulo="Nenhuma fonte de renda"
                texto="Adicione de onde vem o seu dinheiro: salário, freelas, vendas…"
              />
            </div>
          )}
        </section>

        <section className="lg:col-span-2">
          <h2 className="titulo-secao">Sua renda mês a mês</h2>
          <div className="cartao p-5">
            <div className="flex h-44 items-end gap-3">
              {historico.map((h) => {
                const atual = h.mes === mes;
                return (
                  <div key={h.mes} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                    <span className="text-[0.6rem] tabular-nums text-suave">
                      {h.total > 0 ? brl(h.total).replace(",00", "") : ""}
                    </span>
                    {/* Barra em duas partes: em cima o que ainda vai cair (clarinho), embaixo o que já caiu */}
                    <div
                      title={`${nomeMes(h.mes)}: ${brl(h.recebido)} recebido${h.aReceber > 0 ? ` + ${brl(h.aReceber)} a receber` : ""}`}
                      className="flex w-full flex-col justify-end overflow-hidden rounded-t-xl transition-[height] duration-500"
                      style={{ height: `${Math.max((h.total / maior) * 100, 3)}%` }}
                    >
                      {h.aReceber > 0 && (
                        <div
                          className={`w-full border border-dashed ${atual ? "border-rosa/70 bg-rosa/15" : "border-roxo/50 bg-roxo/10"}`}
                          style={{ height: `${(h.aReceber / h.total) * 100}%` }}
                        />
                      )}
                      <div
                        className={`w-full flex-1 ${atual ? "bg-linear-to-t from-roxo to-rosa shadow-[0_0_16px_rgb(255_78_216/0.4)]" : "bg-roxo/35"}`}
                        style={{ minHeight: h.recebido > 0 ? undefined : 0, flexGrow: h.recebido > 0 ? 1 : 0 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex gap-3">
              {historico.map((h) => (
                <span key={h.mes} className={`flex-1 text-center text-xs ${h.mes === mes ? "text-rosa" : "text-suave"}`}>
                  {nomeMesCurto(h.mes)}
                </span>
              ))}
            </div>
            <div className="mt-4 space-y-1.5 rounded-2xl bg-fundo/60 p-3 text-sm">
              <p className="flex items-center gap-2">
                <span className="size-2.5 rounded-sm bg-linear-to-t from-roxo to-rosa" />
                <span className="flex-1">Recebido em {nomeMesCurto(mes)}</span>
                <b className="tabular-nums">{brl(doMesAtual.recebido)}</b>
              </p>
              <p className="flex items-center gap-2">
                <span className="size-2.5 rounded-sm border border-dashed border-rosa/70 bg-rosa/15" />
                <span className="flex-1">A receber</span>
                <b className="tabular-nums">{brl(doMesAtual.aReceber)}</b>
              </p>
              <p className="flex items-center gap-2 border-t border-white/10 pt-1.5">
                <span className="size-2.5" />
                <span className="flex-1 text-suave">Total do mês</span>
                <b className="gradiente-texto tabular-nums">{brl(doMesAtual.total)}</b>
              </p>
            </div>
            <p className="mt-3 text-xs text-suave">
              Conta salário, freelas, vendas e benefícios em dinheiro. Vales (VR/VA), transferências entre contas e dinheiro
              tirado de metas ficam de fora.
            </p>
          </div>
        </section>
      </div>

      {editandoFonte && (
        <FormFonte fonte={editandoFonte === "nova" ? undefined : editandoFonte} onFechar={() => setEditandoFonte(null)} />
      )}
      {registrando && <FormRecebimento fonte={registrando} mes={mes} onFechar={() => setRegistrando(null)} />}
    </div>
  );
}

/** Criar ou editar uma fonte de renda (aumento de salário: é só editar, o histórico continua ligado a ela). */
function FormFonte({ fonte, onFechar }: { fonte?: FonteRenda; onFechar: () => void }) {
  const [rascunho, setRascunho] = useState(fonte ? fonteParaRascunho(fonte) : RASCUNHO_FONTE_VAZIO);
  const [erro, setErro] = useState("");

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    const problema = problemaDoRascunho(rascunho);
    const nova = rascunhoParaFonte(rascunho);
    if (problema || !nova) return setErro(problema ?? "Preencha o valor para continuar.");
    if (fonte) atualizarFonte(fonte.id, nova);
    else adicionarFonte(nova);
    mostrarAviso({ texto: fonte ? "Fonte de renda atualizada ✓" : "Fonte de renda criada ✓" });
    onFechar();
  }

  return (
    <Modal titulo={fonte ? `Editar · ${fonte.nome}` : "Nova fonte de renda"} onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-5">
        {fonte && (
          <p className="rounded-2xl bg-roxo/10 px-4 py-3 text-xs text-suave">
            Os recebimentos já registrados continuam ligados a esta fonte.
          </p>
        )}
        <CamposFonte
          rascunho={rascunho}
          onChange={(novo) => {
            setRascunho(novo);
            setErro("");
          }}
        />
        {erro && (
          <p role="alert" className="text-sm text-saida">
            {erro}
          </p>
        )}
        <button type="submit" className="botao-gradiente w-full rounded-full py-3 font-semibold">
          {fonte ? "Salvar alterações" : "Adicionar"}
        </button>
      </form>
    </Modal>
  );
}

function FormRecebimento({ fonte, mes, onFechar }: { fonte: FonteRenda; mes: string; onFechar: () => void }) {
  const lancamentos = useLancamentos();
  const porHora = fonte.forma === "hora";
  // O que ainda falta cair no mês: salário, adiantamento, 13º, férias… (os benefícios ficam embaixo)
  const pendentes = rendaPendente(fonte, mes, lancamentos);
  const partesPrincipais = pendentes.filter((p) => p.parte !== "beneficio");
  const beneficiosPendentes = pendentes.filter((p) => p.parte === "beneficio");
  const [parte, setParte] = useState<ParteDaRenda | null>(partesPrincipais[0] ?? null);
  const [valor, setValor] = useState(rendaFixa(fonte.forma) && parte ? valorParaCampo(parte.valor) : "");
  const [horas, setHoras] = useState("");
  const [valorHora, setValorHora] = useState(fonte.valorHora ? valorParaCampo(fonte.valorHora) : "");
  // A data já vem preenchida com o dia em que essa parte costuma entrar
  const [data, setData] = useState(parte?.data ?? (mes === mesAtual() ? hojeISO() : `${mes}-01`));
  const [erro, setErro] = useState("");
  const [conta, setConta] = useState(fonte.contaId ? `debito:${fonte.contaId}` : "");
  // Quais benefícios vieram junto neste recebimento (começam todos marcados)
  const [beneficiosRecebidos, setBeneficiosRecebidos] = useState(() => beneficiosPendentes.map(() => true));

  // Por hora: horas × valor da hora = valor recebido. A pessoa preenche horas OU valor, e o app calcula o outro.
  const [calculado, setCalculado] = useState<"horas" | "valor" | null>(null);

  function textoDe(numero: number, casas: number) {
    return numero > 0 ? String(Number(numero.toFixed(casas))).replace(".", ",") : "";
  }

  function mudarHoras(texto: string, hora = lerValor(valorHora)) {
    setHoras(texto);
    setValor(textoDe(lerValor(texto) * hora, 2));
    setCalculado(texto ? "valor" : null);
  }

  function mudarValorRecebido(texto: string, hora = lerValor(valorHora)) {
    setValor(texto);
    setHoras(hora > 0 ? textoDe(lerValor(texto) / hora, 1) : "");
    setCalculado(texto ? "horas" : null);
  }

  function mudarValorHora(texto: string) {
    setValorHora(texto);
    if (calculado === "horas") mudarValorRecebido(valor, lerValor(texto));
    else if (calculado === "valor") mudarHoras(horas, lerValor(texto));
  }

  function escolherParte(p: ParteDaRenda) {
    setParte(p);
    setValor(rendaFixa(fonte.forma) ? valorParaCampo(p.valor) : "");
    setData(p.data);
  }

  const total = lerValor(valor);
  const somaBeneficios = beneficiosPendentes.filter((_, i) => beneficiosRecebidos[i]).length;

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!(total > 0) && somaBeneficios === 0)
      return setErro(porHora ? "Preencha as horas trabalhadas ou o valor recebido." : "Digite um valor maior que zero.");
    const contaId = lerEscolha(conta).id || undefined;
    if (total > 0) {
      adicionarLancamento({
        tipo: "entrada",
        valor: total,
        descricao: parte?.nome ?? fonte.nome,
        categoria: fonte.forma === "fixo" ? "Salário" : "Freelance",
        data,
        pago: data <= hojeISO(),
        fonteId: fonte.id,
        contaId,
        parteRenda: parte?.parte ?? "salario",
        ...(porHora ? { horas: lerValor(horas) } : {}),
      });
    }
    beneficiosPendentes.forEach((b, i) => {
      if (!beneficiosRecebidos[i]) return;
      adicionarLancamento({
        tipo: "entrada",
        valor: b.valor,
        descricao: b.nome,
        categoria: "Benefícios",
        data,
        pago: data <= hojeISO(),
        fonteId: fonte.id,
        // Vale cai na conta do vale; benefício em dinheiro cai na conta escolhida
        contaId: b.dinheiro ? contaId : b.contaId,
        beneficio: b.beneficio?.tipo,
        parteRenda: "beneficio",
      });
    });
    mostrarAviso({ texto: "Recebimento registrado ✓" });
    onFechar();
  }

  return (
    <Modal titulo={`Recebimento · ${fonte.nome}`} onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-4">
        {partesPrincipais.length > 1 && (
          <div className="space-y-1.5">
            <span className="text-xs text-suave">O que caiu?</span>
            <div className="flex flex-wrap gap-2">
              {partesPrincipais.map((p) => (
                <Chip key={p.chave} ativo={parte?.chave === p.chave} onClick={() => escolherParte(p)}>
                  {p.icone} {p.nome.replace(` · ${fonte.nome}`, "")} · {formatarData(p.data)}
                </Chip>
              ))}
            </div>
          </div>
        )}
        {partesPrincipais.length === 0 && (
          <p className="rounded-2xl bg-entrada/10 px-4 py-3 text-xs text-suave">
            ✓ O que estava previsto desta fonte em {nomeMes(mes).toLowerCase()} já foi registrado. Registre de novo só se for um
            valor a mais.
          </p>
        )}

        {porHora ? (
          <>
            <p className="text-xs text-suave">
              Preencha as horas <b>ou</b> o valor recebido: o outro é calculado.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Horas trabalhadas">
                <input
                  autoFocus
                  inputMode="decimal"
                  value={horas}
                  onChange={(e) => mudarHoras(soNumeros(e.target.value))}
                  placeholder="Ex.: 72"
                  className={`campo ${calculado === "horas" ? "border-roxo/50 text-roxo" : ""}`}
                />
              </Campo>
              <Campo rotulo="Valor da hora">
                <CampoValor valor={valorHora} onChange={mudarValorHora} />
              </Campo>
            </div>
            <Campo rotulo="Valor recebido">
              <CampoValor valor={valor} onChange={mudarValorRecebido} />
            </Campo>
            {calculado && total > 0 && (
              <p className="-mt-2 text-xs text-roxo">
                ✨{" "}
                {calculado === "valor"
                  ? `Valor calculado: ${horas}h × ${brl(lerValor(valorHora))} = ${brl(total)}`
                  : `Horas calculadas: ${brl(total)} ÷ ${brl(lerValor(valorHora))} ≈ ${horas}h`}
              </p>
            )}
          </>
        ) : (
          <Campo rotulo={rendaFixa(fonte.forma) ? "Valor recebido" : `Quanto recebeu? (média: ${brl(fonte.valor)})`}>
            <CampoValor valor={valor} onChange={setValor} autoFocus />
          </Campo>
        )}

        {beneficiosPendentes.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs text-suave">Benefícios que vieram junto</span>
            {beneficiosPendentes.map((b, i) => (
              <label key={b.chave} className="flex cursor-pointer items-center gap-3 rounded-2xl bg-fundo/60 px-4 py-3">
                <input
                  type="checkbox"
                  checked={beneficiosRecebidos[i]}
                  onChange={(e) => setBeneficiosRecebidos((atuais) => atuais.map((x, j) => (j === i ? e.target.checked : x)))}
                  className="size-5 accent-rosa"
                />
                <span className="flex-1 text-sm">
                  {b.icone} {b.beneficio?.nome}
                  {!b.dinheiro && (
                    <span className="block text-xs text-suave">
                      vale · {b.contaId ? "cai na conta do vale" : "sem conta de vale"}
                    </span>
                  )}
                </span>
                <span className="text-sm tabular-nums text-suave">{brl(b.valor)}</span>
              </label>
            ))}
          </div>
        )}

        <Campo rotulo="Data">
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="campo" />
        </Campo>

        <EscolhaConta valor={conta} onChange={setConta} rotulo="Caiu em qual conta?" />

        <p className="text-xs text-suave">Isso também entra como uma entrada na aba Lançamentos.</p>
        {erro && (
          <p role="alert" className="text-sm text-saida">
            {erro}
          </p>
        )}
        <button type="submit" className="botao-gradiente w-full rounded-full py-3 font-semibold">
          Registrar
        </button>
      </form>
    </Modal>
  );
}
