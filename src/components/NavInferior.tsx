"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONE = "size-5 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]";

export type ItemMenu = { href: string; rotulo: string; usaMes: boolean; icone: React.ReactNode; descricao?: string };

// Todas as páginas. Usado na barra lateral (computador), na tela "Mais" e para o título de cada página.
// "usaMes": a página muda conforme o mês escolhido no topo (‹ Outubro 2026 ›).
export const ITENS_MENU: ItemMenu[] = [
  {
    href: "/",
    rotulo: "Início",
    usaMes: true,
    icone: (
      <svg viewBox="0 0 24 24" className={ICONE} aria-hidden>
        <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
      </svg>
    ),
  },
  {
    href: "/lancamentos",
    rotulo: "Lançamentos",
    usaMes: true,
    icone: (
      <svg viewBox="0 0 24 24" className={ICONE} aria-hidden>
        <path d="M4 7h14l-3-3M20 17H6l3 3" />
      </svg>
    ),
  },
  {
    href: "/contas",
    rotulo: "Contas",
    usaMes: true,
    // Prédio de banco (diferente do ícone da Renda)
    icone: (
      <svg viewBox="0 0 24 24" className={ICONE} aria-hidden>
        <path d="M3 9.5L12 4l9 5.5M4.5 10v8M9.5 10v8M14.5 10v8M19.5 10v8M3 20.5h18" />
      </svg>
    ),
  },
  {
    href: "/trilha",
    rotulo: "Trilha",
    usaMes: false,
    icone: (
      <svg viewBox="0 0 24 24" className={ICONE} aria-hidden>
        <path d="M5 21V4M5 4h11l-2 3.5L16 11H5" />
        <path d="M9 21c0-3 6-3 6-6s-3-2.5-3-2.5" strokeDasharray="2 2.5" />
      </svg>
    ),
  },
  {
    href: "/fixos",
    rotulo: "Fixos",
    usaMes: true,
    descricao: "Aluguel, contas da casa, assinaturas",
    icone: (
      <svg viewBox="0 0 24 24" className={ICONE} aria-hidden>
        <rect x="4" y="5" width="16" height="16" rx="2.5" />
        <path d="M4 10h16M9 3v4M15 3v4M8.5 15l2 2 4-4" />
      </svg>
    ),
  },
  {
    href: "/renda",
    rotulo: "Renda",
    usaMes: true,
    descricao: "Salário, freelas, benefícios",
    // Moedas com seta entrando
    icone: (
      <svg viewBox="0 0 24 24" className={ICONE} aria-hidden>
        <ellipse cx="9" cy="7" rx="5" ry="2.5" />
        <path d="M4 7v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V7M4 11v4c0 1.4 2.2 2.5 5 2.5 1 0 1.9-.1 2.7-.4M19 10v8M16 15l3 3 3-3" />
      </svg>
    ),
  },
  {
    href: "/resumo",
    rotulo: "Resumo",
    usaMes: true,
    descricao: "Gráficos, projeção e relatório",
    icone: (
      <svg viewBox="0 0 24 24" className={ICONE} aria-hidden>
        <path d="M4 20h16M7 16v-4M12 16V7M17 16v-7" />
      </svg>
    ),
  },
  {
    href: "/mercado",
    rotulo: "Mercado",
    usaMes: true,
    descricao: "Lista, despensa e compra do mês",
    icone: (
      <svg viewBox="0 0 24 24" className={ICONE} aria-hidden>
        <path d="M3 4h2.2l2.3 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6.2" />
        <circle cx="9.5" cy="20" r="1.3" />
        <circle cx="17" cy="20" r="1.3" />
      </svg>
    ),
  },
  {
    href: "/configuracoes",
    rotulo: "Configurações",
    usaMes: false,
    descricao: "Backup, tema, categorias, lembretes",
    icone: (
      <svg viewBox="0 0 24 24" className={ICONE} aria-hidden>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </svg>
    ),
  },
];

/** Páginas que não estão no menu de baixo: ficam na tela "Mais". */
export const ITENS_MAIS = ITENS_MENU.filter((i) =>
  ["/fixos", "/renda", "/resumo", "/mercado", "/configuracoes"].includes(i.href),
);

const ICONE_MAIS = (
  <svg viewBox="0 0 24 24" className={ICONE} aria-hidden>
    <circle cx="5" cy="12" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="19" cy="12" r="1.5" />
  </svg>
);

/** Em qual item do menu a página está (o detalhe de uma categoria é do Resumo). */
export function itemAtivo(caminho: string) {
  if (caminho.startsWith("/resumo")) return "/resumo";
  return caminho;
}

// Menu de baixo (celular): 5 itens, sempre com o nome. O resto fica em "Mais".
export default function NavInferior() {
  const caminho = itemAtivo(usePathname());
  const noMais = caminho === "/mais" || ITENS_MAIS.some((i) => i.href === caminho);
  const itens = [
    ...ITENS_MENU.filter((i) => ["/", "/lancamentos", "/contas", "/trilha"].includes(i.href)),
    { href: "/mais", rotulo: "Mais", usaMes: false, icone: ICONE_MAIS },
  ];

  return (
    <nav
      aria-label="Menu principal"
      className="fixed inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] print:hidden lg:hidden"
    >
      <div className="mx-auto flex max-w-lg gap-1 rounded-3xl border border-roxo/25 bg-superficie/95 p-1.5 backdrop-blur">
        {itens.map((item) => {
          const ativo = item.href === "/mais" ? noMais : caminho === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={ativo ? "page" : undefined}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl py-1.5 text-[0.68rem] transition-colors ${
                ativo ? "bg-superficie-2 font-semibold text-rosa" : "text-suave hover:text-white"
              }`}
            >
              {item.icone}
              <span className="max-w-full truncate px-0.5">{item.rotulo}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
