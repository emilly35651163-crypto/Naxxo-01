// Os temas do app. Cada cor tem 4 versões: escuro sóbrio, escuro temático, claro sóbrio, claro temático.
// Sóbrio = só as cores. Temático = as cores + um desenho parado no fundo (sem animação, para ficar leve).
// As cores de cada tema ficam no globals.css (procure por data-paleta); aqui fica o que a tela de escolha mostra.

export type IdTema = "escuro" | "claro" | "azul-escuro" | "mar-profundo" | "azul-claro" | "bolhas";
export type EscolhaTema = IdTema | "auto";

export type Tema = {
  id: IdTema;
  nome: string;
  cor: string; // grupo na tela de escolha
  base: "escuro" | "claro"; // letras claras em fundo escuro, ou o contrário
  estilo: "sobrio" | "tematico";
  descricao: string;
  // A bolinha da tela de escolha (um fundo CSS)
  bolinha: string;
};

export const TEMAS: Tema[] = [
  {
    id: "escuro",
    nome: "NAXXO escuro",
    cor: "NAXXO",
    base: "escuro",
    estilo: "sobrio",
    descricao: "O original",
    bolinha: "radial-gradient(circle at 32% 30%, #2b3150, #0b0f1a 72%)",
  },
  {
    id: "claro",
    nome: "NAXXO claro",
    cor: "NAXXO",
    base: "claro",
    estilo: "sobrio",
    descricao: "O original, de dia",
    bolinha: "linear-gradient(135deg, #fde3f6, #ece2ff 60%, #e3ecff)",
  },
  {
    id: "azul-escuro",
    nome: "Azul escuro",
    cor: "Azul",
    base: "escuro",
    estilo: "sobrio",
    descricao: "Azul-marinho e preto",
    bolinha: "radial-gradient(circle at 32% 30%, #1e40af, #050b18 75%)",
  },
  {
    id: "mar-profundo",
    nome: "Mar profundo",
    cor: "Azul",
    base: "escuro",
    estilo: "tematico",
    descricao: "Águas-vivas, peixes e corais",
    bolinha:
      "linear-gradient(110deg, transparent 32%, rgb(186 244 255 / 0.6) 44%, transparent 58%), linear-gradient(180deg, #0e6a8f, #031628)",
  },
  {
    id: "azul-claro",
    nome: "Azul claro",
    cor: "Azul",
    base: "claro",
    estilo: "sobrio",
    descricao: "Azul-céu e branco",
    bolinha: "radial-gradient(circle at 32% 30%, #ffffff, #b9dcff 80%)",
  },
  {
    id: "bolhas",
    nome: "Bolhas",
    cor: "Azul",
    base: "claro",
    estilo: "tematico",
    descricao: "Bolhas de sabão e água clara",
    bolinha:
      "radial-gradient(circle at 36% 34%, rgb(255 255 255 / 0.95) 0 2px, transparent 3px), radial-gradient(circle at 40% 40%, transparent 8px, #93c5fd 9px, #f9a8d4 10.5px, transparent 12px), radial-gradient(circle at 72% 70%, transparent 4px, #67e8f9 5px, transparent 6.5px), linear-gradient(160deg, #d8eeff, #f5fbff)",
  },
];

/** Os grupos da tela de escolha, na ordem */
export const GRUPOS_TEMA: { cor: string; nome: string }[] = [
  { cor: "NAXXO", nome: "Oficial NAXXO" },
  { cor: "Azul", nome: "Azul" },
];

/** A bolinha do "Automático": metade escuro, metade claro */
export const BOLINHA_AUTO = "linear-gradient(135deg, #0b0f1a 50%, #f6f0fb 50%)";

export function temaPorId(id: string | undefined) {
  return TEMAS.find((t) => t.id === id);
}
