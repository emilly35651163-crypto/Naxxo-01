"use client";

import { useState } from "react";
import { mudarPreferencias, usePreferencias } from "@/lib/store";
import { BOLINHA_AUTO, GRUPOS_TEMA, TEMAS, temaPorId, type EscolhaTema } from "@/lib/temas";

// "Temas" em Configurações: fechado, mostra o tema atual. Aberto, as cores (Oficial NAXXO, Azul…);
// tocando numa cor, aparecem só as bolinhas das versões dela (escuro, claro, temáticos).
export default function SeletorTema() {
  const { tema } = usePreferencias();
  const atual = temaPorId(tema);
  const [aberto, setAberto] = useState(false);
  const [grupo, setGrupo] = useState(atual?.cor ?? "NAXXO");

  const versoes = TEMAS.filter((t) => t.cor === grupo);

  function escolher(id: EscolhaTema) {
    mudarPreferencias({ tema: id });
  }
  const nomeAtual = tema === "auto" ? "Automático" : (atual?.nome ?? "NAXXO escuro");

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        aria-expanded={aberto}
        className="flex w-full items-center gap-3 rounded-2xl border border-white/10 px-4 py-3 text-left hover:border-white/25"
      >
        <span
          className="size-7 shrink-0 rounded-full border border-white/20"
          style={{ background: tema === "auto" ? BOLINHA_AUTO : (atual?.bolinha ?? TEMAS[0].bolinha) }}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Temas</span>
          <span className="block text-xs text-suave">{nomeAtual}</span>
        </span>
        <span className="text-sm text-rosa">{aberto ? "fechar ▴" : "trocar ▾"}</span>
      </button>

      {aberto && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Cores">
            {GRUPOS_TEMA.map((g) => (
              <button
                key={g.cor}
                type="button"
                role="tab"
                aria-selected={grupo === g.cor}
                onClick={() => setGrupo(g.cor)}
                className={`rounded-full border px-4 py-1.5 text-sm ${
                  grupo === g.cor ? "border-rosa bg-rosa/15 font-semibold" : "border-white/10 text-suave hover:text-white"
                }`}
              >
                {g.nome}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-4 px-1">
            {versoes.map((t) => (
              <Bolinha
                key={t.id}
                fundo={t.bolinha}
                nome={t.estilo === "tematico" ? t.nome : t.base === "escuro" ? "Escuro" : "Claro"}
                ativo={tema === t.id}
                onClick={() => escolher(t.id)}
              />
            ))}
            {grupo === "NAXXO" && (
              <Bolinha fundo={BOLINHA_AUTO} nome="Automático" ativo={tema === "auto"} onClick={() => escolher("auto")} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Bolinha({ fundo, nome, ativo, onClick }: { fundo: string; nome: string; ativo: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      aria-label={nome}
      className="flex w-16 flex-col items-center gap-1.5"
    >
      <span
        className={`size-12 rounded-full border shadow-md transition-transform ${
          ativo ? "scale-110 border-transparent ring-2 ring-rosa ring-offset-2 ring-offset-superficie" : "border-white/20"
        }`}
        style={{ background: fundo }}
        aria-hidden
      />
      <span className={`text-center text-[0.65rem] leading-tight ${ativo ? "font-semibold" : "text-suave"}`}>{nome}</span>
    </button>
  );
}
