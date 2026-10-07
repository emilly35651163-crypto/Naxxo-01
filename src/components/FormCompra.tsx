"use client";

import { useState } from "react";
import {
  adicionarCompra,
  atualizarCompra,
  CATEGORIAS,
  compraParaDebito,
  adicionarLancamento,
  removerCompra,
  useCompras,
  useMetas,
  type Cartao,
  type CompraCartao,
  type Meta,
} from "@/lib/store";
import { hojeISO, lerValor } from "@/lib/formato";
import { dataPelasParcelasPagas } from "@/lib/cartoes";
import Modal from "./Modal";
import { Campo, CampoValor, Chip } from "./Campos";
import CamposCredito, { lerRascunhoCredito, type RascunhoCredito } from "./CamposCredito";
import EscolhaConta, { lerEscolha } from "./EscolhaConta";
import CamposAssinatura, { assinaturaVazia, salvarAssinatura, type RascunhoAssinatura } from "./CamposAssinatura";
import { comDesfazer } from "@/lib/avisos";

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
        <span className="block text-xs text-suave">✨ Calculada pelas parcelas pagas. Pode ajustar se não for essa.</span>
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
          <span className="block text-sm font-semibold">{o.nome}</span>
          <span className="block text-xs text-suave">{o.descricao}</span>
        </button>
      ))}
    </div>
  );
}

function paraTexto(valor: number) {
  return String(Math.round(valor * 100) / 100).replace(".", ",");
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
  const [valor, setValor] = useState(compra ? paraTexto(compra.valorTotal) : "");
  const [descricao, setDescricao] = useState(compra?.descricao ?? "");
  const [categoria, setCategoria] = useState(compra?.categoria ?? CATEGORIAS_COMPRA[0].nome);
  const [data, setData] = useState(compra?.data ?? hojeISO());
  const [credito, setCredito] = useState<RascunhoCredito>({
    cartaoId: compra?.cartaoId ?? cartaoInicial?.id ?? cartoes[0]?.id ?? "",
    parcelas: String(compra?.parcelas ?? 1),
    pagas: compra?.parcelasPagas ? String(compra.parcelasPagas) : "",
  });
  // A data acompanha as parcelas pagas, até a pessoa mudar a data na mão (ao editar, a data já é a da compra)
  const [dataManual, setDataManual] = useState(!!compra);
  // Editando: dá para corrigir uma compra que foi para o crédito mas era débito/Pix
  // Débito ou crédito (começa no crédito do cartão escolhido)
  const [forma, setForma] = useState(`credito:${compra?.cartaoId ?? cartaoInicial?.id ?? cartoes[0]?.id ?? ""}`);
  const noDebito = !lerEscolha(forma).credito;
  const [erro, setErro] = useState("");

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
    setValor(String((meta.parcela ?? 0) * (meta.parcelas ?? 1)).replace(".", ","));
    setCredito({ ...credito, parcelas: String(meta.parcelas ?? 1), pagas: pagas ? String(pagas) : "" });
    setData(dataPelasParcelasPagas(pagas));
    setDataManual(false);
    setErro("");
  }

  const numero = lerValor(valor);

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (tipo === "assinatura") {
      const problema = salvarAssinatura(assinatura, lerValor(assinatura.valor));
      if (problema) return setErro(problema);
      return onFechar();
    }
    if (!(numero > 0)) return setErro("Digite o valor total da compra.");
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
                      {m.icone} {m.nome}
                    </Chip>
                  ))}
                </div>
                {metaId && (
                  <p className="text-xs text-suave">
                    💡 A meta continua na Trilha e passa a avançar sozinha quando você paga a fatura.
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

            <Campo rotulo="Valor total da compra">
              <CampoValor valor={valor} onChange={setValor} />
            </Campo>

            <EscolhaConta
              valor={forma}
              onChange={(nova) => {
                setForma(nova);
                const e = lerEscolha(nova);
                if (e.credito) mudarCredito({ ...credito, cartaoId: e.id });
              }}
              modo="ambos"
              rotulo="Como pagou?"
            />

            {noDebito ? (
              <p className="rounded-2xl bg-roxo/10 px-4 py-3 text-xs text-suave">
                {compra
                  ? "🏦 Vai sair da fatura e virar uma saída da conta."
                  : data < hojeISO()
                    ? "🏦 No débito, com data antes de hoje: fica registrado, mas não muda o saldo de hoje (já tinha saído)."
                    : "🏦 Sai do saldo da conta."}
              </p>
            ) : (
              <CamposCredito cartoes={cartoes} rascunho={credito} onChange={mudarCredito} valorTotal={numero} data={data} />
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
                {CATEGORIAS_COMPRA.map((c) => (
                  <Chip key={c.nome} ativo={categoria === c.nome} onClick={() => setCategoria(c.nome)}>
                    {c.icone} {c.nome}
                  </Chip>
                ))}
              </div>
            </div>
          </>
        )}

        {erro && <p className="text-sm text-saida">{erro}</p>}
        <button type="submit" className="botao-gradiente w-full rounded-full py-3 font-semibold">
          {compra ? "Salvar alterações" : tipo === "assinatura" ? "Adicionar assinatura" : "Incluir no cartão"}
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
