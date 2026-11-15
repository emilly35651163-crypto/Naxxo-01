# Mercado (desligado em 15/11/2026)

> O Mercado saiu do NAXXO, mas tudo continua guardado para talvez virar outro app.
> **Para ligar de novo no NAXXO:** em `src/lib/recursos.ts`, troque `MERCADO_ATIVO` para `true`.
> **Versão completa congelada:** a marca `mercado-completo` no GitHub guarda o código exatamente como estava quando foi desligado.

## O que ele fazia

Duas abas:

### 1. Mercado (o da casa)
- **Lista de compras:** adicionar um item por vez (categoria, nome com sugestões, quantidade, preço e quanto dura) ou **colar uma lista inteira** ("5kg Arroz 24,99"). No mercado, a pessoa marca o que pegou e preenche o preço.
- **"Fiz o mercado":** fecha a lista, pergunta se faltou algo, vira **um gasto de hoje** e manda os itens para **"Em casa"**.
- **Em casa (despensa):** cada item com a data da última compra e **quanto dura**. O app mostra quando cada coisa acaba e quanto ainda resta. Se a duração não é conhecida, ele descobre quando a pessoa aperta **"Acabou hoje"**.
- **Previsão do mês:** o que vai acabar entra nas previsões ("Repor arroz, café"), junto com a **compra planejada** (a lista, no dia marcado).
- **Ler notinha:** foto do cupom fiscal (NFC-e) → produtos e preços → a pessoa confere → vira a compra (gasto + Em casa). Com a IA (logado e com a chave), lê bem melhor; sem ela, usa o leitor do celular (Tesseract).
- **Gasto do mês com mercado:** o mesmo número do Resumo, a partir dos lançamentos e do cartão.

### 2. Apps (carrinho das lojas online)
- Carrinho separado por loja (Shein, Mercado Livre, Amazon…).
- Para cada loja, o app diz se é **uma boa hora de comprar** (a mesma conta dos Desejos: sobra do mês, limite do cartão sem apertar, ou até quando esperar).
- **Ler print do carrinho:** print da tela do app → produtos e preços → conferir → vão para a loja certa.

## Onde está o código

| Arquivo | O que tem |
|---|---|
| `src/app/mercado/page.tsx` | A tela, com as duas abas |
| `src/app/mercado/FormItemLista.tsx` | Adicionar/editar item da lista |
| `src/app/mercado/FormColarLista.tsx` | Colar lista ou nota de uma vez |
| `src/app/mercado/FizOMercado.tsx` | Fechar a compra |
| `src/app/mercado/CamposPreco.tsx` | Preço por kg/unidade ou total |
| `src/app/mercado/LerNotinha.tsx` | Foto do cupom fiscal |
| `src/app/mercado/CarrinhoApps.tsx` | Carrinho das lojas online |
| `src/app/mercado/LerPrintCarrinho.tsx` | Print do carrinho |
| `src/lib/mercado.ts` | As contas: quando acaba, quanto resta, previsão do mês, ler lista colada |
| `src/lib/notinha.ts` | Ler o texto do cupom fiscal e do print do carrinho |
| `src/lib/store.ts` | Os dados (tipos `ItemMercado`, `CompraMercado`, `ItemLista`, `OpcaoMercado`, `Desejo`) |
| `src/lib/previstos.ts` | Reposição e compra planejada nas previsões (desligado pelo interruptor) |

## Os dados das pessoas (continuam guardados)

Ficam no navegador e na nuvem (Supabase, tabela `dados`), nestas chaves:

| Chave | O que é |
|---|---|
| `naxxo:mercado-itens` | Em casa (despensa) |
| `naxxo:mercado-compras` | Idas ao mercado (data, total, itens) |
| `naxxo:mercado-lista` | Lista de compras |
| `naxxo:mercado-opcoes` | Produtos já usados (sugestões) |
| `naxxo:mercado-plano` | Dia da compra planejada |
| `naxxo:desejos` | Desejos (também usados pelo carrinho de apps) |

Os gastos com mercado continuam normais no NAXXO: a categoria **Mercado** (Compra do mês, Compra avulsa, Hortifrúti, Açougue, Padaria, Atacarejo) segue existindo e o extrato continua classificando nela.

## O que foi desligado

- Botão 🛒 no topo e item "Mercado" no menu lateral
- Card "Mercado / alimentação" em Fixos
- Link "Abrir o Mercado" no Resumo por categoria
- Previsões de reposição e de compra planejada
- Quem abrir `/mercado` volta para o Início
