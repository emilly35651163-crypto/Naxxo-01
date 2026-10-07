"use client";

import { useState } from "react";
import {
  adicionarCartao,
  adicionarCompras,
  adicionarLancamentos,
  agoraLocal,
  CORES_CARTAO,
  semAcento,
  SUGESTOES_CARTAO,
  type Cartao,
} from "@/lib/store";
import { brl, formatarData, hojeISO, lerValor, valorParaCampo } from "@/lib/formato";
import {
  bancoDoArquivo,
  comoCartao,
  compraDoExtrato,
  detectarSalario,
  lerExtrato,
  parcelaRepetida,
  type Extrato,
} from "@/lib/extrato";
import { Campo, CampoSelect, CampoValor, Chip, DIAS_DO_MES } from "./Campos";
import ComprasManuais, {
  comprasDosPrints,
  comprasManuaisParaCartao,
  type CompraManual,
  type StatusDoPrint,
} from "./ComprasManuais";
import { ehImagem } from "@/lib/ocr";
import { lerValor as lerValorDoCampo } from "@/lib/formato";

// Questionário → "Suas contas e cartões": primeiro o banco; dentro dele, o extrato da conta e o do cartão de crédito.
// Com isso o app monta as contas (com saldo), os cartões (com compras e parcelas) e o que entrou e saiu.

type ArquivoLido = { nomeArquivo: string; extrato: Extrato };

export type BancoExtrato = {
  id: number;
  banco: string;
  temConta: boolean;
  temCartao: boolean;
  conta: ArquivoLido | null; // extrato da conta
  cartao: ArquivoLido | null; // extrato / fatura do cartão de crédito
  comprasManuais: CompraManual[]; // cartão sem extrato: à mão ou lidas de prints
  saldo: string; // quanto tem na conta hoje (vem do arquivo quando ele traz)
  limite: string;
  fechamento: string;
  vencimento: string;
};

let proximoId = 1;

export function bancoVazio(): BancoExtrato {
  return {
    id: proximoId++,
    banco: "",
    temConta: true,
    temCartao: false,
    conta: null,
    cartao: null,
    comprasManuais: [],
    saldo: "",
    limite: "",
    fechamento: "",
    vencimento: "",
  };
}

/** Os bancos preenchidos (o cartão em branco do começo não conta). */
export function bancosPreenchidos(bancos: BancoExtrato[]) {
  return bancos.filter((b) => b.banco.trim() || b.conta || b.cartao || b.comprasManuais.length);
}

async function lerArquivo(arquivo: File) {
  const bytes = await arquivo.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  return utf8.includes("�") ? new TextDecoder("windows-1252").decode(bytes) : utf8;
}

/** O que falta preencher (para o "Continuar"), ou null. */
export function problemaDosBancos(bancos: BancoExtrato[]) {
  for (const b of bancosPreenchidos(bancos)) {
    if (!b.banco.trim()) return "Qual é o banco?";
    if (!b.temConta && !b.temCartao) return `${b.banco}: marque se é conta, cartão de crédito ou os dois.`;
    if (b.temCartao) {
      if (!(lerValor(b.limite) > 0)) return `${b.banco}: qual é o limite do cartão?`;
      if (!b.fechamento || !b.vencimento) return `${b.banco}: escolha o dia que a fatura fecha e o dia que vence.`;
    }
  }
  return null;
}

/** O salário achado nos extratos das contas (para sugerir na Renda), com o banco onde caiu. */
export function salarioDosExtratos(bancos: BancoExtrato[]) {
  const achados = bancosPreenchidos(bancos)
    .filter((b) => b.temConta && b.conta)
    .map((b) => ({ banco: b.banco.trim(), salario: detectarSalario(b.conta!.extrato.linhas) }))
    .filter((x) => x.salario);
  achados.sort((a, b) => b.salario!.valor - a.salario!.valor);
  return achados[0] ? { ...achados[0].salario!, banco: achados[0].banco } : null;
}

export function totalDeMovimentacoes(bancos: BancoExtrato[]) {
  return bancosPreenchidos(bancos).reduce(
    (t, b) =>
      t + (b.temConta ? (b.conta?.extrato.linhas.length ?? 0) : 0) + (b.temCartao ? (b.cartao?.extrato.linhas.length ?? 0) : 0),
    0,
  );
}

/**
 * Cria as contas e importa tudo. O saldo informado é o de hoje: o que está no extrato já está dentro dele (não soma de novo).
 * Devolve o id da conta de cada banco (para ligar a renda).
 */
export function criarTudoDosExtratos(bancos: BancoExtrato[]) {
  const ids = new Map<string, string>();
  const hoje = hojeISO();
  bancosPreenchidos(bancos).forEach((b, i) => {
    const dados: Omit<Cartao, "id"> = {
      nome: b.banco.trim(),
      cor: CORES_CARTAO[i % CORES_CARTAO.length],
      tipo: "banco",
      temCredito: b.temCartao,
      limite: b.temCartao ? lerValor(b.limite) : 0,
      diaFechamento: b.temCartao ? Number(b.fechamento) : 0,
      diaVencimento: b.temCartao ? Number(b.vencimento) : 0,
      criadoEm: hoje,
      saldo: b.temConta ? lerValor(b.saldo) || 0 : 0,
      saldoAtualizadoEm: agoraLocal(),
    };
    const id = adicionarCartao(dados);
    ids.set(semAcento(dados.nome), id);

    if (b.temConta && b.conta)
      adicionarLancamentos(
        b.conta.extrato.linhas
          // Pagamento de fatura: as compras já entram pelo cartão (senão o gasto contaria duas vezes)
          .filter((l) => l.categoria !== "Fatura do cartão")
          .map((l) => ({
            tipo: l.tipo,
            valor: l.valor,
            descricao: l.descricao,
            categoria: l.categoria,
            data: l.data,
            pago: l.data <= hoje,
            contaId: id,
            jaNoSaldo: true, // já está no saldo de hoje
            extratoId: l.id,
            importado: true,
          })),
      );
    if (b.temCartao && b.cartao) {
      const linhas = b.cartao.extrato.linhas;
      const repetida = parcelaRepetida(linhas);
      adicionarCompras(
        linhas
          .filter((l) => l.tipo === "saida" && !repetida(l))
          .map((l) => compraDoExtrato(l, { id, diaFechamento: dados.diaFechamento, diaVencimento: dados.diaVencimento })),
      );
    }
    if (b.temCartao && b.comprasManuais.length) adicionarCompras(comprasManuaisParaCartao(b.comprasManuais, id));
  });
  return ids;
}

/** Espaço para soltar/escolher um arquivo de extrato. */
function ZonaArquivo({
  titulo,
  ajuda,
  arquivo,
  onArquivo,
  onTirar,
  onPrints,
  aceitaPrints,
}: {
  titulo: string;
  ajuda: string;
  arquivo: ArquivoLido | null;
  onArquivo: (f: File) => void;
  onTirar: () => void;
  /** Aceita prints também (o cartão): as imagens vão para cá */
  onPrints?: (imagens: File[]) => void;
  aceitaPrints?: boolean;
}) {
  function receberArquivos(lista: FileList | null | undefined) {
    const arquivos = Array.from(lista ?? []);
    const imagens = arquivos.filter(ehImagem);
    if (imagens.length && onPrints) onPrints(imagens);
    const doc = arquivos.find((f) => !ehImagem(f));
    if (doc) onArquivo(doc);
  }
  const [arrastando, setArrastando] = useState(false);
  if (arquivo) {
    const datas = arquivo.extrato.linhas.map((l) => l.data).sort();
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-entrada/30 bg-entrada/10 px-3 py-2.5 text-sm">
        <span className="text-xl">📄</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{arquivo.nomeArquivo}</span>
          <span className="block text-xs text-suave">
            {arquivo.extrato.linhas.length} movimentações
            {datas.length > 0 && ` · ${formatarData(datas[0])} a ${formatarData(datas[datas.length - 1])}`}
          </span>
        </span>
        <button type="button" onClick={onTirar} aria-label="Tirar o arquivo" className="text-xl text-suave hover:text-saida">
          ×
        </button>
      </div>
    );
  }
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setArrastando(false);
        receberArquivos(e.dataTransfer.files);
      }}
      className={`block cursor-pointer rounded-2xl border border-dashed px-3 py-4 text-center text-sm transition-colors hover:bg-rosa/5 ${
        arrastando ? "border-rosa bg-rosa/15" : "border-rosa/40"
      }`}
    >
      <span className="block font-medium text-rosa">📂 {titulo}</span>
      {aceitaPrints && (
        <span className="my-1 inline-block rounded-full bg-entrada/15 px-2 py-0.5 text-[0.65rem] font-semibold text-entrada">
          📸 aceita prints
        </span>
      )}
      <span className="block text-xs text-suave">{ajuda}</span>
      <input
        type="file"
        accept={onPrints ? ".ofx,.csv,.txt,.qfx,image/*" : ".ofx,.csv,.txt,.qfx"}
        multiple={!!onPrints}
        className="sr-only"
        onChange={(e) => {
          receberArquivos(e.target.files);
          e.target.value = "";
        }}
      />
    </label>
  );
}

export default function BoasVindasExtratos({
  bancos,
  onChange,
}: {
  bancos: BancoExtrato[];
  /** Aceita a lista nova ou uma função (a leitura dos prints termina depois e precisa da lista mais recente) */
  onChange: (novos: BancoExtrato[] | ((atuais: BancoExtrato[]) => BancoExtrato[])) => void;
}) {
  const [avisos, setAvisos] = useState<Record<number, string>>({});
  const [prints, setPrints] = useState<Record<number, StatusDoPrint>>({});

  /** Lê os prints da fatura e junta as compras achadas à lista do banco (para conferir). */
  async function lerPrints(id: number, imagens: File[]) {
    const status = (s: Partial<StatusDoPrint>) =>
      setPrints((p) => ({ ...p, [id]: { ...(p[id] ?? { lendo: "", aviso: "", texto: "" }), ...s } }));
    status({ lendo: "Preparando…", aviso: "", texto: "" });
    try {
      const { compras, texto } = await comprasDosPrints(imagens, (lendo) => status({ lendo }));
      onChange((atuais) =>
        atuais.map((b) =>
          b.id === id
            ? {
                ...b,
                temCartao: true,
                comprasManuais: [
                  ...b.comprasManuais.filter((c) => c.descricao.trim() || lerValorDoCampo(c.valor) > 0),
                  ...compras,
                ],
              }
            : b,
        ),
      );
      status({
        lendo: "",
        texto: compras.length ? "" : texto,
        aviso: compras.length
          ? `Achei ${compras.length} compra${compras.length > 1 ? "s" : ""}. Confira nome, valor e parcelas (fundo amarelo).`
          : "Não achei compras nesse print. Abra “Ver o que o leitor leu” e me mande, ou adicione à mão.",
      });
    } catch {
      status({ lendo: "", aviso: "Não consegui ler o print agora. Confira a internet e tente de novo, ou adicione à mão." });
    }
  }

  function mudar(id: number, mudancas: Partial<BancoExtrato>) {
    onChange(bancos.map((b) => (b.id === id ? { ...b, ...mudancas } : b)));
  }

  /** Lê o arquivo e coloca no lugar certo (se jogou a fatura do cartão no espaço da conta, vai para o do cartão). */
  async function receber(b: BancoExtrato, onde: "conta" | "cartao", arquivo: File) {
    const texto = await lerArquivo(arquivo);
    const avisar = (texto: string) => setAvisos((a) => ({ ...a, [b.id]: texto }));
    if (/^%PDF/.test(texto)) return avisar(`“${arquivo.name}” é PDF. Baixe de novo em OFX ou CSV.`);
    const lidoDoArquivo = lerExtrato(texto);
    if (lidoDoArquivo.linhas.length === 0) return avisar(`Não encontrei movimentações em “${arquivo.name}”.`);
    // O arquivo diz que é do cartão, ou a pessoa colocou no espaço do cartão
    const destino = lidoDoArquivo.ehCartao || onde === "cartao" ? "cartao" : "conta";
    const extrato = destino === "cartao" ? comoCartao(lidoDoArquivo) : lidoDoArquivo;
    const lido = { nomeArquivo: arquivo.name, extrato };
    avisar(
      lidoDoArquivo.ehCartao && onde === "conta" ? "Esse arquivo é do cartão de crédito: coloquei no espaço do cartão." : "",
    );
    const nome = b.banco.trim() || bancoDoArquivo(arquivo.name, texto);
    if (destino === "cartao") mudar(b.id, { cartao: lido, temCartao: true, banco: nome });
    else
      mudar(b.id, {
        conta: lido,
        temConta: true,
        banco: nome,
        saldo: extrato.saldo !== undefined ? valorParaCampo(extrato.saldo) : b.saldo,
      });
  }

  return (
    <div className="space-y-4">
      {bancos.map((b, i) => (
        <div key={b.id} className="cartao space-y-4 p-4">
          <div className="flex items-center justify-between">
            <span className="titulo-secao mb-0">{b.banco.trim() || `Banco ${i + 1}`}</span>
            {bancos.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(bancos.filter((x) => x.id !== b.id))}
                className="text-xs text-suave hover:text-saida"
              >
                remover
              </button>
            )}
          </div>

          <Campo rotulo="Qual é o banco?">
            <input
              value={b.banco}
              onChange={(e) => mudar(b.id, { banco: e.target.value })}
              placeholder="Ex.: Nubank"
              className="campo"
            />
          </Campo>
          {!b.banco.trim() && (
            <div className="flex flex-wrap gap-2">
              {SUGESTOES_CARTAO.slice(0, 8).map((s) => (
                <Chip key={s} ativo={false} onClick={() => mudar(b.id, { banco: s })}>
                  {s}
                </Chip>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Chip ativo={b.temConta} onClick={() => mudar(b.id, { temConta: !b.temConta })}>
              🏦 Conta {b.temConta && "✓"}
            </Chip>
            <Chip ativo={b.temCartao} onClick={() => mudar(b.id, { temCartao: !b.temCartao })}>
              💳 Cartão de crédito {b.temCartao && "✓"}
            </Chip>
          </div>

          {b.temConta && (
            <div className="space-y-3 rounded-2xl border border-white/10 p-3">
              <p className="text-sm font-semibold">🏦 Conta</p>
              <ZonaArquivo
                titulo="Extrato da conta"
                ajuda="OFX ou CSV · escolha ou arraste aqui"
                arquivo={b.conta}
                onArquivo={(f) => void receber(b, "conta", f)}
                onTirar={() => mudar(b.id, { conta: null })}
              />
              <Campo rotulo="Quanto tem nessa conta hoje?">
                <CampoValor valor={b.saldo} onChange={(saldo) => mudar(b.id, { saldo })} negativo />
                <span className="block text-xs text-suave">
                  {b.conta?.extrato.saldo !== undefined
                    ? `✨ Veio do extrato (${brl(b.conta.extrato.saldo)}). Se mudou desde então, ajuste.`
                    : "Olhe no app do banco. Em branco = R$ 0,00."}
                </span>
              </Campo>
            </div>
          )}

          {b.temCartao && (
            <div className="space-y-3 rounded-2xl border border-white/10 p-3">
              <p className="text-sm font-semibold">💳 Cartão de crédito</p>
              <ZonaArquivo
                titulo="Extrato / fatura do cartão"
                ajuda="OFX, CSV ou prints da fatura · escolha ou arraste aqui"
                aceitaPrints
                arquivo={b.cartao}
                onArquivo={(f) => void receber(b, "cartao", f)}
                onTirar={() => mudar(b.id, { cartao: null })}
                onPrints={(imagens) => void lerPrints(b.id, imagens)}
              />
              {!b.cartao && (
                <ComprasManuais
                  lista={b.comprasManuais}
                  onChange={(comprasManuais) => mudar(b.id, { comprasManuais })}
                  onPrints={(imagens) => void lerPrints(b.id, imagens)}
                  status={prints[b.id] ?? { lendo: "", aviso: "", texto: "" }}
                />
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                <Campo rotulo="Limite do cartão">
                  <CampoValor valor={b.limite} onChange={(limite) => mudar(b.id, { limite })} />
                </Campo>
                <Campo rotulo="Fatura fecha dia">
                  <CampoSelect
                    valor={b.fechamento}
                    onChange={(fechamento) => mudar(b.id, { fechamento })}
                    opcoes={DIAS_DO_MES}
                    placeholder="Dia"
                  />
                </Campo>
                <Campo rotulo="Vence dia">
                  <CampoSelect
                    valor={b.vencimento}
                    onChange={(vencimento) => mudar(b.id, { vencimento })}
                    opcoes={DIAS_DO_MES}
                    placeholder="Dia"
                  />
                </Campo>
              </div>
            </div>
          )}

          {avisos[b.id] && <p className="text-sm text-amber-300">⚠️ {avisos[b.id]}</p>}
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...bancos, bancoVazio()])}
        className="w-full rounded-2xl border border-dashed border-white/15 py-3 text-sm text-suave hover:border-rosa hover:text-white"
      >
        + Adicionar outro banco ou cartão
      </button>

      <details className="rounded-2xl bg-roxo/10 px-4 py-3 text-sm text-suave">
        <summary className="cursor-pointer text-white">Como baixo o extrato?</summary>
        <p className="mt-2">
          No app ou site do banco, procure <b className="text-white">Extrato</b> (ou <b className="text-white">Fatura</b>, no
          cartão) e depois <b className="text-white">Exportar</b> / <b className="text-white">Baixar</b>. Escolha o formato{" "}
          <b className="text-white">OFX</b> ou <b className="text-white">CSV</b> (PDF não dá para ler). Sem o arquivo agora? Tudo
          bem: a conta é criada com o saldo e você importa depois em Contas.
        </p>
      </details>
    </div>
  );
}
