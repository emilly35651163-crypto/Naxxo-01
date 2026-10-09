"use client";

import { useState } from "react";
import {
  adicionarAoCarrinho,
  atualizarItemCarrinho,
  definirFrete,
  removerDoCarrinho,
  useCarrinho,
  useFretes,
  type ItemCarrinho,
} from "@/lib/store";
import { avaliarDesejo } from "@/lib/desejos";
import { useDados } from "@/lib/dados";
import { brl, lerValor, valorParaCampo } from "@/lib/formato";
import { comDesfazer } from "@/lib/avisos";
import { CampoValor, Chip } from "@/components/Campos";
import FormLancamento from "@/components/FormLancamento";
import Icone, { TextoComIcones } from "@/components/Icone";

/** As lojas mais usadas (a pessoa pode escrever outra) */
const LOJAS = [
  { nome: "Shein", icone: "👗" },
  { nome: "Mercado Livre", icone: "🤝" },
  { nome: "Amazon", icone: "📦" },
  { nome: "Shopee", icone: "🛍️" },
  { nome: "AliExpress", icone: "🌍" },
  { nome: "Temu", icone: "🏷️" },
  { nome: "Magalu", icone: "💻" },
];
const iconeDaLoja = (loja: string) => LOJAS.find((l) => l.nome === loja)?.icone ?? "🛍️";

const COR = { agora: "text-entrada", credito: "text-azul", esperar: "text-amber-300", "nao-cabe": "text-saida" } as const;

const totalDoItem = (i: ItemCarrinho) => i.valor * i.quantidade;

// Mercado → Apps: o carrinho das lojas online, separado por loja. Para cada loja, o app diz se é uma boa hora de comprar
// (a mesma conta dos Desejos: sobra do mês, crédito sem apertar, ou até quando esperar).
export default function CarrinhoApps() {
  const itens = useCarrinho();
  const fretes = useFretes();
  const dados = useDados();
  const [adicionando, setAdicionando] = useState(false);
  // Itens desmarcados (não entram na conta nem no "Comprei")
  const [fora, setFora] = useState<Set<string>>(new Set());
  const [comprando, setComprando] = useState<{ loja: string; ids: string[]; total: number } | null>(null);

  const lojas = [...new Set(itens.map((i) => i.loja))].sort(
    (a, b) => LOJAS.findIndex((l) => l.nome === a) - LOJAS.findIndex((l) => l.nome === b),
  );
  const marcados = (loja: string) => itens.filter((i) => i.loja === loja && !fora.has(i.id));
  const totalDaLoja = (loja: string) => {
    const m = marcados(loja);
    return m.length ? m.reduce((t, i) => t + totalDoItem(i), 0) + (fretes[loja] ?? 0) : 0;
  };
  const totalGeral = lojas.reduce((t, l) => t + totalDaLoja(l), 0);
  const geral = totalGeral > 0 && lojas.length > 1 ? avaliarDesejo(totalGeral, dados) : null;

  function alternar(id: string) {
    const novo = new Set(fora);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    setFora(novo);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-suave">Shein, Mercado Livre, Amazon… O que está no carrinho e quando é uma boa hora.</p>
        <button
          onClick={() => setAdicionando(!adicionando)}
          className="shrink-0 rounded-full border border-rosa/50 px-3 py-1.5 text-sm text-rosa"
        >
          + Item
        </button>
      </div>

      {adicionando && <NovoItem lojaInicial={lojas[0]} onPronto={() => setAdicionando(false)} />}

      {geral && (
        <div className="cartao p-4">
          <p className="text-xs text-suave">Tudo junto: {brl(totalGeral)}</p>
          <p className={`font-semibold ${COR[geral.tipo]}`}>
            <TextoComIcones texto={geral.titulo} />
          </p>
          <p className="text-xs text-suave">
            <TextoComIcones texto={geral.texto} />
          </p>
        </div>
      )}

      {lojas.length === 0 && !adicionando && (
        <p className="cartao p-5 text-sm text-suave">
          Coloque aqui o que está no carrinho dos apps (Shein, Mercado Livre, Amazon, Shopee…). Eu separo por loja, somo o frete e
          digo se é uma boa hora de comprar, se dá no crédito ou até quando esperar.
        </p>
      )}

      {lojas.map((loja) => {
        const daLoja = itens.filter((i) => i.loja === loja);
        const total = totalDaLoja(loja);
        const v = total > 0 ? avaliarDesejo(total, dados) : null;
        return (
          <section key={loja} className="cartao p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-2xl" aria-hidden>
                <Icone e={iconeDaLoja(loja)} />
              </span>
              <h2 className="flex-1 font-display text-lg font-bold">{loja}</h2>
              <span className="font-display font-semibold tabular-nums">{brl(total)}</span>
            </div>

            <ul className="divide-y divide-white/5">
              {daLoja.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={!fora.has(i.id)}
                    onChange={() => alternar(i.id)}
                    aria-label={`Comprar ${i.nome}`}
                    className="size-4 accent-rosa"
                  />
                  <span className={`min-w-0 flex-1 ${fora.has(i.id) ? "opacity-50" : ""}`}>
                    <span className="block truncate text-sm font-medium">
                      {i.link ? (
                        <a href={i.link} target="_blank" rel="noreferrer" className="hover:text-rosa">
                          {i.nome} ↗
                        </a>
                      ) : (
                        i.nome
                      )}
                    </span>
                    <span className="text-xs text-suave tabular-nums">
                      {i.quantidade > 1 ? `${i.quantidade} × ${brl(i.valor)} = ` : ""}
                      {brl(totalDoItem(i))}
                    </span>
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => atualizarItemCarrinho(i.id, { quantidade: Math.max(1, i.quantidade - 1) })}
                      aria-label="Menos um"
                      className="size-7 rounded-full border border-white/10 text-sm"
                    >
                      −
                    </button>
                    <span className="w-5 text-center text-sm tabular-nums">{i.quantidade}</span>
                    <button
                      onClick={() => atualizarItemCarrinho(i.id, { quantidade: i.quantidade + 1 })}
                      aria-label="Mais um"
                      className="size-7 rounded-full border border-white/10 text-sm"
                    >
                      +
                    </button>
                    <button
                      onClick={() => comDesfazer(`${i.nome} saiu do carrinho`, () => removerDoCarrinho([i.id]))}
                      aria-label={`Tirar ${i.nome}`}
                      className="ml-1 px-1 text-suave hover:text-saida"
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <label className="mt-2 flex items-center gap-2 text-xs text-suave">
              Frete
              <input
                inputMode="decimal"
                defaultValue={fretes[loja] ? valorParaCampo(fretes[loja]) : ""}
                onBlur={(e) => definirFrete(loja, lerValor(e.target.value) || null)}
                placeholder="grátis"
                aria-label={`Frete da ${loja}`}
                className="campo w-24 px-2 py-1 text-center text-xs"
              />
            </label>

            {v && (
              <div className="mt-3 rounded-2xl bg-fundo/50 p-3">
                <p className={`text-sm font-semibold ${COR[v.tipo]}`}>
                  <TextoComIcones texto={v.titulo} />
                </p>
                <p className="text-xs text-suave">
                  <TextoComIcones texto={v.texto} />
                </p>
                <button
                  onClick={() => setComprando({ loja, ids: marcados(loja).map((i) => i.id), total })}
                  className="mt-2 rounded-full bg-entrada/15 px-3 py-1.5 text-xs font-semibold text-entrada"
                >
                  Comprei {marcados(loja).length === daLoja.length ? "tudo" : `os ${marcados(loja).length} marcados`}
                </button>
              </div>
            )}
          </section>
        );
      })}

      {comprando && (
        <FormLancamento
          inicial={{
            descricao: comprando.loja,
            valor: Math.round(comprando.total * 100) / 100,
            categoria: "Compras",
            subcategoria: "Lojas online",
          }}
          onSalvo={() => {
            removerDoCarrinho(comprando.ids);
            if (itens.every((i) => i.loja !== comprando.loja || comprando.ids.includes(i.id))) definirFrete(comprando.loja, null);
          }}
          onFechar={() => setComprando(null)}
        />
      )}
    </div>
  );
}

function NovoItem({ lojaInicial, onPronto }: { lojaInicial?: string; onPronto: () => void }) {
  const [loja, setLoja] = useState(lojaInicial ?? "Shein");
  const [outraLoja, setOutraLoja] = useState(false);
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [link, setLink] = useState("");
  const [erro, setErro] = useState("");

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!loja.trim()) return setErro("Qual loja?");
    if (!nome.trim()) return setErro("O que é?");
    if (!(lerValor(valor) > 0)) return setErro("Quanto custa?");
    adicionarAoCarrinho({
      nome: nome.trim(),
      loja: loja.trim(),
      valor: lerValor(valor),
      quantidade,
      link: /^https?:\/\//.test(link.trim()) ? link.trim() : undefined,
    });
    // Fica aberto para o próximo item da mesma loja
    setNome("");
    setValor("");
    setQuantidade(1);
    setLink("");
    setErro("");
  }

  return (
    <form onSubmit={salvar} className="cartao space-y-3 p-4">
      <div className="flex flex-wrap gap-2">
        {LOJAS.map((l) => (
          <Chip
            key={l.nome}
            ativo={!outraLoja && loja === l.nome}
            onClick={() => {
              setLoja(l.nome);
              setOutraLoja(false);
            }}
          >
            <Icone e={l.icone} /> {l.nome}
          </Chip>
        ))}
        <Chip
          ativo={outraLoja}
          onClick={() => {
            setOutraLoja(true);
            setLoja("");
          }}
        >
          Outra
        </Chip>
      </div>
      {outraLoja && (
        <input
          autoFocus
          value={loja}
          onChange={(e) => setLoja(e.target.value)}
          placeholder="Nome da loja"
          aria-label="Nome da loja"
          className="campo w-full"
        />
      )}
      <div className="flex gap-2">
        <input
          autoFocus={!outraLoja}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="O que é? (ex.: vestido preto)"
          aria-label="Item"
          className="campo min-w-0 flex-1"
        />
        <div className="w-32 shrink-0">
          <CampoValor valor={valor} onChange={setValor} rotulo="Preço" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1 text-sm">
          Qtd.
          <button
            type="button"
            onClick={() => setQuantidade(Math.max(1, quantidade - 1))}
            className="size-7 rounded-full border border-white/10"
          >
            −
          </button>
          <span className="w-5 text-center tabular-nums">{quantidade}</span>
          <button
            type="button"
            onClick={() => setQuantidade(quantidade + 1)}
            className="size-7 rounded-full border border-white/10"
          >
            +
          </button>
        </span>
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="Link do produto (opcional)"
          aria-label="Link do produto"
          inputMode="url"
          className="campo min-w-0 flex-1 text-sm"
        />
      </div>
      {erro && <p className="text-sm text-saida">{erro}</p>}
      <div className="flex gap-2">
        <button type="submit" className="botao-gradiente flex-1 rounded-full py-2.5 font-semibold">
          Pôr no carrinho
        </button>
        <button type="button" onClick={onPronto} className="px-4 text-sm text-suave">
          Fechar
        </button>
      </div>
    </form>
  );
}
