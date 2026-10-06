"use client";

import { useState } from "react";
import { temContratoDeJuros, type TipoDivida } from "@/lib/store";
import { brl, lerValor, nomeMes, soNumeros } from "@/lib/formato";
import { metaDeQuitar } from "@/lib/metas";
import { formatarTaxa, taxaImplicita } from "@/lib/juros";
import { Campo, CampoSelect, CampoValor, DIAS_DO_MES } from "./Campos";

// Os campos de algo para quitar (parcelado, empréstimo, financiamento),
// usados no questionário e na Trilha. Os valores ficam como texto enquanto a pessoa digita.

export type RascunhoQuitar = {
  divida: TipoDivida;
  parcela: string;
  parcelas: string;
  pagas: string;
  valorOriginal: string;
  juros: string; // % ao mês, como a pessoa digitou ("2,5")
  dia: string; // dia do vencimento da parcela
  aVista?: boolean; // um valor só (ex.: conta atrasada), sem parcelas
};

export const RASCUNHO_QUITAR_VAZIO: RascunhoQuitar = {
  divida: "parcelado",
  parcela: "",
  parcelas: "",
  pagas: "",
  valorOriginal: "",
  juros: "",
  dia: "",
};

/** Os números do rascunho, ou null se faltar algo obrigatório. */
export function lerRascunhoQuitar(r: RascunhoQuitar) {
  const parcela = lerValor(r.parcela);
  const parcelas = r.aVista ? 1 : Math.round(lerValor(r.parcelas));
  const parcelasPagas = r.aVista ? 0 : Math.round(lerValor(r.pagas) || 0);
  if (!(parcela > 0) || !(parcelas > 0) || parcelasPagas > parcelas) return null;
  return {
    divida: r.divida,
    parcela,
    parcelas,
    parcelasPagas,
    valorOriginal: lerValor(r.valorOriginal) || undefined,
    jurosMes: lerValor(r.juros) > 0 ? lerValor(r.juros) / 100 : undefined,
    diaVencimento: r.dia ? Number(r.dia) : undefined,
  };
}

export default function CamposQuitar({
  rascunho: r,
  onChange,
}: {
  rascunho: RascunhoQuitar;
  onChange: (novo: RascunhoQuitar) => void;
}) {
  const mudar = (mudancas: Partial<RascunhoQuitar>) => onChange({ ...r, ...mudancas });
  const contrato = temContratoDeJuros(r.divida);
  const [detalhesAbertos, setDetalhesAbertos] = useState(contrato || !!r.valorOriginal || !!r.juros);

  const dados = lerRascunhoQuitar(r);
  const total = dados ? dados.parcela * dados.parcelas : 0;
  const restantes = dados ? dados.parcelas - dados.parcelasPagas : 0;
  const quitacao = dados ? metaDeQuitar({ nome: "", icone: "", ...dados }).prazo : null;
  const juros = dados?.valorOriginal ? total - dados.valorOriginal : 0;
  const taxaCalculada = dados?.valorOriginal ? taxaImplicita(dados.valorOriginal, dados.parcela, dados.parcelas) : null;

  return (
    <div className="space-y-4">
      {/* Um valor só (conta atrasada) ou parcelado? */}
      <div className="grid grid-cols-2 gap-1 rounded-full bg-fundo p-1 text-sm" role="radiogroup" aria-label="Como é a dívida">
        {[false, true].map((v) => (
          <button
            key={String(v)}
            type="button"
            role="radio"
            aria-checked={!!r.aVista === v}
            onClick={() => mudar({ aVista: v })}
            className={`rounded-full py-2 transition-colors ${!!r.aVista === v ? "bg-white font-semibold text-fundo" : "text-suave"}`}
          >
            {v ? "Um valor só" : "Parcelado"}
          </button>
        ))}
      </div>

      {r.aVista ? (
        <Campo rotulo="Quanto deve?">
          <CampoValor valor={r.parcela} onChange={(parcela) => mudar({ parcela })} />
        </Campo>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Campo rotulo="Parcela">
            <CampoValor valor={r.parcela} onChange={(parcela) => mudar({ parcela })} />
          </Campo>
          <Campo rotulo="Quantas vezes?">
            <input
              inputMode="numeric"
              value={r.parcelas}
              onChange={(e) => mudar({ parcelas: soNumeros(e.target.value, false) })}
              placeholder="Ex.: 12"
              className="campo"
            />
          </Campo>
          <Campo rotulo="Já paguei">
            <input
              inputMode="numeric"
              value={r.pagas}
              onChange={(e) => mudar({ pagas: soNumeros(e.target.value, false) })}
              placeholder="Ex.: 2"
              className="campo"
            />
          </Campo>
        </div>
      )}

      {lerValor(r.pagas) > lerValor(r.parcelas) && lerValor(r.parcelas) > 0 && (
        <p className="text-xs text-saida">As parcelas pagas não podem passar do total.</p>
      )}

      <Campo rotulo={r.aVista ? "Quer pagar até o dia (opcional)" : "Vence todo dia (opcional)"}>
        <CampoSelect valor={r.dia} onChange={(dia) => mudar({ dia })} opcoes={DIAS_DO_MES} placeholder="Até o fim do mês" />
      </Campo>

      {dados && (
        <div className="grid grid-cols-2 gap-3 rounded-2xl bg-roxo/10 p-4 text-sm">
          <div>
            <p className="text-xs text-suave">{r.aVista ? "Valor da dívida" : "Total do parcelamento"}</p>
            <p className="font-display text-lg font-bold tabular-nums">{brl(total)}</p>
          </div>
          <div>
            <p className="text-xs text-suave">{restantes > 0 ? `Faltam ${restantes} parcelas` : "Situação"}</p>
            <p className="font-display text-lg font-bold tabular-nums">
              {restantes > 0 ? brl(restantes * dados.parcela) : "Tudo pago 🎉"}
            </p>
          </div>
          {restantes > 0 && quitacao && (
            <p className="col-span-2">
              Você quita em <strong className="gradiente-texto">{nomeMes(quitacao)}</strong> 🎉
            </p>
          )}
        </div>
      )}

      {/* Juros: abre sozinho para empréstimo e financiamento */}
      {!detalhesAbertos ? (
        <button type="button" onClick={() => setDetalhesAbertos(true)} className="text-sm text-rosa">
          + Tem juros? Informar valor original ou taxa
        </button>
      ) : (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-fundo/50 p-4">
          <div>
            <p className="text-sm font-semibold">📈 Juros</p>
            <p className="text-xs text-suave">
              {contrato
                ? "Com a taxa do contrato, o app calcula quanto você economiza adiantando parcelas."
                : "Opcional: para saber quanto está pagando a mais."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo={r.divida === "emprestimo" ? "Valor que pegou emprestado" : "Valor original (sem juros)"}>
              <CampoValor valor={r.valorOriginal} onChange={(valorOriginal) => mudar({ valorOriginal })} />
            </Campo>
            <Campo rotulo="Taxa de juros (% ao mês)">
              <div className="campo flex items-center gap-2">
                <input
                  inputMode="decimal"
                  value={r.juros}
                  onChange={(e) => mudar({ juros: soNumeros(e.target.value) })}
                  placeholder={taxaCalculada ? formatarTaxa(taxaCalculada).replace("%", "") : "Ex.: 2,5"}
                  className="w-full bg-transparent outline-none placeholder:text-white/45"
                />
                <span className="text-suave">%</span>
              </div>
            </Campo>
          </div>
          {juros > 0 && (
            <p className="text-sm">
              Você vai pagar <strong className="text-saida">{brl(juros)}</strong> de juros
              {taxaCalculada ? <span className="text-suave"> (≈ {formatarTaxa(taxaCalculada)} ao mês)</span> : null}.
            </p>
          )}
          {dados?.valorOriginal && juros <= 0 && <p className="text-sm text-entrada">Sem juros! 🙌</p>}
          {contrato && !r.juros && !r.valorOriginal && (
            <p className="text-xs text-suave">💡 A taxa costuma estar no contrato ou no app do banco, como “juros a.m.”.</p>
          )}
        </div>
      )}
    </div>
  );
}
