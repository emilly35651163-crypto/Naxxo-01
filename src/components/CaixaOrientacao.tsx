"use client";

import { useState } from "react";
import { atualizarMeta, type Meta } from "@/lib/store";
import type { Orientacao } from "@/lib/orientacoes";
import { brl } from "@/lib/formato";

// "O que dizem os especialistas": dicas para a meta, com botões para aplicar a sugestão.
export default function CaixaOrientacao({ meta, orientacao }: { meta: Meta; orientacao: Orientacao }) {
  const [aberta, setAberta] = useState(false);
  const jaUsaSugestao =
    orientacao.metaDoMesSugerida !== undefined && Math.abs((meta.aporteMensal ?? 0) - orientacao.metaDoMesSugerida) < 0.5;

  return (
    <div className="mt-4 rounded-2xl border border-roxo/25 bg-roxo/5">
      <button onClick={() => setAberta(!aberta)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm">
        <span>💡</span>
        <span className="flex-1 font-medium">O que dizem os especialistas</span>
        <span className="text-suave">{aberta ? "▴" : "▾"}</span>
      </button>

      {aberta && (
        <div className="space-y-3 px-4 pb-4 text-sm">
          <ul className="space-y-2 text-suave">
            {orientacao.linhas.map((linha) => (
              <li key={linha} className="flex gap-2">
                <span className="text-rosa">•</span>
                <span>{linha}</span>
              </li>
            ))}
          </ul>

          {orientacao.alerta && (
            <p className="rounded-xl bg-amber-300/10 px-3 py-2 text-xs text-amber-300">⚠️ {orientacao.alerta}</p>
          )}

          <div className="flex flex-wrap gap-2">
            {orientacao.metaDoMesSugerida !== undefined && !jaUsaSugestao && (
              <button
                onClick={() => atualizarMeta(meta.id, { aporteMensal: Math.round(orientacao.metaDoMesSugerida! * 100) / 100 })}
                className="rounded-full border border-rosa/50 px-3 py-1.5 text-xs text-rosa hover:bg-rosa/10"
              >
                Usar {brl(orientacao.metaDoMesSugerida)} como meta do mês
              </button>
            )}
            {jaUsaSugestao && <span className="text-xs text-entrada">✓ Meta do mês segue a sugestão</span>}
            {orientacao.alvoSugerido !== undefined && (
              <button
                onClick={() => atualizarMeta(meta.id, { alvo: Math.round(orientacao.alvoSugerido!) })}
                className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-suave hover:text-white"
              >
                Usar {brl(orientacao.alvoSugerido)} como objetivo
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
