"use client";

import { useEffect, useState } from "react";
import ImportarExtrato from "./ImportarExtrato";
import Icone from "@/components/Icone";

// Botão "Importar extrato" + arrastar o arquivo (dos Downloads) para qualquer lugar da tela.
export default function BotaoImportarExtrato() {
  const [aberto, setAberto] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [arrastando, setArrastando] = useState(false);

  useEffect(() => {
    if (aberto) {
      // Com a janela aberta, quem recebe o arquivo é ela; soltar fora dela não abre o arquivo no navegador
      const segurar = (e: DragEvent) => e.preventDefault();
      window.addEventListener("dragover", segurar);
      window.addEventListener("drop", segurar);
      return () => {
        window.removeEventListener("dragover", segurar);
        window.removeEventListener("drop", segurar);
      };
    }
    const temArquivo = (e: DragEvent) => !!e.dataTransfer?.types.includes("Files");
    const sobre = (e: DragEvent) => {
      if (!temArquivo(e)) return;
      e.preventDefault();
      setArrastando(true);
    };
    const saiu = (e: DragEvent) => {
      // Saiu da janela do navegador
      if (!e.relatedTarget) setArrastando(false);
    };
    const soltou = (e: DragEvent) => {
      const f = e.dataTransfer?.files[0];
      setArrastando(false);
      if (!f) return;
      e.preventDefault();
      setArquivo(f);
      setAberto(true);
    };
    window.addEventListener("dragover", sobre);
    window.addEventListener("dragleave", saiu);
    window.addEventListener("drop", soltou);
    return () => {
      window.removeEventListener("dragover", sobre);
      window.removeEventListener("dragleave", saiu);
      window.removeEventListener("drop", soltou);
    };
  }, [aberto]);

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="w-full rounded-full border border-rosa/50 py-2.5 text-sm font-medium text-rosa hover:bg-rosa/10"
      >
        <Icone e="📥" /> Importar extrato do banco (OFX, CSV ou PDF)
      </button>
      {arrastando && !aberto && (
        <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center bg-fundo/80 backdrop-blur-sm">
          <p className="rounded-3xl border-2 border-dashed border-rosa px-8 py-6 text-lg font-semibold text-rosa">
            <Icone e="📥" /> Solte aqui para importar o extrato
          </p>
        </div>
      )}
      {aberto && (
        <ImportarExtrato
          arquivoInicial={arquivo}
          onFechar={() => {
            setAberto(false);
            setArquivo(null);
          }}
        />
      )}
    </>
  );
}
