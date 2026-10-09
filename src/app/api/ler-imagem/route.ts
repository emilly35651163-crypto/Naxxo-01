import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// Ler prints e fotos com a IA (Claude): notinha do mercado, carrinho dos apps e fatura do cartão.
// - A chave da Anthropic fica só aqui no servidor (variável ANTHROPIC_API_KEY na Vercel); nunca vai para o navegador.
// - Só atende quem está logado (para ninguém de fora gastar a conta).
// - Sem a chave, responde "indisponível" e o app usa o leitor do próprio celular.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODELO = "claude-opus-5-5";
const MAX_IMAGENS = 4;

const Notinha = z.object({
  loja: z.string().nullable().describe("Nome do mercado, como aparece no topo da notinha"),
  data: z.string().nullable().describe("Data da compra no formato AAAA-MM-DD"),
  total: z.number().nullable().describe("Valor total pago (o 'valor a pagar' / 'total')"),
  itens: z.array(
    z.object({
      nome: z.string().describe("Nome do produto, legível, sem código de barras (ex.: 'Arroz Tio João 5kg')"),
      quantidade: z.string().describe("Quantidade comprada com a unidade (ex.: '2 un', '0,850 kg'); vazio se não houver"),
      valor: z.number().describe("Valor total pago por este produto (quantidade × preço, já com desconto do item)"),
    }),
  ),
});

const Carrinho = z.object({
  loja: z.string().nullable().describe("Loja/app: Shein, Mercado Livre, Amazon, Shopee, AliExpress, Temu, Magalu ou outro"),
  itens: z.array(
    z.object({
      nome: z.string().describe("Nome do produto, curto e legível"),
      valor: z.number().describe("Preço ATUAL de UMA unidade (o com desconto, não o riscado)"),
      quantidade: z.number().int().describe("Quantidade no carrinho (1 se não aparecer)"),
    }),
  ),
});

const Fatura = z.object({
  itens: z.array(
    z.object({
      descricao: z.string().describe("Nome da loja/compra, legível"),
      valor: z.number().describe("Valor desta compra nesta fatura (se parcelado, o valor da parcela)"),
      data: z.string().nullable().describe("Data da compra AAAA-MM-DD, se aparecer"),
      parcelaNumero: z.number().int().nullable().describe("Número da parcela atual (ex.: 3 em '3/10'), se parcelado"),
      parcelaTotal: z.number().int().nullable().describe("Total de parcelas (ex.: 10 em '3/10'), se parcelado"),
    }),
  ),
});

const TIPOS = {
  notinha: {
    formato: Notinha,
    pedido:
      "Estas imagens são de UMA notinha (cupom fiscal / NFC-e) de mercado no Brasil. Liste todos os produtos comprados, com a quantidade e o valor total de cada um, mais o nome do mercado, a data e o total pago. Ignore impostos, troco, forma de pagamento e textos legais. Valores em reais (vírgula = centavos).",
  },
  carrinho: {
    formato: Carrinho,
    pedido:
      "Estas imagens são prints do carrinho de compras de um app de loja online no Brasil. Liste os produtos que estão no carrinho, com o preço atual de uma unidade (o com desconto, nunca o preço antigo riscado) e a quantidade. Ignore frete, cupons, subtotal, total, parcelamento e recomendações de outros produtos. Diga também qual é a loja.",
  },
  fatura: {
    formato: Fatura,
    pedido:
      "Estas imagens são prints da fatura ou das compras de um cartão de crédito no Brasil. Liste cada compra (não liste pagamentos, estornos, créditos, totais, limite, juros nem anuidade). Para compras parceladas, dê o valor da parcela e o número da parcela atual e o total (ex.: 3 de 10). Datas sem ano: use o ano mais provável perto de hoje.",
  },
} as const;

type Tipo = keyof typeof TIPOS;

/** O app pergunta se a leitura com IA está ligada (sem expor nada) */
export async function GET() {
  return Response.json({ disponivel: !!process.env.ANTHROPIC_API_KEY });
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ erro: "indisponivel" }, { status: 503 });

  // Só para quem está logado
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return Response.json({ erro: "entre na sua conta" }, { status: 401 });
  const { data: usuario, error: erroLogin } = await createClient(url, anon).auth.getUser(token);
  if (erroLogin || !usuario.user) return Response.json({ erro: "entre na sua conta" }, { status: 401 });

  let corpo: { tipo?: string; imagens?: { tipo?: string; dados?: string }[] };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: "pedido inválido" }, { status: 400 });
  }
  const tipo = corpo.tipo as Tipo;
  const imagens = (corpo.imagens ?? []).slice(0, MAX_IMAGENS);
  if (!(tipo in TIPOS) || imagens.length === 0) return Response.json({ erro: "pedido inválido" }, { status: 400 });
  const tiposAceitos = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
  type TipoImagem = (typeof tiposAceitos)[number];
  if (imagens.some((i) => !i.dados || !tiposAceitos.includes(i.tipo as TipoImagem)))
    return Response.json({ erro: "imagem inválida" }, { status: 400 });

  const { formato, pedido } = TIPOS[tipo];
  const cliente = new Anthropic();
  try {
    const resposta = await cliente.messages.parse({
      model: MODELO,
      max_tokens: 16000,
      output_config: { effort: "low", format: zodOutputFormat(formato) },
      messages: [
        {
          role: "user",
          content: [
            ...imagens.map((i) => ({
              type: "image" as const,
              source: { type: "base64" as const, media_type: i.tipo as TipoImagem, data: i.dados! },
            })),
            { type: "text" as const, text: `${pedido} Hoje é ${new Date().toISOString().slice(0, 10)}.` },
          ],
        },
      ],
    });
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output)
      return Response.json({ erro: "não consegui ler" }, { status: 422 });
    return Response.json(resposta.parsed_output);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError)
      return Response.json({ erro: "muitas leituras agora, tente daqui a pouco" }, { status: 429 });
    if (e instanceof Anthropic.APIError) return Response.json({ erro: "a leitura falhou" }, { status: 502 });
    throw e;
  }
}
