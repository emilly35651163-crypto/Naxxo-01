"use client";

import { useState } from "react";
import type { Cartao } from "@/lib/store";
import { brl, lerValor, nomeMes, somarMeses, soNumeros, valorParaCampo } from "@/lib/formato";
import { faturaDaData } from "@/lib/cartoes";
import { Campo, CampoValor, Chip } from "./Campos";

// Campos de uma compra no crédito, na ordem: à vista ou parcelado → valor (parcela ⇄ total) → cartão → parcelas já pagas.
// Usados na aba Contas (Incluir no cartão).

export type RascunhoCredito = { cartaoId: string; parcelado: boolean; parcelas: string; pagas: string };

export function lerRascunhoCredito(r: RascunhoCredito) {
  const parcelas = r.parcelado ? Math.max(Math.round(lerValor(r.parcelas)) || 1, 1) : 1;
  const pagas = Math.min(Math.max(Math.round(lerValor(r.pagas)) || 0, 0), parcelas);
  return { parcelas, pagas };
}

const centavos = (n: number) => Math.round(n * 100) / 100;

export default function CamposCredito({
  cartoes,
  rascunho: r,
  onChange,
  valor,
  onValor,
  data,
}: {
  cartoes: Cartao[];
  rascunho: RascunhoCredito;
  onChange: (novo: RascunhoCredito) => void;
  /** Valor total da compra (texto do campo) */
  valor: string;
  onValor: (texto: string) => void;
  data: string;
}) {
  const mudar = (mudancas: Partial<RascunhoCredito>) => onChange({ ...r, ...mudancas });
  const { parcelas, pagas } = lerRascunhoCredito(r);
  const total = lerValor(valor);
  const cartao = cartoes.find((c) => c.id === r.cartaoId);
  // Valor da parcela: preenchendo ele, o total se calcula; preenchendo o total, ele se calcula
  const [parcela, setParcela] = useState(() => (total > 0 && parcelas > 1 ? valorParaCampo(centavos(total / parcelas)) : ""));
  const [ultimo, setUltimo] = useState<"parcela" | "total">("total");

  if (cartoes.length === 0) {
    return (
      <p className="rounded-2xl bg-roxo/10 px-4 py-3 text-sm text-suave">
        Você ainda não tem cartões. Ative o cartão de crédito de uma conta na aba <b>Contas</b> para lançar compras no crédito.
      </p>
    );
  }

  function mudarParcela(texto: string) {
    setParcela(texto);
    setUltimo("parcela");
    const n = lerValor(texto);
    onValor(n > 0 && parcelas > 1 ? valorParaCampo(centavos(n * parcelas)) : "");
  }

  function mudarTotal(texto: string) {
    onValor(texto);
    setUltimo("total");
    const n = lerValor(texto);
    setParcela(n > 0 && parcelas > 1 ? valorParaCampo(centavos(n / parcelas)) : "");
  }

  function mudarVezes(texto: string) {
    const vezes = soNumeros(texto, false).slice(0, 3);
    mudar({ parcelas: vezes });
    const n = Math.round(lerValor(vezes));
    if (!(n > 1)) return;
    if (ultimo === "parcela" && lerValor(parcela) > 0) onValor(valorParaCampo(centavos(lerValor(parcela) * n)));
    else if (total > 0) setParcela(valorParaCampo(centavos(total / n)));
  }

  // Em qual fatura cai a próxima parcela a pagar
  const proxima = cartao && data ? somarMeses(faturaDaData(data, cartao), pagas) : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-full bg-fundo p-1">
        {[false, true].map((p) => (
          <button
            key={String(p)}
            type="button"
            onClick={() => {
              mudar({ parcelado: p, pagas: p ? r.pagas : "" });
              if (p && total > 0 && parcelas > 1) setParcela(valorParaCampo(centavos(total / parcelas)));
            }}
            className={`rounded-full py-1.5 text-sm font-medium transition-colors ${
              r.parcelado === p ? "bg-white text-fundo" : "text-suave hover:text-white"
            }`}
          >
            {p ? "Parcelado" : "À vista"}
          </button>
        ))}
      </div>

      {r.parcelado ? (
        <>
          <div className="space-y-1.5">
            <span className="text-xs text-suave">Quantas vezes?</span>
            <div className="flex items-center gap-2">
              <input
                inputMode="numeric"
                value={r.parcelas}
                onChange={(e) => mudarVezes(e.target.value)}
                placeholder="2"
                aria-label="Número de parcelas"
                className="campo w-20 text-center"
              />
              <span className="shrink-0 text-sm text-suave">parcelas de:</span>
              <div className="min-w-0 flex-1">
                <CampoValor valor={parcela} onChange={mudarParcela} rotulo="Valor de cada parcela" />
              </div>
            </div>
          </div>
          <Campo rotulo="Valor total">
            <CampoValor valor={valor} onChange={mudarTotal} rotulo="Valor total da compra" />
          </Campo>
        </>
      ) : (
        <Campo rotulo="Valor total da compra">
          <CampoValor valor={valor} onChange={onValor} />
        </Campo>
      )}

      <div className="space-y-1.5">
        <span className="text-xs text-suave">Qual cartão?</span>
        <div className="flex flex-wrap gap-2">
          {cartoes.map((c) => (
            <Chip key={c.id} ativo={r.cartaoId === c.id} onClick={() => mudar({ cartaoId: c.id })}>
              💳 {c.nome}
              <span className="block text-[0.65rem] text-suave">fecha dia {c.diaFechamento}</span>
            </Chip>
          ))}
        </div>
      </div>

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

      {total > 0 && proxima && (
        <p className="rounded-2xl bg-roxo/10 px-4 py-3 text-sm">
          {parcelas > 1 ? (
            <>
              {parcelas}x de <b>{brl(centavos(total / parcelas))}</b> = {brl(total)}
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
