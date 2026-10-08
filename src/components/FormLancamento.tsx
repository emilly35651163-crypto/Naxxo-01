"use client";

import { useState } from "react";
import {
  adicionarCategoria,
  adicionarCompra,
  adicionarFonte,
  adicionarGastoFixo,
  adicionarLancamento,
  atualizarLancamento,
  atualizarTransferencia,
  categoriasDe,
  irParaMes,
  lancamentoParaCredito,
  mudarPreferencias,
  pagarGastoFixo,
  removerLancamento,
  subcategoriasDe,
  transferir,
  virarTransferencia,
  useCartoes,
  useCategoriasPersonalizadas,
  useLancamentos,
  usePreferencias,
  type CategoriaFixo,
  type Frequencia,
  type Lancamento,
  type Tipo,
} from "@/lib/store";
import {
  formatarData,
  hojeISO,
  lerValor,
  mesAtual,
  nomeMes,
  somarDias,
  somarMeses,
  valorParaCampo,
  mascaraDinheiro,
} from "@/lib/formato";
import { criarRepeticao } from "@/lib/repeticao";
import EscolhaRepeticao, { lerRepeticao, type Repeticao } from "./EscolhaRepeticao";
import { faturaDaData } from "@/lib/cartoes";
import { comDesfazer, mostrarAviso } from "@/lib/avisos";
import Modal from "./Modal";
import { Campo, Chip } from "./Campos";
import EscolhaConta, { lerEscolha } from "./EscolhaConta";
import EscolhaParcelas from "./EscolhaParcelas";
import Icone, { TextoComIcones } from "@/components/Icone";

// Para onde vai um gasto que se repete (vira gasto fixo)
const CATEGORIA_DO_FIXO: Record<string, CategoriaFixo> = {
  Moradia: "moradia",
  Contas: "contas",
  Assinaturas: "assinaturas",
  Saúde: "saude",
  Educação: "educacao",
  Transporte: "transporte",
};

// Categorias que não se escolhem à mão (vêm de outros lugares do app)
const AUTOMATICAS = ["Fatura do cartão", "Guardar (metas)"];

type Modo = Tipo | "transferencia";

/**
 * "+ Novo lançamento": simples por fora, mas manda cada coisa para o lugar certo:
 * - saída que se repete → gasto fixo (no crédito, entra na fatura todo mês)
 * - entrada que se repete → fonte de renda (aparece na aba Renda)
 * - compra no crédito → fatura do cartão (parcelada ou não)
 * - o resto → lançamento (com data no futuro, ou "ainda não paguei", fica como previsto)
 */
export default function FormLancamento({
  lancamento,
  modoInicial,
  inicial,
  onSalvo,
  onFechar,
}: {
  lancamento?: Lancamento;
  modoInicial?: Modo;
  inicial?: { descricao: string; valor: number; categoria?: string };
  onSalvo?: () => void;
  onFechar: () => void;
}) {
  const contas = useCartoes();
  const todos = useLancamentos();
  const personalizadas = useCategoriasPersonalizadas();
  const prefs = usePreferencias();
  // A última conta usada já vem marcada (se ainda existir)
  const ultima = contas.find((c) => c.id === prefs.ultimaConta) ?? contas[0];
  // Editando uma transferência: acha as duas pontas (saiu de / entrou em)
  const pontas = lancamento?.transferenciaId ? todos.filter((l) => l.transferenciaId === lancamento.transferenciaId) : [];
  const [modo, setModo] = useState<Modo>(
    lancamento?.transferenciaId ? "transferencia" : (lancamento?.tipo ?? modoInicial ?? "saida"),
  );
  const tipo: Tipo = modo === "entrada" ? "entrada" : "saida";
  const transferencia = modo === "transferencia";
  const [de, setDe] = useState(() => {
    const id = pontas.find((l) => l.tipo === "saida")?.contaId ?? ultima?.id;
    return id ? `debito:${id}` : "";
  });
  const [para, setPara] = useState(() => {
    const id = pontas.find((l) => l.tipo === "entrada")?.contaId ?? contas.find((c) => c.id !== ultima?.id)?.id;
    return id ? `debito:${id}` : "";
  });
  const [valor, setValor] = useState(
    lancamento ? valorParaCampo(lancamento.valor) : inicial ? valorParaCampo(inicial.valor) : "",
  );
  const [descricao, setDescricao] = useState(lancamento?.descricao ?? inicial?.descricao ?? "");
  const [categoria, setCategoria] = useState(
    lancamento?.categoria ?? inicial?.categoria ?? categoriasDe("saida", personalizadas)[0].nome,
  );
  const [subcategoria, setSubcategoria] = useState(lancamento?.subcategoria ?? "");
  const [novaCategoria, setNovaCategoria] = useState<null | "categoria" | "sub">(null);
  const [nomeNova, setNomeNova] = useState("");
  const [data, setData] = useState(lancamento?.data ?? hojeISO());
  const [conta, setConta] = useState(lancamento?.contaId ? `debito:${lancamento.contaId}` : ultima ? `debito:${ultima.id}` : "");
  const [parcelas, setParcelas] = useState("1");
  const [repete, setRepete] = useState<Repeticao>("nao");
  const [aCadaDias, setACadaDias] = useState("30");
  const [varia, setVaria] = useState(false);
  // Quantas vezes ao todo, contando esta (vazio = sem fim). Ex.: notebook de R$ 2.000 em Pix de R$ 200 = 10
  const [vezesTotal, setVezesTotal] = useState("");
  const [pago, setPago] = useState(lancamento?.pago ?? true);
  const [erro, setErro] = useState<{ texto: string; campo?: "valor" | "conta" | "dias" } | null>(null);

  const entrada = tipo === "entrada";
  const escolha = lerEscolha(conta);
  const noCredito = !entrada && escolha.credito;
  const cartao = noCredito ? contas.find((c) => c.id === escolha.id) : undefined;
  const numero = lerValor(valor);
  const futuro = data > hojeISO();
  const vezes = Math.max(Number(parcelas) || 1, 1);
  const categorias = categoriasDe(tipo, personalizadas).filter(
    (c) => !AUTOMATICAS.includes(c.nome) && (c.nome !== "Outros" || categoria === "Outros"),
  );
  const subcategorias = subcategoriasDe(tipo, categoria, personalizadas);
  const ehPagamento = !!lancamento && (!!lancamento.pagamentoFaturaId || !!lancamento.efeito);
  // Editando: dá para virar transferência (ex.: Pix para mim mesma) e para dizer que vai se repetir
  const podeVirarTransferencia = !!lancamento && !lancamento.transferenciaId && !ehPagamento && !lancamento.gastoFixoId;
  const podeRepetirAoEditar =
    !!lancamento &&
    !entrada &&
    !noCredito &&
    !lancamento.transferenciaId &&
    !ehPagamento &&
    !lancamento.gastoFixoId &&
    !lancamento.fonteId;
  const mostrarRepeticao = !transferencia && (!lancamento || podeRepetirAoEditar);

  function falhar(texto: string, campo?: "valor" | "conta" | "dias") {
    setErro({ texto, campo });
  }

  function trocarModo(novo: Modo) {
    setModo(novo);
    setErro(null);
    setRepete("nao");
    setSubcategoria("");
    if (novo === "transferencia") {
      if (lancamento?.contaId) {
        const outra = contas.find((c) => c.id !== lancamento.contaId)?.id;
        if (lancamento.tipo === "saida") {
          setDe(`debito:${lancamento.contaId}`);
          if (outra) setPara(`debito:${outra}`);
        } else {
          setPara(`debito:${lancamento.contaId}`);
          if (outra) setDe(`debito:${outra}`);
        }
      }
      return;
    }
    setCategoria(categoriasDe(novo, personalizadas).filter((c) => !AUTOMATICAS.includes(c.nome))[0].nome);
    if (novo === "entrada" && escolha.credito) setConta(`debito:${escolha.id}`);
  }

  /** Depois de salvar: aviso com "ver", sem mudar o mês do topo sozinho. */
  function avisarSalvo(texto: string, mesDestino: string, href = "/") {
    onSalvo?.();
    mostrarAviso({
      texto,
      link:
        mesDestino !== mesAtual()
          ? { texto: `ver ${nomeMes(mesDestino).split(" ")[0].toLowerCase()}`, href, acao: () => irParaMes(mesDestino) }
          : undefined,
    });
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!(numero > 0)) return falhar("Digite um valor maior que zero.", "valor");
    if (!data) return falhar("Escolha a data.");

    // Transferência entre contas: sai de uma e entra na outra. Não é gasto nem renda.
    if (transferencia) {
      const deId = lerEscolha(de).id;
      const paraId = lerEscolha(para).id;
      if (!deId || !paraId) return falhar("Escolha as duas contas.", "conta");
      if (deId === paraId) return falhar("Escolha contas diferentes.", "conta");
      const nomeDe = contas.find((c) => c.id === deId)?.nome;
      const nomePara = contas.find((c) => c.id === paraId)?.nome;
      const texto = descricao.trim() || `${nomeDe} → ${nomePara}`;
      if (lancamento && !lancamento.transferenciaId) {
        // Era uma saída/entrada comum: vira transferência (e acha a outra ponta, se já existir)
        virarTransferencia(lancamento.id, deId, paraId, numero, data, texto);
      } else if (lancamento?.transferenciaId) {
        atualizarTransferencia(lancamento.transferenciaId, {
          deContaId: deId,
          paraContaId: paraId,
          valor: numero,
          data,
          descricao: texto,
        });
      } else {
        transferir(deId, paraId, numero, data, texto);
      }
      avisarSalvo("🔁 Transferência salva", data.slice(0, 7));
      return onFechar();
    }

    if (contas.length > 0 && !escolha.id) return falhar(entrada ? "Em qual conta entrou?" : "De qual conta sai?", "conta");
    const nome = descricao.trim() || subcategoria || categoria;
    const contaId = escolha.id || undefined;
    if (escolha.id && !escolha.credito) mudarPreferencias({ ultimaConta: escolha.id });
    const sub = subcategoria || undefined;

    // Editando um lançamento que já existe: só os dados dele
    if (lancamento) {
      // Mudou para o crédito: sai da conta e vai para a fatura do cartão
      if (noCredito && cartao) {
        lancamentoParaCredito(lancamento.id, cartao.id, vezes, {
          valor: numero,
          descricao: nome,
          categoria,
          data,
          subcategoria: sub,
        });
        avisarSalvo(`💳 Foi para a fatura do ${cartao.nome}`, faturaDaData(data, cartao), "/contas");
        return onFechar();
      }
      let ligacao = {};
      if (podeRepetirAoEditar && repete !== "nao") {
        const repetir = lerRepeticao(repete, aCadaDias, vezesTotal, varia);
        if (!repetir) return falhar("A cada quantos dias?", "dias");
        const fixoId = criarRepeticao({ nome, categoria, valor: numero, data, contaId, repetir });
        ligacao = { gastoFixoId: fixoId, competencia: data.slice(0, 7) };
      }
      atualizarLancamento(lancamento.id, {
        tipo,
        valor: numero,
        descricao: nome,
        categoria,
        subcategoria: sub,
        data,
        pago: futuro ? false : pago,
        contaId,
        ...ligacao,
      });
      avisarSalvo(repete !== "nao" ? "🔁 Salvo: as próximas vezes ficam previstas" : "Alterações salvas ✓", data.slice(0, 7));
      return onFechar();
    }

    // Entrada que se repete → nova fonte de renda (e já registra esta, se já caiu)
    if (entrada && repete !== "nao") {
      adicionarFonte({
        nome,
        forma: varia ? "outro" : "fixo",
        valor: numero,
        valorHora: null,
        horasMes: null,
        diaRecebimento: String(Number(data.slice(8, 10))),
        frequencia: repete === "semana" ? "semanal" : repete === "quinzena" ? "quinzenal" : "mensal",
        inicio: data,
        contaId,
      });
      if (!futuro && pago)
        adicionarLancamento({
          tipo,
          valor: numero,
          descricao: nome,
          categoria,
          subcategoria: sub,
          data,
          pago: true,
          contaId,
          parteRenda: "salario",
        });
      avisarSalvo("💼 Nova fonte de renda na aba Renda", data.slice(0, 7), "/renda");
      return onFechar();
    }

    // Saída que se repete → gasto fixo (com a frequência escolhida)
    if (!entrada && repete !== "nao") {
      const intervalo = repete === "semana" ? 7 : repete === "quinzena" ? 15 : repete === "outro" ? Number(aCadaDias) : 0;
      if (repete === "outro" && !(intervalo > 0)) return falhar("A cada quantos dias?", "dias");
      const frequencia: Frequencia = repete === "mes" ? "mensal" : repete === "ano" ? "anual" : "personalizada";
      const fixo = {
        nome,
        icone: categorias.find((c) => c.nome === categoria)?.icone ?? "📌",
        categoria: CATEGORIA_DO_FIXO[categoria] ?? ("outros" as const),
        valor: numero,
        varia,
        dia: Number(data.slice(8, 10)),
        pagamento: noCredito ? ("cartao" as const) : ("debito" as const),
        cartaoId: noCredito ? escolha.id : undefined,
        contaId: noCredito ? undefined : contaId,
        desde: data.slice(0, 7) < mesAtual() ? mesAtual() : data.slice(0, 7),
        frequencia,
        mesReferencia: frequencia === "anual" ? data.slice(0, 7) : undefined,
        intervaloDias: frequencia === "personalizada" ? intervalo : undefined,
        inicio: frequencia === "personalizada" ? data : undefined,
        // "Quantas vezes ao todo": o último mês em que cobra
        ate:
          Number(vezesTotal) > 0
            ? frequencia === "mensal"
              ? somarMeses(data.slice(0, 7), Number(vezesTotal) - 1)
              : frequencia === "anual"
                ? somarMeses(data.slice(0, 7), 12 * (Number(vezesTotal) - 1))
                : somarDias(data, (Number(vezesTotal) - 1) * intervalo).slice(0, 7)
            : undefined,
      };
      const id = adicionarGastoFixo(fixo);
      // Hoje (ou antes) e já pago: esta vez já fica registrada como paga
      if (!noCredito && !futuro && pago) pagarGastoFixo({ ...fixo, id, criadoEm: hojeISO() }, numero, data, contaId);
      avisarSalvo(noCredito ? "📌 Gasto fixo no cartão criado" : "📌 Gasto fixo criado", data.slice(0, 7), "/fixos");
      return onFechar();
    }

    // No crédito → vai para a fatura do cartão (à vista ou parcelado)
    if (noCredito && cartao) {
      adicionarCompra({
        cartaoId: cartao.id,
        descricao: nome,
        categoria,
        subcategoria: sub,
        valorTotal: numero,
        parcelas: vezes,
        parcelasPagas: 0,
        data,
      });
      avisarSalvo(
        `💳 Na fatura de ${nomeMes(faturaDaData(data, cartao)).split(" ")[0].toLowerCase()} do ${cartao.nome}`,
        faturaDaData(data, cartao),
        "/contas",
      );
      return onFechar();
    }

    // Lançamento comum. Com data no futuro (ou "ainda não paguei"), fica previsto até marcar "pago"/"recebido".
    adicionarLancamento({
      tipo,
      valor: numero,
      descricao: nome,
      categoria,
      subcategoria: sub,
      data,
      pago: futuro ? false : pago,
      contaId,
    });
    avisarSalvo(futuro || !pago ? `📌 Previsto para ${formatarData(data)}` : "Salvo ✓", data.slice(0, 7));
    onFechar();
  }

  function criarCategoria() {
    const texto = nomeNova.trim();
    if (!texto) return setNovaCategoria(null);
    if (novaCategoria === "sub") {
      adicionarCategoria({
        tipo,
        nome: texto,
        icone: categorias.find((c) => c.nome === categoria)?.icone ?? "•",
        pai: categoria,
      });
      setSubcategoria(texto);
    } else {
      adicionarCategoria({ tipo, nome: texto, icone: "🏷️" });
      setCategoria(texto);
      setSubcategoria("");
    }
    setNomeNova("");
    setNovaCategoria(null);
  }

  // Para onde isso vai, em português (aparece embaixo, antes de salvar)
  const destino = transferencia
    ? "🔁 O dinheiro sai de uma conta e entra na outra. Não conta como gasto nem como renda — só muda os saldos."
    : lancamento
      ? noCredito && cartao
        ? `💳 Vai sair da conta e entrar na fatura do ${cartao.nome}${vezes > 1 ? ` em ${vezes}x` : ""}.`
        : ehPagamento
          ? "🔗 Este lançamento está ligado a uma meta ou fatura: mudar o valor ou excluir ajusta lá também."
          : null
      : entrada && repete !== "nao"
        ? "💼 Vira uma fonte de renda na aba Renda, prevista toda vez."
        : !entrada && repete !== "nao"
          ? noCredito
            ? "📌 Vira um gasto fixo no cartão: entra na fatura sozinho."
            : `📌 Vira um gasto fixo: aparece previsto no Início toda vez.${!futuro && pago ? " Esta vez já fica como paga." : ""}`
          : noCredito && cartao
            ? `💳 Vai para a fatura do ${cartao.nome}${vezes > 1 ? ` em ${vezes}x` : ""} (fatura de ${nomeMes(faturaDaData(data, cartao)).toLowerCase()}).`
            : futuro || !pago
              ? `🗓️ Fica previsto para ${formatarData(data)}. No dia, toque em “${entrada ? "Recebi" : "Pago"}”.`
              : null;

  return (
    <Modal
      titulo={lancamento ? (transferencia ? "Editar transferência" : "Editar lançamento") : "Novo lançamento"}
      onFechar={onFechar}
    >
      <form onSubmit={salvar} className="space-y-5">
        <div className="grid grid-cols-3 gap-1 rounded-full bg-fundo p-1" role="radiogroup" aria-label="Tipo">
          {(["saida", "entrada", "transferencia"] as const)
            .filter((m) =>
              !lancamento || lancamento.transferenciaId
                ? m === "transferencia" || !lancamento
                : m !== "transferencia" || podeVirarTransferencia,
            )
            .map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={modo === m}
                onClick={() => trocarModo(m)}
                className={`rounded-full py-2 text-sm font-medium transition-colors ${
                  modo === m
                    ? m === "entrada"
                      ? "bg-entrada text-fundo"
                      : m === "saida"
                        ? "bg-saida text-fundo"
                        : "bg-azul text-fundo"
                    : "text-suave"
                }`}
              >
                <TextoComIcones texto={m === "entrada" ? "Entrada" : m === "saida" ? "Saída" : "🔁 Transferir"} />
              </button>
            ))}
        </div>

        <label className={`block rounded-2xl text-center ${erro?.campo === "valor" ? "ring-2 ring-saida/60" : ""}`}>
          <span className="sr-only">Valor</span>
          <span className="font-display text-4xl font-bold text-suave">R$ </span>
          <input
            autoFocus
            inputMode="decimal"
            placeholder="0,00"
            value={valor}
            aria-invalid={erro?.campo === "valor"}
            onChange={(e) => {
              setValor(mascaraDinheiro(e.target.value));
              setErro(null);
            }}
            className="w-48 bg-transparent font-display text-4xl font-bold outline-none placeholder:text-white/40"
          />
        </label>

        {!transferencia && (
          <Campo rotulo="O que é?">
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder={entrada ? "Ex.: salário, freela, venda" : "Ex.: farmácia, presente, conta de luz"}
              className="campo"
            />
          </Campo>
        )}

        {!transferencia && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {categorias.map((c) => (
                <Chip
                  key={c.nome}
                  ativo={categoria === c.nome}
                  onClick={() => {
                    setCategoria(c.nome);
                    setSubcategoria("");
                  }}
                >
                  <Icone e={c.icone} /> <TextoComIcones texto={c.nome} />
                </Chip>
              ))}
              <Chip
                ativo={novaCategoria === "categoria"}
                onClick={() => setNovaCategoria(novaCategoria === "categoria" ? null : "categoria")}
              >
                ＋ Criar categoria
              </Chip>
            </div>
            {(subcategorias.length > 0 || novaCategoria === "sub") && (
              <div className="flex flex-wrap gap-2 border-l-2 border-roxo/30 pl-3">
                {subcategorias.map((s) => (
                  <Chip
                    key={s.id}
                    ativo={subcategoria === s.nome}
                    onClick={() => setSubcategoria(subcategoria === s.nome ? "" : s.nome)}
                  >
                    <TextoComIcones texto={s.nome} />
                  </Chip>
                ))}
              </div>
            )}
            {novaCategoria === null && (
              <button type="button" onClick={() => setNovaCategoria("sub")} className="text-xs text-suave hover:text-rosa">
                + subcategoria de <TextoComIcones texto={categoria} />
              </button>
            )}
            {novaCategoria && (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={nomeNova}
                  onChange={(e) => setNomeNova(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      criarCategoria();
                    }
                  }}
                  placeholder={novaCategoria === "sub" ? `Ex.: dentro de ${categoria}` : "Ex.: Pet, Beleza, Filhos"}
                  className="campo py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={criarCategoria}
                  className="shrink-0 rounded-full border border-rosa/50 px-4 text-sm text-rosa"
                >
                  Criar
                </button>
              </div>
            )}
          </div>
        )}

        <Campo rotulo="Quando?">
          <input
            type="date"
            value={data}
            onChange={(e) => {
              setData(e.target.value);
              if (e.target.value > hojeISO()) setPago(false);
              else if (!lancamento) setPago(true);
            }}
            className="campo"
          />
        </Campo>

        <div className={erro?.campo === "conta" ? "rounded-2xl ring-2 ring-saida/60 ring-offset-4 ring-offset-superficie" : ""}>
          {transferencia ? (
            <div className="space-y-4">
              <EscolhaConta valor={de} onChange={setDe} rotulo="Sai de qual conta?" />
              <EscolhaConta valor={para} onChange={setPara} rotulo="Vai para qual conta?" />
              <Campo rotulo="Observação (opcional)">
                <input
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex.: parte do salário"
                  className="campo"
                />
              </Campo>
            </div>
          ) : (
            <EscolhaConta
              valor={conta}
              onChange={(v) => {
                setConta(v);
                setErro(null);
              }}
              modo={entrada ? "debito" : "ambos"}
              rotulo={entrada ? "Entrou em qual conta?" : "De onde sai?"}
            />
          )}
        </div>

        {noCredito && repete === "nao" && <EscolhaParcelas valor={parcelas} onChange={setParcelas} valorTotal={numero} />}

        {mostrarRepeticao && (
          <EscolhaRepeticao
            titulo={entrada ? "Vai entrar de novo?" : lancamento ? "Vai se repetir nos próximos meses?" : "Vai se repetir?"}
            repete={repete}
            onRepete={setRepete}
            aCadaDias={aCadaDias}
            onACadaDias={setACadaDias}
            vezesTotal={vezesTotal}
            onVezesTotal={setVezesTotal}
            varia={varia}
            onVaria={setVaria}
            valor={numero}
            entrada={entrada}
            erroDias={erro?.campo === "dias"}
          />
        )}

        {/* Hoje ou antes: já foi pago/recebido ou ainda não? (um boleto que vence hoje ainda está "a pagar") */}
        {!futuro && !transferencia && !noCredito && !ehPagamento && (
          <div className="grid grid-cols-2 gap-1 rounded-full bg-fundo p-1 text-sm" role="radiogroup" aria-label="Situação">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                type="button"
                role="radio"
                aria-checked={pago === v}
                onClick={() => setPago(v)}
                className={`rounded-full py-2 transition-colors ${pago === v ? "bg-white font-semibold text-fundo" : "text-suave"}`}
              >
                <TextoComIcones
                  texto={v ? (entrada ? "✓ Já recebi" : "✓ Já paguei") : entrada ? "Ainda vou receber" : "Ainda vou pagar"}
                />
              </button>
            ))}
          </div>
        )}

        {destino && (
          <p className="rounded-2xl bg-roxo/10 px-4 py-3 text-xs text-suave">
            <TextoComIcones texto={destino} />
          </p>
        )}
        {erro && (
          <p role="alert" className="text-sm text-saida">
            <TextoComIcones texto={erro.texto} />
          </p>
        )}

        <button type="submit" className="botao-gradiente w-full rounded-full py-3 font-semibold">
          <TextoComIcones texto={lancamento ? "Salvar alterações" : "Salvar"} />
        </button>

        {lancamento && (
          <button
            type="button"
            onClick={() => {
              comDesfazer(`“${lancamento.descricao}” excluído`, () => removerLancamento(lancamento.id));
              onFechar();
            }}
            className="w-full py-1 text-sm text-suave hover:text-saida"
          >
            <TextoComIcones texto={transferencia ? "Excluir transferência (as duas pontas)" : "Excluir lançamento"} />
          </button>
        )}
      </form>
    </Modal>
  );
}
