"use client";

import { useEffect, useRef, useState } from "react";
import { semEmojis, TextoComIcones } from "@/components/Icone";

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Janela que abre por cima da tela (no celular, sobe de baixo para cima).
// - Se a pessoa já digitou algo, fechar sem querer (Esc, tocar fora, ×) pergunta antes de perder tudo.
// - O Tab fica dentro da janela e a página de trás não rola.
export default function Modal({
  titulo,
  onFechar,
  children,
}: {
  titulo: string;
  onFechar: () => void;
  children: React.ReactNode;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  // Já digitou algo? (ref: muda nos eventos, sem redesenhar a janela a cada tecla)
  const mexeu = useRef(false);
  const fechar = useRef(onFechar);
  const [confirmando, setConfirmando] = useState(false);
  useEffect(() => {
    fechar.current = onFechar;
  }, [onFechar]);

  function tentarFechar() {
    if (mexeu.current) setConfirmando(true);
    else fechar.current();
  }

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const rolagem = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function aoApertarTecla(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (mexeu.current) setConfirmando(true);
        else fechar.current();
      }
      // Prende o Tab dentro da janela
      if (e.key === "Tab" && caixa.current) {
        const itens = [...caixa.current.querySelectorAll<HTMLElement>(FOCAVEIS)];
        if (itens.length === 0) return;
        const primeiro = itens[0];
        const ultimo = itens[itens.length - 1];
        if (e.shiftKey && document.activeElement === primeiro) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primeiro.focus();
        }
      }
    }
    window.addEventListener("keydown", aoApertarTecla);
    // Foca o primeiro campo (se nenhum já pediu foco)
    if (caixa.current && !caixa.current.contains(document.activeElement)) caixa.current.focus();
    return () => {
      window.removeEventListener("keydown", aoApertarTecla);
      document.body.style.overflow = rolagem;
      anterior?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={tentarFechar}
    >
      <div
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-label={semEmojis(titulo)}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onInput={() => (mexeu.current = true)}
        onChange={() => (mexeu.current = true)}
        className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-3xl border border-roxo/25 bg-superficie p-5 outline-none sm:rounded-3xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">
            <TextoComIcones texto={titulo} />
          </h2>
          <button type="button" onClick={tentarFechar} aria-label="Fechar" className="text-2xl text-suave hover:text-white">
            ×
          </button>
        </div>

        {confirmando && (
          <div
            role="alertdialog"
            aria-label="Sair sem salvar?"
            className="mb-4 rounded-2xl border border-amber-300/40 bg-amber-300/10 p-3 text-sm"
          >
            <p className="font-semibold">Sair sem salvar?</p>
            <p className="text-xs text-suave">O que você digitou vai se perder.</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmando(false)}
                className="botao-gradiente flex-1 rounded-full py-2 text-sm font-semibold"
              >
                Continuar editando
              </button>
              <button
                type="button"
                onClick={onFechar}
                className="flex-1 rounded-full border border-white/15 py-2 text-sm text-suave hover:text-white"
              >
                Sair
              </button>
            </div>
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
