"use client";

import Link from "next/link";
import { ITENS_MAIS } from "@/components/NavInferior";

// "Mais" (celular): as páginas que não cabem no menu de baixo.
export default function Mais() {
  return (
    <ul className="cartao divide-y divide-white/5 px-4">
      {ITENS_MAIS.map((item) => (
        <li key={item.href}>
          <Link href={item.href} className="group flex items-center gap-4 py-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-superficie-2 text-rosa">{item.icone}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold group-hover:text-rosa">{item.rotulo}</span>
              {item.descricao && <span className="block text-xs text-suave">{item.descricao}</span>}
            </span>
            <span className="text-suave group-hover:text-rosa" aria-hidden>
              ›
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
