"use client";

import { aplicarRegras, aprender } from "@/lib/regras";
import { linhasDoPdf, PdfComSenha } from "@/lib/pdf";
import { lerComIA, type FaturaIA } from "@/lib/lerComIA";
import { ehImagem, lerTextoDosPrints } from "@/lib/ocr";
import { comprasDoTextoDoPrint } from "@/lib/print";
import { reconhecerTransferencias } from "@/lib/certeiros";
import { ligarAosPadroes } from "@/lib/acompanhar";
import { useEffect, useState } from "react";
import {
  adicionarCompras,
  agoraLocal,
  atualizarCartao,
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
import {
  ARQUIVOS_DE_EXTRATO,
  compraDoExtrato,
  extratoDeCompras,
  extratoDoPdf,
  jaExiste,
  lerExtrato,
  parcelaRepetida,
  type Existente,
  type LinhaExtrato,
} from "@/lib/extrato";
import { comDesfazer, mostrarAviso } from "@/lib/avisos";
import Modal from "./Modal";
import Icone, { TextoComIcones } from "@/components/Icone";

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
  /** Lançado à mão e igual a esta linha: o banco confirma (ganha a marca do extrato) */
  confirma?: string;
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
  delete c.confirma;
  return c as LinhaExtrato;
}

// Importar o extrato do banco (OFX, CSV ou PDF): mostra tudo antes, a pessoa desmarca o que não quer e importa.
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
  // O saldo que veio no próprio arquivo (OFX sempre traz; alguns CSV, no "saldo do dia"): ele manda, não é digitado
  const [saldoArquivo, setSaldoArquivo] = useState<{ valor: number; data: string } | null>(null);
  // Quantos meses o arquivo cobre (o ideal são 6 ou mais, para o app achar os padrões)
  const [mesesNoArquivo, setMesesNoArquivo] = useState(0);
  // PDF com senha (muitos bancos usam parte do CPF): guarda o arquivo até a pessoa digitar
  const [pdfComSenha, setPdfComSenha] = useState<File | null>(null);
  const [senhaPdf, setSenhaPdf] = useState("");
  const [lendoPdf, setLendoPdf] = useState(false);
  const [lendoTexto, setLendoTexto] = useState("");

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
        // Lançado à mão (sem marca do extrato)? O banco confirma; se algo difere, o banco manda (valor, data), o nome fica
        const amao = existente && !(cartao ? compras : lancamentos).find((x) => x.id === existente.id)?.extratoId;
        if (existente?.exato)
          return {
            ...l,
            marcada: false,
            aviso: `já está no app: “${existente.descricao}”${amao ? " (confirmado pelo banco)" : ""}`,
            ...(amao ? { confirma: existente.id } : {}),
          };
        if (existente) return { ...l, marcada: false, conflito: existente, ...(amao ? { escolha: "extrato" as const } : {}) };
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

  async function escolherArquivo(arquivo: File | undefined, senha?: string) {
    if (!arquivo) return;
    setErro("");
    setNomeArquivo(arquivo.name);
    setPdfComSenha(null);
    let extrato;
    const cabeca = new TextDecoder().decode(new Uint8Array(await arquivo.slice(0, 5).arrayBuffer()));
    if (cabeca.startsWith("%PDF") || /\.pdf$/i.test(arquivo.name)) {
      // PDF: o texto é tirado aqui mesmo, no aparelho
      setLendoPdf(true);
      try {
        extrato = aplicarRegras(extratoDoPdf(await linhasDoPdf(arquivo, senha)));
      } catch (e) {
        setLinhas(null);
        if (e instanceof PdfComSenha) {
          setPdfComSenha(arquivo);
          return setErro(senha ? "Senha errada. Tente de novo." : "");
        }
        return setErro("Não consegui abrir esse PDF. Tente baixar de novo (ou em OFX/CSV, se o banco tiver).");
      } finally {
        setLendoPdf(false);
      }
    } else if (ehImagem(arquivo)) {
      // Print da fatura do cartão: a IA lê (logado e com a chave); senão, o leitor do celular
      setLendoPdf(true);
      try {
        const ia = await lerComIA<FaturaIA>("fatura", [arquivo], setLendoTexto);
        const compras = ia
          ? ia.itens.map((c) => ({
              descricao: c.descricao,
              valor: c.valor,
              data: c.data,
              parcela: c.parcelaNumero && c.parcelaTotal ? { numero: c.parcelaNumero, total: c.parcelaTotal } : undefined,
            }))
          : (await lerTextoDosPrints([arquivo], setLendoTexto)).flatMap((texto) => comprasDoTextoDoPrint(texto));
        extrato = aplicarRegras(extratoDeCompras(compras));
      } catch (e) {
        setLinhas(null);
        return setErro(e instanceof Error ? e.message : "Não consegui ler o print. Tente de novo.");
      } finally {
        setLendoPdf(false);
        setLendoTexto("");
      }
    } else extrato = aplicarRegras(lerExtrato(await lerArquivo(arquivo)));
    if (extrato.linhas.length === 0) {
      setLinhas(null);
      return setErro(
        "Não encontrei movimentações nesse arquivo. Ele precisa ser o extrato do banco em OFX, CSV ou PDF (PDF escaneado, como foto, não dá para ler).",
      );
    }
    const lista = extrato.ehCartao ? cartoesDeCredito(contas) : contas;
    const id = lista.some((c) => c.id === contaId) ? contaId : (lista[0]?.id ?? "");
    setEhCartao(extrato.ehCartao);
    setContaId(id);
    const datas = extrato.linhas.map((l) => l.data).sort();
    const [primeira, ultima] = [datas[0], datas[datas.length - 1]];
    setSaldoArquivo(!extrato.ehCartao && extrato.saldo !== undefined ? { valor: extrato.saldo, data: ultima } : null);
    setMesesNoArquivo(
      Math.max(
        1,
        Math.round((new Date(`${ultima}T12:00:00`).getTime() - new Date(`${primeira}T12:00:00`).getTime()) / (30.4 * 864e5)),
      ),
    );
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
  const somarNoSaldo = saldoArquivo ? false : modoSaldo ? modoSaldo === "somar" : !conta?.saldo;
  const saldoHoje = conta && !ehCartao ? saldoDaConta(conta, lancamentos) : 0;
  const efeitoNoSaldo = [...marcadas, ...frequentes, ...ligadas]
    .filter((l) => somarNoSaldo || l.data > diaDoSaldo)
    .filter((l) => !l.ligado || l.ligado.tipo === "previsto")
    .reduce((t, l) => t + (l.tipo === "entrada" ? l.valor : -l.valor), 0);

  // Lançado à mão e igual a uma linha do extrato: o banco confirma (e a pessoa não precisa fazer nada)
  const confirmados = linhas?.filter((l) => l.confirma) ?? [];

  /**
   * O que a pessoa lançou à mão e o banco confirmou: o nome e a categoria dela viram regra
   * (da próxima vez que vier igual no extrato, já chega assim).
   */
  function aprenderDoQueEraAMao() {
    for (const l of [...confirmados, ...corrigir, ...manter]) {
      const id = l.confirma ?? l.conflito?.id;
      const meu = (ehCartao ? compras : lancamentos).find((x) => x.id === id);
      if (!meu || meu.extratoId || !l.original) continue;
      if (meu.descricao.trim().toLowerCase() === l.descricao.trim().toLowerCase() && meu.categoria === l.categoria) continue;
      aprender(
        {
          descricaoBanco: l.original,
          tipo: l.tipo,
          nome: meu.descricao,
          categoria: meu.categoria,
          subcategoria: meu.subcategoria,
        },
        "proximos",
      );
    }
  }

  function importar() {
    if (!conta) return setErro(ehCartao ? "Escolha o cartão." : "Escolha a conta.");
    if (semResposta > 0)
      return setErro(`Falta responder ${semResposta} ${semResposta > 1 ? "itens" : "item"} (os quadros amarelos ⚖️ e 💡).`);
    if (marcadas.length + corrigir.length + manter.length + ligadas.length + frequentes.length + confirmados.length === 0)
      return setErro("Marque pelo menos uma movimentação.");
    const hoje = hojeISO();
    const texto = [
      marcadas.length && `${marcadas.length} importados`,
      corrigir.length && `${corrigir.length} corrigidos`,
      ligadas.length && `${ligadas.length} ligados`,
      confirmados.length && `${confirmados.length} confirmados pelo banco`,
      frequentes.length && `${frequentes.length} gastos frequentes criados`,
    ]
      .filter(Boolean)
      .join(", ");
    if (ehCartao) {
      comDesfazer(`${texto || "Pronto"} ✓`, () => {
        // Corrige com os dados do extrato; o que ficou como no app só ganha a marca (para não perguntar de novo)
        corrigir.forEach((l) =>
          atualizarCompra(l.conflito!.id, {
            data: l.data,
            valorTotal: l.valor,
            cartaoId: conta.id,
            extratoId: l.id,
            descricaoBanco: l.original,
          }),
        );
        manter.forEach((l) => atualizarCompra(l.conflito!.id, { extratoId: l.id, descricaoBanco: l.original }));
        confirmados.forEach((l) => atualizarCompra(l.confirma!, { extratoId: l.id, descricaoBanco: l.original }));
        aprenderDoQueEraAMao();
        adicionarCompras(marcadas.map((l) => compraDoExtrato(l, conta)));
      });
    } else {
      // O que aconteceu até o dia em que o saldo foi informado já está nele: não muda o saldo
      const diaDoMarco = saldoArquivo ? saldoArquivo.data : somarNoSaldo ? "" : marcoDoSaldo(conta).slice(0, 10);
      comDesfazer(`${texto || "Pronto"} ✓`, () => {
        // O saldo vem do arquivo: vale no fim do último dia do extrato (se é hoje, a partir de agora)
        if (saldoArquivo)
          atualizarCartao(conta.id, {
            saldo: saldoArquivo.valor,
            saldoAtualizadoEm: saldoArquivo.data >= hoje ? agoraLocal() : `${saldoArquivo.data}T23:59:59`,
          });
        corrigir.forEach((l) =>
          atualizarLancamento(l.conflito!.id, {
            data: l.data,
            valor: l.valor,
            contaId: conta.id,
            pago: l.data <= hoje,
            extratoId: l.id,
            descricaoBanco: l.original,
          }),
        );
        manter.forEach((l) => atualizarLancamento(l.conflito!.id, { extratoId: l.id, descricaoBanco: l.original }));
        confirmados.forEach((l) => atualizarLancamento(l.confirma!, { extratoId: l.id, descricaoBanco: l.original }));
        aprenderDoQueEraAMao();
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
            subcategoria: l.subcategoria,
            descricaoBanco: l.original,
            revisar: l.revisar || undefined,
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
    // Dinheiro passando entre as minhas contas não é gasto nem ganho
    const transferencias = reconhecerTransferencias();
    ligarAosPadroes(); // o que é de um fixo/renda acompanhado se liga a ele (e os valores que mudam se atualizam)
    if (transferencias)
      mostrarAviso({
        texto: `🔁 ${transferencias} transferência${transferencias > 1 ? "s" : ""} entre suas contas (fora dos gastos)`,
      });
    onFechar();
  }

  return (
    <Modal titulo="📥 Importar extrato" onFechar={onFechar}>
      <div className="space-y-4">
        <div className="rounded-2xl bg-roxo/10 px-4 py-3 text-sm text-suave">
          No app ou site do banco, procure <b className="text-white">Exportar extrato</b> e escolha o formato{" "}
          <b className="text-white">OFX</b>, <b className="text-white">CSV</b> ou <b className="text-white">PDF</b>. Depois
          escolha o arquivo aqui: eu mostro tudo antes de importar. O ideal são 6 meses ou mais.
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
          <TextoComIcones texto={nomeArquivo ? `📄 ${nomeArquivo} (trocar)` : "📂 Abrir o extrato (arquivo, PDF ou print da fatura)"} />
          <input
            type="file"
            accept={`${ARQUIVOS_DE_EXTRATO},image/*`}
            className="sr-only"
            onChange={(e) => {
              void escolherArquivo(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>

        {lendoPdf && (
          <p className="text-sm text-suave">
            <Icone e="⏳" /> {lendoTexto || "Lendo o arquivo…"}
          </p>
        )}

        {pdfComSenha && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (senhaPdf) void escolherArquivo(pdfComSenha, senhaPdf);
            }}
            className="space-y-2 rounded-2xl border border-amber-300/40 bg-amber-300/5 p-3 text-sm"
          >
            <p>
              <Icone e="🔐" /> Esse PDF tem senha. Muitos bancos usam os primeiros números do CPF ou a data de nascimento (o banco
              diz qual no e-mail ou no app). A senha fica só aqui, no seu aparelho.
            </p>
            <div className="flex gap-2">
              <input
                autoFocus
                type="password"
                value={senhaPdf}
                onChange={(e) => setSenhaPdf(e.target.value)}
                placeholder="Senha do PDF"
                aria-label="Senha do PDF"
                className="campo min-w-0 flex-1"
              />
              <button type="submit" className="botao-gradiente rounded-full px-4 text-sm font-semibold">
                Abrir
              </button>
            </div>
          </form>
        )}

        {linhas && (
          <>
            <div className="space-y-1.5">
              <span className="text-xs text-suave">
                <TextoComIcones texto={ehCartao ? "💳 É a fatura de qual cartão?" : "🏦 É o extrato de qual conta?"} />
              </span>
              {opcoes.length === 0 ? (
                <p className="text-sm text-saida">
                  <TextoComIcones
                    texto={
                      ehCartao
                        ? "Ative o cartão de crédito de uma conta na aba Contas primeiro."
                        : "Cadastre uma conta na aba Contas primeiro."
                    }
                  />
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
                      <TextoComIcones texto={ehCartao ? "💳" : "🏦"} /> <TextoComIcones texto={c.nome} />
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
                <TextoComIcones texto={todasMarcadas ? "Desmarcar todas" : "Marcar todas"} />
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
                          <TextoComIcones texto={l.tipo === "entrada" ? "+" : "−"} />
                          {brl(l.valor)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-suave">
                        <span>
                          {formatarData(l.data)}
                          <TextoComIcones texto={l.parcela && ` · parcela ${l.parcela.numero}/${l.parcela.total}`} />
                        </span>
                        <select
                          value={l.categoria}
                          onChange={(e) => mudarLinha(i, { categoria: e.target.value, subcategoria: undefined, revisar: false })}
                          aria-label="Categoria"
                          className="min-w-0 flex-1 rounded-lg bg-superficie px-2 py-1 text-xs text-white"
                        >
                          {categoriasDe(l.tipo, personalizadas)
                            .filter((c) => !["Guardar (metas)"].includes(c.nome))
                            .map((c) => (
                              <option key={c.nome} value={c.nome}>
                                {c.nome}
                              </option>
                            ))}
                        </select>
                      </div>
                      {l.aviso && (
                        <p className="mt-1 text-[0.7rem] text-amber-300">
                          <Icone e="⚠️" /> <TextoComIcones texto={l.aviso} />
                        </p>
                      )}
                      {l.ligado && (
                        <p className="mt-1.5 text-xs text-entrada">
                          <Icone e="🔗" /> Ligado a:{" "}
                          <b>
                            <TextoComIcones texto={l.ligado.tipo === "previsto" ? l.ligado.previsto.nome : l.ligado.descricao} />
                          </b>
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
                          <Icone e="🔁" /> Vira gasto frequente:{" "}
                          <b>
                            <TextoComIcones texto={l.frequente.nome} />
                          </b>{" "}
                          (
                          <TextoComIcones
                            texto={l.frequente.intervaloDias ? `a cada ${l.frequente.intervaloDias} dias` : "todo mês"}
                          />
                          <TextoComIcones texto={l.frequente.restantes ? `, ${l.frequente.restantes} parcelas` : ""} />){" "}
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
                            <Icone e="💡" /> Parece ser{" "}
                            <b>
                              <Icone e={l.sugestao.icone} /> <TextoComIcones texto={l.sugestao.nome} />
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
                            <Icone e="🔗" /> Já está no app
                          </button>
                          {l.tipo === "saida" && (
                            <button
                              type="button"
                              onClick={() => mudarLinha(i, { painel: "frequente" })}
                              className="text-rosa hover:underline"
                            >
                              <Icone e="🔁" /> Gasto frequente
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
                            <Icone e="⚖️" /> Parecido com o que já está no app:{" "}
                            <b>
                              “<TextoComIcones texto={l.conflito.descricao} />”
                            </b>
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
                                <span className="text-suave">
                                  <TextoComIcones texto={rotulo} />
                                </span>
                                <span>
                                  <TextoComIcones texto={app} />
                                </span>
                                <span className={app !== extrato ? "font-semibold text-amber-300" : ""}>
                                  <TextoComIcones texto={extrato} />
                                </span>
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
                                <TextoComIcones texto={nome} />
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

            {mesesNoArquivo > 0 && mesesNoArquivo < 6 && (
              <p className="rounded-2xl border border-amber-300/30 bg-amber-300/5 p-3 text-xs">
                <Icone e="📅" /> Este extrato tem só {mesesNoArquivo} {mesesNoArquivo === 1 ? "mês" : "meses"}. Para o NAXXO achar
                seus padrões (salário, contas fixas, assinaturas, gasolina), baixe pelo menos <b>6 meses</b>. Dá para continuar
                assim: os padrões ficam “em aprendizado”.
              </p>
            )}

            {!ehCartao && conta && saldoArquivo && (
              <p className="rounded-2xl border border-white/10 bg-fundo/60 p-3 text-xs">
                <Icone e="💰" /> O saldo vem do arquivo: <b>{brl(saldoArquivo.valor)}</b> em {formatarData(saldoArquivo.data)}.
                Depois de importar, o saldo de <TextoComIcones texto={conta.nome} /> fica certinho como no banco.
              </p>
            )}

            {!ehCartao && conta && !saldoArquivo && antesDoSaldo.length > 0 && (
              <div className="space-y-2 rounded-2xl border border-white/10 bg-fundo/60 p-3 text-xs">
                <p className="font-medium">
                  <Icone e="💰" /> {antesDoSaldo.length} movimentaç{antesDoSaldo.length > 1 ? "ões são" : "ão é"} de antes de você
                  informar o saldo de <TextoComIcones texto={conta.nome} /> ({brl(conta.saldo ?? 0)} em {formatarData(diaDoSaldo)}
                  ). Como fica o saldo?
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
                      <span className="block font-semibold">
                        <TextoComIcones texto={nome} />
                      </span>
                      <span className="block text-[0.65rem] text-suave">
                        <TextoComIcones texto={ajuda} />
                      </span>
                    </button>
                  ))}
                </div>
                <p>
                  Saldo de <TextoComIcones texto={conta.nome} />: {brl(saldoHoje)} →{" "}
                  <b className={saldoHoje + efeitoNoSaldo < 0 ? "text-saida" : "text-entrada"}>
                    {brl(saldoHoje + efeitoNoSaldo)}
                  </b>{" "}
                  depois de importar
                </p>
              </div>
            )}
          </>
        )}

        {erro && (
          <p className="text-sm text-saida">
            <TextoComIcones texto={erro} />
          </p>
        )}

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
