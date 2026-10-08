// Gera src/lib/temas.ts e o bloco de temas do globals.css (todas as cores, 4 versões cada).
const fs = require("fs");
const path = require("path");
const P = path.resolve(__dirname, "../..") + "/";
const cenas = require("./cenas.js");
const enc = (s) =>
  "data:image/svg+xml," + s.replace(/\s+/g, " ").replace(/%/g, "%25").replace(/#/g, "%23").replace(/</g, "%3C").replace(/>/g, "%3E").replace(/"/g, "'");

// As cenas do azul (já aprovadas) vêm do CSS atual
const cssAtual = fs.readFileSync(P + "src/app/globals.css", "utf8");
const cenaDoCss = (id) => {
  const bloco = cssAtual.slice(cssAtual.indexOf(`:root[data-paleta="${id}"]`));
  const m = bloco.match(/--fundo-desenho: url\("(data:[^"]+)"\)/) || cssAtual.match(new RegExp(`--cena-${id}: url\\("(data:[^"]+)"\\)`));
  if (!m) throw new Error("cena " + id);
  return m[1];
};

// [id, nome, cor, base, estilo, descricao, vars, extra(cena/topo)]
const T = [];
const tema = (o) => T.push(o);
const sobrio = (id, nome, cor, base, descricao, v) => tema({ id, nome, cor, base, estilo: "sobrio", descricao, v });
const tematico = (id, nome, cor, base, descricao, v, cena, topo, borda) => tema({ id, nome, cor, base, estilo: "tematico", descricao, v, cena, topo, borda });
const V = (fundo, sup, sup2, suave, texto, rosa, roxo, azul, botao, brilhoBotao, b1 = "transparent", b2 = "transparent") => ({ fundo, sup, sup2, suave, texto, rosa, roxo, azul, botao, brilhoBotao, b1, b2 });

// ---------- Vermelho ----------
sobrio("vermelho-escuro", "Vermelho escuro", "Vermelho", "escuro", "Vermelho fechado e preto",
  V("#120506", "#1f0a0c", "#2c1013", "#c49a9d", "#fff1f1", "#ff4d5e", "#e11d48", "#fb7185", "linear-gradient(135deg, #b91c1c, #7f1d1d)", "rgb(255 77 94 / 0.3)", "rgb(225 29 72 / 0.18)", "rgb(255 77 94 / 0.08)"));
tematico("fogo", "Fogo", "Vermelho", "escuro", "Lava, brasas e rocha",
  V("#0a0202", "#1d0906", "#2a0e08", "#d6a58f", "#fff3ea", "#ff7a2f", "#ff4d1a", "#ffb347", "linear-gradient(135deg, #ff6a2b, #d62a12 60%, #8b1508)", "rgb(255 106 43 / 0.35)"),
  cenas.fogo(), "linear-gradient(180deg, rgb(255 106 43 / 0.3), rgb(29 9 6 / 0.88)), radial-gradient(20rem 5rem at 70% 100%, rgb(255 179 71 / 0.35), transparent 70%)", "rgb(255 122 47 / 0.35)");
sobrio("vermelho-claro", "Vermelho claro", "Vermelho", "claro", "Vermelho claro e branco",
  V("#fde2e4", "#fff5f5", "#fbd0d4", "#7a4a50", "#3b0d12", "#c8102e", "#9f1239", "#e11d48", "linear-gradient(135deg, #e11d48, #b91c1c)", "rgb(225 29 72 / 0.28)", "rgb(244 63 94 / 0.18)", "rgb(225 29 72 / 0.1)"));
tematico("cereja", "Cereja", "Vermelho", "claro", "Cerejas e calda vermelha",
  V("#ffe7ea", "#ffffff", "#ffe1e5", "#7a3b45", "#3b0a12", "#c8102e", "#9e0016", "#d61a35", "linear-gradient(135deg, #d61a35, #9e0016)", "rgb(214 26 53 / 0.3)"),
  cenas.cereja(), "radial-gradient(circle at 93% 58%, #c8102e 0 7px, transparent 8px), radial-gradient(circle at 87% 66%, #c8102e 0 7px, transparent 8px), linear-gradient(180deg, rgb(255 255 255 / 0.92), rgb(255 228 232 / 0.88))", "rgb(200 16 46 / 0.25)");

// ---------- Laranja ----------
sobrio("laranja-escuro", "Laranja escuro", "Laranja", "escuro", "Laranja queimado e café",
  V("#140b05", "#22140a", "#2f1c0e", "#c9a88a", "#fff5ec", "#ff8a3d", "#ea580c", "#fbbf24", "linear-gradient(135deg, #ea580c, #9a3412)", "rgb(255 138 61 / 0.3)", "rgb(234 88 12 / 0.18)", "rgb(251 191 36 / 0.08)"));
tematico("outono", "Outono", "Laranja", "escuro", "Folhas secas e luz quente",
  V("#140905", "#24130a", "#331b0e", "#d6b08e", "#fff3e6", "#ff9a3c", "#e0611c", "#f6c445", "linear-gradient(135deg, #e0611c, #9b2611)", "rgb(255 154 60 / 0.3)"),
  cenas.outono(), "linear-gradient(180deg, rgb(255 154 60 / 0.28), rgb(36 19 10 / 0.88))", "rgb(255 154 60 / 0.3)");
sobrio("laranja-claro", "Laranja claro", "Laranja", "claro", "Pêssego e creme",
  V("#ffe6cf", "#fff7ef", "#fdd9b8", "#7a5236", "#3a1c06", "#c2410c", "#9a3412", "#ea580c", "linear-gradient(135deg, #f97316, #c2410c)", "rgb(249 115 22 / 0.3)", "rgb(251 146 60 / 0.2)", "rgb(249 115 22 / 0.1)"));
tematico("borboletas", "Borboletas", "Laranja", "claro", "Borboletas-monarca",
  V("#ffe9d2", "#ffffff", "#ffe8d2", "#7a5236", "#3a1c06", "#c2410c", "#9a3412", "#ea580c", "linear-gradient(135deg, #f07c12, #c95a00)", "rgb(240 124 18 / 0.3)"),
  cenas.borboletas(), "linear-gradient(180deg, rgb(255 255 255 / 0.92), rgb(255 233 210 / 0.88))", "rgb(240 124 18 / 0.3)");

// ---------- Amarelo ----------
sobrio("amarelo-escuro", "Amarelo escuro", "Amarelo", "escuro", "Mostarda e preto",
  V("#131003", "#201b07", "#2c250b", "#cdbf8c", "#fffbe8", "#facc15", "#eab308", "#fde047", "linear-gradient(135deg, #a16207, #713f12)", "rgb(250 204 21 / 0.25)", "rgb(250 204 21 / 0.14)", "rgb(234 179 8 / 0.06)"));
tematico("abelha", "Abelha", "Amarelo", "escuro", "Favo de mel e mel escorrendo",
  V("#0e0902", "#21170a", "#2e200c", "#d6bf8a", "#fff8e1", "#ffc531", "#f2a90f", "#ffd75e", "linear-gradient(135deg, #d48806, #8a5a00)", "rgb(255 197 49 / 0.3)"),
  cenas.abelha(), "linear-gradient(180deg, rgb(242 169 15 / 0.38), rgb(33 23 10 / 0.88))", "rgb(255 197 49 / 0.35)");
sobrio("amarelo-claro", "Amarelo claro", "Amarelo", "claro", "Amarelo-manteiga e branco",
  V("#fff2b8", "#fffbea", "#ffe98a", "#6b5a1f", "#2e2606", "#a16207", "#854d0e", "#ca8a04", "linear-gradient(135deg, #ca8a04, #a16207)", "rgb(202 138 4 / 0.3)", "rgb(250 204 21 / 0.25)", "rgb(234 179 8 / 0.12)"));
tematico("girassol", "Girassol", "Amarelo", "claro", "Girassóis e sol",
  V("#fff4c2", "#ffffff", "#fff1b3", "#6b5a1f", "#2e2606", "#a16207", "#854d0e", "#b45309", "linear-gradient(135deg, #eab308, #a16207)", "rgb(234 179 8 / 0.3)"),
  cenas.girassol(), "linear-gradient(180deg, rgb(255 255 255 / 0.92), rgb(255 241 166 / 0.88))", "rgb(234 179 8 / 0.35)");

// ---------- Verde ----------
sobrio("verde-escuro", "Verde escuro", "Verde", "escuro", "Verde-garrafa e preto",
  V("#04120b", "#0a1f15", "#102c1e", "#93b8a3", "#ecfdf3", "#34d399", "#10b981", "#6ee7b7", "linear-gradient(135deg, #047857, #065f46)", "rgb(52 211 153 / 0.28)", "rgb(16 185 129 / 0.15)", "rgb(52 211 153 / 0.07)"));
tematico("floresta", "Floresta", "Verde", "escuro", "Pinheiros e névoa",
  V("#04100a", "#0b2018", "#112d21", "#9cc4aa", "#eefcf2", "#7ddc8f", "#3fae6a", "#c4f08a", "linear-gradient(135deg, #2f855a, #1c4a33)", "rgb(125 220 143 / 0.28)"),
  cenas.floresta(), "linear-gradient(180deg, rgb(47 107 74 / 0.45), rgb(11 32 24 / 0.88))", "rgb(125 220 143 / 0.25)");
sobrio("verde-claro", "Verde claro", "Verde", "claro", "Verde-menta e branco",
  V("#d6f2df", "#f1fbf4", "#c2e9cf", "#3f6650", "#0c2a18", "#047857", "#065f46", "#059669", "linear-gradient(135deg, #059669, #047857)", "rgb(5 150 105 / 0.28)", "rgb(52 211 153 / 0.2)", "rgb(16 185 129 / 0.1)"));
tematico("natureza", "Natureza", "Verde", "claro", "Colinas e folhas",
  V("#dff5e3", "#ffffff", "#e1f4e4", "#3f6650", "#0c2a18", "#2f7d1f", "#1f5f14", "#4e9a2f", "linear-gradient(135deg, #4e9a2f, #2f7d1f)", "rgb(78 154 47 / 0.3)"),
  cenas.natureza(), "linear-gradient(180deg, rgb(255 255 255 / 0.92), rgb(214 240 205 / 0.88))", "rgb(78 154 47 / 0.3)");

// ---------- Azul (cenas já aprovadas) ----------
sobrio("azul-escuro", "Azul escuro", "Azul", "escuro", "Azul-marinho e preto",
  V("#050b18", "#0c1628", "#13223c", "#8ea3c2", "#eaf2ff", "#38bdf8", "#3b82f6", "#60a5fa", "linear-gradient(135deg, #0369a1, #1d4ed8 60%, #1e40af)", "rgb(56 189 248 / 0.25)", "rgb(59 130 246 / 0.16)", "rgb(56 189 248 / 0.08)"));
tematico("mar-profundo", "Mar profundo", "Azul", "escuro", "Águas-vivas e peixes de luz",
  V("#031628", "#062236", "#0b2f48", "#8cc3d4", "#e6fbff", "#22d3ee", "#0ea5e9", "#2dd4bf", "linear-gradient(135deg, #0e7490, #0369a1 60%, #155e75)", "rgb(34 211 238 / 0.3)"),
  cenas.marProfundo(), "linear-gradient(180deg, rgb(61 139 255 / 0.25), rgb(2 10 28 / 0.9)), radial-gradient(16rem 5rem at 40% 100%, rgb(127 196 255 / 0.25), transparent 70%)", "rgb(127 196 255 / 0.25)");
tematico("eletrico", "Elétrico", "Azul", "claro", "Raios num céu azul vivo",
  V("#5d9bff", "#ffffff", "#e3efff", "#173a7a", "#0b1f4a", "#1d4ed8", "#0b3fb8", "#2563eb", "linear-gradient(135deg, #2563eb, #1d4ed8 60%, #1e3a8a)", "rgb(37 99 235 / 0.35)"),
  cenas.eletrico(), "radial-gradient(18rem 5rem at 55% 0%, rgb(233 246 255 / 0.9), transparent 70%), linear-gradient(180deg, rgb(255 255 255 / 0.85), rgb(147 197 253 / 0.85))", "rgb(37 99 235 / 0.5)");
tematico("tecnologia", "Tecnologia", "Azul", "escuro", "Circuitos azuis brilhando",
  V("#03112e", "#071c44", "#0b2a5e", "#9cc0e8", "#eaf6ff", "#5fd4ff", "#3fa9ff", "#8fe8ff", "linear-gradient(135deg, #0ea5e9, #1d4ed8 60%, #1e3a8a)", "rgb(95 212 255 / 0.35)"),
  cenas.tecnologia(), "repeating-linear-gradient(90deg, transparent 0 46px, rgb(63 169 255 / 0.25) 46px 47px), linear-gradient(180deg, rgb(63 169 255 / 0.3), rgb(3 17 46 / 0.9))", "rgb(95 212 255 / 0.4)");
// Azul claro mais azul (antes parecia só branco)
sobrio("azul-claro", "Azul claro", "Azul", "claro", "Azul-céu",
  V("#cfe4f8", "#eef6ff", "#bcd6f1", "#3f5878", "#0d1d33", "#0369a1", "#1d4ed8", "#0284c7", "linear-gradient(135deg, #0284c7, #1d4ed8)", "rgb(2 132 199 / 0.3)", "rgb(56 189 248 / 0.25)", "rgb(59 130 246 / 0.14)"));
tematico("bolhas", "Bolhas", "Azul", "claro", "Bolhas de sabão",
  V("#7fb4f8", "#ffffff", "#e3f0ff", "#1f4a80", "#0b2440", "#1d4ed8", "#0369a1", "#0284c7", "linear-gradient(135deg, #3b9dff, #1d6fe0 60%, #1d4ed8)", "rgb(59 157 255 / 0.35)"),
  cenas.bolhas(),
  "radial-gradient(circle at 88% 30%, rgb(255 255 255 / 0.9) 0 3px, transparent 4px), radial-gradient(circle at 88% 45%, transparent 13px, rgb(147 197 253 / 0.7) 14px, rgb(249 168 212 / 0.5) 15.5px, transparent 17px), radial-gradient(circle at 76% 70%, transparent 6px, rgb(103 232 249 / 0.7) 7px, transparent 8.5px), linear-gradient(180deg, rgb(255 255 255 / 0.85), rgb(219 239 255 / 0.75))",
  "rgb(56 189 248 / 0.3)");

// Ordem na tela: Elétrico por último entre os azuis (o desenho é gerado acima, na mesma ordem de sempre)
T.splice(T.findIndex((x) => x.id === "bolhas") + 1, 0, ...T.splice(T.findIndex((x) => x.id === "eletrico"), 1));

// ---------- Roxo ----------
sobrio("roxo-escuro", "Roxo escuro", "Roxo", "escuro", "Berinjela e preto",
  V("#0c0618", "#170d2a", "#21143a", "#a99bc9", "#f3eeff", "#a78bfa", "#8b5cf6", "#c4b5fd", "linear-gradient(135deg, #7c3aed, #4c1d95)", "rgb(167 139 250 / 0.3)", "rgb(139 92 246 / 0.2)", "rgb(167 139 250 / 0.08)"));
tematico("universo", "Universo", "Roxo", "escuro", "Nebulosa, estrelas e planeta",
  V("#05030f", "#120a26", "#1b1036", "#b4a6d8", "#f5f0ff", "#c084fc", "#8b5cf6", "#60a5fa", "linear-gradient(135deg, #9333ea, #4f46e5)", "rgb(192 132 252 / 0.3)"),
  cenas.universo(), "radial-gradient(circle at 18% 30%, #fff 0 1px, transparent 2px), radial-gradient(circle at 58% 22%, #fff 0 1px, transparent 2px), radial-gradient(circle at 84% 62%, #fff 0 1.5px, transparent 2.5px), linear-gradient(180deg, rgb(124 58 237 / 0.4), rgb(18 10 38 / 0.88))", "rgb(192 132 252 / 0.3)");
sobrio("roxo-claro", "Roxo claro", "Roxo", "claro", "Lilás e branco",
  V("#e9e0fb", "#f8f5ff", "#ddd0f7", "#5b4d80", "#1e1238", "#6d28d9", "#5b21b6", "#7c3aed", "linear-gradient(135deg, #7c3aed, #5b21b6)", "rgb(124 58 237 / 0.3)", "rgb(167 139 250 / 0.22)", "rgb(139 92 246 / 0.1)"));
tematico("gatinho", "Gatinho", "Roxo", "claro", "Gatinho branco dormindo no lilás",
  V("#c9b6ec", "#faf7ff", "#e9e0fb", "#5b4d80", "#1e1238", "#6d28d9", "#5b21b6", "#8b5cf6", "linear-gradient(135deg, #a78bfa, #7c3aed)", "rgb(139 92 246 / 0.3)"),
  cenas.gatinho(), "linear-gradient(180deg, rgb(250 247 255 / 0.92), rgb(214 198 241 / 0.88))", "rgb(124 91 214 / 0.3)");

// ---------- Rosa ----------
sobrio("rosa-escuro", "Rosa escuro", "Rosa", "escuro", "Magenta e preto",
  V("#160610", "#240b1b", "#321026", "#c99cb8", "#fff0f8", "#ff4ed8", "#db2777", "#f472b6", "linear-gradient(135deg, #db2777, #9d174d)", "rgb(255 78 216 / 0.3)", "rgb(255 78 216 / 0.18)", "rgb(219 39 119 / 0.08)"));
tematico("glitter", "Glitter", "Rosa", "escuro", "Brilhos rosa e dourado",
  V("#12030e", "#2a0a22", "#380e2d", "#e0a8cd", "#fff0fa", "#ff7ad9", "#ff4ed8", "#ffd36e", "linear-gradient(135deg, #ff4ed8, #be185d 60%, #b45309)", "rgb(255 122 217 / 0.35)"),
  cenas.glitter(), "radial-gradient(circle at 20% 35%, #ffe08a 0 1.5px, transparent 2.5px), radial-gradient(circle at 63% 25%, #ffd6f5 0 1.5px, transparent 2.5px), radial-gradient(circle at 86% 65%, #ffe08a 0 2px, transparent 3px), linear-gradient(180deg, rgb(255 78 216 / 0.32), rgb(42 10 34 / 0.88))", "rgb(255 122 217 / 0.35)");
sobrio("rosa-claro", "Rosa claro", "Rosa", "claro", "Rosa-bebê e branco",
  V("#fde0f0", "#fff5fb", "#fbcfe6", "#7a4563", "#3a0d26", "#be185d", "#9d174d", "#db2777", "linear-gradient(135deg, #db2777, #be185d)", "rgb(219 39 119 / 0.3)", "rgb(244 114 182 / 0.22)", "rgb(219 39 119 / 0.1)"));
tematico("barbiecore", "Barbiecore", "Rosa", "claro", "Neon rosa, cartões e cetim",
  V("#f4b0c9", "#fff5f9", "#fbd3e2", "#7a3a58", "#3a0d26", "#d6336c", "#be185d", "#ec4899", "linear-gradient(135deg, #f06aa4, #d6336c)", "rgb(240 106 164 / 0.35)"),
  cenas.barbiecore(), "radial-gradient(circle at 90% 50%, rgb(255 227 240 / 0.95) 0 2px, transparent 3px), linear-gradient(180deg, rgb(255 240 246 / 0.92), rgb(247 184 207 / 0.88))", "rgb(240 106 164 / 0.35)");

// ---------- Neutros (escuro, médio e claro): sóbrios, com degradê para dar profundidade ----------
tema({ id: "neutro-escuro", nome: "Escuro", cor: "Neutros", base: "escuro", estilo: "sobrio", descricao: "Preto com degradê",
  v: V("#0b0b0c", "#18181a", "#232326", "#a1a1aa", "#fafafa", "#e4e4e7", "#a1a1aa", "#d4d4d8", "linear-gradient(135deg, #52525b, #18181b)", "rgb(255 255 255 / 0.12)"),
  degrade: "radial-gradient(60rem 40rem at 80% -10%, rgb(255 255 255 / 0.09), transparent 60%), linear-gradient(180deg, #1c1c1f 0%, #0b0b0c 55%, #050506 100%)", topoCor: "#1c1c1f" });
tema({ id: "neutro-medio", nome: "Médio", cor: "Neutros", base: "escuro", estilo: "sobrio", descricao: "Cinza com degradê",
  v: V("#34373d", "#3f434a", "#4a4f57", "#c3c8d0", "#f6f7f9", "#f1f3f6", "#c3c8d0", "#e2e5ea", "linear-gradient(135deg, #6b7280, #374151)", "rgb(255 255 255 / 0.15)"),
  degrade: "radial-gradient(60rem 40rem at 20% -10%, rgb(255 255 255 / 0.14), transparent 60%), linear-gradient(180deg, #4a4e56 0%, #34373d 50%, #24262b 100%)", topoCor: "#50545c" });
tema({ id: "neutro-claro", nome: "Claro", cor: "Neutros", base: "claro", estilo: "sobrio", descricao: "Branco com degradê",
  v: V("#f4f4f5", "#ffffff", "#e4e4e7", "#52525b", "#18181b", "#27272a", "#3f3f46", "#52525b", "linear-gradient(135deg, #3f3f46, #18181b)", "rgb(24 24 27 / 0.2)"),
  degrade: "radial-gradient(60rem 40rem at 80% -10%, rgb(255 255 255 / 1), transparent 60%), linear-gradient(180deg, #ffffff 0%, #ececee 55%, #d9d9dd 100%)", topoCor: "#ffffff" });

// ---------- CSS ----------
const pasta = P + "public/temas/";
fs.mkdirSync(pasta, { recursive: true });
for (const velho of fs.readdirSync(pasta)) fs.unlinkSync(pasta + velho);
const cenaUri = {};
for (const t of T)
  if (t.estilo === "tematico") {
    const conteudo = t.cena.replace(/\s+/g, " ");
    fs.writeFileSync(pasta + t.id + ".svg", conteudo);
    const versao = require("crypto").createHash("md5").update(conteudo).digest("hex").slice(0, 8);
    cenaUri[t.id] = "/temas/" + t.id + ".svg?v=" + versao;
  }

let css = `/* ================= Temas por cor (Configurações → Temas) =================
 * data-tema = base (escuro/claro: letras claras ou escuras); data-paleta = a cor e o estilo.
 * "rosa" é a cor de destaque principal do app (botões, links, ícones); "roxo" e "azul" acompanham.
 * Sóbrio = só as cores. Temático = as cores + uma cena parada no fundo e na barra de cima.
 * Gerado pelo gerador de temas: as cenas ficam em --cena-<id> (usadas também nas bolinhas da escolha).
 */
:root {
${Object.entries(cenaUri).map(([id, u]) => `  --cena-${id}: url("${u}");`).join("\n")}
}
`;
// Tela larga (computador): o fundo cobre pela largura e corta embaixo; aqui mostra a parte onde está o desenho principal
const NO_COMPUTADOR = { gatinho: "center 66%" };
for (const t of T) {
  const v = t.v;
  css += `
/* ${t.nome} (${t.base === "escuro" ? "escuro" : "claro"} ${t.estilo === "tematico" ? "temático" : "sóbrio"}): ${t.descricao} */
:root[data-paleta="${t.id}"] {
${t.base === "claro" ? `  --color-white: ${v.texto};\n` : ""}  --color-texto: ${v.texto};
  --color-fundo: ${v.fundo};
  --color-superficie: ${v.sup};
  --color-superficie-2: ${v.sup2};
  --color-suave: ${v.suave};
  --color-rosa: ${v.rosa};
  --color-roxo: ${v.roxo};
  --color-azul: ${v.azul};
  --botao: ${v.botao};
  --brilho-botao: ${v.brilhoBotao};
  --brilho-1: ${v.b1};
  --brilho-2: ${v.b2};
${t.degrade ? `  --topo: color-mix(in srgb, ${t.topoCor} 92%, transparent);
  --fundo-desenho: ${t.degrade};
  --fundo-tamanho: 100% 100%;
  --fundo-repetir: no-repeat;
` : ""}${t.estilo === "tematico" ? `  --fundo-desenho: var(--cena-${t.id});
  --fundo-tamanho: cover;
  --fundo-posicao: center top;
  --fundo-repetir: no-repeat;
  --topo: ${t.topo};
  --topo-borda: ${t.borda};
` : ""}}
${NO_COMPUTADOR[t.id] ? `@media (min-aspect-ratio: 1/1) {
  :root[data-paleta="${t.id}"] {
    --fundo-posicao: ${NO_COMPUTADOR[t.id]};
  }
}
` : ""}`;
}
const g = P + "src/app/globals.css";
let gcss = fs.readFileSync(g, "utf8");
const i = gcss.indexOf("/* ================= Temas por cor");
gcss = gcss.slice(0, i) + css;
fs.writeFileSync(g, gcss);

// ---------- temas.ts ----------
// Onde fica o desenho principal de cada cena (para a bolinha mostrar ele)
const FOCO = { fogo: "80% 40%", cereja: "30% 18%", outono: "15% 30%", borboletas: "18% 9%", abelha: "20% 14%", girassol: "10% 6%", floresta: "68% 26%", natureza: "50% 80%", "mar-profundo": "48% 35%", eletrico: "50% 20%", tecnologia: "50% 70%", bolhas: "18% 7%", universo: "70% 74%", gatinho: "50% 68%", glitter: "50% 40%", barbiecore: "28% 16%" };
const bolinhaSobria = (t) => t.degrade ? t.degrade.replace(/60rem 40rem/g, "120% 120%") :
  t.base === "escuro" ? `radial-gradient(circle at 32% 30%, ${t.v.roxo}, ${t.v.fundo} 78%)` : `radial-gradient(circle at 32% 30%, #ffffff, ${t.v.sup2} 70%, ${t.v.rosa} 140%)`;
const ts = `// Os temas do app. Cada cor tem 4 versões: escuro sóbrio, escuro temático, claro sóbrio, claro temático.
// Sóbrio = só as cores. Temático = as cores + uma cena parada no fundo e na barra de cima (sem animação).
// As cores e as cenas ficam no globals.css (data-paleta / --cena-<id>), geradas junto com este arquivo.

export type IdTema = ${["escuro", "claro", ...T.map((t) => t.id)].map((x) => `"${x}"`).join(" | ")};
export type EscolhaTema = IdTema | "auto";

export type Tema = {
  id: IdTema;
  nome: string;
  cor: string; // grupo na tela de escolha
  base: "escuro" | "claro"; // letras claras em fundo escuro, ou o contrário
  estilo: "sobrio" | "tematico";
  descricao: string;
  bolinha: string; // a bolinha da tela de escolha (um fundo CSS)
  barra: string; // a cor da barra do celular (lá em cima, onde fica a hora): a mesma do topo do app
};

export const TEMAS: Tema[] = [
  { id: "escuro", nome: "NAXXO escuro", cor: "NAXXO", base: "escuro", estilo: "sobrio", descricao: "O original", bolinha: "radial-gradient(circle at 32% 30%, #2b3150, #0b0f1a 72%)", barra: "#0b0f1a" },
  { id: "claro", nome: "NAXXO claro", cor: "NAXXO", base: "claro", estilo: "sobrio", descricao: "O original, de dia", bolinha: "linear-gradient(135deg, #fde3f6, #ece2ff 60%, #e3ecff)", barra: "#f6f0fb" },
${T.map((t) => `  { id: "${t.id}", nome: ${JSON.stringify(t.nome)}, cor: "${t.cor}", base: "${t.base}", estilo: "${t.estilo}", descricao: ${JSON.stringify(t.descricao)}, bolinha: ${JSON.stringify(t.estilo === "tematico" ? `var(--cena-${t.id}) ${FOCO[t.id] ?? "50% 30%"} / 320% no-repeat` : bolinhaSobria(t))}, barra: "${t.topoCor ?? (t.base === "claro" ? (t.estilo === "tematico" ? t.v.sup2 : t.v.fundo) : t.v.fundo)}" },`).join("\n")}
];

/** Os grupos da tela de escolha, na ordem */
export const GRUPOS_TEMA: { cor: string; nome: string }[] = [
  { cor: "NAXXO", nome: "Oficial NAXXO" },
${[...new Set(T.map((t) => t.cor))].map((c) => `  { cor: "${c}", nome: "${c}" },`).join("\n")}
];

/** A bolinha do "Automático": metade escuro, metade claro */
export const BOLINHA_AUTO = "linear-gradient(135deg, #0b0f1a 50%, #f6f0fb 50%)";

// Temas que mudaram de nome (quem escolheu antes continua com o equivalente)
const ANTIGOS: Record<string, IdTema> = { cinza: "neutro-medio", "cinza-escuro": "neutro-escuro", "cinza-claro": "neutro-claro", escritorio: "neutro-claro", "escritorio-noite": "neutro-escuro" };

export function temaPorId(id: string | undefined) {
  const certo = id && ANTIGOS[id] ? ANTIGOS[id] : id;
  return TEMAS.find((t) => t.id === certo);
}
`;
fs.writeFileSync(P + "src/lib/temas.ts", ts);
console.log(T.length, "temas; css", Math.round(gcss.length / 1024), "KB");
