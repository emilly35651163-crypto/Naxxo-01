"use client";

import type { Cartao } from "@/lib/store";
import { brl, lerValor, nomeMes, somarMeses, soNumeros } from "@/lib/formato";
import { faturaDaData, valorDaParcela } from "@/lib/cartoes";
import { Chip } from "./Campos";
import EscolhaParcelas from "./EscolhaParcelas";

// Campos de uma compra no crédito (cartão, parcelas, parcelas já pagas),
// usados na aba Contas (Incluir no cartão).

export type RascunhoCredito = { cartaoId: string; parcelas: string; pagas: string };

export function lerRascunhoCredito(r: RascunhoCredito) {
  const parcelas = Math.max(Math.round(lerValor(r.parcelas)) || 1, 1);
  const pagas = Math.min(Math.max(Math.round(lerValor(r.pagas)) || 0, 0), parcelas);
  return { parcelas, pagas };
}

export default function CamposCredito({
  cartoes,
  rascunho: r,
  onChange,
  valorTotal,
  data,
}: {
  cartoes: Cartao[];
  rascunho: RascunhoCredito;
  onChange: (novo: RascunhoCredito) => void;
  valorTotal: number;
  data: string;
}) {
  const mudar = (mudancas: Partial<RascunhoCredito>) => onChange({ ...r, ...mudancas });
  const { parcelas, pagas } = lerRascunhoCredito(r);
  const cartao = cartoes.find((c) => c.id === r.cartaoId);

  if (cartoes.length === 0) {
    return (
      <p className="rounded-2xl bg-roxo/10 px-4 py-3 text-sm text-suave">
        Você ainda não tem cartões. Ative o cartão de crédito de uma conta na aba <b>Contas</b> para lançar compras no crédito.
      </p>
    );
  }

  // Em qual fatura cai a próxima parcela a pagar
  const proxima = cartao && data ? somarMeses(faturaDaData(data, cartao), pagas) : null;

  return (
    <div className="space-y-4">
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

      <EscolhaParcelas valor={r.parcelas} onChange={(parcelas) => mudar({ parcelas })} />

      {parcelas > 1 && (
        <label className="flex items-center gap-3 text-sm">
          <span className="flex-1">Quantas parcelas já foram pagas?</span>
          <input
            inputMode="numeric"
            value={r.pagas}
            onChange={(e) => mudar({ pagas: soNumeros(e.target.value, false) })}
            placeholder="0"
            className="campo w-20 text-center"
          />
        </label>
      )}

      {valorTotal > 0 && proxima && (
        <p className="rounded-2xl bg-roxo/10 px-4 py-3 text-sm">
          {parcelas > 1 ? (
            <>
              {parcelas}x de <b>{brl(valorDaParcela({ valorTotal, parcelas }, 1))}</b>
              {pagas > 0 && (
                <>
                  {" "}
                  · {pagas} já paga{pagas > 1 ? "s" : ""}
                </>
              )}
              {pagas < parcelas ? (
                <>
                  . A próxima cai na fatura de <strong className="gradiente-texto">{nomeMes(proxima)}</strong>.
                </>
              ) : (
                <>. Tudo pago! 🎉</>
              )}
            </>
          ) : (
            <>
              Cai na fatura de <strong className="gradiente-texto">{nomeMes(proxima)}</strong>.
            </>
          )}
        </p>
      )}
    </div>
  );
}
