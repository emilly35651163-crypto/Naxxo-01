// Ler o extrato que a pessoa baixa no app do banco (OFX ou CSV) e transformar em lançamentos.

import type { CompraCartao, Lancamento, Tipo } from "./store";

export type LinhaExtrato = {
  /** Identificador estável da linha (do banco, quando tem; senão data+valor+descrição) */
  id: string;
  data: string; // "2026-10-05"
  descricao: string;
  valor: number; // sempre positivo
  tipo: Tipo;
  categoria: string;
};

export type Extrato = { linhas: LinhaExtrato[]; ehCartao: boolean };

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** "1.234,56" · "-12.50" · "R$ 12,50" · "12,5" → número (com sinal) */
export function lerNumero(texto: string) {
  let t = texto.replace(/[R$\s"]/g, "");
  const negativo = /^-|-$|^\(.*\)$/.test(t);
  t = t.replace(/[-()+]/g, "");
  if (!t) return NaN;
  const virgula = t.lastIndexOf(",");
  const ponto = t.lastIndexOf(".");
  if (virgula >= 0 && ponto >= 0) {
    // O último separador é o dos centavos
    t = virgula > ponto ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (virgula >= 0) {
    t = t.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, ""); // 1.234 = mil duzentos e trinta e quatro
  }
  const n = Number(t);
  return negativo ? -n : n;
}

/** "05/10/2026" · "05/10/26" · "2026-10-05" · "20261005…" → "2026-10-05" */
export function lerData(texto: string) {
  const t = texto.trim().replace(/"/g, "");
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const ano = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${ano}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  m = t.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return "";
}

// Palavras que dizem a categoria (a primeira que bater vale)
const PALAVRAS: [string, Tipo, RegExp][] = [
  ["Fatura do cartão", "saida", /pagamento de fatura|pagto fatura|pagamento fatura|fatura cartao|pgto cartao/],
  ["Salário", "entrada", /salario|folha|pagto sal|proventos/],
  ["Investimentos", "entrada", /rendimento|resgate|dividendo/],
  ["Mercado", "saida", /mercado|supermerc|atacad|assai|carrefour|extra |pao de acucar|hortifruti|sacolao|dia %|atacarejo/],
  ["Alimentação", "saida", /ifood|restaur|lanch|padaria|pizz|burger|mcdonald|bk |cafe|food|bar |acougue|rappi/],
  [
    "Transporte",
    "saida",
    /uber|99 ?app|99pop|99 tecnologia|posto|combust|shell|ipiranga|petrobras|estacion|metro|onibus|bilhete|sptrans|recarga bom/,
  ],
  ["Saúde", "saida", /farma|drogaria|droga|raia|pacheco|hospital|clinica|laborat|medic|dental|odonto/],
  [
    "Assinaturas",
    "saida",
    /netflix|spotify|disney|hbo|max\.com|prime video|amazon prime|youtube|deezer|globoplay|apple\.com|icloud|google one|chatgpt|openai/,
  ],
  ["Moradia", "saida", /aluguel|condominio|iptu|imobili/],
  [
    "Contas",
    "saida",
    /enel|energia|luz|cemig|copel|light|sabesp|agua|saneamento|gas |comgas|claro|vivo|tim |oi |internet|telefon|net servicos/,
  ],
  ["Educação", "saida", /escola|faculdade|universidade|curso|udemy|alura|livraria/],
  ["Lazer", "saida", /cinema|ingresso|show|steam|playstation|xbox|nintendo|viagem|hotel|airbnb|booking/],
  [
    "Compras",
    "saida",
    /shopee|mercado ?livre|mercadolivre|amazon|magalu|magazine|americanas|shein|aliexpress|renner|riachuelo|c&a|loja/,
  ],
];

function categoriaPelaDescricao(descricao: string, tipo: Tipo) {
  const t = semAcento(descricao);
  return PALAVRAS.find(([, tipoDa, re]) => tipoDa === tipo && re.test(t))?.[0] ?? "Outros";
}

/** Linhas que não são movimento (saldo do dia, saldo anterior…) */
const NAO_E_MOVIMENTO = /^saldo|saldo do dia|saldo anterior|saldo final|s a l d o|total/;

const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e"]);

/** "MERCADO VIOLETA LTDA" → "Mercado Violeta Ltda" (só quando está tudo em maiúsculas) */
function capitalizar(texto: string) {
  if (texto !== texto.toUpperCase()) return texto;
  return texto
    .toLowerCase()
    .split(" ")
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

/** Deixa o título do jeito que a pessoa escreveria: tira "Compra no débito -", CPF mascarado, agência… */
export function limparDescricao(descricao: string) {
  const partes = descricao.split(/\s+-\s+/).map((p) => p.trim());
  const [inicio, nome] = [semAcento(partes[0] ?? ""), partes[1] ?? ""];
  if (nome) {
    if (/transferencia enviada|pix enviado|transferencia pix enviada/.test(inicio)) return `Pix para ${capitalizar(nome)}`;
    if (/transferencia recebida|pix recebido/.test(inicio)) return `Pix de ${capitalizar(nome)}`;
    if (/^compra (no|com) (debito|cartao)|^compra$/.test(inicio)) return capitalizar(nome);
  }
  return capitalizar(descricao);
}

function linha(
  dataTexto: string,
  descricao: string,
  valorComSinal: number,
  idBanco?: string,
  ehCartao = false,
): LinhaExtrato | null {
  const data = lerData(dataTexto);
  const desc = descricao.replace(/\s+/g, " ").trim();
  if (!data || !Number.isFinite(valorComSinal) || valorComSinal === 0 || NAO_E_MOVIMENTO.test(semAcento(desc))) return null;
  // No cartão, compra vem positiva (e estorno/pagamento, negativo); na conta, saída vem negativa
  const tipo: Tipo = ehCartao ? (valorComSinal > 0 ? "saida" : "entrada") : valorComSinal < 0 ? "saida" : "entrada";
  const valor = Math.round(Math.abs(valorComSinal) * 100) / 100;
  return {
    id: idBanco ? `b:${idBanco}` : `${data}|${valor}|${semAcento(desc).slice(0, 40)}`,
    data,
    descricao: limparDescricao(desc) || "Sem descrição",
    valor,
    tipo,
    categoria: categoriaPelaDescricao(desc, tipo),
  };
}

// ---------- OFX ----------

function campoOFX(bloco: string, nome: string) {
  const m = bloco.match(new RegExp(`<${nome}>([^<\\r\\n]*)`, "i"));
  return m ? m[1].trim() : "";
}

function lerOFX(texto: string): Extrato {
  const ehCartao = /<CCSTMTRS>/i.test(texto);
  const blocos = texto.split(/<STMTTRN>/i).slice(1);
  const linhas = blocos.flatMap((b) => {
    const valor = lerNumero(campoOFX(b, "TRNAMT"));
    const descricao = campoOFX(b, "MEMO") || campoOFX(b, "NAME");
    // OFX de cartão também usa sinal negativo para compra: inverte para o padrão do cartão (compra positiva)
    const l = linha(campoOFX(b, "DTPOSTED"), descricao, ehCartao ? -valor : valor, campoOFX(b, "FITID") || undefined, ehCartao);
    return l ? [l] : [];
  });
  return { linhas, ehCartao };
}

// ---------- CSV ----------

function separarCSV(linhaTexto: string, sep: string) {
  const campos: string[] = [];
  let atual = "";
  let aspas = false;
  for (const ch of linhaTexto) {
    if (ch === '"') aspas = !aspas;
    else if (ch === sep && !aspas) {
      campos.push(atual.trim());
      atual = "";
    } else atual += ch;
  }
  campos.push(atual.trim());
  return campos;
}

function lerCSV(texto: string): Extrato {
  const linhasTexto = texto.split(/\r?\n/).filter((l) => l.trim());
  if (linhasTexto.length === 0) return { linhas: [], ehCartao: false };
  // Separador: o que mais aparece na primeira linha
  const primeira = linhasTexto[0];
  const sep = [";", ",", "\t"].sort((a, b) => primeira.split(b).length - primeira.split(a).length)[0];

  // Acha a linha do cabeçalho (algumas exportações têm linhas de título antes)
  let inicio = linhasTexto.findIndex((l) => /data|date/i.test(l) && /valor|amount|value/i.test(l));
  const temCabecalho = inicio >= 0;
  if (!temCabecalho) inicio = -1;
  const cabecalho = temCabecalho ? separarCSV(linhasTexto[inicio], sep).map(semAcento) : [];
  const coluna = (re: RegExp) => cabecalho.findIndex((c) => re.test(c));

  let iData = coluna(/^data|date/);
  let iValor = coluna(/^valor|amount|^value/);
  let iDesc = coluna(/descri|historico|title|lancamento|estabelecimento|memo/);
  const iDetalhe = coluna(/detalhe/);
  const iTipo = coluna(/tipo|natureza|d\/c|debito|credito/);
  const iId = coluna(/identificador|^id$|documento/);
  // Nubank cartão: "date,title,amount" (compra positiva)
  const ehCartao = /title/.test(cabecalho.join(" ")) && /amount/.test(cabecalho.join(" "));

  if (!temCabecalho) {
    // Sem cabeçalho: adivinha pelas colunas da primeira linha
    const amostra = separarCSV(primeira, sep);
    iData = amostra.findIndex((c) => !!lerData(c));
    iValor = amostra.findIndex((c, i) => i !== iData && /\d[.,]\d{2}\b/.test(c) && Number.isFinite(lerNumero(c)));
    iDesc = amostra.findIndex((c, i) => i !== iData && i !== iValor && /[a-z]/i.test(c));
  }
  if (iData < 0 || iValor < 0) return { linhas: [], ehCartao };

  const linhas = linhasTexto.slice(inicio + 1).flatMap((texto) => {
    const c = separarCSV(texto, sep);
    let valor = lerNumero(c[iValor] ?? "");
    const tipoTexto = semAcento(c[iTipo] ?? "");
    // Banco que manda o valor sempre positivo e diz o tipo em outra coluna
    if (iTipo >= 0 && valor > 0 && /saida|debito|^d$/.test(tipoTexto)) valor = -valor;
    const descricao = [c[iDesc] ?? "", iDetalhe >= 0 ? (c[iDetalhe] ?? "") : ""].filter(Boolean).join(" · ");
    const l = linha(c[iData] ?? "", descricao, valor, iId >= 0 ? c[iId] || undefined : undefined, ehCartao);
    return l ? [l] : [];
  });
  return { linhas, ehCartao };
}

/** Lê um extrato (OFX ou CSV). Linhas repetidas no próprio arquivo ficam uma vez só. */
export function lerExtrato(texto: string): Extrato {
  const extrato = /<OFX>|<STMTTRN>/i.test(texto) ? lerOFX(texto) : lerCSV(texto);
  const vistos = new Map<string, number>();
  // Duas compras iguais no mesmo dia são possíveis: numera em vez de descartar
  const linhas = extrato.linhas.map((l) => {
    const n = vistos.get(l.id) ?? 0;
    vistos.set(l.id, n + 1);
    return n ? { ...l, id: `${l.id}#${n}` } : l;
  });
  return { ...extrato, linhas };
}

const diasEntre = (a: string, b: string) =>
  Math.abs(new Date(`${a}T12:00:00`).getTime() - new Date(`${b}T12:00:00`).getTime()) / 864e5;

/** Valores "iguais": exatos, ou bem perto (até 2%) quando é da mesma categoria (ex.: mercado lançado com centavos de diferença). */
function valorParecido(a: number, b: number, mesmaCategoria: boolean) {
  const diferenca = Math.abs(a - b);
  return diferenca < 0.01 || (mesmaCategoria && diferenca <= Math.max(a, b) * 0.02);
}

/**
 * O que já está no app e parece ser esta linha do extrato (para não duplicar o que a pessoa já tinha lançado).
 * Vale: o mesmo id de extrato; ou mesmo tipo e valor parecido com até 3 dias de diferença,
 * em qualquer conta (lançamentos antigos podem estar sem conta ou na conta errada).
 * Devolve a descrição do que já existe, ou null.
 */
export function jaExiste(
  l: LinhaExtrato,
  contaId: string,
  lancamentos: Lancamento[],
  compras: CompraCartao[],
  ehCartao: boolean,
): string | null {
  const perto = (data: string) => diasEntre(data, l.data) <= 3;
  if (ehCartao) {
    const c = compras.find(
      (c) =>
        c.extratoId === l.id ||
        (c.cartaoId === contaId && perto(c.data) && valorParecido(c.valorTotal, l.valor, c.categoria === l.categoria)),
    );
    return c ? c.descricao : null;
  }
  const x = lancamentos.find(
    (x) =>
      x.extratoId === l.id ||
      (x.tipo === l.tipo && perto(x.data) && valorParecido(x.valor, l.valor, x.categoria === l.categoria)),
  );
  return x ? x.descricao : null;
}
