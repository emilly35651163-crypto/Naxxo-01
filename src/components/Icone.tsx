"use client";

import { usePreferencias } from "@/lib/store";
import { temaPorId } from "@/lib/temas";
import { ICONES } from "./icones-mapa";

// Os emojis do app viram desenhos 2D que mudam de cor com o tema:
// - temas temáticos (Mar profundo, Bolhas…): ícone em duas cores, na cor de destaque do tema (mais vibrante);
// - temas sóbrios (NAXXO, Azul escuro/claro…): só o contorno, na cor do texto (mais simples e sério).
// Emoji que não tem desenho (ou que a pessoa escolheu numa categoria nova) continua como emoji.

const EMOJI = /^(\p{Extended_Pictographic}️?)\s*/u;

function useEstiloDosIcones() {
  const { tema } = usePreferencias();
  return temaPorId(tema)?.estilo === "tematico" ? "tematico" : "sobrio";
}

export default function Icone({ e, className = "" }: { e?: string | null; className?: string }) {
  const estilo = useEstiloDosIcones();
  if (!e) return null;
  const Desenho = ICONES[e] ?? ICONES[e.replace(/️/g, "")] ?? ICONES[`${e}️`];
  if (!Desenho) return <span className={className}>{e}</span>;
  return (
    <Desenho
      weight={estilo === "tematico" ? "duotone" : "regular"}
      aria-hidden
      className={`inline-block shrink-0 align-[-0.15em] ${estilo === "tematico" ? "text-rosa" : ""} ${className}`}
      size="1.1em"
    />
  );
}

/** Texto que começa com emoji ("🎨 Aparência"): o emoji vira ícone, o resto continua texto. */
export function ComIcone({ texto }: { texto: string }) {
  const m = texto.match(EMOJI);
  if (!m) return <>{texto}</>;
  return (
    <>
      <Icone e={m[1]} /> {texto.slice(m[0].length)}
    </>
  );
}

// Enfeites: somem do texto (carinhas, brilhos, corações, confete)
const DECORATIVOS = new Set([
  "👋",
  "😟",
  "🙂",
  "😬",
  "🙌",
  "✨",
  "🎉",
  "🔮",
  "💜",
  "🩷",
  "💚",
  "😊",
  "🥳",
  "🤩",
  "😉",
  "🔥",
  "💪",
  "🚀",
]);
const EMOJIS = /((?![©®™])\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*)/u;

/** Qualquer texto: cada emoji vira ícone (ou some, se for só enfeite); o resto continua texto. */
export function TextoComIcones({ texto }: { texto: string | number | null | undefined }) {
  if (texto === null || texto === undefined || texto === "") return null;
  const s = String(texto);
  if (!EMOJIS.test(s)) return <>{s}</>;
  const partes = s.split(new RegExp(EMOJIS.source, "gu"));
  return (
    <>
      {partes.map((p, i) =>
        i % 2 === 0 ? p.replace(/^ (?= )/, "") : DECORATIVOS.has(p.replace(/️/g, "")) ? null : <Icone key={i} e={p} />,
      )}
    </>
  );
}

/** Texto sem nenhum emoji (para notificações do celular, títulos da aba…). */
export function semEmojis(s: string) {
  return s
    .replace(new RegExp(EMOJIS.source, "gu"), "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
