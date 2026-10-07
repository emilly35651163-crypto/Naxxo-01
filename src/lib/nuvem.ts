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

/**
 * Ao entrar: se a nuvem ainda está vazia, sobe o que já existe neste aparelho (ninguém perde nada).
 * Se a nuvem já tem dados, eles valem (e o que estava aqui fica guardado num backup local, por segurança).
 */
async function sincronizar() {
  if (!supabase || !sessao) return;
  mudar("sincronizando");
  const { data, error } = await supabase.from("dados").select("chave, valor");
  if (error) {
    // Sem internet: segue com o que tem no aparelho
    mudar("pronto");
    return;
  }
  const local = fotografarDados();
  const temAlgoAqui = Object.values(local).some((v) =>
    Array.isArray(v) ? v.length > 0 : v && typeof v === "object" && Object.keys(v).length > 0,
  );
  if (!data || data.length === 0) {
    if (temAlgoAqui) {
      Object.entries(local).forEach(([chave, valor]) => pendentes.set(chave, valor));
      await enviarPendentes();
    }
  } else {
    if (temAlgoAqui) {
      try {
        localStorage.setItem(
          "naxxo-backup-antes-da-nuvem",
          JSON.stringify({ guardadoEm: new Date().toISOString(), dados: local }),
        );
      } catch {}
    }
    gravarDaNuvem(Object.fromEntries(data.map((l) => [l.chave, l.valor])));
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
  // Voltou para o app (outro aparelho pode ter mudado algo): traz a versão mais nova, se não houver nada para enviar
  window.addEventListener("focus", () => {
    if (sessao && estado === "pronto" && pendentes.size === 0 && !temporizador) void sincronizar();
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
