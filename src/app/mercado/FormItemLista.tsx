"use client";

import { useState } from "react";
import {
  adicionarNaLista,
  CATEGORIAS_MERCADO,
  semAcento,
  UNIDADES_QTD,
  useItensMercado,
  useOpcoesMercado,
  type CategoriaMercado,
  type ItemLista,
  type UnidadeDuracao,
  type UnidadeQtd,
} from "@/lib/store";
import { soNumeros } from "@/lib/formato";
import { DURACOES, todasAsOpcoes } from "@/lib/mercado";
import CamposPreco from "./CamposPreco";
import { mostrarAviso } from "@/lib/avisos";
import Modal from "@/components/Modal";
import { Campo, Chip } from "@/components/Campos";

type Rascunho = {
  categoria: CategoriaMercado;
  nome: string;
  qtd: string;
  unidadeQtd: UnidadeQtd;
  valor: string;
  duracao: string;
  unidadeDuracao: UnidadeDuracao;
  outraDuracao: boolean;
};

const vazio = (categoria: CategoriaMercado = "alimentos"): Rascunho => ({
  categoria,
  nome: "",
  qtd: "",
  unidadeQtd: CATEGORIAS_MERCADO.find((c) => c.id === categoria)!.unidade,
  valor: "",
  duracao: "",
  unidadeDuracao: "meses",
  outraDuracao: false,
});

const NOMES_UNIDADE: Record<UnidadeQtd, string> = { un: "unidade", kg: "kg", g: "g", L: "litro", ml: "ml", pacote: "pacote" };

// Adicionar itens na lista, um de cada vez: categoria, nome (com sugestões), quantidade, preço e quanto dura.
// Só o nome é obrigatório. "Adicionar mais" passa para o próximo; dá para voltar e corrigir o anterior.
export default function FormItemLista({ inicial, onFechar }: { inicial?: ItemLista; onFechar: () => void }) {
  const despensa = useItensMercado();
  const criadas = useOpcoesMercado();
  const [rascunhos, setRascunhos] = useState<Rascunho[]>([
    inicial
      ? {
          categoria: inicial.categoria,
          nome: inicial.nome,
          qtd: inicial.qtd ?? "",
          unidadeQtd: inicial.unidadeQtd ?? CATEGORIAS_MERCADO.find((c) => c.id === inicial.categoria)?.unidade ?? "un",
          valor: inicial.valor ?? "",
          duracao: inicial.duracao ?? "",
          unidadeDuracao: inicial.unidadeDuracao ?? "meses",
          outraDuracao:
            !!inicial.duracao && !DURACOES.some((d) => d.duracao === inicial.duracao && d.unidade === inicial.unidadeDuracao),
        }
      : vazio(),
  ]);
  const [atual, setAtual] = useState(0);
  const [erro, setErro] = useState("");
  const r = rascunhos[atual];
  const mudar = (m: Partial<Rascunho>) => {
    setRascunhos((todos) => todos.map((x, i) => (i === atual ? { ...x, ...m } : x)));
    setErro("");
  };

  // Sugestões a partir do que está sendo digitado (o que a pessoa já usou antes)
  const termo = semAcento(r.nome);
  const sugestoes = termo
    ? todasAsOpcoes(despensa, criadas)
        .filter((o) => semAcento(o.nome).includes(termo) && semAcento(o.nome) !== termo)
        .slice(0, 6)
    : [];
  const unidade = NOMES_UNIDADE[r.unidadeQtd];

  function salvarTodos() {
    const validos = rascunhos.filter((x) => x.nome.trim());
    if (validos.length === 0) return false;
    for (const x of validos) {
      adicionarNaLista({
        nome: x.nome,
        icone: CATEGORIAS_MERCADO.find((c) => c.id === x.categoria)!.icone,
        categoria: x.categoria,
        qtd: x.qtd || undefined,
        unidadeQtd: x.unidadeQtd,
        valor: x.valor || undefined,
        duracao: x.duracao || undefined,
        unidadeDuracao: x.duracao ? x.unidadeDuracao : undefined,
      });
    }
    mostrarAviso({ texto: validos.length === 1 ? `${validos[0].nome.trim()} na lista ✓` : `${validos.length} itens na lista ✓` });
    return true;
  }

  function maisUm() {
    if (!r.nome.trim()) return setErro("Escreva o nome do item.");
    setRascunhos((todos) => [...todos, vazio(r.categoria)]);
    setAtual(rascunhos.length);
  }

  return (
    <Modal
      titulo={inicial ? "Editar item" : rascunhos.length > 1 ? `Item ${atual + 1} de ${rascunhos.length}` : "Adicionar à lista"}
      onFechar={onFechar}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!r.nome.trim()) return setErro("Escreva o nome do item.");
          if (salvarTodos()) onFechar();
        }}
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <span className="text-xs text-suave">Categoria</span>
          <div className="flex flex-wrap gap-2">
            {CATEGORIAS_MERCADO.map((c) => (
              <Chip key={c.id} ativo={r.categoria === c.id} onClick={() => mudar({ categoria: c.id, unidadeQtd: c.unidade })}>
                {c.icone} {c.nome}
              </Chip>
            ))}
          </div>
        </div>

        <Campo rotulo="Nome do item">
          <input
            autoFocus
            value={r.nome}
            onChange={(e) => mudar({ nome: e.target.value })}
            placeholder="Ex.: arroz, frango, detergente"
            className="campo"
          />
        </Campo>
        {sugestoes.length > 0 && (
          <div className="-mt-2 flex flex-wrap gap-2">
            {sugestoes.map((s) => (
              <button
                key={s.nome}
                type="button"
                onClick={() =>
                  mudar({
                    nome: s.nome,
                    categoria: s.categoria,
                    unidadeQtd: CATEGORIAS_MERCADO.find((c) => c.id === s.categoria)?.unidade ?? "un",
                  })
                }
                className="rounded-full bg-roxo/15 px-3 py-1 text-sm"
              >
                {s.nome}
              </button>
            ))}
          </div>
        )}

        <p className="rounded-2xl bg-roxo/10 px-4 py-2 text-xs text-suave">
          Quantidade, preço e duração são opcionais: dá para preencher depois, no mercado.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Quantidade">
            <input
              inputMode="decimal"
              value={r.qtd}
              onChange={(e) => mudar({ qtd: soNumeros(e.target.value) })}
              placeholder="Ex.: 2"
              className="campo"
            />
          </Campo>
          <Campo rotulo="Medida">
            <select
              value={r.unidadeQtd}
              onChange={(e) => mudar({ unidadeQtd: e.target.value as UnidadeQtd })}
              className="campo cursor-pointer"
            >
              {UNIDADES_QTD.map((u) => (
                <option key={u} value={u}>
                  {NOMES_UNIDADE[u]}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        <CamposPreco valor={r.valor} qtd={r.qtd} unidade={unidade} onChange={(m) => mudar(m)} />

        <div className="space-y-1.5">
          <span className="text-xs text-suave">Quanto tempo dura?</span>
          <div className="flex flex-wrap gap-2">
            {DURACOES.map((d) => (
              <Chip
                key={d.rotulo}
                ativo={!r.outraDuracao && r.duracao === d.duracao && r.unidadeDuracao === d.unidade}
                onClick={() => mudar({ duracao: d.duracao, unidadeDuracao: d.unidade, outraDuracao: false })}
              >
                {d.rotulo}
              </Chip>
            ))}
            <Chip ativo={r.outraDuracao} onClick={() => mudar({ outraDuracao: true, duracao: "" })}>
              Outro
            </Chip>
          </div>
          {r.outraDuracao && (
            <div className="flex gap-2">
              <input
                inputMode="numeric"
                value={r.duracao}
                onChange={(e) => mudar({ duracao: soNumeros(e.target.value, false) })}
                placeholder="Ex.: 10"
                className="campo w-24"
              />
              <select
                value={r.unidadeDuracao}
                onChange={(e) => mudar({ unidadeDuracao: e.target.value as UnidadeDuracao })}
                className="campo cursor-pointer"
              >
                <option value="dias">dias</option>
                <option value="semanas">semanas</option>
                <option value="meses">meses</option>
              </select>
            </div>
          )}
        </div>

        {erro && (
          <p role="alert" className="text-sm text-saida">
            {erro}
          </p>
        )}

        {rascunhos.length > 1 && (
          <div className="flex justify-between text-sm">
            <button
              type="button"
              disabled={atual === 0}
              onClick={() => setAtual(atual - 1)}
              className="text-rosa disabled:opacity-30"
            >
              ‹ Item anterior
            </button>
            <button
              type="button"
              disabled={atual === rascunhos.length - 1}
              onClick={() => setAtual(atual + 1)}
              className="text-rosa disabled:opacity-30"
            >
              Próximo ›
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {!inicial && (
            <button type="button" onClick={maisUm} className="rounded-full border border-rosa/50 py-3 font-semibold text-rosa">
              + Mais um item
            </button>
          )}
          <button type="submit" className={`botao-gradiente rounded-full py-3 font-semibold ${inicial ? "col-span-2" : ""}`}>
            Feito
          </button>
        </div>
      </form>
    </Modal>
  );
}
