"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";
import { ITENS_LATERAL, itemAtivo } from "./NavInferior";

// Menu da esquerda, só aparece em telas largas (computador / tablet deitado).
export default function BarraLateral() {
  const caminho = itemAtivo(usePathname());

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-roxo/15 bg-superficie/50 px-5 py-6 backdrop-blur print:hidden lg:flex">
      <Link href="/" className="mb-10 px-2">
        <Logo comNome />
      </Link>

      <nav aria-label="Menu principal" className="flex flex-col gap-1 overflow-y-auto">
        {ITENS_LATERAL.map((item) => {
          const ativo = caminho === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={ativo ? "page" : undefined}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-colors ${
                ativo
                  ? "bg-superficie-2 font-semibold text-white shadow-[inset_3px_0_0_var(--color-rosa)]"
                  : "text-suave hover:bg-superficie-2/50 hover:text-white"
              }`}
            >
              <span className={ativo ? "text-rosa" : ""}>{item.icone}</span>
              {item.rotulo}
            </Link>
          );
        })}
      </nav>

      <p className="mt-auto px-2 text-[0.65rem] uppercase tracking-[0.25em] text-suave/70">
        Seu dinheiro,
        <br />
        no seu ritmo
      </p>
    </aside>
  );
}
