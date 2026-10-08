// Ler o extrato que a pessoa baixa no app do banco (OFX ou CSV) e transformar em lançamentos.

import type { Cartao, CompraCartao, Lancamento, Tipo } from "./store";
import { dataDoRecebimento, somarMeses } from "./formato";
import { faturaAberta, faturaDaData } from "./cartoes";

export type LinhaExtrato = {
  /** Identificador estável da linha (do banco, quando tem; senão data+valor+descrição) */
  id: string;
  data: string; // "2026-10-05"
  descricao: string;
  valor: number; // sempre positivo
  tipo: Tipo;
  categoria: string;
  /** Cartão: "Loja - Parcela 3/10" → { numero: 3, total: 10 } (o valor é o de uma parcela) */
  parcela?: { numero: number; total: number };
};

/** `saldo`: o saldo da conta que veio no arquivo (OFX tem; alguns CSV têm "Saldo do dia"). */
export type Extrato = { linhas: LinhaExtrato[]; ehCartao: boolean; saldo?: number };

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
    /netflix|spotify|disney|hbo|max\.com|prime video|amazon prime|youtube|deezer|globoplay|apple\.com|icloud|google one|chatgpt|openai|anthropic|claude/,
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

export function categoriaPelaDescricao(descricao: string, tipo: Tipo) {
  const t = semAcento(descricao);
  return PALAVRAS.find(([, tipoDa, re]) => tipoDa === tipo && re.test(t))?.[0] ?? "Outros";
}

/** Linhas que não são movimento (saldo do dia, saldo anterior…) */
const NAO_E_MOVIMENTO = /^saldo|saldo do dia|saldo anterior|saldo final|s a l d o|^total\b/;

/** "Parcela 3/10", "Parc 03/10", "3/10" no fim → { numero, total } e o título sem isso */
function separarParcela(descricao: string) {
  const m = descricao.match(/\s*[-–·]?\s*(?:parcela|parc\.?)?\s*(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\s*$/i);
  if (!m) return { descricao, parcela: undefined };
  const numero = Number(m[1]);
  const total = Number(m[2]);
  // "3/10" solto pode ser data (03/10): só vale se disser "parcela" ou se o número for menor que o total
  const disseParcela = /parc/i.test(m[0]);
  if (!(total >= 2 && numero >= 1 && numero <= total) || (!disseParcela && total > 24)) return { descricao, parcela: undefined };
  return { descricao: descricao.slice(0, m.index).trim(), parcela: { numero, total } };
}

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
  const { descricao: semParcela, parcela } = ehCartao ? separarParcela(desc) : { descricao: desc, parcela: undefined };
  return {
    id: idBanco ? `b:${idBanco}` : `${data}|${valor}|${semAcento(desc).slice(0, 40)}`,
    data,
    descricao: limparDescricao(semParcela) || "Sem descrição",
    valor,
    tipo,
    categoria: categoriaPelaDescricao(desc, tipo),
    ...(parcela ? { parcela } : {}),
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
  // Saldo da conta (no cartão, o BALAMT é a fatura: não serve)
  const saldoTexto = ehCartao ? "" : campoOFX(texto.split(/<LEDGERBAL>/i)[1] ?? "", "BALAMT");
  const saldo = saldoTexto ? lerNumero(saldoTexto) : NaN;
  return { linhas, ehCartao, ...(Number.isFinite(saldo) ? { saldo } : {}) };
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

  let saldo: number | undefined;
  const linhas = linhasTexto.slice(inicio + 1).flatMap((texto) => {
    const c = separarCSV(texto, sep);
    let valor = lerNumero(c[iValor] ?? "");
    // "Saldo do dia" / "Saldo": guarda o último (é o saldo da conta no fim do extrato)
    if (/^s ?a ?l ?d ?o/.test(semAcento(c[iDesc] ?? "")) && Number.isFinite(valor)) {
      saldo = valor;
      return [];
    }
    const tipoTexto = semAcento(c[iTipo] ?? "");
    // Banco que manda o valor sempre positivo e diz o tipo em outra coluna
    if (iTipo >= 0 && valor > 0 && /saida|debito|^d$/.test(tipoTexto)) valor = -valor;
    const descricao = [c[iDesc] ?? "", iDetalhe >= 0 ? (c[iDetalhe] ?? "") : ""].filter(Boolean).join(" · ");
    const l = linha(c[iData] ?? "", descricao, valor, iId >= 0 ? c[iId] || undefined : undefined, ehCartao);
    return l ? [l] : [];
  });
  return { linhas, ehCartao, ...(saldo !== undefined && !ehCartao ? { saldo } : {}) };
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

/** O que já está no app e parece ser a mesma movimentação. */
export type Existente = {
  id: string;
  descricao: string;
  data: string;
  valor: number;
  contaId?: string;
  /** Igualzinho (mesmo dia, valor e conta, ou já veio deste extrato): não precisa perguntar */
  exato: boolean;
};

const palavras = (texto: string) =>
  semAcento(texto)
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 4);
/** Os nomes têm alguma palavra em comum? ("Netflix.com" × "Netflix") */
export function nomesParecidos(a: string, b: string) {
  const pb = new Set(palavras(b));
  return palavras(a).some((p) => pb.has(p));
}

/**
 * O que já está no app e parece ser esta linha do extrato (para não duplicar o que a pessoa já tinha lançado).
 * - Conta: mesmo id de extrato; ou lançamento JÁ PAGO, do mesmo tipo, valor parecido e até 3 dias de diferença
 *   (os que ainda estão a pagar aparecem como previstos, para serem confirmados).
 * - Cartão: compra com o mesmo id; ou mesmo valor e até 3 dias; parcela: compra com o mesmo nº de parcelas e o mesmo valor da parcela.
 * `usados`: cada coisa do app só vale para uma linha (duas padarias de R$ 10 no extrato não somem por causa de uma no app).
 * Entre os parecidos, fica o da mesma conta e mais perto na data.
 */
export function jaExiste(
  l: LinhaExtrato,
  contaId: string,
  lancamentos: Lancamento[],
  compras: CompraCartao[],
  ehCartao: boolean,
  usados: Set<string> = new Set(),
): Existente | null {
  const perto = (data: string) => diasEntre(data, l.data) <= 3;
  const igual = (data: string, valor: number, conta?: string) =>
    data === l.data && Math.abs(valor - l.valor) < 0.01 && conta === contaId;
  const melhor = <T extends { id: string; data: string }>(lista: T[], conta: (x: T) => string | undefined) =>
    lista
      .filter((x) => !usados.has(x.id))
      .sort(
        (a, b) =>
          Number(conta(b) === contaId) - Number(conta(a) === contaId) || diasEntre(a.data, l.data) - diasEntre(b.data, l.data),
      )[0];

  if (ehCartao) {
    const p = l.parcela;
    const c =
      compras.find((c) => c.extratoId === l.id && !usados.has(c.id)) ??
      melhor(
        compras.filter((c) =>
          p
            ? c.cartaoId === contaId &&
              c.parcelas === p.total &&
              Math.abs(c.valorTotal / c.parcelas - l.valor) <= 0.05 &&
              nomesParecidos(c.descricao, l.descricao)
            : c.cartaoId === contaId && perto(c.data) && valorParecido(c.valorTotal, l.valor, c.categoria === l.categoria),
        ),
        (c) => c.cartaoId,
      );
    if (!c) return null;
    usados.add(c.id);
    const exato = c.extratoId === l.id || (!!p && c.parcelas === p.total) || igual(c.data, c.valorTotal, c.cartaoId);
    return {
      id: c.id,
      descricao: c.descricao,
      data: c.data,
      valor: p ? c.valorTotal / c.parcelas : c.valorTotal,
      contaId: c.cartaoId,
      exato,
    };
  }
  const x =
    lancamentos.find((x) => x.extratoId === l.id && !usados.has(x.id)) ??
    melhor(
      lancamentos.filter(
        (x) => x.pago && x.tipo === l.tipo && perto(x.data) && valorParecido(x.valor, l.valor, x.categoria === l.categoria),
      ),
      (x) => x.contaId,
    );
  if (!x) return null;
  usados.add(x.id);
  const exato = x.extratoId === l.id || igual(x.data, x.valor, x.contaId);
  return { id: x.id, descricao: x.descricao, data: x.data, valor: x.valor, contaId: x.contaId, exato };
}

// ---------- Para montar o app a partir dos extratos ----------

const BANCOS: [string, RegExp][] = [
  ["Nubank", /nubank|nu pagamentos|^nu_|\b0?260\b/],
  ["Banco do Brasil", /banco do brasil|\bbb\b|\b0?001\b/],
  ["Itaú", /itau|\b341\b/],
  ["Bradesco", /bradesco|\b237\b/],
  ["Santander", /santander|\b0?33\b/],
  ["Caixa", /caixa|\b104\b/],
  ["Inter", /\binter\b|banco inter|\b0?77\b/],
  ["C6 Bank", /\bc6\b|\b336\b/],
  ["PicPay", /picpay|\b380\b/],
  ["Mercado Pago", /mercado ?pago|\b323\b/],
  ["PagBank", /pagbank|pagseguro|\b290\b/],
  ["Neon", /\bneon\b|\b536\b/],
  ["Sicoob", /sicoob|\b756\b/],
  ["Sicredi", /sicredi|\b748\b/],
];

/** Qual banco é o arquivo: pelo nome do arquivo, pelo <ORG>/<BANKID> do OFX ou pelo texto. "" se não der para saber. */
export function bancoDoArquivo(nomeArquivo: string, texto: string) {
  const ofx = [campoOFX(texto, "ORG"), campoOFX(texto, "BANKID"), campoOFX(texto, "FID")].join(" ");
  const onde = semAcento(`${nomeArquivo} ${ofx}`);
  return (
    BANCOS.find(([, re]) => re.test(onde))?.[0] ?? BANCOS.find(([, re]) => re.test(semAcento(texto.slice(0, 600))))?.[0] ?? ""
  );
}

/** O salário (ou a maior entrada que se parece com renda) do extrato, a mais recente. */
export function detectarSalario(linhas: LinhaExtrato[]) {
  const entradas = linhas.filter((l) => l.tipo === "entrada");
  const salario = entradas.filter((l) => l.categoria === "Salário");
  const candidatas = salario.length ? salario : entradas.filter((l) => l.valor >= 300 && !/^pix de /i.test(l.descricao));
  const lista = candidatas.length ? candidatas : entradas.filter((l) => l.valor >= 300);
  if (!lista.length) return null;
  const maior = Math.max(...lista.map((l) => l.valor));
  // A mais recente entre as maiores (até 10% menor que a maior)
  const l = lista.filter((x) => x.valor >= maior * 0.9).sort((a, b) => b.data.localeCompare(a.data))[0];
  return { valor: l.valor, dia: Number(l.data.slice(8, 10)), descricao: l.descricao, data: l.data };
}

/** A mesma compra parcelada (mesmo nome, nº de parcelas e valor) */
export const chaveDaCompra = (l: LinhaExtrato) => `${l.descricao.toLowerCase()}|${l.parcela?.total}|${l.valor}`;

/** Parcelas da mesma compra no arquivo (2/10, 3/10…): só a mais recente vale (a compra entra uma vez só). */
export function parcelaRepetida(linhas: LinhaExtrato[]) {
  const ultima = new Map<string, number>();
  for (const l of linhas)
    if (l.parcela) ultima.set(chaveDaCompra(l), Math.max(ultima.get(chaveDaCompra(l)) ?? 0, l.parcela.numero));
  return (l: LinhaExtrato) => !!l.parcela && ultima.get(chaveDaCompra(l)) !== l.parcela.numero;
}

/** Linha do extrato do cartão → compra (parcelada, se for "Parcela N/M"), com as parcelas que já passaram como pagas. */
export function compraDoExtrato(
  l: LinhaExtrato,
  cartao: Pick<Cartao, "id" | "diaFechamento" | "diaVencimento">,
): Omit<CompraCartao, "id"> {
  const parcelas = l.parcela?.total ?? 1;
  const numero = l.parcela?.numero ?? 1;
  // A parcela N caiu N-1 meses depois da compra
  const data =
    numero > 1 ? dataDoRecebimento(String(Number(l.data.slice(8, 10))), somarMeses(l.data.slice(0, 7), -(numero - 1))) : l.data;
  // Faturas que já fecharam: a parcela entra no histórico, mas não volta a cobrar
  const fechou = faturaDaData(l.data, cartao) < faturaAberta(cartao);
  const pagas = numero - 1 + (fechou ? 1 : 0);
  return {
    cartaoId: cartao.id,
    descricao: l.descricao,
    categoria: l.categoria,
    valorTotal: Math.round(l.valor * parcelas * 100) / 100,
    parcelas,
    parcelasPagas: pagas || undefined,
    data,
    extratoId: l.id,
    importado: true,
  };
}

/**
 * A pessoa colocou o arquivo no espaço do cartão, mas ele não se identificou como cartão (CSV de outro banco).
 * Se a maioria vier como "entrada", o banco usa compra positiva: inverte. As categorias são refeitas.
 */
export function comoCartao(extrato: Extrato): Extrato {
  if (extrato.ehCartao) return extrato;
  const entradas = extrato.linhas.filter((l) => l.tipo === "entrada").length;
  const inverter = entradas > extrato.linhas.length / 2;
  const linhas = extrato.linhas.map((l) => {
    const tipo: Tipo = inverter ? (l.tipo === "entrada" ? "saida" : "entrada") : l.tipo;
    const { descricao, parcela } = separarParcela(l.descricao);
    return { ...l, tipo, descricao, categoria: categoriaPelaDescricao(l.descricao, tipo), ...(parcela ? { parcela } : {}) };
  });
  return { linhas, ehCartao: true };
}

/**
 * Tipos de arquivo do seletor. No Android, só a extensão (.ofx) não basta: o seletor deixa o arquivo cinza
 * (não conhece o tipo). Por isso vão também os tipos genéricos com que os bancos mandam o OFX e o CSV.
 */
export const ARQUIVOS_DE_EXTRATO =
  ".ofx,.qfx,.csv,.txt,text/plain,text/csv,text/comma-separated-values,application/x-ofx,application/vnd.intu.qfx,application/octet-stream,application/vnd.ms-excel";
