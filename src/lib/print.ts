// Ler o texto de um print da fatura do cartão (já passado pelo leitor de imagem) e achar as compras.
// O print é bagunçado: nome numa linha e valor na mesma ou na de baixo, datas soltas, "Parcela 2 de 10"…
// Por isso o resultado sempre vai para uma lista que a pessoa confere antes de salvar.

import { lerNumero } from "./extrato";

export type CompraDoPrint = {
  descricao: string;
  valor: number; // o valor que aparece (de uma parcela, se for parcelado)
  parcela?: { numero: number; total: number };
  data?: string; // "2026-10-05", quando o print mostra
};

const MESES: Record<string, number> = {
  jan: 1,
  fev: 2,
  mar: 3,
  abr: 4,
  mai: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  set: 9,
  out: 10,
  nov: 11,
  dez: 12,
};

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const DINHEIRO = /(-|−)?\s*(?:R\$\s*)?(\d{1,3}(?:[.\s]\d{3})*,\d{2})(?!\d)/;
// Linhas que não são compras (resumo da fatura, limite, pagamentos…)
const NAO_E_COMPRA =
  /total|fatura|limite|disponivel|pagamento|pago|saldo|vencimento|fechamento|minimo|juros|iof|encargo|estorno|credito de|ajuste|anuidade gratis|resumo/;

function lerDataDoPrint(texto: string, hoje: Date): string | undefined {
  const t = semAcento(texto);
  let m = t.match(
    /\b(\d{1,2})\s*(?:de\s*)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\.?(?:\s*(?:de\s*)?(\d{2,4}))?/,
  );
  let dia: number | undefined;
  let mes: number | undefined;
  let ano: number | undefined;
  if (m) {
    dia = Number(m[1]);
    mes = MESES[m[2]];
    ano = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : undefined;
  } else {
    m = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
    if (!m || /parc/.test(t)) return undefined;
    dia = Number(m[1]);
    mes = Number(m[2]);
    ano = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : undefined;
  }
  if (!(dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12)) return undefined;
  // Sem ano: o mais recente que não está no futuro
  if (!ano) ano = mes > hoje.getMonth() + 1 ? hoje.getFullYear() - 1 : hoje.getFullYear();
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function lerParcela(partes: string[]) {
  const texto = partes.join(" ");
  const valida = (m: RegExpMatchArray) => {
    const numero = Number(m[1]);
    const total = Number(m[2]);
    return total >= 2 && total <= 48 && numero >= 1 && numero <= total ? { numero, total } : undefined;
  };
  const escrita = semAcento(texto).match(/parc(?:ela)?\.?\s*(\d{1,2})\s*(?:de|\/)\s*(\d{1,2})/);
  if (escrita) return valida(escrita);
  // "01/03" solto: o primeiro que faz sentido como parcela (a data "14/09" vem antes e não serve)
  // (o que está no começo da linha é data, não parcela)
  for (const parte of partes)
    for (const m of parte.matchAll(/\b(\d{1,2})\s*\/\s*(\d{1,2})\b(?!\/)/g)) {
      const p = m.index ? valida(m) : undefined;
      if (p) return p;
    }
  return undefined;
}

/** Tira do nome o que não é nome: valores, datas, horas, "Parcela 2 de 10", símbolos soltos. */
function limparNome(texto: string) {
  return texto
    .replace(DINHEIRO, " ")
    .replace(/parc(?:ela)?\.?\s*\d{1,2}\s*(?:de|\/)\s*\d{1,2}/gi, " ")
    .replace(/\b\d{1,2}\s*(?:de\s*)?(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*\.?(?:\s*\d{2,4})?/gi, " ")
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, " ")
    .replace(/\b\d{1,2}:\d{2}\b/g, " ")
    .replace(/[|•·>›<‹©®™@#*_=~"“”]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const temLetras = (t: string) => (t.match(/[a-zà-ú]/gi) ?? []).length >= 3;

/** Texto lido do print → compras. */
export function comprasDoTextoDoPrint(texto: string, hoje = new Date()): CompraDoPrint[] {
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const compras: CompraDoPrint[] = [];
  let dataAtual: string | undefined; // muitos apps agrupam por dia ("05 OUT")
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const valorAchado = linha.match(DINHEIRO);
    if (!valorAchado) {
      // Linha só com data: vale para as compras de baixo
      const data = lerDataDoPrint(linha, hoje);
      if (data && !temLetras(limparNome(linha))) dataAtual = data;
      continue;
    }
    if (valorAchado[1]) continue; // valor negativo: estorno/pagamento
    const valor = lerNumero(valorAchado[2].replace(/\s/g, ""));
    if (!(valor > 0)) continue;
    // O nome: na própria linha; se não tiver, na linha de cima (o valor costuma vir à direita ou embaixo)
    let nome = limparNome(linha);
    let vizinha = "";
    if (!temLetras(nome) && i > 0 && !DINHEIRO.test(linhas[i - 1])) {
      vizinha = linhas[i - 1];
      nome = limparNome(vizinha);
    }
    const contexto = [vizinha, linha, linhas[i + 1] && !DINHEIRO.test(linhas[i + 1]) ? linhas[i + 1] : ""];
    if (!temLetras(nome) || NAO_E_COMPRA.test(semAcento(`${nome} ${linha}`))) continue;
    compras.push({
      descricao: nome.slice(0, 60),
      valor,
      parcela: lerParcela(contexto),
      data: lerDataDoPrint(`${vizinha} ${linha}`, hoje) ?? dataAtual,
    });
  }
  return compras;
}
