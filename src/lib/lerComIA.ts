"use client";

// Ler prints e fotos com a IA (rota /api/ler-imagem). Só funciona logado em naxxo.com.br e com a chave da Anthropic
// cadastrada na Vercel. Sem isso, devolve null e quem chamou usa o leitor do próprio celular (Tesseract).

import { supabase } from "./nuvem";

export type TipoLeitura = "notinha" | "carrinho" | "fatura";

export type NotinhaIA = {
  loja: string | null;
  data: string | null;
  total: number | null;
  itens: { nome: string; quantidade: string; valor: number }[];
};
export type CarrinhoIA = { loja: string | null; itens: { nome: string; valor: number; quantidade: number }[] };
export type FaturaIA = {
  itens: { descricao: string; valor: number; data: string | null; parcelaNumero: number | null; parcelaTotal: number | null }[];
};

/** Foto grande do celular → JPEG de até 1600px (bem menor para enviar; continua legível para a IA) */
async function comprimir(arquivo: File): Promise<{ tipo: string; dados: string }> {
  const imagem = await createImageBitmap(arquivo);
  const escala = Math.min(1, 1600 / Math.max(imagem.width, imagem.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(imagem.width * escala);
  canvas.height = Math.round(imagem.height * escala);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(imagem, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL("image/jpeg", 0.85);
  return { tipo: "image/jpeg", dados: url.slice(url.indexOf(",") + 1) };
}

/**
 * Lê as imagens com a IA. Devolve null quando a IA não está disponível (sem login ou sem a chave);
 * dá erro (com a mensagem para a pessoa) quando ela está disponível mas a leitura falhou.
 */
export async function lerComIA<T>(tipo: TipoLeitura, arquivos: File[], aoAvancar?: (texto: string) => void): Promise<T | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;

  aoAvancar?.("Preparando as imagens…");
  const imagens = await Promise.all(arquivos.slice(0, 4).map(comprimir));
  aoAvancar?.("Lendo com a IA… (alguns segundos)");
  const resposta = await fetch("/api/ler-imagem", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ tipo, imagens }),
  });
  if (resposta.status === 503) return null; // sem a chave: usa o leitor do celular
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(corpo.erro ? `A leitura com IA falhou: ${corpo.erro}.` : "A leitura com IA falhou.");
  return corpo as T;
}
