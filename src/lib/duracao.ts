// Conversões de duração (sem depender do resto dos dados, para poder ser usado em qualquer lugar).

import type { UnidadeDuracao } from "./store";

export const DIAS_POR_UNIDADE: Record<UnidadeDuracao, number> = { dias: 1, semanas: 7, meses: 30, anos: 365 };

/** Transforma dias na unidade mais natural (21 dias -> 3 semanas, 60 dias -> 2 meses). */
export function melhorUnidade(dias: number): { duracao: number; unidade: UnidadeDuracao } {
  if (dias >= 365 && dias % 365 < 15) return { duracao: Math.round(dias / 365), unidade: "anos" };
  if (dias >= 28 && (dias % 30 < 4 || dias % 30 > 26)) return { duracao: Math.round(dias / 30), unidade: "meses" };
  if (dias >= 7 && dias % 7 === 0) return { duracao: dias / 7, unidade: "semanas" };
  return { duracao: dias, unidade: "dias" };
}
