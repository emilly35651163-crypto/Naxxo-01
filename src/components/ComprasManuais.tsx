"use client";

import {
  brl,
  formatarData,
  hojeISO,
  lerValor,
  mesAtual,
  soNumeros,
  somarMeses,
  dataDoRecebimento,
  valorParaCampo,
} from "@/lib/formato";
import { dataPelasParcelasPagas, faturaAberta, faturaDaData } from "@/lib/cartoes";
import { comprasDoTextoDoPrint } from "@/lib/print";
import { lerTextoDosPrints } from "@/lib/ocr";
import { categoriaPelaDescricao, parcelaRepetida, type Extrato } from "@/lib/extrato";
import {
  adicionarCompras,
  adicionarGastoFixo,
  adicionarLancamentos,
  categoriasDe,
  iconeDaCategoria,
  semAcento,
  type CategoriaFixo,
  type Cartao,
  type CompraCartao,
  type Lancamento,
} from "@/lib/store";
import { CampoValor } from "./Campos";
import Icone, { TextoComIcones } from "@/components/Icone";

// A lista para conferir antes de salvar: tudo o que veio do extrato (arquivo), dos prints ou foi digitado à mão.
// Dá para mudar nome, valor, categoria, parcelas e dizer se é esporádico, assinatura ou se repete com valor que varia.

export type Recorrencia = "esporadico" | "assinatura" | "variavel";

export type ItemRevisao = {
  id: number;
  descricao: string;
  valor: string; // no cartão: de cada parcela (ou o total, se à vista)
  entrada?: boolean; // conta: dinheiro que entrou
  categoria: string;
  data?: string; // dia da compra / da movimentação
  dataParcela?: string; // cartão: quando a parcela mostrada caiu (para saber se a fatura dela já fechou)
  parcelas: string; // "1" = à vista
  pagas: string; // parcelas que já foram pagas
  recorrencia: Recorrencia;
  origem: "arquivo" | "print" | "mao";
  extratoId?: string;
};

/** Compatibilidade com o nome antigo */
export type CompraManual = ItemRevisao;

let proximoId = 1;
const itemVazio = (): ItemRevisao => ({
  id: proximoId++,
  descricao: "",
  valor: "",
  categoria: "Compras",
  parcelas: "1",
  pagas: "",
  recorrencia: "esporadico",
  origem: "mao",
});

const RECORRENCIAS: { id: Recorrencia; nome: string; ajuda: string }[] = [
  { id: "esporadico", nome: "Esporádico", ajuda: "Aconteceu uma vez" },
  { id: "assinatura", nome: "Assinatura", ajuda: "Todo mês, mesmo valor" },
  { id: "variavel", nome: "Repete, valor varia", ajuda: "Todo mês, valor muda (luz, gasolina…)" },
];

const chaveDoNome = (descricao: string) =>
  semAcento(descricao)
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Esporádico, assinatura ou variável? Pela categoria e por aparecer em meses diferentes (com o mesmo valor ou não). */
export function sugerirRecorrencias(itens: ItemRevisao[]): ItemRevisao[] {
  const grupos = new Map<string, ItemRevisao[]>();
  for (const it of itens)
    if (!it.entrada) grupos.set(chaveDoNome(it.descricao), [...(grupos.get(chaveDoNome(it.descricao)) ?? []), it]);
  return itens.map((it) => {
    if (it.entrada || Number(it.parcelas) > 1) return it;
    const grupo = grupos.get(chaveDoNome(it.descricao)) ?? [];
    const meses = new Set(grupo.map((g) => g.data?.slice(0, 7)).filter(Boolean));
    const valores = new Set(grupo.map((g) => lerValor(g.valor)));
    if (it.categoria === "Assinaturas") return { ...it, recorrencia: valores.size > 1 ? "variavel" : "assinatura" };
    if (meses.size >= 2) return { ...it, recorrencia: valores.size === 1 ? "assinatura" : "variavel" };
    return it;
  });
}

/** As linhas de um arquivo de extrato → itens para conferir. */
export function itensDoExtrato(extrato: Extrato, modo: "conta" | "cartao"): ItemRevisao[] {
  const repetida = parcelaRepetida(extrato.linhas);
  const itens = extrato.linhas
    // Conta: pagamento de fatura fica de fora (as compras entram pelo cartão). Cartão: pagamentos e estornos ficam de fora.
    .filter((l) => (modo === "cartao" ? l.tipo === "saida" && !repetida(l) : l.categoria !== "Fatura do cartão"))
    .map((l): ItemRevisao => {
      const numero = l.parcela?.numero ?? 1;
      return {
        id: proximoId++,
        descricao: l.descricao,
        valor: valorParaCampo(l.valor),
        entrada: modo === "conta" && l.tipo === "entrada" ? true : undefined,
        categoria: l.categoria === "Outros" && modo === "cartao" ? "Compras" : l.categoria,
        // A parcela N caiu N-1 meses depois da compra
        data:
          numero > 1
            ? dataDoRecebimento(String(Number(l.data.slice(8, 10))), somarMeses(l.data.slice(0, 7), -(numero - 1)))
            : l.data,
        dataParcela: l.data,
        parcelas: String(l.parcela?.total ?? 1),
        pagas: numero > 1 ? String(numero - 1) : "",
        recorrencia: "esporadico",
        origem: "arquivo",
        extratoId: l.id,
      };
    });
  return sugerirRecorrencias(itens);
}

/** Lê os prints e devolve as compras achadas (para a pessoa conferir) e o texto lido. */
export async function comprasDosPrints(arquivos: File[], aoAvancar: (texto: string) => void) {
  const textos = await lerTextoDosPrints(arquivos, aoAvancar, (texto) => comprasDoTextoDoPrint(texto).length > 0);
  const compras: ItemRevisao[] = textos.flatMap((texto) =>
    comprasDoTextoDoPrint(texto).map((c) => {
      const numero = c.parcela?.numero ?? 1;
      const dataParcela = c.dataDaCompra ? undefined : c.data;
      return {
        id: proximoId++,
        descricao: c.descricao,
        valor: valorParaCampo(c.valor),
        categoria: /iof|juros|encargo|anuidade/i.test(c.descricao)
          ? "Outros"
          : categoriaPelaDescricao(c.descricao, "saida").replace(/^Outros$/, "Compras"),
        parcelas: String(c.parcela?.total ?? 1),
        pagas: numero > 1 ? String(numero - 1) : "",
        // A data do dia da compra vale como está; a da parcela N volta N-1 meses
        data:
          dataParcela && numero > 1
            ? dataDoRecebimento(String(Number(dataParcela.slice(8, 10))), somarMeses(dataParcela.slice(0, 7), -(numero - 1)))
            : c.data,
        dataParcela,
        recorrencia: "esporadico" as const,
        origem: "print" as const,
      };
    }),
  );
  return { compras: sugerirRecorrencias(compras), texto: textos.join("\n\n— próximo print —\n\n") };
}

const CATEGORIA_DO_FIXO: Record<string, CategoriaFixo> = {
  Moradia: "moradia",
  Contas: "contas",
  Assinaturas: "assinaturas",
  Saúde: "saude",
  Educação: "educacao",
  Transporte: "transporte",
};

/** Os que se repetem viram um gasto fixo (um por nome); devolve o fixo de cada item. */
function criarFixos(itens: ItemRevisao[], pagamento: { cartaoId?: string; contaId?: string }) {
  const doItem = new Map<number, string>();
  const grupos = new Map<string, ItemRevisao[]>();
  for (const it of itens)
    if (!it.entrada && it.recorrencia !== "esporadico")
      grupos.set(chaveDoNome(it.descricao), [...(grupos.get(chaveDoNome(it.descricao)) ?? []), it]);
  for (const grupo of grupos.values()) {
    const ordem = [...grupo].sort((a, b) => (a.data ?? "").localeCompare(b.data ?? ""));
    const ultimo = ordem[ordem.length - 1];
    const valores = grupo.map((g) => lerValor(g.valor));
    const varia = ultimo.recorrencia === "variavel";
    const dia = Number((ultimo.data ?? hojeISO()).slice(8, 10));
    const noCartao = !!pagamento.cartaoId;
    const id = adicionarGastoFixo({
      nome: ultimo.descricao.trim() || "Gasto fixo",
      icone:
        ultimo.recorrencia === "assinatura" && ultimo.categoria === "Assinaturas"
          ? "📺"
          : iconeDaCategoria("saida", ultimo.categoria),
      categoria:
        ultimo.recorrencia === "assinatura" && noCartao ? "assinaturas" : (CATEGORIA_DO_FIXO[ultimo.categoria] ?? "outros"),
      // Variável: a média; assinatura: o valor mais recente
      valor: varia ? Math.round((valores.reduce((t, v) => t + v, 0) / valores.length) * 100) / 100 : lerValor(ultimo.valor),
      varia,
      dia,
      pagamento: noCartao ? "cartao" : "debito",
      ...pagamento,
      // No cartão, começa na fatura aberta (as antigas já foram pagas e ficam como histórico)
      desde: noCartao ? mesAtual() : (ordem[0].data ?? hojeISO()).slice(0, 7),
      criadoEm: noCartao ? hojeISO() : (ordem[0].data ?? hojeISO()),
    });
    grupo.forEach((g) => doItem.set(g.id, id));
  }
  return doItem;
}

/** Cria os lançamentos da conta (o que está no extrato já está no saldo de hoje). */
export function criarItensDaConta(itens: ItemRevisao[], contaId: string) {
  const hoje = hojeISO();
  const fixos = criarFixos(itens, { contaId });
  const lancamentos: Omit<Lancamento, "id">[] = itens
    .filter((it) => lerValor(it.valor) > 0)
    .map((it) => {
      const data = it.data ?? hoje;
      const fixoId = fixos.get(it.id);
      return {
        tipo: it.entrada ? "entrada" : "saida",
        valor: lerValor(it.valor),
        descricao: it.descricao.trim() || "Sem nome",
        categoria: it.categoria,
        data,
        pago: data <= hoje,
        contaId,
        jaNoSaldo: true,
        extratoId: it.extratoId,
        importado: true,
        ...(fixoId ? { gastoFixoId: fixoId, competencia: data.slice(0, 7) } : {}),
      };
    });
  adicionarLancamentos(lancamentos);
}

/** Cria as compras do cartão; o que se repete vira assinatura/gasto fixo do cartão. */
export function criarItensDoCartao(itens: ItemRevisao[], cartao: Pick<Cartao, "id" | "diaFechamento" | "diaVencimento">) {
  const aberta = faturaAberta(cartao);
  const fixos = criarFixos(itens, { cartaoId: cartao.id });
  const compras: Omit<CompraCartao, "id">[] = itens
    .filter((it) => lerValor(it.valor) > 0)
    // Repete e é da fatura aberta: o gasto fixo já cobra nela (não entra duas vezes)
    .filter((it) => !(fixos.has(it.id) && it.data && faturaDaData(it.dataParcela ?? it.data, cartao) >= aberta))
    .map((it) => {
      const parcelas = Math.max(Number(it.parcelas) || 1, 1);
      let pagas = Math.min(Number(it.pagas) || 0, parcelas);
      // A parcela mostrada é de uma fatura que já fechou: ela também já foi paga
      const daParcela = it.dataParcela ?? (parcelas === 1 ? it.data : undefined);
      if (daParcela && faturaDaData(daParcela, cartao) < aberta) pagas = Math.min(pagas + 1, parcelas);
      return {
        cartaoId: cartao.id,
        descricao: it.descricao.trim() || "Compra",
        categoria: it.categoria,
        valorTotal: Math.round(lerValor(it.valor) * parcelas * 100) / 100,
        parcelas,
        parcelasPagas: pagas || undefined,
        // Sem data (à mão): volta um mês por parcela paga
        data: it.data ?? dataPelasParcelasPagas(pagas),
        extratoId: it.extratoId,
        importado: true,
        ...(fixos.get(it.id) ? { gastoFixoId: fixos.get(it.id), competencia: (it.data ?? hojeISO()).slice(0, 7) } : {}),
      };
    });
  adicionarCompras(compras);
}

export type StatusDoPrint = { lendo: string; aviso: string; texto: string };

export default function ComprasManuais({
  lista,
  onChange,
  onPrints,
  status,
  modo = "cartao",
}: {
  lista: ItemRevisao[];
  onChange: (nova: ItemRevisao[]) => void;
  onPrints?: (arquivos: File[]) => void;
  status?: StatusDoPrint;
  modo?: "conta" | "cartao";
}) {
  const { lendo, aviso, texto } = status ?? { lendo: "", aviso: "", texto: "" };
  const cartao = modo === "cartao";
  const mudar = (id: number, mudancas: Partial<ItemRevisao>) =>
    onChange(lista.map((c) => (c.id === id ? { ...c, ...mudancas } : c)));
  // Assinatura/variável vale para todos com o mesmo nome (a Netflix de cada mês é a mesma assinatura)
  function mudarRecorrencia(item: ItemRevisao, recorrencia: Recorrencia) {
    const chave = chaveDoNome(item.descricao);
    onChange(
      lista.map((c) => (c.id === item.id || (!c.entrada && chaveDoNome(c.descricao) === chave) ? { ...c, recorrencia } : c)),
    );
  }

  const saidas = lista.filter((c) => !c.entrada).reduce((t, c) => t + (lerValor(c.valor) || 0), 0);
  const entradas = lista.filter((c) => c.entrada).reduce((t, c) => t + (lerValor(c.valor) || 0), 0);
  const repetidos = (c: ItemRevisao) =>
    lista.filter((x) => !x.entrada && chaveDoNome(x.descricao) === chaveDoNome(c.descricao)).length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-suave">
          {lista.length
            ? `Confira (${lista.length}): dá para mudar tudo e dizer o que se repete.`
            : cartao
              ? "Sem extrato? Adicione as compras que ainda estão sendo pagas:"
              : "Sem extrato? Dá para adicionar à mão:"}
        </span>
        {onPrints && (
          <label className="cursor-pointer rounded-full border border-rosa/50 px-3 py-1.5 text-xs font-medium text-rosa hover:bg-rosa/10">
            <Icone e="📸" /> Ler print da fatura
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
        )}
      </div>
      {lendo && (
        <p className="animate-pulse text-xs text-rosa">
          <Icone e="🔎" /> {lendo}
        </p>
      )}
      {aviso && <p className="text-xs text-amber-300">{aviso}</p>}
      {texto && (
        <details className="text-xs text-suave">
          <summary className="cursor-pointer">Ver o que o leitor leu no print</summary>
          <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-fundo p-2">{texto}</pre>
        </details>
      )}

      <ul className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
        {lista.map((c) => (
          <li
            key={c.id}
            className={`space-y-1.5 rounded-xl border p-2 ${c.origem === "print" ? "border-amber-300/30 bg-amber-300/5" : "border-white/10"}`}
          >
            <div className="flex items-center gap-2">
              <input
                value={c.descricao}
                onChange={(e) => mudar(c.id, { descricao: e.target.value })}
                placeholder={c.origem === "print" ? "📸 Nome" : "Ex.: Celular"}
                aria-label="O que foi"
                className="campo min-w-0 flex-1 py-1.5 text-sm"
              />
              <div className={`w-32 shrink-0 ${c.entrada ? "text-entrada" : ""}`}>
                <CampoValor
                  valor={c.valor}
                  onChange={(valor) => mudar(c.id, { valor })}
                  rotulo={cartao ? "Valor da parcela" : "Valor"}
                />
              </div>
              <button
                type="button"
                onClick={() => onChange(lista.filter((x) => x.id !== c.id))}
                aria-label="Remover"
                className="shrink-0 text-lg text-suave hover:text-saida"
              >
                ×
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-suave">
              <span className={c.entrada ? "font-semibold text-entrada" : ""}>
                {c.entrada ? "＋ entrou" : "− saiu"}
                {c.data && ` · ${formatarData(c.data)}`}
              </span>
              <select
                value={c.categoria}
                onChange={(e) => mudar(c.id, { categoria: e.target.value })}
                aria-label="Categoria"
                className="rounded-lg bg-superficie px-2 py-1 text-xs text-white"
              >
                {categoriasDe(c.entrada ? "entrada" : "saida")
                  .filter((x) => x.nome !== "Guardar (metas)")
                  .map((x) => (
                    <option key={x.nome} value={x.nome}>
                      {x.nome}
                    </option>
                  ))}
              </select>
              {cartao && (
                <span className="flex items-center gap-1">
                  <input
                    inputMode="numeric"
                    value={c.parcelas}
                    onChange={(e) => mudar(c.id, { parcelas: soNumeros(e.target.value, false).slice(0, 2) || "1" })}
                    aria-label="Em quantas vezes"
                    className="w-9 rounded-lg bg-superficie px-1 py-1 text-center text-xs text-white"
                  />
                  x
                  {Number(c.parcelas) > 1 && (
                    <>
                      , pagas
                      <input
                        inputMode="numeric"
                        value={c.pagas}
                        onChange={(e) => mudar(c.id, { pagas: soNumeros(e.target.value, false).slice(0, 2) })}
                        placeholder="0"
                        aria-label="Parcelas já pagas"
                        className="w-9 rounded-lg bg-superficie px-1 py-1 text-center text-xs text-white"
                      />
                    </>
                  )}
                </span>
              )}
            </div>
            {!c.entrada && !(Number(c.parcelas) > 1) && (
              <div className="flex flex-wrap gap-1">
                {RECORRENCIAS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    title={r.ajuda}
                    onClick={() => mudarRecorrencia(c, r.id)}
                    className={`rounded-full border px-2 py-0.5 text-[0.7rem] ${
                      c.recorrencia === r.id ? "border-rosa bg-rosa/20 text-white" : "border-white/10 text-suave hover:text-white"
                    }`}
                  >
                    <TextoComIcones texto={r.id === "assinatura" ? "🔁 " : r.id === "variavel" ? "〰️ " : ""} />
                    {r.nome}
                  </button>
                ))}
                {c.recorrencia !== "esporadico" && repetidos(c) > 1 && (
                  <span className="self-center text-[0.65rem] text-suave">vale para os {repetidos(c)} com esse nome</span>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onChange([...lista, { ...itemVazio(), categoria: cartao ? "Compras" : "Outros" }])}
        className="w-full rounded-xl border border-dashed border-white/15 py-2 text-xs text-suave hover:border-rosa hover:text-white"
      >
        + Adicionar à mão
      </button>
      {(saidas > 0 || entradas > 0) && (
        <p className="text-right text-xs text-suave">
          {saidas > 0 && (
            <>
              Saídas: <b className="text-saida">{brl(saidas)}</b>
            </>
          )}
          {saidas > 0 && entradas > 0 && " · "}
          {entradas > 0 && (
            <>
              Entradas: <b className="text-entrada">{brl(entradas)}</b>
            </>
          )}
        </p>
      )}
    </div>
  );
}
