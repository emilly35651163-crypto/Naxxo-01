"use client";

import { useState } from "react";
import {
  adicionarNaLista,
  alternarNoCarrinho,
  atualizarItemLista,
  planejarCompra,
  registrarCompraMercado,
  removerDaLista,
  UNIDADES_DURACAO,
  UNIDADES_QTD,
  useCartoes,
  useItensMercado,
  useListaCompras,
  type ItemLista,
  type ItemMercado,
  type UnidadeDuracao,
  type UnidadeQtd,
} from "@/lib/store";
import { brl, formatarData, hojeISO, lerValor, soNumeros } from "@/lib/formato";
import { Campo, CampoValor, Chip } from "@/components/Campos";
import BuscaProdutos from "@/components/BuscaProdutos";
import EscolhaConta, { lerEscolha } from "@/components/EscolhaConta";

/** "5 kg" -> { qtd: "5", unidade: "kg" } */
function separarQuantidade(texto: string): { qtd: string; unidade: UnidadeQtd } {
  const [, numero, unidade] = texto.trim().match(/^([\d.,]+)\s*(\S+)?/) ?? [];
  const achada = UNIDADES_QTD.find((u) => u.toLowerCase() === (unidade ?? "").toLowerCase());
  return { qtd: numero ?? "", unidade: achada ?? "un" };
}

// Passo 2: no mercado. Marca o que pegou e preenche quantidade, valor e (se souber) duração.
// Tudo vai sendo salvo na hora, então dá para fechar a página no meio da compra.
export default function PassoMercado({ onConcluir }: { onConcluir: () => void }) {
  const lista = useListaCompras();
  const despensa = useItensMercado();
  const contas = useCartoes();
  const [tipo, setTipo] = useState<"mes" | "avulsa">("mes");
  const [data, setData] = useState(hojeISO());
  // De onde sai: "debito:<conta>" ou "credito:<cartão>"
  const [pagamento, setPagamento] = useState(contas[0] ? `debito:${contas[0].id}` : "");
  const [incluindoExtra, setIncluindoExtra] = useState(false);
  const programada = data > hojeISO();
  const [erro, setErro] = useState("");

  const conhecido = (nome: string) => despensa.find((d) => d.nome.trim().toLowerCase() === nome.trim().toLowerCase());
  const peguei = lista.filter((l) => l.noCarrinho);
  const total = peguei.reduce((t, l) => t + (lerValor(l.valor ?? "") || 0), 0);

  function finalizar() {
    // Data no futuro: não registra a compra, só planeja (a lista vira previsto nesse dia)
    if (programada) {
      planejarCompra(data);
      setErro("");
      return;
    }
    if (peguei.length === 0) return setErro("Marque pelo menos um item que você pegou.");
    if (contas.length > 0 && !lerEscolha(pagamento).id) return setErro("Escolha como pagou.");
    const semValor = peguei.find((l) => !(lerValor(l.valor ?? "") > 0));
    if (semValor) return setErro(`Falta o valor de “${semValor.nome}”.`);

    registrarCompraMercado({
      data,
      tipo,
      itens: peguei.map((l) => {
        const antes = conhecido(l.nome);
        const unidadeQtd = l.unidadeQtd ?? separarQuantidade(antes?.quantidade ?? "").unidade;
        return {
          nome: l.nome,
          icone: l.icone,
          categoria: l.categoria,
          quantidade: l.qtd ? `${l.qtd} ${unidadeQtd}` : (antes?.quantidade ?? ""),
          valor: lerValor(l.valor ?? ""),
          duracao: Number(l.duracao) > 0 ? Number(l.duracao) : null,
          unidade: l.unidadeDuracao ?? antes?.unidade ?? "meses",
          repor: antes?.repor ?? true,
        };
      }),
      credito: lerEscolha(pagamento).credito ? { cartaoId: lerEscolha(pagamento).id, parcelas: 1 } : undefined,
      contaId: !lerEscolha(pagamento).credito ? lerEscolha(pagamento).id || undefined : undefined,
    });
    setErro("");
    onConcluir();
  }

  if (lista.length === 0) {
    return (
      <div className="space-y-4">
        <p className="rounded-2xl bg-fundo/50 p-4 text-center text-sm text-suave">
          Sua lista está vazia. Monte a lista no passo 1 ou adicione aqui o que você está comprando.
        </p>
        <BuscaProdutos
          placeholder="O que você está comprando?"
          onEscolher={(o) => adicionarNaLista({ nome: o.nome, icone: o.icone, categoria: o.categoria }, true)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-suave">
        Marque o que pegou e preencha <b className="text-white">quantidade</b> e <b className="text-white">valor</b>. A duração é
        opcional: só se souber, dá para mudar depois.
      </p>

      <ul className="space-y-3">
        {lista.map((l) => (
          <CartaoDoItem key={l.id} item={l} anterior={conhecido(l.nome)} />
        ))}
      </ul>

      {incluindoExtra ? (
        <div className="rounded-2xl bg-fundo/50 p-3">
          <BuscaProdutos
            autoFocus
            placeholder="O que mais você pegou?"
            jaEscolhidos={lista.map((l) => l.nome)}
            onEscolher={(o) => {
              adicionarNaLista({ nome: o.nome, icone: o.icone, categoria: o.categoria }, true);
              setIncluindoExtra(false);
            }}
          />
        </div>
      ) : (
        <button
          onClick={() => setIncluindoExtra(true)}
          className="w-full rounded-2xl border border-dashed border-white/15 py-3 text-sm text-suave hover:border-rosa hover:text-white"
        >
          + Peguei algo que não estava na lista
        </button>
      )}

      {/* Fechar a compra */}
      <div className="space-y-3 rounded-2xl border border-roxo/30 bg-roxo/5 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-suave">
            No carrinho: {peguei.length} de {lista.length}
          </span>
          <span className="gradiente-texto font-display text-2xl font-bold tabular-nums">{brl(total)}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Chip ativo={tipo === "mes"} onClick={() => setTipo("mes")}>
            🛒 Compra do mês
          </Chip>
          <Chip ativo={tipo === "avulsa"} onClick={() => setTipo("avulsa")}>
            🧺 Compra avulsa
          </Chip>
        </div>

        <Campo rotulo="Data">
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="campo w-auto" />
        </Campo>

        {programada ? (
          <p className="rounded-xl bg-azul/10 px-3 py-2 text-xs text-azul">
            🗓️ Ainda vai acontecer: a lista fica planejada para {formatarData(data)} e entra como gasto previsto nesse dia (pelo
            preço estimado). No dia, volte aqui e confirme os preços de verdade.
          </p>
        ) : (
          <EscolhaConta valor={pagamento} onChange={setPagamento} modo="ambos" rotulo="Como pagou?" />
        )}

        {erro && <p className="text-sm text-saida">{erro}</p>}

        <button onClick={finalizar} className="botao-gradiente w-full rounded-full py-3 font-semibold">
          {programada
            ? `Planejar para ${formatarData(data)}`
            : `Finalizar compra · ${peguei.length} ${peguei.length === 1 ? "item" : "itens"} · ${brl(total)}`}
        </button>
        {peguei.length < lista.length && (
          <p className="text-center text-xs text-suave">O que você não pegou continua na lista para a próxima vez.</p>
        )}
      </div>
    </div>
  );
}

function CartaoDoItem({ item: l, anterior }: { item: ItemLista; anterior?: ItemMercado }) {
  const [comDuracao, setComDuracao] = useState(!!l.duracao);
  const quantidadeAnterior = separarQuantidade(anterior?.quantidade ?? "");
  const mudar = (mudancas: Partial<ItemLista>) => atualizarItemLista(l.id, mudancas);

  return (
    <li
      className={`rounded-2xl border p-3 transition-colors ${l.noCarrinho ? "border-rosa/50 bg-rosa/5" : "border-white/10 bg-fundo/40"}`}
    >
      <div className="flex items-center gap-3">
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={l.noCarrinho}
            onChange={() => alternarNoCarrinho(l.id)}
            className="size-5 accent-rosa"
          />
          <span className="text-xl">{l.icone}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{l.nome}</span>
            {anterior && (
              <span className="block text-xs text-suave">
                última vez: {brl(anterior.valor)}
                {anterior.quantidade && ` · ${anterior.quantidade}`}
              </span>
            )}
          </span>
        </label>
        <button
          onClick={() => removerDaLista(l.id)}
          aria-label={`Tirar ${l.nome}`}
          className="px-1 text-lg text-suave hover:text-saida"
        >
          ×
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Campo rotulo="Quantidade">
          <div className="flex gap-1">
            <input
              inputMode="decimal"
              value={l.qtd ?? ""}
              onChange={(e) => mudar({ qtd: soNumeros(e.target.value), noCarrinho: true })}
              placeholder={quantidadeAnterior.qtd || "1"}
              className="campo w-16 px-2 py-2 text-center placeholder:text-white/45"
            />
            <select
              value={l.unidadeQtd ?? quantidadeAnterior.unidade}
              onChange={(e) => mudar({ unidadeQtd: e.target.value as UnidadeQtd })}
              className="campo min-w-0 flex-1 cursor-pointer px-2 py-2"
            >
              {UNIDADES_QTD.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </Campo>
        <Campo rotulo="Valor">
          <CampoValor
            valor={l.valor ?? ""}
            onChange={(valor) => mudar({ valor, noCarrinho: valor ? true : l.noCarrinho })}
            placeholder={anterior ? String(anterior.valor).replace(".", ",") : "0,00"}
          />
        </Campo>
      </div>

      {comDuracao ? (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-suave">Dura</span>
          <input
            inputMode="numeric"
            value={l.duracao ?? ""}
            onChange={(e) => mudar({ duracao: soNumeros(e.target.value, false) })}
            placeholder="?"
            className="campo w-14 px-2 py-1.5 text-center text-sm"
          />
          <select
            value={l.unidadeDuracao ?? anterior?.unidade ?? "meses"}
            onChange={(e) => mudar({ unidadeDuracao: e.target.value as UnidadeDuracao })}
            className="campo w-auto cursor-pointer px-2 py-1.5 text-sm"
          >
            {UNIDADES_DURACAO.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <button onClick={() => setComDuracao(true)} className="mt-2 text-xs text-rosa">
          + duração (se souber)
          {anterior?.duracao ? (
            <span className="text-suave">
              {" "}
              · hoje o app conta {anterior.duracao} {anterior.unidade}
            </span>
          ) : null}
        </button>
      )}
    </li>
  );
}
