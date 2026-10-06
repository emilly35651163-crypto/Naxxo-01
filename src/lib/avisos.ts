"use client";

// Avisos rápidos no canto da tela ("Salvo ✓", "Excluído · Desfazer").
// Excluir não pergunta mais "tem certeza?": exclui na hora e dá 6 segundos para desfazer.

import { useSyncExternalStore } from "react";
import { fotografarDados, restaurarDados } from "./store";

export type Aviso = {
  id: number;
  texto: string;
  tipo?: "ok" | "erro";
  desfazer?: () => void;
  link?: { texto: string; href?: string; acao?: () => void };
};

let avisos: Aviso[] = [];
let proximoId = 1;
const ouvintes = new Set<() => void>();
const SEM_AVISOS: Aviso[] = [];

function mudar(novos: Aviso[]) {
  avisos = novos;
  ouvintes.forEach((o) => o());
}

export function useAvisos() {
  return useSyncExternalStore(
    (o) => {
      ouvintes.add(o);
      return () => ouvintes.delete(o);
    },
    () => avisos,
    () => SEM_AVISOS,
  );
}

export function fecharAviso(id: number) {
  mudar(avisos.filter((a) => a.id !== id));
}

/** Mostra um aviso por alguns segundos. */
export function mostrarAviso(aviso: Omit<Aviso, "id">, segundos = aviso.desfazer ? 6 : 3.5) {
  const id = proximoId++;
  mudar([...avisos.slice(-2), { ...aviso, id }]);
  setTimeout(() => fecharAviso(id), segundos * 1000);
  return id;
}

/**
 * Faz uma mudança (ex.: excluir) e mostra o aviso com "Desfazer".
 * Desfazer volta todos os dados como estavam antes, inclusive o que foi mexido junto (meta, fatura…).
 */
export function comDesfazer(texto: string, acao: () => void) {
  const antes = fotografarDados();
  acao();
  mostrarAviso({ texto, desfazer: () => restaurarDados(antes) });
}
