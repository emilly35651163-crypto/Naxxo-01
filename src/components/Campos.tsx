"use client";

import { mascaraDinheiro } from "@/lib/formato";

/** Um campo com o nome em cima. */
export function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs text-suave">{rotulo}</span>
      {children}
    </label>
  );
}

/**
 * Campo para digitar dinheiro, com o "R$" na frente. Os números entram pela direita (1 → 0,01; 12345 → 123,45).
 * Com `negativo`, aceita o sinal de menos (ex.: saldo no cheque especial).
 */
export function CampoValor({
  valor,
  onChange,
  placeholder = "0,00",
  autoFocus,
  negativo,
  rotulo,
}: {
  valor: string;
  onChange: (texto: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  negativo?: boolean;
  rotulo?: string;
}) {
  const ehNegativo = valor.trim().startsWith("-");
  return (
    <div className="campo flex items-center gap-2">
      <span className="text-suave">R$</span>
      <input
        inputMode={negativo ? "text" : "decimal"}
        value={valor}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label={rotulo}
        onChange={(e) => onChange(mascaraDinheiro(e.target.value, negativo))}
        className="w-full bg-transparent outline-none placeholder:text-white/45"
      />
      {negativo && (
        <button
          type="button"
          onClick={() => onChange(ehNegativo ? valor.trim().slice(1) : `-${valor.trim()}`)}
          aria-pressed={ehNegativo}
          className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${ehNegativo ? "border-saida/60 text-saida" : "border-white/15 text-suave"}`}
          title="Saldo negativo (cheque especial)"
        >
          − negativo
        </button>
      )}
    </div>
  );
}
/** Lista de escolha (ex.: dia do mês), apagada enquanto nada foi escolhido. */
export function CampoSelect({
  valor,
  onChange,
  opcoes,
  placeholder,
}: {
  valor: string;
  onChange: (valor: string) => void;
  opcoes: { valor: string; nome: string }[];
  placeholder: string;
}) {
  return (
    <div className="relative">
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className={`campo cursor-pointer appearance-none pr-8 ${valor ? "" : "text-white/50"}`}
      >
        <option value="">{placeholder}</option>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor} className="text-white">
            {o.nome}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-suave">▾</span>
    </div>
  );
}

export const DIAS_DO_MES = Array.from({ length: 31 }, (_, i) => ({ valor: String(i + 1), nome: `Dia ${i + 1}` }));

/** Botão redondinho que pode estar marcado ou não (categorias, opções). */
export function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
        ativo ? "border-rosa bg-rosa/15 text-white" : "border-white/10 text-suave hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
