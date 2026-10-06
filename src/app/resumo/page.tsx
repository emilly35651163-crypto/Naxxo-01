"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Graficos from "./graficos";
import Relatorio from "./relatorio";
import Projecao from "./projecao";

const ABAS = [
  { id: "graficos", nome: "📊 Gráficos" },
  { id: "projecao", nome: "🔮 Projeção" },
  { id: "relatorio", nome: "📋 Relatório" },
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
      <div className="flex gap-1 overflow-x-auto rounded-full bg-superficie p-1 print:hidden">
        {ABAS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`flex-1 whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors ${
              aba === a.id ? "botao-gradiente font-semibold" : "text-suave hover:text-white"
            }`}
          >
            {a.nome}
          </button>
        ))}
      </div>

      {aba === "graficos" && <Graficos />}
      {aba === "projecao" && <Projecao />}
      {aba === "relatorio" && <Relatorio />}
    </div>
  );
}
