"use client";

import { brl, lerValor, soNumeros, somarMeses, dataDoRecebimento, valorParaCampo } from "@/lib/formato";
import { dataPelasParcelasPagas } from "@/lib/cartoes";
import { comprasDoTextoDoPrint } from "@/lib/print";
import { lerTextoDosPrints } from "@/lib/ocr";
import type { CompraCartao } from "@/lib/store";
import { CampoValor } from "./Campos";

// Compras do cartão sem extrato: à mão, ou lendo prints da fatura (o app lê o texto da imagem e a pessoa confere).

export type CompraManual = {
  id: number;
  descricao: string;
  valor: string; // de cada parcela (ou o total, se à vista)
  parcelas: string; // "1" = à vista
  pagas: string; // parcelas que já foram pagas
  data?: string; // do print, quando ele mostra
  doPrint?: boolean;
};

let proximoId = 1;
const compraVazia = (): CompraManual => ({ id: proximoId++, descricao: "", valor: "", parcelas: "1", pagas: "" });

/** As compras preenchidas → compras do cartão. */
export function comprasManuaisParaCartao(lista: CompraManual[], cartaoId: string): Omit<CompraCartao, "id">[] {
  return lista
    .filter((c) => lerValor(c.valor) > 0)
    .map((c) => {
      const parcelas = Math.max(Number(c.parcelas) || 1, 1);
      const pagas = Math.min(Number(c.pagas) || 0, parcelas);
      return {
        cartaoId,
        descricao: c.descricao.trim() || "Compra",
        categoria: "Compras",
        valorTotal: Math.round(lerValor(c.valor) * parcelas * 100) / 100,
        parcelas,
        parcelasPagas: pagas || undefined,
        // Com a data do print, ela vale; senão, volta um mês por parcela paga
        data: c.data ?? dataPelasParcelasPagas(pagas),
        importado: true,
      };
    });
}

/** Lê os prints e devolve as compras achadas (para a pessoa conferir) e o texto lido. */
export async function comprasDosPrints(arquivos: File[], aoAvancar: (texto: string) => void) {
  const textos = await lerTextoDosPrints(arquivos, aoAvancar, (texto) => comprasDoTextoDoPrint(texto).length > 0);
  const compras: CompraManual[] = textos.flatMap((texto) =>
    comprasDoTextoDoPrint(texto).map((c) => {
      const numero = c.parcela?.numero ?? 1;
      return {
        id: proximoId++,
        descricao: c.descricao,
        valor: valorParaCampo(c.valor),
        parcelas: String(c.parcela?.total ?? 1),
        pagas: numero > 1 ? String(numero - 1) : "",
        // A data do dia da compra vale como está; a da parcela N volta N-1 meses
        data:
          c.data && numero > 1 && !c.dataDaCompra
            ? dataDoRecebimento(String(Number(c.data.slice(8, 10))), somarMeses(c.data.slice(0, 7), -(numero - 1)))
            : c.data,
        doPrint: true,
      };
    }),
  );
  return { compras, texto: textos.join("\n\n— próximo print —\n\n") };
}

export type StatusDoPrint = { lendo: string; aviso: string; texto: string };

export default function ComprasManuais({
  lista,
  onChange,
  onPrints,
  status,
}: {
  lista: CompraManual[];
  onChange: (nova: CompraManual[]) => void;
  onPrints: (arquivos: File[]) => void;
  status: StatusDoPrint;
}) {
  const { lendo, aviso, texto } = status;
  const mudar = (id: number, mudancas: Partial<CompraManual>) =>
    onChange(lista.map((c) => (c.id === id ? { ...c, ...mudancas } : c)));

  const total = lista.reduce((t, c) => t + (lerValor(c.valor) || 0), 0);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-suave">Sem extrato? Adicione as compras que ainda estão sendo pagas:</span>
        <label className="cursor-pointer rounded-full border border-rosa/50 px-3 py-1.5 text-xs font-medium text-rosa hover:bg-rosa/10">
          📸 Ler print da fatura
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            disabled={!!lendo}
            onChange={(e) => {
              if (e.target.files?.length) onPrints(Array.from(e.target.files));
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {lendo && <p className="animate-pulse text-xs text-rosa">🔎 {lendo}</p>}
      {aviso && <p className="text-xs text-amber-300">{aviso}</p>}
      {texto && (
        <details className="text-xs text-suave">
          <summary className="cursor-pointer">Ver o que o leitor leu no print</summary>
          <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-fundo p-2">{texto}</pre>
        </details>
      )}

      {lista.length > 0 && (
        <div className="hidden grid-cols-[1fr_7rem_3.5rem_3.5rem_1.5rem] gap-2 px-1 text-[0.65rem] text-suave sm:grid">
          <span>O que foi</span>
          <span>Valor (parcela)</span>
          <span>Vezes</span>
          <span>Já pagas</span>
          <span />
        </div>
      )}
      {lista.map((c) => (
        <div
          key={c.id}
          className={`grid grid-cols-[1fr_auto] gap-2 rounded-xl p-1 sm:grid-cols-[1fr_7rem_3.5rem_3.5rem_1.5rem] sm:items-center ${
            c.doPrint ? "bg-amber-300/5" : ""
          }`}
        >
          <input
            value={c.descricao}
            onChange={(e) => mudar(c.id, { descricao: e.target.value })}
            placeholder={c.doPrint ? "📸 Nome" : "Ex.: Celular"}
            aria-label="O que foi"
            className="campo py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => onChange(lista.filter((x) => x.id !== c.id))}
            aria-label="Remover compra"
            className="text-lg text-suave hover:text-saida sm:order-last"
          >
            ×
          </button>
          <div className="col-span-2 grid grid-cols-[1fr_3.5rem_3.5rem] gap-2 sm:contents">
            <CampoValor valor={c.valor} onChange={(valor) => mudar(c.id, { valor })} rotulo="Valor da parcela" />
            <input
              inputMode="numeric"
              value={c.parcelas}
              onChange={(e) => mudar(c.id, { parcelas: soNumeros(e.target.value, false).slice(0, 2) || "1" })}
              aria-label="Em quantas vezes"
              title="Em quantas vezes (1 = à vista)"
              className="campo px-1 py-2 text-center text-sm"
            />
            <input
              inputMode="numeric"
              value={c.pagas}
              onChange={(e) => mudar(c.id, { pagas: soNumeros(e.target.value, false).slice(0, 2) })}
              placeholder="0"
              aria-label="Parcelas já pagas"
              title="Quantas parcelas já foram pagas"
              className="campo px-1 py-2 text-center text-sm"
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...lista, compraVazia()])}
        className="w-full rounded-xl border border-dashed border-white/15 py-2 text-xs text-suave hover:border-rosa hover:text-white"
      >
        + Adicionar compra à mão
      </button>
      {total > 0 && (
        <p className="text-right text-xs text-suave">
          Soma das parcelas: <b className="text-white">{brl(total)}</b>
        </p>
      )}
    </div>
  );
}
