"use client";

import { removerRegra, useRegras } from "@/lib/store";
import { comDesfazer } from "@/lib/avisos";

// Configurações → "Coisas que o NAXXO aprendeu": as regras criadas quando a pessoa mudou nome/categoria de algo do extrato.
export default function RegrasAprendidas() {
  const regras = useRegras().filter((r) => r.nome || r.categoria || r.variada);

  if (regras.length === 0)
    return (
      <p className="text-sm text-suave">
        Ainda nada. Quando você muda o nome ou a categoria de algo que veio do extrato, o NAXXO aprende e os próximos já vêm
        do seu jeito.
      </p>
    );

  return (
    <ul className="divide-y divide-white/5">
      {regras.map((r) => {
        const [tipo, chave] = r.chave.split("|");
        return (
          <li key={r.id} className="flex items-center gap-3 py-2.5">
            <span className="min-w-0 flex-1 text-sm">
              <span className="block truncate text-xs text-suave">
                {tipo === "entrada" ? "Entrada" : "Saída"} · “{chave}”
              </span>
              {r.variada ? (
                <span className="block">Loja com coisas diferentes: você escolhe cada vez</span>
              ) : (
                <span className="block">
                  vira <b>{r.nome}</b>
                  {r.categoria && (
                    <span className="text-suave">
                      {" "}
                      em {r.categoria}
                      {r.subcategoria ? ` › ${r.subcategoria}` : ""}
                    </span>
                  )}
                </span>
              )}
            </span>
            <button
              onClick={() => comDesfazer("Regra apagada", () => removerRegra(r.id))}
              className="shrink-0 text-xs text-suave hover:text-saida"
            >
              apagar
            </button>
          </li>
        );
      })}
    </ul>
  );
}
