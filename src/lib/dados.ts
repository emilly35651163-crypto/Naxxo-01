"use client";

// Junta todos os dados que as contas de previsão precisam, num gancho só.

import {
  useCartoes,
  useCompraPlanejada,
  useCompras,
  useFontes,
  useGastosFixos,
  useItensMercado,
  useLancamentos,
  useListaCompras,
  useMetas,
  usePagamentosFatura,
} from "./store";
import type { Dados } from "./previstos";

export function useDados(): Dados {
  return {
    lancamentos: useLancamentos(),
    fontes: useFontes(),
    fixos: useGastosFixos(),
    cartoes: useCartoes(),
    compras: useCompras(),
    pagamentos: usePagamentosFatura(),
    metas: useMetas(),
    itensMercado: useItensMercado(),
    listaCompras: useListaCompras(),
    compraPlanejada: useCompraPlanejada().data,
  };
}
