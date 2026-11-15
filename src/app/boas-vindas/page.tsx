"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import simbolo from "@/assets/naxxo-simbolo.png";
import { NomeNaxxo } from "@/components/Logo";
import { lerPerfil, salvarPerfil } from "@/lib/store";
import { usuarioLogado } from "@/lib/nuvem";
import Icone from "@/components/Icone";

// Boas-vindas: 2 telas. O nome (já vem com o usuário do login) e uma tela curta de como o NAXXO funciona.
// Não cria nenhum dado: renda, contas fixas e gastos vêm do extrato do banco.

const DICAS = [
  { icone: "🏦", texto: "Em Contas, importe o extrato do seu banco (OFX, CSV ou PDF). Quanto mais meses, melhor." },
  { icone: "🔁", texto: "Eu acho sozinho o que se repete: salário, contas fixas, assinaturas." },
  { icone: "🧠", texto: "Mudou um nome ou categoria? Eu aprendo e os próximos já chegam assim." },
  { icone: "➕", texto: "Pagou em dinheiro? Use o botão +." },
] as const;

/** "fulana.silva" → "Fulana Silva" */
const nomeDoUsuario = (u: string) =>
  u
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");

export default function BoasVindas() {
  const router = useRouter();
  const [tela, setTela] = useState(0); // 0 = nome; 1 = como funciona
  const [nome, setNome] = useState(() => lerPerfil().nome || nomeDoUsuario(usuarioLogado() ?? ""));
  const total = 2;

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
              placeholder="Seu nome"
              aria-label="Seu nome"
              autoComplete="name"
              className="campo mt-6 text-center text-lg"
            />
          </div>
        ) : (
          <div>
            <h1 className="text-center font-display text-2xl font-bold">Como funciona</h1>
            <ul className="mx-auto mt-6 max-w-md space-y-3">
              {DICAS.map((d) => (
                <li key={d.icone} className="cartao flex items-center gap-3 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rosa/15 text-xl">
                    <Icone e={d.icone} />
                  </span>
                  <span className="text-sm">{d.texto}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={tela === 0 && !nome.trim()}
        className="botao-gradiente mt-8 w-full rounded-full py-3.5 font-semibold disabled:opacity-50"
      >
        {tela === 0 ? "Começar" : "Importar meu extrato"}
      </button>
    </form>
  );
}
