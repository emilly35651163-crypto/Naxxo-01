import { createClient } from "@supabase/supabase-js";

// "Oi" diário no Supabase: no plano grátis, o projeto pausa sozinho depois de 7 dias sem uso
// (e aí o login e a nuvem param). A Vercel chama esta rota uma vez por dia (vercel.json → crons).
// Só lê uma linha: não muda nada. Usa a chave secreta, que fica só nas variáveis da Vercel.

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const secreta = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secreta) return Response.json({ ok: false, erro: "sem chave" }, { status: 503 });

  const supabase = createClient(url, secreta, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await supabase.from("dados").select("chave").limit(1);
  return Response.json({ ok: !error }, { status: error ? 500 : 200, headers: { "Cache-Control": "no-store" } });
}
