import Link from "next/link";

// Página que não existe (endereço errado)
export default function NaoEncontrada() {
  return (
    <div className="grid min-h-[60dvh] place-items-center text-center">
      <div className="space-y-4">
        <p className="text-5xl">🧭</p>
        <h1 className="font-display text-2xl font-bold">Essa página não existe</h1>
        <p className="text-sm text-suave">O endereço pode estar errado ou a página mudou de lugar.</p>
        <Link href="/" className="botao-gradiente inline-block rounded-full px-6 py-3 font-semibold">
          Voltar para o Início
        </Link>
      </div>
    </div>
  );
}
