const MARCOS = [0.25, 0.5, 0.75, 1];
import Icone, { TextoComIcones } from "@/components/Icone";

// A "trilha" desenhada: uma estrada com 4 marcos (25%, 50%, 75% e a chegada).
export default function TrilhaProgresso({ progresso }: { progresso: number }) {
  const porcento = `${Math.round(progresso * 100)}%`;

  return (
    <div className="relative mx-3 mb-6 mt-7 h-2">
      <div className="absolute inset-0 rounded-full bg-white/10" />
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-rosa via-roxo to-azul shadow-[0_0_14px_rgb(255_78_216/0.5)] transition-[width] duration-700"
        style={{ width: porcento }}
      />

      {/* Onde a pessoa está agora */}
      <span
        className="absolute -top-7 -translate-x-1/2 text-lg drop-shadow-[0_0_6px_rgb(255_78_216/0.8)] transition-[left] duration-700"
        style={{ left: porcento }}
        aria-hidden
      >
        <Icone e="📍" />
      </span>

      {MARCOS.map((marco) => {
        const alcancado = progresso >= marco;
        return (
          <div key={marco} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${marco * 100}%` }}>
            <span
              className={`grid size-6 place-items-center rounded-full border-2 text-[0.7rem] ${
                alcancado ? "border-rosa bg-rosa text-white" : "border-white/20 bg-superficie text-suave"
              }`}
            >
              <TextoComIcones texto={marco === 1 ? "🏆" : alcancado ? "✓" : ""} />
            </span>
            <span className="absolute left-1/2 top-7 -translate-x-1/2 text-[0.65rem] text-suave">{marco * 100}%</span>
          </div>
        );
      })}
    </div>
  );
}
