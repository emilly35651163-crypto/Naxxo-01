"use client";

import { useState } from "react";

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
const ANO_ATUAL = new Date().getFullYear();
const ANOS = Array.from({ length: 16 }, (_, i) => String(ANO_ATUAL + i));

/**
 * Escolher mês e ano ("2027-06"), no lugar do campo de mês do navegador
 * (que mostra "--------- de ----" quando está vazio). Vazio = "".
 */
export default function CampoMes({ valor, onChange }: { valor: string; onChange: (mes: string) => void }) {
  const [ano, setAno] = useState(valor.slice(0, 4));
  const [mes, setMes] = useState(valor.slice(5, 7));

  function mudar(novoMes: string, novoAno: string) {
    setMes(novoMes);
    setAno(novoAno);
    onChange(novoMes && novoAno ? `${novoAno}-${novoMes}` : "");
  }

  return (
    <div className="grid grid-cols-[3fr_2fr] gap-2">
      <Seletor vazio={!mes} valor={mes} onChange={(m) => mudar(m, ano)} rotulo="Mês">
        {MESES.map((nome, i) => (
          <option key={nome} value={String(i + 1).padStart(2, "0")} className="text-white">
            {nome}
          </option>
        ))}
      </Seletor>
      <Seletor vazio={!ano} valor={ano} onChange={(a) => mudar(mes, a)} rotulo="Ano">
        {ANOS.map((a) => (
          <option key={a} value={a} className="text-white">
            {a}
          </option>
        ))}
      </Seletor>
    </div>
  );
}

function Seletor({
  vazio,
  valor,
  onChange,
  rotulo,
  children,
}: {
  vazio: boolean;
  valor: string;
  onChange: (valor: string) => void;
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        aria-label={rotulo}
        className={`campo cursor-pointer appearance-none pr-8 ${vazio ? "text-white/50" : ""}`}
      >
        <option value="">{rotulo}</option>
        {children}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-suave">▾</span>
    </div>
  );
}
