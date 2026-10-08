"use client";

import { useRef, useState } from "react";
import {
  adicionarCategoria,
  apagarTudo,
  CATEGORIAS,
  categoriasDe,
  definirOrcamento,
  exportarBackup,
  importarBackup,
  mudarPreferencias,
  OBJETIVOS,
  recomecarBoasVindas,
  removerCategoria,
  salvarPerfil,
  useCategoriasPersonalizadas,
  useOrcamentos,
  usePerfil,
  usePreferencias,
  VERSAO_DOS_DADOS,
  type Objetivo,
  type Tipo,
} from "@/lib/store";
import { brl, hojeISO, lerValor, valorParaCampo } from "@/lib/formato";
import { NECESSIDADES_PADRAO } from "@/lib/analise";
import { pedirPermissaoDeNotificacao } from "@/lib/lembretes";
import { comDesfazer, mostrarAviso } from "@/lib/avisos";
import { CampoValor, Chip } from "@/components/Campos";
import { definirSenha, emailLogado, nuvemAtiva, sair } from "@/lib/nuvem";
import InstalarApp from "@/components/InstalarApp";
import SeletorTema from "@/components/SeletorTema";
import Icone, { ComIcone } from "@/components/Icone";

const AUTOMATICAS = ["Fatura do cartão", "Guardar (metas)"];

export default function Configuracoes() {
  const perfil = usePerfil();
  const prefs = usePreferencias();
  const personalizadas = useCategoriasPersonalizadas();
  const orcamentos = useOrcamentos();
  const arquivo = useRef<HTMLInputElement>(null);
  const [nome, setNome] = useState(perfil?.nome ?? "");
  const [novaCategoria, setNovaCategoria] = useState({ tipo: "saida" as Tipo, nome: "", icone: "🏷️", pai: "" });
  const [confirmar, setConfirmar] = useState<null | "questionario" | "apagar" | "zerar" | "importar">(null);
  const [textoImportado, setTextoImportado] = useState("");
  const [orcando, setOrcando] = useState<{ categoria: string; valor: string } | null>(null);

  const gastos = categoriasDe("saida", personalizadas).filter((c) => !AUTOMATICAS.includes(c.nome));
  const necessidades = prefs.necessidades ?? NECESSIDADES_PADRAO;

  function baixarBackup() {
    const blob = new Blob([exportarBackup()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `naxxo-financas-backup-${hojeISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    mostrarAviso({ texto: "Backup baixado ✓ Guarde o arquivo num lugar seguro (Drive, e-mail…)" });
  }

  async function lerArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setTextoImportado(await f.text());
    setConfirmar("importar");
  }

  function alternarObjetivo(id: Objetivo) {
    if (!perfil) return;
    const objetivos = perfil.objetivos.includes(id) ? perfil.objetivos.filter((o) => o !== id) : [...perfil.objetivos, id];
    salvarPerfil({ ...perfil, objetivos });
  }

  return (
    <div className="space-y-6">
      <InstalarApp />

      {nuvemAtiva && (
        <Secao titulo="☁️ Sua conta">
          <p className="text-sm">
            Conectada como <b>{emailLogado()}</b>
          </p>
          <p className="mt-1 text-xs text-suave">
            Seus dados ficam guardados na nuvem: entre com o mesmo e-mail em qualquer aparelho.
          </p>
          <CriarSenha />
          <button
            onClick={() => void sair()}
            className="mt-3 rounded-full border border-white/15 px-4 py-2 text-sm text-suave hover:text-white"
          >
            Sair da conta
          </button>
        </Secao>
      )}

      {/* Você */}
      <Secao titulo="👤 Você">
        <label className="block space-y-1.5">
          <span className="text-xs text-suave">Como podemos te chamar?</span>
          <div className="flex gap-2">
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" className="campo" />
            <button
              onClick={() => {
                if (perfil) salvarPerfil({ ...perfil, nome: nome.trim() });
                mostrarAviso({ texto: "Nome salvo ✓" });
              }}
              className="shrink-0 rounded-full border border-rosa/50 px-4 text-sm text-rosa"
            >
              Salvar
            </button>
          </div>
        </label>
        <div className="mt-4 space-y-1.5">
          <span className="text-xs text-suave">Seus objetivos (mudam o que aparece no Início)</span>
          <div className="flex flex-wrap gap-2">
            {OBJETIVOS.filter((o) => o.id !== "outro").map((o) => (
              <Chip key={o.id} ativo={!!perfil?.objetivos.includes(o.id)} onClick={() => alternarObjetivo(o.id)}>
                <Icone e={o.icone} /> {o.nome}
              </Chip>
            ))}
          </div>
        </div>
      </Secao>

      {/* Aparência */}
      <Secao titulo="🎨 Aparência">
        <SeletorTema />
      </Secao>

      {/* Lembretes */}
      <Secao titulo="🔔 Lembretes">
        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={prefs.lembretes}
            onChange={async (e) => {
              if (!e.target.checked) return mudarPreferencias({ lembretes: false });
              const resposta = await pedirPermissaoDeNotificacao();
              if (resposta === "ok") {
                mudarPreferencias({ lembretes: true, lembradoEm: undefined });
                mostrarAviso({ texto: "Lembretes ligados ✓" });
              } else {
                mudarPreferencias({ lembretes: false });
                mostrarAviso({
                  tipo: "erro",
                  texto:
                    resposta === "negado"
                      ? "O navegador bloqueou as notificações. Libere nas configurações do site."
                      : "Este navegador não tem notificações.",
                });
              }
            }}
            className="size-5 accent-rosa"
          />
          <span>
            Notificação de contas que vencem hoje ou amanhã e de fatura que fecha em até 2 dias
            <span className="block text-xs text-suave">
              Os avisos aparecem uma vez por dia, ao abrir o app. No celular, instale o app (“Adicionar à tela de início”) para
              receber melhor.
            </span>
          </span>
        </label>
      </Secao>

      {/* Backup */}
      <Secao titulo="💾 Backup dos seus dados">
        <p className="text-sm text-suave">
          Seus dados ficam só neste navegador. Limpar o histórico, trocar de celular ou usar aba anônima apaga tudo. Baixe um
          backup de vez em quando (ex.: todo mês) e guarde no Drive ou no e-mail.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={baixarBackup} className="botao-gradiente rounded-full px-5 py-2.5 text-sm font-semibold">
            ⬇️ Baixar backup
          </button>
          <button
            onClick={() => arquivo.current?.click()}
            className="rounded-full border border-rosa/50 px-5 py-2.5 text-sm text-rosa"
          >
            ⬆️ Restaurar de um arquivo
          </button>
          <input
            ref={arquivo}
            type="file"
            accept="application/json,.json"
            onChange={lerArquivo}
            className="hidden"
            aria-label="Arquivo de backup"
          />
        </div>
        {confirmar === "importar" && (
          <Confirmacao
            texto="Restaurar o backup troca TODOS os dados de agora pelos do arquivo. Dá para desfazer logo depois."
            botao="Restaurar"
            onCancelar={() => setConfirmar(null)}
            onConfirmar={() => {
              let erro: string | null = null;
              comDesfazer("Backup restaurado ✓", () => {
                erro = importarBackup(textoImportado);
              });
              if (erro) mostrarAviso({ tipo: "erro", texto: erro });
              setConfirmar(null);
            }}
          />
        )}
        <p className="mt-2 text-xs text-suave">Versão dos dados: {VERSAO_DOS_DADOS}</p>
      </Secao>

      {/* Categorias */}
      <Secao titulo="🏷️ Categorias e subcategorias">
        <p className="text-sm text-suave">
          Crie as suas (pet, beleza, filhos, presentes…) ou subcategorias (ex.: Lazer › Cinema).
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr_auto]">
          <select
            value={novaCategoria.pai ? `sub:${novaCategoria.pai}` : novaCategoria.tipo}
            onChange={(e) => {
              const v = e.target.value;
              if (v.startsWith("sub:")) setNovaCategoria({ ...novaCategoria, tipo: "saida", pai: v.slice(4) });
              else setNovaCategoria({ ...novaCategoria, tipo: v as Tipo, pai: "" });
            }}
            aria-label="Tipo da categoria"
            className="campo cursor-pointer py-2 text-sm"
          >
            <option value="saida">Nova categoria de gasto</option>
            <option value="entrada">Nova categoria de entrada</option>
            {gastos.map((c) => (
              <option key={c.nome} value={`sub:${c.nome}`}>
                Subcategoria de {c.nome}
              </option>
            ))}
          </select>
          <input
            value={novaCategoria.nome}
            onChange={(e) => setNovaCategoria({ ...novaCategoria, nome: e.target.value })}
            placeholder="Nome (ex.: Pet)"
            aria-label="Nome da categoria"
            className="campo py-2 text-sm"
          />
          <button
            onClick={() => {
              if (!novaCategoria.nome.trim()) return;
              adicionarCategoria({
                tipo: novaCategoria.tipo,
                nome: novaCategoria.nome,
                icone: novaCategoria.pai ? "•" : "🏷️",
                pai: novaCategoria.pai || undefined,
              });
              setNovaCategoria({ ...novaCategoria, nome: "" });
              mostrarAviso({ texto: "Categoria criada ✓" });
            }}
            className="rounded-full border border-rosa/50 px-4 py-2 text-sm text-rosa"
          >
            Criar
          </button>
        </div>
        {personalizadas.length > 0 && (
          <ul className="mt-3 divide-y divide-white/5 text-sm">
            {personalizadas.map((c) => (
              <li key={c.id} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1">
                  {c.pai ? `${c.pai} › ` : ""}
                  <b>{c.nome}</b> <span className="text-xs text-suave">({c.tipo === "saida" ? "gasto" : "entrada"})</span>
                </span>
                <button
                  onClick={() => comDesfazer(`Categoria “${c.nome}” removida`, () => removerCategoria(c.id))}
                  className="text-xs text-suave hover:text-saida"
                >
                  remover
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-suave">Remover uma categoria não muda os lançamentos que já usam ela.</p>
      </Secao>

      {/* Orçamento por categoria */}
      <Secao titulo="🎯 Limite por categoria (orçamento)">
        <p className="text-sm text-suave">
          Defina quanto quer gastar por mês em cada categoria. O Resumo e o Início mostram a barra de quanto já foi.
        </p>
        <ul className="mt-3 divide-y divide-white/5 text-sm">
          {gastos.map((c) => (
            <li key={c.nome} className="flex items-center gap-2 py-2">
              <span className="min-w-0 flex-1">
                <Icone e={c.icone} /> {c.nome}
              </span>
              {orcando?.categoria === c.nome ? (
                <>
                  <div className="w-32">
                    <CampoValor
                      valor={orcando.valor}
                      onChange={(valor) => setOrcando({ ...orcando, valor })}
                      autoFocus
                      rotulo={`Limite de ${c.nome}`}
                    />
                  </div>
                  <button
                    onClick={() => {
                      definirOrcamento(c.nome, lerValor(orcando.valor) || null);
                      setOrcando(null);
                    }}
                    className="text-xs text-rosa"
                  >
                    ok
                  </button>
                </>
              ) : (
                <button
                  onClick={() =>
                    setOrcando({ categoria: c.nome, valor: orcamentos[c.nome] ? valorParaCampo(orcamentos[c.nome]) : "" })
                  }
                  className="text-xs text-rosa"
                >
                  {orcamentos[c.nome] ? `${brl(orcamentos[c.nome])}/mês` : "definir limite"}
                </button>
              )}
            </li>
          ))}
        </ul>
      </Secao>

      {/* Regra 50/30/20 */}
      <Secao titulo="⚖️ Regra 50/30/20: o que é necessidade para você">
        <p className="text-sm text-suave">
          Marque o que é necessidade (o resto conta como desejo). Ex.: internet e plano de celular costumam ser necessidade.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[...gastos.map((c) => c.nome), ...CATEGORIAS.saida.filter((c) => c.nome === "Parcelas e dívidas").map((c) => c.nome)]
            .filter((v, i, a) => a.indexOf(v) === i)
            .map((nomeCategoria) => {
              const ativo = necessidades.includes(nomeCategoria);
              return (
                <Chip
                  key={nomeCategoria}
                  ativo={ativo}
                  onClick={() =>
                    mudarPreferencias({
                      necessidades: ativo ? necessidades.filter((n) => n !== nomeCategoria) : [...necessidades, nomeCategoria],
                    })
                  }
                >
                  {nomeCategoria}
                </Chip>
              );
            })}
        </div>
      </Secao>

      {/* Recomeçar */}
      <Secao titulo="⚠️ Recomeçar">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setConfirmar("questionario")}
            className="rounded-full border border-white/15 px-4 py-2 text-sm text-suave hover:text-white"
          >
            ↺ Refazer o questionário inicial
          </button>
          <button
            onClick={() => setConfirmar("apagar")}
            className="rounded-full border border-saida/40 px-4 py-2 text-sm text-saida"
          >
            Apagar todos os dados
          </button>
          <button
            onClick={() => setConfirmar("zerar")}
            className="rounded-full border border-saida/40 px-4 py-2 text-sm text-saida"
          >
            Começar do zero (mantém a lista do mercado)
          </button>
        </div>
        {confirmar === "questionario" && (
          <Confirmacao
            texto="Refazer o questionário apaga suas metas e fontes de renda (os lançamentos e contas continuam). Dá para desfazer logo depois."
            botao="Refazer"
            onCancelar={() => setConfirmar(null)}
            onConfirmar={() => {
              comDesfazer("Questionário reiniciado", () => recomecarBoasVindas());
              setConfirmar(null);
            }}
          />
        )}
        {confirmar === "zerar" && (
          <Confirmacao
            texto="Apaga tudo (contas, lançamentos, metas, renda, fixos, despensa) e começa pelo questionário de novo. Ficam só a lista de compras do mercado e os produtos que você criou."
            botao="Começar do zero"
            onCancelar={() => setConfirmar(null)}
            onConfirmar={() => {
              comDesfazer("Tudo apagado (a lista do mercado ficou)", () =>
                apagarTudo(["naxxo:mercado-lista", "naxxo:mercado-opcoes"]),
              );
              setConfirmar(null);
            }}
          />
        )}
        {confirmar === "apagar" && (
          <Confirmacao
            texto="Isso apaga TUDO deste navegador: contas, lançamentos, metas, mercado. Baixe um backup antes se quiser guardar. Dá para desfazer só nos próximos segundos."
            botao="Apagar tudo"
            onCancelar={() => setConfirmar(null)}
            onConfirmar={() => {
              comDesfazer("Todos os dados foram apagados", () => apagarTudo());
              setConfirmar(null);
            }}
          />
        )}
      </Secao>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="cartao p-5">
      <h2 className="mb-3 font-display font-semibold">
        <ComIcone texto={titulo} />
      </h2>
      {children}
    </section>
  );
}

function Confirmacao({
  texto,
  botao,
  onCancelar,
  onConfirmar,
}: {
  texto: string;
  botao: string;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  return (
    <div role="alertdialog" aria-label={botao} className="mt-3 rounded-2xl border border-saida/40 bg-saida/5 p-4 text-sm">
      <p>{texto}</p>
      <div className="mt-3 flex gap-2">
        <button onClick={onCancelar} className="flex-1 rounded-full border border-white/15 py-2">
          Cancelar
        </button>
        <button onClick={onConfirmar} className="flex-1 rounded-full bg-saida py-2 font-semibold text-fundo">
          {botao}
        </button>
      </div>
    </div>
  );
}

/** Criar ou mudar a senha: depois dá para entrar com e-mail e senha, sem esperar e-mail. */
function CriarSenha() {
  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  if (!aberto)
    return (
      <button
        onClick={() => setAberto(true)}
        className="mr-2 mt-3 rounded-full border border-rosa/50 px-4 py-2 text-sm text-rosa"
      >
        🔑 Criar / mudar senha
      </button>
    );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const problema = await definirSenha(senha);
        if (problema) return setErro(problema);
        setAberto(false);
        setSenha("");
        mostrarAviso({ texto: "Senha salva ✓ Agora dá para entrar com e-mail e senha" });
      }}
      className="mt-3 space-y-2"
    >
      <input
        type="password"
        autoFocus
        autoComplete="new-password"
        value={senha}
        onChange={(e) => {
          setSenha(e.target.value);
          setErro("");
        }}
        placeholder="nova senha (mínimo 8 caracteres)"
        aria-label="Nova senha"
        className="campo"
      />
      {erro && <p className="text-sm text-saida">{erro}</p>}
      <div className="flex gap-2">
        <button type="submit" className="botao-gradiente rounded-full px-4 py-2 text-sm font-semibold">
          Salvar senha
        </button>
        <button type="button" onClick={() => setAberto(false)} className="px-3 text-sm text-suave">
          cancelar
        </button>
      </div>
    </form>
  );
}
