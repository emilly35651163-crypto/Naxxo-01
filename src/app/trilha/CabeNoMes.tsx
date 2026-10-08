"use client";

import { useState } from "react";
import { adicionarGastoFixo, useCartoes } from "@/lib/store";
import { brl, lerValor, mesAtual, nomeMes, somarMeses, soNumeros } from "@/lib/formato";
import { avaliarGastoMensal } from "@/lib/cabe";
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
  const contas = useCartoes();
  const [nome, setNome] = useState("");
  const [icone, setIcone] = useState("🏋️");
  const [valor, setValor] = useState("");
  const [inicio, setInicio] = useState(mesAtual());
  const [vezes, setVezes] = useState("");
  const [incluido, setIncluido] = useState(false);

  const numero = lerValor(valor);
  const a = numero > 0 ? avaliarGastoMensal(numero, inicio, Number(vezes) || null, dados) : null;
  const opcoesInicio = [0, 1, 2, 3].map((i) => somarMeses(mesAtual(), i));

  function incluir() {
    if (!a) return;
    const comeca = a.veredito === "depois" && a.aPartirDe ? a.aPartirDe : inicio;
    const total = Number(vezes) || 0;
    adicionarGastoFixo({
      nome: nome.trim() || "Gasto mensal",
      icone,
      categoria: /academia|plano|saude|médic/i.test(nome)
        ? "saude"
        : /curso|escola|faculdade/i.test(nome)
          ? "educacao"
          : "outros",
      valor: numero,
      varia: false,
      dia: 10,
      pagamento: "debito",
      contaId: contas.find((c) => c.tipo !== "vale")?.id,
      desde: comeca,
      ate: total > 0 ? somarMeses(comeca, total - 1) : undefined,
    });
    setIncluido(true);
    mostrarAviso({ texto: `${nome.trim() || "Gasto"} incluído a partir de ${mesCurto(comeca)} ✓` });
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
          {a.veredito !== "nao" && !incluido && (
            <button onClick={incluir} className="botao-gradiente w-full rounded-full py-2.5 text-sm font-semibold">
              Incluir como gasto fixo
              {a.veredito === "depois" && a.aPartirDe ? ` a partir de ${mesCurto(a.aPartirDe)}` : ""}
            </button>
          )}
          {incluido && (
            <p className="text-sm text-entrada">
              <Icone e="✅" /> Incluído nos seus gastos fixos (dá para mudar o dia em Contas).
            </p>
          )}
        </div>
      )}
    </section>
  );
}
