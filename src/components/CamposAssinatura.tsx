"use client";

import { adicionarGastoFixo, FREQUENCIAS, SUGESTOES_FIXO, type Cartao, type Frequencia } from "@/lib/store";
import { mesAtual } from "@/lib/formato";
import { Campo, CampoSelect, CampoValor, Chip, DIAS_DO_MES } from "./Campos";
import CampoMes from "./CampoMes";

// Campos de uma assinatura no cartão (Netflix, Spotify…): não tem parcelas nem fim.
// Pode ser mensal, semestral ou anual.

export type RascunhoAssinatura = {
  nome: string;
  icone: string;
  valor: string;
  dia: string;
  cartaoId: string;
  frequencia: Frequencia;
  mesReferencia: string; // semestral/anual: mês da próxima cobrança
  desde: string; // começou (ou começa) em qual mês
};

export function assinaturaVazia(cartaoId: string): RascunhoAssinatura {
  return { nome: "", icone: "📺", valor: "", dia: "", cartaoId, frequencia: "mensal", mesReferencia: "", desde: mesAtual() };
}

const SUGESTOES = SUGESTOES_FIXO.filter((s) => s.categoria === "assinaturas");

/** Valida e salva a assinatura como gasto fixo pago no cartão. Devolve uma mensagem de erro, ou null se deu certo. */
export function salvarAssinatura(r: RascunhoAssinatura, valor: number) {
  if (!r.nome.trim()) return "Qual é a assinatura?";
  if (!(valor > 0)) return "Digite o valor.";
  if (!r.dia) return "Escolha o dia da cobrança.";
  if (r.frequencia !== "mensal" && !r.mesReferencia) return "Escolha o mês da próxima cobrança.";
  if (!r.cartaoId) return "Escolha o cartão.";
  adicionarGastoFixo({
    nome: r.nome.trim(),
    icone: r.icone,
    categoria: "assinaturas",
    valor,
    varia: false,
    dia: Number(r.dia),
    pagamento: "cartao",
    cartaoId: r.cartaoId,
    desde: r.desde || mesAtual(),
    // Começa num mês futuro: só entra nas faturas a partir dele (as faturas antigas já fecharam)
    criadoEm: r.desde > mesAtual() ? `${r.desde}-01` : undefined,
    frequencia: r.frequencia,
    mesReferencia: r.frequencia !== "mensal" ? r.mesReferencia : undefined,
  });
  return null;
}

/**
 * Com `comValor`, o campo de valor fica aqui dentro (logo depois do nome).
 * Sem ele, o valor vem do formulário de fora (ex.: o valor grande do "+ Novo lançamento").
 */
export default function CamposAssinatura({
  cartoes,
  rascunho: r,
  onChange,
  comValor = false,
}: {
  cartoes: Cartao[];
  rascunho: RascunhoAssinatura;
  onChange: (novo: RascunhoAssinatura) => void;
  comValor?: boolean;
}) {
  const mudar = (mudancas: Partial<RascunhoAssinatura>) => onChange({ ...r, ...mudancas });
  const frequencia = FREQUENCIAS.find((f) => f.id === r.frequencia)!;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {SUGESTOES.map((s) => (
          <Chip key={s.nome} ativo={r.nome === s.nome} onClick={() => mudar({ nome: s.nome, icone: s.icone })}>
            {s.icone} {s.nome}
          </Chip>
        ))}
      </div>

      <Campo rotulo="Qual assinatura?">
        <div className="flex gap-2">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-fundo text-xl">{r.icone}</span>
          <input value={r.nome} onChange={(e) => mudar({ nome: e.target.value })} placeholder="Ex.: Netflix" className="campo" />
        </div>
      </Campo>

      <div className="space-y-1.5">
        <span className="text-xs text-suave">De quanto em quanto tempo cobra?</span>
        <div className="flex flex-wrap gap-2">
          {FREQUENCIAS.map((f) => (
            <Chip key={f.id} ativo={r.frequencia === f.id} onClick={() => mudar({ frequencia: f.id })}>
              {f.nome}
            </Chip>
          ))}
        </div>
      </div>

      {comValor && (
        <Campo rotulo={`Valor ${frequencia.porExtenso}`}>
          <CampoValor valor={r.valor} onChange={(valor) => mudar({ valor })} />
        </Campo>
      )}

      {cartoes.length > 1 && (
        <div className="space-y-1.5">
          <span className="text-xs text-suave">Qual cartão?</span>
          <div className="flex flex-wrap gap-2">
            {cartoes.map((c) => (
              <Chip key={c.id} ativo={r.cartaoId === c.id} onClick={() => mudar({ cartaoId: c.id })}>
                💳 {c.nome}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {r.frequencia !== "mensal" && (
        <Campo rotulo="Mês da próxima cobrança">
          <CampoMes valor={r.mesReferencia} onChange={(mesReferencia) => mudar({ mesReferencia })} />
        </Campo>
      )}

      <Campo rotulo={r.frequencia === "mensal" ? "Cobra todo dia" : "Dia da cobrança"}>
        <CampoSelect valor={r.dia} onChange={(dia) => mudar({ dia })} opcoes={DIAS_DO_MES} placeholder="Dia" />
      </Campo>

      <Campo rotulo="Começou (ou começa) em">
        <CampoMes valor={r.desde} onChange={(desde) => mudar({ desde: desde || mesAtual() })} />
      </Campo>

      <p className="rounded-2xl bg-roxo/10 px-4 py-3 text-xs text-suave">
        🔁 Não tem parcelas nem data para acabar:{" "}
        {r.frequencia === "mensal" ? "entra sozinha na fatura todo mês" : `entra na fatura a cada ${frequencia.meses} meses`}, até
        você excluir.
      </p>
    </div>
  );
}
