"use client";

import { useState } from "react";
import {
  adicionarCategoria,
  adicionarCompra,
  atualizarCompra,
  CATEGORIAS,
  categoriasDe,
  compraParaDebito,
  adicionarLancamento,
  removerCompra,
  useCartoes,
  useCategoriasPersonalizadas,
  useCompras,
  useMetas,
  type Cartao,
  type CompraCartao,
  type Meta,
} from "@/lib/store";
import { hojeISO, lerValor, valorParaCampo } from "@/lib/formato";
import { dataPelasParcelasPagas } from "@/lib/cartoes";
import Modal from "./Modal";
import { Campo, CampoValor, Chip } from "./Campos";
import CamposCredito, { lerRascunhoCredito, type RascunhoCredito } from "./CamposCredito";
import EscolhaConta, { lerEscolha } from "./EscolhaConta";
import CamposAssinatura, { assinaturaVazia, salvarAssinatura, type RascunhoAssinatura } from "./CamposAssinatura";
import { comDesfazer, mostrarAviso } from "@/lib/avisos";
import { criarRepeticao } from "@/lib/repeticao";
import EscolhaRepeticao, { lerRepeticao, type Repeticao } from "./EscolhaRepeticao";
import Icone, { TextoComIcones } from "@/components/Icone";

// "Fatura do cartão" não faz sentido como categoria de uma compra
export const CATEGORIAS_COMPRA = CATEGORIAS.saida.filter((c) => c.nome !== "Fatura do cartão");

/** Data da compra, com aviso quando foi calculada pelas parcelas pagas. */
export function CampoDataCompra({
  data,
  automatica,
  onChange,
}: {
  data: string;
  automatica: boolean;
  onChange: (data: string) => void;
}) {
  return (
    <Campo rotulo="Data da compra">
      <input type="date" value={data} onChange={(e) => onChange(e.target.value)} className="campo" />
      {automatica && (
        <span className="block text-xs text-suave"> Calculada pelas parcelas pagas. Pode ajustar se não for essa.</span>
      )}
    </Campo>
  );
}

export type TipoNoCartao = "compra" | "assinatura";

/** A primeira pergunta: é uma compra (tem parcelas e acaba) ou uma assinatura (repete todo mês)? */
export function EscolhaCompraOuAssinatura({ valor, onChange }: { valor: TipoNoCartao; onChange: (tipo: TipoNoCartao) => void }) {
  const opcoes = [
    { id: "compra", nome: "🛍️ Compra", descricao: "À vista ou parcelada" },
    { id: "assinatura", nome: "🔁 Assinatura", descricao: "Cobra todo mês, sem fim" },
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-2">
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`rounded-2xl border px-3 py-2.5 text-left transition-colors ${
            valor === o.id ? "border-rosa bg-rosa/15" : "border-white/10 hover:border-roxo/50"
          }`}
        >
          <span className="block text-sm font-semibold">
            <TextoComIcones texto={o.nome} />
          </span>
          <span className="block text-xs text-suave">
            <TextoComIcones texto={o.descricao} />
          </span>
        </button>
      ))}
    </div>
  );
}

// Incluir no cartão: uma compra (nova, ou trazida de uma meta de quitar) ou uma assinatura.
// Com `compra`, edita uma compra que já existe.
export default function FormCompra({
  cartoes,
  cartaoInicial,
  tipoInicial = "compra",
  compra,
  onFechar,
}: {
  cartoes: Cartao[];
  cartaoInicial?: Cartao;
  tipoInicial?: TipoNoCartao;
  compra?: CompraCartao;
  onFechar: () => void;
}) {
  const [tipo, setTipo] = useState<TipoNoCartao>(tipoInicial);
  const [assinatura, setAssinatura] = useState<RascunhoAssinatura>(assinaturaVazia(cartaoInicial?.id ?? cartoes[0]?.id ?? ""));
  const metas = useMetas();
  const compras = useCompras();
  // Metas de quitar que ainda não estão em nenhum cartão
  const metasDisponiveis = metas.filter((m) => m.tipo === "quitar" && !compras.some((c) => c.metaId === m.id));

  const [metaId, setMetaId] = useState<string | null>(compra?.metaId ?? null);
  const [valor, setValor] = useState(compra ? valorParaCampo(compra.valorTotal) : "");
  const [descricao, setDescricao] = useState(compra?.descricao ?? "");
  const [categoria, setCategoria] = useState(compra?.categoria ?? CATEGORIAS_COMPRA[0].nome);
  const [data, setData] = useState(compra?.data ?? hojeISO());
  const [credito, setCredito] = useState<RascunhoCredito>({
    cartaoId: compra?.cartaoId ?? cartaoInicial?.id ?? cartoes[0]?.id ?? "",
    parcelado: (compra?.parcelas ?? 1) > 1,
    parcelas: (compra?.parcelas ?? 1) > 1 ? String(compra?.parcelas) : "",
    pagas: compra?.parcelasPagas ? String(compra.parcelasPagas) : "",
  });
  // A data acompanha as parcelas pagas, até a pessoa mudar a data na mão (ao editar, a data já é a da compra)
  const [dataManual, setDataManual] = useState(!!compra);
  // Editando: dá para corrigir uma compra que foi para o crédito mas era débito/Pix
  // Débito ou crédito (começa no crédito do cartão escolhido)
  const [forma, setForma] = useState(`credito:${compra?.cartaoId ?? cartaoInicial?.id ?? cartoes[0]?.id ?? ""}`);
  const noDebito = !lerEscolha(forma).credito;
  const contas = useCartoes();
  const personalizadas = useCategoriasPersonalizadas();
  // "Outros" sai: no lugar dele, a pessoa cria a categoria que precisar
  const categorias = categoriasDe("saida", personalizadas).filter(
    (c) => c.nome !== "Fatura do cartão" && (c.nome !== "Outros" || categoria === "Outros"),
  );
  const [criando, setCriando] = useState(false);
  const [nomeNova, setNomeNova] = useState("");
  const [erro, setErro] = useState("");
  // Editando uma compra à vista: dá para dizer que ela vai se repetir (ex.: gasolina a cada 15 dias)
  const [repete, setRepete] = useState<Repeticao>("nao");
  const [varia, setVaria] = useState(false);
  const [aCadaDias, setACadaDias] = useState("15");
  const [vezesTotal, setVezesTotal] = useState("");

  function criarCategoria() {
    const texto = nomeNova.trim();
    if (texto) {
      adicionarCategoria({ tipo: "saida", nome: texto, icone: "🏷️" });
      setCategoria(categoriasDe("saida").find((c) => c.nome.toLowerCase() === texto.toLowerCase())?.nome ?? texto);
    }
    setNomeNova("");
    setCriando(false);
  }

  function trocarForma(noCredito: boolean) {
    if (noCredito === !noDebito) return;
    const id = lerEscolha(forma).id;
    if (noCredito) setForma(`credito:${cartoes.some((c) => c.id === id) ? id : credito.cartaoId || cartoes[0]?.id || ""}`);
    else setForma(`debito:${contas.some((c) => c.id === id) ? id : (contas[0]?.id ?? "")}`);
    setErro("");
  }

  function mudarCredito(novo: RascunhoCredito) {
    setCredito(novo);
    if (!dataManual) setData(dataPelasParcelasPagas(lerRascunhoCredito(novo).pagas));
  }

  function trazerDaMeta(meta: Meta) {
    if (metaId === meta.id) {
      setMetaId(null);
      return;
    }
    const pagas = meta.parcelasPagas ?? 0;
    setMetaId(meta.id);
    setDescricao(meta.nome);
    setCategoria("Compras");
    setValor(valorParaCampo((meta.parcela ?? 0) * (meta.parcelas ?? 1)));
    const vezes = meta.parcelas ?? 1;
    setCredito({ ...credito, parcelado: vezes > 1, parcelas: vezes > 1 ? String(vezes) : "", pagas: pagas ? String(pagas) : "" });
    setData(dataPelasParcelasPagas(pagas));
    setDataManual(false);
    setErro("");
  }

  const numero = lerValor(valor);

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (tipo === "assinatura") {
      const problema = salvarAssinatura(assinatura, lerValor(assinatura.valor), cartoes);
      if (problema) return setErro(problema);
      return onFechar();
    }
    const parceladoNoCredito = !noDebito && credito.parcelado;
    if (parceladoNoCredito && !(lerRascunhoCredito(credito).parcelas > 1)) return setErro("Em quantas vezes?");
    if (!(numero > 0))
      return setErro(parceladoNoCredito ? "Digite o valor da parcela ou o total." : "Digite o valor total da compra.");
    if (!data) return setErro("Escolha a data da compra.");
    if (noDebito) {
      const contaId = lerEscolha(forma).id;
      if (!contaId) return setErro("De qual conta saiu?");
      if (compra)
        compraParaDebito(compra.id, contaId, { valorTotal: numero, descricao: descricao.trim() || categoria, categoria, data });
      else
        adicionarLancamento({
          tipo: "saida",
          valor: numero,
          descricao: descricao.trim() || categoria,
          categoria,
          data,
          pago: data <= hojeISO(),
          contaId,
          // No débito com data antes de hoje: já saiu da conta antes, então o saldo de hoje não muda
          jaNoSaldo: data < hojeISO() || undefined,
        });
      return onFechar();
    }
    if (!credito.cartaoId) return setErro("Escolha o cartão.");
    const { parcelas, pagas } = lerRascunhoCredito(credito);
    const dados = {
      cartaoId: credito.cartaoId,
      descricao: descricao.trim() || categoria,
      categoria,
      valorTotal: numero,
      parcelas,
      parcelasPagas: pagas,
      data,
      metaId: metaId ?? undefined,
    };
    if (compra) atualizarCompra(compra.id, dados);
    else adicionarCompra(dados);
    const cartao = cartoes.find((c) => c.id === credito.cartaoId);
    if (compra && repete !== "nao" && parcelas === 1 && cartao) {
      const repetir = lerRepeticao(repete, aCadaDias, vezesTotal, varia);
      if (!repetir) return setErro("A cada quantos dias?");
      criarRepeticao({ nome: dados.descricao, categoria, valor: numero, data, cartao, repetir });
      mostrarAviso({ texto: "🔁 As próximas vezes ficam previstas no cartão" });
    }
    onFechar();
  }

  return (
    <Modal titulo={compra ? "Editar compra" : "Incluir no cartão"} onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-4">
        {!compra && (
          <EscolhaCompraOuAssinatura
            valor={tipo}
            onChange={(novo) => {
              setTipo(novo);
              setErro("");
            }}
          />
        )}

        {tipo === "assinatura" ? (
          <CamposAssinatura cartoes={cartoes} rascunho={assinatura} onChange={setAssinatura} comValor />
        ) : (
          <>
            {!compra && metasDisponiveis.length > 0 && (
              <div className="space-y-1.5 rounded-2xl border border-white/10 bg-fundo/50 p-3">
                <span className="text-xs text-suave">Trazer de uma meta de quitar (Trilha)</span>
                <div className="flex flex-wrap gap-2">
                  {metasDisponiveis.map((m) => (
                    <Chip key={m.id} ativo={metaId === m.id} onClick={() => trazerDaMeta(m)}>
                      <Icone e={m.icone} /> <TextoComIcones texto={m.nome} />
                    </Chip>
                  ))}
                </div>
                {metaId && (
                  <p className="text-xs text-suave">
                    <Icone e="💡" /> A meta continua na Trilha e passa a avançar sozinha quando você paga a fatura.
                  </p>
                )}
              </div>
            )}

            <Campo rotulo="O que foi?">
              <input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex.: Tênis, iFood, celular"
                className="campo"
              />
            </Campo>

            <div className="space-y-1.5">
              <span className="text-xs text-suave">Como pagou?</span>
              <div className="grid grid-cols-2 gap-1 rounded-full bg-fundo p-1">
                {[false, true].map((c) => (
                  <button
                    key={String(c)}
                    type="button"
                    onClick={() => trocarForma(c)}
                    disabled={c && cartoes.length === 0}
                    className={`rounded-full py-1.5 text-sm font-medium transition-colors disabled:opacity-40 ${
                      !noDebito === c ? "bg-white text-fundo" : "text-suave hover:text-white"
                    }`}
                  >
                    <TextoComIcones texto={c ? "💳 Crédito" : "🏦 Débito / Pix"} />
                  </button>
                ))}
              </div>
            </div>

            {noDebito ? (
              <>
                <Campo rotulo="Valor total da compra">
                  <CampoValor valor={valor} onChange={setValor} />
                </Campo>
                <EscolhaConta valor={forma} onChange={setForma} rotulo="De qual banco?" />
                <p className="rounded-2xl bg-roxo/10 px-4 py-3 text-xs text-suave">
                  <TextoComIcones
                    texto={
                      compra
                        ? "🏦 Vai sair da fatura e virar uma saída da conta."
                        : data < hojeISO()
                          ? "🏦 No débito, com data antes de hoje: fica registrado, mas não muda o saldo de hoje (já tinha saído)."
                          : "🏦 Sai do saldo da conta."
                    }
                  />
                </p>
              </>
            ) : (
              <CamposCredito
                key={metaId ?? ""}
                cartoes={cartoes}
                rascunho={credito}
                onChange={(novo) => {
                  mudarCredito(novo);
                  setForma(`credito:${novo.cartaoId}`);
                }}
                valor={valor}
                onValor={setValor}
                data={data}
              />
            )}

            <CampoDataCompra
              data={data}
              automatica={!dataManual && lerRascunhoCredito(credito).pagas > 0}
              onChange={(nova) => {
                setData(nova);
                setDataManual(true);
              }}
            />

            <div className="space-y-1.5">
              <span className="text-xs text-suave">Categoria</span>
              <div className="flex flex-wrap gap-2">
                {categorias.map((c) => (
                  <Chip key={c.nome} ativo={categoria === c.nome} onClick={() => setCategoria(c.nome)}>
                    <Icone e={c.icone} /> <TextoComIcones texto={c.nome} />
                  </Chip>
                ))}
                <Chip ativo={criando} onClick={() => setCriando(!criando)}>
                  ＋ Criar categoria
                </Chip>
              </div>
              {criando && (
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
                    placeholder="Ex.: Pet, Beleza, Presentes"
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
          </>
        )}

        {compra && tipo === "compra" && !noDebito && lerRascunhoCredito(credito).parcelas === 1 && (
          <EscolhaRepeticao
            titulo="Vai se repetir nos próximos meses?"
            repete={repete}
            onRepete={setRepete}
            aCadaDias={aCadaDias}
            onACadaDias={setACadaDias}
            vezesTotal={vezesTotal}
            onVezesTotal={setVezesTotal}
            varia={varia}
            onVaria={setVaria}
            valor={numero}
          />
        )}

        {erro && (
          <p className="text-sm text-saida">
            <TextoComIcones texto={erro} />
          </p>
        )}
        <button type="submit" className="botao-gradiente w-full rounded-full py-3 font-semibold">
          <TextoComIcones
            texto={compra ? "Salvar alterações" : tipo === "assinatura" ? "Adicionar assinatura" : "Incluir no cartão"}
          />
        </button>

        {compra && (
          <button
            type="button"
            onClick={() => {
              comDesfazer(`Compra “${compra.descricao}” excluída`, () => removerCompra(compra.id));
              onFechar();
            }}
            className="w-full py-1 text-sm text-suave hover:text-saida"
          >
            Excluir compra
          </button>
        )}
      </form>
    </Modal>
  );
}
