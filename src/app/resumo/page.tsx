"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Graficos from "./graficos";
import Relatorio from "./relatorio";
import Projecao from "./projecao";
import Icone from "@/components/Icone";
import PadroesEncontrados from "@/components/PadroesEncontrados";
import { useDados } from "@/lib/dados";

const ABAS = [
  { id: "graficos", icone: "📊", nome: "Gráficos" },
  { id: "projecao", icone: "🔮", nome: "Projeção" },
  { id: "relatorio", icone: "📋", nome: "Relatório" },
  { id: "recorrentes", icone: "🔁", nome: "Recorrentes" },
] as const;

type Aba = (typeof ABAS)[number]["id"];

export default function Resumo() {
  return (
    <Suspense>
      <ResumoComAbas />
    </Suspense>
  );
}

// A aba pode vir no endereço (?aba=relatorio), para voltar do detalhe de uma categoria no mesmo lugar
function ResumoComAbas() {
  const daUrl = useSearchParams().get("aba");
  // Mudou a aba no endereço (ex.: link "ver na projeção"): recomeça na aba nova
  return <Abas key={daUrl ?? ""} inicial={ABAS.find((a) => a.id === daUrl)?.id ?? "graficos"} />;
}

function Abas({ inicial }: { inicial: Aba }) {
  const [aba, setAba] = useState<Aba>(inicial);

  return (
    <div className="space-y-6">
      {/* No celular: 4 colunas iguais, ícone em cima do nome (cabem sem rolar); no computador, numa linha */}
      <div className="grid grid-cols-4 gap-1 rounded-2xl bg-superficie p-1 print:hidden sm:rounded-full">
        {ABAS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`flex flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2 text-[0.7rem] leading-tight transition-colors sm:flex-row sm:gap-1.5 sm:rounded-full sm:px-4 sm:text-sm ${
              aba === a.id ? "botao-gradiente font-semibold" : "text-suave hover:text-white"
            }`}
          >
            <Icone e={a.icone} />
            <span>{a.nome}</span>
          </button>
        ))}
      </div>

      {aba === "graficos" && <Graficos />}
      {aba === "projecao" && <Projecao />}
      {aba === "relatorio" && <Relatorio />}
      {aba === "recorrentes" && <Recorrentes />}
    </div>
  );
}

function Recorrentes() {
  return <PadroesEncontrados dados={useDados()} />;
}
