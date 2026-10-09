"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import simbolo from "@/assets/naxxo-simbolo.png";
import { NomeNaxxo } from "@/components/Logo";
import { lerPerfil, salvarPerfil } from "@/lib/store";
import Icone from "@/components/Icone";

// Boas-vindas = tutorial (docs/NOVO-SISTEMA.md, seção 8): 5 telas mostrando como o NAXXO funciona.
// Só pergunta o nome (para chamar a pessoa e reconhecer transferências para ela mesma). Não cria nenhum dado:
// renda, contas fixas e gastos vêm do extrato do banco.

const TELAS = [
  {
    icone: "🏦",
    titulo: "Tudo começa pelo extrato",
    texto:
      "Em Contas, cadastre seu banco e importe o extrato (OFX ou CSV, que o app do banco exporta). Mande pelo menos 6 meses: é com eles que o NAXXO aprende como é o seu dinheiro.",
  },
  {
    icone: "🔁",
    titulo: "Eu acho o que se repete",
    texto:
      "Salário (mesmo quando muda todo mês), aluguel, luz, assinaturas, gasolina… Eu encontro sozinho no extrato. Você só confirma o que é fixo e eu faço a previsão do mês.",
  },
  {
    icone: "🧠",
    titulo: "Mude uma vez, vale para sempre",
    texto:
      "Não gostou de um nome ou de uma categoria? Mude, e eu aprendo: os próximos iguais já chegam do seu jeito. O que eu não tiver certeza vai para “Para revisar”, e um toque resolve.",
  },
  {
    icone: "➕",
    titulo: "Pagou em dinheiro? Use o +",
    texto:
      "O botão Novo lançamento serve para o que o banco não mostra (dinheiro vivo) ou para registrar antes do extrato chegar. Quando o extrato vier, eu junto os dois, sem repetir.",
  },
] as const;

export default function BoasVindas() {
  const router = useRouter();
  const [tela, setTela] = useState(0); // 0 = nome; 1..4 = as telas do tutorial
  const [nome, setNome] = useState(() => lerPerfil().nome ?? "");
  const total = TELAS.length + 1;

  function concluir() {
    salvarPerfil({ ...lerPerfil(), nome: nome.trim(), concluido: true });
    router.replace("/contas");
  }

  function avancar(e?: React.FormEvent) {
    e?.preventDefault();
    if (tela === 0 && !nome.trim()) return;
    if (tela < total - 1) setTela(tela + 1);
    else concluir();
  }

  const t = tela > 0 ? TELAS[tela - 1] : null;
  return (
    <form
      onSubmit={avancar}
      className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pb-8 pt-[calc(env(safe-area-inset-top)+1.5rem)]"
    >
      <div className="mb-8 flex h-10 items-center gap-4">
        {tela > 0 && (
          <button
            type="button"
            onClick={() => setTela(tela - 1)}
            aria-label="Voltar"
            className="text-3xl leading-none text-roxo hover:text-rosa"
          >
            ‹
          </button>
        )}
        <div className="flex flex-1 gap-1.5" aria-label={`Passo ${tela + 1} de ${total}`}>
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= tela ? "bg-rosa" : "bg-white/10"}`} />
          ))}
        </div>
        {tela > 0 && (
          <button type="button" onClick={concluir} className="text-sm text-suave hover:text-rosa">
            Pular
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-center">
        {tela === 0 ? (
          <div className="text-center">
            <Image src={simbolo} alt="" className="mx-auto h-20 w-auto drop-shadow-[0_0_30px_rgb(255_78_216/0.5)]" priority />
            <NomeNaxxo className="mx-auto mt-5 h-5 w-auto" />
            <h1 className="mt-8 font-display text-2xl font-bold">Como posso te chamar?</h1>
            <input
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome e sobrenome"
              aria-label="Seu nome"
              autoComplete="name"
              className="campo mt-6 text-center text-lg"
            />
            <p className="mt-2 text-xs text-suave">
              Com o sobrenome, eu reconheço quando você manda dinheiro para você mesma (não é gasto).
            </p>
          </div>
        ) : (
          t && (
            <div className="text-center">
              <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-rosa/15 text-4xl">
                <Icone e={t.icone} />
              </span>
              <h1 className="mt-6 font-display text-2xl font-bold">{t.titulo}</h1>
              <p className="mx-auto mt-3 max-w-md text-suave">{t.texto}</p>
            </div>
          )
        )}
      </div>

      <button
        type="submit"
        disabled={tela === 0 && !nome.trim()}
        className="botao-gradiente mt-8 w-full rounded-full py-3.5 font-semibold disabled:opacity-50"
      >
        {tela === 0 ? "Começar" : tela < total - 1 ? "Próximo" : "Ir para Contas e importar o extrato"}
      </button>
    </form>
  );
}
