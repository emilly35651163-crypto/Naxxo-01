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
  // Para a prévia na tela de escolha
  previa: { fundo: string; cartao: string; destaque: string; texto: string };
};

export const TEMAS: Tema[] = [
  {
    id: "escuro",
    nome: "NAXXO escuro",
    cor: "NAXXO",
    base: "escuro",
    estilo: "sobrio",
    descricao: "O original",
    previa: {
      fundo: "#0b0f1a",
      cartao: "#121729",
      destaque: "linear-gradient(135deg,#d4239f,#7c3aed,#2563eb)",
      texto: "#f4f5fb",
    },
  },
  {
    id: "claro",
    nome: "NAXXO claro",
    cor: "NAXXO",
    base: "claro",
    estilo: "sobrio",
    descricao: "O original, de dia",
    previa: {
      fundo: "#f4f3fa",
      cartao: "#ffffff",
      destaque: "linear-gradient(135deg,#b5179e,#6d28d9,#1d4ed8)",
      texto: "#151a2d",
    },
  },
  {
    id: "azul-escuro",
    nome: "Azul escuro",
    cor: "Azul",
    base: "escuro",
    estilo: "sobrio",
    descricao: "Azul-marinho e preto",
    previa: { fundo: "#050b18", cartao: "#0c1628", destaque: "linear-gradient(135deg,#0369a1,#1d4ed8)", texto: "#eaf2ff" },
  },
  {
    id: "mar-profundo",
    nome: "Mar profundo",
    cor: "Azul",
    base: "escuro",
    estilo: "tematico",
    descricao: "Águas-vivas, peixes e corais",
    previa: {
      fundo: "linear-gradient(180deg,#07324a,#030d1a)",
      cartao: "#082033",
      destaque: "linear-gradient(135deg,#0891b2,#0e7490)",
      texto: "#e6fbff",
    },
  },
  {
    id: "azul-claro",
    nome: "Azul claro",
    cor: "Azul",
    base: "claro",
    estilo: "sobrio",
    descricao: "Azul-céu e branco",
    previa: { fundo: "#eef5fd", cartao: "#ffffff", destaque: "linear-gradient(135deg,#0284c7,#1d4ed8)", texto: "#0f1e36" },
  },
  {
    id: "bolhas",
    nome: "Bolhas",
    cor: "Azul",
    base: "claro",
    estilo: "tematico",
    descricao: "Bolhas de sabão e água clara",
    previa: {
      fundo: "linear-gradient(180deg,#d6efff,#f4fbff)",
      cartao: "#ffffff",
      destaque: "linear-gradient(135deg,#0ea5e9,#0284c7)",
      texto: "#0b2440",
    },
  },
];

export function temaPorId(id: string | undefined) {
  return TEMAS.find((t) => t.id === id);
}
