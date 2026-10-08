"use client";

import { mudarPreferencias, usePreferencias } from "@/lib/store";
import { TEMAS, type Tema } from "@/lib/temas";

// Escolher o tema: agrupado por cor, cada um com uma prévia (fundo, cartão, botão e letras de verdade).
export default function SeletorTema() {
  const { tema } = usePreferencias();
  const grupos = [...new Set(TEMAS.map((t) => t.cor))];

  return (
    <div className="space-y-4">
      {grupos.map((cor) => (
        <div key={cor} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-suave">{cor}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TEMAS.filter((t) => t.cor === cor).map((t) => (
              <CartaoTema key={t.id} tema={t} ativo={tema === t.id} onEscolher={() => mudarPreferencias({ tema: t.id })} />
            ))}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => mudarPreferencias({ tema: "auto" })}
        aria-pressed={tema === "auto"}
        className={`w-full rounded-2xl border px-4 py-2.5 text-left text-sm ${
          tema === "auto" ? "border-rosa bg-rosa/10" : "border-white/10 text-suave hover:text-white"
        }`}
      >
        {tema === "auto" && "✓ "}Automático: NAXXO escuro ou claro, seguindo o celular
      </button>
    </div>
  );
}

function CartaoTema({ tema: t, ativo, onEscolher }: { tema: Tema; ativo: boolean; onEscolher: () => void }) {
  const p = t.previa;
  return (
    <button
      type="button"
      onClick={onEscolher}
      aria-pressed={ativo}
      className={`overflow-hidden rounded-2xl border text-left transition-colors ${
        ativo ? "border-rosa ring-2 ring-rosa/40" : "border-white/10 hover:border-white/30"
      }`}
    >
      {/* A prévia: fundo, um cartãozinho com texto e o botão do tema */}
      <span className="block h-20 p-2" style={{ background: p.fundo }} aria-hidden>
        <span className="block rounded-lg p-2" style={{ background: p.cartao, color: p.texto }}>
          <span className="block text-[0.6rem] opacity-70">Saldo</span>
          <span className="block text-xs font-bold">R$ 1.250</span>
        </span>
        <span className="mt-1.5 block h-2 w-2/3 rounded-full" style={{ background: p.destaque }} />
      </span>
      <span className="block px-2.5 py-2">
        <span className="block text-sm font-semibold">
          {ativo && "✓ "}
          {t.nome}
        </span>
        <span className="block text-[0.65rem] text-suave">
          {t.base === "escuro" ? "🌙 Escuro" : "☀️ Claro"} · {t.estilo === "tematico" ? "Temático" : "Sóbrio"}
        </span>
        <span className="block text-[0.65rem] text-suave">{t.descricao}</span>
      </span>
    </button>
  );
}
