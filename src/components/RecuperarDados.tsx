"use client";

import { useState } from "react";
import { restaurarDados } from "@/lib/store";
import { comDesfazer } from "@/lib/avisos";

const CHAVE_BACKUP = "naxxo-backup-antes-da-nuvem";

/** A cópia que o app guardou neste aparelho antes de trazer os dados da nuvem (no primeiro login). */
function lerBackup(): { guardadoEm: string; dados: Record<string, unknown> } | null {
  try {
    const texto = localStorage.getItem(CHAVE_BACKUP);
    return texto ? JSON.parse(texto) : null;
  } catch {
    return null;
  }
}

function contar(v: unknown) {
  return Array.isArray(v) ? v.length : 0;
}

// Recuperar os dados que estavam neste aparelho antes do login (tudo, ou só o mercado).
// O que for recuperado também sobe para a nuvem.
export default function RecuperarDados() {
  const [backup] = useState(lerBackup);
  if (!backup) return null;
  const d = backup.dados;
  const mercado = Object.fromEntries(Object.entries(d).filter(([chave]) => chave.startsWith("naxxo:mercado")));
  const quando = new Date(backup.guardadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  return (
    <section className="cartao border-amber-300/50 p-5">
      <h2 className="mb-2 font-display font-semibold">🛟 Dados de antes do login</h2>
      <p className="text-sm text-suave">
        Encontrei uma cópia do que estava neste aparelho antes de entrar na conta ({quando}):{" "}
        <b className="text-white">
          {contar(d["naxxo:lancamentos"])} lançamentos, {contar(d["naxxo:cartoes"])} contas, {contar(d["naxxo:mercado-itens"])}{" "}
          itens em casa e {contar(d["naxxo:mercado-lista"])} na lista de compras
        </b>
        .
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => comDesfazer("Mercado recuperado ✓", () => restaurarDados(mercado))}
          className="botao-gradiente rounded-full px-4 py-2 text-sm font-semibold"
        >
          Recuperar só o mercado
        </button>
        <button
          onClick={() => comDesfazer("Dados recuperados ✓", () => restaurarDados(d))}
          className="rounded-full border border-rosa/50 px-4 py-2 text-sm text-rosa"
        >
          Recuperar tudo
        </button>
      </div>
      <p className="mt-2 text-xs text-suave">
        O que for recuperado substitui o atual e também vai para a nuvem. Dá para desfazer logo depois.
      </p>
    </section>
  );
}
