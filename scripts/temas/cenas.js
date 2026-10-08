// As cenas (SVG parado) de cada tema temático + a "bolinha" de cada tema. Usado por gerar-temas.js.
let semente = 11;
const rnd = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
const r = (a, b) => a + rnd() * (b - a);
const f = (n) => Number(n.toFixed(1));

const svg = (defs, corpo, vb = "0 0 1000 2000") =>
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${vb}' preserveAspectRatio='xMidYMin slice'><defs>${defs}</defs>${corpo}</svg>`;
const lin = (id, paradas, x2 = 0, y2 = 1) =>
  `<linearGradient id='${id}' x1='0' y1='0' x2='${x2}' y2='${y2}'>${paradas.map(([o, c, a = 1]) => `<stop offset='${o}' stop-color='${c}' stop-opacity='${a}'/>`).join("")}</linearGradient>`;
const rad = (id, paradas, cx = 0.5, cy = 0.5, rr = 0.5) =>
  `<radialGradient id='${id}' cx='${cx}' cy='${cy}' r='${rr}'>${paradas.map(([o, c, a = 1]) => `<stop offset='${o}' stop-color='${c}' stop-opacity='${a}'/>`).join("")}</radialGradient>`;
const blur = (id, d) => `<filter id='${id}' x='-50%' y='-50%' width='200%' height='200%'><feGaussianBlur stdDeviation='${d}'/></filter>`;
const pontos = (n, cor, rmin, rmax, amin, amax, y0 = 0, y1 = 2000) =>
  Array.from({ length: n }, () => `<circle cx='${f(r(0, 1000))}' cy='${f(r(y0, y1))}' r='${f(r(rmin, rmax))}' fill='${cor}' opacity='${f(r(amin, amax) * 100) / 100}'/>`).join("");

// ---------- Vermelho escuro: fogo / vulcão ----------
function fogo() {
  const rachaduras = Array.from({ length: 7 }, (_, i) => {
    let x = r(0, 1000), y = 1450 + r(0, 500);
    let d = `M${f(x)} ${f(y)}`;
    for (let k = 0; k < 6; k++) { x += r(-90, 90); y += r(-80, 40); d += ` L${f(x)} ${f(y)}`; }
    return `<path d='${d}' stroke='url(#lava)' stroke-width='${f(r(3, 7))}' fill='none' stroke-linecap='round'/>`;
  }).join("");
  const brasas = Array.from({ length: 45 }, () => {
    const c = rnd() > 0.5 ? "#ffb347" : "#ff6a2b";
    return `<circle cx='${f(r(0, 1000))}' cy='${f(r(300, 1950))}' r='${f(r(1.2, 3.6))}' fill='${c}' opacity='${f(r(0.35, 0.9) * 100) / 100}'/>`;
  }).join("");
  return svg(
    lin("rocha", [[0, "#2a0a06"], [0.45, "#170504"], [1, "#0a0202"]]) +
      lin("lava", [[0, "#ffd166"], [0.5, "#ff6a2b"], [1, "#d62a12"]], 1, 1) +
      rad("calor", [[0, "#ff5a1f", 0.55], [1, "#ff5a1f", 0]], 0.5, 1, 0.7) +
      rad("topo", [[0, "#ff7a3d", 0.18], [1, "#ff7a3d", 0]], 0.7, 0, 0.6) +
      blur("b8", 8) + blur("b2", 2),
    `<rect width='1000' height='2000' fill='url(#rocha)'/><rect width='1000' height='2000' fill='url(#calor)'/><rect width='1000' height='900' fill='url(#topo)'/>
     <g filter='url(#b8)' opacity='.9'>${rachaduras}</g><g>${rachaduras}</g><g filter='url(#b2)'>${brasas}</g>`,
  );
}

// ---------- Vermelho claro: cerejas e calda ----------
function cereja() {
  const cacho = (x, y, s) => `
  <g transform='translate(${x} ${y}) scale(${s})'>
    <path d='M0 -120 C 10 -60, -40 -20, -45 30' stroke='#5b7a2a' stroke-width='5' fill='none' stroke-linecap='round'/>
    <path d='M0 -120 C 20 -60, 40 -10, 48 38' stroke='#5b7a2a' stroke-width='5' fill='none' stroke-linecap='round'/>
    <path d='M0 -120 C 40 -150, 90 -140, 110 -110 C 70 -100, 30 -100, 0 -120 Z' fill='url(#folha)'/>
    <circle cx='-45' cy='62' r='38' fill='url(#fruta)'/><circle cx='48' cy='70' r='38' fill='url(#fruta)'/>
    <ellipse cx='-58' cy='48' rx='10' ry='6' fill='#fff' opacity='.7' transform='rotate(-30 -58 48)'/>
    <ellipse cx='35' cy='56' rx='10' ry='6' fill='#fff' opacity='.7' transform='rotate(-30 35 56)'/>
  </g>`;
  const pingos = [80, 230, 360, 540, 700, 860, 960]
    .map((x, i) => {
      const h = r(40, 160);
      return `<path d='M${x - 22} 0 L${x - 22} ${f(h)} Q${x - 22} ${f(h + 34)} ${x} ${f(h + 34)} Q${x + 22} ${f(h + 34)} ${x + 22} ${f(h)} L${x + 22} 0 Z' fill='url(#calda)'/>` +
        (i % 2 ? `<ellipse cx='${x - 8}' cy='${f(h)}' rx='5' ry='12' fill='#fff' opacity='.45'/>` : "");
    })
    .join("");
  return svg(
    lin("fundo", [[0, "#ffe7ea"], [0.5, "#fff3f4"], [1, "#fff8f8"]]) +
      rad("fruta", [[0, "#ff5a6e"], [0.55, "#c8102e"], [1, "#6d0313"]], 0.35, 0.3, 0.75) +
      lin("folha", [[0, "#8cc152"], [1, "#4a7a1f"]], 1, 1) +
      lin("calda", [[0, "#b3001b"], [0.7, "#d61a35"], [1, "#9e0016"]], 1, 0),
    `<rect width='1000' height='2000' fill='url(#fundo)'/><rect width='1000' height='26' fill='url(#calda)'/>${pingos}
     ${cacho(860, 520, 1.1)}${cacho(130, 1050, 0.85)}${cacho(800, 1550, 1)}${cacho(250, 1880, 0.7)}`,
  );
}

// ---------- Laranja escuro: outono ----------
function outono() {
  const folha = (x, y, s, rot, cor) =>
    `<g transform='translate(${f(x)} ${f(y)}) rotate(${f(rot)}) scale(${f(s)})'><path d='M0 -40 L8 -18 L26 -26 L18 -6 L38 2 L16 10 L22 30 L4 20 L0 42 L-4 20 L-22 30 L-16 10 L-38 2 L-18 -6 L-26 -26 L-8 -18 Z' fill='${cor}'/><path d='M0 42 L0 -30 M0 0 L20 -10 M0 0 L-20 -10 M0 14 L16 22 M0 14 L-16 22' stroke='#3a1704' stroke-width='1.5' opacity='.45'/></g>`;
  const cores = ["url(#f1)", "url(#f2)", "url(#f3)"];
  const folhas = Array.from({ length: 22 }, () => folha(r(0, 1000), r(80, 1950), r(0.6, 1.5), r(0, 360), cores[Math.floor(rnd() * 3)])).join("");
  return svg(
    lin("fundo", [[0, "#3b1c0a"], [0.5, "#24110a"], [1, "#140905"]]) +
      rad("luz", [[0, "#ff9a3c", 0.35], [1, "#ff9a3c", 0]], 0.8, 0.05, 0.7) +
      lin("f1", [[0, "#ffb347"], [1, "#e0611c"]], 1, 1) + lin("f2", [[0, "#e94e1b"], [1, "#9b2611"]], 1, 1) + lin("f3", [[0, "#f6c445"], [1, "#c77d14"]], 1, 1) +
      blur("b3", 3) + blur("b10", 10),
    `<rect width='1000' height='2000' fill='url(#fundo)'/><rect width='1000' height='1200' fill='url(#luz)'/>
     <g filter='url(#b10)' opacity='.6'>${pontos(18, "#ffae5c", 10, 30, 0.15, 0.4)}</g><g opacity='.85'>${folhas}</g>`,
  );
}

// ---------- Laranja claro: borboletas (monarca) ----------
function borboletas() {
  const borboleta = (x, y, s, rot) => `
  <g transform='translate(${x} ${y}) rotate(${rot}) scale(${s})'>
    <path d='M0 0 C -30 -70, -110 -90, -120 -40 C -126 -6, -70 10, 0 0 Z' fill='url(#asa)' stroke='#1a1a1a' stroke-width='6'/>
    <path d='M0 0 C 30 -70, 110 -90, 120 -40 C 126 -6, 70 10, 0 0 Z' fill='url(#asa)' stroke='#1a1a1a' stroke-width='6'/>
    <path d='M0 4 C -20 40, -80 70, -82 36 C -84 14, -40 6, 0 4 Z' fill='url(#asa2)' stroke='#1a1a1a' stroke-width='6'/>
    <path d='M0 4 C 20 40, 80 70, 82 36 C 84 14, 40 6, 0 4 Z' fill='url(#asa2)' stroke='#1a1a1a' stroke-width='6'/>
    <path d='M-12 -6 L-95 -48 M-20 -10 L-70 -72 M12 -6 L95 -48 M20 -10 L70 -72 M-8 8 L-62 40 M8 8 L62 40' stroke='#1a1a1a' stroke-width='3.5' fill='none'/>
    ${[[-110, -42], [-98, -64], [-76, -78], [110, -42], [98, -64], [76, -78], [-72, 46], [72, 46]].map(([a, b]) => `<circle cx='${a}' cy='${b}' r='4' fill='#fff'/>`).join("")}
    <ellipse cx='0' cy='4' rx='6' ry='30' fill='#1a1a1a'/><path d='M-2 -24 C -10 -50, -22 -58, -30 -60 M2 -24 C 10 -50, 22 -58, 30 -60' stroke='#1a1a1a' stroke-width='2.5' fill='none'/>
  </g>`;
  return svg(
    lin("fundo", [[0, "#ffe9d2"], [0.5, "#fff3e6"], [1, "#fffaf3"]]) +
      rad("asa", [[0, "#ffb347"], [0.7, "#f07c12"], [1, "#c95a00"]], 0.6, 0.6, 0.7) +
      rad("asa2", [[0, "#ffc46b"], [1, "#e46d0a"]], 0.5, 0.4, 0.8) + blur("b12", 12),
    `<rect width='1000' height='2000' fill='url(#fundo)'/><g filter='url(#b12)' opacity='.5'>${pontos(14, "#ffd29e", 20, 50, 0.3, 0.7)}</g>
     ${borboleta(820, 260, 0.9, 15)}${borboleta(150, 820, 0.65, -20)}${borboleta(760, 1320, 0.75, 8)}${borboleta(260, 1800, 0.55, -10)}`,
  );
}

// ---------- Amarelo escuro: abelha / colmeia ----------
function abelha() {
  const hex = (cx, cy, rr, cheio) => {
    const p = Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 3) * i + Math.PI / 6; return `${f(cx + rr * Math.cos(a))},${f(cy + rr * Math.sin(a))}`; }).join(" ");
    return `<polygon points='${p}' fill='${cheio ? "url(#mel)" : "#2a1a05"}' stroke='#c98b12' stroke-width='5' opacity='${cheio ? 0.95 : 0.6}'/>` +
      (cheio ? `<ellipse cx='${f(cx - rr * 0.3)}' cy='${f(cy - rr * 0.35)}' rx='${f(rr * 0.22)}' ry='${f(rr * 0.12)}' fill='#fff' opacity='.35'/>` : "");
  };
  const favo = [];
  const rr = 46;
  for (let lin2 = 0; lin2 < 9; lin2++)
    for (let col = 0; col < 6; col++) {
      const cx = 620 + col * rr * 1.732 + (lin2 % 2) * rr * 0.866;
      const cy = 980 + lin2 * rr * 1.5;
      if (rnd() > 0.25) favo.push(hex(cx, cy, rr, rnd() > 0.35));
    }
  const gotas = [140, 320, 470, 860].map((x) => { const h = r(70, 220); return `<path d='M${x - 18} 0 L${x - 18} ${f(h)} Q${x - 18} ${f(h + 30)} ${x} ${f(h + 30)} Q${x + 18} ${f(h + 30)} ${x + 18} ${f(h)} L${x + 18} 0 Z' fill='url(#melEscorre)'/>`; }).join("");
  return svg(
    lin("fundo", [[0, "#2b1d07"], [0.5, "#1b1204"], [1, "#0e0902"]]) +
      rad("mel", [[0, "#ffd75e"], [0.6, "#f2a90f"], [1, "#b56d02"]], 0.4, 0.35, 0.7) +
      lin("melEscorre", [[0, "#f2a90f"], [1, "#d48806"]], 1, 0) + rad("brilho", [[0, "#ffbf3c", 0.28], [1, "#ffbf3c", 0]], 0.75, 0.6, 0.6),
    `<rect width='1000' height='2000' fill='url(#fundo)'/><rect width='1000' height='2000' fill='url(#brilho)'/>
     <rect width='1000' height='22' fill='url(#melEscorre)'/>${gotas}<g>${favo.join("")}</g>`,
  );
}

// ---------- Amarelo claro: girassóis ----------
function girassol() {
  const flor = (cx, cy, R) => {
    const petalas = Array.from({ length: 22 }, (_, i) => `<ellipse cx='${cx}' cy='${f(cy - R * 0.72)}' rx='${f(R * 0.16)}' ry='${f(R * 0.42)}' fill='url(#petala)' transform='rotate(${f((360 / 22) * i + r(-3, 3))} ${cx} ${cy})'/>`).join("");
    const sementes = Array.from({ length: 70 }, (_, i) => { const a = i * 2.39996, d = Math.sqrt(i / 70) * R * 0.42; return `<circle cx='${f(cx + d * Math.cos(a))}' cy='${f(cy + d * Math.sin(a))}' r='${f(R * 0.025)}' fill='#2b1606' opacity='.8'/>`; }).join("");
    return `<g>${petalas}<circle cx='${cx}' cy='${cy}' r='${f(R * 0.46)}' fill='url(#miolo)'/>${sementes}</g>`;
  };
  return svg(
    lin("ceu", [[0, "#fff4c2"], [0.5, "#fff9df"], [1, "#fffdf3"]]) +
      lin("petala", [[0, "#ffd21f"], [1, "#f29d0a"]], 0, 1) + rad("miolo", [[0, "#7a4410"], [1, "#3a1f06"]]) +
      rad("sol", [[0, "#fff1a6", 0.9], [1, "#fff1a6", 0]], 0.2, 0.05, 0.5),
    `<rect width='1000' height='2000' fill='url(#ceu)'/><rect width='1000' height='900' fill='url(#sol)'/>
     <path d='M880 2000 C 870 1500, 900 1100, 880 760' stroke='#5f8a2a' stroke-width='14' fill='none'/><path d='M880 1200 C 960 1150, 990 1100, 1000 1060 C 950 1110, 920 1150, 880 1200 Z' fill='#6fa232'/>
     ${flor(880, 640, 210)}${flor(110, 1280, 150)}<path d='M110 2000 C 120 1700, 100 1500, 110 1380' stroke='#5f8a2a' stroke-width='11' fill='none'/>${flor(760, 1820, 120)}`,
  );
}

// ---------- Verde escuro: floresta ----------
function floresta() {
  const pinheiro = (x, base, h, cor) => {
    let d = "";
    for (let i = 0; i < 5; i++) { const y = base - h + (h / 5) * i; const w = (h / 5) * (0.35 + i * 0.18); d += `M${f(x)} ${f(y)} L${f(x + w)} ${f(y + h / 4)} L${f(x - w)} ${f(y + h / 4)} Z `; }
    return `<path d='${d}' fill='${cor}'/><rect x='${f(x - 6)}' y='${f(base)}' width='12' height='60' fill='${cor}'/>`;
  };
  const camada = (n, base, h, cor) => Array.from({ length: n }, (_, i) => pinheiro((1000 / n) * i + r(-30, 30), base + r(-40, 40), h * r(0.8, 1.2), cor)).join("");
  return svg(
    lin("ceu", [[0, "#173b2a"], [0.45, "#0c2318"], [1, "#04100a"]]) + rad("nevoa", [[0, "#9fe0b8", 0.18], [1, "#9fe0b8", 0]], 0.5, 0.45, 0.6) + blur("b6", 6),
    `<rect width='1000' height='2000' fill='url(#ceu)'/>
     <g opacity='.35' filter='url(#b6)'>${camada(9, 900, 360, "#2f6b4a")}</g><rect width='1000' height='2000' fill='url(#nevoa)'/>
     <g opacity='.55'>${camada(8, 1400, 460, "#1c4a33")}</g><g opacity='.85'>${camada(6, 1950, 600, "#0b2a1c")}</g>
     ${pontos(26, "#d4ff8f", 1.5, 3.5, 0.3, 0.8, 600, 1900)}`,
  );
}

// ---------- Verde claro: natureza (colinas e folhas) ----------
function natureza() {
  const ramo = (x, y, s, rot) => `<g transform='translate(${x} ${y}) rotate(${rot}) scale(${s})'><path d='M0 0 C 40 -80, 90 -160, 140 -230' stroke='#4f8a2b' stroke-width='6' fill='none'/>${[0.2, 0.4, 0.6, 0.8].map((t, i) => { const px = 140 * t, py = -230 * t; return `<path d='M${f(px)} ${f(py)} C ${f(px + (i % 2 ? 50 : -50))} ${f(py - 10)}, ${f(px + (i % 2 ? 70 : -70))} ${f(py - 50)}, ${f(px + (i % 2 ? 20 : -20))} ${f(py - 70)} C ${f(px + (i % 2 ? 10 : -10))} ${f(py - 40)}, ${f(px)} ${f(py - 20)}, ${f(px)} ${f(py)} Z' fill='url(#folha)'/>`; }).join("")}</g>`;
  return svg(
    lin("ceu", [[0, "#dff5e3"], [0.5, "#effaf0"], [1, "#f7fdf6"]]) + lin("folha", [[0, "#8fd16a"], [1, "#4e9a2f"]], 1, 1) +
      lin("c1", [[0, "#bfe6a8"], [1, "#a6d98a"]]) + lin("c2", [[0, "#93cf74"], [1, "#78bd5a"]]) + lin("c3", [[0, "#6cb04d"], [1, "#4f9437"]]),
    `<rect width='1000' height='2000' fill='url(#ceu)'/>
     <path d='M0 1500 C 200 1400, 400 1460, 600 1420 C 800 1380, 900 1440, 1000 1400 L1000 2000 L0 2000 Z' fill='url(#c1)'/>
     <path d='M0 1680 C 250 1600, 500 1700, 700 1640 C 850 1600, 950 1650, 1000 1630 L1000 2000 L0 2000 Z' fill='url(#c2)'/>
     <path d='M0 1850 C 300 1780, 600 1880, 1000 1800 L1000 2000 L0 2000 Z' fill='url(#c3)'/>
     ${ramo(960, 520, 1.1, -160)}${ramo(30, 980, 0.9, 20)}`,
  );
}

// ---------- Roxo escuro: universo ----------
function universo() {
  const brilhos = Array.from({ length: 10 }, () => { const x = r(0, 1000), y = r(0, 2000), s = r(6, 14); return `<path d='M${f(x)} ${f(y - s)} L${f(x + s * 0.18)} ${f(y - s * 0.18)} L${f(x + s)} ${f(y)} L${f(x + s * 0.18)} ${f(y + s * 0.18)} L${f(x)} ${f(y + s)} L${f(x - s * 0.18)} ${f(y + s * 0.18)} L${f(x - s)} ${f(y)} L${f(x - s * 0.18)} ${f(y - s * 0.18)} Z' fill='#fff' opacity='${f(r(0.5, 0.95) * 100) / 100}'/>`; }).join("");
  return svg(
    lin("espaco", [[0, "#1b0c3a"], [0.5, "#0d0722"], [1, "#05030f"]]) +
      rad("neb1", [[0, "#b04dff", 0.55], [1, "#b04dff", 0]]) + rad("neb2", [[0, "#ff4ed8", 0.4], [1, "#ff4ed8", 0]]) + rad("neb3", [[0, "#3b82f6", 0.45], [1, "#3b82f6", 0]]) +
      rad("planeta", [[0, "#c9a7ff"], [0.6, "#7c3aed"], [1, "#2a0f5e"]], 0.35, 0.3, 0.75) + blur("b30", 40),
    `<rect width='1000' height='2000' fill='url(#espaco)'/>
     <g filter='url(#b30)'><ellipse cx='750' cy='420' rx='380' ry='240' fill='url(#neb1)'/><ellipse cx='250' cy='1050' rx='420' ry='260' fill='url(#neb2)'/><ellipse cx='700' cy='1600' rx='400' ry='280' fill='url(#neb3)'/></g>
     ${pontos(160, "#ffffff", 0.6, 2, 0.25, 0.9)}${brilhos}
     <circle cx='130' cy='380' r='95' fill='url(#planeta)'/><ellipse cx='130' cy='380' rx='170' ry='34' fill='none' stroke='#e6d6ff' stroke-width='6' opacity='.6' transform='rotate(-18 130 380)'/>`,
  );
}

// ---------- Roxo claro: campo de lavanda ----------
function lavanda() {
  // Cada haste: caule fino e uma espiga de botões (mais cheia no meio), levemente curvada
  const haste = (x, base, h, inclina) => {
    const topo = base - h;
    const botoes = Array.from({ length: 14 }, (_, i) => {
      const t2 = i / 13;
      const y = topo + t2 * h * 0.38;
      const x2 = x + inclina * (1 - t2) * 14;
      const w = 4 + Math.sin(t2 * Math.PI) * 5;
      return `<ellipse cx='${f(x2 + (i % 2 ? w * 0.6 : -w * 0.6))}' cy='${f(y)}' rx='${f(w)}' ry='${f(w * 1.3)}' fill='url(#flor)'/>`;
    }).join("");
    return `<path d='M${f(x)} ${f(base)} Q${f(x + inclina * 6)} ${f(base - h * 0.5)} ${f(x + inclina * 14)} ${f(topo + h * 0.3)}' stroke='#7c9a5f' stroke-width='2.5' fill='none'/>${botoes}`;
  };
  const fileira = (n, base, h, op, filtro) =>
    `<g opacity='${op}'${filtro ? ` filter='url(#${filtro})'` : ""}>${Array.from({ length: n }, (_, i) => haste((1000 / n) * (i + 0.5) + r(-20, 20), base + r(-15, 15), h * r(0.85, 1.15), r(-1, 1))).join("")}</g>`;
  return svg(
    lin("ceu", [[0, "#ece2ff"], [0.55, "#f6f1ff"], [1, "#fbf8ff"]]) + lin("flor", [[0, "#c4a7ff"], [1, "#7c5bd6"]], 0, 1) +
      rad("sol", [[0, "#fff3dc", 0.95], [1, "#fff3dc", 0]], 0.8, 0.08, 0.5) + lin("campo", [[0, "#cdb8f2"], [1, "#a98be0"]]) + blur("b3", 3),
    `<rect width='1000' height='2000' fill='url(#ceu)'/><rect width='1000' height='900' fill='url(#sol)'/>
     <path d='M0 1520 C 300 1460, 700 1500, 1000 1450 L1000 2000 L0 2000 Z' fill='url(#campo)' opacity='.55'/>
     ${fileira(16, 1600, 150, 0.45, "b3")}${fileira(11, 1780, 230, 0.75)}${fileira(7, 2010, 340, 1)}`,
  );
}

// ---------- Rosa escuro: glitter ----------
function glitter() {
  const estrela = (x, y, s, cor) => `<path d='M${f(x)} ${f(y - s)} Q${f(x)} ${f(y)} ${f(x + s)} ${f(y)} Q${f(x)} ${f(y)} ${f(x)} ${f(y + s)} Q${f(x)} ${f(y)} ${f(x - s)} ${f(y)} Q${f(x)} ${f(y)} ${f(x)} ${f(y - s)} Z' fill='${cor}'/>`;
  const estrelas = Array.from({ length: 28 }, () => estrela(r(0, 1000), r(0, 2000), r(5, 16), rnd() > 0.5 ? "#ffd6f5" : "#ffe7a3")).join("");
  return svg(
    lin("fundo", [[0, "#3a0a2e"], [0.5, "#24061d"], [1, "#12030e"]]) + rad("luz", [[0, "#ff4ed8", 0.35], [1, "#ff4ed8", 0]], 0.3, 0.2, 0.6) + blur("b14", 14),
    `<rect width='1000' height='2000' fill='url(#fundo)'/><rect width='1000' height='2000' fill='url(#luz)'/>
     <g filter='url(#b14)'>${pontos(16, "#ff7ad9", 18, 46, 0.2, 0.5)}${pontos(8, "#ffd36e", 14, 34, 0.15, 0.35)}</g>
     ${pontos(260, "#ffb8ec", 0.6, 2.2, 0.35, 1)}${pontos(90, "#ffe08a", 0.6, 1.8, 0.4, 1)}${estrelas}`,
  );
}

// ---------- Rosa claro: algodão-doce ----------
function algodao() {
  const nuvem = (cx, cy, s, cor) => `<g transform='translate(${cx} ${cy}) scale(${s})' fill='${cor}'>${[[-90, 10, 70], [-30, -30, 90], [50, -10, 80], [110, 20, 60], [10, 30, 85]].map(([x, y, rr]) => `<circle cx='${x}' cy='${y}' r='${rr}'/>`).join("")}</g>`;
  return svg(
    lin("ceu", [[0, "#ffe3f3"], [0.5, "#f3e8ff"], [1, "#e6f2ff"]]) + blur("b10", 10),
    `<rect width='1000' height='2000' fill='url(#ceu)'/><g filter='url(#b10)' opacity='.95'>
     ${nuvem(850, 300, 1.4, "#ffc2e3")}${nuvem(780, 330, 1.1, "#ffd9ee")}${nuvem(120, 900, 1.2, "#d9c9ff")}${nuvem(170, 930, 0.9, "#e9defe")}
     ${nuvem(820, 1450, 1.3, "#c9e4ff")}${nuvem(760, 1480, 1, "#ffd4ec")}${nuvem(200, 1900, 1.2, "#ffc8e6")}</g>
     ${pontos(30, "#ffffff", 1.5, 3.5, 0.5, 0.9)}`,
  );
}

// ---------- Cinza escuro: escritório à noite ----------
function escritorioNoite() {
  const grade = [];
  for (let x = 0; x <= 1000; x += 40) grade.push(`<path d='M${x} 0 V2000' stroke='#9aa7b8' stroke-width='${x % 200 ? 0.6 : 1.2}' opacity='${x % 200 ? 0.07 : 0.12}'/>`);
  for (let y = 0; y <= 2000; y += 40) grade.push(`<path d='M0 ${y} H1000' stroke='#9aa7b8' stroke-width='${y % 200 ? 0.6 : 1.2}' opacity='${y % 200 ? 0.07 : 0.12}'/>`);
  return svg(
    lin("fundo", [[0, "#22262d"], [0.5, "#171a1f"], [1, "#0d0f12"]]) + rad("luminaria", [[0, "#ffd9a0", 0.35], [0.5, "#ffd9a0", 0.08], [1, "#ffd9a0", 0]], 0.85, 0.05, 0.6),
    `<rect width='1000' height='2000' fill='url(#fundo)'/>${grade.join("")}<rect width='1000' height='1400' fill='url(#luminaria)'/>
     <g transform='translate(90 1450) rotate(-8)' opacity='.85'><rect width='170' height='170' fill='#e8c35a'/><rect width='170' height='22' fill='#d4ab3e'/><path d='M22 60 H140 M22 90 H120 M22 120 H130' stroke='#5c4a1a' stroke-width='5' opacity='.5'/></g>
     <g transform='translate(800 1700) rotate(10)' fill='none' stroke='#b9c3cf' stroke-width='7' opacity='.6'><path d='M0 0 V110 Q0 135 25 135 Q50 135 50 110 V20 Q50 5 35 5 Q20 5 20 20 V100'/></g>`,
  );
}

// ---------- Cinza claro: escritório (caderno, post-its, clipe) ----------
function escritorio() {
  const linhas = [];
  for (let y = 120; y <= 2000; y += 46) linhas.push(`<path d='M0 ${y} H1000' stroke='#9ab3cf' stroke-width='1.4' opacity='.45'/>`);
  const postit = (x, y, rot, cor, sombra) => `<g transform='translate(${x} ${y}) rotate(${rot})'><rect x='6' y='8' width='190' height='190' fill='#000' opacity='.08'/><rect width='190' height='190' fill='${cor}'/><rect width='190' height='26' fill='${sombra}'/><path d='M24 70 H160 M24 104 H140 M24 138 H150' stroke='#000' stroke-width='5' opacity='.12'/></g>`;
  return svg(
    lin("papel", [[0, "#f3f4f6"], [1, "#e9ebee"]]),
    `<rect width='1000' height='2000' fill='url(#papel)'/>${linhas.join("")}<path d='M90 0 V2000' stroke='#e57373' stroke-width='2.5' opacity='.6'/>
     ${postit(770, 320, 6, "#ffe680", "#f5d44a")}${postit(60, 1180, -7, "#ffb3d1", "#f799bf")}${postit(740, 1700, 4, "#b8e4ff", "#93d0f5")}
     <g transform='translate(300 120) rotate(-20)' fill='none' stroke='#8d99a8' stroke-width='7'><path d='M0 0 V130 Q0 160 30 160 Q60 160 60 130 V25 Q60 6 42 6 Q24 6 24 25 V115'/></g>`,
  );
}

module.exports = { fogo, cereja, outono, borboletas, abelha, girassol, floresta, natureza, universo, lavanda, glitter, algodao, escritorioNoite, escritorio };
