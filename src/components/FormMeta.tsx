"use client";

import { useState } from "react";
import { adicionarMeta, atualizarMeta, ICONES_META, type Meta } from "@/lib/store";
import { metaDeQuitar } from "@/lib/metas";
import { lerValor } from "@/lib/formato";
import Modal from "./Modal";
import { Campo, CampoValor, Chip } from "./Campos";
import CampoMes from "./CampoMes";
import CamposQuitar, { lerRascunhoQuitar, type RascunhoQuitar } from "./CamposQuitar";
import EscolhaConta, { lerEscolha } from "./EscolhaConta";

const TIPOS_DIVIDA: { id: RascunhoQuitar["divida"]; nome: string }[] = [
  { id: "parcelado", nome: "🛍️ Compra parcelada" },
  { id: "emprestimo", nome: "🏦 Empréstimo" },
  { id: "financiamento", nome: "🚗 Financiamento" },
  { id: "outro", nome: "🧾 Outra dívida" },
];

function paraTexto(valor: number | null | undefined) {
  return valor ? String(valor).replace(".", ",") : "";
}

// Criar uma meta nova ou editar uma que já existe (de juntar ou de quitar).
export default function FormMeta({
  meta,
  tipoInicial = "juntar",
  onFechar,
}: {
  meta?: Meta;
  tipoInicial?: "juntar" | "quitar";
  onFechar: () => void;
}) {
  const [tipo, setTipo] = useState<"juntar" | "quitar">(meta?.tipo ?? tipoInicial);
  const [conta, setConta] = useState(meta?.contaId ? `debito:${meta.contaId}` : "");
  const [nome, setNome] = useState(meta?.nome ?? "");
  const [icone, setIcone] = useState(meta?.icone ?? ICONES_META[0]);
  // juntar
  const [alvo, setAlvo] = useState(paraTexto(meta?.alvo));
  const [guardado, setGuardado] = useState(paraTexto(meta?.guardado));
  const [prazo, setPrazo] = useState(meta?.prazo ?? "");
  const [aporte, setAporte] = useState(paraTexto(meta?.aporteMensal));
  // quitar
  const [quitar, setQuitar] = useState<RascunhoQuitar>({
    divida: meta?.divida ?? "parcelado",
    parcela: paraTexto(meta?.parcela),
    parcelas: meta?.parcelas ? String(meta.parcelas) : "",
    pagas: meta?.parcelasPagas ? String(meta.parcelasPagas) : "",
    valorOriginal: paraTexto(meta?.valorOriginal),
    juros: meta?.jurosMes ? paraTexto(Math.round(meta.jurosMes * 10000) / 100) : "",
    dia: meta?.diaVencimento ? String(meta.diaVencimento) : "",
  });
  const [erro, setErro] = useState("");

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return setErro("Dê um nome para a sua meta.");

    let dados: Omit<Meta, "id">;
    if (tipo === "quitar") {
      const valores = lerRascunhoQuitar(quitar);
      if (!valores) return setErro("Preencha o valor da parcela e em quantas vezes (as pagas não podem passar do total).");
      dados = { ...metaDeQuitar({ nome: nome.trim(), icone, ...valores }), contaId: lerEscolha(conta).id || undefined };
    } else {
      const valorAlvo = lerValor(alvo);
      if (!(valorAlvo > 0)) return setErro("Quanto você quer juntar? Digite um valor maior que zero.");
      dados = {
        nome: nome.trim(),
        icone,
        tipo: "juntar",
        alvo: valorAlvo,
        guardado: lerValor(guardado) || 0,
        prazo: prazo || null,
        aporteMensal: lerValor(aporte) || null,
        reserva: meta?.reserva,
        contaId: lerEscolha(conta).id || undefined,
      };
    }

    if (meta) atualizarMeta(meta.id, dados);
    else adicionarMeta(dados);
    onFechar();
  }

  return (
    <Modal titulo={meta ? "Editar meta" : "Nova meta"} onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-4">
        {!meta && (
          <div className="grid grid-cols-2 gap-1 rounded-full bg-fundo p-1">
            {(["juntar", "quitar"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                className={`rounded-full py-2 text-sm font-medium transition-colors ${
                  tipo === t ? "botao-gradiente" : "text-suave"
                }`}
              >
                {t === "juntar" ? "🎯 Juntar para algo" : "💸 Quitar algo"}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {ICONES_META.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIcone(i)}
              className={`grid size-10 place-items-center rounded-full text-lg transition-colors ${
                icone === i ? "bg-rosa/20 ring-2 ring-rosa" : "bg-fundo hover:bg-superficie-2"
              }`}
            >
              {i}
            </button>
          ))}
        </div>

        <Campo rotulo={tipo === "quitar" ? "O que você quer quitar?" : "Nome da meta"}>
          <input
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder={tipo === "quitar" ? "Ex.: Celular parcelado" : "Ex.: Notebook novo"}
            className="campo"
          />
        </Campo>

        {tipo === "quitar" ? (
          <>
            <div className="flex flex-wrap gap-2">
              {TIPOS_DIVIDA.map((t) => (
                <Chip key={t.id} ativo={quitar.divida === t.id} onClick={() => setQuitar({ ...quitar, divida: t.id })}>
                  {t.nome}
                </Chip>
              ))}
            </div>
            <CamposQuitar key={quitar.divida} rascunho={quitar} onChange={setQuitar} />
            <EscolhaConta valor={conta} onChange={setConta} rotulo="De qual conta sai a parcela?" />
            <p className="text-xs text-suave">
              💳 Comprou no cartão de crédito? Então não é aqui: inclua a compra no cartão, na aba Contas (ela já entra nas
              faturas).
            </p>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Quanto quer juntar">
                <CampoValor valor={alvo} onChange={setAlvo} />
              </Campo>
              <Campo rotulo="Quanto já tem">
                <CampoValor valor={guardado} onChange={setGuardado} />
              </Campo>
            </div>

            <Campo rotulo="Até quando? (opcional)">
              <CampoMes valor={prazo} onChange={setPrazo} />
            </Campo>
            <Campo rotulo="Consigo guardar por mês (opcional)">
              <CampoValor valor={aporte} onChange={setAporte} />
            </Campo>
            <EscolhaConta valor={conta} onChange={setConta} rotulo="De qual conta sai o dinheiro guardado?" />
          </>
        )}

        {erro && <p className="text-sm text-saida">{erro}</p>}

        <button type="submit" className="botao-gradiente w-full rounded-full py-3 font-semibold">
          {meta ? "Salvar alterações" : "Criar meta"}
        </button>
      </form>
    </Modal>
  );
}
