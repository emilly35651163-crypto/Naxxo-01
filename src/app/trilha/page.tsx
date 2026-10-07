"use client";

import { useState } from "react";
import {
  adiarParcela,
  arquivarMeta,
  definirPlanoDoMes,
  guardarNaMeta,
  registrarAdiantamento,
  removerMeta,
  type Meta,
} from "@/lib/store";
import { parcelasPagasDaCompra } from "@/lib/cartoes";
import { orientacaoBem, orientacaoReserva, tipoDoBem, type Orientacao } from "@/lib/orientacoes";
import { calcularMeta, mensagemDaTrilha, taxaDaDivida } from "@/lib/metas";
import { adiantarParcelas, formatarTaxa } from "@/lib/juros";
import { planoDoMes, previstosDoMes, resumoDoMes, type Previsto } from "@/lib/previstos";
import { useDados } from "@/lib/dados";
import { brl, formatarData, lerValor, mesAtual, nomeMes, somarMeses, valorParaCampo } from "@/lib/formato";
import { comDesfazer, mostrarAviso } from "@/lib/avisos";
import CaixaOrientacao from "@/components/CaixaOrientacao";
import TrilhaProgresso from "@/components/TrilhaProgresso";
import FormMeta from "@/components/FormMeta";
import ConfirmarPrevisto from "@/components/ConfirmarPrevisto";
import Modal from "@/components/Modal";
import { CampoValor, Chip } from "@/components/Campos";
import EscolhaConta, { lerEscolha } from "@/components/EscolhaConta";
import EstadoVazio from "@/components/EstadoVazio";
import Desejos from "./Desejos";

export default function Trilha() {
  const dados = useDados();
  const { cartoes, compras, fixos, pagamentos, fontes, metas: metasSalvas } = dados;
  const mes = mesAtual();
  const [editando, setEditando] = useState<Meta | "nova" | null>(null);
  const [guardando, setGuardando] = useState<Meta | null>(null);
  const [confirmando, setConfirmando] = useState<Previsto | null>(null);
  const [verConquistas, setVerConquistas] = useState(false);

  // Metas de quitar que estão num cartão: as parcelas pagas vêm das faturas pagas
  const noCartao = new Map<string, string>(); // id da meta -> nome do cartão
  const todas = metasSalvas.map((m) => {
    const compra = compras.find((c) => c.metaId === m.id);
    const cartao = compra && cartoes.find((c) => c.id === compra.cartaoId);
    if (!compra || !cartao || !m.parcela) return m;
    noCartao.set(m.id, cartao.nome);
    const pagas = parcelasPagasDaCompra(compra, cartao, { compras, fixos, pagamentos });
    return { ...m, parcelasPagas: pagas, guardado: m.parcela * pagas };
  });
  // Concluídas e arquivadas vão para o histórico de conquistas
  // Dívidas ficam em Contas: aqui só o que a pessoa quer juntar
  const metas = todas.filter((m) => !m.arquivada && m.tipo !== "quitar");
  const conquistas = todas.filter((m) => m.arquivada);

  // O plano do mês: a sobra (o que entra menos o que sai) e a sugestão de quanto guardar
  const plano = planoDoMes(mes, dados);
  const previstos = previstosDoMes(mes, dados);
  const valorDoMes = (m: Meta) =>
    m.tipo === "quitar" ? (m.planoMensal?.[mes] ?? m.parcela ?? 0) : (plano.valores.get(m.id)?.valor ?? 0);
  const automatico = (m: Meta) => m.planoMensal?.[mes] === undefined;

  const deJuntar = metas.filter((m) => m.tipo !== "quitar");
  const totalGuardado = deJuntar.reduce((t, m) => t + m.guardado, 0);
  const totalAlvo = deJuntar.reduce((t, m) => t + m.alvo, 0);
  // Quanto guardar por mês para chegar em todas (pelo prazo, ou em 1 ano sem prazo)
  const idealPorMes = deJuntar.reduce((t, m) => t + (plano.pede.get(m.id) ?? 0), 0);

  // Média do que saiu por mês nos meses que já fecharam (base da reserva de emergência), com a regra única
  const saidaMedia = (() => {
    const totais = [1, 2, 3].map((i) => resumoDoMes(somarMeses(mes, -i), dados).saiu).filter((t) => t > 0);
    return totais.length ? totais.reduce((a, b) => a + b, 0) / totais.length : 0;
  })();

  function orientacaoDaMeta(m: Meta): Orientacao | undefined {
    if (m.tipo === "quitar" || calcularMeta(m).concluida) return undefined;
    if (m.reserva) return orientacaoReserva(m, fontes, fixos, metasSalvas, saidaMedia);
    const bem = tipoDoBem(m);
    return bem ? orientacaoBem(m, bem, fontes) : undefined;
  }

  return (
    <div className="space-y-6">
      {/* Só os números: nada de textão */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Numero rotulo="Guardado no total" valor={brl(totalGuardado)} destaque />
        <Numero rotulo="Quero chegar" valor={brl(totalAlvo)} />
        <Numero rotulo="Guardado no mês" valor={brl(Math.max(resumoDoMes(mes, dados).guardado, 0))} />
        <Numero rotulo="Ideal por mês" valor={brl(idealPorMes)} />
        <Numero rotulo="Sobrando este mês" valor={brl(plano.sobra)} vermelho={plano.sobra < 0} />
      </section>

      <div className="flex items-center justify-between">
        <h2 className="titulo-secao mb-0">Suas trilhas</h2>
        <button
          onClick={() => setEditando("nova")}
          className="rounded-full border border-rosa/50 px-4 py-1.5 text-sm text-rosa hover:bg-rosa/10"
        >
          + Nova meta
        </button>
      </div>

      {metas.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {metas.map((m) => (
            <CartaoMeta
              key={m.id}
              meta={m}
              mes={mes}
              valorDoMes={valorDoMes(m)}
              automatico={automatico(m)}
              sugerido={plano.valores.get(m.id)?.sugerido ?? 0}
              previsto={previstos.find((p) => p.meta?.id === m.id)}
              orientacao={orientacaoDaMeta(m)}
              nomeCartao={noCartao.get(m.id)}
              onConfirmar={setConfirmando}
              onGuardar={() => setGuardando(m)}
              onEditar={() => setEditando(metasSalvas.find((s) => s.id === m.id) ?? m)}
            />
          ))}
        </div>
      ) : (
        <div className="cartao">
          <EstadoVazio
            icone="🗺️"
            titulo="Sua trilha começa aqui"
            texto="Juntar para algo (notebook, viagem), montar a reserva de emergência ou quitar algo que você paga todo mês."
          />
        </div>
      )}

      <Desejos />

      {/* Histórico de conquistas */}
      {conquistas.length > 0 && (
        <section>
          <button
            onClick={() => setVerConquistas(!verConquistas)}
            aria-expanded={verConquistas}
            className="titulo-secao flex w-full items-center justify-between"
          >
            <span>🏆 Conquistas ({conquistas.length})</span>
            <span className="text-rosa">{verConquistas ? "esconder ▴" : "ver ▾"}</span>
          </button>
          {verConquistas && (
            <ul className="cartao divide-y divide-white/5 px-4">
              {conquistas.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-superficie-2 text-lg" aria-hidden>
                    {m.icone}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{m.nome}</span>
                    <span className="block text-xs text-suave">
                      {m.tipo === "quitar" ? "Quitada" : `Juntou ${brl(m.alvo)}`}
                      {m.concluidaEm && ` · ${formatarData(m.concluidaEm)}/${m.concluidaEm.slice(0, 4)}`}
                    </span>
                  </span>
                  <button onClick={() => arquivarMeta(m.id, false)} className="text-xs text-suave hover:text-white">
                    voltar para a lista
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {editando && <FormMeta meta={editando === "nova" ? undefined : editando} onFechar={() => setEditando(null)} />}
      {guardando && <FormGuardar meta={guardando} onFechar={() => setGuardando(null)} />}
      {confirmando && <ConfirmarPrevisto previsto={confirmando} onFechar={() => setConfirmando(null)} />}
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
  valor: string;
  destaque?: boolean;
  vermelho?: boolean;
}) {
  return (
    <div className="cartao p-4">
      <p className="text-xs text-suave">{rotulo}</p>
      <p
        className={`mt-1 font-display text-xl font-bold tabular-nums ${vermelho ? "text-saida" : destaque ? "gradiente-texto" : ""}`}
      >
        {valor}
      </p>
    </div>
  );
}

function CartaoMeta({
  meta,
  mes,
  valorDoMes,
  automatico,
  sugerido,
  previsto,
  orientacao,
  nomeCartao,
  onConfirmar,
  onGuardar,
  onEditar,
}: {
  meta: Meta;
  mes: string;
  valorDoMes: number;
  automatico: boolean;
  sugerido: number;
  previsto?: Previsto;
  orientacao?: Orientacao;
  nomeCartao?: string;
  onConfirmar: (p: Previsto) => void;
  onGuardar: () => void;
  onEditar: () => void;
}) {
  const quitar = meta.tipo === "quitar";
  // A previsão de chegada usa a meta deste mês como ritmo (com R$ 0, não há ritmo)
  const c = calcularMeta(
    valorDoMes > 0 ? { ...meta, aporteMensal: valorDoMes } : { ...meta, aporteMensal: quitar ? meta.aporteMensal : null },
  );
  const pagas = meta.parcelasPagas ?? 0;
  const restantes = (meta.parcelas ?? 0) - pagas;
  const taxa = quitar ? taxaDaDivida(meta) : null;
  const [adiantando, setAdiantando] = useState(false);
  const [mudandoValor, setMudandoValor] = useState(false);
  const [novoValor, setNovoValor] = useState("");
  const [confirmandoAdiar, setConfirmandoAdiar] = useState(false);
  const semRitmo = !quitar && valorDoMes === 0;

  // Conquista! 🎉
  if (c.concluida) {
    return (
      <article className="cartao relative overflow-hidden border-rosa/60 p-5 text-center">
        <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-rosa/25 blur-3xl" />
        <p className="text-5xl" aria-hidden>
          🎉
        </p>
        <h3 className="mt-2 font-display text-xl font-bold">
          {meta.icone} {meta.nome}
        </h3>
        <p className="mt-1 text-sm text-suave">
          {quitar ? "Quitada! Uma dívida a menos 💚" : `Você juntou ${brl(meta.alvo)}! Conquista realizada.`}
        </p>
        <TrilhaProgresso progresso={1} />
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={() => arquivarMeta(meta.id)}
            className="botao-gradiente rounded-full px-5 py-2.5 text-sm font-semibold"
          >
            Guardar nas conquistas 🏆
          </button>
          <button
            onClick={onEditar}
            className="rounded-full border border-white/10 px-4 py-2.5 text-sm text-suave hover:text-white"
          >
            Editar
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="cartao relative overflow-hidden p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-superficie-2 text-2xl" aria-hidden>
          {meta.icone}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-lg font-semibold">{meta.nome}</h3>
          <p className="text-sm tabular-nums text-suave">
            {quitar ? `${pagas} de ${meta.parcelas} parcelas pagas` : `${brl(meta.guardado)} de ${brl(meta.alvo)}`}
          </p>
        </div>
        <span className="gradiente-texto font-display text-2xl font-bold tabular-nums">{Math.round(c.progresso * 100)}%</span>
      </div>

      <TrilhaProgresso progresso={c.progresso} />
      <p className="text-center text-sm">{mensagemDaTrilha(c.progresso, meta.tipo)}</p>

      {/* A meta deste mês: o valor escolhido (juntar começa em R$ 0; quitar, na parcela normal) */}
      {!nomeCartao && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-fundo/60 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-suave">
              {quitar ? "Parcela" : "Guardar"} em {nomeMes(mes).split(" ")[0].toLowerCase()}{" "}
              {quitar ? (
                <span className={automatico ? "text-roxo" : "text-amber-300"}>
                  · {automatico ? "parcela normal" : "você mudou"}
                </span>
              ) : (
                <span className={automatico ? "text-suave" : "text-amber-300"}>
                  · {automatico ? "ainda não definido" : "você escolheu"}
                </span>
              )}
            </span>
            <span className="font-display text-2xl font-bold tabular-nums">{brl(valorDoMes)}</span>
          </div>

          {mudandoValor ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="w-36">
                <CampoValor valor={novoValor} onChange={setNovoValor} autoFocus rotulo="Valor deste mês" />
              </div>
              <button
                onClick={() => {
                  definirPlanoDoMes(meta.id, mes, lerValor(novoValor) || 0);
                  setMudandoValor(false);
                }}
                className="botao-gradiente rounded-full px-4 py-2 text-sm font-semibold"
              >
                Usar este mês
              </button>
              <button onClick={() => setMudandoValor(false)} className="text-sm text-suave">
                cancelar
              </button>
              {quitar && lerValor(novoValor) < (meta.parcela ?? 0) && (
                <p className="w-full text-xs text-amber-300">
                  ⚠️ Pagar menos que a parcela pode gerar multa e juros: a dívida continua vencendo.
                </p>
              )}
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              <button
                onClick={() => {
                  setNovoValor(valorParaCampo(Math.round(valorDoMes * 100) / 100));
                  setMudandoValor(true);
                }}
                className="text-rosa"
              >
                {quitar ? "mudar só este mês" : valorDoMes > 0 ? "mudar valor" : "definir quanto guardar"}
              </button>
              {!quitar && automatico && sugerido >= 1 && (
                <button
                  onClick={() => definirPlanoDoMes(meta.id, mes, Math.round(sugerido * 100) / 100)}
                  className="text-roxo hover:text-white"
                >
                  usar sugestão: {brl(sugerido)}
                </button>
              )}
              {!quitar && !automatico && valorDoMes > 0 && (
                <button onClick={() => definirPlanoDoMes(meta.id, mes, null)} className="text-suave hover:text-white">
                  zerar este mês
                </button>
              )}
              {/* Parcela é obrigatória: não some em silêncio, ela é adiada (com aviso) */}
              {quitar && valorDoMes > 0 && restantes > 0 && (
                <button onClick={() => setConfirmandoAdiar(true)} className="text-suave hover:text-white">
                  adiar para {nomeMes(somarMeses(mes, 1)).split(" ")[0].toLowerCase()}
                </button>
              )}
              {quitar && !automatico && (
                <button onClick={() => definirPlanoDoMes(meta.id, mes, null)} className="text-suave hover:text-white">
                  voltar à parcela normal
                </button>
              )}
            </div>
          )}

          {confirmandoAdiar && (
            <div className="mt-3 rounded-2xl border border-amber-300/40 bg-amber-300/10 p-3 text-xs">
              <p>
                ⚠️ Adiar não faz a dívida parar: a parcela de {nomeMes(mes).split(" ")[0].toLowerCase()} continua vencendo e pode
                ter <b>multa e juros</b>. Ela vai para {nomeMes(somarMeses(mes, 1)).split(" ")[0].toLowerCase()} somada à próxima
                ({brl(valorDoMes + (meta.planoMensal?.[somarMeses(mes, 1)] ?? meta.parcela ?? 0))}).
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => {
                    adiarParcela(meta.id, mes);
                    setConfirmandoAdiar(false);
                    mostrarAviso({ texto: "Parcela adiada para o mês que vem" });
                  }}
                  className="rounded-full border border-amber-300/50 px-3 py-1"
                >
                  Adiar mesmo assim
                </button>
                <button onClick={() => setConfirmandoAdiar(false)} className="px-3 py-1 text-suave">
                  cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <dl className="mt-3 grid grid-cols-2 gap-3 rounded-2xl bg-fundo/40 p-4 text-sm">
        <Info rotulo="Falta" valor={quitar ? `${brl(c.falta)} (${restantes}x)` : brl(c.falta)} />
        {semRitmo ? (
          <Info
            rotulo={meta.prazo ? `Para chegar em ${nomeMes(meta.prazo)}` : "Chega em"}
            valor={c.precisaPorMes ? `${brl(c.precisaPorMes)}/mês` : "— (sem valor no mês)"}
          />
        ) : (
          <Info rotulo={quitar ? "Quita em" : "Chega em"} valor={c.previsao ? nomeMes(c.previsao) : "—"} />
        )}
        {quitar ? (
          <Info rotulo="Total do parcelamento" valor={brl(meta.alvo)} />
        ) : (
          <Info rotulo="Prazo" valor={meta.prazo ? nomeMes(meta.prazo) : "Sem prazo"} />
        )}
        <Info
          rotulo={quitar ? "Parcela normal" : "Ritmo deste mês"}
          valor={quitar ? brl(meta.parcela ?? 0) : `${brl(valorDoMes)}/mês`}
        />
      </dl>

      {!quitar && !semRitmo && c.atrasaNoRitmo && meta.prazo && c.precisaPorMes && (
        <p className="mt-3 text-xs text-amber-300">
          ⏰ Nesse ritmo você chega depois do prazo. Para chegar em {nomeMes(meta.prazo)}, seriam {brl(c.precisaPorMes)} por mês.
        </p>
      )}

      {quitar && (taxa || meta.valorOriginal || meta.economizado) && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {meta.valorOriginal && meta.alvo > meta.valorOriginal && (
            <span className="rounded-full bg-saida/10 px-3 py-1 text-saida">Juros: {brl(meta.alvo - meta.valorOriginal)}</span>
          )}
          {taxa ? (
            <span className="rounded-full bg-white/5 px-3 py-1 text-suave">
              {meta.jurosMes ? "" : "≈ "}
              {formatarTaxa(taxa)} ao mês
            </span>
          ) : null}
          {meta.economizado ? (
            <span className="rounded-full bg-entrada/10 px-3 py-1 text-entrada">
              💚 Economizou {brl(meta.economizado)} adiantando
            </span>
          ) : null}
        </div>
      )}

      {nomeCartao && (
        <p className="mt-3 rounded-2xl bg-roxo/10 px-4 py-2.5 text-xs text-suave">
          💳 No cartão <b className="text-white">{nomeCartao}</b>: as parcelas avançam sozinhas quando você paga a fatura.
        </p>
      )}

      {orientacao && <CaixaOrientacao meta={meta} orientacao={orientacao} />}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {!nomeCartao && previsto && (
          <button
            onClick={() => onConfirmar(previsto)}
            className="botao-gradiente flex-1 rounded-full py-2.5 text-sm font-semibold"
          >
            {quitar ? `Paguei ${brl(previsto.valor)}` : `Guardei ${brl(previsto.valor)}`}
          </button>
        )}
        {!nomeCartao && !quitar && (
          <button
            onClick={onGuardar}
            className="rounded-full border border-rosa/50 px-4 py-2.5 text-sm text-rosa hover:bg-rosa/10"
          >
            {previsto ? "Outro valor" : "Guardar / retirar"}
          </button>
        )}
        {quitar && !nomeCartao && restantes > 1 && (
          <button
            onClick={() => setAdiantando(true)}
            className="rounded-full border border-rosa/50 px-4 py-2.5 text-sm text-rosa hover:bg-rosa/10"
          >
            Adiantar
          </button>
        )}
        <button
          onClick={onEditar}
          className="rounded-full border border-white/10 px-4 py-2.5 text-sm text-suave hover:text-white"
        >
          Editar
        </button>
        <button
          onClick={() => comDesfazer(`Meta “${meta.nome}” excluída`, () => removerMeta(meta.id))}
          className="px-2 py-2.5 text-sm text-suave hover:text-saida"
        >
          Excluir
        </button>
      </div>

      {adiantando && (
        <FormAdiantar meta={meta} restantes={restantes} taxa={taxa} onEditar={onEditar} onFechar={() => setAdiantando(false)} />
      )}
    </article>
  );
}

function FormAdiantar({
  meta,
  restantes,
  taxa,
  onEditar,
  onFechar,
}: {
  meta: Meta;
  restantes: number;
  taxa: number | null;
  onEditar: () => void;
  onFechar: () => void;
}) {
  const [quantas, setQuantas] = useState(1);
  const [conta, setConta] = useState(meta.contaId ? `debito:${meta.contaId}` : "");
  const [erro, setErro] = useState("");
  const parcela = meta.parcela ?? 0;
  const { custo, economia, semDesconto } = adiantarParcelas(parcela, restantes, quantas, taxa ?? 0);
  const { cartoes } = useDados();

  function confirmar() {
    const contaId = lerEscolha(conta).id || undefined;
    if (cartoes.length > 0 && !contaId) return setErro("De qual conta saiu o dinheiro?");
    registrarAdiantamento(meta.id, quantas, taxa ? economia : 0, taxa ? custo : semDesconto, contaId);
    mostrarAviso({ texto: `Adiantou ${quantas === 1 ? "1 parcela" : `${quantas} parcelas`} 💚` });
    onFechar();
  }

  return (
    <Modal titulo={`Adiantar · ${meta.nome}`} onFechar={onFechar}>
      <div className="space-y-5">
        <p className="text-sm text-suave">
          Adiantando as <b className="text-white">últimas</b> parcelas, você paga só o valor de hoje delas, sem os juros dos meses
          que faltam.
        </p>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-sm">Quantas parcelas adiantar?</span>
            <span className="font-display text-2xl font-bold">{quantas}</span>
          </div>
          <input
            type="range"
            min={1}
            max={restantes}
            value={quantas}
            onChange={(e) => setQuantas(Number(e.target.value))}
            aria-label="Quantas parcelas adiantar"
            className="w-full accent-rosa"
          />
          <div className="mt-2 flex gap-2">
            <Chip ativo={quantas === 1} onClick={() => setQuantas(1)}>
              1 parcela
            </Chip>
            <Chip ativo={quantas === restantes} onClick={() => setQuantas(restantes)}>
              Quitar tudo ({restantes})
            </Chip>
          </div>
        </div>

        {taxa ? (
          <div className="grid grid-cols-2 gap-3 rounded-2xl bg-fundo/60 p-4 text-sm">
            <div>
              <p className="text-xs text-suave">Sem adiantar</p>
              <p className="font-semibold tabular-nums line-through decoration-saida/70">{brl(semDesconto)}</p>
            </div>
            <div>
              <p className="text-xs text-suave">Pagando hoje (≈)</p>
              <p className="gradiente-texto font-display text-lg font-bold tabular-nums">{brl(custo)}</p>
            </div>
            <p className="col-span-2 rounded-xl bg-entrada/10 px-3 py-2 text-entrada">
              💚 Você economiza ≈ <b>{brl(economia)}</b> de juros
            </p>
            <p className="col-span-2 text-xs text-suave">
              Taxa usada: {formatarTaxa(taxa)} ao mês{meta.jurosMes ? "" : " (calculada pelo valor original)"}. O valor exato quem
              informa é o banco ou a loja. Peça o boleto de antecipação.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-roxo/10 p-4 text-sm">
            <p>
              Sem a taxa de juros, não dá para calcular o desconto. Total dessas parcelas: <b>{brl(semDesconto)}</b>.
            </p>
            <button
              onClick={() => {
                onFechar();
                onEditar();
              }}
              className="mt-2 text-rosa"
            >
              Informar a taxa ou o valor original →
            </button>
          </div>
        )}

        <EscolhaConta
          valor={conta}
          onChange={(v) => {
            setConta(v);
            setErro("");
          }}
          rotulo="Pagou com qual conta?"
        />
        {erro && (
          <p role="alert" className="text-sm text-saida">
            {erro}
          </p>
        )}

        <button onClick={confirmar} className="botao-gradiente w-full rounded-full py-3 font-semibold">
          Já adiantei {quantas === 1 ? "1 parcela" : `${quantas} parcelas`}
        </button>
      </div>
    </Modal>
  );
}

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-suave">{rotulo}</dt>
      <dd className="font-semibold tabular-nums">{valor}</dd>
    </div>
  );
}

function FormGuardar({ meta, onFechar }: { meta: Meta; onFechar: () => void }) {
  const { cartoes } = useDados();
  const [acao, setAcao] = useState<"guardar" | "retirar">("guardar");
  const [valor, setValor] = useState("");
  const [conta, setConta] = useState(meta.contaId ? `debito:${meta.contaId}` : "");
  const [erro, setErro] = useState("");
  const numero = lerValor(valor);

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!(numero > 0)) {
      if (acao === "retirar") return setErro("Digite quanto quer retirar.");
      // R$ 0: não guardar nada este mês (a meta do mês fica zerada)
      definirPlanoDoMes(meta.id, mesAtual(), 0);
      mostrarAviso({ texto: "Ok, nada guardado este mês" });
      return onFechar();
    }
    // Não dá para tirar mais do que a meta tem
    if (acao === "retirar" && numero > meta.guardado + 0.009)
      return setErro(`A meta tem só ${brl(meta.guardado)}. Dá para retirar até esse valor.`);
    const contaId = lerEscolha(conta).id || undefined;
    // Sem conta, o dinheiro apareceria na meta sem sair de lugar nenhum (contaria duas vezes)
    if (cartoes.length > 0 && !contaId)
      return setErro(acao === "guardar" ? "De qual conta saiu o dinheiro?" : "Para qual conta o dinheiro voltou?");
    guardarNaMeta(meta.id, acao === "guardar" ? numero : -numero, contaId);
    mostrarAviso({ texto: acao === "guardar" ? `Guardado ${brl(numero)} 🎯` : `Retirado ${brl(numero)}` });
    onFechar();
  }

  return (
    <Modal titulo={`${meta.icone} ${meta.nome}`} onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <div className="flex gap-2">
          <Chip ativo={acao === "guardar"} onClick={() => setAcao("guardar")}>
            ➕ Guardar
          </Chip>
          <Chip ativo={acao === "retirar"} onClick={() => setAcao("retirar")}>
            ➖ Retirar
          </Chip>
        </div>
        <CampoValor
          valor={valor}
          onChange={(v) => {
            setValor(v);
            setErro("");
          }}
          autoFocus
          rotulo={acao === "guardar" ? "Quanto guardar" : "Quanto retirar"}
        />
        {acao === "retirar" && <p className="-mt-2 text-xs text-suave">Na meta agora: {brl(meta.guardado)}</p>}
        <EscolhaConta
          valor={conta}
          onChange={setConta}
          rotulo={acao === "guardar" ? "Saiu de qual conta?" : "Voltou para qual conta?"}
        />
        <p className="text-xs text-suave">
          Guardar e retirar só mudam o dinheiro de lugar: não contam como gasto nem como renda.
        </p>
        {erro && (
          <p role="alert" className="text-sm text-saida">
            {erro}
          </p>
        )}
        <button type="submit" className="botao-gradiente w-full rounded-full py-3 font-semibold">
          {acao === "retirar" ? "Retirar" : numero > 0 ? "Guardar" : "Não guardar este mês"}
        </button>
      </form>
    </Modal>
  );
}
