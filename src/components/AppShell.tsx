"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCartoes, useFontes, usePerfil, usePreferencias } from "@/lib/store";
import { registrarRendaQueJaCaiu } from "@/lib/rendaAutomatica";
import { useLembretes } from "@/lib/lembretes";
import { useEstadoNuvem } from "@/lib/nuvem";
import { temaPorId } from "@/lib/temas";
import Logo from "./Logo";
import SeletorMes from "./SeletorMes";
import NavInferior, { ITENS_MENU, itemAtivo } from "./NavInferior";
import BarraLateral from "./BarraLateral";
import FormLancamento from "./FormLancamento";
import Avisos from "./Avisos";
import AtualizarApp from "./AtualizarApp";
import Icone from "./Icone";

/** O tema escolhido em Configurações ("auto" segue o celular/computador). */
function useTema() {
  const { tema } = usePreferencias();
  useEffect(() => {
    const raiz = document.documentElement;
    const midia = window.matchMedia("(prefers-color-scheme: light)");
    const aplicar = () => {
      // base: letras claras (escuro) ou escuras (claro); paleta: a cor e o estilo do tema (NAXXO não tem paleta)
      const escolhido = temaPorId(tema);
      raiz.dataset.tema = tema === "auto" || !escolhido ? (midia.matches ? "claro" : "escuro") : escolhido.base;
      if (escolhido && escolhido.cor !== "NAXXO") raiz.dataset.paleta = escolhido.id;
      else delete raiz.dataset.paleta;
    };
    aplicar();
    midia.addEventListener("change", aplicar);
    return () => midia.removeEventListener("change", aplicar);
  }, [tema]);
}

// A "moldura" de todas as telas.
// Celular: topo com logo, nome da página e mês; conteúdo no meio; menu embaixo.
// Computador: menu na barra lateral à esquerda e conteúdo largo à direita.
export default function AppShell({ children }: { children: React.ReactNode }) {
  const [novoAberto, setNovoAberto] = useState(false);
  const caminho = usePathname();
  const router = useRouter();
  const perfil = usePerfil();
  const emBoasVindas = caminho === "/boas-vindas";
  const emEntrar = caminho === "/entrar";
  // Painel de controle (localhost): tela própria, sem o app em volta
  const emPainel = caminho === "/painel";
  // Com a nuvem ligada: primeiro entrar e trazer os dados; só depois decidir se vai para o questionário
  const nuvem = useEstadoNuvem();
  const dadosProntos = nuvem === "pronto";
  const pagina = ITENS_MENU.find((item) => item.href === itemAtivo(caminho)) ?? undefined;
  useTema();
  useLembretes(!!perfil?.concluido);

  // Título da aba do navegador: "Trilha · NAXXO Finanças"
  const rotulo = pagina?.rotulo;
  useEffect(() => {
    document.title =
      rotulo && caminho !== "/" ? `${rotulo} · NAXXO Finanças` : emBoasVindas ? "Boas-vindas · NAXXO Finanças" : "NAXXO Finanças";
  }, [rotulo, caminho, emBoasVindas]);

  // Sem login (nuvem ligada): vai para a tela de entrar
  useEffect(() => {
    if (nuvem === "fora" && !emEntrar) router.replace("/entrar");
  }, [nuvem, emEntrar, router]);

  // Quem ainda não respondeu o questionário vai primeiro para as boas-vindas
  useEffect(() => {
    if (dadosProntos && perfil && !perfil.concluido && !emBoasVindas && !emEntrar) router.replace("/boas-vindas");
  }, [dadosProntos, perfil, emBoasVindas, emEntrar, router]);

  // Renda: o que já passou do dia já caiu (registra sozinho, uma vez só). Roda ao abrir e quando a renda ou as contas mudam.
  const fontes = useFontes();
  const contas = useCartoes();
  const pronto = dadosProntos && !!perfil?.concluido;
  useEffect(() => {
    if (pronto) registrarRendaQueJaCaiu();
  }, [pronto, fontes, contas]);

  if (emPainel) return <>{children}</>;

  // Entrar e o questionário ocupam a tela inteira, sem menu
  if (emEntrar || (emBoasVindas && dadosProntos))
    return (
      <>
        {children}
        <Avisos />
        <AtualizarApp />
      </>
    );

  // Enquanto carrega (ou enquanto vai para as boas-vindas): o logo, em vez de uma tela vazia
  if (!dadosProntos || !perfil?.concluido)
    return (
      <div className="grid min-h-dvh place-items-center" aria-busy="true" aria-label="Carregando">
        <div className="flex flex-col items-center gap-4 motion-safe:animate-pulse">
          <Logo comNome />
          <div className="h-2 w-40 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/2 rounded-full bg-linear-to-r from-rosa via-roxo to-azul" />
          </div>
        </div>
      </div>
    );

  return (
    <div className="min-h-dvh lg:flex">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-superficie focus:px-4 focus:py-2"
      >
        Pular para o conteúdo
      </a>
      <BarraLateral />

      <div className="mx-auto flex min-h-dvh w-full min-w-0 max-w-lg flex-col px-4 lg:max-w-6xl lg:px-10">
        <header className="topo sticky top-0 z-10 -mx-4 px-4 py-3 backdrop-blur print:hidden lg:-mx-10 lg:px-10 lg:py-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3 lg:hidden">
              <Logo />
              <h1 className="truncate font-display text-lg font-semibold">{pagina?.rotulo}</h1>
            </div>
            <h1 className="hidden font-display text-2xl font-semibold lg:block">{pagina?.rotulo}</h1>

            {pagina?.usaMes && (
              <div className="hidden lg:block">
                <SeletorMes />
              </div>
            )}

            <div className="flex shrink-0 items-center gap-2">
              {/* Configurações e Mercado ficam aqui em cima, ao lado do + */}
              <Link
                href="/configuracoes"
                aria-label="Configurações"
                aria-current={caminho === "/configuracoes" ? "page" : undefined}
                className={`grid size-10 place-items-center rounded-full border text-lg ${caminho === "/configuracoes" ? "border-rosa bg-rosa/15" : "border-roxo/30 bg-superficie"}`}
              >
                <Icone e="⚙️" />
              </Link>
              <Link
                href="/mercado"
                aria-label="Mercado"
                aria-current={caminho === "/mercado" ? "page" : undefined}
                className={`grid size-10 place-items-center rounded-full border text-lg ${caminho === "/mercado" ? "border-rosa bg-rosa/15" : "border-roxo/30 bg-superficie"}`}
              >
                <Icone e="🛒" />
              </Link>
              <button
                onClick={() => setNovoAberto(true)}
                aria-label="Novo lançamento"
                className="botao-gradiente flex size-10 items-center justify-center gap-2 rounded-full text-2xl leading-none lg:h-11 lg:w-auto lg:px-5 lg:text-sm lg:font-semibold"
              >
                <span className="lg:text-xl">+</span>
                <span className="hidden lg:inline">Novo lançamento</span>
              </button>
            </div>
          </div>
          {/* Celular: o mês fica numa linha própria, embaixo do nome da página */}
          {pagina?.usaMes && (
            <div className="mt-1 flex justify-center lg:hidden">
              <SeletorMes />
            </div>
          )}
        </header>

        <main id="conteudo" className="flex-1 pb-32 pt-2 lg:pb-28">
          {children}
        </main>
      </div>

      <NavInferior />
      <Avisos />
      <AtualizarApp />
      {novoAberto && <FormLancamento onFechar={() => setNovoAberto(false)} />}
    </div>
  );
}
