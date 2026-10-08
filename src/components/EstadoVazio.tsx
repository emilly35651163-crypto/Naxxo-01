import Icone from "@/components/Icone";
import { TextoComIcones } from "@/components/Icone";
export default function EstadoVazio({ icone, titulo, texto }: { icone: string; titulo: string; texto: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-3 text-4xl opacity-80">
        <Icone e={icone} />
      </span>
      <p className="font-display text-lg font-semibold">
        <TextoComIcones texto={titulo} />
      </p>
      <p className="mt-1 text-sm text-suave">
        <TextoComIcones texto={texto} />
      </p>
    </div>
  );
}
