"use client";

import { useEffect, useState } from "react";
import {
  adicionarCompras,
  adicionarLancamentos,
  atualizarCompra,
  atualizarLancamento,
  categoriasDe,
  useCartoes,
  useCategoriasPersonalizadas,
  useCompras,
  useLancamentos,
} from "@/lib/store";
import { brl, formatarData, hojeISO } from "@/lib/formato";
import { cartoesDeCredito, marcoDoSaldo } from "@/lib/contas";
import { faturaAberta, faturaDaData } from "@/lib/cartoes";
import { jaExiste, lerExtrato, type Existente, type LinhaExtrato } from "@/lib/extrato";
import { comDesfazer } from "@/lib/avisos";
import Modal from "./Modal";

/** Lê o arquivo como UTF-8; se vier com acentos quebrados (bancos antigos), lê de novo como Windows-1252. */
async function lerArquivo(arquivo: File) {
  const bytes = await arquivo.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  return utf8.includes("�") ? new TextDecoder("windows-1252").decode(bytes) : utf8;
}

/**
 * Linha do extrato na lista. Com `conflito`, já existe algo parecido (data, valor ou conta diferente)
 * e a pessoa precisa dizer qual está certo:
 * - "app": o que já estava fica como está;  - "extrato": corrige o que estava com os dados do extrato;
 * - "ambos": são duas coisas diferentes, inclui a do extrato também.
 */
type Linha = LinhaExtrato & { marcada: boolean; aviso?: string; conflito?: Existente; escolha?: "app" | "extrato" | "ambos" };

// Importar o extrato do banco (OFX ou CSV): mostra tudo antes, a pessoa desmarca o que não quer e importa.
export default function ImportarExtrato({ onFechar, arquivoInicial }: { onFechar: () => void; arquivoInicial?: File | null }) {
  const contas = useCartoes();
  const lancamentos = useLancamentos();
  const compras = useCompras();
  const personalizadas = useCategoriasPersonalizadas();
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [ehCartao, setEhCartao] = useState(false);
  const [contaId, setContaId] = useState("");
  const [erro, setErro] = useState("");
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [arrastando, setArrastando] = useState(false);

  const opcoes = ehCartao ? cartoesDeCredito(contas) : contas;
  const conta = opcoes.find((c) => c.id === contaId);

  // Marca o que é novo; desmarca o que já está no app e o pagamento de fatura (esse se registra pela fatura)
  function preparar(lidas: LinhaExtrato[], cartao: boolean, id: string): Linha[] {
    return lidas
      .filter((l) => !cartao || l.tipo === "saida") // no cartão, pagamento e estorno não são compras
      .map((l) => {
        const existente = jaExiste(l, id, lancamentos, compras, cartao);
        if (existente?.exato) return { ...l, marcada: false, aviso: `já está no app: “${existente.descricao}”` };
        if (existente) return { ...l, marcada: false, conflito: existente };
        if (l.categoria === "Fatura do cartão")
          return { ...l, marcada: false, aviso: "pagamento de fatura: registre em Contas → Pagar fatura" };
        return { ...l, marcada: true };
      })
      .sort((a, b) => b.data.localeCompare(a.data));
  }

  async function escolherArquivo(arquivo: File | undefined) {
    if (!arquivo) return;
    const texto = await lerArquivo(arquivo);
    setErro("");
    setNomeArquivo(arquivo.name);
    if (/^%PDF/.test(texto)) {
      setLinhas(null);
      return setErro("Esse é o PDF do extrato. Baixe de novo escolhendo OFX ou CSV (o PDF não dá para ler).");
    }
    const extrato = lerExtrato(texto);
    if (extrato.linhas.length === 0) {
      setLinhas(null);
      return setErro("Não encontrei movimentações nesse arquivo. Ele precisa ser o extrato em OFX ou CSV.");
    }
    const lista = extrato.ehCartao ? cartoesDeCredito(contas) : contas;
    const id = lista.some((c) => c.id === contaId) ? contaId : (lista[0]?.id ?? "");
    setEhCartao(extrato.ehCartao);
    setContaId(id);
    setLinhas(preparar(extrato.linhas, extrato.ehCartao, id));
  }

  // Arquivo arrastado direto para a tela de Lançamentos
  useEffect(() => {
    // (depois de montar: os estados mudam quando o arquivo termina de ser lido)
    if (arquivoInicial) void Promise.resolve(arquivoInicial).then(escolherArquivo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arquivoInicial]);

  function trocarConta(id: string) {
    setContaId(id);
    if (linhas) setLinhas(preparar(linhas, ehCartao, id));
  }

  function mudarLinha(i: number, mudancas: Partial<Linha>) {
    setLinhas((atual) => atual && atual.map((l, j) => (j === i ? { ...l, ...mudancas } : l)));
  }

  const marcadas = linhas?.filter((l) => (l.conflito ? l.escolha === "ambos" : l.marcada)) ?? [];
  const corrigir = linhas?.filter((l) => l.conflito && l.escolha === "extrato") ?? [];
  const manter = linhas?.filter((l) => l.conflito && l.escolha === "app") ?? [];
  const semResposta = linhas?.filter((l) => l.conflito && !l.escolha).length ?? 0;
  const nomeConta = (id?: string) => contas.find((x) => x.id === id)?.nome ?? "sem conta";
  const totalSai = marcadas.filter((l) => l.tipo === "saida").reduce((t, l) => t + l.valor, 0);
  const totalEntra = marcadas.filter((l) => l.tipo === "entrada").reduce((t, l) => t + l.valor, 0);

  const semDuvida = linhas?.filter((l) => !l.conflito) ?? [];
  const todasMarcadas = semDuvida.length > 0 && semDuvida.every((l) => l.marcada);

  function importar() {
    if (!conta) return setErro(ehCartao ? "Escolha o cartão." : "Escolha a conta.");
    if (semResposta > 0)
      return setErro(`Falta dizer qual está certo em ${semResposta} ${semResposta > 1 ? "itens" : "item"} (marcados com ⚖️).`);
    if (marcadas.length + corrigir.length + manter.length === 0) return setErro("Marque pelo menos uma movimentação.");
    const hoje = hojeISO();
    const texto = [marcadas.length && `${marcadas.length} importados`, corrigir.length && `${corrigir.length} corrigidos`]
      .filter(Boolean)
      .join(", ");
    if (ehCartao) {
      const aberta = faturaAberta(conta);
      comDesfazer(`${texto || "Pronto"} ✓`, () => {
        // Corrige com os dados do extrato; o que ficou como no app só ganha a marca (para não perguntar de novo)
        corrigir.forEach((l) =>
          atualizarCompra(l.conflito!.id, { data: l.data, valorTotal: l.valor, cartaoId: conta.id, extratoId: l.id }),
        );
        manter.forEach((l) => atualizarCompra(l.conflito!.id, { extratoId: l.id }));
        adicionarCompras(
          marcadas.map((l) => ({
            cartaoId: conta.id,
            descricao: l.descricao,
            categoria: l.categoria,
            valorTotal: l.valor,
            parcelas: 1,
            // Faturas que já fecharam: a compra entra no histórico, mas não volta a cobrar
            parcelasPagas: faturaDaData(l.data, conta) < aberta ? 1 : undefined,
            data: l.data,
            extratoId: l.id,
          })),
        );
      });
    } else {
      // O que aconteceu até o dia em que o saldo foi informado já está nele: não muda o saldo
      const diaDoMarco = marcoDoSaldo(conta).slice(0, 10);
      comDesfazer(`${texto || "Pronto"} ✓`, () => {
        corrigir.forEach((l) =>
          atualizarLancamento(l.conflito!.id, {
            data: l.data,
            valor: l.valor,
            contaId: conta.id,
            pago: l.data <= hoje,
            extratoId: l.id,
          }),
        );
        manter.forEach((l) => atualizarLancamento(l.conflito!.id, { extratoId: l.id }));
        adicionarLancamentos(
          marcadas.map((l) => ({
            tipo: l.tipo,
            valor: l.valor,
            descricao: l.descricao,
            categoria: l.categoria,
            data: l.data,
            pago: l.data <= hoje,
            contaId: conta.id,
            jaNoSaldo: l.data <= diaDoMarco || undefined,
            extratoId: l.id,
          })),
        );
      });
    }
    onFechar();
  }

  return (
    <Modal titulo="📥 Importar extrato" onFechar={onFechar}>
      <div className="space-y-4">
        <div className="rounded-2xl bg-roxo/10 px-4 py-3 text-sm text-suave">
          No app ou site do banco, procure <b className="text-white">Exportar extrato</b> e escolha o formato{" "}
          <b className="text-white">OFX</b> ou <b className="text-white">CSV</b>. Depois escolha o arquivo aqui: eu mostro tudo
          antes de importar.
        </div>

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setArrastando(false);
            void escolherArquivo(e.dataTransfer.files[0]);
          }}
          className={`block cursor-pointer rounded-2xl border border-dashed px-4 py-5 text-center text-sm text-rosa hover:bg-rosa/5 ${
            arrastando ? "border-rosa bg-rosa/15" : "border-rosa/50"
          }`}
        >
          {nomeArquivo ? `📄 ${nomeArquivo} (trocar)` : "📂 Escolha ou arraste aqui o arquivo do extrato"}
          <input
            type="file"
            accept=".ofx,.csv,.txt,.qfx"
            className="sr-only"
            onChange={(e) => void escolherArquivo(e.target.files?.[0])}
          />
        </label>

        {linhas && (
          <>
            <div className="space-y-1.5">
              <span className="text-xs text-suave">
                {ehCartao ? "💳 É a fatura de qual cartão?" : "🏦 É o extrato de qual conta?"}
              </span>
              {opcoes.length === 0 ? (
                <p className="text-sm text-saida">
                  {ehCartao
                    ? "Ative o cartão de crédito de uma conta na aba Contas primeiro."
                    : "Cadastre uma conta na aba Contas primeiro."}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {opcoes.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => trocarConta(c.id)}
                      className={`rounded-2xl border px-3 py-2 text-sm transition-colors ${
                        contaId === c.id ? "border-rosa bg-rosa/15 text-white" : "border-white/10 text-suave hover:text-white"
                      }`}
                    >
                      {ehCartao ? "💳" : "🏦"} {c.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-sm">
              <span>
                <b>{marcadas.length}</b> de {linhas.length} marcadas
                {semResposta > 0 && <span className="text-amber-300"> · {semResposta} para conferir ⚖️</span>}
              </span>
              <button
                type="button"
                onClick={() => setLinhas(linhas.map((l) => (l.conflito ? l : { ...l, marcada: !todasMarcadas })))}
                className="text-rosa"
              >
                {todasMarcadas ? "Desmarcar todas" : "Marcar todas"}
              </button>
            </div>

            <ul className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
              {linhas.map((l, i) => (
                <li
                  key={l.id}
                  className={`rounded-2xl border px-3 py-2 ${l.marcada ? "border-white/15 bg-fundo/60" : "border-white/5 opacity-60"}`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      disabled={!!l.conflito}
                      checked={l.conflito ? l.escolha === "ambos" : l.marcada}
                      onChange={(e) => mudarLinha(i, { marcada: e.target.checked })}
                      aria-label={`Importar ${l.descricao}`}
                      className="mt-1 size-4 accent-[#FF4ED8]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <input
                          value={l.descricao}
                          onChange={(e) => mudarLinha(i, { descricao: e.target.value })}
                          aria-label="Título"
                          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-white/15 focus:border-rosa focus:outline-none"
                        />
                        <span
                          className={`shrink-0 text-sm font-semibold ${l.tipo === "entrada" ? "text-entrada" : "text-saida"}`}
                        >
                          {l.tipo === "entrada" ? "+" : "−"}
                          {brl(l.valor)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-suave">
                        <span>{formatarData(l.data)}</span>
                        <select
                          value={l.categoria}
                          onChange={(e) => mudarLinha(i, { categoria: e.target.value })}
                          aria-label="Categoria"
                          className="min-w-0 flex-1 rounded-lg bg-superficie px-2 py-1 text-xs text-white"
                        >
                          {categoriasDe(l.tipo, personalizadas)
                            .filter((c) => !["Guardar (metas)"].includes(c.nome))
                            .map((c) => (
                              <option key={c.nome} value={c.nome}>
                                {c.icone} {c.nome}
                              </option>
                            ))}
                        </select>
                      </div>
                      {l.aviso && <p className="mt-1 text-[0.7rem] text-amber-300">⚠️ {l.aviso}</p>}
                      {l.conflito && (
                        <div className="mt-2 space-y-2 rounded-xl border border-amber-300/40 bg-amber-300/10 p-2 text-xs">
                          <p>
                            ⚖️ Parecido com o que já está no app: <b>“{l.conflito.descricao}”</b>
                          </p>
                          <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-0.5">
                            <span />
                            <span className="text-suave">No app</span>
                            <span className="text-suave">No extrato</span>
                            {[
                              ["Data", formatarData(l.conflito.data), formatarData(l.data)],
                              ["Valor", brl(l.conflito.valor), brl(l.valor)],
                              ["Conta", nomeConta(l.conflito.contaId), conta?.nome ?? ""],
                            ].map(([rotulo, app, extrato]) => (
                              <div key={rotulo} className="contents">
                                <span className="text-suave">{rotulo}</span>
                                <span>{app}</span>
                                <span className={app !== extrato ? "font-semibold text-amber-300" : ""}>{extrato}</span>
                              </div>
                            ))}
                          </div>
                          <p className="font-medium">O que está certo?</p>
                          <div className="flex flex-wrap gap-1.5">
                            {(
                              [
                                ["app", "O do app"],
                                ["extrato", "O do extrato (corrigir)"],
                                ["ambos", "São diferentes: incluir"],
                              ] as const
                            ).map(([valor, nome]) => (
                              <button
                                key={valor}
                                type="button"
                                onClick={() => mudarLinha(i, { escolha: valor })}
                                className={`rounded-full border px-2.5 py-1 transition-colors ${
                                  l.escolha === valor
                                    ? "border-rosa bg-rosa/20 text-white"
                                    : "border-white/15 text-suave hover:text-white"
                                }`}
                              >
                                {nome}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <p className="text-xs text-suave">
              {totalSai > 0 && (
                <>
                  Saídas: <b className="text-saida">{brl(totalSai)}</b>
                </>
              )}
              {totalSai > 0 && totalEntra > 0 && " · "}
              {totalEntra > 0 && (
                <>
                  Entradas: <b className="text-entrada">{brl(totalEntra)}</b>
                </>
              )}
              {!ehCartao && " · O que aconteceu antes de você informar o saldo da conta não muda o saldo."}
            </p>
          </>
        )}

        {erro && <p className="text-sm text-saida">{erro}</p>}

        {linhas && (
          <button type="button" onClick={importar} className="botao-gradiente w-full rounded-full py-3 font-semibold">
            {semResposta > 0
              ? `Responda os ${semResposta} ⚖️ para continuar`
              : `Importar ${marcadas.length} ${ehCartao ? "compras" : "lançamentos"}${corrigir.length ? ` e corrigir ${corrigir.length}` : ""}`}
          </button>
        )}
      </div>
    </Modal>
  );
}
