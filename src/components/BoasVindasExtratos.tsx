"use client";

import { useState } from "react";
import {
  adicionarCartao,
  adicionarCompras,
  adicionarLancamentos,
  agoraLocal,
  CORES_CARTAO,
  semAcento,
  type Cartao,
} from "@/lib/store";
import { brl, formatarData, hojeISO, lerValor, valorParaCampo } from "@/lib/formato";
import { bancoDoArquivo, compraDoExtrato, detectarSalario, lerExtrato, parcelaRepetida, type Extrato } from "@/lib/extrato";
import { Campo, CampoSelect, CampoValor, DIAS_DO_MES } from "./Campos";

// Questionário → "Seus bancos e cartões": a pessoa joga os extratos (OFX/CSV) e o app monta tudo a partir deles:
// as contas (com saldo), os cartões (com as compras e parcelas) e o que entrou e saiu. O salário achado vira sugestão na Renda.

export type ArquivoExtrato = {
  id: number;
  nomeArquivo: string;
  extrato: Extrato;
  banco: string;
  saldo: string; // conta: quanto tem hoje (vem do arquivo quando ele traz)
  limite: string; // cartão
  fechamento: string;
  vencimento: string;
};

let proximoId = 1;

async function lerArquivo(arquivo: File) {
  const bytes = await arquivo.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  return utf8.includes("�") ? new TextDecoder("windows-1252").decode(bytes) : utf8;
}

/** O que falta preencher (para o "Continuar"), ou null. */
export function problemaDosExtratos(arquivos: ArquivoExtrato[]) {
  for (const a of arquivos) {
    const nome = a.banco.trim() || a.nomeArquivo;
    if (!a.banco.trim()) return `Qual é o banco do arquivo “${a.nomeArquivo}”?`;
    if (a.extrato.ehCartao) {
      if (!(lerValor(a.limite) > 0)) return `${nome}: qual é o limite do cartão?`;
      if (!a.fechamento || !a.vencimento) return `${nome}: escolha o dia que a fatura fecha e o dia que vence.`;
    }
  }
  return null;
}

/** O salário achado nos extratos das contas (para sugerir na Renda), com o banco onde caiu. */
export function salarioDosExtratos(arquivos: ArquivoExtrato[]) {
  const achados = arquivos
    .filter((a) => !a.extrato.ehCartao)
    .map((a) => ({ banco: a.banco.trim(), salario: detectarSalario(a.extrato.linhas) }))
    .filter((x) => x.salario);
  achados.sort((a, b) => b.salario!.valor - a.salario!.valor);
  return achados[0] ? { ...achados[0].salario!, banco: achados[0].banco } : null;
}

/**
 * Cria as contas e importa tudo. Arquivos do mesmo banco (ex.: conta + cartão do Nubank) viram uma conta só.
 * O saldo informado é o de hoje: o que está no extrato já está dentro dele (não soma de novo).
 * Devolve o id da conta de cada banco (para ligar a renda).
 */
export function criarTudoDosExtratos(arquivos: ArquivoExtrato[]) {
  const porBanco = new Map<string, ArquivoExtrato[]>();
  for (const a of arquivos) {
    const chave = semAcento(a.banco.trim());
    porBanco.set(chave, [...(porBanco.get(chave) ?? []), a]);
  }
  const ids = new Map<string, string>();
  let cor = 0;
  for (const [chave, lista] of porBanco) {
    const conta = lista.find((a) => !a.extrato.ehCartao);
    const cartao = lista.find((a) => a.extrato.ehCartao);
    const saldo = conta ? lerValor(conta.saldo) || 0 : 0;
    const dados: Omit<Cartao, "id"> = {
      nome: lista[0].banco.trim(),
      cor: CORES_CARTAO[cor++ % CORES_CARTAO.length],
      tipo: "banco",
      temCredito: !!cartao,
      limite: cartao ? lerValor(cartao.limite) : 0,
      diaFechamento: cartao ? Number(cartao.fechamento) : 0,
      diaVencimento: cartao ? Number(cartao.vencimento) : 0,
      criadoEm: hojeISO(),
      saldo,
      saldoAtualizadoEm: agoraLocal(),
    };
    const id = adicionarCartao(dados);
    ids.set(chave, id);

    // Conta: tudo o que está no extrato já aconteceu e já está no saldo de hoje
    const hoje = hojeISO();
    adicionarLancamentos(
      lista
        .filter((a) => !a.extrato.ehCartao)
        .flatMap((a) => a.extrato.linhas)
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
          jaNoSaldo: true,
          extratoId: l.id,
          importado: true,
        })),
    );
    // Cartão: as compras (pagamentos e estornos ficam de fora; parcelas da mesma compra entram uma vez)
    const linhasCartao = lista.filter((a) => a.extrato.ehCartao).flatMap((a) => a.extrato.linhas);
    const repetida = parcelaRepetida(linhasCartao);
    adicionarCompras(
      linhasCartao
        .filter((l) => l.tipo === "saida" && !repetida(l))
        .map((l) => compraDoExtrato(l, { id, diaFechamento: dados.diaFechamento, diaVencimento: dados.diaVencimento })),
    );
  }
  return ids;
}

export default function BoasVindasExtratos({
  arquivos,
  onChange,
}: {
  arquivos: ArquivoExtrato[];
  onChange: (novos: ArquivoExtrato[]) => void;
}) {
  const [arrastando, setArrastando] = useState(false);
  const [erro, setErro] = useState("");

  async function adicionar(lista: FileList | null | undefined) {
    if (!lista?.length) return;
    const novos: ArquivoExtrato[] = [];
    const problemas: string[] = [];
    for (const arquivo of Array.from(lista)) {
      const texto = await lerArquivo(arquivo);
      if (/^%PDF/.test(texto)) {
        problemas.push(`“${arquivo.name}” é PDF: baixe em OFX ou CSV`);
        continue;
      }
      const extrato = lerExtrato(texto);
      if (extrato.linhas.length === 0) {
        problemas.push(`“${arquivo.name}” não tem movimentações que eu consiga ler`);
        continue;
      }
      novos.push({
        id: proximoId++,
        nomeArquivo: arquivo.name,
        extrato,
        banco: bancoDoArquivo(arquivo.name, texto),
        saldo: extrato.saldo !== undefined ? valorParaCampo(extrato.saldo) : "",
        limite: "",
        fechamento: "",
        vencimento: "",
      });
    }
    setErro(problemas.join(" · "));
    onChange([...arquivos, ...novos]);
  }

  function mudar(id: number, mudancas: Partial<ArquivoExtrato>) {
    onChange(arquivos.map((a) => (a.id === id ? { ...a, ...mudancas } : a)));
  }

  return (
    <div className="space-y-4">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          void adicionar(e.dataTransfer.files);
        }}
        className={`block cursor-pointer rounded-3xl border-2 border-dashed px-4 py-8 text-center transition-colors hover:bg-rosa/5 ${
          arrastando ? "border-rosa bg-rosa/15" : "border-rosa/50"
        }`}
      >
        <span className="block text-3xl">📂</span>
        <span className="mt-2 block font-semibold text-rosa">Escolha ou arraste os extratos aqui</span>
        <span className="mt-1 block text-xs text-suave">Pode ser mais de um: a conta e o cartão de cada banco (OFX ou CSV)</span>
        <input
          type="file"
          multiple
          accept=".ofx,.csv,.txt,.qfx"
          className="sr-only"
          onChange={(e) => {
            void adicionar(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      <details className="rounded-2xl bg-roxo/10 px-4 py-3 text-sm text-suave">
        <summary className="cursor-pointer text-white">Como baixo o extrato?</summary>
        <p className="mt-2">
          No app ou site do banco, procure <b className="text-white">Extrato</b> (ou <b className="text-white">Fatura</b>, no
          cartão) e depois <b className="text-white">Exportar</b> / <b className="text-white">Baixar</b>. Escolha o formato{" "}
          <b className="text-white">OFX</b> ou <b className="text-white">CSV</b> (PDF não dá para ler). Quanto mais meses, melhor
          o app entende seus gastos.
        </p>
      </details>

      {erro && <p className="text-sm text-saida">⚠️ {erro}</p>}

      {arquivos.map((a) => {
        const datas = a.extrato.linhas.map((l) => l.data).sort();
        const cartao = a.extrato.ehCartao;
        return (
          <div key={a.id} className="cartao space-y-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-suave">
                  {cartao ? "💳 Fatura do cartão" : "🏦 Extrato da conta"} · {a.extrato.linhas.length} movimentações
                  {datas.length > 0 && ` · ${formatarData(datas[0])} a ${formatarData(datas[datas.length - 1])}`}
                </p>
                <p className="truncate text-xs text-suave">📄 {a.nomeArquivo}</p>
              </div>
              <button
                type="button"
                onClick={() => onChange(arquivos.filter((x) => x.id !== a.id))}
                aria-label="Tirar este arquivo"
                className="text-xl text-suave hover:text-saida"
              >
                ×
              </button>
            </div>
            <Campo rotulo="Banco">
              <input
                value={a.banco}
                onChange={(e) => mudar(a.id, { banco: e.target.value })}
                placeholder="Ex.: Nubank"
                className="campo"
              />
            </Campo>
            {cartao ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <Campo rotulo="Limite do cartão">
                  <CampoValor valor={a.limite} onChange={(limite) => mudar(a.id, { limite })} />
                </Campo>
                <Campo rotulo="Fatura fecha dia">
                  <CampoSelect
                    valor={a.fechamento}
                    onChange={(fechamento) => mudar(a.id, { fechamento })}
                    opcoes={DIAS_DO_MES}
                    placeholder="Dia"
                  />
                </Campo>
                <Campo rotulo="Vence dia">
                  <CampoSelect
                    valor={a.vencimento}
                    onChange={(vencimento) => mudar(a.id, { vencimento })}
                    opcoes={DIAS_DO_MES}
                    placeholder="Dia"
                  />
                </Campo>
              </div>
            ) : (
              <Campo rotulo="Quanto tem nessa conta hoje?">
                <CampoValor valor={a.saldo} onChange={(saldo) => mudar(a.id, { saldo })} negativo />
                <span className="block text-xs text-suave">
                  {a.extrato.saldo !== undefined
                    ? `✨ Veio do extrato (${brl(a.extrato.saldo)}). Se mudou desde então, ajuste.`
                    : "Olhe no app do banco. Em branco = R$ 0,00."}
                </span>
              </Campo>
            )}
          </div>
        );
      })}
    </div>
  );
}
