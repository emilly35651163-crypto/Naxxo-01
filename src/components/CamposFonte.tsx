"use client";

import {
  beneficioEmDinheiro,
  FORMAS_RENDA,
  rendaFixa,
  TIPOS_BENEFICIO,
  useCartoes,
  type FonteRenda,
  type FormaRenda,
  type TipoBeneficio,
} from "@/lib/store";
import {
  brl,
  dataDoRecebimento,
  formatarData,
  hojeISO,
  lerValor,
  mesAtual,
  OPCOES_DIA_RECEBIMENTO,
  soNumeros,
  valorParaCampo,
} from "@/lib/formato";
import { ehVale } from "@/lib/contas";
import { Campo, CampoSelect, CampoValor, Chip, DIAS_DO_MES } from "./Campos";
import EscolhaConta, { lerEscolha } from "./EscolhaConta";

// Os campos de uma fonte de renda, usados no questionário e na aba Renda (criar e editar).
// Enquanto a pessoa digita, os valores ficam como texto (o "rascunho").

type RascunhoBeneficio = { tipo: TipoBeneficio; nome: string; valor: string; emDinheiro: boolean; contaId?: string };

export type RascunhoFonte = {
  nome: string;
  forma: FormaRenda;
  valor: string;
  valorHora: string;
  horasMes: string;
  beneficios: RascunhoBeneficio[];
  dia: string;
  conta?: string; // "debito:<id>": em qual conta cai
  frequencia: "mensal" | "semanal" | "quinzenal";
  inicio: string;
  clt: boolean;
  adiantamento: boolean;
  diaAdiantamento: string;
  percentualAdiantamento: string;
  decimoTerceiro: boolean;
  mesFerias: string;
};

export const RASCUNHO_FONTE_VAZIO: RascunhoFonte = {
  nome: "",
  forma: "fixo",
  valor: "",
  valorHora: "",
  horasMes: "",
  beneficios: [],
  dia: "",
  frequencia: "mensal",
  inicio: "",
  clt: false,
  adiantamento: false,
  diaAdiantamento: "20",
  percentualAdiantamento: "40",
  decimoTerceiro: true,
  mesFerias: "",
};

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** Uma fonte que já existe vira rascunho (para editar). */
export function fonteParaRascunho(f: FonteRenda): RascunhoFonte {
  return {
    nome: f.nome,
    forma: f.forma,
    valor: valorParaCampo(f.valor),
    valorHora: f.valorHora ? valorParaCampo(f.valorHora) : "",
    horasMes: f.horasMes ? String(f.horasMes) : "",
    beneficios: (f.beneficios ?? []).map((b) => ({
      tipo: b.tipo,
      nome: b.nome,
      valor: valorParaCampo(b.valor),
      emDinheiro: beneficioEmDinheiro(b),
      contaId: b.contaId,
    })),
    dia: f.diaRecebimento ?? "",
    conta: f.contaId ? `debito:${f.contaId}` : undefined,
    frequencia: f.frequencia ?? "mensal",
    inicio: f.inicio ?? "",
    clt: !!f.adiantamento || !!f.decimoTerceiro || !!f.mesFerias,
    adiantamento: !!f.adiantamento,
    diaAdiantamento: f.adiantamento?.dia ?? "20",
    percentualAdiantamento: String(f.adiantamento?.percentual ?? 40),
    decimoTerceiro: f.decimoTerceiro ?? true,
    mesFerias: f.mesFerias ? String(f.mesFerias) : "",
  };
}

/** O que falta preencher (ou null se está tudo certo). */
export function problemaDoRascunho(r: RascunhoFonte): string | null {
  const faltaBeneficio = r.beneficios.find((b) => !(lerValor(b.valor) > 0));
  if (faltaBeneficio) return `Falta o valor de “${faltaBeneficio.nome || "benefício"}” (ou tire ele da lista).`;
  if (r.forma === "hora") {
    if (!(lerValor(r.valorHora) > 0)) return "Falta o valor da hora.";
    if (!(lerValor(r.horasMes) > 0)) return "Faltam as horas por mês (uma média).";
    return null;
  }
  if (!(lerValor(r.valor) > 0))
    return r.frequencia === "mensal" ? "Falta quanto entra por mês." : "Falta quanto entra de cada vez.";
  return null;
}

/** Transforma o rascunho em uma fonte de verdade. Devolve null se faltar algum valor. */
export function rascunhoParaFonte(r: RascunhoFonte): Omit<FonteRenda, "id"> | null {
  if (problemaDoRascunho(r)) return null;
  const nome = r.nome.trim() || (r.forma === "fixo" ? "Salário" : "Renda extra");
  const beneficios = r.beneficios.map((b) => ({
    tipo: b.tipo,
    nome: b.nome.trim() || "Benefício",
    valor: lerValor(b.valor),
    emDinheiro: b.emDinheiro,
    contaId: b.emDinheiro ? undefined : b.contaId,
  }));
  const diaRecebimento = r.dia || undefined;
  const contaId = r.conta ? lerEscolha(r.conta).id || undefined : undefined;
  const fixa = rendaFixa(r.forma);
  const clt = fixa && r.clt;
  const extras = {
    beneficios,
    diaRecebimento,
    contaId,
    frequencia: r.forma === "hora" ? ("mensal" as const) : r.frequencia,
    inicio: r.frequencia !== "mensal" ? r.inicio || hojeISO() : undefined,
    adiantamento:
      clt && r.adiantamento
        ? { dia: r.diaAdiantamento || "20", percentual: Math.min(Math.max(lerValor(r.percentualAdiantamento) || 40, 1), 99) }
        : null,
    decimoTerceiro: clt && r.decimoTerceiro,
    mesFerias: clt && r.mesFerias ? Number(r.mesFerias) : null,
  };

  if (r.forma === "hora") {
    const valorHora = lerValor(r.valorHora);
    const horasMes = lerValor(r.horasMes);
    return { nome, forma: r.forma, valor: valorHora * horasMes, valorHora, horasMes, ...extras };
  }
  return { nome, forma: r.forma, valor: lerValor(r.valor), valorHora: null, horasMes: null, ...extras };
}

export default function CamposFonte({
  rascunho: r,
  onChange,
  comContas = true,
}: {
  rascunho: RascunhoFonte;
  onChange: (novo: RascunhoFonte) => void;
  comContas?: boolean; // no questionário ainda não há contas: a conta é escolhida depois
}) {
  const contas = useCartoes();
  const vales = contas.filter(ehVale);
  const mudar = (mudancas: Partial<RascunhoFonte>) => onChange({ ...r, ...mudancas });
  const estimativaHora = lerValor(r.valorHora) * lerValor(r.horasMes);
  const porVez = r.forma === "hora" ? estimativaHora : lerValor(r.valor) || 0;
  const dinheiro = r.frequencia === "semanal" ? (porVez * 30) / 7 : r.frequencia === "quinzenal" ? (porVez * 30) / 14 : porVez;
  const somaBeneficios = r.beneficios.reduce((total, b) => total + (lerValor(b.valor) || 0), 0);
  const fixa = rendaFixa(r.forma);

  function adicionarBeneficio(tipo: TipoBeneficio) {
    const nome = tipo === "outro" ? "" : (TIPOS_BENEFICIO.find((t) => t.id === tipo)?.nome ?? "");
    const emDinheiro = beneficioEmDinheiro({ tipo });
    mudar({
      beneficios: [...r.beneficios, { tipo, nome, valor: "", emDinheiro, contaId: emDinheiro ? undefined : vales[0]?.id }],
    });
  }

  function mudarBeneficio(i: number, mudancas: Partial<RascunhoBeneficio>) {
    mudar({ beneficios: r.beneficios.map((b, j) => (j === i ? { ...b, ...mudancas } : b)) });
  }

  return (
    <div className="space-y-4">
      <Campo rotulo="De onde vem?">
        <input
          value={r.nome}
          onChange={(e) => mudar({ nome: e.target.value })}
          placeholder="Ex.: Emprego, Freelas, Loja"
          className="campo"
        />
      </Campo>

      <div className="space-y-1.5">
        <span className="text-xs text-suave">Como você recebe?</span>
        <div className="flex flex-wrap gap-2">
          {FORMAS_RENDA.map((f) => (
            <Chip key={f.id} ativo={r.forma === f.id} onClick={() => mudar({ forma: f.id })}>
              {f.icone} {f.nome}
            </Chip>
          ))}
        </div>
      </div>

      {r.forma !== "hora" && (
        <div className="space-y-1.5">
          <span className="text-xs text-suave">De quanto em quanto tempo?</span>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["mensal", "Todo mês"],
                ["quinzenal", "A cada 15 dias"],
                ["semanal", "Toda semana"],
              ] as const
            ).map(([id, nome]) => (
              <Chip key={id} ativo={r.frequencia === id} onClick={() => mudar({ frequencia: id })}>
                {nome}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {r.forma === "hora" ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Valor da hora">
              <CampoValor valor={r.valorHora} onChange={(valorHora) => mudar({ valorHora })} />
            </Campo>
            <Campo rotulo="Horas por mês (média)">
              <input
                inputMode="numeric"
                value={r.horasMes}
                onChange={(e) => mudar({ horasMes: soNumeros(e.target.value) })}
                placeholder="Ex.: 80"
                className="campo"
              />
            </Campo>
          </div>
          {estimativaHora > 0 && (
            <p className="text-sm">
              Dá mais ou menos <strong className="gradiente-texto">{brl(estimativaHora)}</strong> por mês.
            </p>
          )}
        </>
      ) : (
        <Campo
          rotulo={
            r.frequencia !== "mensal"
              ? fixa
                ? "Quanto entra de cada vez?"
                : "Quanto, em média, de cada vez?"
              : fixa
                ? "Quanto entra por mês?"
                : "Quanto, em média, por mês?"
          }
        >
          <CampoValor valor={r.valor} onChange={(valor) => mudar({ valor })} />
        </Campo>
      )}

      {r.frequencia !== "mensal" && r.forma !== "hora" ? (
        <>
          <Campo rotulo="Quando entra a próxima (ou entrou a última)?">
            <input
              type="date"
              value={r.inicio || hojeISO()}
              onChange={(e) => mudar({ inicio: e.target.value })}
              className="campo"
            />
          </Campo>
          {porVez > 0 && <p className="-mt-2 text-xs text-suave">≈ {brl(dinheiro)} por mês.</p>}
        </>
      ) : (
        <>
          <Campo rotulo={fixa ? "Que dia entra?" : "Que dia costuma entrar? (opcional)"}>
            <CampoSelect
              valor={r.dia}
              onChange={(dia) => mudar({ dia })}
              opcoes={OPCOES_DIA_RECEBIMENTO}
              placeholder="Escolha o dia"
            />
          </Campo>
          {r.dia && (
            <p className="-mt-2 text-xs text-suave">
              📅 Neste mês cai em {formatarData(dataDoRecebimento(r.dia, mesAtual()))} (o dia útil já pula feriados).
            </p>
          )}
        </>
      )}

      {comContas && <EscolhaConta valor={r.conta ?? ""} onChange={(conta) => mudar({ conta })} rotulo="Cai em qual conta?" />}

      {!fixa && (
        <p className="rounded-2xl bg-roxo/10 px-4 py-3 text-xs text-suave">
          💡 Como esse valor muda, a cada vez você registra quanto recebeu de verdade na aba <b>Renda</b>.
        </p>
      )}

      {/* Carteira assinada: adiantamento, 13º e férias */}
      {fixa && r.frequencia === "mensal" && (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-fundo/50 p-4">
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={r.clt}
              onChange={(e) => mudar({ clt: e.target.checked })}
              className="size-5 accent-rosa"
            />
            <span>
              <b>Carteira assinada (CLT)</b>
              <span className="block text-xs text-suave">Para prever adiantamento, 13º e férias</span>
            </span>
          </label>
          {r.clt && (
            <div className="space-y-3 border-t border-white/10 pt-3">
              <label className="flex cursor-pointer items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={r.adiantamento}
                  onChange={(e) => mudar({ adiantamento: e.target.checked })}
                  className="size-4 accent-rosa"
                />
                Recebo adiantamento (vale) no meio do mês
              </label>
              {r.adiantamento && (
                <div className="grid grid-cols-2 gap-3">
                  <Campo rotulo="Dia do adiantamento">
                    <CampoSelect
                      valor={r.diaAdiantamento}
                      onChange={(diaAdiantamento) => mudar({ diaAdiantamento })}
                      opcoes={DIAS_DO_MES}
                      placeholder="Dia"
                    />
                  </Campo>
                  <Campo rotulo="Quanto do salário (%)">
                    <input
                      inputMode="numeric"
                      value={r.percentualAdiantamento}
                      onChange={(e) => mudar({ percentualAdiantamento: soNumeros(e.target.value, false).slice(0, 2) })}
                      className="campo"
                    />
                  </Campo>
                </div>
              )}
              <label className="flex cursor-pointer items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={r.decimoTerceiro}
                  onChange={(e) => mudar({ decimoTerceiro: e.target.checked })}
                  className="size-4 accent-rosa"
                />
                Prever o 13º (metade em novembro, metade em dezembro)
              </label>
              <Campo rotulo="Mês das férias (recebe +1/3) — opcional">
                <CampoSelect
                  valor={r.mesFerias}
                  onChange={(mesFerias) => mudar({ mesFerias })}
                  opcoes={MESES.map((nome, i) => ({ valor: String(i + 1), nome }))}
                  placeholder="Ainda não sei"
                />
              </Campo>
            </div>
          )}
        </div>
      )}

      {/* Benefícios e vales que vêm junto com essa renda */}
      <div className="space-y-3 rounded-2xl border border-white/10 bg-fundo/50 p-4">
        <div>
          <p className="text-sm font-semibold">🎟️ Benefícios e vales</p>
          <p className="text-xs text-suave">Vem algo junto com essa renda? Toque para adicionar.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {TIPOS_BENEFICIO.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => adicionarBeneficio(t.id)}
              className="rounded-full border border-dashed border-white/15 px-3 py-1.5 text-xs text-suave hover:border-rosa hover:text-white"
            >
              + {t.icone} {t.nome}
            </button>
          ))}
        </div>

        {r.beneficios.map((b, i) => {
          const tipo = TIPOS_BENEFICIO.find((t) => t.id === b.tipo);
          return (
            <div key={i} className="space-y-2 rounded-2xl bg-superficie/60 p-3">
              <div className="flex items-center gap-2">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-superficie-2" aria-hidden>
                  {tipo?.icone}
                </span>
                {b.tipo === "outro" ? (
                  <input
                    autoFocus
                    value={b.nome}
                    onChange={(e) => mudarBeneficio(i, { nome: e.target.value })}
                    placeholder="Qual?"
                    className="campo min-w-0 flex-1"
                  />
                ) : (
                  <span className="min-w-0 flex-1 truncate text-sm">{b.nome}</span>
                )}
                <div className="w-36 shrink-0">
                  <CampoValor
                    valor={b.valor}
                    onChange={(valor) => mudarBeneficio(i, { valor })}
                    placeholder="por mês"
                    rotulo={`Valor de ${b.nome || "benefício"}`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => mudar({ beneficios: r.beneficios.filter((_, j) => j !== i) })}
                  aria-label={`Remover ${b.nome || "benefício"}`}
                  className="px-1 text-xl text-suave hover:text-saida"
                >
                  ×
                </button>
              </div>
              {/* Vem em dinheiro ou num cartão de vale? */}
              <div className="flex flex-wrap gap-2 pl-12">
                <Chip ativo={b.emDinheiro} onClick={() => mudarBeneficio(i, { emDinheiro: true })}>
                  💵 Em dinheiro na conta
                </Chip>
                <Chip
                  ativo={!b.emDinheiro}
                  onClick={() => mudarBeneficio(i, { emDinheiro: false, contaId: b.contaId ?? vales[0]?.id })}
                >
                  🍽️ Num cartão de vale
                </Chip>
              </div>
              {!b.emDinheiro && comContas && (
                <div className="pl-12 text-xs text-suave">
                  {vales.length > 0 ? (
                    <label className="flex items-center gap-2">
                      cai no vale
                      <select
                        value={b.contaId ?? ""}
                        onChange={(e) => mudarBeneficio(i, { contaId: e.target.value || undefined })}
                        className="rounded-full border border-white/10 bg-fundo px-2 py-1 text-white"
                      >
                        <option value="">escolher…</option>
                        {vales.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <p>Crie uma conta do tipo 🍽️ Vale na aba Contas para ver o saldo dele.</p>
                  )}
                </div>
              )}
              {!b.emDinheiro && (
                <p className="pl-12 text-[0.7rem] text-suave">
                  Vale não entra na sobra do mês nem na % da renda: só paga comida.
                </p>
              )}
            </div>
          );
        })}

        {somaBeneficios > 0 && (
          <p className="border-t border-white/10 pt-3 text-sm">
            {dinheiro > 0 ? "Com os benefícios, dá" : "Os benefícios somam"}{" "}
            <strong className="gradiente-texto">{brl(dinheiro + somaBeneficios)}</strong> por mês
            {dinheiro > 0 && (
              <span className="text-suave">
                {" "}
                ({brl(dinheiro)} + {brl(somaBeneficios)})
              </span>
            )}
            .
          </p>
        )}
      </div>
    </div>
  );
}
