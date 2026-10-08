"use client";

import { adicionarGastoFixo, FREQUENCIAS, SUGESTOES_FIXO, type Cartao, type Frequencia } from "@/lib/store";
import { mesAtual } from "@/lib/formato";
import { dataDeFechamento, faturaAberta } from "@/lib/cartoes";
import { Campo, CampoValor, Chip } from "./Campos";
import CampoMes from "./CampoMes";
import Icone from "@/components/Icone";

// Campos de uma assinatura no cartão (Netflix, Spotify…): não tem parcelas nem fim.
// Pode ser mensal, semestral ou anual. Basta o mês da fatura em que cobra: o dia o app calcula.

export type RascunhoAssinatura = {
  nome: string;
  icone: string;
  valor: string;
  cartaoId: string;
  frequencia: Frequencia;
  mesReferencia: string; // mês da fatura da próxima cobrança ("" = a fatura aberta agora)
};

export function assinaturaVazia(cartaoId: string): RascunhoAssinatura {
  return { nome: "", icone: "📺", valor: "", cartaoId, frequencia: "mensal", mesReferencia: "" };
}

const SUGESTOES = SUGESTOES_FIXO.filter((s) => s.categoria === "assinaturas");

/** Valida e salva a assinatura como gasto fixo pago no cartão. Devolve uma mensagem de erro, ou null se deu certo. */
export function salvarAssinatura(r: RascunhoAssinatura, valor: number, cartoes: Cartao[]) {
  if (!r.nome.trim()) return "Qual é a assinatura?";
  if (!(valor > 0)) return "Digite o valor.";
  const cartao = cartoes.find((c) => c.id === r.cartaoId);
  if (!cartao) return "Escolha o cartão.";
  // Um dia antes do fechamento dessa fatura: a cobrança cai certinho nela
  const fatura = r.mesReferencia || faturaAberta(cartao);
  const d = new Date(`${dataDeFechamento(cartao, fatura)}T12:00:00`);
  d.setDate(d.getDate() - 1);
  const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  adicionarGastoFixo({
    nome: r.nome.trim(),
    icone: r.icone,
    categoria: "assinaturas",
    valor,
    varia: false,
    dia: d.getDate(),
    pagamento: "cartao",
    cartaoId: r.cartaoId,
    desde: mes,
    // Começa num mês futuro: só entra nas faturas a partir dele (as faturas antigas já fecharam)
    criadoEm: mes > mesAtual() ? `${mes}-01` : undefined,
    frequencia: r.frequencia,
    mesReferencia: r.frequencia !== "mensal" ? mes : undefined,
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
  const cartao = cartoes.find((c) => c.id === r.cartaoId);
  const mes = r.mesReferencia || (cartao ? faturaAberta(cartao) : mesAtual());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {SUGESTOES.map((s) => (
          <Chip key={s.nome} ativo={r.nome === s.nome} onClick={() => mudar({ nome: s.nome, icone: s.icone })}>
            <Icone e={s.icone} /> {s.nome}
          </Chip>
        ))}
      </div>

      <Campo rotulo="Qual assinatura?">
        <div className="flex gap-2">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-fundo text-xl">
            <Icone e={r.icone} />
          </span>
          <input value={r.nome} onChange={(e) => mudar({ nome: e.target.value })} placeholder="Ex.: Netflix" className="campo" />
        </div>
      </Campo>

      <div className="space-y-1.5">
        <span className="text-xs text-suave">De quanto em quanto tempo cobra?</span>
        <div className="flex flex-wrap gap-2">
          {FREQUENCIAS.filter((f) => f.id !== "personalizada").map((f) => (
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

      <Campo rotulo="Mês da próxima cobrança">
        <CampoMes key={r.cartaoId} valor={mes} onChange={(mesReferencia) => mudar({ mesReferencia })} />
      </Campo>

      <p className="rounded-2xl bg-roxo/10 px-4 py-3 text-xs text-suave">
        🔁 Não tem parcelas nem data para acabar:{" "}
        {r.frequencia === "mensal" ? "entra sozinha na fatura todo mês" : `entra na fatura a cada ${frequencia.meses} meses`}, até
        você excluir.
      </p>
    </div>
  );
}
