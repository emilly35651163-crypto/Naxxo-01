"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// A aba Lançamentos saiu: tudo (entradas, saídas, previsto e o que já aconteceu) fica no Início.
// Esta página só leva quem tinha o endereço antigo salvo para lá.
export default function Lancamentos() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return null;
}
