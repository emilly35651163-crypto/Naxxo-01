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
  subcategoria?: string;
  /** Como veio escrito no banco (antes de limpar) */
  original: string;
  /** Nenhuma regra teve certeza da categoria */
  revisar?: boolean;
  /** Cartão: "Loja - Parcela 3/10" → { numero: 3, total: 10 } (o valor é o de uma parcela) */
  parcela?: { numero: number; total: number };
};

/** `saldo`: o saldo da conta que veio no arquivo (OFX tem; alguns CSV têm "Saldo do dia"). */
export type Extrato = { linhas: LinhaExtrato[]; ehCartao: boolean; saldo?: number };

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** "1.234,56" · "-12.50" · "R$ 12,50" · "12,5" → número (com sinal) */
export function lerNumero(texto: string) {
  let t = texto.replace(/[R$\s"]/g, "");
  // BB, Caixa e outros: "12,50 D" (débito, sai) e "12,50 C" (crédito, entra)
  const dc = t.match(/^([DC])(?=[\d-])|(?<=\d)([DC])$/i);
  if (dc) t = t.replace(/^[DC]|[DC]$/i, "");
  const negativo = /^-|-$|^\(.*\)$/.test(t) || (!!dc && (dc[1] ?? dc[2]).toUpperCase() === "D");
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

// Palavras que dizem a categoria e a subcategoria (a primeira que bater vale). As mais certeiras vêm primeiro.
// Sem nenhuma que bata, o item fica "para revisar" (o app nunca põe "Outros" sozinho).
const PALAVRAS: [categoria: string, sub: string | undefined, tipo: Tipo, re: RegExp][] = [
  // Não são gasto nem ganho
  [
    "Fatura do cartão",
    undefined,
    "saida",
    /pagamento de fatura|pagto fatura|pagamento fatura|fatura cartao|pgto cartao|pag fatura|pagamento cartao/,
  ],
  [
    "Guardar (metas)",
    undefined,
    "saida",
    /aplicacao|aplic\b|aplic\.|investimento cdb|compra de titulo|tesouro direto|caixinha|cofrinho|porquinho|guardado/,
  ],
  ["Guardar (metas)", undefined, "entrada", /resgate|resg\b|resg\.|caixinha|cofrinho|porquinho/],
  // Banco
  ["Impostos e taxas", "IOF", "saida", /\biof\b/],
  [
    "Impostos e taxas",
    "Tarifas bancárias",
    "saida",
    /\btar\b|tarifa|cesta de servicos|pacote de servicos|anuidade|taxa de manutencao/,
  ],
  ["Dívidas e juros", "Juros", "saida", /juros|encargos|\bmora\b|multa por atraso/],
  ["Dívidas e juros", "Cheque especial", "saida", /cheque especial|limite da conta/],
  ["Dívidas e juros", "Empréstimo", "saida", /emprestimo|consignado|financiamento pessoal|parc emprest/],
  ["Saque", "Dinheiro em espécie", "saida", /\bsaque\b|\bsaq\b|banco24horas/],
  ["Impostos e taxas", "Imposto de renda", "saida", /receita federal|darf|imposto de renda|\birpf\b/],
  ["Trabalho", "MEI / impostos do trabalho", "saida", /\bdas\b|simples nacional|\bmei\b/],
  // Entradas
  ["Salário", "Adiantamento", "entrada", /adiantamento|vale salarial/],
  ["Salário", "13º", "entrada", /\b13o\b|decimo terceiro|13 salario/],
  ["Salário", "Férias", "entrada", /\bferias\b/],
  ["Salário", "PLR / bônus", "entrada", /\bplr\b|participacao nos lucros|bonus|bonificacao/],
  ["Salário", "Salário", "entrada", /salario|folha|pagto sal|proventos|remuneracao|vencimentos/],
  ["Benefícios", "Vale-refeição", "entrada", /vale refeicao|\bvr\b|refeicao/],
  ["Benefícios", "Vale-alimentação", "entrada", /vale alimentacao|\bva\b|alimentacao/],
  ["Benefícios", "Vale-transporte", "entrada", /vale transporte|\bvt\b/],
  [
    "Benefícios",
    "Auxílio do governo",
    "entrada",
    /bolsa familia|auxilio|\binss\b|beneficio social|seguro desemprego|\bfgts\b|\bpis\b|abono/,
  ],
  ["Investimentos", "Rendimento", "entrada", /rendimento|rend pago|remuneracao da conta/],
  ["Investimentos", "Dividendos", "entrada", /dividendo|\bjcp\b|juros sobre capital/],
  ["Reembolso e estorno", "Cashback", "entrada", /cashback|cash back/],
  ["Reembolso e estorno", "Estorno de compra", "entrada", /estorno|devolucao|chargeback|cancelamento/],
  ["Reembolso e estorno", "Reembolso", "entrada", /reembolso|ressarcimento/],
  ["Trabalho por conta", "Vendas", "entrada", /\bvenda|pagseguro|pagbank|sumup|\bstone\b|cielo|getnet|infinitepay/],
  // Casa
  ["Moradia", "Aluguel", "saida", /aluguel|imobiliaria|quinto ?andar/],
  ["Moradia", "Condomínio", "saida", /condominio|\bcond\b/],
  ["Moradia", "IPTU", "saida", /\biptu\b/],
  ["Moradia", "Móveis e decoração", "saida", /tok ?stok|\betna\b|mobly|madeira ?madeira/],
  ["Moradia", "Manutenção e reparos", "saida", /leroy|telhanorte|material de construcao|ferragens|eletricista|encanador/],
  [
    "Contas da casa",
    "Luz",
    "saida",
    /\benel\b|energia|\bluz\b|cemig|copel|light s|celesc|coelba|celpe|cosern|equatorial|neoenergia|\bcpfl\b|elektro|\bedp\b/,
  ],
  ["Contas da casa", "Água", "saida", /sabesp|\bagua\b|saneamento|copasa|cedae|compesa|embasa|sanepar|\bcasan\b|aguas de/],
  ["Contas da casa", "Gás", "saida", /\bgas\b|comgas|ultragaz|liquigas|supergasbras|naturgy/],
  ["Contas da casa", "Internet", "saida", /internet|fibra|net servicos|brisanet|\balgar\b/],
  ["Contas da casa", "Celular", "saida", /\bclaro\b|\bvivo\b|\btim\b|\boi\b|telefon|recarga (de )?celular/],
  // Comida
  ["Mercado", "Atacarejo", "saida", /atacad|assai|atacarejo|\bmakro\b|tenda atacado/],
  ["Mercado", "Padaria", "saida", /padaria|panificadora|\bpao\b(?! de acucar)|confeitaria/],
  ["Mercado", "Açougue", "saida", /acougue|casa de carnes|frigorifico/],
  ["Mercado", "Hortifrúti", "saida", /hortifruti|sacolao|quitanda|\bfeira\b|verdurao|frutaria/],
  [
    "Mercado",
    "Compra avulsa",
    "saida",
    /mercado(?! ?livre| ?pago)|supermerc|carrefour|\bextra\b|pao de acucar|\bdia\b|\boxxo\b|hirota|st marche|savegnago|zaffari|guanabara|prezunic|muffato|angeloni/,
  ],
  ["Alimentação fora", "Delivery", "saida", /ifood|rappi|aiqfome|ze delivery|uber ?eats/],
  ["Alimentação fora", "Café", "saida", /\bcafe\b|cafeteria|starbucks|coffee/],
  ["Alimentação fora", "Bar", "saida", /\bbar\b|boteco|cervejaria|choperia|\bpub\b/],
  [
    "Alimentação fora",
    "Lanche",
    "saida",
    /lanch|burger|mcdonald|\bbk\b|habib|subway|pizz|esfiha|pastel|sorvete|\bacai\b|doceria|\bkfc\b|popeyes|giraffas/,
  ],
  [
    "Alimentação fora",
    "Restaurante",
    "saida",
    /restaur|churrascaria|cantina|sushi|temaki|bistro|outback|madero|coco bambu|\bfood\b|grill/,
  ],
  // Transporte
  ["Transporte", "Combustível", "saida", /posto|combust|\bshell\b|ipiranga|petrobras|raizen|gasolina|etanol/],
  ["Transporte", "App de corrida", "saida", /\buber\b|99 ?app|99pop|99 tecnologia|indriver|cabify/],
  ["Transporte", "Estacionamento", "saida", /estacion|estapar|zona azul|parking/],
  ["Transporte", "Pedágio", "saida", /pedagio|sem parar|conectcar|\bveloe\b|move mais/],
  [
    "Transporte",
    "Ônibus / metrô",
    "saida",
    /metro|onibus|bilhete|sptrans|recarga bom|\bcptm\b|riocard|cartao bom|\bbrt\b|rodoviaria/,
  ],
  ["Transporte", "IPVA / licenciamento", "saida", /\bipva\b|licenciamento|detran/],
  ["Transporte", "Manutenção do carro", "saida", /oficina|auto center|autopecas|\bpneu|mecanica|lava ?rapido|troca de oleo/],
  ["Transporte", "Multa", "saida", /multa de transito|infracao/],
  // Saúde e cuidados
  ["Saúde", "Farmácia", "saida", /farma|drogaria|droga|\braia\b|pacheco|pague menos|panvel|nissei|venancio/],
  ["Saúde", "Plano de saúde", "saida", /unimed|\bamil\b|bradesco saude|sulamerica|hapvida|notredame|plano de saude/],
  ["Saúde", "Dentista", "saida", /dental|odonto|dentista/],
  ["Saúde", "Exames", "saida", /laborat|fleury|\bdasa\b|delboni|lavoisier|hermes pardini|exame/],
  ["Saúde", "Terapia", "saida", /psicolog|terapia|terapeuta/],
  ["Saúde", "Ótica", "saida", /otica|oculos|chilli beans/],
  ["Saúde", "Consulta", "saida", /hospital|clinica|medic|consulta/],
  [
    "Cuidados pessoais",
    "Academia",
    "saida",
    /academia|smart ?fit|bluefit|bodytech|selfit|crossfit|gympass|wellhub|totalpass|pilates/,
  ],
  ["Cuidados pessoais", "Cabelo", "saida", /cabelei|salao|barbearia|barber/],
  ["Cuidados pessoais", "Unha", "saida", /manicure|esmalteria/],
  ["Cuidados pessoais", "Cosméticos", "saida", /boticario|\bnatura\b|sephora|\bavon\b|eudora|beleza na web|epoca cosmeticos/],
  ["Cuidados pessoais", "Estética", "saida", /estetica|depilacao|\bspa\b|massagem/],
  // Assinaturas
  [
    "Assinaturas",
    "Streaming",
    "saida",
    /netflix|disney|\bhbo\b|max\.com|prime video|globoplay|paramount|crunchyroll|\bmubi\b|apple tv|telecine/,
  ],
  ["Assinaturas", "Música", "saida", /spotify|deezer|youtube music|apple music|\btidal\b/],
  ["Assinaturas", "IA", "saida", /chatgpt|openai|anthropic|claude|gemini|midjourney|perplexity/],
  [
    "Assinaturas",
    "Apps e nuvem",
    "saida",
    /icloud|apple\.com|google one|google storage|dropbox|microsoft|office 365|\bcanva\b|adobe|notion|youtube premium|amazon prime|google play|app store/,
  ],
  // Educação, filhos, pets
  ["Educação", "Mensalidade", "saida", /escola|colegio|faculdade|universidade|mensalidade/],
  ["Educação", "Curso", "saida", /curso|udemy|alura|coursera|hotmart|eduzz|kiwify|idiomas/],
  ["Educação", "Livros", "saida", /livraria|\blivro|estante virtual|kindle/],
  ["Pets", "Ração", "saida", /racao/],
  ["Pets", "Veterinário", "saida", /veterin/],
  ["Pets", "Banho e tosa", "saida", /banho e tosa/],
  ["Pets", "Petshop", "saida", /\bpetz\b|cobasi|petlove|pet ?shop|\bpet\b/],
  ["Filhos", "Fraldas e higiene", "saida", /fralda|pampers|huggies/],
  ["Filhos", "Brinquedos", "saida", /ri happy|pb kids|brinquedo/],
  // Lazer
  ["Lazer", "Cinema / shows", "saida", /cinema|cinemark|kinoplex|ingresso|sympla|eventim|\bshow\b/],
  ["Lazer", "Jogos", "saida", /steam|playstation|xbox|nintendo|epic games|\briot\b|garena|blizzard/],
  ["Lazer", "Hospedagem", "saida", /hotel|airbnb|booking|pousada|hostel/],
  ["Lazer", "Viagem", "saida", /\blatam\b|gol linhas|azul linhas|decolar|123 ?milhas|maxmilhas|passagem aerea|viagem|\bcvc\b/],
  // Compras
  [
    "Compras",
    "Lojas online",
    "saida",
    /shopee|mercado ?livre|mercadolivre|\bmeli\b|amazon|magalu|magazine|americanas|shein|aliexpress|\btemu\b|kabum|casas bahia|ponto frio/,
  ],
  ["Compras", "Roupas", "saida", /renner|riachuelo|\bc ?& ?a\b|\bcea\b|marisa|hering|\bzara\b|pernambucanas|lojas torra|youcom/],
  ["Compras", "Calçados", "saida", /netshoes|arezzo|centauro|calcados|sapataria|\bnike\b|adidas|olympikus|havaianas/],
  ["Compras", "Eletrônicos", "saida", /fast shop|apple store|samsung|xiaomi|eletron|informatica/],
  ["Compras", "Casa e utilidades", "saida", /\bhavan\b|daiso|utilidades|camicado/],
  ["Compras", "Presentes", "saida", /presente|floricultura/],
  // Ajuda e seguros
  ["Doações e ajuda", "Igreja / dízimo", "saida", /igreja|dizimo|paroquia|assembleia de deus|congregacao/],
  ["Doações e ajuda", "Vaquinha", "saida", /vakinha|vaquinha|kickante|benfeitoria/],
  ["Doações e ajuda", "Doação", "saida", /doacao|\bong\b|unicef|medicos sem fronteiras/],
  ["Seguros", "Vida", "saida", /seguro de vida|prudential|mag seguros|metlife/],
  ["Seguros", "Outros seguros", "saida", /seguro|seguradora|porto seguro|tokio marine|allianz|mapfre|youse/],
];

/** Categoria e subcategoria pela descrição. `certo: false` = nenhuma palavra bateu (fica para revisar). */
export function classificarPelaDescricao(
  descricao: string,
  tipo: Tipo,
): { categoria: string; subcategoria?: string; certo: boolean } {
  const t = semAcento(descricao);
  const achou = PALAVRAS.find(([, , tipoDa, re]) => tipoDa === tipo && re.test(t));
  if (achou) return { categoria: achou[0], subcategoria: achou[1], certo: true };
  // Sem palavra: a melhor aposta (Pix recebido costuma ser de pessoas), mas fica para revisar
  return { categoria: tipo === "entrada" && /pix|ted|transf/.test(t) ? "Recebido de pessoas" : "Outros", certo: false };
}

/** Os campos de categoria de uma linha do extrato (sem "Outros": o incerto vai para revisar) */
function categorizar(descricao: string, tipo: Tipo) {
  const c = classificarPelaDescricao(descricao, tipo);
  return { categoria: c.categoria, subcategoria: c.subcategoria, revisar: c.certo ? undefined : true };
}

export function categoriaPelaDescricao(descricao: string, tipo: Tipo) {
  return classificarPelaDescricao(descricao, tipo).categoria;
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
  // "Pix - Enviado - Fulano" (BB) → "Pix enviado - Fulano"
  descricao = descricao.replace(/\b(pix|ted|doc)\s+-\s+(enviad[oa]|recebid[oa])\b/i, "$1 $2");
  const partes = descricao.split(/\s+-\s+/).map((p) => p.trim());
  const [inicio, nome] = [semAcento(partes[0] ?? ""), partes[1] ?? ""]; // depois do nome vem CPF, agência… (fica de fora)
  if (nome) {
    if (/transferencia enviada|pix enviado|(ted|doc) enviad|transferencia pix enviada/.test(inicio))
      return `Pix para ${capitalizar(nome)}`;
    if (/transferencia recebida|pix recebido|(ted|doc) recebid/.test(inicio)) return `Pix de ${capitalizar(nome)}`;
    if (/^compra( (no|com|de|em))?( (debito|credito|cartao))*$/.test(inicio.trim())) return capitalizar(nome);
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
    ...categorizar(desc, tipo),
    original: desc,
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
    // Uns bancos põem o nome em MEMO, outros em NAME, outros dividem ("PIX ENVIADO" + "FULANO"): junta sem repetir
    const memo = campoOFX(b, "MEMO");
    const nome = campoOFX(b, "NAME");
    const descricao =
      memo && nome && !semAcento(memo).includes(semAcento(nome)) && !semAcento(nome).includes(semAcento(memo))
        ? `${memo} - ${nome}`
        : memo.length >= nome.length
          ? memo
          : nome;
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
  // Separador: o que mais aparece nas primeiras linhas (a primeira às vezes é só um título, como "Extrato Conta Corrente")
  const amostraTexto = linhasTexto.slice(0, 15).join("\n");
  const sep = [";", ",", "\t"].sort((a, b) => amostraTexto.split(b).length - amostraTexto.split(a).length)[0];
  const primeira = linhasTexto.find((l) => l.split(sep).length > 2) ?? linhasTexto[0];

  // Acha a linha do cabeçalho (algumas exportações têm linhas de título antes)
  let inicio = linhasTexto.findIndex(
    (l) => /data|date/i.test(l) && /valor|amount|value|entrada|sa[ií]da|cr[eé]dito|d[eé]bito/i.test(l) && l.split(sep).length > 2,
  );
  const temCabecalho = inicio >= 0;
  if (!temCabecalho) inicio = -1;
  const cabecalho = temCabecalho ? separarCSV(linhasTexto[inicio], sep).map(semAcento) : [];
  const coluna = (re: RegExp) => cabecalho.findIndex((c) => re.test(c));

  let iData = coluna(/^data|date/);
  let iValor = coluna(/^valor|amount|^value/);
  // Bancos com colunas separadas (C6, alguns cartões): "Entrada (R$)" e "Saída (R$)"
  const iEntrada = iValor < 0 ? coluna(/^entrada|^credito|^credit/) : -1;
  const iSaida = iValor < 0 ? coluna(/^saida|^debito|^debit/) : -1;
  if (iValor < 0 && iEntrada >= 0 && iSaida >= 0) iValor = iSaida;
  // O nome: a coluna mais "de nome" que não seja a da data nem a do valor ("Data Lançamento" não é nome!)
  const livre = (i: number) => i >= 0 && i !== iData && i !== iValor && i !== iEntrada && i !== iSaida;
  const colunaDeNome = (re: RegExp) => cabecalho.findIndex((c, i) => livre(i) && re.test(c));
  let iDesc =
    [/descri/, /historico/, /^titulo|title/, /estabelecimento/, /lancamento/, /memo/, /transaction_type|tipo de transacao/]
      .map(colunaDeNome)
      .find((i) => i >= 0) ?? -1;
  // Nome em duas colunas ("Histórico: Pix enviado" + "Descrição: Fulano", como no Inter)
  const iSegundo = cabecalho.findIndex((c, i) => livre(i) && i !== iDesc && /descri|historico|^titulo/.test(c));
  // Na ordem das colunas: "Pix enviado" (histórico/título) vem antes de "Maria" (descrição)
  const colunasDeNome = [iDesc, iSegundo].filter((i) => i >= 0).sort((a, b) => a - b);
  const iDetalhe = cabecalho.findIndex((c, i) => livre(i) && i !== iDesc && /detalhe/.test(c));
  const iTipo = cabecalho.findIndex((c, i) => livre(i) && i !== iDesc && /tipo|natureza|d\/c|^dc$/.test(c));
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
    if (iEntrada >= 0 && iSaida >= 0) {
      // Colunas separadas: o que entrou menos o que saiu (a vazia conta como zero)
      const n = (x?: string) => (x && Number.isFinite(lerNumero(x)) ? Math.abs(lerNumero(x)) : 0);
      valor = n(c[iEntrada]) - n(c[iSaida]);
    }
    // "Saldo do dia" / "Saldo": guarda o último (é o saldo da conta no fim do extrato)
    if (/^s ?a ?l ?d ?o/.test(semAcento(c[iDesc] ?? "")) && Number.isFinite(valor)) {
      saldo = valor;
      return [];
    }
    const tipoTexto = semAcento(c[iTipo] ?? "");
    // Banco que manda o valor sempre positivo e diz o tipo em outra coluna
    if (iTipo >= 0 && valor > 0 && /saida|debito|^d$/.test(tipoTexto)) valor = -valor;
    // O detalhe do BB vem com data e hora na frente ("05/10 10:00 Fulano"): fica só o nome
    const detalhe =
      iDetalhe >= 0 ? (c[iDetalhe] ?? "").replace(/^(\d{1,2}\/\d{1,2}(\/\d{2,4})?\s*)?(\d{1,2}:\d{2}\s*)?/, "") : "";
    const descricao = [...colunasDeNome.map((i) => c[i] ?? ""), detalhe].filter(Boolean).join(" - ");
    const l = linha(c[iData] ?? "", descricao, valor, iId >= 0 ? c[iId] || undefined : undefined, ehCartao);
    return l ? [l] : [];
  });
  return { linhas, ehCartao, ...(saldo !== undefined && !ehCartao ? { saldo } : {}) };
}

/** Lê um extrato (OFX ou CSV). Linhas repetidas no próprio arquivo ficam uma vez só. */
export function lerExtrato(texto: string): Extrato {
  return arrumar(/<OFX>|<STMTTRN>/i.test(texto) ? lerOFX(texto) : lerCSV(texto));
}

/** Depois de ler (OFX, CSV ou PDF): sinal do cartão e linhas iguais numeradas */
function arrumar(extrato: Extrato): Extrato {
  if (extrato.ehCartao) {
    // Cada banco usa um sinal para a compra; a maioria das linhas de uma fatura é compra: se deu o contrário, inverte
    const entradas = extrato.linhas.filter((l) => l.tipo === "entrada").length;
    if (entradas > extrato.linhas.length / 2)
      extrato.linhas = extrato.linhas.map((l) => {
        const tipo: Tipo = l.tipo === "entrada" ? "saida" : "entrada";
        return { ...l, tipo, ...categorizar(l.original, tipo) };
      });
  }
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
    subcategoria: l.subcategoria,
    descricaoBanco: l.original,
    revisar: l.revisar || undefined,
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
    return { ...l, tipo, descricao, ...categorizar(l.original, tipo), ...(parcela ? { parcela } : {}) };
  });
  return { linhas, ehCartao: true };
}

/**
 * Tipos de arquivo do seletor. No Android, só a extensão (.ofx) não basta: o seletor deixa o arquivo cinza
 * (não conhece o tipo). Por isso vão também os tipos genéricos com que os bancos mandam o OFX e o CSV.
 */
export const ARQUIVOS_DE_EXTRATO =
  ".ofx,.qfx,.csv,.txt,.pdf,application/pdf,text/plain,text/csv,text/comma-separated-values,application/x-ofx,application/vnd.intu.qfx,application/octet-stream,application/vnd.ms-excel";

// ---------- PDF (o texto já tirado do PDF, uma linha por linha da página) ----------

const MESES_PDF: Record<string, string> = {
  jan: "01",
  fev: "02",
  mar: "03",
  abr: "04",
  mai: "05",
  jun: "06",
  jul: "07",
  ago: "08",
  set: "09",
  out: "10",
  nov: "11",
  dez: "12",
};
// Valor em reais no padrão brasileiro (vírgula nos centavos), com o sinal antes (−, +) ou depois (D, C, −)
const DINHEIRO_PDF = /(^|[\s|])([-−+])?\s*(?:R\$\s*)?(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2})(\s*[DC]\b|\s*-(?!\d))?(?=$|[\s|])/gi;
// Entrada sem sinal na linha: o que diz que entrou dinheiro
const PALAVRAS_DE_ENTRADA =
  /recebid|credito em conta|deposito|salario|estorno|rendimento|resgate|devolucao|reembolso|cashback|\bpix rec|\bted rec/;

/** Data no começo da linha: "05/10/2026", "05/10/26", "05/10", "05 OUT", "05 de outubro de 2026" → "2026-10-05" */
function dataDoPdf(texto: string, anoPadrao: string): { data: string; resto: string } | null {
  const t = texto.trim();
  let m = t.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (m) {
    const ano = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : anoPadrao;
    const dia = Number(m[1]);
    const mes = Number(m[2]);
    if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12)
      return { data: `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`, resto: t.slice(m[0].length) };
  }
  m = semAcento(t).match(
    /^(\d{1,2})\s*(?:de\s+)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\.?(?:\s*(?:de\s+)?(\d{4}))?/,
  );
  if (m) {
    const dia = Number(m[1]);
    if (dia >= 1 && dia <= 31)
      return { data: `${m[3] ?? anoPadrao}-${MESES_PDF[m[2]]}-${String(dia).padStart(2, "0")}`, resto: t.slice(m[0].length) };
  }
  return null;
}

/**
 * Extrato em PDF → movimentações. Cada banco monta o PDF de um jeito; o que quase todos têm em comum:
 * a data no começo da linha (ou um título com a data e as movimentações embaixo), a descrição e o valor
 * (às vezes seguido do saldo do dia). Sem sinal no valor: o texto diz se entrou (recebido, salário…) ou saiu.
 */
export function extratoDoPdf(linhasPdf: string[], hoje = new Date()): Extrato {
  const tudo = semAcento(linhasPdf.join("\n"));
  const ehCartao = /fatura/.test(tudo) && /vencimento/.test(tudo) && !/saldo anterior|saldo do dia|saldo em conta/.test(tudo);
  // Ano das datas sem ano: o que mais aparece no documento (ou o atual)
  const anos = (tudo.match(/\b20\d{2}\b/g) ?? []).reduce<Record<string, number>>((t, a) => ({ ...t, [a]: (t[a] ?? 0) + 1 }), {});
  const anoPadrao = Object.entries(anos).sort((a, b) => b[1] - a[1])[0]?.[0] ?? String(hoje.getFullYear());

  const linhas: LinhaExtrato[] = [];
  let dataAtual = "";
  let saldo: number | undefined;
  let anterior = ""; // a linha de cima sem valor (alguns bancos põem a descrição numa linha e o valor na outra)
  for (const bruta of linhasPdf) {
    const d = dataDoPdf(bruta, anoPadrao);
    const resto = d ? d.resto : bruta;
    const valores = [...resto.matchAll(DINHEIRO_PDF)];
    const textoSem = semAcento(resto);
    if (d) dataAtual = d.data;
    if (valores.length === 0) {
      anterior = /[a-z]{3}/i.test(resto) ? resto.replace(/\|/g, " ").trim() : "";
      continue;
    }
    // Saldo da conta (o último que aparecer)
    if (/saldo (final|atual|do dia|disponivel|em conta)|^\s*saldo\b/.test(textoSem)) {
      if (!ehCartao) {
        const v = valores[valores.length - 1];
        saldo = lerNumero(`${v[2] ?? ""}${v[3]}${v[4] ?? ""}`.replace("−", "-"));
      }
      anterior = "";
      continue;
    }
    if (!dataAtual || /\btotal\b|limite|pagamento minimo|valor minimo/.test(textoSem)) {
      anterior = "";
      continue;
    }
    // O valor é o primeiro número de dinheiro da linha (o último, quando há dois, costuma ser o saldo)
    const v = valores[0];
    const sinalAntes = (v[2] ?? "").replace("−", "-");
    const sinalDepois = (v[4] ?? "").trim().toUpperCase();
    let numero = lerNumero(v[3]);
    // Colunas viram "nome - detalhe" (como no CSV): "Pix enviado | Maria Souza" → "Pix para Maria Souza"
    let descricao = resto
      .replace(DINHEIRO_PDF, "$1")
      .split("|")
      .map((p) => p.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join(" - ");
    if (!/[a-z]{3}/i.test(descricao) && anterior) descricao = anterior;
    anterior = "";
    if (!descricao || !(numero > 0)) continue;
    const negativo = sinalAntes === "-" || sinalDepois === "D" || sinalDepois === "-";
    const positivo = sinalAntes === "+" || sinalDepois === "C";
    if (ehCartao)
      numero = negativo ? -numero : numero; // fatura: compra sem sinal; pagamento/estorno com −
    else if (negativo) numero = -numero;
    else if (!positivo && !PALAVRAS_DE_ENTRADA.test(semAcento(descricao))) numero = -numero;
    const l = linha(dataAtual, descricao, numero, undefined, ehCartao);
    if (l) linhas.push(l);
  }
  return arrumar({ linhas, ehCartao, ...(saldo !== undefined && !ehCartao ? { saldo } : {}) });
}
