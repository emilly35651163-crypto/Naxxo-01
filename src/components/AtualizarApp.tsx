"use client";

import { useEffect } from "react";
import { mostrarAviso } from "@/lib/avisos";

// O app instalado na tela inicial (principalmente no iPhone) não recarrega sozinho: só "acorda" a versão antiga.
// Aqui ele confere se saiu uma versão nova ao abrir, ao voltar para o app e a cada 10 minutos.
// Se saiu: recarrega na hora; se tiver uma janela aberta (alguém digitando), só avisa com o botão "atualizar".

async function versaoPublicada() {
  try {
    const r = await fetch("/api/versao", { cache: "no-store" });
    return ((await r.json()) as { versao: string }).versao;
  } catch {
    return null; // sem internet: tenta depois
  }
}

export default function AtualizarApp() {
  useEffect(() => {
    let minha: string | null = null;
    let avisou = false;
    async function conferir() {
      const agora = await versaoPublicada();
      if (!agora || agora === "local") return;
      if (!minha) {
        minha = agora;
        return;
      }
      if (agora === minha) return;
      const digitando = !!document.querySelector("[role='dialog']");
      if (!digitando) {
        window.location.reload();
        return;
      }
      if (!avisou) {
        avisou = true;
        mostrarAviso(
          { texto: "Tem uma versão nova do app", link: { texto: "atualizar", href: "#", acao: () => window.location.reload() } },
          15,
        );
      }
    }
    void conferir();
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void conferir();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    const relogio = setInterval(() => void conferir(), 10 * 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
      clearInterval(relogio);
    };
  }, []);
  return null;
}
