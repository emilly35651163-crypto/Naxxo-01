"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import simbolo from "@/assets/naxxo-simbolo.png";
import { NomeNaxxo } from "@/components/Logo";
import { confirmarCodigo, entrarComSenha, pedirCodigo, useEstadoNuvem } from "@/lib/nuvem";
import Icone, { TextoComIcones } from "@/components/Icone";

// Entrar: o e-mail e, depois, o código de 6 números que chega nele. Sem senha.
export default function Entrar() {
  const router = useRouter();
  const estado = useEstadoNuvem();
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [etapa, setEtapa] = useState<"email" | "codigo" | "senha">("email");
  const [senha, setSenha] = useState("");
  const [comCodigo, setComCodigo] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Já entrou: vai para o app
  useEffect(() => {
    if (estado === "pronto") router.replace("/");
  }, [estado, router]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (etapa === "senha") {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErro("Digite um e-mail válido.");
      if (!senha) return setErro("Digite a senha.");
      setEnviando(true);
      const problema = await entrarComSenha(email, senha);
      setEnviando(false);
      if (problema) return setErro(problema);
      return;
    }
    if (etapa === "email") {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErro("Digite um e-mail válido.");
      setEnviando(true);
      const problema = await pedirCodigo(email);
      setEnviando(false);
      if (problema) return setErro(problema);
      setEtapa("codigo");
      return;
    }
    if (codigo.trim().length < 6) return setErro("Digite os 6 números do código.");
    setEnviando(true);
    const problema = await confirmarCodigo(email, codigo);
    setEnviando(false);
    if (problema) return setErro(problema);
  }

  return (
    <form
      onSubmit={enviar}
      className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 pt-[env(safe-area-inset-top)]"
    >
      <div className="flex flex-col items-center text-center">
        <Image src={simbolo} alt="" className="h-20 w-auto drop-shadow-[0_0_30px_rgb(255_78_216/0.5)]" priority />
        <NomeNaxxo className="mt-5 h-5 w-auto" />
        <h1 className="mt-8 font-display text-2xl font-bold">
          <TextoComIcones texto={etapa === "codigo" ? "Confira seu e-mail 📬" : "Login"} />
        </h1>
        <p className="mt-2 text-sm text-suave">
          {etapa === "senha"
            ? "Entre com o seu e-mail e a sua senha."
            : etapa === "email"
              ? "Sem senha: mandamos um link de entrada para o seu e-mail."
              : `Mandamos um e-mail para ${email.trim()}. Abra neste aparelho e toque em “Sign in”: você volta para cá já dentro do app.`}
        </p>
        {etapa === "codigo" && <p className="mt-2 text-xs text-suave">Não chegou? Olhe a caixa de spam ou promoções.</p>}
      </div>

      <div className="mt-8 space-y-3">
        {etapa === "senha" ? (
          <>
            <input
              type="email"
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              aria-label="E-mail"
              className="campo text-center"
            />
            <input
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="sua senha"
              aria-label="Senha"
              className="campo text-center"
            />
          </>
        ) : etapa === "email" ? (
          <input
            type="email"
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            aria-label="E-mail"
            className="campo text-center"
          />
        ) : !comCodigo ? (
          <button type="button" onClick={() => setComCodigo(true)} className="w-full text-sm text-rosa">
            O e-mail veio com um código de números?
          </button>
        ) : (
          <input
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="000000"
            aria-label="Código"
            className="campo text-center font-display text-2xl tracking-[0.5em]"
          />
        )}
        {erro && (
          <p role="alert" className="text-center text-sm text-saida">
            {erro}
          </p>
        )}
        {(etapa !== "codigo" || comCodigo) && (
          <button
            type="submit"
            disabled={enviando}
            className="botao-gradiente w-full rounded-full py-3.5 font-semibold disabled:opacity-60"
          >
            {enviando
              ? "Um instante…"
              : etapa === "email"
                ? "Receber link de entrada"
                : etapa === "senha"
                  ? "Entrar"
                  : "Entrar com o código"}
          </button>
        )}
        {etapa === "email" && (
          <button
            type="button"
            onClick={() => {
              setEtapa("senha");
              setErro("");
            }}
            className="w-full rounded-full border border-rosa/50 py-3.5 font-semibold text-rosa"
          >
            Entrar com senha
          </button>
        )}
        {etapa === "senha" && (
          <button
            type="button"
            onClick={() => {
              setEtapa("email");
              setErro("");
            }}
            className="w-full text-sm text-suave"
          >
            Não tenho senha: receber link por e-mail
          </button>
        )}
        {etapa === "codigo" && (
          <button
            type="button"
            onClick={() => {
              setEtapa("email");
              setCodigo("");
              setErro("");
            }}
            className="w-full text-sm text-suave"
          >
            Usar outro e-mail ou mandar de novo
          </button>
        )}
      </div>
      {estado === "sincronizando" && (
        <p className="mt-6 text-center text-sm text-suave">
          Trazendo seus dados… <Icone e="☁️" />
        </p>
      )}
    </form>
  );
}
