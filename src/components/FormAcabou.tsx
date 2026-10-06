"use client";

import { useState } from "react";
import { marcarItemAcabou, type ItemMercado } from "@/lib/store";
import { diasEntre, formatarData, hojeISO } from "@/lib/formato";
import { descreverDuracao, melhorUnidade } from "@/lib/mercado";
import Modal from "./Modal";
import { Campo } from "./Campos";

// "Acabou": diz quando o item acabou, o app calcula quanto durou e usa isso daqui para frente.
export default function FormAcabou({ item, onFechar }: { item: ItemMercado; onFechar: () => void }) {
  const [data, setData] = useState(hojeISO());
  const dias = diasEntre(item.ultimaCompra, data);
  const nova = dias >= 1 ? melhorUnidade(dias) : null;

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nova) return;
    marcarItemAcabou(item.id, data);
    onFechar();
  }

  return (
    <Modal titulo={`${item.icone} ${item.nome} acabou`} onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <Campo rotulo="Quando acabou?">
          <input
            type="date"
            value={data}
            min={item.ultimaCompra}
            max={hojeISO()}
            onChange={(e) => setData(e.target.value)}
            className="campo"
          />
        </Campo>

        {nova ? (
          <div className="rounded-2xl bg-roxo/10 p-4 text-sm">
            <p>
              Comprado em {formatarData(item.ultimaCompra)}, acabou em {formatarData(data)}:
            </p>
            <p className="mt-1 font-display text-2xl font-bold">
              durou <span className="gradiente-texto">{descreverDuracao(nova.duracao, nova.unidade)}</span>
            </p>
            <p className="mt-2 text-xs text-suave">
              Daqui para frente, o app conta que {item.nome.toLowerCase()} dura {descreverDuracao(nova.duracao, nova.unidade)}
              {item.repor ? " e coloca a próxima compra na previsão. Ele também entra na lista de compras." : "."}
            </p>
          </div>
        ) : (
          <p className="text-sm text-suave">Escolha uma data depois do dia da compra ({formatarData(item.ultimaCompra)}).</p>
        )}

        <button
          type="submit"
          disabled={!nova}
          className="botao-gradiente w-full rounded-full py-3 font-semibold disabled:opacity-40"
        >
          Confirmar
        </button>
      </form>
    </Modal>
  );
}
