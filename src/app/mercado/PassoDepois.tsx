"use client";

import { useState } from "react";
import { definirDuracaoItem, UNIDADES_DURACAO, useItensMercado, type ItemMercado, type UnidadeDuracao } from "@/lib/store";
import { formatarData, hojeISO, soNumeros } from "@/lib/formato";
import { descreverDuracao, situacaoDoItem } from "@/lib/mercado";
import FormAcabou from "@/components/FormAcabou";

// Passo 3: confirmar quanto cada item dura. Com o tempo, quase tudo fica automático.
export default function PassoDepois() {
  const itens = useItensMercado();
  const [acabouItem, setAcabouItem] = useState<ItemMercado | null>(null);

  // Compras programadas (ainda no futuro) só entram aqui depois do dia da compra
  const jaComprados = itens.filter((i) => i.ultimaCompra <= hojeISO());
  const semDuracao = jaComprados.filter((i) => i.duracao === null);
  const calculados = jaComprados.filter((i) => i.duracao !== null && i.origemDuracao === "calculada");
  const conhecidos = itens.filter((i) => i.duracao !== null && i.origemDuracao !== "calculada");
  const automacao = itens.length ? conhecidos.length / itens.length : 0;

  return (
    <div className="space-y-5">
      {/* Medidor de automação */}
      <div className="rounded-2xl border border-roxo/30 bg-roxo/5 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm">🤖 O app já sabe quanto dura</span>
          <span className="gradiente-texto font-display text-2xl font-bold">{Math.round(automacao * 100)}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-linear-to-r from-rosa via-roxo to-azul"
            style={{ width: `${automacao * 100}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-suave">
          {conhecidos.length} de {itens.length} itens da despensa. Cada item confirmado entra sozinho na previsão de gastos e na
          lista quando estiver acabando. Em alguns meses fica quase tudo automático.
        </p>
      </div>

      {calculados.length > 0 && (
        <section>
          <h3 className="titulo-secao">O app calculou: está certo?</h3>
          <ul className="space-y-2">
            {calculados.map((item) => (
              <LinhaDuracao key={item.id} item={item} calculada onAcabou={() => setAcabouItem(item)} />
            ))}
          </ul>
        </section>
      )}

      {semDuracao.length > 0 && (
        <section>
          <h3 className="titulo-secao">Ainda não sei quanto dura</h3>
          <ul className="space-y-2">
            {semDuracao.map((item) => (
              <LinhaDuracao key={item.id} item={item} onAcabou={() => setAcabouItem(item)} />
            ))}
          </ul>
        </section>
      )}

      {calculados.length === 0 && semDuracao.length === 0 && (
        <p className="rounded-2xl bg-fundo/50 p-4 text-center text-sm text-suave">
          {itens.length
            ? "Tudo confirmado! 🎉 A previsão do mercado está no automático."
            : "Depois da primeira compra, os itens aparecem aqui."}
        </p>
      )}

      {acabouItem && <FormAcabou item={acabouItem} onFechar={() => setAcabouItem(null)} />}
    </div>
  );
}

function LinhaDuracao({ item, calculada, onAcabou }: { item: ItemMercado; calculada?: boolean; onAcabou: () => void }) {
  const [ajustando, setAjustando] = useState(false);
  const [duracao, setDuracao] = useState(item.duracao ? String(item.duracao) : "");
  const [unidade, setUnidade] = useState<UnidadeDuracao>(item.unidade);
  const s = situacaoDoItem(item);

  return (
    <li className="rounded-2xl border border-white/10 bg-fundo/40 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xl">{item.icone}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{item.nome}</span>
          <span className="block text-xs text-suave">
            comprado em {formatarData(item.ultimaCompra)} · há {s.diasDeUso} dias
            {calculada && item.duracao && ` · calculado: ${descreverDuracao(item.duracao, item.unidade)}`}
          </span>
        </span>
        {!ajustando && (
          <div className="flex gap-2">
            {calculada && item.duracao ? (
              <button
                onClick={() => definirDuracaoItem(item.id, item.duracao!, item.unidade)}
                className="rounded-full bg-entrada/15 px-3 py-1.5 text-xs font-medium text-entrada hover:bg-entrada/25"
              >
                ✓ Está certo
              </button>
            ) : (
              <button
                onClick={onAcabou}
                className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-suave hover:border-saida hover:text-saida"
              >
                Acabou
              </button>
            )}
            <button
              onClick={() => setAjustando(true)}
              className="rounded-full border border-rosa/50 px-3 py-1.5 text-xs text-rosa hover:bg-rosa/10"
            >
              {calculada ? "Ajustar" : "Sei quanto dura"}
            </button>
          </div>
        )}
      </div>

      {ajustando && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-suave">Dura</span>
          <input
            autoFocus
            inputMode="numeric"
            value={duracao}
            onChange={(e) => setDuracao(soNumeros(e.target.value, false))}
            className="campo w-16 px-2 py-1.5 text-center"
          />
          <select
            value={unidade}
            onChange={(e) => setUnidade(e.target.value as UnidadeDuracao)}
            className="campo w-auto cursor-pointer px-2 py-1.5"
          >
            {UNIDADES_DURACAO.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              if (Number(duracao) > 0) definirDuracaoItem(item.id, Number(duracao), unidade);
              setAjustando(false);
            }}
            className="botao-gradiente rounded-full px-4 py-1.5 text-sm font-semibold"
          >
            Salvar
          </button>
          <button onClick={() => setAjustando(false)} className="text-sm text-suave">
            cancelar
          </button>
        </div>
      )}
    </li>
  );
}
