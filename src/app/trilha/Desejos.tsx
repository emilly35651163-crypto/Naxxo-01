"use client";

import { useRef, useState } from "react";
import { DotsSixVertical } from "@phosphor-icons/react";
import { adicionarDesejo, editarDesejo, ordenarDesejos, removerDesejo, useDesejos, type Desejo } from "@/lib/store";
import { brl, lerValor } from "@/lib/formato";
import { avaliarDesejo } from "@/lib/desejos";
import { assumirGastoMensal, avaliarGastoMensal, planoDosDesejos } from "@/lib/cabe";
import { mesAtual, nomeMes } from "@/lib/formato";
import { useDados } from "@/lib/dados";
import { comDesfazer } from "@/lib/avisos";
import { CampoValor } from "@/components/Campos";
import FormLancamento from "@/components/FormLancamento";
import Icone, { TextoComIcones } from "@/components/Icone";

const IDEIAS = [
  { nome: "Perfume", icone: "🌸" },
  { nome: "Restaurante", icone: "🍝" },
  { nome: "Roupa", icone: "👗" },
  { nome: "Sapato", icone: "👟" },
  { nome: "Show", icone: "🎤" },
  { nome: "Presente", icone: "🎁" },
];

const COR = { agora: "text-entrada", credito: "text-azul", esperar: "text-amber-300", "nao-cabe": "text-saida" } as const;

// Desejos: coisinhas do dia a dia. Para cada uma, o app diz se é a hora, se dá no crédito ou até quando esperar.
export default function Desejos() {
  const desejos = useDesejos();
  const dados = useDados();
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [icone, setIcone] = useState("✨");
  const [valor, setValor] = useState("");
  const [comprando, setComprando] = useState<Desejo | null>(null);
  const [editando, setEditando] = useState<{ id: string; nome: string; valor: string; mensal: boolean; vezes: string } | null>(
    null,
  );

  function salvarEdicao(e: React.FormEvent) {
    e.preventDefault();
    if (!editando || !editando.nome.trim() || !(lerValor(editando.valor) > 0)) return;
    editarDesejo(editando.id, {
      nome: editando.nome.trim(),
      valor: lerValor(editando.valor),
      mensal: editando.mensal ? { vezes: Number(editando.vezes) || undefined } : undefined,
    });
    setEditando(null);
  }
  // Arrastar para mudar a prioridade: o item segue o dedo e os outros deslizam para abrir espaço.
  // A lista só muda de ordem de verdade ao soltar.
  const [arrasto, setArrasto] = useState<{
    id: string;
    de: number; // posição de onde saiu
    para: number; // posição onde vai cair
    dy: number; // quanto o dedo andou
    y0: number;
    centros: number[]; // o meio de cada item quando começou
    altura: number; // altura do item arrastado (o quanto os outros deslizam)
  } | null>(null);
  const lista = useRef<HTMLUListElement>(null);
  const vibrar = () => {
    try {
      navigator.vibrate?.(8);
    } catch {}
  };

  function pegar(e: React.PointerEvent, i: number, id: string) {
    if (!lista.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const caixas = [...lista.current.children].map((li) => li.getBoundingClientRect());
    setArrasto({
      id,
      de: i,
      para: i,
      dy: 0,
      y0: e.clientY,
      centros: caixas.map((c) => c.top + c.height / 2),
      altura: caixas[i].height,
    });
    vibrar();
  }

  function arrastar(e: React.PointerEvent) {
    if (!arrasto) return;
    const dy = e.clientY - arrasto.y0;
    const meio = arrasto.centros[arrasto.de] + dy;
    // Cai na posição de quantos outros itens têm o meio acima do meio do arrastado
    const para = arrasto.centros.filter((c, j) => j !== arrasto.de && c < meio).length;
    if (para !== arrasto.para) vibrar();
    setArrasto({ ...arrasto, dy, para });
  }

  function soltar() {
    if (!arrasto) return;
    if (arrasto.para !== arrasto.de) {
      const ordem = desejos.map((d) => d.id).filter((id) => id !== arrasto.id);
      ordem.splice(arrasto.para, 0, arrasto.id);
      ordenarDesejos(ordem);
    }
    setArrasto(null);
  }

  /** Quanto cada item se desloca agora (o arrastado segue o dedo; os do caminho abrem espaço) */
  function deslocamento(i: number) {
    if (!arrasto) return 0;
    if (i === arrasto.de) return arrasto.dy;
    if (arrasto.de < arrasto.para && i > arrasto.de && i <= arrasto.para) return -arrasto.altura;
    if (arrasto.para < arrasto.de && i >= arrasto.para && i < arrasto.de) return arrasto.altura;
    return 0;
  }

  /** Pelo teclado: setas para cima e para baixo */
  function moverComTeclado(e: React.KeyboardEvent, i: number) {
    const j = e.key === "ArrowUp" ? i - 1 : e.key === "ArrowDown" ? i + 1 : -1;
    if (j < 0 || j >= desejos.length) return;
    e.preventDefault();
    const ordem = desejos.map((d) => d.id);
    [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
    ordenarDesejos(ordem);
  }
  const plano = desejos.length > 1 ? planoDosDesejos(desejos, dados) : null;
  const mesCurto = (m: string) => (m === mesAtual() ? "este mês" : nomeMes(m).toLowerCase());

  /** Desejo mensal: cabe começar este mês? (a mesma conta do "Cabe no meu mês?") */
  function avaliarMensal(d: Desejo) {
    const a = avaliarGastoMensal(d.valor, mesAtual(), d.mensal?.vezes ?? null, dados);
    const mes = (m?: string) => (m ? nomeMes(m).split(" ")[0].toLowerCase() : "");
    if (a.veredito === "cabe")
      return {
        tipo: "agora" as const,
        titulo: "✅ Cabe começar agora",
        texto: "Mesmo com esse gasto todo mês, ainda sobra folga.",
      };
    if (a.veredito === "aperta")
      return {
        tipo: "esperar" as const,
        titulo: "⚠️ Cabe, mas aperta",
        texto: `Com folga, o ideal é até ${brl(a.cabeAte)} por mês.`,
      };
    if (a.veredito === "depois")
      return {
        tipo: "esperar" as const,
        titulo: `📅 A partir de ${mes(a.aPartirDe)}`,
        texto: "Este mês ainda falta; de lá em diante cabe.",
      };
    return {
      tipo: "nao-cabe" as const,
      titulo: "⛔ Ainda não cabe",
      texto: a.cabeAte > 0 ? `Hoje cabe até ${brl(a.cabeAte)} por mês.` : "Hoje não sobra para um gasto novo.",
    };
  }

  /** "Comecei": o desejo mensal vira gasto fixo a partir deste mês e sai da lista */
  function comecei(d: Desejo) {
    comDesfazer(`${d.nome} virou gasto fixo a partir de ${nomeMes(mesAtual()).split(" ")[0].toLowerCase()}`, () => {
      assumirGastoMensal({ nome: d.nome, icone: d.icone, valor: d.valor, inicio: mesAtual(), vezes: d.mensal?.vezes });
      removerDesejo(d.id);
    });
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !(lerValor(valor) > 0)) return;
    adicionarDesejo({ nome: nome.trim(), icone, valor: lerValor(valor) });
    setNome("");
    setValor("");
    setIcone("✨");
    setCriando(false);
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="titulo-secao mb-0">Desejos</h2>
        <button onClick={() => setCriando(!criando)} className="rounded-full border border-rosa/50 px-3 py-1.5 text-sm text-rosa">
          + Desejo
        </button>
      </div>

      {criando && (
        <form onSubmit={salvar} className="cartao mb-3 space-y-3 p-4">
          <div className="flex flex-wrap gap-2">
            {IDEIAS.map((i) => (
              <button
                key={i.nome}
                type="button"
                onClick={() => {
                  setNome(i.nome);
                  setIcone(i.icone);
                }}
                className={`rounded-full border px-3 py-1 text-sm ${nome === i.nome ? "border-rosa bg-rosa/15" : "border-white/10"}`}
              >
                <Icone e={i.icone} /> <TextoComIcones texto={i.nome} />
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="O que você quer?"
              className="campo min-w-0 flex-1"
            />
            <div className="w-36 shrink-0">
              <CampoValor valor={valor} onChange={setValor} rotulo="Quanto custa" />
            </div>
          </div>
          <button type="submit" className="botao-gradiente w-full rounded-full py-2.5 font-semibold">
            Adicionar desejo
          </button>
        </form>
      )}

      {plano && (
        <div className="cartao mb-3 space-y-3 p-4">
          <div>
            <h3 className="font-display font-bold">Plano dos desejos</h3>
            <p className="text-xs text-suave">
              Todos juntos, na ordem de prioridade (arraste pelos pontinhos para mudar). A sobra de cada mês vai sendo usada e
              juntada, sempre com uma folga para imprevistos.
            </p>
          </div>
          <p className={`text-sm font-semibold ${plano.todosCabem ? "text-entrada" : "text-amber-300"}`}>
            {plano.todosCabem ? (
              <>
                <Icone e="✅" /> Dá para todos nos próximos 12 meses
              </>
            ) : (
              <>
                <Icone e="⚠️" /> Nem todos cabem nos próximos 12 meses
              </>
            )}
          </p>
          <ol className="space-y-2">
            {plano.linha.map((m) => (
              <li key={m.mes} className="flex gap-3 text-sm">
                <span className="w-24 shrink-0 font-semibold capitalize text-rosa">{mesCurto(m.mes)}</span>
                <span className="min-w-0 flex-1">
                  {m.itens.map((d) => (
                    <span key={d.id} className="block">
                      {d.mensal ? "começar" : "comprar"} <TextoComIcones texto={d.nome} />{" "}
                      <span className="text-suave tabular-nums">
                        ({brl(d.valor)}
                        {d.mensal && "/mês"})
                      </span>
                    </span>
                  ))}
                </span>
              </li>
            ))}
            {desejos
              .filter((d) => plano.quando[d.id] === null)
              .map((d) => (
                <li key={d.id} className="flex gap-3 text-sm">
                  <span className="w-24 shrink-0 font-semibold text-saida">não cabe</span>
                  <span className="min-w-0 flex-1 text-suave">
                    <TextoComIcones texto={d.nome} /> ({brl(d.valor)}
                    {d.mensal && "/mês"}): um preço menor ou subir na prioridade pode ajudar.
                  </span>
                </li>
              ))}
          </ol>
        </div>
      )}

      {desejos.length > 0 ? (
        <ul ref={lista} className="cartao divide-y divide-white/5 px-4">
          {desejos.map((d, i) => {
            const v = d.mensal ? avaliarMensal(d) : avaliarDesejo(d.valor, dados);
            return (
              <li
                key={d.id}
                style={{
                  transform: `translateY(${deslocamento(i)}px)${arrasto?.id === d.id ? " scale(1.03)" : ""}`,
                  // O arrastado acompanha o dedo sem atraso; os outros deslizam suave
                  transition: arrasto?.id === d.id ? "box-shadow 150ms" : arrasto ? "transform 200ms ease" : "none",
                }}
                className={`relative flex items-center gap-3 py-3 ${arrasto?.id === d.id ? "z-10 -mx-4 rounded-2xl bg-superficie px-4 shadow-2xl ring-1 ring-rosa/50" : ""}`}
              >
                {desejos.length > 1 && (
                  <button
                    type="button"
                    onPointerDown={(e) => pegar(e, i, d.id)}
                    onPointerMove={arrastar}
                    onPointerUp={soltar}
                    onPointerCancel={soltar}
                    onKeyDown={(e) => moverComTeclado(e, i)}
                    aria-label={`${i + 1}º: arraste para mudar a prioridade de ${d.nome}`}
                    className={`-my-3 -ml-2 flex shrink-0 touch-none select-none flex-col items-center justify-center self-stretch px-2 text-suave hover:text-rosa ${arrasto?.id === d.id ? "cursor-grabbing text-rosa" : "cursor-grab"}`}
                  >
                    <DotsSixVertical size={20} weight="bold" />
                    <span className="text-[0.65rem] font-semibold tabular-nums">
                      {arrasto?.id === d.id ? arrasto.para + 1 : i + 1}º
                    </span>
                  </button>
                )}
                <span className="text-2xl" aria-hidden>
                  <Icone e={d.icone} />
                </span>
                {editando?.id === d.id ? (
                  <form onSubmit={salvarEdicao} className="min-w-0 flex-1 space-y-2">
                    <input
                      autoFocus
                      value={editando.nome}
                      onChange={(e) => setEditando({ ...editando, nome: e.target.value })}
                      aria-label="Nome do desejo"
                      className="campo w-full"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="w-36">
                        <CampoValor
                          valor={editando.valor}
                          onChange={(valor) => setEditando({ ...editando, valor })}
                          rotulo={editando.mensal ? "Quanto por mês" : "Quanto custa"}
                        />
                      </div>
                      <label className="flex items-center gap-1.5 text-xs text-suave">
                        <input
                          type="checkbox"
                          checked={editando.mensal}
                          onChange={(e) => setEditando({ ...editando, mensal: e.target.checked })}
                          className="accent-rosa"
                        />
                        todo mês
                      </label>
                      {editando.mensal && (
                        <input
                          inputMode="numeric"
                          value={editando.vezes}
                          onChange={(e) => setEditando({ ...editando, vezes: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                          placeholder="meses (sem fim)"
                          aria-label="Por quantos meses"
                          className="campo w-32 px-2 py-1.5 text-center text-sm"
                        />
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" className="botao-gradiente rounded-full px-4 py-1.5 text-sm font-semibold">
                        Salvar
                      </button>
                      <button type="button" onClick={() => setEditando(null)} className="px-3 py-1.5 text-sm text-suave">
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">
                        <TextoComIcones texto={d.nome} />{" "}
                        <span className="text-sm text-suave tabular-nums">
                          · {brl(d.valor)}
                          {d.mensal && "/mês"}
                        </span>
                      </span>
                      <span className={`block text-sm font-semibold ${COR[v.tipo]}`}>
                        <TextoComIcones texto={v.titulo} />
                      </span>
                      <span className="block text-xs text-suave">
                        <TextoComIcones texto={v.texto} />
                      </span>
                      {plano && (
                        <span className="mt-0.5 block text-xs text-rosa">
                          No plano com os outros: {plano.quando[d.id] ? mesCurto(plano.quando[d.id]!) : "não cabe em 12 meses"}
                        </span>
                      )}
                    </span>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <button
                        onClick={() => (d.mensal ? comecei(d) : setComprando(d))}
                        className="rounded-full bg-entrada/15 px-3 py-1 text-xs font-semibold text-entrada"
                      >
                        {d.mensal ? "Comecei" : "Comprei"}
                      </button>
                      <button
                        onClick={() =>
                          setEditando({
                            id: d.id,
                            nome: d.nome,
                            valor: brl(d.valor).replace("R$", "").trim(),
                            mensal: !!d.mensal,
                            vezes: d.mensal?.vezes ? String(d.mensal.vezes) : "",
                          })
                        }
                        className="text-xs text-suave hover:text-rosa"
                      >
                        editar
                      </button>
                      <button
                        onClick={() => comDesfazer(`${d.nome} removido`, () => removerDesejo(d.id))}
                        className="text-xs text-suave hover:text-saida"
                      >
                        remover
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        !criando && (
          <p className="cartao p-4 text-sm text-suave">Um perfume, um restaurante, uma roupa… o app diz quando é uma boa hora.</p>
        )
      )}

      {comprando && (
        <FormLancamento
          inicial={{ descricao: comprando.nome, valor: comprando.valor, categoria: "Compras" }}
          onSalvo={() => removerDesejo(comprando.id)}
          onFechar={() => setComprando(null)}
        />
      )}
    </section>
  );
}
