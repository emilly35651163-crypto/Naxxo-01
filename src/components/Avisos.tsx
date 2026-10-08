"use client";

import Link from "next/link";
import { fecharAviso, useAvisos } from "@/lib/avisos";
import { TextoComIcones } from "@/components/Icone";

// Os avisos rápidos ("Salvo ✓", "Excluído · Desfazer"), em cima do menu de baixo.
export default function Avisos() {
  const avisos = useAvisos();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6"
    >
      {avisos.map((a) => (
        <div
          key={a.id}
          role="status"
          className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border px-4 py-3 text-sm shadow-xl ${
            a.tipo === "erro" ? "border-saida/50 bg-superficie text-saida" : "border-roxo/40 bg-superficie-2"
          }`}
        >
          <span className="min-w-0 flex-1">
            <TextoComIcones texto={a.texto} />
          </span>
          {a.link &&
            (a.link.href ? (
              <Link
                href={a.link.href}
                onClick={() => {
                  a.link?.acao?.();
                  fecharAviso(a.id);
                }}
                className="shrink-0 font-semibold text-rosa"
              >
                {a.link.texto}
              </Link>
            ) : (
              <button
                onClick={() => {
                  a.link?.acao?.();
                  fecharAviso(a.id);
                }}
                className="shrink-0 font-semibold text-rosa"
              >
                {a.link.texto}
              </button>
            ))}
          {a.desfazer && (
            <button
              onClick={() => {
                a.desfazer?.();
                fecharAviso(a.id);
              }}
              className="shrink-0 font-semibold text-rosa"
            >
              Desfazer
            </button>
          )}
          <button onClick={() => fecharAviso(a.id)} aria-label="Fechar aviso" className="shrink-0 text-suave hover:text-white">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
