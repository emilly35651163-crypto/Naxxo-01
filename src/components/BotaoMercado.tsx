"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Computador: botão redondo do carrinho no canto inferior direito (no celular, o carrinho fica no topo).
export default function BotaoMercado() {
  const caminho = usePathname();
  const ativo = caminho === "/mercado";

  return (
    <Link
      href="/mercado"
      aria-label="Mercado"
      className={`group fixed bottom-8 right-8 z-20 hidden h-14 items-center rounded-full pl-4 pr-4 shadow-[0_8px_30px_rgb(255_78_216/0.45)] transition-all duration-300 hover:pr-5 lg:flex print:hidden ${
        ativo ? "botao-gradiente ring-2 ring-white/70" : "botao-gradiente"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-6 shrink-0 fill-none stroke-white stroke-2 [stroke-linecap:round] [stroke-linejoin:round]"
        aria-hidden
      >
        <path d="M3 4h2.2l2.3 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6.2" />
        <circle cx="9.5" cy="20" r="1.3" />
        <circle cx="17" cy="20" r="1.3" />
      </svg>
      <span className="max-w-0 overflow-hidden whitespace-nowrap font-semibold opacity-0 transition-all duration-300 group-hover:ml-2 group-hover:max-w-24 group-hover:opacity-100 group-focus-visible:ml-2 group-focus-visible:max-w-24 group-focus-visible:opacity-100">
        Mercado
      </span>
    </Link>
  );
}
