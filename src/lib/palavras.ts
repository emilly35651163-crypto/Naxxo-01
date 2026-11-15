// Banco de palavras: cada palavra do extrato leva a uma subcategoria, e a subcategoria a uma categoria.
//   "auto posto" → Combustível → Transporte · "sptrans" → Ônibus / metrô → Transporte · "ifood" → Delivery → Alimentação fora
//
// Como as palavras batem com a descrição do banco (sem acento, maiúsculas ou pontuação):
//   - a palavra precisa estar no COMEÇO de uma palavra da descrição: "supermerc" acha "SUPERMERCADO";
//   - palavras de até 3 letras só valem inteiras ("bar" não acha "barbearia");
//   - "=palavra" só vale inteira ("=amil" não acha "Amilton");
//   - "*palavra" vale até no meio de outra ("*farma" acha "ULTRAFARMA");
//   - com espaço, vale junto ou separado ("auto posto" acha "AUTOPOSTO");
//   - "~palavra" é genérica e vale menos que nome de loja ("SMARTFIT MENSALIDADE" fica em Academia, não em Mensalidade).
// Se várias baterem, vence a MAIS COMPRIDA (a mais específica): "pao de acucar" ganha de "pao", "uber eats" ganha de "uber".
// Sem nenhuma, o item fica "para revisar" (o app nunca põe "Outros" sozinho).

import type { Tipo } from "./store";

type Grupo = { categoria: string; sub?: string; tipo?: Tipo; termos: string };

const GRUPOS: Grupo[] = [
  // ---------- Não são gasto nem ganho ----------
  {
    categoria: "Fatura do cartão",
    termos:
      "pagamento de fatura, pagto fatura, pagamento fatura, fatura cartao, pgto cartao, pagto cartao, pag fatura, pagamento cartao, pgto fatura, pagamento de cartao",
  },
  {
    categoria: "Guardar (metas)",
    termos:
      "aplicacao, =aplic, investimento cdb, compra de titulo, tesouro direto, caixinha, cofrinho, porquinho, guardado, rende facil, aplicacao rdb",
  },
  { categoria: "Guardar (metas)", tipo: "entrada", termos: "resgate, =resg, caixinha, cofrinho, porquinho, rende facil" },

  // ---------- Banco ----------
  { categoria: "Impostos e taxas", sub: "IOF", termos: "iof" },
  {
    categoria: "Impostos e taxas",
    sub: "Tarifas bancárias",
    termos: "tar, tarifa, cesta de servicos, pacote de servicos, anuidade, taxa de manutencao",
  },
  { categoria: "Impostos e taxas", sub: "Imposto de renda", termos: "receita federal, darf, imposto de renda, irpf" },
  { categoria: "Impostos e taxas", sub: "Taxas de cartório", termos: "cartorio, tabeliao, tabelionato" },
  { categoria: "Dívidas e juros", sub: "Juros", termos: "juros, encargos, =mora" },
  { categoria: "Dívidas e juros", sub: "Multa por atraso", termos: "multa por atraso" },
  { categoria: "Dívidas e juros", sub: "Cheque especial", termos: "cheque especial, limite da conta" },
  { categoria: "Dívidas e juros", sub: "Empréstimo", termos: "emprestimo, consignado, financiamento pessoal, parc emprest" },
  { categoria: "Dívidas e juros", sub: "Parcelamento de fatura", termos: "parcelamento de fatura, parcelamento fatura" },
  { categoria: "Saque", sub: "Dinheiro em espécie", termos: "saque, saq, banco24horas, banco 24 horas" },
  {
    categoria: "Trabalho",
    sub: "MEI / impostos do trabalho",
    termos: "=das mei, das simples, pgmei, pgdas, simples nacional, mei",
  },

  // ---------- Entradas ----------
  { categoria: "Salário", sub: "Adiantamento", tipo: "entrada", termos: "adiantamento, vale salarial" },
  { categoria: "Salário", sub: "13º", tipo: "entrada", termos: "13o, decimo terceiro, 13 salario" },
  { categoria: "Salário", sub: "Férias", tipo: "entrada", termos: "=ferias" },
  { categoria: "Salário", sub: "Hora extra", tipo: "entrada", termos: "hora extra, horas extras" },
  {
    categoria: "Salário",
    sub: "PLR / bônus",
    tipo: "entrada",
    termos: "plr, participacao nos lucros, bonus, bonificacao",
  },
  {
    categoria: "Salário",
    sub: "Salário",
    tipo: "entrada",
    termos: "salario, folha, pagto sal, proventos, remuneracao, vencimentos",
  },
  { categoria: "Benefícios", sub: "Vale-refeição", tipo: "entrada", termos: "vale refeicao, vr, refeicao" },
  { categoria: "Benefícios", sub: "Vale-alimentação", tipo: "entrada", termos: "vale alimentacao, va, alimentacao" },
  { categoria: "Benefícios", sub: "Vale-transporte", tipo: "entrada", termos: "vale transporte, vt" },
  {
    categoria: "Benefícios",
    sub: "Auxílio do governo",
    tipo: "entrada",
    termos: "bolsa familia, auxilio, inss, beneficio social, seguro desemprego, fgts, pis, abono",
  },
  {
    categoria: "Investimentos",
    sub: "Rendimento",
    tipo: "entrada",
    termos: "rendimento, rend pago, remuneracao da conta",
  },
  { categoria: "Investimentos", sub: "Dividendos", tipo: "entrada", termos: "dividendo, jcp, juros sobre capital" },
  { categoria: "Reembolso e estorno", sub: "Cashback", tipo: "entrada", termos: "cashback, cash back" },
  {
    categoria: "Reembolso e estorno",
    sub: "Estorno de compra",
    tipo: "entrada",
    termos: "estorno, devolucao, chargeback, cancelamento",
  },
  { categoria: "Reembolso e estorno", sub: "Reembolso", tipo: "entrada", termos: "reembolso, ressarcimento" },
  {
    categoria: "Benefícios",
    sub: "Bolsa de estudos",
    tipo: "entrada",
    termos: "bolsa, cnpq, capes, fapesp, universidade, faculdade, iniciacao cientifica",
  },
  {
    categoria: "Trabalho por conta",
    sub: "Vendas",
    tipo: "entrada",
    termos: "venda, pagseguro, pagbank, sumup, =stone, cielo, getnet, infinitepay, ~mercado pago, ~mercadopago",
  },

  // ---------- Casa ----------
  { categoria: "Moradia", sub: "Aluguel", termos: "aluguel, imobiliaria, quinto andar, =loft, housi" },
  { categoria: "Moradia", sub: "Condomínio", termos: "condominio, =cond" },
  { categoria: "Moradia", sub: "IPTU", termos: "iptu" },
  { categoria: "Moradia", sub: "Diarista / faxina", termos: "diarista, faxina, parafuzo" },
  {
    categoria: "Moradia",
    sub: "Móveis e decoração",
    termos: "tok stok, =etna, mobly, madeira madeira, lojas cem, casas bahia moveis, =ikea",
  },
  {
    categoria: "Moradia",
    sub: "Manutenção e reparos",
    termos:
      "leroy, telhanorte, material de construcao, ferragens, eletricista, encanador, obramax, c c casa e construcao, =cec, sodimac",
  },
  {
    categoria: "Contas da casa",
    sub: "Luz",
    termos:
      "=enel, energia, luz, cemig, copel, light s, light servicos, celesc, coelba, celpe, cosern, equatorial, neoenergia, cpfl, elektro, edp, energisa, rge",
  },
  {
    categoria: "Contas da casa",
    sub: "Água",
    termos:
      "sabesp, =agua, saneamento, copasa, cedae, compesa, embasa, sanepar, =casan, aguas de, corsan, caesb, cagece, aegea, iguá, brk ambiental",
  },
  {
    categoria: "Contas da casa",
    sub: "Gás",
    termos: "gas, comgas, ultragaz, liquigas, supergasbras, naturgy, copagaz, nacional gas",
  },
  {
    categoria: "Contas da casa",
    sub: "Internet",
    termos: "internet, fibra, net servicos, brisanet, algar, desktop sa, vero internet, giga mais, unifique, ligga",
  },
  { categoria: "Contas da casa", sub: "TV a cabo", termos: "=sky, claro tv, vivo tv" },
  {
    categoria: "Contas da casa",
    sub: "Celular",
    termos: "=claro, =vivo, tim, oi, telefon, recarga celular, recarga de celular, =nextel, surf telecom, vivo easy",
  },

  // ---------- Comida ----------
  {
    categoria: "Mercado",
    sub: "Atacarejo",
    termos:
      "*atacad, assai, atacarejo, makro, tenda atacado, sams club, roldao, max atacadista, fort atacadista, spani, mart minas, giga atacado, atakarejo, =tenda",
  },
  { categoria: "Mercado", sub: "Padaria", termos: "padaria, panificadora, pao, confeitaria, panificacao" },
  { categoria: "Mercado", sub: "Açougue", termos: "acougue, casa de carnes, frigorifico, boutique de carnes" },
  { categoria: "Mercado", sub: "Hortifrúti", termos: "hortifruti, sacolao, quitanda, feira, verdurao, frutaria, oba hortifruti" },
  {
    categoria: "Mercado",
    sub: "Compra avulsa",
    termos:
      "*mercado, *supermerc, mercadinho, mercearia, minimercado, minimerc, carrefour, =extra, pao de acucar, minuto pao de acucar, dia, dia brasil, oxxo, hirota, st marche, savegnago, zaffari, guanabara, prezunic, muffato, angeloni, bompreco, =nacional, mercantil rodrigues, sonda, condor, festval, comper, =epa, supernosso, verdemar, supermercados mundial, sendas, grupo mateus, conveniencia, lojas de conveniencia, gbarbosa, hiperbompreco, shibata, tauste, covabra, dalben, enxuto, joanin, =coop, daki, =big, hortifruti natural da terra, natural da terra, cometa supermercados",
  },
  {
    categoria: "Alimentação fora",
    sub: "Delivery",
    termos: "ifood, ifd, rappi, aiqfome, ze delivery, uber eats, 99food, 99 food, keeta, james delivery",
  },
  {
    categoria: "Alimentação fora",
    sub: "Café",
    termos: "cafe, cafeteria, starbucks, coffee, frans cafe, havanna, cafe cultura, the coffee, sofa cafe",
  },
  { categoria: "Alimentação fora", sub: "Bar", termos: "bar, boteco, cervejaria, choperia, pub, adega" },
  {
    categoria: "Alimentação fora",
    sub: "Lanche",
    termos:
      "*lanch, *burger, mcdonald, mc donald, arcos dourados, bk, burger king, zamp, habib, subway, *pizz, esfiha, pastel, sorvete, acai, doceria, kfc, popeyes, giraffas, bobs, spoleto, china in box, domino, cacau show, kopenhagen, brasil cacau, chiquinho sorvetes, oakberry, ragazzo, casa do pao de queijo, bacio di latte, lugano, milkshake, milk shake, dunkin, cinnabon, =viena",
  },
  {
    categoria: "Alimentação fora",
    sub: "Restaurante",
    termos:
      "~restaur, churrascaria, cantina, sushi, temaki, bistro, outback, madero, coco bambu, =food, grill, fogo de chao, paris 6, applebees, abbraccio, olive garden, jappa, gendai, divino fogao, montana grill, pizza hut, frango assado",
  },
  { categoria: "Alimentação fora", sub: "Marmita", termos: "marmita, marmitex, quentinha, self service" },

  // ---------- Transporte ----------
  {
    categoria: "Transporte",
    sub: "Combustível",
    termos:
      "posto, auto posto, combust, shell, ipiranga, petrobras, br mania, raizen, gasolina, etanol, =ale combustiveis, vibra, abastece ai, sim rede de postos, rede graal, postos",
  },
  {
    categoria: "Transporte",
    sub: "App de corrida",
    termos:
      "=uber, ubr, uber trip, 99 app, 99pop, 99 pop, 99 tecnologia, 99 taxi, indriver, indrive, cabify, lady driver, =wappa",
  },
  {
    categoria: "Transporte",
    sub: "Estacionamento",
    termos: "estacion, estapar, zona azul, parking, indigo, multipark, allpark, park, =zul",
  },
  {
    categoria: "Transporte",
    sub: "Pedágio",
    termos: "pedagio, sem parar, conectcar, veloe, move mais, taggy, c6 tag, =ccr, arteris, ecovias, autoban, ecorodovias",
  },
  {
    categoria: "Transporte",
    sub: "Ônibus / metrô",
    termos:
      "~metro, onibus, bilhete unico, bilhete, sptrans, recarga bom, cptm, riocard, cartao bom, brt, rodoviaria, metrorio, supervia, via quatro, viamobilidade, metrofor, cbtu, bhbus, urbs, =jae, buser, clickbus, cometa, itapemirim, aguia branca, autopass, top metro, vem pernambuco, cartao transporte",
  },
  { categoria: "Transporte", sub: "IPVA / licenciamento", termos: "ipva, licenciamento, detran, gringo, zul digital" },
  {
    categoria: "Transporte",
    sub: "Manutenção do carro",
    termos:
      "oficina, auto center, autopecas, auto pecas, pneu, mecanica, lava rapido, lava jato, troca de oleo, pit stop, car wash, dpaschoal, pneustore",
  },
  { categoria: "Transporte", sub: "Seguro do carro", termos: "seguro auto, seguro do carro, seguro veicular" },
  { categoria: "Transporte", sub: "Multa", termos: "multa de transito, infracao" },
  { categoria: "Transporte", sub: "Financiamento do carro", termos: "financiamento veiculo, financ veiculo, cdc veiculo" },

  // ---------- Saúde e cuidados ----------
  {
    categoria: "Saúde",
    sub: "Farmácia",
    termos:
      "*farma, drogaria, droga, drogasil, =raia, droga raia, raia drogasil, rd saude, pague menos, panvel, nissei, drogao, ultrafarma, extrafarma, drogal, farmais, poupafarma, dpsp, sao joao farmacias, farmacia",
  },
  {
    categoria: "Saúde",
    sub: "Plano de saúde",
    termos:
      "unimed, =amil, bradesco saude, sulamerica, hapvida, notredame, plano de saude, porto saude, prevent senior, golden cross, care plus, =alice, sami saude",
  },
  { categoria: "Saúde", sub: "Dentista", termos: "dental, odonto, dentista, sorridents, oral sin" },
  {
    categoria: "Saúde",
    sub: "Exames",
    termos: "laborat, fleury, =dasa, delboni, lavoisier, hermes pardini, exame, sabin, a mais medicina, alta diagnosticos, labi",
  },
  { categoria: "Saúde", sub: "Terapia", termos: "psicolog, terapia, terapeuta, fisioterap" },
  { categoria: "Saúde", sub: "Ótica", termos: "otica, oculos, chilli beans, ray ban, carol otica" },
  { categoria: "Saúde", sub: "Consulta", termos: "hospital, clinica, medic, consulta, dr consulta, doutor consulta" },
  {
    categoria: "Cuidados pessoais",
    sub: "Academia",
    termos:
      "academia, smart fit, smartfit, bluefit, bodytech, selfit, crossfit, gympass, wellhub, totalpass, pilates, bio ritmo, panobianco, skyfit, pratique fitness, just fit",
  },
  { categoria: "Cuidados pessoais", sub: "Cabelo", termos: "cabelei, salao, barbearia, barber, cabelo" },
  { categoria: "Cuidados pessoais", sub: "Unha", termos: "manicure, esmalteria, nail" },
  {
    categoria: "Cuidados pessoais",
    sub: "Cosméticos",
    termos:
      "boticario, =natura, sephora, avon, eudora, beleza na web, epoca cosmeticos, quem disse berenice, the beauty box, beauty box, jequiti, wepink, sallve, principia, creamy, mac cosmetics, loccitane, granado",
  },
  {
    categoria: "Cuidados pessoais",
    sub: "Estética",
    termos: "estetica, depilacao, spa, massagem, espacolaser, espaco laser, maria pele",
  },

  // ---------- Assinaturas ----------
  {
    categoria: "Assinaturas",
    sub: "Streaming",
    termos:
      "netflix, disney, hbo, max com, prime video, globoplay, paramount, crunchyroll, =mubi, apple tv, telecine, star plus, dazn, premiere, =vix, pluto tv",
  },
  { categoria: "Assinaturas", sub: "Música", termos: "spotify, deezer, youtube music, apple music, =tidal, amazon music" },
  {
    categoria: "Assinaturas",
    sub: "IA",
    termos: "chatgpt, openai, anthropic, =claude, claude ai, gemini, midjourney, perplexity",
  },
  {
    categoria: "Assinaturas",
    sub: "Apps e nuvem",
    termos:
      "icloud, apple com, google one, google storage, dropbox, microsoft, office 365, =canva, adobe, notion, youtube premium, amazon prime, google play, app store, uber one, ifood clube, linkedin, duolingo, tinder, bumble, github, meli mais, google, google brasil pagamentos",
  },
  {
    categoria: "Assinaturas",
    sub: "Clube / revista",
    termos: "revista, jornal, folha de s paulo, estadao, o globo, clube de assinatura, tag livros, wine",
  },

  // ---------- Educação, filhos, pets ----------
  {
    categoria: "Educação",
    sub: "Mensalidade",
    termos:
      "escola, colegio, faculdade, universidade, ~mensalidade, estacio, unip, anhanguera, uninove, cruzeiro do sul, unopar, puc, mackenzie, fmu, senac, senai",
  },
  {
    categoria: "Educação",
    sub: "Curso",
    termos:
      "curso, udemy, alura, coursera, hotmart, eduzz, kiwify, idiomas, kumon, wizard, ccaa, =fisk, cultura inglesa, open english, descomplica, domestika",
  },
  { categoria: "Educação", sub: "Livros", termos: "livraria, livro, estante virtual, kindle, saraiva, livraria leitura" },
  { categoria: "Educação", sub: "Material escolar", termos: "papelaria, kalunga, material escolar" },
  { categoria: "Pets", sub: "Ração", termos: "racao" },
  { categoria: "Pets", sub: "Veterinário", termos: "veterin" },
  { categoria: "Pets", sub: "Banho e tosa", termos: "banho e tosa" },
  { categoria: "Pets", sub: "Petshop", termos: "petz, cobasi, petlove, pet shop, petshop, pet, petsupermarket" },
  { categoria: "Filhos", sub: "Fraldas e higiene", termos: "fralda, pampers, huggies" },
  { categoria: "Filhos", sub: "Brinquedos", termos: "ri happy, pb kids, brinquedo" },

  // ---------- Lazer ----------
  {
    categoria: "Lazer",
    sub: "Cinema / shows",
    termos:
      "cinema, cinemark, kinoplex, ingresso, sympla, eventim, =show, ticketmaster, tickets for fun, =uci, cinepolis, playarte, cinesystem, teatro, zig tecnologia, =zig",
  },
  {
    categoria: "Lazer",
    sub: "Jogos",
    termos: "steam, playstation, xbox, nintendo, epic games, riot, garena, blizzard, roblox, valve",
  },
  { categoria: "Lazer", sub: "Passeios", termos: "hopi hari, beto carrero, wet n wild, parque, museu, zoologico, aquario" },
  { categoria: "Lazer", sub: "Hospedagem", termos: "hotel, airbnb, booking, pousada, hostel, ibis, accor, hurb" },
  {
    categoria: "Lazer",
    sub: "Viagem",
    termos:
      "latam, gol linhas, azul linhas, voeazul, decolar, 123 milhas, maxmilhas, passagem aerea, ~viagem, cvc, smiles, ~aeroporto",
  },

  // ---------- Compras ----------
  {
    categoria: "Compras",
    sub: "Lojas online",
    termos:
      "shopee, mercado livre, mercadolivre, =meli, amazon, magalu, magazine, americanas, shein, aliexpress, =temu, kabum, casas bahia, ponto frio, submarino, dafiti, zattini, elo7, enjoei, pix marketplace",
  },
  {
    categoria: "Compras",
    sub: "Roupas",
    termos:
      "renner, riachuelo, c a, cea, lojas marisa, hering, =zara, pernambucanas, lojas torra, =torra, youcom, colcci, =farm, animale, malwee, lupo, puket, track field, lojas avenida, besni, polo wear, =leader, ~moda, moda mundial",
  },
  {
    categoria: "Compras",
    sub: "Calçados",
    termos:
      "netshoes, arezzo, centauro, calcados, sapataria, nike, adidas, olympikus, havaianas, decathlon, authentic feet, artwalk, =vans, piccadilly, usaflex",
  },
  {
    categoria: "Compras",
    sub: "Eletrônicos",
    termos:
      "fast shop, apple store, samsung, xiaomi, eletron, informatica, positivo, =dell, motorola, multilaser, girafa, celulares, assistencia tecnica",
  },
  { categoria: "Compras", sub: "Casa e utilidades", termos: "=havan, daiso, utilidades, camicado, mm utilidades" },
  { categoria: "Compras", sub: "Presentes", termos: "presente, floricultura, flores online, giuliana flores" },

  // ---------- Ajuda e seguros ----------
  {
    categoria: "Doações e ajuda",
    sub: "Igreja / dízimo",
    termos: "igreja, dizimo, paroquia, assembleia de deus, congregacao",
  },
  { categoria: "Doações e ajuda", sub: "Vaquinha", termos: "vakinha, vaquinha, kickante, benfeitoria" },
  { categoria: "Doações e ajuda", sub: "Doação", termos: "doacao, ong, unicef, medicos sem fronteiras" },
  { categoria: "Seguros", sub: "Vida", termos: "seguro de vida, prudential, mag seguros, metlife" },
  {
    categoria: "Seguros",
    sub: "Outros seguros",
    termos: "seguro, seguradora, porto seguro, tokio marine, allianz, mapfre, youse",
  },
];

// Quem só intermedeia o pagamento sai da descrição antes de procurar ("MERCADOPAGO*PADARIA JOAO" → "padaria joao").
// Só para saídas: numa entrada, "mercado pago" pode ser venda.
const INTERMEDIARIOS = /(?:^| )mercado ?pago(?= |$)/g;

export const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Do jeito que o banco de palavras compara: sem acento, minúsculas, só letras e números separados por espaço */
export const normalizar = (t: string) =>
  semAcento(t)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

type Termo = { categoria: string; sub?: string; tipo: Tipo; re: RegExp; peso: number; ordem: number };

const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function montar(): Termo[] {
  const lista: Termo[] = [];
  GRUPOS.forEach((g) => {
    for (const bruto of g.termos.split(",")) {
      let t = bruto.trim();
      if (!t) continue;
      const exato = t.startsWith("=");
      const dentro = t.startsWith("*");
      const generica = t.startsWith("~");
      if (exato || dentro || generica) t = t.slice(1);
      t = normalizar(t);
      const inteira = exato || t.replace(/ /g, "").length <= 3;
      const corpo = t.split(" ").map(escapar).join(" ?");
      const re = new RegExp(`${dentro ? "" : "(?:^| )"}${corpo}${inteira ? "(?= |$)" : ""}`);
      lista.push({
        categoria: g.categoria,
        sub: g.sub,
        tipo: g.tipo ?? "saida",
        re,
        peso: generica ? t.length / 3 : t.length,
        ordem: lista.length,
      });
    }
  });
  return lista;
}

const TERMOS = montar();

/** A palavra mais específica que bate com a descrição (ou nada) */
/**
 * Só o que importa para achar a categoria: o nome de quem recebeu ou pagou. Tira o documento e o banco dessa pessoa
 * ("Pix - JOSE DA SILVA - •••.416.738-•• - PAGSEGURO INTERNET IP…" → "Pix - JOSE DA SILVA"), senão "INTERNET" vira conta de internet.
 */
const DADOS_BANCARIOS = /\s+-\s+(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|[•*]{3}\.?\d{3}\.?\d{3}-?[•*]{2}).*$|\s+ag[eê]ncia:.*$/i;

export function procurarNoBanco(descricao: string, tipo: Tipo): { categoria: string; subcategoria?: string } | undefined {
  let t = normalizar(descricao.replace(DADOS_BANCARIOS, ""));
  if (tipo === "saida") t = t.replace(INTERMEDIARIOS, " ").replace(/ +/g, " ").trim();
  let melhor: Termo | undefined;
  for (const termo of TERMOS) {
    if (termo.tipo !== tipo || !termo.re.test(t)) continue;
    if (!melhor || termo.peso > melhor.peso) melhor = termo;
  }
  return melhor && { categoria: melhor.categoria, subcategoria: melhor.sub };
}
