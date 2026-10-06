"use client";

import { useState } from "react";
import {
  adicionarGastoFixo,
  atualizarGastoFixo,
  CATEGORIAS_FIXO,
  FORMAS_PAGAMENTO,
  FREQUENCIAS,
  removerGastoFixo,
  SUGESTOES_FIXO,
  useCartoes,
  type CategoriaFixo,
  type FormaPagamento,
  type Frequencia,
  type GastoFixo,
} from "@/lib/store";
import CampoMes from "./CampoMes";
import EscolhaConta, { lerEscolha } from "./EscolhaConta";
import { cartoesDeCredito } from "@/lib/contas";
import { hojeISO, lerValor, mesAtual, nomeMes, somarMeses, soNumeros, valorParaCampo } from "@/lib/formato";
import Modal from "./Modal";
import { Campo, CampoSelect, CampoValor, Chip, DIAS_DO_MES } from "./Campos";
import { comDesfazer, mostrarAviso } from "@/lib/avisos";

// Criar ou editar um gasto fixo (aluguel, conta de luz, Netflix…).
// Com `assinaturaNoCartao`, já abre como assinatura paga naquele cartão (usado na aba Contas).
export default function FormGastoFixo({
  fixo,
  assinaturaNoCartao,
  onFechar,
}: {
  fixo?: GastoFixo;
  assinaturaNoCartao?: string;
  onFechar: () => void;
}) {
  const cartoes = cartoesDeCredito(useCartoes());
  const [conta, setConta] = useState(fixo?.contaId ? `debito:${fixo.contaId}` : "");
  const [nome, setNome] = useState(fixo?.nome ?? "");
  const [icone, setIcone] = useState(fixo?.icone ?? "📌");
  const [categoria, setCategoria] = useState<CategoriaFixo>(fixo?.categoria ?? (assinaturaNoCartao ? "assinaturas" : "contas"));
  const [valor, setValor] = useState(fixo ? valorParaCampo(fixo.valor) : "");
  const [varia, setVaria] = useState(fixo?.varia ?? false);
  const [dia, setDia] = useState(fixo ? String(fixo.dia) : "");
  const [pagamento, setPagamento] = useState<FormaPagamento>(
    fixo?.pagamento === "pix" ? "debito" : (fixo?.pagamento ?? (assinaturaNoCartao ? "cartao" : "debito")),
  );
  // A partir de quando existe (dá para cadastrar o aluguel novo que começa em dezembro)
  const [desde, setDesde] = useState(fixo?.desde ?? mesAtual());
  // Cancelar a partir de um mês (o histórico fica) e pausar meses
  const [cancelarEm, setCancelarEm] = useState(fixo?.ate ? somarMeses(fixo.ate, 1) : "");
  const [pausas, setPausas] = useState<string[]>(fixo?.pausas ?? []);
  const [mostrarFim, setMostrarFim] = useState(!!fixo?.ate || (fixo?.pausas ?? []).length > 0);
  const [cartaoId, setCartaoId] = useState(fixo?.cartaoId ?? assinaturaNoCartao ?? cartoes[0]?.id ?? "");
  const [frequencia, setFrequencia] = useState<Frequencia>(fixo?.frequencia ?? "mensal");
  const [mesReferencia, setMesReferencia] = useState(fixo?.mesReferencia ?? "");
  // "A cada…": de quantas em quantas semanas ou dias, começando em qual data
  const intervaloInicial = fixo?.intervaloDias ?? 15;
  const [intervalo, setIntervalo] = useState(String(intervaloInicial % 7 === 0 ? intervaloInicial / 7 : intervaloInicial));
  const [unidadeIntervalo, setUnidadeIntervalo] = useState<"dias" | "semanas">(intervaloInicial % 7 === 0 ? "semanas" : "dias");
  const [inicio, setInicio] = useState(fixo?.inicio ?? hojeISO());
  const porIntervalo = frequencia === "personalizada";
  const porExtenso = FREQUENCIAS.find((f) => f.id === frequencia)!.porExtenso;
  const sugestoes = assinaturaNoCartao ? SUGESTOES_FIXO.filter((s) => s.categoria === "assinaturas") : SUGESTOES_FIXO;
  const [erro, setErro] = useState("");

  function usarSugestao(s: (typeof SUGESTOES_FIXO)[number]) {
    setNome(s.nome);
    setIcone(s.icone);
    setCategoria(s.categoria);
    setVaria(!!s.varia);
    if (s.intervaloDias) {
      setFrequencia("personalizada");
      setIntervalo(String(s.intervaloDias % 7 === 0 ? s.intervaloDias / 7 : s.intervaloDias));
      setUnidadeIntervalo(s.intervaloDias % 7 === 0 ? "semanas" : "dias");
    }
    setErro("");
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    const numero = lerValor(valor);
    const intervaloDias = Number(intervalo) * (unidadeIntervalo === "semanas" ? 7 : 1);
    if (!nome.trim()) return setErro("Dê um nome para o gasto.");
    if (!(numero > 0)) return setErro("Digite o valor.");
    if (porIntervalo) {
      if (!(intervaloDias > 0)) return setErro("De quanto em quanto tempo?");
      if (!inicio) return setErro("Escolha a data da próxima vez.");
    } else {
      if (!dia) return setErro("Escolha o dia do vencimento.");
      if (frequencia !== "mensal" && !mesReferencia) return setErro("Escolha o mês da próxima cobrança.");
    }
    if (pagamento === "cartao" && !cartaoId) return setErro("Escolha o cartão (ou cadastre um na aba Contas).");

    const dados = {
      nome: nome.trim(),
      icone,
      categoria,
      valor: numero,
      varia,
      dia: porIntervalo ? Number(inicio.slice(8, 10)) : Number(dia),
      pagamento,
      cartaoId: pagamento === "cartao" ? cartaoId : undefined,
      contaId: pagamento !== "cartao" ? lerEscolha(conta).id || undefined : undefined,
      frequencia,
      mesReferencia: frequencia === "semestral" || frequencia === "anual" ? mesReferencia : undefined,
      intervaloDias: porIntervalo ? intervaloDias : undefined,
      inicio: porIntervalo ? inicio : undefined,
      desde,
      // Cancelado a partir de X: o último mês que cobra é o anterior
      ate: cancelarEm ? somarMeses(cancelarEm, -1) : undefined,
      pausas: pausas.length ? pausas : undefined,
    };
    if (cancelarEm && cancelarEm <= desde) return setErro("O cancelamento tem que ser depois do mês em que começa.");
    // Passou a ser no cartão (ou trocou de cartão)? Começa a contar na fatura aberta hoje, não nas antigas
    const entrouNoCartao = dados.pagamento === "cartao" && (fixo?.pagamento !== "cartao" || fixo?.cartaoId !== dados.cartaoId);
    if (fixo) atualizarGastoFixo(fixo.id, entrouNoCartao ? { ...dados, criadoEm: hojeISO() } : dados);
    else adicionarGastoFixo(dados);
    mostrarAviso({
      texto: fixo
        ? "Gasto fixo atualizado ✓"
        : desde > mesAtual()
          ? `Gasto fixo criado: começa em ${nomeMes(desde).toLowerCase()}`
          : "Gasto fixo criado ✓",
    });
    onFechar();
  }

  return (
    <Modal
      titulo={fixo ? "Editar gasto fixo" : assinaturaNoCartao ? "Nova assinatura no cartão" : "Novo gasto fixo"}
      onFechar={onFechar}
    >
      <form onSubmit={salvar} className="space-y-4">
        {!fixo && (
          <div className="space-y-1.5">
            <span className="text-xs text-suave">Sugestões</span>
            <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
              {sugestoes.map((s) => (
                <Chip key={s.nome} ativo={nome === s.nome} onClick={() => usarSugestao(s)}>
                  {s.icone} {s.nome}
                </Chip>
              ))}
            </div>
          </div>
        )}

        <Campo rotulo="Nome">
          <div className="flex gap-2">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-fundo text-xl">{icone}</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Aluguel" className="campo" />
          </div>
        </Campo>

        <div className="space-y-1.5">
          <span className="text-xs text-suave">Categoria</span>
          <div className="flex flex-wrap gap-2">
            {CATEGORIAS_FIXO.map((c) => (
              <Chip key={c.id} ativo={categoria === c.id} onClick={() => setCategoria(c.id)}>
                {c.icone} {c.nome}
              </Chip>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs text-suave">De quanto em quanto tempo?</span>
          <div className="flex flex-wrap gap-2">
            {FREQUENCIAS.map((f) => (
              <Chip key={f.id} ativo={frequencia === f.id} onClick={() => setFrequencia(f.id)}>
                {f.nome}
              </Chip>
            ))}
          </div>
        </div>

        {(frequencia === "semestral" || frequencia === "anual") && (
          <Campo rotulo="Mês da próxima cobrança">
            <CampoMes valor={mesReferencia} onChange={setMesReferencia} />
          </Campo>
        )}

        {porIntervalo && (
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="A cada">
              <div className="flex gap-2">
                <input
                  inputMode="numeric"
                  value={intervalo}
                  onChange={(e) => setIntervalo(soNumeros(e.target.value, false))}
                  className="campo w-16 text-center"
                />
                <select
                  value={unidadeIntervalo}
                  onChange={(e) => setUnidadeIntervalo(e.target.value as "dias" | "semanas")}
                  className="campo min-w-0 flex-1 cursor-pointer"
                >
                  <option value="dias">dias</option>
                  <option value="semanas">semanas</option>
                </select>
              </div>
            </Campo>
            <Campo rotulo="Próxima vez">
              <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="campo" />
            </Campo>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo={varia ? `Valor médio ${porExtenso}` : `Valor ${porExtenso}`}>
            <CampoValor valor={valor} onChange={setValor} />
          </Campo>
          {!porIntervalo && (
            <Campo rotulo={pagamento === "cartao" ? "Dia da cobrança" : "Dia do vencimento"}>
              <CampoSelect valor={dia} onChange={setDia} opcoes={DIAS_DO_MES} placeholder="Dia" />
            </Campo>
          )}
        </div>

        {porIntervalo && lerValor(valor) > 0 && Number(intervalo) > 0 && (
          <p className="-mt-2 text-xs text-suave">
            Dá uns{" "}
            <b className="text-white">
              {((lerValor(valor) * 30) / (Number(intervalo) * (unidadeIntervalo === "semanas" ? 7 : 1))).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </b>{" "}
            por mês.
          </p>
        )}

        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" checked={varia} onChange={(e) => setVaria(e.target.checked)} className="size-5 accent-rosa" />O
          valor muda a cada vez (ex.: luz, água, gasolina)
        </label>

        <div className="space-y-1.5">
          <span className="text-xs text-suave">Como paga?</span>
          <div className="flex flex-wrap gap-2">
            {FORMAS_PAGAMENTO.map((f) => (
              <Chip key={f.id} ativo={pagamento === f.id} onClick={() => setPagamento(f.id)}>
                {f.icone} {f.nome}
              </Chip>
            ))}
          </div>
        </div>

        {pagamento === "cartao" &&
          (cartoes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {cartoes.map((c) => (
                <Chip key={c.id} ativo={cartaoId === c.id} onClick={() => setCartaoId(c.id)}>
                  💳 {c.nome}
                </Chip>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl bg-roxo/10 px-4 py-3 text-xs text-suave">
              Você ainda não tem cartões cadastrados. Cadastre na aba <b>Contas</b> e depois volte aqui.
            </p>
          ))}

        {pagamento !== "cartao" && <EscolhaConta valor={conta} onChange={setConta} rotulo="De qual conta sai?" />}

        <Campo rotulo="Começa em">
          <CampoMes valor={desde} onChange={(m) => setDesde(m || mesAtual())} />
        </Campo>

        {/* Cancelar (a partir de um mês, sem apagar o histórico) e pausar */}
        {fixo && !mostrarFim && (
          <button type="button" onClick={() => setMostrarFim(true)} className="text-sm text-rosa">
            Cancelar ou pausar este gasto
          </button>
        )}
        {fixo && mostrarFim && (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-fundo/50 p-4 text-sm">
            <Campo rotulo="Cancelado a partir de (o que já passou continua no histórico)">
              <CampoMes valor={cancelarEm} onChange={setCancelarEm} />
            </Campo>
            {cancelarEm && (
              <p className="-mt-1 text-xs text-suave">
                Última cobrança em {nomeMes(somarMeses(cancelarEm, -1)).toLowerCase()}.{" "}
                <button type="button" onClick={() => setCancelarEm("")} className="text-rosa">
                  não cancelar
                </button>
              </p>
            )}
            <div className="space-y-1.5">
              <span className="text-xs text-suave">Pausar (não cobra nestes meses)</span>
              <div className="flex flex-wrap gap-2">
                {[0, 1, 2, 3].map((i) => {
                  const m = somarMeses(mesAtual(), i);
                  const ativo = pausas.includes(m);
                  return (
                    <Chip key={m} ativo={ativo} onClick={() => setPausas(ativo ? pausas.filter((x) => x !== m) : [...pausas, m])}>
                      {nomeMes(m).split(" ")[0]}
                    </Chip>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {pagamento === "cartao" && cartoes.length > 0 && (
          <p className="text-xs text-suave">💡 Esse gasto entra sozinho na fatura do cartão todo mês.</p>
        )}

        {erro && <p className="text-sm text-saida">{erro}</p>}

        <button type="submit" className="botao-gradiente w-full rounded-full py-3 font-semibold">
          {fixo ? "Salvar alterações" : "Adicionar"}
        </button>

        {fixo && (
          <button
            type="button"
            onClick={() => {
              comDesfazer(`“${fixo.nome}” excluído`, () => removerGastoFixo(fixo.id));
              onFechar();
            }}
            className="w-full py-1 text-sm text-suave hover:text-saida"
          >
            Excluir gasto fixo
          </button>
        )}
        {fixo && (
          <p className="text-center text-xs text-suave">
            Excluir apaga a previsão de todos os meses. Parou de pagar? Prefira “Cancelar a partir de”.
          </p>
        )}
      </form>
    </Modal>
  );
}
