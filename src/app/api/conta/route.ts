import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

// Contas com NOME DE USUÁRIO (o login do Supabase só conhece e-mail).
// - Conta sem e-mail: o e-mail dela é inventado a partir do usuário (`fulana@usuario.naxxo.com.br`) e nunca recebe nada.
// - Conta com e-mail: o e-mail é o de verdade (confirmado com código) e o usuário fica guardado nela.
// O usuário fica no `app_metadata`, que só o servidor muda (a pessoa não consegue pegar o usuário de outra).
// Usa a chave SECRETA do Supabase, guardada só nas variáveis da Vercel (nunca no navegador nem no GitHub).

export const dynamic = "force-dynamic";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const CHAVE_PUBLICA = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const CHAVE_SECRETA = process.env.SUPABASE_SECRET_KEY;

const DOMINIO_INVENTADO = "usuario.naxxo.com.br";
const SEM_SESSAO = { auth: { persistSession: false, autoRefreshToken: false } };

/** "  Fulana.Silva " → "fulana.silva" (ou null se não for um usuário válido) */
function limparUsuario(texto: unknown) {
  const u = String(texto ?? "")
    .trim()
    .toLowerCase();
  return /^[a-z0-9._-]{3,24}$/.test(u) ? u : null;
}

const resposta = (corpo: object, status = 200) => Response.json(corpo, { status, headers: { "Cache-Control": "no-store" } });
const erro = (mensagem: string, status = 400) => resposta({ erro: mensagem }, status);

/** A conta que tem este usuário (procura nas contas; para muitos milhares de contas, trocar por uma tabela) */
async function acharConta(admin: SupabaseClient, usuario: string): Promise<User | undefined> {
  const inventado = `${usuario}@${DOMINIO_INVENTADO}`;
  for (let pagina = 1; pagina <= 50; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 1000 });
    if (error) throw error;
    const achou = data.users.find((u) => u.app_metadata?.usuario === usuario || u.email === inventado);
    if (achou) return achou;
    if (data.users.length < 1000) return undefined;
  }
  return undefined;
}

/** Entra com e-mail e senha aqui no servidor e devolve a sessão para o aparelho */
async function entrar(email: string, senha: string) {
  const publico = createClient(URL_SUPABASE!, CHAVE_PUBLICA!, SEM_SESSAO);
  const { data, error } = await publico.auth.signInWithPassword({ email, password: senha });
  if (error || !data.session) return null;
  return { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
}

export async function POST(request: Request) {
  if (!URL_SUPABASE || !CHAVE_PUBLICA || !CHAVE_SECRETA)
    return erro("O login com usuário ainda não foi ligado. Por enquanto, entre com o e-mail.", 503);
  const admin = createClient(URL_SUPABASE, CHAVE_SECRETA, SEM_SESSAO);

  let corpo: Record<string, unknown>;
  try {
    corpo = await request.json();
  } catch {
    return erro("Pedido inválido.");
  }
  const usuario = limparUsuario(corpo.usuario);
  if (!usuario) return erro("O usuário precisa ter de 3 a 24 letras ou números (pode usar ponto, hífen e _), sem espaço.");
  const senha = typeof corpo.senha === "string" ? corpo.senha : "";

  try {
    switch (corpo.acao) {
      // O usuário está livre? (antes de mandar o código para o e-mail)
      case "livre":
        return resposta({ livre: !(await acharConta(admin, usuario)) });

      // Criar conta SEM e-mail: cria e já entra
      case "criar": {
        if (senha.length < 8) return erro("A senha precisa ter pelo menos 8 caracteres.");
        if (await acharConta(admin, usuario)) return erro("Esse usuário já existe. Escolha outro.");
        const { error } = await admin.auth.admin.createUser({
          email: `${usuario}@${DOMINIO_INVENTADO}`,
          password: senha,
          email_confirm: true,
          app_metadata: { usuario },
        });
        if (error) {
          if (/weak|short|pwned|password/i.test(error.message))
            return erro("Senha fraca. Use letras e números, com pelo menos 8 caracteres.");
          return erro("Não consegui criar a conta agora. Tente de novo.", 500);
        }
        const sessao = await entrar(`${usuario}@${DOMINIO_INVENTADO}`, senha);
        return sessao
          ? resposta(sessao)
          : erro("A conta foi criada, mas não consegui entrar. Tente entrar com usuário e senha.", 500);
      }

      // Entrar com usuário e senha
      case "entrar": {
        const conta = await acharConta(admin, usuario);
        const sessao = conta?.email ? await entrar(conta.email, senha) : null;
        return sessao ? resposta(sessao) : erro("Usuário ou senha errados.", 401);
      }

      // Conta com e-mail (já confirmada com o código): guarda o usuário nela
      case "registrar": {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const { data, error } = token ? await admin.auth.getUser(token) : { data: { user: null }, error: true };
        if (error || !data.user) return erro("Entre de novo e tente outra vez.", 401);
        const dono = await acharConta(admin, usuario);
        if (dono && dono.id !== data.user.id) return erro("Esse usuário já existe. Escolha outro.");
        const { error: erroGravar } = await admin.auth.admin.updateUserById(data.user.id, {
          app_metadata: { ...data.user.app_metadata, usuario },
        });
        return erroGravar ? erro("Não consegui guardar o usuário. Tente de novo.", 500) : resposta({ ok: true });
      }

      default:
        return erro("Pedido inválido.");
    }
  } catch {
    return erro("O login está com problema agora. Tente de novo daqui a pouco.", 500);
  }
}
