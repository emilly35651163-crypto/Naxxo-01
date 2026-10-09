"use client";

import { useState } from "react";
import { registrarCompraMercado, useCartoes, usePreferencias, type ItemDaCompra } from "@/lib/store";
import { lerNotinha } from "@/lib/notinha";
import { lerTextoDosPrints } from "@/lib/ocr";
import { categoriaPeloNome, iconeDaCategoriaMercado } from "@/lib/mercado";
import { cartoesDeCredito, ehVale } from "@/lib/contas";
import { brl, hojeISO, lerValor, valorParaCampo } from "@/lib/formato";
import { mostrarAviso } from "@/lib/avisos";
import Modal from "@/components/Modal";
import Icone from "@/components/Icone";

type Linha = { nome: string; quantidade: string; valor: string; marcado: boolean };

// Mercado → "📸 Ler notinha": foto(s) do cupom fiscal → produtos e preços → a pessoa confere → vira a compra do mercado
// (gasto + "Em casa"), igual ao "Fiz o mercado".
export default function LerNotinha() {
  const contas = useCartoes();
  const prefs = usePreferencias();
  const [lendo, setLendo] = useState("");
  const [erro, setErro] = useState("");
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [loja, setLoja] = useState("");
  const [data, setData] = useState(hojeISO());
  const [totalNotinha, setTotalNotinha] = useState<number | undefined>();
  const [doMes, setDoMes] = useState(false);
  // "debito:<id>" ou "credito:<id>"
  const [pagamento, setPagamento] = useState("");

  const debitos = contas;
  const creditos = cartoesDeCredito(contas);
  const padrao = `debito:${contas.find((c) => c.id === prefs.ultimaConta)?.id ?? contas.find((c) => !ehVale(c))?.id ?? ""}`;

  async function ler(arquivos: FileList | null) {
    if (!arquivos?.length) return;
    setErro("");
    try {
      const textos = await lerTextoDosPrints([...arquivos], setLendo, (t) => /\d+,\d{2}/.test(t));
      const n = lerNotinha(textos.join("\n"));
      if (n.itens.length === 0) {
        setErro(
          "Não achei produtos nessa foto. Tente de novo com a notinha esticada, bem iluminada e de perto (dá para mandar várias fotos de uma notinha comprida).",
        );
        return;
      }
      setLinhas(n.itens.map((i) => ({ nome: i.nome, quantidade: i.quantidade, valor: valorParaCampo(i.valor), marcado: true })));
      setLoja(n.loja ?? "");
      setData(n.data && n.data <= hojeISO() ? n.data : hojeISO());
      setTotalNotinha(n.total);
      setPagamento(padrao);
    } catch {
      setErro("Não consegui ler a foto. Tente de novo.");
    } finally {
      setLendo("");
    }
  }

  const marcadas = linhas?.filter((l) => l.marcado && lerValor(l.valor) > 0) ?? [];
  const soma = marcadas.reduce((t, l) => t + lerValor(l.valor), 0);
  const bate = totalNotinha === undefined || Math.abs(soma - totalNotinha) < 0.05;

  function registrar() {
    if (marcadas.length === 0) return;
    const [forma, id] = pagamento.split(":");
    const itens: ItemDaCompra[] = marcadas.map((l) => {
      const categoria = categoriaPeloNome(l.nome.toLowerCase());
      return {
        nome: l.nome.trim(),
        icone: iconeDaCategoriaMercado(categoria),
        categoria,
        quantidade: l.quantidade,
        valor: lerValor(l.valor),
        duracao: null,
        unidade: "meses",
        repor: true,
      };
    });
    registrarCompraMercado({
      data,
      tipo: doMes ? "mes" : "avulsa",
      itens,
      ...(forma === "credito" && id ? { credito: { cartaoId: id, parcelas: 1 } } : { contaId: id || undefined }),
    });
    mostrarAviso({ texto: `🛒 Notinha registrada: ${itens.length} itens · ${brl(soma)}${loja ? ` no ${loja}` : ""}` });
    setLinhas(null);
  }

  function mudar(i: number, m: Partial<Linha>) {
    setLinhas((atual) => atual && atual.map((l, j) => (j === i ? { ...l, ...m } : l)));
  }

  return (
    <>
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-rosa/50 px-4 py-3 text-sm text-rosa hover:bg-rosa/5">
        <Icone e="📸" /> {lendo || "Ler a notinha do mercado (foto)"}
        <input
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          disabled={!!lendo}
          onChange={(e) => {
            void ler(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {erro && <p className="text-sm text-saida">{erro}</p>}

      {linhas && (
        <Modal titulo="Notinha do mercado" onFechar={() => setLinhas(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <input
                value={loja}
                onChange={(e) => setLoja(e.target.value)}
                placeholder="Mercado"
                aria-label="Mercado"
                className="campo"
              />
              <input
                type="date"
                value={data}
                max={hojeISO()}
                onChange={(e) => setData(e.target.value)}
                aria-label="Data"
                className="campo"
              />
            </div>
            <p className="text-xs text-suave">
              Confira os produtos (o leitor às vezes erra uma letra ou um número). Desmarque o que não for da compra.
            </p>
            <ul className="max-h-[45vh] divide-y divide-white/5 overflow-y-auto">
              {linhas.map((l, i) => (
                <li key={i} className={`flex items-center gap-2 py-2 ${l.marcado ? "" : "opacity-50"}`}>
                  <input
                    type="checkbox"
                    checked={l.marcado}
                    onChange={(e) => mudar(i, { marcado: e.target.checked })}
                    className="size-4 shrink-0 accent-rosa"
                    aria-label={`Incluir ${l.nome}`}
                  />
                  <span className="min-w-0 flex-1">
                    <input
                      value={l.nome}
                      onChange={(e) => mudar(i, { nome: e.target.value })}
                      aria-label="Produto"
                      className="w-full bg-transparent text-sm font-medium outline-none"
                    />
                    {l.quantidade && <span className="block text-xs text-suave">{l.quantidade}</span>}
                  </span>
                  <input
                    inputMode="decimal"
                    value={l.valor}
                    onChange={(e) => mudar(i, { valor: e.target.value })}
                    aria-label={`Valor de ${l.nome}`}
                    className="campo w-24 shrink-0 px-2 py-1 text-right text-sm tabular-nums"
                  />
                </li>
              ))}
            </ul>

            <div className="rounded-2xl bg-fundo/50 p-3 text-sm">
              <p className="flex justify-between">
                <span>Soma dos marcados</span> <b className="tabular-nums">{brl(soma)}</b>
              </p>
              {totalNotinha !== undefined && (
                <p className={`flex justify-between text-xs ${bate ? "text-entrada" : "text-amber-300"}`}>
                  <span>{bate ? "Bate com o total da notinha ✓" : "Total na notinha"}</span>
                  <span className="tabular-nums">{brl(totalNotinha)}</span>
                </p>
              )}
              {!bate && (
                <p className="mt-1 text-xs text-suave">
                  A diferença pode ser um desconto ou um produto lido errado: confira os valores.
                </p>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <select value={pagamento} onChange={(e) => setPagamento(e.target.value)} aria-label="Como pagou" className="campo">
                {debitos.map((c) => (
                  <option key={c.id} value={`debito:${c.id}`}>
                    {ehVale(c) ? "🍽️" : "🏦"} {c.nome} {ehVale(c) ? "(vale)" : "(débito/Pix)"}
                  </option>
                ))}
                {creditos.map((c) => (
                  <option key={`c${c.id}`} value={`credito:${c.id}`}>
                    💳 {c.nome} (crédito)
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={doMes} onChange={(e) => setDoMes(e.target.checked)} className="accent-rosa" />
                Foi a compra do mês
              </label>
            </div>

            <button
              onClick={registrar}
              disabled={marcadas.length === 0}
              className="botao-gradiente w-full rounded-full py-3 font-semibold disabled:opacity-40"
            >
              Registrar {marcadas.length} {marcadas.length === 1 ? "produto" : "produtos"} · {brl(soma)}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
