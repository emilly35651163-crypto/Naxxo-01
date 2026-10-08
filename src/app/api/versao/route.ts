// Qual versão do app está publicada (muda a cada publicação). O app compara com a dele para saber se precisa recarregar.
export const dynamic = "force-dynamic";

export function GET() {
  const versao = process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "local";
  return Response.json({ versao }, { headers: { "Cache-Control": "no-store" } });
}
