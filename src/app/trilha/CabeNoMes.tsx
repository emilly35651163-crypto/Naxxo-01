"use client";

import { useState } from "react";
import { adicionarDesejo } from "@/lib/store";
import { brl, lerValor, mesAtual, nomeMes, somarMeses, soNumeros } from "@/lib/formato";
import { assumirGastoMensal, avaliarGastoMensal } from "@/lib/cabe";
import { useDados } from "@/lib/dados";
import { mostrarAviso } from "@/lib/avisos";
import { CampoValor, Chip } from "@/components/Campos";
import Icone from "@/components/Icone";

const IDEIAS = [
  { nome: "Academia", icone: "🏋️" },
  { nome: "Curso", icone: "🎓" },
  { nome: "Streaming", icone: "📺" },
  { nome: "Plano de saúde", icone: "🩺" },
  { nome: "Pet", icone: "🐾" },
  { nome: "Celular", icone: "📱" },
];

const FRASE = {
  cabe: { cor: "text-entrada", icone: "✅", titulo: "Cabe!" },
  aperta: { cor: "text-amber-300", icone: "⚠️", titulo: "Cabe, mas aperta" },
  depois: { cor: "text-azul", icone: "📅", titulo: "Agora não, mas logo sim" },
  nao: { cor: "text-saida", icone: "⛔", titulo: "Ainda não cabe" },
} as const;

const mesCurto = (mes: string) => nomeMes(mes).split(" ")[0].toLowerCase();

// Trilha → "Cabe no meu mês?": um gasto novo que se repete (academia, curso…) cabe sem me causar problema? Posso começar já?
export default function CabeNoMes() {
  const dados = useDados();
  const [nome, setNome] = useState("");
  const [icone, setIcone] = useState("🏋️");
  const [valor, setValor] = useState("");
  const [inicio, setInicio] = useState(mesAtual());
  const [vezes, setVezes] = useState("");
  const [feito, setFeito] = useState<null | "fixo" | "desejo">(null);
  const incluido = !!feito;
  const setIncluido = (v: boolean) => !v && setFeito(null);

  const numero = lerValor(valor);
  const a = numero > 0 ? avaliarGastoMensal(numero, inicio, Number(vezes) || null, dados) : null;
  const opcoesInicio = [0, 1, 2, 3].map((i) => somarMeses(mesAtual(), i));

  /** Depois de incluir ou guardar: campos em branco para o próximo (o aviso continua aparecendo um tempo) */
  function limpar(oQue: "fixo" | "desejo") {
    setNome("");
    setIcone("🏋️");
    setValor("");
    setVezes("");
    setInicio(mesAtual());
    setFeito(oQue);
  }

  function incluir() {
    if (!a) return;
    const comeca = a.veredito === "depois" && a.aPartirDe ? a.aPartirDe : inicio;
    assumirGastoMensal({ nome, icone, valor: numero, inicio: comeca, vezes: Number(vezes) || null });
    limpar("fixo");
    mostrarAviso({ texto: `${nome.trim() || "Gasto"} incluído a partir de ${mesCurto(comeca)} ✓` });
  }

  /** Ainda não: fica nos Desejos (mensal); quando começar, vira gasto fixo */
  function guardarComoDesejo() {
    adicionarDesejo({ nome: nome.trim() || "Gasto mensal", icone, valor: numero, mensal: { vezes: Number(vezes) || undefined } });
    limpar("desejo");
    mostrarAviso({ texto: `${nome.trim() || "Gasto"} está nos seus desejos ✓` });
  }

  return (
    <section className="cartao space-y-4 p-5">
      <div>
        <h2 className="titulo-secao mb-1">Cabe no meu mês?</h2>
        <p className="text-sm text-suave">
          Um gasto novo que vai se repetir: o app vê se dá para assumir sem apertar e quando dá para começar.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {IDEIAS.map((i) => (
          <Chip
            key={i.nome}
            ativo={nome === i.nome}
            onClick={() => {
              setNome(i.nome);
              setIcone(i.icone);
              setIncluido(false);
            }}
          >
            <Icone e={i.icone} /> {i.nome}
          </Chip>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={nome}
          onChange={(e) => {
            setNome(e.target.value);
            setIncluido(false);
          }}
          placeholder="O que é? (ex.: academia)"
          aria-label="O que é"
          className="campo"
        />
        <CampoValor
          valor={valor}
          onChange={(v) => {
            setValor(v);
            setIncluido(false);
          }}
          rotulo="Quanto por mês"
          placeholder="por mês"
        />
      </div>

      <div className="space-y-1.5">
        <span className="text-xs text-suave">Quero começar em</span>
        <div className="flex flex-wrap gap-2">
          {opcoesInicio.map((m) => (
            <Chip key={m} ativo={inicio === m} onClick={() => setInicio(m)}>
              {m === mesAtual() ? "este mês" : mesCurto(m)}
            </Chip>
          ))}
        </div>
      </div>

      <label className="flex flex-wrap items-center gap-2 text-sm">
        Por quantos meses?
        <input
          inputMode="numeric"
          value={vezes}
          onChange={(e) => setVezes(soNumeros(e.target.value, false).slice(0, 3))}
          placeholder="sem fim"
          aria-label="Por quantos meses"
          className="campo w-24 px-2 py-1.5 text-center"
        />
      </label>

      {a && (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-fundo/50 p-4">
          <p className={`font-display text-lg font-bold ${FRASE[a.veredito].cor}`}>
            <Icone e={FRASE[a.veredito].icone} /> {FRASE[a.veredito].titulo}
          </p>
          <p className="text-sm">
            {a.veredito === "cabe" && (
              <>
                Pode começar em <b>{inicio === mesAtual() ? "este mês" : mesCurto(inicio)}</b>: mesmo com {brl(numero)} a mais por
                mês, ainda sobra uma folga para imprevistos.
              </>
            )}
            {a.veredito === "aperta" && (
              <>
                Dá para pagar, mas a sobra fica pequena (menos de 10% do que entra). Se quiser mais tranquilidade, o ideal é até{" "}
                <b>{brl(a.cabeAte)}</b> por mês.
              </>
            )}
            {a.veredito === "depois" && a.aPartirDe && (
              <>
                Começando em {mesCurto(inicio)}, falta dinheiro nos primeiros meses. A partir de <b>{mesCurto(a.aPartirDe)}</b>{" "}
                cabe e continua cabendo.
              </>
            )}
            {a.veredito === "nao" && (
              <>
                Faltariam até <b className="text-saida">{brl(a.falta ?? 0)}</b> no mês mais apertado.
                {a.cabeAte > 0 ? (
                  <>
                    {" "}
                    Hoje cabe até <b>{brl(a.cabeAte)}</b> por mês com folga.
                  </>
                ) : (
                  " Hoje não sobra nada para um gasto novo: vale olhar onde dá para cortar antes."
                )}
              </>
            )}
          </p>
          {/* Mês a mês: quanto sobraria depois do gasto novo */}
          <ul className="grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
            {a.meses.map((m) => (
              <li key={m.mes} className="rounded-xl bg-superficie px-1 py-2">
                <span className="block text-[0.65rem] text-suave">{mesCurto(m.mes)}</span>
                <span className={`block text-xs font-semibold tabular-nums ${m.depois < 0 ? "text-saida" : "text-entrada"}`}>
                  {brl(m.depois).replace("R$", "").trim()}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[0.65rem] text-suave">Quanto sobraria em cada mês já com o gasto novo.</p>
          {!incluido && (
            <div className="grid gap-2 sm:grid-cols-2">
              {a.veredito !== "nao" && (
                <button onClick={incluir} className="botao-gradiente rounded-full py-2.5 text-sm font-semibold">
                  Incluir como gasto fixo
                  {a.veredito === "depois" && a.aPartirDe ? ` a partir de ${mesCurto(a.aPartirDe)}` : ""}
                </button>
              )}
              <button
                onClick={guardarComoDesejo}
                className="rounded-full border border-rosa/50 py-2.5 text-sm font-semibold text-rosa hover:bg-rosa/10"
              >
                Guardar como desejo
              </button>
            </div>
          )}
        </div>
      )}
      {feito === "fixo" && (
        <p className="text-sm text-entrada">
          <Icone e="✅" /> Incluído nos seus gastos fixos (dá para mudar o dia em Contas).
        </p>
      )}
      {feito === "desejo" && (
        <p className="text-sm text-entrada">
          <Icone e="✅" /> Está nos Desejos (aqui em cima). Quando começar, toque em “Comecei” e ele vira gasto fixo.
        </p>
      )}
    </section>
  );
}
