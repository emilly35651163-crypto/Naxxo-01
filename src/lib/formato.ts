// Funções para mostrar e ler valores, datas e meses no formato brasileiro.

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function brl(valor: number) {
  return moeda.format(valor);
}

function doisDigitos(n: number) {
  return String(n).padStart(2, "0");
}

/** Data de hoje no formato "2026-10-05". */
export function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
}

/** Mês atual no formato "2026-10". */
export function mesAtual() {
  return hojeISO().slice(0, 7);
}

/** "2026-10" + 1 -> "2026-11" */
export function somarMeses(mes: string, quantidade: number) {
  const [ano, m] = mes.split("-").map(Number);
  const d = new Date(ano, m - 1 + quantidade, 1);
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}`;
}

/** "2026-10" -> "Outubro 2026" */
export function nomeMes(mes: string) {
  const [ano, m] = mes.split("-").map(Number);
  const nome = new Date(ano, m - 1, 1).toLocaleDateString("pt-BR", { month: "long" });
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} ${ano}`;
}

/** "2026-10" -> "out" */
export function nomeMesCurto(mes: string) {
  const [ano, m] = mes.split("-").map(Number);
  return new Date(ano, m - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}

/** Quantos meses de "2026-10" até "2027-01" (= 3). */
export function mesesEntre(de: string, ate: string) {
  const [a1, m1] = de.split("-").map(Number);
  const [a2, m2] = ate.split("-").map(Number);
  return a2 * 12 + m2 - (a1 * 12 + m1);
}

// ---------- Dia de recebimento ----------
// Guardado como texto: "5" (todo dia 5), "5u" (5º dia útil) ou "ultimo-util" (último dia útil).

export const OPCOES_DIA_RECEBIMENTO = [
  ...[1, 2, 3, 4, 5].map((n) => ({ valor: `${n}u`, nome: `${n}º dia útil` })),
  { valor: "ultimo-util", nome: "Último dia útil" },
  ...Array.from({ length: 31 }, (_, i) => ({ valor: String(i + 1), nome: `Dia ${i + 1}` })),
];

export function nomeDoDia(dia: string) {
  return OPCOES_DIA_RECEBIMENTO.find((o) => o.valor === dia)?.nome ?? "";
}

/** Domingo de Páscoa (algoritmo de Meeus): base dos feriados que mudam de data. */
function pascoa(ano: number) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

const feriadosPorAno = new Map<number, Set<string>>();

/** Feriados nacionais em que os bancos não abrem (o salário do "5º dia útil" pula esses dias). */
export function feriadosNacionais(ano: number) {
  const salvo = feriadosPorAno.get(ano);
  if (salvo) return salvo;
  const p = pascoa(ano);
  const somar = (dias: number) => {
    const x = new Date(p.getFullYear(), p.getMonth(), p.getDate() + dias);
    return `${doisDigitos(x.getMonth() + 1)}-${doisDigitos(x.getDate())}`;
  };
  const datas = new Set([
    // Fixos
    "01-01",
    "04-21",
    "05-01",
    "09-07",
    "10-12",
    "11-02",
    "11-15",
    "11-20",
    "12-25",
    // Que mudam com a Páscoa: Carnaval (segunda e terça), Sexta-feira Santa e Corpus Christi
    somar(-48),
    somar(-47),
    somar(-2),
    somar(60),
  ]);
  feriadosPorAno.set(ano, datas);
  return datas;
}

function diaUtil(d: Date) {
  if (d.getDay() === 0 || d.getDay() === 6) return false;
  return !feriadosNacionais(d.getFullYear()).has(`${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`);
}

/** A data em que cai o recebimento naquele mês. Ex.: ("5u", "2026-10") -> "2026-10-07" */
export function dataDoRecebimento(dia: string, mes: string) {
  const [ano, m] = mes.split("-").map(Number);
  const ultimoDia = new Date(ano, m, 0).getDate();
  let numero: number;

  if (dia === "ultimo-util") {
    numero = ultimoDia;
    while (!diaUtil(new Date(ano, m - 1, numero))) numero--;
  } else if (dia.endsWith("u")) {
    const alvo = Number(dia.slice(0, -1));
    let contados = 0;
    numero = 0;
    while (contados < alvo && numero < ultimoDia) {
      numero++;
      if (diaUtil(new Date(ano, m - 1, numero))) contados++;
    }
  } else {
    numero = Math.min(Number(dia), ultimoDia);
  }
  return `${mes}-${doisDigitos(numero)}`;
}

/** Próxima data de recebimento a partir de hoje (este mês, se ainda não passou; senão, o próximo). */
export function proximoRecebimento(dia: string) {
  const hoje = hojeISO();
  const desteMes = dataDoRecebimento(dia, mesAtual());
  return desteMes >= hoje ? desteMes : dataDoRecebimento(dia, somarMeses(mesAtual(), 1));
}

/** Quantos dias de hoje até a data ("2026-10-12" -> 7). */
export function diasAte(data: string) {
  const [a, m, d] = data.split("-").map(Number);
  const hoje = new Date();
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((new Date(a, m - 1, d).getTime() - inicioHoje.getTime()) / 86_400_000);
}

/** "2026-10-05" + 10 dias -> "2026-10-15" */
export function somarDias(data: string, dias: number) {
  const [a, m, d] = data.split("-").map(Number);
  const nova = new Date(a, m - 1, d + dias);
  return `${nova.getFullYear()}-${doisDigitos(nova.getMonth() + 1)}-${doisDigitos(nova.getDate())}`;
}

/** Quantos dias de uma data até outra. */
export function diasEntre(de: string, ate: string) {
  const [a1, m1, d1] = de.split("-").map(Number);
  const [a2, m2, d2] = ate.split("-").map(Number);
  return Math.round((new Date(a2, m2 - 1, d2).getTime() - new Date(a1, m1 - 1, d1).getTime()) / 86_400_000);
}

/** "2026-10-05" -> "05/10" */
export function formatarData(data: string) {
  const [, m, d] = data.split("-");
  return `${d}/${m}`;
}

/** Deixa só números no que a pessoa digita (com vírgula/ponto quando `decimal`; com sinal de menos quando `negativo`). */
export function soNumeros(texto: string, decimal = true, negativo = false) {
  const limpo = texto.replace(decimal ? /[^\d.,]/g : /\D/g, "");
  return negativo && texto.trim().startsWith("-") ? `-${limpo}` : limpo;
}

/** Lê o que a pessoa digitou ("1.500", "1.500,90", "35,5", "-150") e devolve um número. */
export function lerValor(texto: string) {
  const negativo = texto.trim().startsWith("-");
  const limpo = texto.replace(/[^\d,.]/g, "");
  let numero: number;
  if (limpo.includes(",")) numero = Number(limpo.replace(/\./g, "").replace(",", "."));
  else if (/^\d{1,3}(\.\d{3})+$/.test(limpo)) numero = Number(limpo.replace(/\./g, ""));
  else numero = Number(limpo);
  return negativo ? -numero : numero;
}

/** Mostra o valor digitado no jeito brasileiro: "1500" → "1.500,00". Vazio continua vazio. */
export function formatarDigitado(texto: string) {
  if (!texto.trim() || texto.trim() === "-") return texto;
  const n = lerValor(texto);
  if (!Number.isFinite(n)) return texto;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Número para o campo de valor ("1500.5" → "1.500,50"). */
export function valorParaCampo(n: number | null | undefined) {
  return n == null ? "" : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
