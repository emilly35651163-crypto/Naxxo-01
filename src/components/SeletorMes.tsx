"use client";

import { mudarMes, useMes } from "@/lib/store";
import { nomeMes } from "@/lib/formato";

export default function SeletorMes() {
  const mes = useMes();

  return (
    <div className="flex items-center">
      <button
        onClick={() => mudarMes(-1)}
        aria-label="Mês anterior"
        className="grid size-9 place-items-center rounded-full text-2xl text-roxo hover:bg-superficie-2"
      >
        ‹
      </button>
      <span className="min-w-32 text-center font-display text-sm font-semibold">{nomeMes(mes)}</span>
      <button
        onClick={() => mudarMes(1)}
        aria-label="Próximo mês"
        className="grid size-9 place-items-center rounded-full text-2xl text-roxo hover:bg-superficie-2"
      >
        ›
      </button>
    </div>
  );
}
