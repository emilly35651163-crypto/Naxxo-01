// "Vai se repetir": transforma um gasto que já aconteceu num gasto previsto para as próximas vezes.
// Ex.: Pix de R$ 200 todo mês até quitar R$ 2.000 (10 vezes); gasolina a cada 15 dias.
// Vira um gasto fixo; esta vez fica como a primeira (paga), e as próximas aparecem como previstas.

import { adicionarGastoFixo, iconeDaCategoria, type Cartao, type CategoriaFixo } from "./store";
import { mesAtual, somarDias, somarMeses } from "./formato";
import { dataDeFechamento, faturaDaData } from "./cartoes";

export type Repetir = { modo: "mes" | "dias"; intervalo: number; vezes: number | null; varia: boolean };

const CATEGORIA_DO_FIXO: Record<string, CategoriaFixo> = {
  Moradia: "moradia",
  Contas: "contas",
  Assinaturas: "assinaturas",
  Saúde: "saude",
  Educação: "educacao",
  Transporte: "transporte",
};

/** Último mês em que cobra, contando esta vez (vezes = null: sem fim). */
function ultimoMes(data: string, r: Repetir) {
  if (!r.vezes || r.vezes < 1) return undefined;
  return r.modo === "mes" ? somarMeses(data.slice(0, 7), r.vezes - 1) : somarDias(data, (r.vezes - 1) * r.intervalo).slice(0, 7);
}

/**
 * Cria o gasto que se repete a partir de um gasto que já aconteceu em `data`.
 * Na conta: começa nesta vez (que já está paga). No cartão: começa na próxima (esta já está na fatura).
 * Devolve o id do gasto fixo e a competência desta vez (para ligar o lançamento a ele).
 */
export function criarRepeticao(dados: {
  nome: string;
  categoria: string;
  valor: number;
  data: string;
  contaId?: string;
  cartao?: Pick<Cartao, "id" | "diaFechamento" | "diaVencimento"> & Partial<Cartao>;
  repetir: Repetir;
}) {
  const { nome, categoria, valor, data, contaId, cartao, repetir } = dados;
  const porDias = repetir.modo === "dias";
  const base = {
    nome,
    icone: iconeDaCategoria("saida", categoria),
    categoria: CATEGORIA_DO_FIXO[categoria] ?? ("outros" as const),
    valor,
    varia: repetir.varia,
    dia: Number(data.slice(8, 10)),
    ate: ultimoMes(data, repetir),
  };
  if (cartao) {
    // No cartão, esta compra já está na fatura dela: o gasto fixo começa na fatura seguinte
    const proxima = porDias ? somarDias(data, repetir.intervalo) : dataDeFechamento(cartao as Cartao, faturaDaData(data, cartao));
    return adicionarGastoFixo({
      ...base,
      pagamento: "cartao",
      cartaoId: cartao.id,
      desde: proxima.slice(0, 7) < mesAtual() ? mesAtual() : proxima.slice(0, 7),
      criadoEm: proxima,
      ...(porDias ? { frequencia: "personalizada" as const, intervaloDias: repetir.intervalo, inicio: proxima } : {}),
    });
  }
  return adicionarGastoFixo({
    ...base,
    pagamento: "debito",
    contaId,
    desde: data.slice(0, 7),
    criadoEm: data,
    ...(porDias ? { frequencia: "personalizada" as const, intervaloDias: repetir.intervalo, inicio: data } : {}),
  });
}
