"use client";

// A nuvem (Supabase): login por código no e-mail e os dados de cada pessoa guardados com segurança.
// O app continua usando o navegador como sempre; isto só copia cada mudança para a nuvem
// e, ao entrar em outro aparelho, traz os dados de lá.

import { useSyncExternalStore } from "react";
import { createClient, type Session } from "@supabase/supabase-js";
import { apagarTudo, definirOuvinteDeGravacao, fotografarDados, gravarDaNuvem } from "./store";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE_PUBLICA = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Sem as chaves (ex.: rodando sem configurar), o app funciona como antes, só no navegador. */
/** Endereços com login e nuvem. Nos outros (naxxo-01.vercel.app, localhost), o app funciona só no navegador, sem login. */
const ENDERECOS_COM_LOGIN = ["naxxo.com.br", "www.naxxo.com.br"];
const temChaves = !!URL_SUPABASE && !!CHAVE_PUBLICA;
export const nuvemAtiva = temChaves && typeof window !== "undefined" && ENDERECOS_COM_LOGIN.includes(window.location.hostname);
export const supabase = nuvemAtiva ? createClient(URL_SUPABASE!, CHAVE_PUBLICA!) : null;

export type EstadoNuvem = "carregando" | "fora" | "sincronizando" | "pronto";

let estado: EstadoNuvem = nuvemAtiva ? "carregando" : "pronto";
let sessao: Session | null = null;
const ouvintes = new Set<() => void>();

function mudar(novo: EstadoNuvem) {
  estado = novo;
  ouvintes.forEach((o) => o());
}

export function useEstadoNuvem() {
  return useSyncExternalStore(
    (o) => {
      ouvintes.add(o);
      return () => ouvintes.delete(o);
    },
    () => estado,
    () => (temChaves ? "carregando" : "pronto") as EstadoNuvem,
  );
}

export function emailLogado() {
  const email = sessao?.user.email ?? null;
  return email?.endsWith("@usuario.naxxo.com.br") ? null : email; // conta sem e-mail: o e-mail é inventado
}

/** O nome de usuário da conta (guardado pelo servidor em api/conta), ou null */
export function usuarioLogado(): string | null {
  const u = sessao?.user.app_metadata?.usuario;
  return typeof u === "string" ? u : null;
}

// ---------- Enviar mudanças (cada caixinha, com um pequeno atraso para juntar várias) ----------

const pendentes = new Map<string, unknown>();
let temporizador: ReturnType<typeof setTimeout> | null = null;

async function enviarPendentes() {
  temporizador = null;
  if (!supabase || !sessao || pendentes.size === 0) return;
  const linhas = [...pendentes].map(([chave, valor]) => ({ chave, valor, atualizado_em: new Date().toISOString() }));
  pendentes.clear();
  const { error } = await supabase.from("dados").upsert(linhas, { onConflict: "user_id,chave" });
  // Sem internet: guarda de novo para tentar na próxima mudança (ou ao voltar para o app)
  if (error) linhas.forEach((l) => pendentes.set(l.chave, l.valor));
}

function agendarEnvio() {
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(enviarPendentes, 800);
}

definirOuvinteDeGravacao(
  nuvemAtiva
    ? {
        aoGravar: (chave, valor) => {
          if (!sessao) return;
          pendentes.set(chave, valor);
          agendarEnvio();
        },
        aoApagarTudo: (manter) => {
          if (!supabase || !sessao) return;
          let consulta = supabase.from("dados").delete().eq("user_id", sessao.user.id);
          if (manter.length) consulta = consulta.not("chave", "in", `(${manter.map((c) => `"${c}"`).join(",")})`);
          consulta.then(() => {}); // a consulta só roda quando alguém espera por ela
        },
      }
    : null,
);

// ---------- Trazer os dados da nuvem ----------

/** Tem dados de verdade? (configurações padrão, como o tema, não contam) */
function temConteudo(foto: Record<string, unknown>) {
  const perfil = foto["naxxo:perfil"] as { concluido?: boolean } | undefined;
  if (perfil?.concluido) return true;
  const listas = [
    "naxxo:lancamentos",
    "naxxo:cartoes",
    "naxxo:fontes",
    "naxxo:metas",
    "naxxo:fixos",
    "naxxo:compras",
    "naxxo:mercado-itens",
    "naxxo:mercado-lista",
    "naxxo:desejos",
  ];
  return listas.some((chave) => Array.isArray(foto[chave]) && (foto[chave] as unknown[]).length > 0);
}

const CHAVE_BACKUP = "naxxo-backup-antes-da-nuvem";
let emAndamento: Promise<void> | null = null;

/**
 * Ao entrar:
 * - nuvem sem dados de verdade → sobe o que existe neste aparelho (ninguém perde nada);
 * - nuvem com dados → eles valem; se este aparelho também tinha dados de verdade, eles ficam guardados
 *   numa cópia local (Configurações → "Dados de antes do login") — e uma cópia vazia nunca substitui uma cheia.
 * Nunca roda duas vezes ao mesmo tempo.
 */
function sincronizar() {
  if (!emAndamento) emAndamento = fazerSincronizacao().finally(() => (emAndamento = null));
  return emAndamento;
}

/** Login guardado mas vencido (ex.: app recém-instalado no iPhone, que copia o login antigo do Safari): sai e pede para entrar */
async function loginVencido() {
  if (!supabase) return false;
  const { error } = await supabase.auth.getUser(); // pergunta ao servidor, não só ao aparelho
  // Sem resposta (internet): não dá para saber, segue com o que tem
  if (!error || /fetch|network|internet/i.test(error.message)) return false;
  await supabase.auth.signOut({ scope: "local" });
  sessao = null;
  mudar("fora");
  return true;
}

async function fazerSincronizacao() {
  if (!supabase || !sessao) return;
  mudar("sincronizando");
  const local = fotografarDados();
  let resposta = await supabase.from("dados").select("chave, valor");
  // Aparelho vazio e a nuvem não respondeu: tenta de novo (nunca abrir o questionário por engano de internet)
  for (let tentativa = 1; resposta.error && !temConteudo(local) && tentativa <= 3; tentativa++) {
    await new Promise((r) => setTimeout(r, 1500 * tentativa));
    resposta = await supabase.from("dados").select("chave, valor");
  }
  const { data, error } = resposta;
  if (error) {
    if (await loginVencido()) return;
    // Sem internet: segue com o que tem no aparelho
    mudar("pronto");
    return;
  }
  const nuvem = Object.fromEntries((data ?? []).map((l) => [l.chave, l.valor]));
  // Nuvem vazia pode ser login vencido (o servidor responde "nada" em vez de erro): confere antes de seguir
  if (!temConteudo(nuvem) && (await loginVencido())) return;
  if (!temConteudo(nuvem)) {
    if (temConteudo(local)) {
      Object.entries(local).forEach(([chave, valor]) => pendentes.set(chave, valor));
      await enviarPendentes();
    }
  } else {
    if (temConteudo(local)) {
      try {
        localStorage.setItem(CHAVE_BACKUP, JSON.stringify({ guardadoEm: new Date().toISOString(), dados: local }));
      } catch {}
    }
    gravarDaNuvem(nuvem);
  }
  mudar("pronto");
}

if (supabase && typeof window !== "undefined") {
  supabase.auth.getSession().then(({ data }) => {
    sessao = data.session;
    if (sessao) void sincronizar();
    else mudar("fora");
  });
  supabase.auth.onAuthStateChange((evento, nova) => {
    const antes = sessao;
    sessao = nova;
    if (evento === "SIGNED_IN" && !antes) void sincronizar();
    if (evento === "SIGNED_OUT") mudar("fora");
  });
  // Ao fechar ou esconder o app, manda o que ainda não foi
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void enviarPendentes();
  });
}

// ---------- Entrar e sair ----------

/**
 * Manda o e-mail de entrada: um link "Sign in" que volta para o site já logado
 * (e um código, quando o modelo do e-mail tiver um). Devolve uma mensagem de erro, ou null.
 */
export async function pedirCodigo(email: string) {
  if (!supabase) return "Login indisponível.";
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/entrar` },
  });
  if (!error) return null;
  if (/rate|limit|seconds/i.test(error.message))
    return "O limite de e-mails de entrada foi atingido por agora (o plano grátis manda poucos por hora). Tente de novo daqui a pouco — até 1 hora.";
  return "Não consegui enviar o código. Confira o e-mail.";
}

/** Confere o código. Devolve uma mensagem de erro, ou null. */
export async function confirmarCodigo(email: string, codigo: string) {
  if (!supabase) return "Login indisponível.";
  const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: codigo.trim(), type: "email" });
  return error ? "Código errado ou vencido. Confira o e-mail ou peça outro." : null;
}

/** Entra com e-mail e senha (para quem já criou uma senha em Configurações). Devolve uma mensagem de erro, ou null. */
export async function entrarComSenha(email: string, senha: string) {
  if (!supabase) return "Login indisponível.";
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha });
  if (!error) return null;
  if (/invalid/i.test(error.message))
    return "E-mail ou senha errados. Ainda não tem senha? Entre pelo link e crie uma em Configurações.";
  return "Não consegui entrar agora. Tente de novo.";
}

// ---------- Nome de usuário (api/conta: o servidor guarda o usuário e entra por ele) ----------

async function pedirConta(corpo: object, token?: string): Promise<{ erro?: string; livre?: boolean } & Record<string, unknown>> {
  try {
    const r = await fetch("/api/conta", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(corpo),
    });
    return await r.json();
  } catch {
    return { erro: "Sem internet? Não consegui falar com o servidor." };
  }
}

/** O servidor entrou e devolveu a sessão: passa a valer neste aparelho */
async function usarSessao(r: Record<string, unknown>) {
  if (!supabase || typeof r.access_token !== "string" || typeof r.refresh_token !== "string") return "Não consegui entrar agora.";
  const { error } = await supabase.auth.setSession({ access_token: r.access_token, refresh_token: r.refresh_token });
  return error ? "Não consegui entrar agora. Tente de novo." : null;
}

/** O usuário ainda não existe? Devolve uma mensagem de erro, ou null se está livre. */
export async function conferirUsuario(usuario: string) {
  const r = await pedirConta({ acao: "livre", usuario });
  if (r.erro) return r.erro;
  return r.livre ? null : "Esse usuário já existe. Escolha outro.";
}

/** Cria conta só com usuário e senha (sem e-mail) e já entra. Devolve uma mensagem de erro, ou null. */
export async function criarContaComUsuario(usuario: string, senha: string) {
  if (!supabase) return "Login indisponível.";
  const r = await pedirConta({ acao: "criar", usuario, senha });
  return r.erro ?? (await usarSessao(r));
}

/** Entra com usuário e senha (se a pessoa digitar um e-mail, entra pelo e-mail). Devolve uma mensagem de erro, ou null. */
export async function entrarComUsuario(usuario: string, senha: string) {
  if (!supabase) return "Login indisponível.";
  if (usuario.includes("@")) return entrarComSenha(usuario, senha);
  const r = await pedirConta({ acao: "entrar", usuario, senha });
  return r.erro ?? (await usarSessao(r));
}

/** Conta com e-mail, logo depois do código: cria a senha e guarda o usuário nela. Devolve uma mensagem de erro, ou null. */
export async function completarConta(usuario: string, senha: string) {
  if (!supabase) return "Login indisponível.";
  const problema = await definirSenha(senha);
  if (problema) return problema;
  const { data } = await supabase.auth.getSession();
  const r = await pedirConta({ acao: "registrar", usuario }, data.session?.access_token);
  return r.erro ?? null;
}

/** Cria ou muda a senha da conta (estando logada). Devolve uma mensagem de erro, ou null. */
export async function definirSenha(senha: string) {
  if (!supabase) return "Login indisponível.";
  if (senha.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  const { error } = await supabase.auth.updateUser({ password: senha });
  if (!error) return null;
  if (/same/i.test(error.message)) return "Essa já é a sua senha.";
  if (/weak|short|pwned/i.test(error.message)) return "Senha fraca. Use letras e números, com pelo menos 8 caracteres.";
  return "Não consegui salvar a senha. Tente de novo.";
}

/** Sai da conta: os dados ficam na nuvem e saem deste aparelho. */
export async function sair() {
  if (!supabase) return;
  await enviarPendentes();
  await supabase.auth.signOut();
  apagarTudo([], false);
}
