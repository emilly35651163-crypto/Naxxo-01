import { useId } from "react";
import Image from "next/image";
import simbolo from "@/assets/naxxo-simbolo.png";

/** O nome "NAXXO" desenhado com traços finos, igual à identidade (o "A" é um Λ sem traço no meio). */
export function NomeNaxxo({ className = "" }: { className?: string }) {
  const id = useId();

  return (
    <svg viewBox="-2 3 226 34" className={className} role="img" aria-label="NAXXO">
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="222" y2="0">
          <stop offset="0.12" stopColor="#ffffff" />
          <stop offset="0.35" stopColor="#ff8ae6" />
          <stop offset="0.65" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#7cb4ff" />
        </linearGradient>
      </defs>
      <g fill="none" stroke={`url(#${id})`} strokeWidth="2.2" strokeLinejoin="round">
        <path d="M1 35V5l26 30V5" />
        <path d="M48 35L62 5l14 30" />
        <path d="M96 5l28 30M124 5L96 35" />
        <path d="M144 5l28 30M172 5l-28 30" />
        <circle cx="207" cy="20" r="15" />
      </g>
    </svg>
  );
}

export default function Logo({ comNome = false }: { comNome?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Image
        src={simbolo}
        alt={comNome ? "" : "NAXXO"}
        className="h-8 w-auto drop-shadow-[0_0_12px_rgb(255_78_216/0.45)]"
        priority
      />
      {comNome && <NomeNaxxo className="h-4 w-auto" />}
    </div>
  );
}
