"use client";

import Link from "next/link";
import { useCartoes, useLancamentos } from "@/lib/store";
import { brl } from "@/lib/formato";
import { iconeDaConta, saldoDaConta, temCredito } from "@/lib/contas";
import Icone from "@/components/Icone";

/**
 * Escolher de qual conta sai (ou em qual entra) o dinheiro.
 * O valor é "debito:<id>" ou "credito:<id>".
 * - modo "debito": só as contas (saldo)
 * - modo "ambos": primeiro escolhe Débito/Pix ou Crédito, depois a conta (ou o cartão)
 */
export default function EscolhaConta({
  valor,
  onChange,
  modo = "debito",
  rotulo = "Conta",
}: {
  valor: string;
  onChange: (valor: string) => void;
  modo?: "debito" | "ambos";
  rotulo?: string;
}) {
  const contas = useCartoes();
  const lancamentos = useLancamentos();

  if (contas.length === 0) {
    return (
      <p className="rounded-2xl bg-roxo/10 px-4 py-3 text-xs text-suave">
        Você ainda não tem contas. Cadastre na aba{" "}
        <Link href="/contas" className="text-rosa">
          Contas
        </Link>{" "}
        para tudo cair no lugar certo.
      </p>
    );
  }

  const escolha = lerEscolha(valor);
  const cartoes = contas.filter(temCredito);
  // No modo "ambos", primeiro a forma (débito/Pix ou crédito), depois a conta
  const forma = modo === "ambos" && escolha.credito ? "credito" : "debito";

  function trocarForma(nova: "debito" | "credito") {
    if (nova === forma) return;
    const lista = nova === "credito" ? cartoes : contas;
    // Mantém a mesma conta quando ela tem as duas formas (ex.: Nubank débito → Nubank crédito)
    const mesma = lista.find((c) => c.id === escolha.id) ?? lista[0];
    onChange(mesma ? `${nova}:${mesma.id}` : "");
  }

  const opcoes =
    forma === "credito"
      ? cartoes.map((c) => ({ valor: `credito:${c.id}`, nome: c.nome, icone: "💳", detalhe: `fecha dia ${c.diaFechamento}` }))
      : contas.map((c) => ({
          valor: `debito:${c.id}`,
          nome: c.nome,
          icone: iconeDaConta(c) === "💳" ? "🏦" : iconeDaConta(c),
          detalhe: brl(saldoDaConta(c, lancamentos)),
        }));

  return (
    <div className="space-y-1.5">
      <span className="text-xs text-suave">{rotulo}</span>
      {modo === "ambos" && (
        <div className="grid grid-cols-2 gap-1 rounded-full bg-fundo p-1">
          {(["debito", "credito"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => trocarForma(f)}
              disabled={f === "credito" && cartoes.length === 0}
              title={
                f === "credito" && cartoes.length === 0
                  ? "Nenhuma conta com cartão de crédito. Ative o crédito na aba Contas."
                  : undefined
              }
              className={`rounded-full py-1.5 text-sm font-medium transition-colors disabled:opacity-40 ${
                forma === f ? "bg-white text-fundo" : "text-suave hover:text-white"
              }`}
            >
              {f === "debito" ? "🏦 Débito / Pix" : "💳 Crédito"}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {opcoes.map((o) => (
          <button
            key={o.valor}
            type="button"
            onClick={() => onChange(o.valor)}
            className={`rounded-2xl border px-3 py-2 text-left text-sm transition-colors ${
              valor === o.valor ? "border-rosa bg-rosa/15 text-white" : "border-white/10 text-suave hover:text-white"
            }`}
          >
            <Icone e={o.icone} /> {o.nome}
            <span className="block text-[0.65rem] text-suave">{o.detalhe}</span>
          </button>
        ))}
      </div>
      {modo === "ambos" && cartoes.length === 0 && (
        <p className="text-[0.65rem] text-suave">Para pagar no crédito, ative o cartão de crédito da conta na aba Contas.</p>
      )}
    </div>
  );
}

/** "debito:abc" -> { credito: false, id: "abc" } */
export function lerEscolha(valor: string) {
  const [tipo, id] = valor.split(":");
  return { credito: tipo === "credito", id: id ?? "" };
}
