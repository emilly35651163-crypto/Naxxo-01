"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import simbolo from "@/assets/naxxo-simbolo.png";
import { NomeNaxxo } from "@/components/Logo";
import {
  completarConta,
  confirmarCodigo,
  conferirUsuario,
  criarContaComUsuario,
  entrarComUsuario,
  pedirCodigo,
  useEstadoNuvem,
} from "@/lib/nuvem";
import Icone, { TextoComIcones } from "@/components/Icone";

// Login: escolher como entrar (usuário e senha, ou código no e-mail) ou criar conta.
// Criar conta: usuário, e-mail (opcional), senha e repetir a senha. Com e-mail, só entra depois de digitar o código.
type Etapa = "inicio" | "usuario" | "email" | "codigo" | "criar" | "codigo-criar";

const EMAIL_VALIDO = /^\S+@\S+\.\S+$/;

const TITULOS: Record<Etapa, string> = {
  inicio: "Login",
  usuario: "Entrar",
  email: "Entrar com e-mail",
  codigo: "Confira seu e-mail 📬",
  criar: "Criar conta",
  "codigo-criar": "Confira seu e-mail 📬",
};

export default function Entrar() {
  const router = useRouter();
  const estado = useEstadoNuvem();
  const [etapa, setEtapa] = useState<Etapa>("inicio");
  const [usuario, setUsuario] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Já entrou: vai para o app (na criação com e-mail, só depois de guardar a senha e o usuário)
  useEffect(() => {
    if (estado === "pronto" && etapa !== "codigo-criar") router.replace("/");
  }, [estado, etapa, router]);

  function ir(nova: Etapa) {
    setEtapa(nova);
    setErro("");
    setCodigo("");
  }

  async function tentar(acao: () => Promise<string | null | undefined | void>) {
    setErro("");
    setEnviando(true);
    try {
      const problema = await acao();
      if (problema) setErro(problema);
    } finally {
      setEnviando(false);
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;

    if (etapa === "usuario") {
      if (!usuario.trim()) return setErro("Digite o seu usuário.");
      if (!senha) return setErro("Digite a senha.");
      return tentar(() => entrarComUsuario(usuario, senha));
    }

    if (etapa === "email") {
      if (!EMAIL_VALIDO.test(email.trim())) return setErro("Digite um e-mail válido.");
      return tentar(async () => {
        const problema = await pedirCodigo(email);
        if (!problema) ir("codigo");
        return problema;
      });
    }

    if (etapa === "codigo" || etapa === "codigo-criar") {
      if (codigo.trim().length < 6) return setErro("Digite os 6 números do código.");
      return tentar(async () => {
        const problema = await confirmarCodigo(email, codigo);
        if (problema || etapa === "codigo") return problema;
        // Criando conta: o e-mail foi confirmado; agora guarda a senha e o usuário
        const naoGuardou = await completarConta(usuario, senha);
        if (naoGuardou) {
          // Já está dentro (pelo e-mail): mostra o aviso e segue para o app
          setTimeout(() => router.replace("/"), 6000);
          return `Você entrou pelo e-mail, mas: ${naoGuardou} Por enquanto, entre com o e-mail.`;
        }
        router.replace("/");
      });
    }

    if (etapa === "criar") {
      if (!usuario.trim()) return setErro("Escolha um nome de usuário.");
      if (email.trim() && !EMAIL_VALIDO.test(email.trim()))
        return setErro("Esse e-mail não parece certo. Confira ou deixe em branco.");
      if (senha.length < 8) return setErro("A senha precisa ter pelo menos 8 caracteres.");
      if (senha !== senha2) return setErro("As duas senhas estão diferentes.");
      return tentar(async () => {
        if (!email.trim()) return criarContaComUsuario(usuario, senha);
        // Com e-mail: confere se o usuário está livre e manda o código. A conta só vale depois do código.
        const ocupado = await conferirUsuario(usuario);
        if (ocupado) return ocupado;
        const problema = await pedirCodigo(email);
        if (!problema) ir("codigo-criar");
        return problema;
      });
    }
  }

  const textoBotao: Partial<Record<Etapa, string>> = {
    usuario: "Entrar",
    email: "Receber código de entrada",
    codigo: "Entrar com o código",
    criar: email.trim() ? "Criar conta e receber código" : "Criar conta",
    "codigo-criar": "Confirmar e entrar",
  };

  return (
    <form
      onSubmit={enviar}
      className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-8 pt-[max(2rem,env(safe-area-inset-top))]"
    >
      <div className="flex flex-col items-center text-center">
        <Image src={simbolo} alt="" className="h-20 w-auto drop-shadow-[0_0_30px_rgb(255_78_216/0.5)]" priority />
        <NomeNaxxo className="mt-5 h-5 w-auto" />
        <h1 className="mt-8 font-display text-2xl font-bold">
          <TextoComIcones texto={TITULOS[etapa]} />
        </h1>
        <p className="mt-2 text-sm text-suave">
          {etapa === "inicio"
            ? "Como você quer entrar?"
            : etapa === "usuario"
              ? "Digite o seu usuário e a sua senha."
              : etapa === "email"
                ? "Mandamos um código de entrada para o seu e-mail. Sem senha."
                : etapa === "criar"
                  ? "O e-mail é opcional. Se colocar, vamos confirmar com um código."
                  : `Mandamos um e-mail para ${email.trim()}. Digite aqui o código de 6 números que veio nele.`}
        </p>
        {(etapa === "codigo" || etapa === "codigo-criar") && (
          <p className="mt-2 text-xs text-suave">Não chegou? Olhe a caixa de spam ou promoções.</p>
        )}
      </div>

      <div className="mt-8 space-y-3">
        {etapa === "inicio" && (
          <>
            <button
              type="button"
              onClick={() => ir("usuario")}
              className="botao-gradiente w-full rounded-full py-3.5 font-semibold"
            >
              Entrar com usuário e senha
            </button>
            <button
              type="button"
              onClick={() => ir("email")}
              className="w-full rounded-full border border-rosa/50 py-3.5 font-semibold text-rosa"
            >
              Entrar com e-mail (código)
            </button>
            <button type="button" onClick={() => ir("criar")} className="w-full pt-2 text-sm text-suave">
              Não tem conta? <span className="font-semibold text-rosa">Criar conta</span>
            </button>
          </>
        )}

        {(etapa === "usuario" || etapa === "criar") && (
          <input
            autoFocus
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={usuario}
            onChange={(e) => setUsuario(e.target.value.replace(/\s/g, ""))}
            placeholder={etapa === "criar" ? "nome de usuário" : "usuário"}
            aria-label="Nome de usuário"
            className="campo text-center"
          />
        )}

        {(etapa === "email" || etapa === "criar") && (
          <input
            type="email"
            autoFocus={etapa === "email"}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={etapa === "criar" ? "e-mail (opcional)" : "seu@email.com"}
            aria-label={etapa === "criar" ? "E-mail (opcional)" : "E-mail"}
            className="campo text-center"
          />
        )}

        {(etapa === "usuario" || etapa === "criar") && (
          <input
            type="password"
            autoComplete={etapa === "criar" ? "new-password" : "current-password"}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder={etapa === "criar" ? "senha (8 ou mais)" : "senha"}
            aria-label="Senha"
            className="campo text-center"
          />
        )}

        {etapa === "criar" && (
          <>
            <input
              type="password"
              autoComplete="new-password"
              value={senha2}
              onChange={(e) => setSenha2(e.target.value)}
              placeholder="repetir a senha"
              aria-label="Repetir a senha"
              className="campo text-center"
            />
            {!email.trim() && (
              <p className="text-center text-xs text-suave">
                Sem e-mail, se você esquecer a senha não dá para recuperar a conta.
              </p>
            )}
          </>
        )}

        {(etapa === "codigo" || etapa === "codigo-criar") && (
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

        {etapa !== "inicio" && (
          <>
            <button
              type="submit"
              disabled={enviando}
              className="botao-gradiente w-full rounded-full py-3.5 font-semibold disabled:opacity-60"
            >
              {enviando ? "Um instante…" : textoBotao[etapa]}
            </button>
            <button
              type="button"
              onClick={() => ir(etapa === "codigo" ? "email" : etapa === "codigo-criar" ? "criar" : "inicio")}
              className="w-full text-sm text-suave"
            >
              {etapa === "codigo" || etapa === "codigo-criar" ? "Usar outro e-mail ou mandar de novo" : "Voltar"}
            </button>
          </>
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
