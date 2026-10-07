"use client";

import { useEffect, useState } from "react";
import {
  adicionarCompras,
  adicionarGastoFixo,
  adicionarLancamentos,
  lerLancamentos,
  atualizarCompra,
  atualizarLancamento,
  categoriasDe,
  useCartoes,
  useCategoriasPersonalizadas,
  useCompras,
  useLancamentos,
} from "@/lib/store";
import { brl, formatarData, hojeISO, mesAtual, somarMeses } from "@/lib/formato";
import { previstosDoMes, type Previsto } from "@/lib/previstos";
import { useDados } from "@/lib/dados";
import { confirmarPrevisto } from "./ConfirmarPrevisto";
import { PainelFrequente, PainelLigar, previstoParecido, type Frequente, type Ligacao } from "./LigarOuFrequente";
import { cartoesDeCredito, marcoDoSaldo, saldoDaConta } from "@/lib/contas";
import { compraDoExtrato, jaExiste, lerExtrato, parcelaRepetida, type Existente, type LinhaExtrato } from "@/lib/extrato";
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
type Linha = LinhaExtrato & {
  marcada: boolean;
  aviso?: string;
  conflito?: Existente;
  escolha?: "app" | "extrato" | "ambos";
  /** Previsto que parece ser esta linha (ex.: o salário do mês): a pessoa confirma ou diz que não é */
  sugestao?: Previsto;
  recusou?: boolean;
  /** "Já está no app": ligada a um lançamento ou previsto */
  ligado?: Ligacao;
  /** Vira um gasto frequente (dívida, gasolina…) */
  frequente?: Frequente;
  painel?: "ligar" | "frequente";
};

const resolvida = (l: Linha) => !!l.ligado || !!l.frequente;

/** A linha sem o que foi calculado (para calcular de novo ao trocar de conta); fica o que a pessoa escolheu. */
function semCalculo(l: LinhaExtrato | Linha): LinhaExtrato & Pick<Linha, "ligado" | "frequente"> {
  const c: Partial<Linha> = { ...l };
  delete c.marcada;
  delete c.aviso;
  delete c.conflito;
  delete c.escolha;
  delete c.sugestao;
  delete c.recusou;
  delete c.painel;
  return c as LinhaExtrato;
}

// Importar o extrato do banco (OFX ou CSV): mostra tudo antes, a pessoa desmarca o que não quer e importa.
export default function ImportarExtrato({ onFechar, arquivoInicial }: { onFechar: () => void; arquivoInicial?: File | null }) {
  const contas = useCartoes();
  const lancamentos = useLancamentos();
  const compras = useCompras();
  const personalizadas = useCategoriasPersonalizadas();
  const dados = useDados();
  const previstos = previstosDoMes(mesAtual(), dados);
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [ehCartao, setEhCartao] = useState(false);
  const [contaId, setContaId] = useState("");
  const [erro, setErro] = useState("");
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [arrastando, setArrastando] = useState(false);
  // O que veio antes de o saldo ser informado: soma no saldo ou já estava nele? (null = o app decide)
  const [modoSaldo, setModoSaldo] = useState<"somar" | "ja" | null>(null);

  const opcoes = ehCartao ? cartoesDeCredito(contas) : contas;
  const conta = opcoes.find((c) => c.id === contaId);

  // Marca o que é novo; desmarca o que já está no app e o pagamento de fatura (esse se registra pela fatura)
  function preparar(lidas: (LinhaExtrato | Linha)[], cartao: boolean, id: string): Linha[] {
    const usados = new Set<string>(); // cada previsto é sugerido para uma linha só
    const usadosNoApp = new Set<string>(); // cada lançamento/compra do app vale para uma linha só
    // Parcelas da mesma compra no arquivo (ex.: 2/10 e 3/10 em faturas diferentes): fica uma só, a mais recente
    const repetida = parcelaRepetida(lidas);
    return lidas
      .map(semCalculo)
      .filter((l) => !cartao || l.tipo === "saida") // no cartão, pagamento e estorno não são compras
      .map((l): Linha => {
        if (repetida(l))
          return { ...l, marcada: false, aviso: "outra parcela da mesma compra (ela entra uma vez só, pela mais recente)" };
        const existente = jaExiste(l, id, lancamentos, compras, cartao, usadosNoApp);
        if (existente?.exato) return { ...l, marcada: false, aviso: `já está no app: “${existente.descricao}”` };
        if (existente) return { ...l, marcada: false, conflito: existente };
        const sugestao = cartao ? undefined : previstoParecido(l, previstos, usados);
        if (sugestao) {
          usados.add(sugestao.chave);
          return { ...l, marcada: false, sugestao };
        }
        if (l.categoria === "Fatura do cartão")
          return {
            ...l,
            marcada: false,
            aviso: "pagamento de fatura: use 🔗 Já está no app para ligar à fatura, ou marque para incluir",
          };
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

  const marcadas = linhas?.filter((l) => !resolvida(l) && (l.conflito ? l.escolha === "ambos" : l.marcada)) ?? [];
  const corrigir = linhas?.filter((l) => !resolvida(l) && l.conflito && l.escolha === "extrato") ?? [];
  const manter = linhas?.filter((l) => !resolvida(l) && l.conflito && l.escolha === "app") ?? [];
  const ligadas = linhas?.filter((l) => l.ligado) ?? [];
  const frequentes = linhas?.filter((l) => !l.ligado && l.frequente) ?? [];
  const semResposta =
    linhas?.filter((l) => !resolvida(l) && ((l.conflito && !l.escolha) || (l.sugestao && !l.recusou))).length ?? 0;
  const nomeConta = (id?: string) => contas.find((x) => x.id === id)?.nome ?? "sem conta";
  // O que outras linhas já ligaram: não aparece de novo na lista de ligar
  const ocupados = new Set(
    (linhas ?? []).flatMap((l) =>
      l.ligado
        ? [l.ligado.tipo === "previsto" ? `p-${l.ligado.previsto.chave}` : `l-${l.ligado.id}`]
        : l.sugestao && !l.recusou
          ? [`p-${l.sugestao.chave}`]
          : [],
    ),
  );
  const totalSai = [...marcadas, ...frequentes].filter((l) => l.tipo === "saida").reduce((t, l) => t + l.valor, 0);
  const totalEntra = marcadas.filter((l) => l.tipo === "entrada").reduce((t, l) => t + l.valor, 0);

  const semDuvida = linhas?.filter((l) => !l.conflito && !l.sugestao && !resolvida(l)) ?? [];
  const todasMarcadas = semDuvida.length > 0 && semDuvida.every((l) => l.marcada);

  // Conta: tem movimentação de antes do momento em que o saldo foi informado?
  const diaDoSaldo = !ehCartao && conta ? marcoDoSaldo(conta).slice(0, 10) : "";
  const antesDoSaldo = !ehCartao && conta ? [...marcadas, ...frequentes, ...ligadas].filter((l) => l.data <= diaDoSaldo) : [];
  // Sem escolha: conta zerada (ou sem saldo) → soma; com saldo → já estava nele
  const somarNoSaldo = modoSaldo ? modoSaldo === "somar" : !conta?.saldo;
  const saldoHoje = conta && !ehCartao ? saldoDaConta(conta, lancamentos) : 0;
  const efeitoNoSaldo = [...marcadas, ...frequentes, ...ligadas]
    .filter((l) => somarNoSaldo || l.data > diaDoSaldo)
    .filter((l) => !l.ligado || l.ligado.tipo === "previsto")
    .reduce((t, l) => t + (l.tipo === "entrada" ? l.valor : -l.valor), 0);

  function importar() {
    if (!conta) return setErro(ehCartao ? "Escolha o cartão." : "Escolha a conta.");
    if (semResposta > 0)
      return setErro(`Falta responder ${semResposta} ${semResposta > 1 ? "itens" : "item"} (os quadros amarelos ⚖️ e 💡).`);
    if (marcadas.length + corrigir.length + manter.length + ligadas.length + frequentes.length === 0)
      return setErro("Marque pelo menos uma movimentação.");
    const hoje = hojeISO();
    const texto = [
      marcadas.length && `${marcadas.length} importados`,
      corrigir.length && `${corrigir.length} corrigidos`,
      ligadas.length && `${ligadas.length} ligados`,
      frequentes.length && `${frequentes.length} gastos frequentes criados`,
    ]
      .filter(Boolean)
      .join(", ");
    if (ehCartao) {
      comDesfazer(`${texto || "Pronto"} ✓`, () => {
        // Corrige com os dados do extrato; o que ficou como no app só ganha a marca (para não perguntar de novo)
        corrigir.forEach((l) =>
          atualizarCompra(l.conflito!.id, { data: l.data, valorTotal: l.valor, cartaoId: conta.id, extratoId: l.id }),
        );
        manter.forEach((l) => atualizarCompra(l.conflito!.id, { extratoId: l.id }));
        adicionarCompras(marcadas.map((l) => compraDoExtrato(l, conta)));
      });
    } else {
      // O que aconteceu até o dia em que o saldo foi informado já está nele: não muda o saldo
      const diaDoMarco = somarNoSaldo ? "" : marcoDoSaldo(conta).slice(0, 10);
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
        const jaNoSaldo = (data: string) => data <= diaDoMarco || undefined;

        // Ligadas: o lançamento ganha a marca do extrato; o previsto é confirmado (pago/recebido) com os dados do extrato
        for (const l of ligadas) {
          const ligacao = l.ligado!;
          if (ligacao.tipo === "lancamento") {
            const antigo = lancamentos.find((x) => x.id === ligacao.id);
            // Sem conta (lançamento antigo): fica na conta do extrato
            atualizarLancamento(ligacao.id, { extratoId: l.id, ...(antigo?.contaId ? {} : { contaId: conta.id }) });
            continue;
          }
          const antes = new Set(lerLancamentos().map((x) => x.id));
          confirmarPrevisto(ligacao.previsto, l.valor, l.data, conta.id);
          const novos = lerLancamentos().filter((x) => !antes.has(x.id));
          const marcar = novos.length ? novos : ligacao.previsto.lancamento ? [ligacao.previsto.lancamento] : [];
          // A data é a do extrato (ex.: parcela paga dias atrás)
          marcar.forEach((x) =>
            atualizarLancamento(x.id, {
              extratoId: l.id,
              data: l.data,
              jaNoSaldo: jaNoSaldo(l.data),
              // Criado agora pela importação (dá para tirar depois); um lançamento que já existia continua dela
              importado: novos.length > 0 || undefined,
            }),
          );
        }

        // Frequentes: cria o gasto que se repete; esta linha é o primeiro pagamento dele
        const pagamentos = frequentes.map((l) => {
          const f = l.frequente!;
          const mes = l.data.slice(0, 7);
          const restantes = Number(f.restantes);
          const fixoId = adicionarGastoFixo({
            nome: f.nome,
            icone: f.icone,
            categoria: f.categoria,
            valor: l.valor,
            varia: f.varia,
            dia: Number(l.data.slice(8, 10)),
            pagamento: "debito",
            contaId: conta.id,
            desde: mes,
            criadoEm: l.data,
            ...(f.intervaloDias > 0
              ? { frequencia: "personalizada" as const, intervaloDias: f.intervaloDias, inicio: l.data }
              : {}),
            ate: restantes > 0 ? somarMeses(mes, restantes - 1) : undefined,
          });
          return {
            tipo: "saida" as const,
            valor: l.valor,
            descricao: f.nome,
            categoria: f.categoriaLancamento,
            data: l.data,
            pago: l.data <= hoje,
            contaId: conta.id,
            gastoFixoId: fixoId,
            competencia: mes,
            jaNoSaldo: jaNoSaldo(l.data),
            extratoId: l.id,
            importado: true,
          };
        });

        adicionarLancamentos([
          ...pagamentos,
          ...marcadas.map((l) => ({
            tipo: l.tipo,
            valor: l.valor,
            descricao: l.descricao,
            categoria: l.categoria,
            data: l.data,
            pago: l.data <= hoje,
            contaId: conta.id,
            jaNoSaldo: jaNoSaldo(l.data),
            extratoId: l.id,
            importado: true,
          })),
        ]);
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
          {nomeArquivo ? `📄 ${nomeArquivo} (trocar)` : "📂 Abrir o arquivo do extrato"}
          <input
            type="file"
            accept=".ofx,.csv,.txt,.qfx"
            className="sr-only"
            onChange={(e) => {
              void escolherArquivo(e.target.files?.[0]);
              e.target.value = "";
            }}
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
                {semResposta > 0 && <span className="text-amber-300"> · {semResposta} para conferir</span>}
              </span>
              <button
                type="button"
                onClick={() => setLinhas(linhas.map((l) => (semDuvida.includes(l) ? { ...l, marcada: !todasMarcadas } : l)))}
                className="text-rosa"
              >
                {todasMarcadas ? "Desmarcar todas" : "Marcar todas"}
              </button>
            </div>

            <ul className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
              {linhas.map((l, i) => (
                <li
                  key={l.id}
                  className={`rounded-2xl border px-3 py-2 ${
                    l.marcada || resolvida(l) || l.conflito || (l.sugestao && !l.recusou)
                      ? "border-white/15 bg-fundo/60"
                      : "border-white/5 opacity-60"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      disabled={!!l.conflito || resolvida(l) || (!!l.sugestao && !l.recusou)}
                      checked={resolvida(l) || (l.conflito ? l.escolha === "ambos" : l.marcada)}
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
                        <span>
                          {formatarData(l.data)}
                          {l.parcela && ` · parcela ${l.parcela.numero}/${l.parcela.total}`}
                        </span>
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
                      {l.ligado && (
                        <p className="mt-1.5 text-xs text-entrada">
                          🔗 Ligado a: <b>{l.ligado.tipo === "previsto" ? l.ligado.previsto.nome : l.ligado.descricao}</b>
                          {l.ligado.tipo === "previsto" && " (vai ficar como pago/recebido)"}{" "}
                          <button
                            type="button"
                            onClick={() => mudarLinha(i, { ligado: undefined })}
                            className="text-suave underline"
                          >
                            desfazer
                          </button>
                        </p>
                      )}
                      {l.frequente && !l.ligado && (
                        <p className="mt-1.5 text-xs text-entrada">
                          🔁 Vira gasto frequente: <b>{l.frequente.nome}</b> (
                          {l.frequente.intervaloDias ? `a cada ${l.frequente.intervaloDias} dias` : "todo mês"}
                          {l.frequente.restantes ? `, ${l.frequente.restantes} parcelas` : ""}){" "}
                          <button
                            type="button"
                            onClick={() => mudarLinha(i, { frequente: undefined })}
                            className="text-suave underline"
                          >
                            desfazer
                          </button>
                        </p>
                      )}
                      {l.sugestao && !l.recusou && !resolvida(l) && (
                        <div className="mt-2 space-y-2 rounded-xl border border-amber-300/40 bg-amber-300/10 p-2 text-xs">
                          <p>
                            💡 Parece ser{" "}
                            <b>
                              {l.sugestao.icone} {l.sugestao.nome}
                            </b>{" "}
                            (previsto para {formatarData(l.sugestao.data)}, {brl(l.sugestao.valor)}). É isso?
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => mudarLinha(i, { ligado: { tipo: "previsto", previsto: l.sugestao! } })}
                              className="rounded-full border border-white/15 px-2.5 py-1 hover:border-rosa"
                            >
                              É esse (ligar)
                            </button>
                            <button
                              type="button"
                              onClick={() => mudarLinha(i, { recusou: true, marcada: true })}
                              className="rounded-full border border-white/15 px-2.5 py-1 text-suave hover:text-white"
                            >
                              Não é: incluir como novo
                            </button>
                          </div>
                        </div>
                      )}
                      {!ehCartao && !resolvida(l) && !l.painel && (
                        <div className="mt-1.5 flex flex-wrap gap-3 text-[0.7rem]">
                          <button
                            type="button"
                            onClick={() => mudarLinha(i, { painel: "ligar" })}
                            className="text-rosa hover:underline"
                          >
                            🔗 Já está no app
                          </button>
                          {l.tipo === "saida" && (
                            <button
                              type="button"
                              onClick={() => mudarLinha(i, { painel: "frequente" })}
                              className="text-rosa hover:underline"
                            >
                              🔁 Gasto frequente
                            </button>
                          )}
                        </div>
                      )}
                      {l.painel === "ligar" && !resolvida(l) && (
                        <PainelLigar
                          linha={l}
                          previstos={previstos}
                          lancamentos={lancamentos}
                          ocupados={ocupados}
                          onLigar={(ligado) => mudarLinha(i, { ligado, painel: undefined })}
                          onFechar={() => mudarLinha(i, { painel: undefined })}
                        />
                      )}
                      {l.painel === "frequente" && !resolvida(l) && (
                        <PainelFrequente
                          linha={l}
                          onSalvar={(frequente) => mudarLinha(i, { frequente, painel: undefined })}
                          onFechar={() => mudarLinha(i, { painel: undefined })}
                        />
                      )}
                      {l.conflito && !resolvida(l) && (
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
            </p>

            {!ehCartao && conta && antesDoSaldo.length > 0 && (
              <div className="space-y-2 rounded-2xl border border-white/10 bg-fundo/60 p-3 text-xs">
                <p className="font-medium">
                  💰 {antesDoSaldo.length} movimentaç{antesDoSaldo.length > 1 ? "ões são" : "ão é"} de antes de você informar o
                  saldo de {conta.nome} ({brl(conta.saldo ?? 0)} em {formatarData(diaDoSaldo)}). Como fica o saldo?
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {(
                    [
                      ["somar", "Somar ao saldo", "Ex.: zerei a conta para montar o saldo pelo extrato"],
                      ["ja", "Já estão no saldo", "O saldo que informei já tinha essas movimentações"],
                    ] as const
                  ).map(([valor, nome, ajuda]) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => setModoSaldo(valor)}
                      className={`rounded-xl border px-3 py-2 text-left ${
                        (valor === "somar") === somarNoSaldo ? "border-rosa bg-rosa/15 text-white" : "border-white/10 text-suave"
                      }`}
                    >
                      <span className="block font-semibold">{nome}</span>
                      <span className="block text-[0.65rem] text-suave">{ajuda}</span>
                    </button>
                  ))}
                </div>
                <p>
                  Saldo de {conta.nome}: {brl(saldoHoje)} →{" "}
                  <b className={saldoHoje + efeitoNoSaldo < 0 ? "text-saida" : "text-entrada"}>
                    {brl(saldoHoje + efeitoNoSaldo)}
                  </b>{" "}
                  depois de importar
                </p>
              </div>
            )}
          </>
        )}

        {erro && <p className="text-sm text-saida">{erro}</p>}

        {linhas && (
          <button type="button" onClick={importar} className="botao-gradiente w-full rounded-full py-3 font-semibold">
            {semResposta > 0
              ? `Responda os ${semResposta} quadros amarelos para continuar`
              : `Importar ${marcadas.length + frequentes.length} ${ehCartao ? "compras" : "lançamentos"}${corrigir.length ? ` · corrigir ${corrigir.length}` : ""}${ligadas.length ? ` · ligar ${ligadas.length}` : ""}`}
          </button>
        )}
      </div>
    </Modal>
  );
}
