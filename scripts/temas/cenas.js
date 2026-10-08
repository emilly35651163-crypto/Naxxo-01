// As cenas (SVG parado) dos temas temáticos. Todas no mesmo estilo:
// escuros = fundo profundo com o assunto brilhando e luzes desfocadas; claros = tons suaves com brilho acetinado.
// A área do meio fica mais calma (é onde ficam os cartões); o desenho principal fica nas bordas, no topo e embaixo.

let semente = 11;
const rnd = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
const r = (a, b) => a + rnd() * (b - a);
const f = (n) => Number(n.toFixed(1));
const escolher = (lista) => lista[Math.floor(rnd() * lista.length)];

const svg = (defs, corpo) =>
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 2000' preserveAspectRatio='xMidYMin slice'><defs>${defs}</defs>${corpo}</svg>`;
const paradas = (ps) => ps.map(([o, c, a = 1]) => `<stop offset='${o}' stop-color='${c}' stop-opacity='${a}'/>`).join("");
const lin = (id, ps, x1 = 0, y1 = 0, x2 = 0, y2 = 1) => `<linearGradient id='${id}' x1='${x1}' y1='${y1}' x2='${x2}' y2='${y2}'>${paradas(ps)}</linearGradient>`;
const rad = (id, ps, cx = 0.5, cy = 0.5, rr = 0.5, fx, fy) =>
  `<radialGradient id='${id}' cx='${cx}' cy='${cy}' r='${rr}'${fx !== undefined ? ` fx='${fx}' fy='${fy}'` : ""}>${paradas(ps)}</radialGradient>`;
const blur = (id, d) => `<filter id='${id}' x='-60%' y='-60%' width='220%' height='220%'><feGaussianBlur stdDeviation='${d}'/></filter>`;
// Brilho: o desenho + uma cópia desfocada por baixo (luz)
const brilho = (id, d) =>
  `<filter id='${id}' x='-60%' y='-60%' width='220%' height='220%'><feGaussianBlur in='SourceGraphic' stdDeviation='${d}' result='b'/><feMerge><feMergeNode in='b'/><feMergeNode in='b'/><feMergeNode in='SourceGraphic'/></feMerge></filter>`;
const pontos = (n, cores, rmin, rmax, amin, amax, x0 = 0, x1 = 1000, y0 = 0, y1 = 2000) =>
  Array.from({ length: n }, () => `<circle cx='${f(r(x0, x1))}' cy='${f(r(y0, y1))}' r='${f(r(rmin, rmax))}' fill='${escolher(cores)}' opacity='${f(r(amin, amax) * 100) / 100}'/>`).join("");
const faisca = (x, y, s, cor, op = 1) =>
  `<path d='M${f(x)} ${f(y - s)} Q${f(x + s * 0.12)} ${f(y - s * 0.12)} ${f(x + s)} ${f(y)} Q${f(x + s * 0.12)} ${f(y + s * 0.12)} ${f(x)} ${f(y + s)} Q${f(x - s * 0.12)} ${f(y + s * 0.12)} ${f(x - s)} ${f(y)} Q${f(x - s * 0.12)} ${f(y - s * 0.12)} ${f(x)} ${f(y - s)} Z' fill='${cor}' opacity='${op}'/>`;

// ===================== VERMELHO =====================

// Fogo: labaredas que sobem pela direita, fumaça de fogo e brasas soltas no escuro
function fogo() {
  const lingua = (x, y, comp, larg, ang, curva, cor, op) => {
    const dx = Math.cos(ang), dy = Math.sin(ang), px = -dy, py = dx;
    const tx = x + dx * comp, ty = y + dy * comp;
    return `<path d='M${f(x)} ${f(y)} C${f(x + px * larg + dx * comp * 0.35)} ${f(y + py * larg + dy * comp * 0.35)} ${f(tx - dx * comp * 0.3 + px * larg * curva)} ${f(ty - dy * comp * 0.3 + py * larg * curva)} ${f(tx)} ${f(ty)} C${f(tx - dx * comp * 0.25 - px * larg * 0.3 * curva)} ${f(ty - dy * comp * 0.25 - py * larg * 0.3 * curva)} ${f(x - px * larg + dx * comp * 0.3)} ${f(y - py * larg + dy * comp * 0.3)} ${f(x)} ${f(y)} Z' fill='${cor}' opacity='${op}'/>`;
  };
  const camada = (n, xmin, larg, cor, opMin, opMax) =>
    Array.from({ length: n }, () => {
      const y = r(-100, 2100);
      return lingua(r(xmin, 1080), y, r(160, 420), r(larg * 0.5, larg), r(-2.6, -1.9), r(-1.6, 1.6), cor, f(r(opMin, opMax) * 100) / 100);
    }).join("");
  const fumaca = Array.from({ length: 18 }, () => {
    const x = r(380, 900), y = r(0, 2000);
    return `<path d='M${f(x)} ${f(y)} c${f(r(-60, 60))} ${f(r(-80, -30))} ${f(r(-120, 60))} ${f(r(-150, -60))} ${f(r(-60, 40))} ${f(r(-220, -120))}' stroke='${escolher(["#ffb15c", "#ff7a2f", "#ffd38a"])}' stroke-width='${f(r(1.5, 4))}' fill='none' opacity='${f(r(0.25, 0.6) * 100) / 100}'/>`;
  }).join("");
  return svg(
    lin("fundo", [[0, "#0b0303"], [1, "#050101"]], 0, 0, 1, 0) +
      rad("calor", [[0, "#ff4a12", 0.55], [0.6, "#a3150a", 0.25], [1, "#a3150a", 0]], 1, 0.5, 0.75) +
      blur("b18", 18) + blur("b6", 6) + blur("b2", 2) + brilho("luz", 3),
    `<rect width='1000' height='2000' fill='url(#fundo)'/><rect width='1000' height='2000' fill='url(#calor)'/>
     <g filter='url(#b18)'>${camada(26, 380, 140, "#c41d0e", 0.5, 0.9)}</g>
     <g filter='url(#b6)'>${camada(30, 470, 110, "#ff5a1a", 0.45, 0.85)}</g>
     <g filter='url(#b2)'>${camada(24, 560, 80, "#ff9a3c", 0.4, 0.8)}${camada(14, 680, 55, "#ffd27a", 0.35, 0.7)}</g>
     <g filter='url(#b2)'>${fumaca}</g>
     <g filter='url(#luz)'>${pontos(120, ["#ff8a3d", "#ffb15c", "#ff5a1a"], 0.8, 2.8, 0.4, 1, 0, 520)}${pontos(30, ["#ffd27a"], 1.5, 3.2, 0.6, 1, 250, 650)}</g>`,
  );
}

// Cereja: cetim creme, cerejas de vidro, laços de veludo e pequenas joias
function cereja() {
  const dobras = Array.from({ length: 9 }, (_, i) => {
    const y = i * 250 + r(-60, 60);
    return `<path d='M-100 ${f(y)} C 250 ${f(y + r(-160, 160))}, 650 ${f(y + r(-160, 160))}, 1100 ${f(y + r(-120, 120))} L1100 ${f(y + 90)} C 650 ${f(y + 90 + r(-120, 120))}, 250 ${f(y + 90 + r(-120, 120))}, -100 ${f(y + 90)} Z' fill='${i % 2 ? "#ffffff" : "#e8dccb"}' opacity='${i % 2 ? 0.75 : 0.55}'/>`;
  }).join("");
  const laco = (x, y, s, rot) => `
  <g transform='translate(${f(x)} ${f(y)}) rotate(${f(rot)}) scale(${f(s)})'>
    <path d='M0 0 C -30 -60, -120 -70, -110 -10 C -105 30, -40 20, 0 0 Z' fill='url(#veludo)'/>
    <path d='M0 0 C 30 -60, 120 -70, 110 -10 C 105 30, 40 20, 0 0 Z' fill='url(#veludo)'/>
    <path d='M-6 6 C -30 50, -50 90, -70 120 L -48 118 L -40 132 C -20 90, -8 50, 4 10 Z' fill='url(#veludoEscuro)'/>
    <path d='M6 6 C 30 50, 52 85, 64 125 L 44 120 L 34 134 C 22 90, 10 50, -2 10 Z' fill='url(#veludoEscuro)'/>
    <ellipse cx='0' cy='2' rx='15' ry='17' fill='url(#veludoEscuro)'/>
    <path d='M-96 -18 C -80 -46, -44 -46, -20 -14' stroke='#b0283f' stroke-width='3' fill='none' opacity='.5'/><path d='M96 -18 C 80 -46, 44 -46, 20 -14' stroke='#b0283f' stroke-width='3' fill='none' opacity='.5'/>
  </g>`;
  const par = (x, y, s, rot) => `
  <g transform='translate(${f(x)} ${f(y)}) rotate(${f(rot)}) scale(${f(s)})'>
    <ellipse cx='-30' cy='92' rx='34' ry='10' fill='#6b0a16' opacity='.18'/><ellipse cx='34' cy='96' rx='34' ry='10' fill='#6b0a16' opacity='.18'/>
    <path d='M0 -70 C -4 -20, -20 20, -30 52' stroke='url(#ouro)' stroke-width='5' fill='none' stroke-linecap='round'/>
    <path d='M0 -70 C 8 -20, 24 20, 32 56' stroke='url(#ouro)' stroke-width='5' fill='none' stroke-linecap='round'/>
    <path d='M0 -70 C 22 -96, 56 -96, 70 -80 C 46 -70, 22 -66, 0 -70 Z' fill='url(#ouro)'/>
    <circle cx='-30' cy='60' r='32' fill='url(#fruta)'/><circle cx='32' cy='64' r='32' fill='url(#fruta)'/>
    <ellipse cx='-41' cy='48' rx='9' ry='5' fill='#fff' opacity='.85' transform='rotate(-35 -41 48)'/><ellipse cx='21' cy='52' rx='9' ry='5' fill='#fff' opacity='.85' transform='rotate(-35 21 52)'/>
    ${laco(0, -70, 0.28, 0)}
  </g>`;
  const joia = (x, y, coracao) =>
    coracao
      ? `<g transform='translate(${f(x)} ${f(y)})'><path d='M0 12 C -18 0, -16 -14, -6 -14 C -2 -14, 0 -10, 0 -8 C 0 -10, 2 -14, 6 -14 C 16 -14, 18 0, 0 12 Z' fill='url(#joia)' stroke='#d4a94a' stroke-width='2.5'/><circle cx='-6' cy='-7' r='2.5' fill='#fff' opacity='.8'/></g>`
      : `<g transform='translate(${f(x)} ${f(y)})'><circle r='10' fill='url(#joia)' stroke='#d4a94a' stroke-width='2.5'/><circle cx='-3' cy='-3' r='2.5' fill='#fff' opacity='.8'/></g>`;
  const itens = [];
  const lugares = [[140, 140, "l"], [560, 120, "l"], [880, 260, "p"], [320, 330, "p"], [90, 520, "l"], [700, 560, "l"], [950, 760, "l"], [180, 820, "l"], [470, 880, "p"], [820, 1020, "p"], [60, 1200, "l"], [600, 1150, "l"], [300, 1350, "p"], [900, 1400, "l"], [120, 1600, "p"], [700, 1650, "l"], [430, 1850, "l"], [880, 1880, "p"], [200, 1950, "l"]];
  for (const [x, y, t] of lugares) itens.push(t === "l" ? laco(x, y, r(0.8, 1.2), r(-25, 25)) : par(x, y, r(0.85, 1.1), r(-15, 15)));
  const joias = Array.from({ length: 26 }, () => joia(r(20, 980), r(20, 1980), rnd() > 0.6)).join("");
  return svg(
    lin("cetim", [[0, "#f7f0e6"], [1, "#efe5d6"]]) + blur("b30", 30) +
      lin("veludo", [[0, "#9b1b30"], [1, "#5e0a18"]], 0, 0, 1, 1) + lin("veludoEscuro", [[0, "#7a0f22"], [1, "#4a0612"]], 0, 0, 1, 1) +
      rad("fruta", [[0, "#d9455a"], [0.5, "#9c1228"], [1, "#4f0610"]], 0.4, 0.35, 0.7) +
      lin("ouro", [[0, "#e8c56a"], [1, "#8a6a24"]], 0, 0, 1, 1) + rad("joia", [[0, "#ff6b81"], [1, "#9c0f2a"]], 0.35, 0.35, 0.8),
    `<rect width='1000' height='2000' fill='url(#cetim)'/><g filter='url(#b30)'>${dobras}</g>${itens.join("")}${joias}`,
  );
}

// ===================== LARANJA =====================

const BORDO = "M0,-50 L8,-30 L20,-36 L16,-16 L36,-22 L30,-6 L46,0 L28,8 L32,22 L14,16 L8,30 L2,22 L2,46 L-2,46 L-2,22 L-8,30 L-14,16 L-32,22 L-28,8 L-46,0 L-30,-6 L-36,-22 L-16,-16 L-20,-36 L-8,-30 Z";

// Outono: galhos com folhas de bordo descendo pela esquerda, cordões de luzinhas e luzes desfocadas
function outono() {
  const folha = (x, y, s, rot, grad, op = 1) =>
    `<g transform='translate(${f(x)} ${f(y)}) rotate(${f(rot)}) scale(${f(s)})' opacity='${op}'><path d='${BORDO}' fill='url(#${grad})'/><path d='M0 44 L0 -40 M0 4 L30 -14 M0 4 L-30 -14 M0 18 L24 16 M0 18 L-24 16' stroke='#7a2a05' stroke-width='1.6' opacity='.55'/></g>`;
  const galhos = [];
  const folhas = [];
  for (let g = 0; g < 4; g++) {
    let x = r(-20, 260), y = -20;
    let d = `M${f(x)} ${f(y)}`;
    for (let k = 0; k < 9; k++) {
      x += r(-40, 70); y += r(120, 220);
      d += ` L${f(x)} ${f(y)}`;
      for (let m = 0; m < 3; m++) folhas.push(folha(x + r(-70, 70), y + r(-60, 60), r(0.9, 1.6), r(-40, 40), escolher(["f1", "f2", "f3"])));
    }
    galhos.push(`<path d='${d}' stroke='#3a1206' stroke-width='${f(r(2, 4))}' fill='none' opacity='.8'/>`);
  }
  const fundoFolhas = Array.from({ length: 16 }, () => folha(r(300, 1000), r(0, 2000), r(0.8, 1.8), r(0, 360), escolher(["f1", "f2", "f3"]), f(r(0.25, 0.5) * 100) / 100)).join("");
  const cordoes = [520, 700, 880].map((x0) => {
    let d = `M${x0} -10`, luzes = "";
    let x = x0;
    for (let y = 0; y < 2000; y += 70) {
      x += r(-12, 12);
      d += ` L${f(x)} ${y}`;
      if (rnd() > 0.35) luzes += `<circle cx='${f(x + r(-6, 6))}' cy='${f(y + r(-20, 20))}' r='${f(r(2.5, 4.5))}' fill='#ffd27a'/>`;
    }
    return `<path d='${d}' stroke='#6b3a12' stroke-width='1.2' fill='none' opacity='.6'/><g filter='url(#luz)'>${luzes}</g>`;
  }).join("");
  return svg(
    lin("fundo", [[0, "#241008"], [0.5, "#160904"], [1, "#0d0502"]]) +
      lin("f1", [[0, "#ffd36b"], [0.6, "#f29a2e"], [1, "#d9601a"]], 0, 0, 1, 1) + lin("f2", [[0, "#ff9a3c"], [1, "#c23a12"]], 0, 0, 1, 1) + lin("f3", [[0, "#f57a1f"], [1, "#9e2a0c"]], 0, 0, 1, 1) +
      blur("b12", 12) + blur("b4", 4) + brilho("luz", 4) + rad("calor", [[0, "#ff9a3c", 0.25], [1, "#ff9a3c", 0]], 0.2, 0.3, 0.6),
    `<rect width='1000' height='2000' fill='url(#fundo)'/><rect width='1000' height='2000' fill='url(#calor)'/>
     <g filter='url(#b12)'>${pontos(40, ["#ff9a3c", "#ffb35c", "#e0611c"], 12, 34, 0.18, 0.5, 300, 1000)}</g>
     <g filter='url(#b4)'>${fundoFolhas}</g>${cordoes}${galhos.join("")}${folhas.join("")}`,
  );
}

// Borboletas: parede laranja com luz de janela e borboletas-monarca
function borboletas() {
  const monarca = (x, y, s, rot) => `
  <g transform='translate(${f(x)} ${f(y)}) rotate(${f(rot)}) scale(${f(s)})'>
    <g transform='translate(10 14)' opacity='.25' filter='url(#b6)'><path d='M0 0 L-120 -60 L-70 30 Z M0 0 L120 -60 L70 30 Z' fill='#5a2200'/></g>
    <path d='M-2 -2 C -40 -70, -128 -78, -130 -40 C -132 -10, -90 6, -2 2 Z' fill='url(#asa)' stroke='#1b0d05' stroke-width='9' stroke-linejoin='round'/>
    <path d='M2 -2 C 40 -70, 128 -78, 130 -40 C 132 -10, 90 6, 2 2 Z' fill='url(#asa)' stroke='#1b0d05' stroke-width='9' stroke-linejoin='round'/>
    <path d='M-2 4 C -26 40, -86 76, -96 44 C -104 18, -60 4, -2 4 Z' fill='url(#asa2)' stroke='#1b0d05' stroke-width='9' stroke-linejoin='round'/>
    <path d='M2 4 C 26 40, 86 76, 96 44 C 104 18, 60 4, 2 4 Z' fill='url(#asa2)' stroke='#1b0d05' stroke-width='9' stroke-linejoin='round'/>
    <path d='M-6 -6 L-110 -50 M-14 -12 L-84 -66 M-8 -4 L-122 -22 M6 -6 L110 -50 M14 -12 L84 -66 M8 -4 L122 -22 M-6 8 L-80 46 M-6 10 L-50 56 M6 8 L80 46 M6 10 L50 56' stroke='#1b0d05' stroke-width='4' fill='none'/>
    ${[[-124, -40], [-118, -56], [-104, -68], [-86, -74], [-128, -24], [-92, 52], [-76, 62], [-98, 34], [124, -40], [118, -56], [104, -68], [86, -74], [128, -24], [92, 52], [76, 62], [98, 34]].map(([a, b]) => `<circle cx='${a}' cy='${b}' r='3.2' fill='#fff7e8'/>`).join("")}
    <ellipse cx='0' cy='2' rx='6' ry='34' fill='#1b0d05'/><circle cx='0' cy='-32' r='7' fill='#1b0d05'/>
    <path d='M-3 -36 C -10 -60, -22 -70, -30 -74 M3 -36 C 10 -60, 22 -70, 30 -74' stroke='#1b0d05' stroke-width='3' fill='none'/>
  </g>`;
  const posicoes = [[180, 160, 0.95, -8], [800, 260, 0.75, 12], [560, 520, 0.7, -14], [120, 760, 0.8, 6], [900, 980, 0.9, -10], [420, 1180, 1, 4], [130, 1440, 0.7, -16], [820, 1560, 0.85, 10], [300, 1860, 0.8, -6]];
  return svg(
    lin("parede", [[0, "#f2a35a"], [0.5, "#e98a3a"], [1, "#d8722a"]]) + blur("b40", 40) + blur("b6", 6) +
      lin("asa", [[0, "#f7a23c"], [1, "#d9600f"]], 0, 0, 1, 1) + lin("asa2", [[0, "#f9ad4a"], [1, "#e0701a"]], 0, 0, 1, 1),
    `<rect width='1000' height='2000' fill='url(#parede)'/>
     <g filter='url(#b40)'><path d='M450 -100 L1100 300 L1100 900 L450 500 Z' fill='#ffd6a0' opacity='.55'/><path d='M440 700 L1100 1100 L1100 1200 L440 800 Z' fill='#7a3a10' opacity='.35'/><path d='M760 -100 L840 -60 L840 1400 L760 1360 Z' fill='#7a3a10' opacity='.3'/><path d='M-100 1200 L500 1500 L500 1600 L-100 1300 Z' fill='#7a3a10' opacity='.25'/></g>
     ${posicoes.map(([x, y, s, rr]) => monarca(x, y, s, rr)).join("")}`,
  );
}

// ===================== AMARELO =====================

// Abelha: mel escorrendo do topo sobre favos dourados, abelhinhas fofas
function abelha() {
  const hexagonos = [];
  const R = 70;
  for (let li = 0; li < 18; li++)
    for (let co = 0; co < 8; co++) {
      const cx = co * R * 1.732 + (li % 2) * R * 0.866 - 40, cy = 260 + li * R * 1.5;
      const p = Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 3) * i + Math.PI / 6; return `${f(cx + R * Math.cos(a))},${f(cy + R * Math.sin(a))}`; }).join(" ");
      hexagonos.push(`<polygon points='${p}' fill='${rnd() > 0.7 ? "url(#celula)" : "none"}' stroke='#e2a52a' stroke-width='5' opacity='${f(r(0.35, 0.6) * 100) / 100}'/>`);
    }
  let mel = "M0 0 L1000 0 L1000 120";
  for (let x = 1000; x > 0; x -= r(60, 110)) {
    const h = r(90, 330), w = r(18, 30);
    mel += ` L${f(x)} 120 L${f(x)} ${f(h)} Q${f(x)} ${f(h + w * 1.6)} ${f(x - w)} ${f(h + w * 1.6)} Q${f(x - w * 2)} ${f(h + w * 1.6)} ${f(x - w * 2)} ${f(h)} L${f(x - w * 2)} 130`;
  }
  mel += " L0 140 Z";
  const abelhinha = (x, y, s, rot) => `
  <g transform='translate(${f(x)} ${f(y)}) rotate(${f(rot)}) scale(${f(s)})'>
    <ellipse cx='-14' cy='-26' rx='16' ry='22' fill='#ffffff' stroke='#2a1a05' stroke-width='3' transform='rotate(-25 -14 -26)'/>
    <ellipse cx='14' cy='-26' rx='16' ry='22' fill='#ffffff' stroke='#2a1a05' stroke-width='3' transform='rotate(25 14 -26)'/>
    <ellipse cx='0' cy='0' rx='30' ry='24' fill='#ffc531' stroke='#2a1a05' stroke-width='3'/>
    <path d='M-12 -22 Q-16 0 -12 22 M4 -24 Q0 0 4 24 M18 -18 Q15 0 18 18' stroke='#2a1a05' stroke-width='8' fill='none'/>
    <circle cx='-26' cy='-6' r='13' fill='#2a1a05'/><circle cx='-30' cy='-9' r='3' fill='#fff'/>
    <path d='M-30 -18 C -40 -36, -52 -36, -48 -26 M-22 -18 C -24 -38, -34 -44, -36 -34' stroke='#2a1a05' stroke-width='2.5' fill='none'/>
    <path d='M30 2 L40 4 L30 8 Z' fill='#2a1a05'/>
  </g>`;
  return svg(
    lin("fundo", [[0, "#3a2306"], [0.5, "#241604"], [1, "#160d02"]]) + rad("luz", [[0, "#ffb92e", 0.35], [1, "#ffb92e", 0]], 0.5, 0.15, 0.7) +
      rad("celula", [[0, "#ffcf4a", 0.55], [1, "#c27c08", 0.25]]) + lin("mel", [[0, "#ffe066"], [0.5, "#ffc21a"], [1, "#e09405"]], 0, 0, 0, 1) + brilho("luzMel", 6),
    `<rect width='1000' height='2000' fill='#1c1103'/><rect width='1000' height='2000' fill='url(#luz)'/>${hexagonos.join("")}
     <g filter='url(#luzMel)'><path d='${mel}' fill='url(#mel)'/></g><path d='${mel}' fill='none' stroke='#fff6c8' stroke-width='3' opacity='.4'/>
     ${abelhinha(170, 300, 1, -10)}${abelhinha(760, 380, 0.8, 12)}${abelhinha(890, 1180, 0.9, -6)}${abelhinha(120, 1650, 0.75, 8)}`,
  );
}

// Girassol: papel de aquarela amarelo, girassóis emoldurando as bordas
function girassol() {
  const manchas = Array.from({ length: 22 }, () => `<circle cx='${f(r(0, 1000))}' cy='${f(r(0, 2000))}' r='${f(r(80, 220))}' fill='${escolher(["#ffe7a0", "#fff4d0", "#f8d97a", "#fffaf0"])}' opacity='${f(r(0.3, 0.7) * 100) / 100}'/>`).join("");
  const flor = (cx, cy, R) => {
    const anel = (n, raio, comp, grad, desloc) =>
      Array.from({ length: n }, (_, i) => {
        const a = (360 / n) * i + desloc + r(-4, 4);
        return `<ellipse cx='${cx}' cy='${f(cy - raio)}' rx='${f(comp * 0.32)}' ry='${f(comp)}' fill='url(#${grad})' opacity='.92' transform='rotate(${f(a)} ${cx} ${cy})'/>`;
      }).join("");
    const sementes = Array.from({ length: 60 }, (_, i) => { const a = i * 2.39996, d = Math.sqrt(i / 60) * R * 0.34; return `<circle cx='${f(cx + d * Math.cos(a))}' cy='${f(cy + d * Math.sin(a))}' r='${f(R * 0.028)}' fill='#5a2e0a' opacity='.7'/>`; }).join("");
    return `<g filter='url(#aquarela)'>${anel(20, R * 0.62, R * 0.36, "petala2", 9)}${anel(18, R * 0.55, R * 0.34, "petala", 0)}<circle cx='${cx}' cy='${cy}' r='${f(R * 0.38)}' fill='url(#miolo)'/>${sementes}</g>`;
  };
  const folha = (x, y, rot, s) => `<path transform='translate(${f(x)} ${f(y)}) rotate(${f(rot)}) scale(${f(s)})' d='M0 0 C 30 -30, 90 -30, 120 0 C 90 20, 30 20, 0 0 Z' fill='#9aa88a' opacity='.8'/>`;
  const flores = [[120, 120, 240], [560, 70, 150], [930, 160, 260], [880, 520, 120], [70, 560, 140], [40, 1050, 180], [960, 1000, 170], [80, 1700, 150], [520, 1960, 160], [930, 1780, 230], [300, 1930, 130]];
  return svg(
    lin("papel", [[0, "#fbf0c4"], [1, "#f6e3a1"]]) + blur("b40", 40) +
      `<filter id='aquarela'><feGaussianBlur stdDeviation='1.2'/></filter>` +
      lin("petala", [[0, "#ffd84a"], [1, "#f0a91c"]]) + lin("petala2", [[0, "#ffe680"], [1, "#e9b23a"]]) + rad("miolo", [[0, "#7a4a1a"], [0.7, "#5a3010"], [1, "#9a6a2a"]]),
    `<rect width='1000' height='2000' fill='url(#papel)'/><g filter='url(#b40)'>${manchas}</g>
     ${folha(250, 320, 30, 1)}${folha(780, 330, 150, 1)}${folha(170, 1150, 20, 0.9)}${folha(860, 1120, 160, 0.9)}${folha(760, 1850, -150, 1)}
     ${flores.map(([x, y, R]) => flor(x, y, R)).join("")}
     ${pontos(30, ["#ffffff"], 4, 7, 0.6, 0.9, 0, 120, 600, 1400)}${pontos(30, ["#ffffff"], 4, 7, 0.6, 0.9, 880, 1000, 500, 1200)}`,
  );
}

// ===================== VERDE =====================

// Floresta: noite com lua crescente, trepadeiras, flores que brilham e vaga-lumes
function floresta() {
  const trepadeira = (x0, y0, x1, y1, curva) => {
    const d = `M${x0} ${y0} Q${f((x0 + x1) / 2 + curva)} ${f((y0 + y1) / 2)} ${x1} ${y1}`;
    const folhas = Array.from({ length: 14 }, (_, i) => {
      const t = i / 13, x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * ((x0 + x1) / 2 + curva) + t * t * x1, y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * ((y0 + y1) / 2) + t * t * y1;
      const lado = i % 2 ? 1 : -1;
      return `<path transform='translate(${f(x)} ${f(y)}) rotate(${f(lado * r(30, 70))})' d='M0 0 C 6 -8, 18 -8, 22 0 C 18 6, 6 6, 0 0 Z' fill='${escolher(["#4fbf7a", "#3a9a62", "#6fd99a"])}'/>`;
    }).join("");
    return `<path d='${d}' stroke='#2f7a4f' stroke-width='2.5' fill='none'/>${folhas}`;
  };
  const flor = (x, y, s) =>
    `<g transform='translate(${f(x)} ${f(y)}) scale(${f(s)})' filter='url(#luz)'>${Array.from({ length: 5 }, (_, i) => `<path transform='rotate(${i * 72})' d='M0 0 C -8 -10, -6 -24, 0 -30 C 6 -24, 8 -10, 0 0 Z' fill='#d8fff0'/>`).join("")}<circle r='4' fill='#fff6b0'/></g>`;
  const folhagem = (x, y, s, cor) => `<path transform='translate(${f(x)} ${f(y)}) scale(${f(s)}) rotate(${f(r(0, 360))})' d='M0 0 C 30 -40, 80 -40, 110 0 C 80 30, 30 30, 0 0 Z' fill='${cor}'/>`;
  const cantos = [];
  for (let i = 0; i < 26; i++) cantos.push(folhagem(r(700, 1050), r(-40, 500), r(0.8, 1.6), escolher(["#0f3a2a", "#154a35", "#0b2c20"])));
  for (let i = 0; i < 26; i++) cantos.push(folhagem(r(-50, 300), r(1600, 2050), r(0.8, 1.7), escolher(["#0b2c20", "#0f3a2a", "#08241a"])));
  return svg(
    lin("ceu", [[0, "#06141a"], [0.5, "#0a2422"], [1, "#0b2a20"]]) + blur("b30", 30) + blur("b10", 10) + brilho("luz", 5) +
      rad("lua", [[0, "#fffbe0", 0.9], [0.4, "#c8ffd8", 0.25], [1, "#c8ffd8", 0]]),
    `<rect width='1000' height='2000' fill='url(#ceu)'/>
     <g filter='url(#b30)'>${pontos(26, ["#123c30", "#1a4d3a", "#0e3328"], 60, 160, 0.5, 0.9, 0, 1000, 500, 2000)}</g>
     ${pontos(140, ["#ffffff", "#c8ffe0"], 0.6, 1.8, 0.3, 0.9, 0, 1000, 0, 1400)}
     <circle cx='700' cy='520' r='260' fill='url(#lua)'/>
     <g filter='url(#luz)'><path d='M760 360 A170 170 0 1 0 760 700 A135 135 0 1 1 760 360 Z' fill='#fff8d8'/></g>
     ${trepadeira(1000, 120, 520, 900, -160)}${trepadeira(950, 300, 650, 1250, 120)}${trepadeira(980, 900, 380, 1450, -60)}
     ${flor(840, 300, 1)}${flor(600, 820, 0.8)}${flor(880, 1100, 1.1)}${flor(470, 1380, 0.9)}${flor(240, 1500, 1.2)}${flor(140, 1720, 0.9)}${flor(380, 1860, 1)}
     <g filter='url(#luz)'>${pontos(40, ["#b8ffcf", "#e8ffb0"], 1.5, 3.2, 0.5, 1, 0, 1000, 300, 2000)}</g>
     <g filter='url(#b10)' opacity='.9'>${cantos.slice(0, 26).join("")}</g>${cantos.slice(26).join("")}`,
  );
}

// Natureza: campo ensolarado de trevos, florzinhas brancas e amarelas, luz entrando
function natureza() {
  const trevo = (x, y, s, cor) =>
    `<g transform='translate(${f(x)} ${f(y)}) scale(${f(s)}) rotate(${f(r(0, 120))})'>${[0, 120, 240].map((a) => `<path transform='rotate(${a})' d='M0 0 C -26 -10, -30 -44, -10 -48 C -2 -50, 0 -42, 0 -38 C 0 -42, 2 -50, 10 -48 C 30 -44, 26 -10, 0 0 Z' fill='${cor}'/>`).join("")}<path d='M0 0 L4 40' stroke='#3f7a22' stroke-width='3'/></g>`;
  const margarida = (x, y, s, cor) =>
    `<g transform='translate(${f(x)} ${f(y)}) scale(${f(s)})'>${Array.from({ length: 12 }, (_, i) => `<ellipse transform='rotate(${i * 30})' cy='-12' rx='4' ry='11' fill='${cor}'/>`).join("")}<circle r='6' fill='#f2c230'/></g>`;
  const trevos = Array.from({ length: 70 }, () => { const y = r(1000, 2050); return trevo(r(-30, 1030), y, r(0.8, 1.8) * (y / 1600), escolher(["#5fae3a", "#74c24a", "#4b9a2e", "#8ad35a", "#3f8a27"])); }).sort().join("");
  const capim = Array.from({ length: 90 }, () => { const x = r(0, 1000), y = r(900, 2000), h = r(60, 180); return `<path d='M${f(x)} ${f(y)} q${f(r(-12, 12))} ${f(-h / 2)} ${f(r(-20, 20))} ${f(-h)}' stroke='${escolher(["#6fb84a", "#8fd060", "#4f9a30"])}' stroke-width='${f(r(2, 4))}' fill='none'/>`; }).join("");
  const flores = Array.from({ length: 28 }, () => margarida(r(0, 1000), r(950, 1980), r(0.8, 1.4), rnd() > 0.7 ? "#ffd84a" : "#ffffff")).join("");
  const folhaGrande = (x, y, rot, s) => `<path transform='translate(${f(x)} ${f(y)}) rotate(${f(rot)}) scale(${f(s)})' d='M0 0 C 60 -80, 200 -90, 260 0 C 200 70, 60 70, 0 0 Z M0 0 L250 0' fill='url(#folha)' stroke='#3f7a22' stroke-width='2'/>`;
  return svg(
    lin("fundo", [[0, "#bfe59a"], [0.45, "#8ccc66"], [1, "#4f9a34"]]) + rad("sol", [[0, "#fffbd0", 0.9], [1, "#fffbd0", 0]], 0.65, 0.05, 0.6) +
      lin("folha", [[0, "#9ad86a"], [1, "#4e9a2f"]], 0, 0, 1, 1) + blur("b14", 14),
    `<rect width='1000' height='2000' fill='url(#fundo)'/><rect width='1000' height='1200' fill='url(#sol)'/>
     <g filter='url(#b14)'>${pontos(20, ["#d8f5a8", "#b6e07c"], 30, 80, 0.4, 0.8, 0, 1000, 500, 1100)}</g>
     ${capim}${trevos}${flores}${folhaGrande(-40, 120, 20, 1.1)}${folhaGrande(1040, 260, 160, 1)}
     <g transform='translate(720 760) rotate(-12)'><path d='M0 0 C -20 -40, -70 -44, -68 -12 C -66 6, -30 6, 0 0 Z M0 0 C 20 -40, 70 -44, 68 -12 C 66 6, 30 6, 0 0 Z M0 4 C -16 26, -50 40, -48 18 Z M0 4 C 16 26, 50 40, 48 18 Z' fill='#fffdf5' stroke='#d9d2b8' stroke-width='1.5'/><ellipse rx='4' ry='16' fill='#5a4a2a'/></g>`,
  );
}

// ===================== AZUL =====================

// Mar profundo: águas-vivas que brilham no escuro, partículas suspensas
function marProfundo() {
  const agua = (x, y, s, op, borrado) => {
    const tentaculos = Array.from({ length: 16 }, (_, i) => {
      const x0 = -90 + (180 / 15) * i;
      return `<path d='M${f(x0)} 0 C ${f(x0 + r(-30, 30))} 200, ${f(x0 + r(-60, 60))} 400, ${f(x0 + r(-80, 80))} ${f(r(560, 760))}' stroke='#7fc4ff' stroke-width='1.6' fill='none' opacity='.55'/>`;
    }).join("");
    const bracos = [-26, 0, 26].map((x0) => `<path d='M${x0} 0 C ${x0 + 30} 120, ${x0 - 40} 240, ${x0 + 20} 380 C ${x0 + 50} 460, ${x0 - 20} 520, ${x0 + 10} 600' stroke='#9ed8ff' stroke-width='14' stroke-dasharray='10 6' fill='none' opacity='.45'/>`).join("");
    return `<g transform='translate(${f(x)} ${f(y)}) scale(${f(s)})' opacity='${op}' ${borrado ? "filter='url(#b8)'" : "filter='url(#luz)'"}>
      ${tentaculos}${bracos}
      <path d='M-130 0 C -130 -120, 130 -120, 130 0 C 100 14, 60 -4, 30 8 C 10 14, -10 14, -30 8 C -60 -4, -100 14, -130 0 Z' fill='url(#sino)'/>
      <path d='M-130 0 C -100 14, -60 -4, -30 8 C -10 14, 10 14, 30 8 C 60 -4, 100 14, 130 0' stroke='#d8f0ff' stroke-width='3' fill='none'/>
      ${[[-40, -40], [40, -40], [-20, -60], [20, -60]].map(([a, b]) => `<ellipse cx='${a}' cy='${b}' rx='22' ry='12' fill='none' stroke='#e8f8ff' stroke-width='3' opacity='.8'/>`).join("")}
    </g>`;
  };
  return svg(
    lin("fundo", [[0, "#020a1c"], [0.5, "#010612"], [1, "#00030a"]]) + rad("sino", [[0, "#bfe6ff", 0.95], [0.6, "#3d8bff", 0.7], [1, "#1a4fd6", 0.4]], 0.5, 0.75, 0.75) +
      blur("b8", 8) + brilho("luz", 10),
    `<rect width='1000' height='2000' fill='url(#fundo)'/>
     ${agua(130, 320, 0.55, 0.45, true)}${agua(900, 520, 0.5, 0.4, true)}${agua(800, 1500, 0.6, 0.45, true)}${agua(120, 1350, 0.45, 0.35, true)}
     ${agua(470, 700, 1.15, 0.95, false)}
     ${pontos(120, ["#8fc7ff", "#cfe8ff"], 0.6, 2, 0.2, 0.7)}`,
  );
}

// Elétrico: dois peixes koi feitos de luz nadando num céu estrelado
function eletrico() {
  const koi = (x, y, s, rot, espelho) => {
    const corpo = "M0 0 C 60 -40, 170 -50, 260 -10 C 300 6, 300 30, 260 44 C 170 80, 60 70, 0 40 C -40 60, -140 120, -260 90 C -180 50, -120 10, -110 -10 C -140 -40, -200 -110, -280 -130 C -160 -110, -70 -50, 0 0 Z";
    const linhas = Array.from({ length: 22 }, (_, i) => {
      const y0 = -30 + i * 3.2;
      return `<path d='M250 ${f(y0 / 2 + 16)} C 160 ${f(y0 * 1.6)}, 40 ${f(y0 * 1.4)}, ${f(-120 - r(0, 140))} ${f(y0 * r(1.5, 3) + r(-40, 40))}' stroke='#bfe8ff' stroke-width='1.2' fill='none' opacity='${f(r(0.3, 0.75) * 100) / 100}'/>`;
    }).join("");
    const nadadeira = "M120 30 C 140 90, 110 150, 60 170 C 80 120, 90 80, 80 40 Z M140 -20 C 170 -80, 150 -130, 110 -150 C 120 -100, 116 -60, 100 -24 Z";
    return `<g transform='translate(${f(x)} ${f(y)}) rotate(${f(rot)}) scale(${espelho ? -s : s} ${s})'>
      <g filter='url(#b14)' opacity='.8'><path d='${corpo}' fill='#3aa0ff'/></g>
      <path d='${corpo}' fill='url(#koi)' opacity='.7'/><path d='${nadadeira}' fill='#9fd8ff' opacity='.45'/>
      ${linhas}<path d='${corpo}' fill='none' stroke='#e6f7ff' stroke-width='2' opacity='.9'/>
      <circle cx='240' cy='4' r='5' fill='#ffffff'/>
      <g filter='url(#luz)'>${pontos(40, ["#ffffff", "#bfe8ff"], 0.8, 2.6, 0.5, 1, -250, 280, -110, 110)}</g>
    </g>`;
  };
  return svg(
    lin("ceu", [[0, "#06102e"], [0.5, "#040b22"], [1, "#020615"]]) + rad("koi", [[0, "#e6f7ff", 0.9], [0.6, "#6cc4ff", 0.6], [1, "#2b7fff", 0.2]], 0.7, 0.5, 0.8) +
      blur("b14", 14) + brilho("luz", 3),
    `<rect width='1000' height='2000' fill='url(#ceu)'/>
     ${pontos(260, ["#ffffff", "#cfe0ff", "#9fc0ff"], 0.5, 1.8, 0.25, 1)}
     <g filter='url(#luz)'>${Array.from({ length: 12 }, () => faisca(r(0, 1000), r(0, 2000), r(4, 10), "#e6f2ff", 0.9)).join("")}</g>
     ${koi(560, 520, 1.2, 70, false)}${koi(440, 1450, 1.2, -110, false)}`,
  );
}

// Tecnologia: circuitos azuis brilhando, colunas de pontos e um chão de circuito em perspectiva
function tecnologia() {
  const trilha = (x, lado) => {
    let d = `M${x} 0`, y = 0, xx = x;
    const nos = [];
    while (y < 1300) {
      y += r(60, 160);
      d += ` L${f(xx)} ${f(y)}`;
      if (rnd() > 0.5) { const nx = xx + lado * r(20, 70); d += ` L${f(nx)} ${f(y + 40)}`; xx = nx; y += 40; }
      if (rnd() > 0.55) nos.push(`<circle cx='${f(xx)}' cy='${f(y)}' r='${f(r(2.5, 5))}' fill='#7fe0ff'/>`);
    }
    return `<path d='${d}' stroke='#3fa9ff' stroke-width='${f(r(1.2, 2.6))}' fill='none' opacity='${f(r(0.4, 0.85) * 100) / 100}'/><g filter='url(#luz)'>${nos.join("")}</g>`;
  };
  const colunas = [380, 430, 470, 530, 570, 620].map((x) => `<g filter='url(#luz)'>${Array.from({ length: 30 }, (_, i) => (rnd() > 0.35 ? `<rect x='${x}' y='${40 + i * 30}' width='3' height='6' fill='#8fe6ff' opacity='${f(r(0.3, 0.9) * 100) / 100}'/>` : "")).join("")}</g>`).join("");
  const chao = [];
  for (let i = -10; i <= 10; i++) chao.push(`<path d='M500 1400 L${500 + i * 160} 2000' stroke='#4fb8ff' stroke-width='1.2' opacity='.35'/>`);
  for (let k = 0; k < 9; k++) { const y = 1400 + Math.pow(k / 8, 1.8) * 600; chao.push(`<path d='M0 ${f(y)} H1000' stroke='#4fb8ff' stroke-width='1' opacity='${f(0.15 + k * 0.03)}'/>`); }
  return svg(
    lin("fundo", [[0, "#03112e"], [0.6, "#062a66"], [0.7, "#0a4aa8"], [1, "#04235a"]]) + rad("centro", [[0, "#3fc8ff", 0.6], [1, "#3fc8ff", 0]], 0.5, 0.68, 0.45) + brilho("luz", 4),
    `<rect width='1000' height='2000' fill='url(#fundo)'/><rect width='1000' height='2000' fill='url(#centro)'/>
     ${[60, 120, 170, 230, 280, 330].map((x) => trilha(x, 1)).join("")}${[940, 880, 830, 770, 720, 670].map((x) => trilha(x, -1)).join("")}${colunas}
     <rect x='0' y='1396' width='1000' height='6' fill='#8fe8ff' filter='url(#luz)' opacity='.9'/>${chao.join("")}
     <g filter='url(#luz)'><circle cx='500' cy='640' r='6' fill='#c8f4ff'/><circle cx='500' cy='1880' r='8' fill='#c8f4ff'/></g>`,
  );
}

// Bolhas: céu lilás-azulado com bolhas de sabão furta-cor (estilo ilustrado pastel)
function bolhas() {
  const bolha = (cx, cy, R) => `
  <g>
    <circle cx='${f(cx)}' cy='${f(cy)}' r='${f(R)}' fill='url(#miolo)'/>
    <circle cx='${f(cx)}' cy='${f(cy)}' r='${f(R)}' fill='none' stroke='url(#arco)' stroke-width='${f(Math.max(2, R / 14))}' opacity='.85'/>
    <path d='M${f(cx - R * 0.7)} ${f(cy - R * 0.2)} A ${f(R * 0.75)} ${f(R * 0.75)} 0 0 1 ${f(cx - R * 0.1)} ${f(cy - R * 0.72)}' stroke='#fff8ec' stroke-width='${f(Math.max(2, R / 9))}' stroke-linecap='round' fill='none' opacity='.9'/>
    <circle cx='${f(cx + R * 0.45)} ' cy='${f(cy + R * 0.42)}' r='${f(R * 0.07)}' fill='#fff8ec' opacity='.7'/>
  </g>`;
  const grandes = [[180, 120, 230], [760, 420, 190], [90, 960, 150], [880, 1180, 260], [300, 1700, 210], [820, 1900, 140], [520, 980, 70]];
  const pequenas = Array.from({ length: 45 }, () => [r(0, 1000), r(0, 2000), r(8, 40)]);
  return svg(
    lin("ceu", [[0, "#8fa5ec"], [0.5, "#a6b6f2"], [1, "#c0c9f6"]]) +
      rad("miolo", [[0.55, "#ffffff", 0], [0.85, "#f7c6e8", 0.35], [1, "#fff3c8", 0.55]]) +
      lin("arco", [[0, "#ffd1ee"], [0.3, "#fff1b8"], [0.6, "#c9b6ff"], [1, "#a8e6ff"]], 0, 0, 1, 1) + blur("b20", 20),
    `<rect width='1000' height='2000' fill='url(#ceu)'/><g filter='url(#b20)'>${pontos(14, ["#ffd8f2", "#fff1c8"], 40, 120, 0.25, 0.5)}</g>
     ${pequenas.map(([x, y, R]) => bolha(x, y, R)).join("")}${grandes.map(([x, y, R]) => bolha(x, y, R)).join("")}`,
  );
}

// ===================== ROXO =====================

// Universo: nebulosa roxa em nuvens, planeta com anel, estrelas com brilho em cruz
function universo() {
  const nuvem = (cx, cy, larg, cores) => Array.from({ length: 16 }, () => `<circle cx='${f(cx + r(-larg, larg))}' cy='${f(cy + r(-larg * 0.35, larg * 0.35))}' r='${f(r(50, 130))}' fill='${escolher(cores)}' opacity='${f(r(0.35, 0.75) * 100) / 100}'/>`).join("");
  const estrelaCruz = (x, y, s) => `<g filter='url(#luz)'><path d='M${f(x)} ${f(y - s * 4)} L${f(x + s * 0.25)} ${f(y)} L${f(x)} ${f(y + s * 4)} L${f(x - s * 0.25)} ${f(y)} Z M${f(x - s * 4)} ${f(y)} L${f(x)} ${f(y + s * 0.25)} L${f(x + s * 4)} ${f(y)} L${f(x)} ${f(y - s * 0.25)} Z' fill='#fff'/><circle cx='${f(x)}' cy='${f(y)}' r='${f(s * 0.9)}' fill='#fff'/></g>`;
  return svg(
    lin("espaco", [[0, "#1c0838"], [0.5, "#2a0b52"], [1, "#160630"]]) + blur("b30", 32) + brilho("luz", 3) +
      rad("planeta", [[0, "#e7c8ff"], [0.45, "#a45ee8"], [0.85, "#5a1fa0"], [1, "#2e0d5e"]], 0.35, 0.3, 0.8) +
      rad("lua1", [[0, "#d6b0ff"], [1, "#4a1a86"]], 0.35, 0.3, 0.8),
    `<rect width='1000' height='2000' fill='url(#espaco)'/>
     <g filter='url(#b30)'>${nuvem(820, 250, 260, ["#9d4edd", "#c77dff", "#7b2cbf"])}${nuvem(150, 900, 280, ["#c77dff", "#e0aaff", "#9d4edd"])}${nuvem(800, 1300, 300, ["#9d4edd", "#ff7ad9", "#7b2cbf"])}${nuvem(200, 1850, 300, ["#c77dff", "#9d4edd", "#e0aaff"])}</g>
     ${pontos(220, ["#ffffff", "#f0dcff"], 0.5, 1.8, 0.3, 1)}
     ${estrelaCruz(620, 330, 9)}${estrelaCruz(120, 640, 5)}${estrelaCruz(860, 860, 6)}${estrelaCruz(300, 1240, 5)}${estrelaCruz(700, 1760, 7)}
     <circle cx='190' cy='260' r='90' fill='url(#lua1)'/><circle cx='430' cy='330' r='26' fill='url(#lua1)'/>
     <ellipse cx='700' cy='1480' rx='360' ry='70' fill='none' stroke='#f0dcff' stroke-width='10' opacity='.35' transform='rotate(-16 700 1480)'/>
     <circle cx='700' cy='1480' r='200' fill='url(#planeta)'/>
     <path d='M360 1560 A 360 70 0 0 0 1040 1400' stroke='#f5e6ff' stroke-width='8' fill='none' opacity='.7' transform='rotate(-16 700 1480)'/>`,
  );
}

// Gatinho: gato branco dormindo num tecido lilás (estilo recortado, em camadas de tons)
function gatinho() {
  const dobras = Array.from({ length: 14 }, (_, i) => {
    const y = r(-100, 2000), x = r(-200, 900);
    return `<path d='M${f(x)} ${f(y)} C ${f(x + 200)} ${f(y - 120)}, ${f(x + 420)} ${f(y + 60)}, ${f(x + 640)} ${f(y - 40)} L${f(x + 600)} ${f(y + 160)} C ${f(x + 400)} ${f(y + 220)}, ${f(x + 200)} ${f(y + 120)}, ${f(x - 20)} ${f(y + 200)} Z' fill='${["#b9a2e0", "#a68bd6", "#c8b4ea", "#9a7ccc", "#d6c6f1"][i % 5]}' opacity='.85'/>`;
  }).join("");
  return svg(
    lin("tecido", [[0, "#c3aee8"], [1, "#a98fd9"]]),
    `<rect width='1000' height='2000' fill='url(#tecido)'/>${dobras}
     <g transform='translate(520 1380) rotate(-18)'>
       <path d='M-380 220 C -400 40, -200 -60, 40 -40 C 260 -20, 380 120, 340 300 C 200 360, -200 360, -380 220 Z' fill='#f4effb'/>
       <path d='M-300 200 C -260 120, -140 80, -40 100 C -120 160, -200 200, -300 200 Z' fill='#e2d8f2'/>
       <path d='M120 60 C 200 40, 260 120, 250 220 C 220 160, 180 110, 120 60 Z' fill='#e2d8f2'/>
       <path d='M-200 -60 C -230 -230, -40 -320, 110 -260 C 230 -210, 250 -60, 160 0 C 60 60, -150 50, -200 -60 Z' fill='#fbf8ff'/>
       <path d='M-170 -170 L-210 -330 L-90 -250 Z' fill='#fbf8ff'/><path d='M-168 -200 L-192 -300 L-118 -250 Z' fill='#f2c3dc'/>
       <path d='M80 -270 L150 -400 L180 -230 Z' fill='#fbf8ff'/><path d='M100 -270 L148 -360 L164 -248 Z' fill='#f2c3dc'/>
       <path d='M-110 -150 Q-80 -130 -50 -150' stroke='#8a74a8' stroke-width='6' fill='none' stroke-linecap='round'/>
       <path d='M30 -160 Q60 -140 90 -160' stroke='#8a74a8' stroke-width='6' fill='none' stroke-linecap='round'/>
       <path d='M-30 -110 L-12 -96 L6 -110 Z' fill='#e9a6c6'/><path d='M-12 -96 Q-30 -76 -50 -84 M-12 -96 Q6 -76 26 -84' stroke='#b08aa8' stroke-width='3.5' fill='none'/>
       <path d='M-160 -100 L-280 -120 M-160 -86 L-270 -76 M40 -100 L170 -130 M40 -86 L160 -70' stroke='#d6cce4' stroke-width='2.5'/>
       <path d='M150 -20 C 250 -60, 330 0, 310 80 C 280 40, 230 20, 160 30 Z' fill='#fbf8ff'/>
       <path d='M-260 -10 C -320 40, -300 120, -240 120 C -250 60, -230 20, -190 0 Z' fill='#fbf8ff'/>
     </g>`,
  );
}

// ===================== ROSA =====================

// Glitter: brilhos rosa e dourados, luzes desfocadas (aprovado)
function glitter() {
  const estrelas = Array.from({ length: 28 }, () => faisca(r(0, 1000), r(0, 2000), r(5, 16), rnd() > 0.5 ? "#ffd6f5" : "#ffe7a3")).join("");
  return svg(
    lin("fundo", [[0, "#3a0a2e"], [0.5, "#24061d"], [1, "#12030e"]]) + rad("luz", [[0, "#ff4ed8", 0.35], [1, "#ff4ed8", 0]], 0.3, 0.2, 0.6) + blur("b14", 14),
    `<rect width='1000' height='2000' fill='url(#fundo)'/><rect width='1000' height='2000' fill='url(#luz)'/>
     <g filter='url(#b14)'>${pontos(16, ["#ff7ad9"], 18, 46, 0.2, 0.5)}${pontos(8, ["#ffd36e"], 14, 34, 0.15, 0.35)}</g>
     ${pontos(260, ["#ffb8ec"], 0.6, 2.2, 0.35, 1)}${pontos(90, ["#ffe08a"], 0.6, 1.8, 0.4, 1)}${estrelas}`,
  );
}

// Boneca: parede rosa com coração de neon, cartões presos, foto de coqueiros, óculos e bolsa de cetim
function boneca() {
  const cartao = (x, y, w, h, rot, cor, conteudo) =>
    `<g transform='translate(${x} ${y}) rotate(${rot})'><rect x='6' y='8' width='${w}' height='${h}' fill='#b34a78' opacity='.18'/><rect width='${w}' height='${h}' fill='${cor}'/>${conteudo}<circle cx='${w / 2}' cy='10' r='9' fill='#f06aa4'/><circle cx='${w / 2 - 2}' cy='8' r='3' fill='#fff' opacity='.7'/></g>`;
  // estilo pode trocar a cor e o alinhamento (sem repetir atributo: o SVG não aceita)
  const texto = (x, y, t, tam, estilo = "") => `<text x='${x}' y='${y}' font-family='Georgia, serif' font-size='${tam}'${/fill=/.test(estilo) ? "" : " fill='#d6336c'"}${/text-anchor=/.test(estilo) ? "" : " text-anchor='middle'"} ${estilo}>${t}</text>`;
  const coqueiro = (x, y, s) => `<g transform='translate(${x} ${y}) scale(${s})' stroke='#c2185b' fill='none' stroke-width='4' opacity='.75'><path d='M0 0 C 6 -60, 10 -120, 20 -170'/>${[-160, -120, -60, -20, 20].map((a) => `<path d='M20 -170 q${f(Math.cos((a * Math.PI) / 180) * 50)} ${f(Math.sin((a * Math.PI) / 180) * 30 - 10)} ${f(Math.cos((a * Math.PI) / 180) * 90)} ${f(Math.sin((a * Math.PI) / 180) * 50 + 30)}'/>`).join("")}</g>`;
  return svg(
    lin("parede", [[0, "#f7b8cf"], [1, "#efa0bf"]]) + brilho("neon", 6) + lin("cetim", [[0, "#ffd3e4"], [0.5, "#f59cbf"], [1, "#e0779f"]], 0, 0, 1, 1) + lin("foto", [[0, "#f6a5c4"], [1, "#e0608f"]]),
    `<rect width='1000' height='2000' fill='url(#parede)'/>
     <g filter='url(#neon)'><path d='M250 520 C 40 380, 60 150, 220 150 C 290 150, 330 200, 340 240 C 350 200, 390 150, 460 150 C 620 150, 640 380, 430 520 L 340 590 Z' fill='none' stroke='#ffe3f0' stroke-width='12' stroke-linejoin='round'/></g>
     ${cartao(620, 150, 280, 340, 3, "#fbe1ea", texto(140, 160, "coisas boas", 30) + texto(140, 200, "levam tempo", 30) + `<path d='M100 250 H180' stroke='#d6336c' stroke-width='2'/>`)}
     ${cartao(120, 760, 300, 380, -2, "#f9d2e0", texto(150, 190, "você é", 38, "font-style='italic'") + texto(150, 240, "diferente", 38, "font-style='italic'"))}
     ${cartao(520, 640, 300, 360, 4, "url(#foto)", coqueiro(90, 330, 1) + coqueiro(180, 340, 0.8) + coqueiro(240, 330, 0.9))}
     ${cartao(560, 1100, 260, 230, -3, "#f9cfe0", texto(130, 90, "ROSA É MEU", 28, "font-weight='bold'") + texto(130, 130, "SUPERPODER", 28, "font-weight='bold'"))}
     ${cartao(80, 1260, 220, 290, 2, "#ffffff", `<rect x='16' y='16' width='188' height='180' fill='#e8608f'/>` + texto(70, 240, "ROSA DOCE", 18, "font-weight='bold' fill='#7a2a4a' text-anchor='start'"))}
     <path d='M560 1500 C 520 1640, 560 1820, 700 1880 C 820 1930, 960 1880, 990 1760 C 1020 1620, 960 1520, 860 1480 C 760 1440, 600 1440, 560 1500 Z' fill='url(#cetim)'/>
     <path d='M640 1520 C 680 1440, 820 1430, 880 1490' stroke='#e0779f' stroke-width='14' fill='none'/>
     <path d='M600 1640 C 700 1600, 860 1620, 960 1700 M620 1760 C 720 1720, 860 1740, 940 1800' stroke='#fff0f6' stroke-width='6' fill='none' opacity='.6'/>
     <g transform='translate(130 1760) rotate(-8)'><path d='M0 0 C -10 -50, 90 -60, 120 -30 C 140 0, 110 50, 60 50 C 20 50, 4 30, 0 0 Z M160 -30 C 190 -60, 290 -50, 280 0 C 276 30, 260 50, 220 50 C 170 50, 140 0, 160 -30 Z' fill='#3a1020'/><path d='M120 -20 Q140 -40 160 -20' stroke='#f06aa4' stroke-width='12' fill='none'/><path d='M-10 -10 Q-40 -60 -60 -40 M290 -10 Q320 -60 340 -40' stroke='#f06aa4' stroke-width='12' fill='none'/></g>
     <g filter='url(#neon)'>${Array.from({ length: 7 }, () => `<path d='M0 0' />`).join("")}${[[80, 260], [520, 120], [930, 560], [460, 1190], [920, 1380], [60, 1680]].map(([x, y]) => faisca(x, y, 16, "#ffffff", 0.9)).join("")}</g>`,
  );
}

module.exports = { fogo, cereja, outono, borboletas, abelha, girassol, floresta, natureza, marProfundo, eletrico, tecnologia, bolhas, universo, gatinho, glitter, boneca };
