"use client";

import { useState } from "react";
import {
  useLancamentos,
  adicionarCartao,
  agoraLocal,
  atualizarCartao,
  CORES_CARTAO,
  moverAssinaturasParaDebito,
  removerCartao,
  SUGESTOES_CARTAO,
  useCartoes,
  useCompras,
  useGastosFixos,
  usePagamentosFatura,
  vinculosDaConta,
  type Conta,
} from "@/lib/store";
import { brl, hojeISO, lerValor, valorParaCampo } from "@/lib/formato";
import { saldoDaConta, temCredito } from "@/lib/contas";
import { limiteUsadoPelasCompras, parcelasPagasDaCompra } from "@/lib/cartoes";
import { comDesfazer } from "@/lib/avisos";
import Modal from "./Modal";
import { Campo, CampoSelect, CampoValor, Chip, DIAS_DO_MES } from "./Campos";
import Icone, { TextoComIcones } from "@/components/Icone";

const NOMES_DAS_CORES = ["Rosa e roxo", "Roxo e azul", "Azul e ciano", "Laranja e rosa", "Verde e azul", "Grafite"];
const SUGESTOES_VALE = ["Alelo", "VR", "Pluxee (Sodexo)", "Ticket", "Caju", "Flash", "iFood Benefícios", "Swile"];

type TipoConta = "banco" | "dinheiro" | "vale";

const TIPOS: { id: TipoConta; nome: string; descricao: string }[] = [
  { id: "banco", nome: "🏦 Banco", descricao: "Conta corrente, digital…" },
  { id: "dinheiro", nome: "💵 Dinheiro", descricao: "Carteira, dinheiro vivo" },
  { id: "vale", nome: "🍽️ Vale", descricao: "VR / VA (Alelo, Caju…)" },
];

// Cadastrar ou editar uma conta: banco (com ou sem cartão de crédito), dinheiro na carteira ou vale (VR/VA).
export default function FormConta({ conta, onFechar }: { conta?: Conta; onFechar: () => void }) {
  const contas = useCartoes();
  const compras = useCompras();
  const fixos = useGastosFixos();
  const pagamentos = usePagamentosFatura();
  const [tipo, setTipo] = useState<TipoConta>(conta?.tipo ?? "banco");
  const [nome, setNome] = useState(conta?.nome ?? "");
  const [cor, setCor] = useState(conta?.cor ?? CORES_CARTAO[0]);
  const lancamentos = useLancamentos();
  // O saldo de HOJE (o informado + o que entrou e saiu depois), não o que foi digitado no cadastro
  const [saldoAtual] = useState(() => (conta ? Math.round(saldoDaConta(conta, lancamentos) * 100) / 100 : null));
  const [saldo, setSaldo] = useState(saldoAtual != null ? valorParaCampo(saldoAtual) : "");
  // Banco: o saldo vem do extrato; só informa à mão se o arquivo do banco não trouxer
  const [saldoAMao, setSaldoAMao] = useState(false);
  const [credito, setCredito] = useState(conta ? temCredito(conta) : false);
  const [limite, setLimite] = useState(conta?.limite ? valorParaCampo(conta.limite) : "");
  const [fechamento, setFechamento] = useState(conta?.diaFechamento ? String(conta.diaFechamento) : "");
  const [vencimento, setVencimento] = useState(conta?.diaVencimento ? String(conta.diaVencimento) : "");
  const [disponivelHoje, setDisponivelHoje] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  const [destino, setDestino] = useState("");
  const [erro, setErro] = useState("");
  // Criou a conta depois do salário cair? O saldo já tem ele dentro: marca como recebido sem somar de novo

  const comCredito = tipo === "banco" && credito;
  const valorLimite = lerValor(limite);
  const dados = { compras, fixos, pagamentos };

  // Desligar o crédito: compras ainda sendo pagas impedem; assinaturas passam para débito
  const desligandoCredito = !!conta && temCredito(conta) && !comCredito;
  const comprasAbertas = conta
    ? compras.filter((c) => c.cartaoId === conta.id && parcelasPagasDaCompra(c, conta, dados) < c.parcelas)
    : [];
  const assinaturasNoCartao = conta ? fixos.filter((f) => f.cartaoId === conta.id) : [];

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim())
      return setErro(
        tipo === "dinheiro" ? "Dê um nome (ex.: Carteira)." : tipo === "vale" ? "Qual é o vale? (ex.: Alelo)" : "Qual é o banco?",
      );
    // Vazio = R$ 0,00 (o campo de dinheiro não guarda um "0" sozinho)
    if (comCredito && !(valorLimite > 0)) return setErro("Qual é o limite do cartão?");
    if (comCredito && (!fechamento || !vencimento)) return setErro("Escolha o dia que a fatura fecha e o dia que vence.");
    if (desligandoCredito && comprasAbertas.length > 0)
      return setErro(
        `Ainda tem ${comprasAbertas.length} compra(s) sendo paga(s) neste cartão (${comprasAbertas
          .slice(0, 3)
          .map((c) => c.descricao)
          .join(", ")}). Termine de pagar ou exclua essas compras antes de desligar o crédito.`,
      );

    const novoSaldo = lerValor(saldo) || 0;
    const novos = {
      nome: nome.trim(),
      cor,
      tipo,
      temCredito: comCredito,
      limite: comCredito ? valorLimite : 0,
      diaFechamento: comCredito ? Number(fechamento) : 0,
      diaVencimento: comCredito ? Number(vencimento) : 0,
    };
    // Mudou o saldo (comparado com o de hoje)? Ele passa a valer a partir de agora
    const saldoMudou = !conta || Math.abs((saldoAtual ?? 0) - novoSaldo) >= 0.005;
    const saldoNovo = saldoMudou ? { saldo: novoSaldo, saldoAtualizadoEm: agoraLocal() } : {};
    // "Disponível hoje no app do banco": ajusta o limite usado (compras que não foram cadastradas aqui)
    let ajuste = {};
    if (comCredito && disponivelHoje.trim() && conta) {
      const usadoNoBanco = valorLimite - lerValor(disponivelHoje);
      ajuste = { ajusteLimite: Math.round((usadoNoBanco - limiteUsadoPelasCompras({ ...conta, ...novos }, dados)) * 100) / 100 };
    }
    if (desligandoCredito && conta && assinaturasNoCartao.length > 0) moverAssinaturasParaDebito(conta.id);
    if (conta) atualizarCartao(conta.id, { ...novos, ...saldoNovo, ...ajuste });
    else adicionarCartao({ ...novos, ...saldoNovo, ...ajuste, criadoEm: hojeISO() });
    onFechar();
  }

  const vinculos = conta ? vinculosDaConta(conta.id) : null;
  const outras = contas.filter((c) => c.id !== conta?.id);

  return (
    <Modal titulo={conta ? "Editar conta" : "Nova conta"} onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {TIPOS.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={tipo === o.id}
              onClick={() => {
                setTipo(o.id);
                if (o.id === "dinheiro" && !nome) setNome("Carteira");
                if (o.id !== "banco") setCredito(false);
              }}
              className={`rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                tipo === o.id ? "border-rosa bg-rosa/15" : "border-white/10 hover:border-roxo/50"
              }`}
            >
              <span className="block text-sm font-semibold">
                <TextoComIcones texto={o.nome} />
              </span>
              <span className="block text-xs text-suave">
                <TextoComIcones texto={o.descricao} />
              </span>
            </button>
          ))}
        </div>

        {tipo === "vale" && (
          <p className="rounded-2xl bg-roxo/10 px-4 py-3 text-xs text-suave">
            <Icone e="🍽️" /> O vale tem saldo próprio e só paga mercado e alimentação. Ele <b className="text-white">não entra</b>{" "}
            na sobra do mês, na reserva de emergência nem na % da renda — só o dinheiro de verdade entra.
          </p>
        )}

        {/* Prévia */}
        <div className="relative h-32 overflow-hidden rounded-2xl p-4 text-white shadow-lg" style={{ background: cor }}>
          <div className="absolute -right-8 -top-8 size-32 rounded-full bg-white/10" />
          <p className="font-display text-lg font-bold">
            <TextoComIcones texto={nome || (tipo === "dinheiro" ? "Carteira" : tipo === "vale" ? "Meu vale" : "Minha conta")} />
          </p>
          <p className="absolute bottom-4 left-4 text-xs text-white/80">
            Saldo {brl(lerValor(saldo) || 0)}
            {comCredito && valorLimite > 0 && ` · limite ${brl(valorLimite)}`}
          </p>
          <span className="absolute bottom-3 right-4 text-2xl">
            <TextoComIcones texto={tipo === "dinheiro" ? "💵" : tipo === "vale" ? "🍽️" : comCredito ? "💳" : "🏦"} />
          </span>
        </div>

        <div className="flex gap-2" role="radiogroup" aria-label="Cor da conta">
          {CORES_CARTAO.map((c, i) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={cor === c}
              onClick={() => setCor(c)}
              aria-label={`Cor ${NOMES_DAS_CORES[i] ?? i + 1}`}
              className={`size-8 rounded-full ${cor === c ? "ring-2 ring-white ring-offset-2 ring-offset-superficie" : ""}`}
              style={{ background: c }}
            />
          ))}
        </div>

        <Campo rotulo={tipo === "dinheiro" ? "Nome" : tipo === "vale" ? "Vale" : "Banco"}>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder={tipo === "dinheiro" ? "Carteira" : tipo === "vale" ? "Ex.: Alelo" : "Ex.: Nubank"}
            className="campo"
          />
        </Campo>
        {tipo !== "dinheiro" && !conta && (
          <div className="flex flex-wrap gap-2">
            {(tipo === "vale" ? SUGESTOES_VALE : SUGESTOES_CARTAO).map((s) => (
              <Chip key={s} ativo={nome === s} onClick={() => setNome(s)}>
                <TextoComIcones texto={s} />
              </Chip>
            ))}
          </div>
        )}

        {tipo === "banco" && !saldoAMao ? (
          // Banco: o saldo vem do arquivo do extrato (não é digitado). Só se o banco não mandar, dá para informar.
          <div className="rounded-2xl bg-fundo/50 px-4 py-3 text-sm">
            <p>
              <Icone e="💰" /> O saldo vem do <b>extrato do banco</b>
              {conta && <> · hoje: {brl(saldoAtual ?? 0)}</>}
            </p>
            <p className="mt-1 text-xs text-suave">
              Depois de salvar, importe o arquivo (OFX, CSV ou PDF) em Contas: o saldo fica igual ao do banco.
            </p>
            <button type="button" onClick={() => setSaldoAMao(true)} className="mt-2 text-xs text-rosa">
              Meu banco não manda o saldo no arquivo
            </button>
          </div>
        ) : (
          <>
            <Campo rotulo="Quanto tem nessa conta agora?">
              <CampoValor valor={saldo} onChange={setSaldo} negativo={tipo === "banco"} />
            </Campo>
            <p className="-mt-2 text-xs text-suave">
              Daqui para frente o saldo muda sozinho com cada entrada e saída desta conta.
              {tipo === "banco" && " No cheque especial? Toque em “− negativo”."}
            </p>
          </>
        )}

        {tipo === "banco" && (
          <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-fundo/50 px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={credito}
              onChange={(e) => setCredito(e.target.checked)}
              className="size-5 accent-rosa"
            />
            <Icone e="💳" /> Essa conta tem cartão de crédito
          </label>
        )}

        {desligandoCredito && (
          <p className="rounded-2xl border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-xs">
            <TextoComIcones
              texto={
                comprasAbertas.length > 0
                  ? `⚠️ Não dá para desligar ainda: ${comprasAbertas.length} compra(s) deste cartão ainda estão sendo pagas.`
                  : assinaturasNoCartao.length > 0
                    ? `⚠️ ${assinaturasNoCartao.length} assinatura(s) estão neste cartão. Ao salvar, elas passam a sair desta conta (débito).`
                    : "O cartão de crédito desta conta vai ser desligado."
              }
            />
          </p>
        )}

        {comCredito && (
          <>
            <Campo rotulo="Limite total do cartão">
              <CampoValor valor={limite} onChange={setLimite} />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Fatura fecha dia">
                <CampoSelect valor={fechamento} onChange={setFechamento} opcoes={DIAS_DO_MES} placeholder="Dia" />
              </Campo>
              <Campo rotulo="Fatura vence dia">
                <CampoSelect valor={vencimento} onChange={setVencimento} opcoes={DIAS_DO_MES} placeholder="Dia" />
              </Campo>
            </div>
            {conta && (
              <>
                <Campo rotulo="Quanto está disponível hoje no app do banco? (opcional)">
                  <CampoValor valor={disponivelHoje} onChange={setDisponivelHoje} />
                </Campo>
                <p className="-mt-2 text-xs text-suave">
                  Se você não cadastrou todas as compras, o “disponível” daqui fica diferente do banco. Informe o do app e o NAXXO
                  ajusta.
                  {conta.ajusteLimite ? ` (Ajuste atual: ${brl(conta.ajusteLimite)})` : ""}
                </p>
              </>
            )}
            {!conta && (
              <p className="text-xs text-suave">
                <Icone e="💡" /> Depois de salvar, inclua no cartão as compras que ainda estão sendo pagas (inclusive parceladas).
              </p>
            )}
          </>
        )}

        {erro && (
          <p className="text-sm text-saida">
            <TextoComIcones texto={erro} />
          </p>
        )}

        <button type="submit" className="botao-gradiente w-full rounded-full py-3 font-semibold">
          <TextoComIcones texto={conta ? "Salvar alterações" : "Adicionar conta"} />
        </button>

        {conta && !excluindo && (
          <button type="button" onClick={() => setExcluindo(true)} className="w-full py-1 text-sm text-suave hover:text-saida">
            Excluir conta
          </button>
        )}

        {/* Excluir mostra o que será afetado e deixa escolher para onde vai */}
        {conta && excluindo && vinculos && (
          <div className="space-y-3 rounded-2xl border border-saida/40 bg-saida/5 p-4 text-sm">
            <p className="font-semibold">
              Excluir “<TextoComIcones texto={conta.nome} />
              ”?
            </p>
            <ul className="list-inside list-disc text-xs text-suave">
              <li>{vinculos.lancamentos} lançamento(s) desta conta</li>
              {vinculos.compras > 0 && <li>{vinculos.compras} compra(s) no cartão (serão apagadas)</li>}
              {vinculos.fixos > 0 && <li>{vinculos.fixos} gasto(s) fixo(s) / assinatura(s)</li>}
              {vinculos.metas > 0 && <li>{vinculos.metas} meta(s) que saem desta conta</li>}
              {vinculos.fontes > 0 && <li>{vinculos.fontes} renda(s) que caem aqui</li>}
            </ul>
            <label className="block space-y-1.5">
              <span className="text-xs text-suave">Para onde vai o que era desta conta?</span>
              <select value={destino} onChange={(e) => setDestino(e.target.value)} className="campo cursor-pointer">
                <option value="">Deixar sem conta (escolho depois)</option>
                {outras.map((c) => (
                  <option key={c.id} value={c.id}>
                    Passar para <TextoComIcones texto={c.nome} />
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setExcluindo(false)}
                className="flex-1 rounded-full border border-white/15 py-2 text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  comDesfazer(`Conta “${conta.nome}” excluída`, () => removerCartao(conta.id, destino || undefined));
                  onFechar();
                }}
                className="flex-1 rounded-full bg-saida py-2 text-sm font-semibold text-fundo"
              >
                Excluir
              </button>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
