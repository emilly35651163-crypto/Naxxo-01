"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Icone from "@/components/Icone";

// "Instalar o app": no Android/computador o navegador instala com um toque; no iPhone é pelo Safari (Compartilhar →
// Adicionar à Tela de Início), então mostramos o passo a passo. Some quando o app já está instalado.

type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let eventoGuardado: EventoInstalar | null = null;
const ouvintes = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // guarda para o nosso botão
    eventoGuardado = e as EventoInstalar;
    ouvintes.forEach((o) => o());
  });
  window.addEventListener("appinstalled", () => {
    eventoGuardado = null;
    ouvintes.forEach((o) => o());
  });
}
const inscrever = (o: () => void) => {
  ouvintes.add(o);
  return () => ouvintes.delete(o);
};

const CHAVE_FECHADO = "naxxo:instalar-fechado";

function jaInstalado() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function InstalarApp({ fechavel = false }: { fechavel?: boolean }) {
  const evento = useSyncExternalStore(
    inscrever,
    () => eventoGuardado,
    () => null,
  );
  // Só no navegador (no servidor não dá para saber o aparelho)
  const [aparelho, setAparelho] = useState<{ instalado: boolean; ios: boolean; safari: boolean; fechado: boolean } | null>(null);
  const [passos, setPassos] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
    let fechado = false;
    try {
      fechado = localStorage.getItem(CHAVE_FECHADO) === "1";
    } catch {}
    const t = setTimeout(
      () =>
        setAparelho({
          instalado: jaInstalado(),
          ios,
          safari: ios && !/crios|fxios|edgios|instagram|fban|fbav/i.test(ua),
          fechado,
        }),
      0,
    );
    return () => clearTimeout(t);
  }, []);

  if (!aparelho || aparelho.instalado || (fechavel && aparelho.fechado)) return null;

  async function instalar() {
    if (evento) {
      await evento.prompt();
      await evento.userChoice;
      eventoGuardado = null;
      ouvintes.forEach((o) => o());
    } else setPassos(true);
  }

  function fechar() {
    try {
      localStorage.setItem(CHAVE_FECHADO, "1");
    } catch {}
    setAparelho((a) => a && { ...a, fechado: true });
  }

  return (
    <section className="cartao space-y-3 border-rosa/40 p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">
          <Icone e="📲" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Instale o NAXXO no celular</p>
          <p className="text-xs text-suave">Abre como um app, com ícone na tela inicial e sem a barra do navegador.</p>
        </div>
        {fechavel && (
          <button type="button" onClick={fechar} aria-label="Agora não" className="text-xl text-suave hover:text-white">
            ×
          </button>
        )}
      </div>

      {!passos && (
        <button
          type="button"
          onClick={() => void instalar()}
          className="botao-gradiente w-full rounded-full py-2.5 text-sm font-semibold"
        >
          {evento ? "Instalar o app" : "Como instalar"}
        </button>
      )}

      {passos && (
        <ol className="list-decimal space-y-1.5 pl-5 text-sm">
          {aparelho.ios ? (
            <>
              {!aparelho.safari && (
                <li>
                  Abra <b>naxxo.com.br</b> no <b>Safari</b> (no iPhone, só o Safari instala).
                </li>
              )}
              <li>
                Toque em <b>Compartilhar</b>{" "}
                <span aria-hidden>
                  <Icone e="⬆️" />
                </span>{" "}
                (o quadrado com a seta, embaixo ou no topo).
              </li>
              <li>
                Role e toque em <b>Adicionar à Tela de Início</b>{" "}
                <span aria-hidden>
                  <Icone e="➕" />
                </span>
                .
              </li>
              <li>
                Toque em <b>Adicionar</b>. O ícone do NAXXO aparece na tela inicial.
              </li>
            </>
          ) : (
            <>
              <li>
                Abra <b>naxxo.com.br</b> no <b>Chrome</b>.
              </li>
              <li>
                Toque nos <b>três pontinhos</b> ⋮ no canto de cima.
              </li>
              <li>
                Toque em <b>Instalar app</b> (ou <b>Adicionar à tela inicial</b>).
              </li>
            </>
          )}
        </ol>
      )}
    </section>
  );
}
