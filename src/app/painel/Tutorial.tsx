"use client";

import { useState } from "react";
import Icone from "@/components/Icone";

// Passo a passo para ligar o painel, com o que já está pronto marcado.
// etapa: onde parou ("sem-chave" → passos 1 e 2; "chave-recusada" → passo 2; "sem-permissao" → passo 4; "pronto").

export type Etapa = "sem-chave" | "chave-recusada" | "sem-permissao" | "pronto";

const PROJETO = "jwxzfuuebrhbcqokxxmi";
const LINHA_ENV = "SUPABASE_SECRET_KEY=";
const SQL = "grant select on public.dados to service_role;";

function Copiar({ texto }: { texto: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(texto);
        setOk(true);
        setTimeout(() => setOk(false), 1500);
      }}
      className="shrink-0 rounded-full border border-rosa/50 px-3 py-1 text-xs text-rosa hover:bg-rosa/10"
    >
      {ok ? "copiado ✓" : "copiar"}
    </button>
  );
}

function Passo({
  n,
  estado,
  titulo,
  children,
}: {
  n: number;
  estado: "feito" | "agora" | "depois";
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <li className={`flex gap-4 rounded-2xl border p-4 ${estado === "agora" ? "border-rosa/60 bg-rosa/5" : "border-white/10"}`}>
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
          estado === "feito" ? "bg-entrada text-fundo" : estado === "agora" ? "bg-rosa text-white" : "bg-white/10 text-suave"
        }`}
      >
        {estado === "feito" ? "✓" : n}
      </span>
      <div className={`min-w-0 flex-1 space-y-2 text-sm ${estado === "depois" ? "opacity-60" : ""}`}>
        <p className="font-semibold">
          {titulo}
          {estado === "agora" && (
            <span className="ml-2 rounded-full bg-rosa/20 px-2 py-0.5 text-xs text-rosa">você está aqui</span>
          )}
        </p>
        {estado !== "feito" && children}
      </div>
    </li>
  );
}

export default function Tutorial({ etapa, onTestar, testando }: { etapa: Etapa; onTestar: () => void; testando: boolean }) {
  const estado = (passo: number): "feito" | "agora" | "depois" => {
    const atual = etapa === "sem-chave" ? 1 : etapa === "chave-recusada" ? 2 : etapa === "sem-permissao" ? 4 : 5;
    return passo < atual ? "feito" : passo === atual ? "agora" : "depois";
  };
  return (
    <section className="cartao space-y-4 p-5">
      <div>
        <h2 className="font-display text-xl font-bold">Ligar o painel (uma vez só)</h2>
        <p className="text-sm text-suave">
          São 4 passos. Depois de cada um, toque em <b className="text-white">Testar de novo</b>: o que já deu certo fica com ✓.
        </p>
      </div>
      <ol className="space-y-3">
        <Passo n={1} estado={estado(1)} titulo="Criar uma chave secreta nova no Supabase">
          <p>
            Abra{" "}
            <a
              href={`https://supabase.com/dashboard/project/${PROJETO}/settings/api-keys`}
              target="_blank"
              rel="noreferrer"
              className="text-rosa underline"
            >
              Supabase → API Keys
            </a>{" "}
            (já abre no seu projeto).
          </p>
          <p>
            Na parte <b className="text-white">Secret keys</b>, toque em <b className="text-white">+ New secret key</b>, dê o nome{" "}
            <b className="text-white">painel</b> e crie. Toque no ícone de copiar ao lado da chave (começa com{" "}
            <code className="text-white">sb_secret_</code>).
          </p>
          <p className="text-amber-300">
            <Icone e="🔐" /> Aproveite e apague a chave antiga (a que você mandou no chat): nos três pontinhos ao lado dela,
            “Delete”.
          </p>
        </Passo>

        <Passo n={2} estado={estado(2)} titulo="Colar a chave no arquivo .env.local">
          <p>
            No VS Code, na pasta do projeto (lista de arquivos à esquerda), abra o arquivo{" "}
            <b className="text-white">.env.local</b>.
          </p>
          <p>Lá no fim tem esta linha. Cole a chave logo depois do “=”, sem espaço:</p>
          <div className="flex items-center gap-2 rounded-xl bg-fundo p-3">
            <code className="min-w-0 flex-1 truncate text-xs">{LINHA_ENV}sb_secret_xxxxxxxx</code>
            <Copiar texto={LINHA_ENV} />
          </div>
          <p>
            Salve (<b className="text-white">Ctrl + S</b>). Não precisa mandar a chave para ninguém: ela fica só no seu
            computador.
          </p>
          {etapa === "chave-recusada" && (
            <p className="text-saida">
              A chave que está lá não funcionou. Confira se copiou a chave inteira e se ela é a <b>secret</b> (não a publishable).
            </p>
          )}
        </Passo>

        <Passo n={3} estado={estado(3)} titulo="Testar">
          <p>
            Toque no botão abaixo. Se ainda não aparecer o ✓, feche e abra o “npm run dev” de novo (ou me peça para reiniciar).
          </p>
        </Passo>

        <Passo n={4} estado={estado(4)} titulo="Liberar o painel para ver o uso de cada pessoa">
          <p>
            Abra o{" "}
            <a
              href={`https://supabase.com/dashboard/project/${PROJETO}/sql/new`}
              target="_blank"
              rel="noreferrer"
              className="text-rosa underline"
            >
              SQL Editor do Supabase
            </a>
            , cole esta linha e toque em <b className="text-white">Run</b>:
          </p>
          <div className="flex items-center gap-2 rounded-xl bg-fundo p-3">
            <code className="min-w-0 flex-1 truncate text-xs">{SQL}</code>
            <Copiar texto={SQL} />
          </div>
          <p>Ela deixa o painel contar lançamentos, contas e mercado de cada pessoa (sem isso, aparecem só os logins).</p>
        </Passo>
      </ol>
      <button
        onClick={onTestar}
        disabled={testando}
        className="botao-gradiente w-full rounded-full py-3 font-semibold disabled:opacity-60"
      >
        {testando ? "Testando…" : "Testar de novo"}
      </button>
    </section>
  );
}
