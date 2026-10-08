// Os temas do app. Cada cor tem 4 versões: escuro sóbrio, escuro temático, claro sóbrio, claro temático.
// Sóbrio = só as cores. Temático = as cores + uma cena parada no fundo e na barra de cima (sem animação).
// As cores e as cenas ficam no globals.css (data-paleta / --cena-<id>), geradas junto com este arquivo.

export type IdTema =
  | "escuro"
  | "claro"
  | "vermelho-escuro"
  | "fogo"
  | "vermelho-claro"
  | "cereja"
  | "laranja-escuro"
  | "outono"
  | "laranja-claro"
  | "borboletas"
  | "amarelo-escuro"
  | "abelha"
  | "amarelo-claro"
  | "girassol"
  | "verde-escuro"
  | "floresta"
  | "verde-claro"
  | "natureza"
  | "azul-escuro"
  | "mar-profundo"
  | "eletrico"
  | "tecnologia"
  | "azul-claro"
  | "bolhas"
  | "roxo-escuro"
  | "universo"
  | "roxo-claro"
  | "gatinho"
  | "rosa-escuro"
  | "glitter"
  | "rosa-claro"
  | "barbiecore"
  | "neutro-escuro"
  | "neutro-medio"
  | "neutro-claro";
export type EscolhaTema = IdTema | "auto";

export type Tema = {
  id: IdTema;
  nome: string;
  cor: string; // grupo na tela de escolha
  base: "escuro" | "claro"; // letras claras em fundo escuro, ou o contrário
  estilo: "sobrio" | "tematico";
  descricao: string;
  bolinha: string; // a bolinha da tela de escolha (um fundo CSS)
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
    id: "vermelho-escuro",
    nome: "Vermelho escuro",
    cor: "Vermelho",
    base: "escuro",
    estilo: "sobrio",
    descricao: "Vermelho fechado e preto",
    bolinha: "radial-gradient(circle at 32% 30%, #e11d48, #120506 78%)",
  },
  {
    id: "fogo",
    nome: "Fogo",
    cor: "Vermelho",
    base: "escuro",
    estilo: "tematico",
    descricao: "Lava, brasas e rocha",
    bolinha: "var(--cena-fogo) 80% 40% / 320% no-repeat",
  },
  {
    id: "vermelho-claro",
    nome: "Vermelho claro",
    cor: "Vermelho",
    base: "claro",
    estilo: "sobrio",
    descricao: "Vermelho claro e branco",
    bolinha: "radial-gradient(circle at 32% 30%, #ffffff, #fbd0d4 70%, #c8102e 140%)",
  },
  {
    id: "cereja",
    nome: "Cereja",
    cor: "Vermelho",
    base: "claro",
    estilo: "tematico",
    descricao: "Cerejas e calda vermelha",
    bolinha: "var(--cena-cereja) 30% 18% / 320% no-repeat",
  },
  {
    id: "laranja-escuro",
    nome: "Laranja escuro",
    cor: "Laranja",
    base: "escuro",
    estilo: "sobrio",
    descricao: "Laranja queimado e café",
    bolinha: "radial-gradient(circle at 32% 30%, #ea580c, #140b05 78%)",
  },
  {
    id: "outono",
    nome: "Outono",
    cor: "Laranja",
    base: "escuro",
    estilo: "tematico",
    descricao: "Folhas secas e luz quente",
    bolinha: "var(--cena-outono) 15% 30% / 320% no-repeat",
  },
  {
    id: "laranja-claro",
    nome: "Laranja claro",
    cor: "Laranja",
    base: "claro",
    estilo: "sobrio",
    descricao: "Pêssego e creme",
    bolinha: "radial-gradient(circle at 32% 30%, #ffffff, #fdd9b8 70%, #c2410c 140%)",
  },
  {
    id: "borboletas",
    nome: "Borboletas",
    cor: "Laranja",
    base: "claro",
    estilo: "tematico",
    descricao: "Borboletas-monarca",
    bolinha: "var(--cena-borboletas) 18% 9% / 320% no-repeat",
  },
  {
    id: "amarelo-escuro",
    nome: "Amarelo escuro",
    cor: "Amarelo",
    base: "escuro",
    estilo: "sobrio",
    descricao: "Mostarda e preto",
    bolinha: "radial-gradient(circle at 32% 30%, #eab308, #131003 78%)",
  },
  {
    id: "abelha",
    nome: "Abelha",
    cor: "Amarelo",
    base: "escuro",
    estilo: "tematico",
    descricao: "Favo de mel e mel escorrendo",
    bolinha: "var(--cena-abelha) 20% 14% / 320% no-repeat",
  },
  {
    id: "amarelo-claro",
    nome: "Amarelo claro",
    cor: "Amarelo",
    base: "claro",
    estilo: "sobrio",
    descricao: "Amarelo-manteiga e branco",
    bolinha: "radial-gradient(circle at 32% 30%, #ffffff, #ffe98a 70%, #a16207 140%)",
  },
  {
    id: "girassol",
    nome: "Girassol",
    cor: "Amarelo",
    base: "claro",
    estilo: "tematico",
    descricao: "Girassóis e sol",
    bolinha: "var(--cena-girassol) 10% 6% / 320% no-repeat",
  },
  {
    id: "verde-escuro",
    nome: "Verde escuro",
    cor: "Verde",
    base: "escuro",
    estilo: "sobrio",
    descricao: "Verde-garrafa e preto",
    bolinha: "radial-gradient(circle at 32% 30%, #10b981, #04120b 78%)",
  },
  {
    id: "floresta",
    nome: "Floresta",
    cor: "Verde",
    base: "escuro",
    estilo: "tematico",
    descricao: "Pinheiros e névoa",
    bolinha: "var(--cena-floresta) 68% 26% / 320% no-repeat",
  },
  {
    id: "verde-claro",
    nome: "Verde claro",
    cor: "Verde",
    base: "claro",
    estilo: "sobrio",
    descricao: "Verde-menta e branco",
    bolinha: "radial-gradient(circle at 32% 30%, #ffffff, #c2e9cf 70%, #047857 140%)",
  },
  {
    id: "natureza",
    nome: "Natureza",
    cor: "Verde",
    base: "claro",
    estilo: "tematico",
    descricao: "Colinas e folhas",
    bolinha: "var(--cena-natureza) 50% 80% / 320% no-repeat",
  },
  {
    id: "azul-escuro",
    nome: "Azul escuro",
    cor: "Azul",
    base: "escuro",
    estilo: "sobrio",
    descricao: "Azul-marinho e preto",
    bolinha: "radial-gradient(circle at 32% 30%, #3b82f6, #050b18 78%)",
  },
  {
    id: "mar-profundo",
    nome: "Mar profundo",
    cor: "Azul",
    base: "escuro",
    estilo: "tematico",
    descricao: "Águas-vivas e peixes de luz",
    bolinha: "var(--cena-mar-profundo) 48% 35% / 320% no-repeat",
  },
  {
    id: "eletrico",
    nome: "Elétrico",
    cor: "Azul",
    base: "claro",
    estilo: "tematico",
    descricao: "Raios num céu azul vivo",
    bolinha: "var(--cena-eletrico) 50% 20% / 320% no-repeat",
  },
  {
    id: "tecnologia",
    nome: "Tecnologia",
    cor: "Azul",
    base: "escuro",
    estilo: "tematico",
    descricao: "Circuitos azuis brilhando",
    bolinha: "var(--cena-tecnologia) 50% 70% / 320% no-repeat",
  },
  {
    id: "azul-claro",
    nome: "Azul claro",
    cor: "Azul",
    base: "claro",
    estilo: "sobrio",
    descricao: "Azul-céu",
    bolinha: "radial-gradient(circle at 32% 30%, #ffffff, #bcd6f1 70%, #0369a1 140%)",
  },
  {
    id: "bolhas",
    nome: "Bolhas",
    cor: "Azul",
    base: "claro",
    estilo: "tematico",
    descricao: "Bolhas de sabão",
    bolinha: "var(--cena-bolhas) 18% 7% / 320% no-repeat",
  },
  {
    id: "roxo-escuro",
    nome: "Roxo escuro",
    cor: "Roxo",
    base: "escuro",
    estilo: "sobrio",
    descricao: "Berinjela e preto",
    bolinha: "radial-gradient(circle at 32% 30%, #8b5cf6, #0c0618 78%)",
  },
  {
    id: "universo",
    nome: "Universo",
    cor: "Roxo",
    base: "escuro",
    estilo: "tematico",
    descricao: "Nebulosa, estrelas e planeta",
    bolinha: "var(--cena-universo) 70% 74% / 320% no-repeat",
  },
  {
    id: "roxo-claro",
    nome: "Roxo claro",
    cor: "Roxo",
    base: "claro",
    estilo: "sobrio",
    descricao: "Lilás e branco",
    bolinha: "radial-gradient(circle at 32% 30%, #ffffff, #ddd0f7 70%, #6d28d9 140%)",
  },
  {
    id: "gatinho",
    nome: "Gatinho",
    cor: "Roxo",
    base: "claro",
    estilo: "tematico",
    descricao: "Gatinho branco dormindo no lilás",
    bolinha: "var(--cena-gatinho) 50% 68% / 320% no-repeat",
  },
  {
    id: "rosa-escuro",
    nome: "Rosa escuro",
    cor: "Rosa",
    base: "escuro",
    estilo: "sobrio",
    descricao: "Magenta e preto",
    bolinha: "radial-gradient(circle at 32% 30%, #db2777, #160610 78%)",
  },
  {
    id: "glitter",
    nome: "Glitter",
    cor: "Rosa",
    base: "escuro",
    estilo: "tematico",
    descricao: "Brilhos rosa e dourado",
    bolinha: "var(--cena-glitter) 50% 40% / 320% no-repeat",
  },
  {
    id: "rosa-claro",
    nome: "Rosa claro",
    cor: "Rosa",
    base: "claro",
    estilo: "sobrio",
    descricao: "Rosa-bebê e branco",
    bolinha: "radial-gradient(circle at 32% 30%, #ffffff, #fbcfe6 70%, #be185d 140%)",
  },
  {
    id: "barbiecore",
    nome: "Barbiecore",
    cor: "Rosa",
    base: "claro",
    estilo: "tematico",
    descricao: "Neon rosa, cartões e cetim",
    bolinha: "var(--cena-barbiecore) 28% 16% / 320% no-repeat",
  },
  {
    id: "neutro-escuro",
    nome: "Escuro",
    cor: "Neutros",
    base: "escuro",
    estilo: "sobrio",
    descricao: "Preto com degradê",
    bolinha:
      "radial-gradient(120% 120% at 80% -10%, rgb(255 255 255 / 0.09), transparent 60%), linear-gradient(180deg, #1c1c1f 0%, #0b0b0c 55%, #050506 100%)",
  },
  {
    id: "neutro-medio",
    nome: "Médio",
    cor: "Neutros",
    base: "escuro",
    estilo: "sobrio",
    descricao: "Cinza com degradê",
    bolinha:
      "radial-gradient(120% 120% at 20% -10%, rgb(255 255 255 / 0.14), transparent 60%), linear-gradient(180deg, #4a4e56 0%, #34373d 50%, #24262b 100%)",
  },
  {
    id: "neutro-claro",
    nome: "Claro",
    cor: "Neutros",
    base: "claro",
    estilo: "sobrio",
    descricao: "Branco com degradê",
    bolinha:
      "radial-gradient(120% 120% at 80% -10%, rgb(255 255 255 / 1), transparent 60%), linear-gradient(180deg, #ffffff 0%, #ececee 55%, #d9d9dd 100%)",
  },
];

/** Os grupos da tela de escolha, na ordem */
export const GRUPOS_TEMA: { cor: string; nome: string }[] = [
  { cor: "NAXXO", nome: "Oficial NAXXO" },
  { cor: "Vermelho", nome: "Vermelho" },
  { cor: "Laranja", nome: "Laranja" },
  { cor: "Amarelo", nome: "Amarelo" },
  { cor: "Verde", nome: "Verde" },
  { cor: "Azul", nome: "Azul" },
  { cor: "Roxo", nome: "Roxo" },
  { cor: "Rosa", nome: "Rosa" },
  { cor: "Neutros", nome: "Neutros" },
];

/** A bolinha do "Automático": metade escuro, metade claro */
export const BOLINHA_AUTO = "linear-gradient(135deg, #0b0f1a 50%, #f6f0fb 50%)";

export function temaPorId(id: string | undefined) {
  return TEMAS.find((t) => t.id === id);
}
