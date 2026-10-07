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
export const nuvemAtiva = !!URL_SUPABASE && !!CHAVE_PUBLICA;
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
    () => (nuvemAtiva ? "carregando" : "pronto") as EstadoNuvem,
  );
}

export function emailLogado() {
  return sessao?.user.email ?? null;
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

async function fazerSincronizacao() {
  if (!supabase || !sessao) return;
  mudar("sincronizando");
  const { data, error } = await supabase.from("dados").select("chave, valor");
  if (error) {
    // Sem internet: segue com o que tem no aparelho
    mudar("pronto");
    return;
  }
  const local = fotografarDados();
  const nuvem = Object.fromEntries((data ?? []).map((l) => [l.chave, l.valor]));
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

/** Sai da conta: os dados ficam na nuvem e saem deste aparelho. */
export async function sair() {
  if (!supabase) return;
  await enviarPendentes();
  await supabase.auth.signOut();
  apagarTudo([], false);
}
