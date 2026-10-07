import { createClient } from "@supabase/supabase-js";

// Painel de controle (só no computador da dona do app): quem criou conta e quem está usando.
// Usa a chave SECRETA do Supabase, que fica só no .env.local (nunca vai para o GitHub nem para a Vercel).
// Fora do localhost, ou sem a chave, responde 404.

type Linha = { user_id: string; chave: string; valor: unknown; atualizado_em: string };

const tamanho = (v: unknown) => (Array.isArray(v) ? v.length : 0);

export async function GET(request: Request) {
  const host = new URL(request.url).hostname;
  const url = process.env.SUPABASE_URL;
  const secreta = process.env.SUPABASE_SECRET_KEY;
  if (process.env.VERCEL || !["localhost", "127.0.0.1"].includes(host)) return new Response("Não encontrado", { status: 404 });
  if (!url || !secreta)
    return Response.json({ etapa: "sem-chave", erro: "Falta a chave secreta no arquivo .env.local" }, { status: 400 });

  const supabase = createClient(url, secreta, { auth: { persistSession: false, autoRefreshToken: false } });

  // Contas de login (até 1000)
  const { data: usuarios, error: erroUsuarios } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (erroUsuarios)
    return Response.json(
      { etapa: "chave-recusada", erro: `O Supabase não aceitou a chave (${erroUsuarios.message})` },
      { status: 400 },
    );

  // Os dados de cada pessoa (para saber se está usando de verdade)
  const { data: linhas, error: erroDados } = await supabase.from("dados").select("user_id, chave, valor, atualizado_em");
  const porUsuario = new Map<string, Linha[]>();
  for (const l of (linhas ?? []) as Linha[]) porUsuario.set(l.user_id, [...(porUsuario.get(l.user_id) ?? []), l]);

  const pessoas = usuarios.users.map((u) => {
    const dados = porUsuario.get(u.id) ?? [];
    const de = (chave: string) => dados.find((d) => d.chave === chave)?.valor;
    const perfil = de("naxxo:perfil") as { nome?: string; concluido?: boolean } | undefined;
    const ultimaAtividade = dados.reduce((m, d) => (d.atualizado_em > m ? d.atualizado_em : m), "");
    return {
      email: u.email ?? u.phone ?? "—",
      nome: perfil?.nome ?? "",
      criadoEm: u.created_at,
      ultimoLogin: u.last_sign_in_at ?? null,
      ultimaAtividade: ultimaAtividade || null,
      questionario: !!perfil?.concluido,
      lancamentos: tamanho(de("naxxo:lancamentos")),
      contas: tamanho(de("naxxo:cartoes")),
      compras: tamanho(de("naxxo:compras")),
      mercado: tamanho(de("naxxo:mercado-lista")) + tamanho(de("naxxo:mercado-itens")),
      metas: tamanho(de("naxxo:metas")),
    };
  });

  return Response.json({
    pessoas,
    // Sem permissão na tabela: mostra os logins mesmo assim, com o aviso de como liberar
    avisoDados: erroDados ? `Ainda não consigo ver o uso de cada pessoa (${erroDados.message}).` : null,
    geradoEm: new Date().toISOString(),
  });
}
