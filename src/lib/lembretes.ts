"use client";

// Lembretes: "Aluguel vence amanhã", "Fatura do Nubank fecha em 2 dias".
// Uma vez por dia, ao abrir o app: aviso na tela e, se a pessoa ativou em Configurações, notificação do celular.

import { useEffect } from "react";
import { lerPreferencias, mudarPreferencias } from "./store";
import { useDados } from "./dados";
import { previstosDoMes, type Dados } from "./previstos";
import { faturaAberta, dataDeFechamento, resumoDaFatura } from "./cartoes";
import { temCredito } from "./contas";
import { brl, diasAte, hojeISO, mesAtual, somarMeses } from "./formato";
import { mostrarAviso } from "./avisos";

/** O que merece lembrete hoje. */
export function lembretesDeHoje(d: Dados): string[] {
  const textos: string[] = [];
  const meses = [mesAtual(), somarMeses(mesAtual(), 1)];
  for (const p of meses.flatMap((m) => previstosDoMes(m, d))) {
    if (p.tipo !== "saida" || p.origem === "guardar" || p.origem === "mercado") continue;
    const dias = diasAte(p.data);
    if (dias < 0) textos.push(`⏰ ${p.nome} está atrasado (${brl(p.valor)})`);
    else if (dias === 0) textos.push(`📌 ${p.nome} vence hoje (${brl(p.valor)})`);
    else if (dias === 1) textos.push(`📌 ${p.nome} vence amanhã (${brl(p.valor)})`);
  }
  for (const c of d.cartoes.filter(temCredito)) {
    const fatura = faturaAberta(c);
    const dias = diasAte(dataDeFechamento(c, fatura));
    const valor = resumoDaFatura(c, fatura, d).valor;
    if (dias >= 0 && dias <= 2 && valor > 0)
      textos.push(
        `💳 A fatura do ${c.nome} fecha ${dias === 0 ? "hoje" : dias === 1 ? "amanhã" : `em ${dias} dias`} (${brl(valor)})`,
      );
  }
  return [...new Set(textos)];
}

/** Pede permissão para mandar notificações (precisa de um toque da pessoa). */
export async function pedirPermissaoDeNotificacao() {
  if (typeof Notification === "undefined") return "indisponivel" as const;
  if (Notification.permission === "granted") return "ok" as const;
  const resposta = await Notification.requestPermission();
  return resposta === "granted" ? ("ok" as const) : ("negado" as const);
}

export function useLembretes(ativo: boolean) {
  const dados = useDados();
  useEffect(() => {
    if (!ativo) return;
    const prefs = lerPreferencias();
    const hoje = hojeISO();
    if (prefs.lembradoEm === hoje) return;
    // Espera os dados carregarem (na primeira pintura as listas ainda estão vazias)
    const espera = setTimeout(() => {
      const textos = lembretesDeHoje(dados);
      mudarPreferencias({ lembradoEm: hoje });
      if (textos.length === 0) return;
      mostrarAviso(
        {
          texto: textos.length === 1 ? textos[0] : `${textos[0]} · e mais ${textos.length - 1}`,
          link: { texto: "Ver", href: "/lancamentos" },
        },
        8,
      );
      if (prefs.lembretes && typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          new Notification("NAXXO Finanças", {
            body: textos.slice(0, 4).join("\n"),
            icon: "/icone-app/192",
            tag: `lembretes-${hoje}`,
          });
        } catch {
          // Alguns celulares só mostram notificação pelo app instalado: o aviso na tela já apareceu.
        }
      }
    }, 1500);
    return () => clearTimeout(espera);
  }, [ativo, dados]);
}
