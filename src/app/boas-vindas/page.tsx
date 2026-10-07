"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import simbolo from "@/assets/naxxo-simbolo.png";
import { NomeNaxxo } from "@/components/Logo";
import { Campo, CampoValor } from "@/components/Campos";
import CamposFonte, {
  problemaDoRascunho,
  RASCUNHO_FONTE_VAZIO,
  rascunhoParaFonte,
  type RascunhoFonte,
} from "@/components/CamposFonte";
import {
  concluirBoasVindas,
  OBJETIVOS,
  semAcento,
  SUGESTOES_SONHOS,
  type FormaRenda,
  type Meta,
  type Objetivo,
} from "@/lib/store";
import { metaDeQuitar } from "@/lib/metas";
import { alvoDaReserva } from "@/lib/orientacoes";
import { rendaMensal } from "@/lib/renda";
import { brl, lerValor } from "@/lib/formato";
import { lerRascunhoQuitar, RASCUNHO_QUITAR_VAZIO, type RascunhoQuitar } from "@/components/CamposQuitar";

type Etapa = "inicio" | "objetivos" | "situacao" | "renda" | "sonhos" | "reserva" | "pronto";
type Reserva = "tenho" | "quero" | "nao";
type RascunhoSonho = {
  id: number;
  tipo: "juntar" | "quitar";
  nome: string;
  icone: string;
  // juntar
  alvo: string;
  guardado: string;
  prazo: string;
  // quitar
  quitar: RascunhoQuitar;
  noCartao: boolean; // está no cartão de crédito? Então não vira trilha: vai para a fatura (aba Contas)
};

const OPCOES_RESERVA: { id: Reserva; icone: string; nome: string; descricao: string }[] = [
  { id: "tenho", icone: "🛟", nome: "Já tenho", descricao: "Tenho um dinheiro guardado para imprevistos" },
  { id: "quero", icone: "🌱", nome: "Quero ter", descricao: "Ainda não tenho, mas quero começar" },
  { id: "nao", icone: "⏳", nome: "Agora não", descricao: "Prefiro pensar nisso depois" },
];

// Como é a renda hoje: cada escolha já cria uma fonte com o jeito certo de receber
type Situacao = "clt" | "freela" | "negocio" | "aposentadoria" | "bolsa" | "familia" | "sem-renda";
const SITUACOES: {
  id: Situacao;
  icone: string;
  nome: string;
  descricao: string;
  fonte?: { nome: string; forma: FormaRenda; clt?: boolean };
}[] = [
  {
    id: "clt",
    icone: "💼",
    nome: "Carteira assinada",
    descricao: "Salário todo mês (CLT)",
    fonte: { nome: "Salário", forma: "fixo", clt: true },
  },
  {
    id: "freela",
    icone: "💻",
    nome: "Autônomo / freela",
    descricao: "Recebo por serviço ou por hora",
    fonte: { nome: "Freelas", forma: "servico" },
  },
  {
    id: "negocio",
    icone: "🏷️",
    nome: "Vendas / meu negócio",
    descricao: "O valor muda todo mês",
    fonte: { nome: "Vendas", forma: "outro" },
  },
  {
    id: "aposentadoria",
    icone: "🧓",
    nome: "Aposentadoria / pensão",
    descricao: "Benefício do INSS ou pensão",
    fonte: { nome: "Aposentadoria / pensão", forma: "fixo" },
  },
  {
    id: "bolsa",
    icone: "🎓",
    nome: "Bolsa / estágio",
    descricao: "Valor fixo por um tempo",
    fonte: { nome: "Bolsa / estágio", forma: "fixo" },
  },
  {
    id: "familia",
    icone: "🤝",
    nome: "Ajuda da família",
    descricao: "Mesada, pensão alimentícia…",
    fonte: { nome: "Ajuda da família", forma: "fixo" },
  },
  { id: "sem-renda", icone: "🌙", nome: "Estou sem renda agora", descricao: "Desempregada(o), entre trabalhos…" },
];

let proximoIdSonho = 1;

export default function BoasVindas() {
  const router = useRouter();
  const [etapa, setEtapa] = useState<Etapa>("inicio");
  const [erro, setErro] = useState<{ texto: string; alvo?: string } | null>(null);
  const novoCartao = useRef<HTMLDivElement>(null);
  const [rolarPara, setRolarPara] = useState<number | null>(null);

  const [nome, setNome] = useState("");
  const [objetivos, setObjetivos] = useState<Objetivo[]>([]);
  const [objetivoOutro, setObjetivoOutro] = useState("");
  const [situacoes, setSituacoes] = useState<Situacao[]>([]);
  const [fontes, setFontes] = useState<RascunhoFonte[]>([]);
  const [sonhos, setSonhos] = useState<RascunhoSonho[]>([]);
  const [reserva, setReserva] = useState<Reserva | null>(null);
  const [reservaGuardado, setReservaGuardado] = useState("");
  const [reservaAlvo, setReservaAlvo] = useState("");

  // A etapa "sonhos" só aparece para quem quer juntar dinheiro para algo ou quitar dívidas
  const querJuntar = objetivos.includes("juntar");
  const semRenda = situacoes.length === 1 && situacoes[0] === "sem-renda";
  const etapas: Etapa[] = [
    "inicio",
    "objetivos",
    "situacao",
    ...(semRenda ? [] : (["renda"] as const)),
    ...(querJuntar ? (["sonhos"] as const) : []),
    "reserva",
    "pronto",
  ];
  const indice = etapas.indexOf(etapa);

  // Só os sonhos dos objetivos que continuam marcados (desmarcou "Realizar um sonho"? os sonhos não são salvos)
  const sonhosValidos = sonhos.filter((s) => s.tipo === "juntar" && querJuntar);
  const fontesValidas = fontes.map(rascunhoParaFonte).filter((f) => f !== null);
  const rendaDinheiro = fontesValidas.reduce((total, f) => total + rendaMensal({ ...f, id: "" }, true), 0);
  const rendaVales = fontesValidas.reduce(
    (total, f) => total + rendaMensal({ ...f, id: "" }) - rendaMensal({ ...f, id: "" }, true),
    0,
  );
  // A sugestão da reserva usa a mesma regra da Trilha (aqui ainda sem gastos: estimativa provisória)
  const parcelasDeQuitar = sonhosValidos
    .filter((s) => s.tipo === "quitar" && !s.noCartao)
    .map((s) => ({ tipo: "quitar" as const, parcela: lerRascunhoQuitar(s.quitar)?.parcela }));
  const sugestao = alvoDaReserva(
    fontesValidas.map((f) => ({ ...f, id: "" })),
    [],
    parcelasDeQuitar,
  );

  // Rola até o cartão que acabou de ser adicionado (fica lá embaixo)
  useEffect(() => {
    if (rolarPara !== null) novoCartao.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [rolarPara]);

  function irPara(nova: Etapa) {
    setErro(null);
    setEtapa(nova);
    window.scrollTo({ top: 0 });
  }

  const voltar = () => irPara(etapas[indice - 1]);

  /** "Pular" / "Fazer depois": nada pela metade fica salvo. */
  function pular() {
    if (etapa === "renda") setFontes((atuais) => atuais.filter((f) => rascunhoParaFonte(f) !== null));
    if (etapa === "sonhos")
      setSonhos((atuais) =>
        atuais.filter((s) => (s.tipo === "juntar" ? lerValor(s.alvo) > 0 : s.noCartao || lerRascunhoQuitar(s.quitar) !== null)),
      );
    irPara(etapas[indice + 1]);
  }

  function continuar() {
    if (etapa === "objetivos" && objetivos.length === 0) return setErro({ texto: "Escolha pelo menos um objetivo." });
    if (etapa === "situacao") {
      if (situacoes.length === 0) return setErro({ texto: "Escolha como é a sua renda hoje (pode ser mais de uma)." });
      // Cria uma fonte para cada situação (as que já existem continuam)
      const novas = SITUACOES.filter((s) => situacoes.includes(s.id) && s.fonte)
        .filter((s) => !fontes.some((f) => f.nome === s.fonte!.nome))
        .map((s) => ({ ...RASCUNHO_FONTE_VAZIO, nome: s.fonte!.nome, forma: s.fonte!.forma, clt: !!s.fonte!.clt }));
      setFontes((atuais) => {
        const mantidas = atuais.filter(
          (f) => SITUACOES.some((s) => situacoes.includes(s.id) && s.fonte?.nome === f.nome) || f.nome === "",
        );
        const lista = [...mantidas, ...novas];
        return lista.length > 0 || semRenda ? lista : [RASCUNHO_FONTE_VAZIO];
      });
    }
    if (etapa === "renda") {
      for (let i = 0; i < fontes.length; i++) {
        const problema = problemaDoRascunho(fontes[i]);
        if (problema)
          return setErro({
            texto: `${fontes[i].nome || `Entrada ${i + 1}`}: ${problema} (ou toque em “Pular”)`,
            alvo: `fonte-${i}`,
          });
      }
    }
    if (etapa === "sonhos") {
      const semValor = sonhosValidos.find((s) => s.tipo === "juntar" && !(lerValor(s.alvo) > 0));
      if (semValor)
        return setErro({ texto: `Quanto custa “${semValor.nome || "seu sonho"}”? (ou remova)`, alvo: `sonho-${semValor.id}` });
      const semParcela = sonhosValidos.find((s) => s.tipo === "quitar" && !s.noCartao && !lerRascunhoQuitar(s.quitar));
      if (semParcela)
        return setErro({
          texto: semParcela.quitar.aVista
            ? `Quanto você deve em “${semParcela.nome || "dívida"}”?`
            : `Preencha a parcela e quantas são em “${semParcela.nome || "dívida"}”.`,
          alvo: `sonho-${semParcela.id}`,
        });
    }
    if (etapa === "reserva" && !reserva) return setErro({ texto: "Escolha uma das opções." });
    if (etapa === "pronto") return concluir();
    irPara(etapas[indice + 1]);
  }

  // Ao dar erro, leva até o campo que falta
  useEffect(() => {
    if (erro?.alvo) document.getElementById(erro.alvo)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [erro]);

  function alternarObjetivo(id: Objetivo) {
    setObjetivos((atuais) => (atuais.includes(id) ? atuais.filter((o) => o !== id) : [...atuais, id]));
    setErro(null);
  }

  function alternarSituacao(id: Situacao) {
    setSituacoes((atuais) => {
      if (id === "sem-renda") return atuais.includes(id) ? [] : ["sem-renda"];
      const sem = atuais.filter((s) => s !== "sem-renda");
      return sem.includes(id) ? sem.filter((s) => s !== id) : [...sem, id];
    });
    setErro(null);
  }

  /** Toca na sugestão: adiciona (e rola até ela). Tocar de novo tira (não duplica). */
  function alternarSonho(
    tipo: RascunhoSonho["tipo"],
    sugestao: { nome: string; icone: string; divida?: RascunhoQuitar["divida"] },
  ) {
    const existente = sugestao.nome && sonhos.find((s) => s.tipo === tipo && semAcento(s.nome) === semAcento(sugestao.nome));
    if (existente) {
      setSonhos((atuais) => atuais.filter((s) => s.id !== existente.id));
      return;
    }
    const id = proximoIdSonho++;
    setSonhos((atuais) => [
      ...atuais,
      {
        id,
        tipo,
        nome: sugestao.nome,
        icone: sugestao.icone,
        alvo: "",
        guardado: "",
        prazo: "",
        quitar: { ...RASCUNHO_QUITAR_VAZIO, divida: sugestao.divida ?? "parcelado", aVista: sugestao.nome === "Conta atrasada" },
        noCartao: false,
      },
    ]);
    setRolarPara(id);
    setErro(null);
  }

  const escolhido = (tipo: RascunhoSonho["tipo"], nomeSonho: string) =>
    sonhos.some((s) => s.tipo === tipo && semAcento(s.nome) === semAcento(nomeSonho));

  function mudarSonho(id: number, mudancas: Partial<RascunhoSonho>) {
    setSonhos((atuais) => atuais.map((s) => (s.id === id ? { ...s, ...mudancas } : s)));
    setErro(null);
  }

  function concluir() {
    // Só trilhas de juntar, reserva e quitar FORA do cartão (o que está no cartão vai para a fatura, na aba Contas)
    const metas: Omit<Meta, "id">[] = sonhosValidos
      .filter((s) => !s.noCartao)
      .map((s) => {
        const dados = s.tipo === "quitar" ? lerRascunhoQuitar(s.quitar) : null;
        if (dados) return metaDeQuitar({ nome: s.nome.trim() || "Dívida", icone: s.icone, ...dados });
        return {
          nome: s.nome.trim() || "Meu sonho",
          icone: s.icone,
          alvo: lerValor(s.alvo),
          guardado: lerValor(s.guardado) || 0,
          prazo: s.prazo || null,
          aporteMensal: null,
        };
      });

    if (reserva === "tenho" || reserva === "quero") {
      const guardado = lerValor(reservaGuardado) || 0;
      metas.unshift({
        nome: "Reserva de emergência",
        icone: "🛟",
        alvo: lerValor(reservaAlvo) || Math.max(sugestao.alvo, guardado),
        guardado,
        prazo: null,
        aporteMensal: null,
        reserva: true,
      });
    }

    concluirBoasVindas({
      perfil: { nome: nome.trim(), objetivos, objetivoOutro: objetivoOutro.trim() },
      fontes: fontesValidas,
      metas,
    });
    // O próximo passo é cadastrar as contas e o saldo de cada uma
    router.replace("/");
  }

  const noCartaoQuitar = sonhosValidos.filter((s) => s.tipo === "quitar" && s.noCartao);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        continuar();
      }}
      className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pb-8 pt-6"
    >
      {/* Barra de progresso */}
      <div className="mb-8 flex h-10 items-center gap-4">
        {indice > 0 && (
          <button type="button" onClick={voltar} aria-label="Voltar" className="text-3xl leading-none text-roxo hover:text-rosa">
            ‹
          </button>
        )}
        {indice > 0 && (
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={etapas.length - 1}
            aria-valuenow={indice}
            aria-label="Progresso do questionário"
          >
            <div
              className="h-full rounded-full bg-linear-to-r from-rosa via-roxo to-azul transition-[width] duration-500"
              style={{ width: `${(indice / (etapas.length - 1)) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* pb: o botão "Continuar" fica fixo embaixo e não pode cobrir o último cartão */}
      <div className="flex-1 pb-24">
        {etapa === "inicio" && (
          <div className="flex flex-col items-center pt-6 text-center">
            <Image src={simbolo} alt="" className="h-28 w-auto drop-shadow-[0_0_30px_rgb(255_78_216/0.5)]" priority />
            <NomeNaxxo className="mt-6 h-6 w-auto" />
            <h1 className="mt-10 font-display text-3xl font-bold">
              Vamos montar o <span className="gradiente-texto">seu plano</span>
            </h1>
            <p className="mt-3 text-suave">São só algumas perguntas e leva 1 minutinho. Você pode mudar tudo depois.</p>
            <div className="mt-10 w-full text-left">
              <Campo rotulo="Como podemos te chamar? (opcional)">
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome ou apelido"
                  autoComplete="given-name"
                  className="campo"
                />
              </Campo>
              <p className="mt-2 text-xs text-suave">Assim o app te cumprimenta pelo nome 💜</p>
            </div>
          </div>
        )}

        {etapa === "objetivos" && (
          <>
            <Titulo
              titulo={nome.trim() ? `${nome.trim().split(" ")[0]}, qual é o seu objetivo?` : "Qual é o seu objetivo?"}
              texto="Pode escolher mais de um. O Início vai mostrar o que importa para cada objetivo."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {OBJETIVOS.map((o) => (
                <CartaoOpcao
                  key={o.id}
                  icone={o.icone}
                  nome={o.nome}
                  descricao={o.descricao}
                  ativo={objetivos.includes(o.id)}
                  onClick={() => alternarObjetivo(o.id)}
                />
              ))}
            </div>
            {objetivos.includes("outro") && (
              <div className="mt-4">
                <Campo rotulo="Qual é o seu objetivo?">
                  <input
                    autoFocus
                    value={objetivoOutro}
                    onChange={(e) => setObjetivoOutro(e.target.value)}
                    placeholder="Escreva do seu jeito"
                    className="campo"
                  />
                </Campo>
              </div>
            )}
          </>
        )}

        {etapa === "situacao" && (
          <>
            <Titulo
              titulo="Como é a sua renda hoje?"
              texto="Pode marcar mais de uma (ex.: salário + freela). Na próxima tela você diz os valores."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {SITUACOES.map((s) => (
                <CartaoOpcao
                  key={s.id}
                  icone={s.icone}
                  nome={s.nome}
                  descricao={s.descricao}
                  ativo={situacoes.includes(s.id)}
                  onClick={() => alternarSituacao(s.id)}
                />
              ))}
            </div>
            {semRenda && (
              <p className="mt-4 rounded-2xl bg-roxo/10 px-4 py-3 text-sm text-suave">
                Tudo bem 💜 O app te ajuda a controlar o que sai e a esticar o que tem guardado. Quando voltar a entrar dinheiro,
                é só cadastrar na aba Renda.
              </p>
            )}
          </>
        )}

        {etapa === "renda" && (
          <>
            <Titulo
              titulo="O que entra?"
              texto="Salário, freelas, vendas… e os benefícios que vêm junto, como vale-transporte e vale-refeição. A conta onde cai você escolhe depois, ao cadastrar as contas."
            />
            <div className="space-y-4">
              {fontes.map((f, i) => (
                <div key={i} id={`fonte-${i}`} className={`cartao p-5 ${erro?.alvo === `fonte-${i}` ? "border-saida/70" : ""}`}>
                  <div className="mb-4 flex items-center justify-between">
                    <span className="titulo-secao mb-0">{f.nome || `Entrada ${i + 1}`}</span>
                    {fontes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setFontes((atuais) => atuais.filter((_, j) => j !== i))}
                        className="text-xs text-suave hover:text-saida"
                      >
                        remover
                      </button>
                    )}
                  </div>
                  <CamposFonte
                    rascunho={f}
                    comContas={false}
                    onChange={(nova) => {
                      setFontes((atuais) => atuais.map((x, j) => (j === i ? nova : x)));
                      setErro(null);
                    }}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setFontes((atuais) => [...atuais, RASCUNHO_FONTE_VAZIO])}
                className="w-full rounded-2xl border border-dashed border-white/15 py-3 text-sm text-suave hover:border-rosa hover:text-white"
              >
                + Adicionar outra entrada (outro trabalho, freela…)
              </button>
            </div>
          </>
        )}

        {etapa === "sonhos" && (
          <>
            <Titulo
              titulo="Quanto quer guardar e pra quê?"
              texto="Toque numa ideia ou escreva a sua. Cada uma vira uma trilha."
            />
            <div className="flex flex-wrap gap-2">
              {SUGESTOES_SONHOS.map((s) => (
                <BotaoSugestao key={s.nome} ativo={escolhido("juntar", s.nome)} onClick={() => alternarSonho("juntar", s)}>
                  {s.icone} {s.nome}
                </BotaoSugestao>
              ))}
              <BotaoSugestao tracejado onClick={() => alternarSonho("juntar", { nome: "", icone: "⭐" })}>
                + Outro
              </BotaoSugestao>
            </div>

            <div className="mt-6 space-y-3">
              {sonhosValidos.map((s) => (
                <div
                  key={s.id}
                  id={`sonho-${s.id}`}
                  ref={s.id === rolarPara ? novoCartao : undefined}
                  className={`cartao flex items-center gap-3 p-4 ${erro?.alvo === `sonho-${s.id}` ? "border-saida/70" : ""}`}
                >
                  <span className="text-xl" aria-hidden>
                    {s.icone}
                  </span>
                  <input
                    value={s.nome}
                    onChange={(e) => mudarSonho(s.id, { nome: e.target.value })}
                    placeholder="Pra quê?"
                    aria-label="Pra quê"
                    className="campo min-w-0 flex-1"
                  />
                  <div className="w-36 shrink-0">
                    <CampoValor valor={s.alvo} onChange={(alvo) => mudarSonho(s.id, { alvo })} rotulo="Quanto" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setSonhos((atuais) => atuais.filter((x) => x.id !== s.id))}
                    aria-label="Remover"
                    className="text-xl text-suave hover:text-saida"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {etapa === "reserva" && (
          <>
            <Titulo
              titulo="E a reserva de emergência?"
              texto={`É um dinheiro guardado só para imprevistos: um conserto, uma consulta, um mês sem renda. O ideal é ter ${
                sugestao.rendaVariavel ? "12 meses" : "de 3 a 6 meses"
              } dos seus gastos.`}
            />
            <div className="grid gap-3">
              {OPCOES_RESERVA.map((o) => (
                <CartaoOpcao
                  key={o.id}
                  icone={o.icone}
                  nome={o.nome}
                  descricao={o.descricao}
                  ativo={reserva === o.id}
                  onClick={() => {
                    setReserva(o.id);
                    setErro(null);
                  }}
                />
              ))}
            </div>

            {(reserva === "tenho" || reserva === "quero") && (
              <div className="cartao mt-5 grid gap-3 p-5 sm:grid-cols-2">
                <Campo rotulo={reserva === "tenho" ? "Quanto você tem nela?" : "Já tem algo guardado?"}>
                  <CampoValor valor={reservaGuardado} onChange={setReservaGuardado} />
                </Campo>
                <Campo rotulo="Quanto quer ter no total?">
                  <CampoValor
                    valor={reservaAlvo}
                    onChange={setReservaAlvo}
                    placeholder={sugestao.alvo > 0 ? brl(sugestao.alvo).replace("R$", "").trim() : "0,00"}
                  />
                </Campo>
                <p className="text-xs text-suave sm:col-span-2">
                  {sugestao.alvo > 0 ? (
                    <>
                      💡 Sugestão: <b className="text-white">{brl(sugestao.alvo)}</b> ({sugestao.meses} meses
                      {sugestao.provisoria ? " do que entra" : " dos seus gastos"}). É uma{" "}
                      <b className="text-white">estimativa provisória</b>: quando você cadastrar os gastos fixos, a Trilha
                      recalcula pelo que você gasta de verdade. Se deixar em branco, usamos esse valor.
                    </>
                  ) : (
                    "Sem renda informada, defina um valor que faça sentido para você (dá para mudar depois)."
                  )}
                </p>
              </div>
            )}
          </>
        )}

        {etapa === "pronto" && (
          <>
            <Titulo
              titulo="Tudo pronto! ✨"
              texto="Esse é o seu ponto de partida. Toque numa linha para corrigir. Agora falta só cadastrar suas contas."
            />
            <ul className="cartao divide-y divide-white/5 px-5">
              <LinhaResumo icone="🎯" rotulo="Objetivos" onClick={() => irPara("objetivos")}>
                {objetivos
                  .map((id) => (id === "outro" && objetivoOutro.trim()) || OBJETIVOS.find((o) => o.id === id)?.nome)
                  .join(", ")}
              </LinhaResumo>
              <LinhaResumo icone="💰" rotulo="O que entra por mês" onClick={() => irPara(semRenda ? "situacao" : "renda")}>
                {rendaDinheiro > 0 ? `~ ${brl(rendaDinheiro)}` : semRenda ? "Sem renda por enquanto" : "Vou registrar depois"}
                {rendaVales > 0 && <span className="text-suave"> + {brl(rendaVales)} em vale</span>}
              </LinhaResumo>
              {sonhosValidos.filter((s) => !s.noCartao).length > 0 && (
                <LinhaResumo icone="🗺️" rotulo="Trilhas" onClick={() => irPara("sonhos")}>
                  {sonhosValidos
                    .filter((s) => !s.noCartao)
                    .map((s) => `${s.icone} ${s.nome.trim() || "Meu sonho"}`)
                    .join("  ·  ")}
                </LinhaResumo>
              )}
              {noCartaoQuitar.length > 0 && (
                <LinhaResumo icone="💳" rotulo="Para incluir no cartão (aba Contas)" onClick={() => irPara("sonhos")}>
                  {noCartaoQuitar.map((s) => s.nome || "Compra parcelada").join(", ")}
                </LinhaResumo>
              )}
              <LinhaResumo icone="🛟" rotulo="Reserva de emergência" onClick={() => irPara("reserva")}>
                {reserva === "nao" || !reserva
                  ? "Agora não"
                  : `${OPCOES_RESERVA.find((o) => o.id === reserva)?.nome} · meta de ${brl(lerValor(reservaAlvo) || Math.max(sugestao.alvo, lerValor(reservaGuardado) || 0))}${
                      lerValor(reservaGuardado) > 0 ? ` (já tem ${brl(lerValor(reservaGuardado))})` : ""
                    }`}
              </LinhaResumo>
            </ul>
            <p className="mt-4 rounded-2xl bg-roxo/10 px-4 py-3 text-sm text-suave">
              🏦 Próximo passo: cadastrar suas contas (banco, carteira, vale) com o saldo de hoje. Assim tudo o que entra e sai
              cai no lugar certo.
            </p>
          </>
        )}
      </div>

      {erro && (
        <p role="alert" className="mt-6 text-center text-sm text-saida">
          {erro.texto}
        </p>
      )}

      <div className="sticky bottom-0 -mx-5 mt-8 space-y-3 bg-linear-to-t from-fundo via-fundo to-transparent px-5 pb-2 pt-6">
        <button type="submit" className="botao-gradiente w-full rounded-full py-3.5 font-semibold">
          {etapa === "inicio" ? "Começar" : etapa === "pronto" ? "Cadastrar minhas contas" : "Continuar"}
        </button>
        {(etapa === "renda" || etapa === "sonhos") && (
          <button type="button" onClick={pular} className="w-full py-1 text-sm text-rosa">
            {etapa === "renda" ? "Pular" : "Fazer depois"}
          </button>
        )}
      </div>
    </form>
  );
}

function BotaoSugestao({
  tracejado,
  ativo,
  onClick,
  children,
}: {
  tracejado?: boolean;
  ativo?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={tracejado ? undefined : !!ativo}
      className={`rounded-full px-3 py-2 text-sm hover:border-rosa ${
        tracejado
          ? "border border-dashed border-white/20 text-suave hover:text-white"
          : ativo
            ? "border border-rosa bg-rosa/15 font-semibold"
            : "border border-white/10 bg-superficie"
      }`}
    >
      {ativo && "✓ "}
      {children}
    </button>
  );
}

function Titulo({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="mb-7">
      <h1 className="font-display text-3xl font-bold leading-tight">{titulo}</h1>
      <p className="mt-2 text-suave">{texto}</p>
    </div>
  );
}

function CartaoOpcao({
  icone,
  nome,
  descricao,
  ativo,
  onClick,
}: {
  icone: string;
  nome: string;
  descricao: string;
  ativo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`flex items-center gap-4 rounded-3xl border p-4 text-left transition-all ${
        ativo
          ? "border-rosa bg-rosa/10 shadow-[0_0_24px_rgb(255_78_216/0.2)]"
          : "border-white/10 bg-superficie hover:border-roxo/50"
      }`}
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-superficie-2 text-2xl" aria-hidden>
        {icone}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{nome}</span>
        <span className="block text-sm text-suave">{descricao}</span>
      </span>
      <span
        className={`grid size-6 shrink-0 place-items-center rounded-full border-2 text-xs ${ativo ? "border-rosa bg-rosa text-white" : "border-white/20"}`}
        aria-hidden
      >
        {ativo && "✓"}
      </span>
    </button>
  );
}

function LinhaResumo({
  icone,
  rotulo,
  onClick,
  children,
}: {
  icone: string;
  rotulo: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <li>
      <button type="button" onClick={onClick} className="group flex w-full gap-4 py-4 text-left">
        <span className="text-2xl" aria-hidden>
          {icone}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-suave">{rotulo}</span>
          <span className="block font-medium">{children}</span>
        </span>
        <span className="self-center text-xs text-suave group-hover:text-rosa">editar ›</span>
      </button>
    </li>
  );
}
