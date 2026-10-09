# NAXXO Finanças: o novo sistema

> Documento de referência do redesenho. Tudo o que for construído daqui pra frente segue isto.
> Escrito em 08/10/2026, a partir do código atual (`src/lib/extrato.ts`, `ImportarExtrato.tsx`, `boas-vindas`, `store.ts`).

---

## 0. As 6 regras do novo sistema

1. **Só existem duas portas de entrada de dados:** o **extrato** (conexão direta com o banco ou arquivo) e o botão **Novo lançamento**. Nada mais cria, muda ou "chuta" valores.
2. **O extrato manda.** O que veio do banco é a verdade: valor, data, se foi pago, de qual conta saiu. A pessoa só muda **nome** e **categoria** (e pode marcar observações).
3. **"Outros" é quase proibido.** O app sempre escolhe a categoria mais provável. Se não tiver certeza, o item vai para **"Para revisar"**, nunca para "Outros". "Outros" só existe se a própria pessoa escolher.
4. **O app aprende.** Mudou o nome ou a categoria de um item? Da próxima vez que ele vier no extrato, já vem do jeito que a pessoa deixou.
5. **Cada informação mora em um lugar só.** Tudo sobre conta/cartão fica na aba **Contas**. Nada é repetido em outra tela.
6. **Mínimo de 6 meses de histórico** na primeira leitura. É com isso que o app acha padrões (salário, contas fixas, assinaturas, parcelas).

---

## 1. Como o extrato chega (conexão direta com o banco)

### 1.1 O caminho: Open Finance Brasil
O Open Finance é o sistema oficial do Banco Central em que a pessoa **autoriza** um app a ler os dados do banco dela, direto no app do banco, sem passar senha para ninguém.

O NAXXO **não pode** se ligar sozinho ao Open Finance (para isso precisaria de licença do Banco Central). O jeito é usar uma **empresa intermediária já autorizada** (agregador), que faz a ponte:

| Opção | O que é | Observação |
|---|---|---|
| **Pluggy** (recomendada para começar) | Agregador brasileiro, muito usado por apps pequenos | Tem um "widget" pronto de conexão, devolve transações já com nome da loja, CNPJ, categoria e dados de cartão/fatura |
| Belvo | Agregador latino-americano | Bom, mais voltado a empresas maiores |
| Klavi, Celcoin e outros | Alternativas brasileiras | Comparar preço |

**A estudar antes de decidir (tarefa de pesquisa):** preço por conexão/mês de cada um, quais bancos cobrem (Nubank, Inter, Itaú, Bradesco, Caixa, BB, Santander, C6, PicPay, Mercado Pago), se trazem fatura de cartão com parcelas, e quantos meses de histórico entregam (o Open Finance costuma permitir até 12 meses).

### 1.2 Como fica para a pessoa
1. Contas → **"Conectar banco"**
2. Escolhe o banco na lista
3. É levada para o app do próprio banco, vê o que está autorizando (contas, cartões, transações) e confirma
4. Volta ao NAXXO com a mensagem "Lendo seus últimos 12 meses…"
5. Pronto: contas, cartões, saldos e transações aparecem já categorizados

A autorização tem validade (até 12 meses). Antes de vencer, o app avisa: "Sua conexão com o Nubank vence em 7 dias. Renovar?"

### 1.3 Atualização automática
- Depois de conectado, o app busca novidades **sozinho** (o agregador avisa o NAXXO quando há transações novas).
- A pessoa nunca mais precisa "colocar extrato". Ela só abre o app e está tudo lá.
- Botão "Atualizar agora" em cada conta, para quem quiser forçar.

### 1.4 Plano B: arquivo (continua existindo)
Para banco que o agregador não cobre, ou para quem não quer conectar:
- Aceita OFX, CSV e PDF (o que já existe hoje), com a mesma leitura inteligente.
- **Regra dos 6 meses:** o app olha a primeira e a última data do arquivo. Se cobrir menos de 6 meses, mostra: "Este extrato tem só 2 meses. Para o NAXXO achar seus padrões, baixe pelo menos 6 meses." A pessoa pode continuar mesmo assim, mas o app avisa que os padrões ficam "em aprendizado".
- Pode mandar vários arquivos (vários meses, conta + cartão) de uma vez.

### 1.5 O que muda por trás (técnico)
- Hoje os dados ficam no navegador e só são copiados para o Supabase. Com conexão bancária, **os dados passam a viver no servidor** (Supabase), porque a chave do agregador e a da IA não podem ficar no navegador.
- Conexão bancária exige **login**. Quem usa sem conta (naxxo-01.vercel.app) fica só com o arquivo.
- **LGPD:** tela de consentimento clara, política de privacidade atualizada, botão "Desconectar banco e apagar meus dados bancários".

---

## 2. A leitura minuciosa (automação + IA)

A leitura acontece em **5 etapas**, nesta ordem. Cada etapa só trata o que a anterior não resolveu com certeza.

### Etapa 1: Organizar
- Junta tudo o que veio (conexão ou arquivo) num formato único.
- Tira duplicados (mesma linha vinda duas vezes).
- Separa o que **não é movimento** (linhas de "saldo do dia", "saldo anterior").
- Limpa o texto: tira códigos, CPF mascarado, agência, número de documento.
- Cria a **chave de identificação** de cada item (ver seção 5).

### Etapa 2: Regras da própria pessoa (memória)
- Se a chave do item bate com algo que a pessoa já renomeou ou recategorizou, aplica **na hora** o nome e a categoria dela.
- Essa etapa vem antes de tudo: a escolha da pessoa sempre ganha da IA.

### Etapa 3: Reconhecimentos certeiros (regras fixas)
Coisas que dá para saber com 100% de certeza, sem IA:

| O que | Como reconhece |
|---|---|
| **Transferência entre minhas contas** | Sai X de uma conta conectada e entra X em outra conta conectada, mesma data (±2 dias). Vira "Transferência entre contas" e **não conta como gasto nem como ganho**. |
| **Pix/TED para mim mesma** | O nome ou CPF de quem recebe é o da própria pessoa (do cadastro). |
| **Pagamento de fatura** | Saída da conta com valor igual a uma fatura fechada do cartão conectado. Liga as duas: a fatura fica "paga em dd/mm, pela conta X". |
| **Parcelas** | "Parcela 3/10", "PARC 03/10". Guarda número e total, e já prevê as próximas. |
| **Estorno/devolução** | Entrada com mesmo valor e mesma loja de uma compra anterior. Cancela a compra, não vira "ganho". |
| **Tarifas, IOF, juros, multa** | Palavras do banco ("TAR", "IOF", "JUROS", "ENCARGOS"). |
| **Rendimento / aplicação / resgate** | Palavras do banco + dados do agregador. Aplicação não é gasto: é dinheiro guardado. |
| **Saque** | "SAQUE", "SAQ 24H". Vira "Saque (dinheiro em espécie)". |

### Etapa 4: IA (para todo o resto)
Tudo o que sobrou vai para a IA (Claude, da Anthropic), em lotes.

**O que a IA recebe de cada item:** descrição original, valor, data, tipo (entrada/saída), forma (Pix, débito, crédito, boleto), nome da loja e CNPJ/atividade quando o agregador trouxer, e o histórico dos 6 meses daquela mesma chave.
**O que a IA recebe de contexto:** a lista completa de categorias (seção 6), as regras que a pessoa já criou (como exemplos do jeito que ela gosta) e o primeiro nome da pessoa (para reconhecer "transferência para mim").
**O que a IA NÃO recebe:** CPF, número de conta, agência, e-mail. Só o mínimo.

**O que a IA devolve de cada item** (formato fixo, sempre igual):
- `nome`: título limpo, do jeito que uma pessoa escreveria ("Pix para Ana Souza", "iFood", "Conta de luz (Enel)")
- `categoria` e `subcategoria`: obrigatoriamente da lista. "Outros" não é uma opção para a IA.
- `natureza`: gasto, recebimento, transferência entre contas, pagamento de fatura, investimento, estorno, tarifa, saque
- `confianca`: alta, média ou baixa
- `motivo`: uma frase curta ("CNPJ de restaurante", "mesmo valor todo dia 10")

**Regra da confiança:**
- **Alta** → entra direto, já categorizado.
- **Média** → entra categorizado, com um pontinho "confira" discreto.
- **Baixa** → entra com a melhor aposta, mas vai para a fila **"Para revisar"** (ver 3.3).

**Modelo e custo (estimativa):**
- Modelo: **Claude Opus 5.5** (`claude-opus-5-5`), com esforço baixo (`effort: "low"`), suficiente para classificar.
- A primeira leitura de 6 a 12 meses (umas 600 a 1.200 transações) deve custar **na faixa de US$ 0,50 a US$ 2** por pessoa. As atualizações do mês (umas 100 transações) ficam **em centavos**.
- Para baratear: a primeira leitura grande vai pelo **processamento em lote** da Anthropic (metade do preço, demora alguns minutos); a lista de categorias e as instruções ficam em **cache** (bem mais barato a cada chamada).
- Se quiser cortar mais o custo, dá para testar o **Claude Haiku 5.5** (bem mais barato) e comparar a qualidade numa amostra real antes de decidir.
- Os itens que a pessoa já ensinou (Etapa 2) e os certeiros (Etapa 3) **não passam pela IA**: com o tempo, a IA é chamada cada vez menos.

### Etapa 5: Padrões (precisa dos 6 meses)
Com o histórico, o app descobre sozinho:

| Padrão | Como descobre | O que acontece |
|---|---|---|
| **Salário / renda** | Entrada da mesma origem, todo mês, mesmo período do mês | Vira uma **fonte de renda** automática, com dia previsto e valor médio |
| **Conta fixa** (aluguel, luz, internet) | Saída para o mesmo destino, todo mês, valor igual ou parecido | Vira um **gasto recorrente**: dia previsto, valor (fixo ou médio se varia) |
| **Assinatura** | Valor igual, todo mês, no cartão ou débito | Vira assinatura recorrente; o app avisa se o preço mudou ("Netflix subiu de R$ 39,90 para R$ 44,90") |
| **Gasto semanal/quinzenal** | Intervalos regulares de 7 ou 15 dias | Recorrente com essa frequência |
| **Anual / semestral** | Mesmo destino, 6 ou 12 meses depois (IPVA, IPTU, anuidade) | Recorrente anual, entra na previsão |
| **Parcelado** | Parcela n/total | Mostra quantas faltam, quanto falta e quando termina |
| **Recorrente que parou** | Vinha todo mês e não veio no último | Pergunta: "Você cancelou a Spotify?" |

---

## 3. O que o app mostra depois da leitura

### 3.1 A tela de resultado (logo depois de conectar / mandar o arquivo)
1. **Resumo da leitura:** "Li 847 movimentações de abril a outubro em 2 contas e 1 cartão."
2. **O que encontrei:**
   - Renda: "Salário da Empresa X, todo 5º dia útil, ~R$ 3.200"
   - Recorrentes: lista de contas fixas e assinaturas, com valor e dia
   - Parcelas em andamento
   - Para onde vai seu dinheiro: as 5 maiores categorias dos últimos 6 meses
3. **Para revisar (N itens):** só os de confiança baixa. Botão "Revisar agora" ou "Depois".
4. Botão **"Tudo certo"**.

Não existe mais a tela de "marcar quais linhas importar". Tudo entra; a pessoa ajusta o que quiser depois.

### 3.2 Cada item mostra (o máximo que o extrato permite)
| Informação | De onde vem |
|---|---|
| Nome (editável) | IA ou regra da pessoa |
| Descrição original do banco | Extrato (sempre visível em letra pequena, para conferir) |
| Valor | Extrato |
| Data da compra / data de lançamento | Extrato |
| Situação: **pago**, **agendado**, **na fatura aberta**, **na fatura fechada (vence dd/mm)**, **fatura paga em dd/mm** | Extrato + ligação fatura↔pagamento |
| Conta e forma: débito, crédito, Pix, TED, boleto, saque | Extrato |
| De quem veio / para quem foi | Extrato (nome da contraparte, banco) |
| Categoria e subcategoria (editáveis) | IA ou regra |
| Recorrência: "todo mês, dia 10", "parcela 3 de 10" | Etapa 5 |
| Origem: "Extrato Nubank" ou "Lançado à mão" | Sistema |

### 3.3 Fila "Para revisar"
- Aparece no Início só quando tem algo (um aviso: "3 itens para revisar").
- Cada item mostra a aposta do app e 3 sugestões de categoria em botões grandes. Um toque resolve.
- Ao resolver, o app pergunta (com "Sim" já marcado): **"Fazer isso sempre que aparecer 'PAG*JOSEDASILVA'?"**

### 3.4 "Pago ou não" sem erro
- **Conta corrente (débito, Pix, boleto pago):** tudo que está no extrato **já aconteceu** = pago, na data do extrato.
- **Agendado:** o Open Finance informa transações pendentes/agendadas → "Agendado para dd/mm".
- **Cartão de crédito:** compra = "na fatura de novembro". A fatura vira "paga" quando o pagamento aparece na conta (Etapa 3) ou quando o banco informa a fatura como paga.
- **Parcelas futuras e recorrentes previstos:** aparecem como **"Previsto"**, com outra cor, e nunca se misturam com o que já aconteceu.

---

## 4. Aba Contas: tudo sobre contas e cartões, separado em débito e crédito

A aba **Contas** passa a ser o único lugar com informação de conta e cartão.

```
Contas
├── Saldo total hoje (soma das contas)          ← sai da tela Início
├── [Nubank]  conectado · atualizado há 2h
│   ├── DÉBITO (conta)
│   │   ├── Saldo hoje (vem do banco, não é digitado)
│   │   ├── Entrou no mês / Saiu no mês
│   │   └── Movimentações (lista, filtros por mês/categoria)
│   └── CRÉDITO (cartão)
│       ├── Fatura aberta: valor, fecha dd/mm, vence dd/mm
│       ├── Faturas anteriores: valor, paga em dd/mm (ou "em aberto")
│       ├── Limite total / usado / disponível
│       ├── Parcelas em andamento
│       └── Compras da fatura (lista)
├── [Inter]  ...
├── Dinheiro em espécie (só lançamentos à mão)
└── + Conectar banco · + Enviar arquivo
```

- **Saldo não é mais digitado.** Vem do banco (conexão) ou do arquivo (OFX traz saldo). Isso acaba com as divergências de saldo.
- Contas sem conexão (dinheiro vivo, vale-refeição sem cobertura) continuam existindo, alimentadas só por lançamento à mão.

---

## 5. A memória: renomear e recategorizar uma vez, valer para sempre

### 5.1 A "chave" de um item
Para saber que dois itens de extratos diferentes são "a mesma coisa", o app cria uma chave:

1. **Melhor caso:** documento da contraparte (CPF/CNPJ que o Open Finance traz). Ex.: todo Pix para o CPF da Emilly tem a mesma chave, não importa como o banco escreveu o nome.
2. **Sem documento:** a descrição limpa: minúsculas, sem acento, sem números de documento, datas, códigos, "parcela x/y", sufixos como "LTDA", "S.A.", "\*", cidade.
   Ex.: `"PIX ENVIADO - EMILLY S OLIVEIRA - ***.123.456-**"` → `pix enviado|emilly s oliveira`
   Ex.: `"IFOOD *RESTAURANTE 12345 SAO PAULO"` → `ifood restaurante`
3. Junto da chave vai o **tipo** (entrada/saída), para "Pix de Ana" e "Pix para Ana" serem coisas diferentes.

### 5.2 Quando a pessoa muda algo
- Mudou o **nome** ou a **categoria** de um item que veio do extrato → o app pergunta (com a primeira opção já marcada):
  - **"Todos iguais: os antigos e os próximos"** (padrão)
  - "Só os próximos"
  - "Só este"
- Isso cria uma **regra** guardada no servidor:

| Campo | Exemplo |
|---|---|
| chave | `cpf:12345678900` ou `pix enviado|emilly s oliveira` |
| tipo | saída |
| nome escolhido | "Transferência para mim" |
| categoria / subcategoria | Transferência entre contas |
| faixa de valor (opcional) | — |
| criada em | 2026-10-08 |

- Na próxima leitura, a Etapa 2 aplica a regra **antes** da IA. Resultado: "Transferência para Emilly…" chega já como **"Transferência para mim"**, na categoria que ela escolheu.

### 5.3 Casos especiais
- **Mesma loja, coisas diferentes** (ex.: Amazon às vezes livro, às vezes eletrônico): a pessoa escolhe "Só este". Se fizer isso 2 vezes para a mesma chave, o app para de aplicar regra automática naquela loja e manda para a IA decidir caso a caso (usando as escolhas dela como exemplo).
- **Regra errada:** em Configurações → "Coisas que o NAXXO aprendeu", a lista de regras, com editar e apagar.
- **Parecido mas não igual** (ex.: "Uber \*Trip" e "Uber \*Eats"): chaves diferentes; a IA recebe as regras como exemplo e tende a seguir o mesmo estilo, mas só a chave exata aplica automático.

---

## 6. Categorias (lista completa)

Categoria principal + subcategoria. A pessoa pode criar categorias e subcategorias próprias. "Outros" existe, mas **só a pessoa** pode escolher.

### Saídas
| Categoria | Subcategorias |
|---|---|
| **Moradia** | Aluguel · Condomínio · Financiamento do imóvel · IPTU · Manutenção e reparos · Móveis e decoração · Seguro residencial · Diarista / faxina |
| **Contas da casa** | Luz · Água · Gás · Internet · Celular · TV a cabo |
| **Mercado** | Compra do mês · Compra avulsa · Hortifrúti · Açougue · Padaria · Atacarejo |
| **Alimentação fora** | Restaurante · Delivery (iFood, Rappi) · Lanche · Café · Bar · Marmita |
| **Transporte** | Combustível · App de corrida (Uber, 99) · Ônibus / metrô · Estacionamento · Pedágio · Manutenção do carro · Seguro do carro · IPVA / licenciamento · Multa · Financiamento do carro |
| **Saúde** | Farmácia · Plano de saúde · Consulta · Exames · Dentista · Terapia · Ótica |
| **Cuidados pessoais** | Cabelo · Unha · Estética · Cosméticos · Academia |
| **Educação** | Mensalidade · Curso · Livros · Material escolar |
| **Filhos** | Escola · Fraldas e higiene · Roupas · Brinquedos · Babá / creche · Mesada |
| **Pets** | Ração · Veterinário · Banho e tosa · Petshop |
| **Compras** | Roupas · Calçados · Eletrônicos · Casa e utilidades · Presentes · Lojas online (Shopee, Mercado Livre, Amazon) |
| **Lazer** | Cinema / shows · Viagem · Hospedagem · Passeios · Jogos · Hobbies |
| **Assinaturas** | Streaming · Música · Apps e nuvem · IA · Clube / revista |
| **Trabalho** | Ferramentas · Material · Coworking · MEI / impostos do trabalho |
| **Impostos e taxas** | Imposto de renda · Tarifas bancárias · IOF · Taxas de cartório |
| **Dívidas e juros** | Empréstimo · Parcelamento de fatura · Juros · Multa por atraso · Cheque especial |
| **Doações e ajuda** | Família · Igreja / dízimo · Doação · Vaquinha |
| **Seguros** | Vida · Outros seguros |
| **Saque** | Dinheiro em espécie |

### Entradas
| Categoria | Subcategorias |
|---|---|
| **Salário** | Salário · Adiantamento · 13º · Férias · PLR / bônus · Hora extra |
| **Trabalho por conta** | Freelance · Serviços · Comissão · Vendas · MEI |
| **Benefícios** | Vale-refeição · Vale-alimentação · Vale-transporte · Auxílio do governo |
| **Investimentos** | Rendimento · Dividendos · Resgate |
| **Reembolso e estorno** | Estorno de compra · Reembolso · Cashback |
| **Recebido de pessoas** | Família · Amigos · Divisão de conta |
| **Outras rendas** | Aluguel recebido · Venda de algo usado · Prêmio |

### Movimentos que NÃO são gasto nem ganho (ficam fora dos totais)
| Categoria | Para quê |
|---|---|
| **Transferência entre contas** | Dinheiro passando de uma conta minha para outra |
| **Pagamento de fatura** | Já contado nas compras do cartão; não pode contar duas vezes |
| **Guardar / aplicar** | Dinheiro indo para investimento ou meta |
| **Resgatar** | Dinheiro voltando de investimento ou meta |

> Hoje a lista em `src/lib/store.ts` (`CATEGORIAS`) tem 14 saídas e 6 entradas, e o `Lancamento` já tem `subcategoria`. A nova lista substitui essa, e os lançamentos antigos são convertidos (ex.: "Contas" → "Contas da casa").

---

## 7. Novo lançamento (o dia a dia)

O formulário atual (`FormLancamento.tsx`) continua igual: tipo, valor, descrição, categoria, conta, situação.

O que muda é o que acontece **depois**:

1. O lançamento à mão fica marcado **"Aguardando o banco"** (ícone de relógio).
2. Quando chega o extrato, o app procura o par: mesma conta, mesmo tipo, valor igual (ou bem próximo) e data a até 5 dias.
3. Achou → **junta os dois em um só** (nunca duplica):
   - Valor, data e situação: **do banco** (o banco manda)
   - Nome e categoria: **os que a pessoa escreveu**, e isso **vira regra** (seção 5)
   - O relógio some: "Confirmado pelo banco"
4. Não achou em 10 dias (para contas conectadas) → pergunta: "Não encontrei 'Almoço R$ 35' no extrato do Nubank. Foi em dinheiro? / Apagar / Manter".
5. Dinheiro em espécie e contas sem conexão: o lançamento à mão é a verdade (não há banco para conferir).

---

## 8. O que sai do app (fim das divergências)

| Hoje | Novo |
|---|---|
| **Questionário de boas-vindas** (`/boas-vindas`) pergunta objetivos, situação, renda, sonhos, reserva, e cria dados | Vira **tutorial de uso**: 4 a 5 telas mostrando como conectar o banco, onde ver os gastos, como mudar nome/categoria, como usar o Novo lançamento. **Não cria nenhum dado.** Só pergunta o nome (para chamar a pessoa e reconhecer transferências para si mesma). |
| Envio de extratos dentro do questionário (`BoasVindasExtratos`) | Sai. O extrato só entra pela aba Contas. |
| **Saldo digitado** na conta | Sai. Saldo vem do banco/arquivo. |
| **Aba Renda** com fontes cadastradas à mão (valor, dia, adiantamento, 13º, férias, benefícios) | Renda é **descoberta pelo extrato** (Etapa 5). A tela vira só leitura: "O que entrou e o que deve entrar". A pessoa pode renomear a fonte, não inventar valores. |
| **Aba Fixos** com cadastro manual | Fixos são **descobertos pelo extrato**. A pessoa pode confirmar, renomear, recategorizar ou dizer "não é fixo". Não cadastra valor à mão. |
| Leitura de prints (Tesseract/OCR) | Sai (pouca precisão). Fica: conexão, OFX/CSV/PDF. |
| "Saldo em conta hoje" no Início | Vai para Contas (único lugar). |
| Cadastrar compra no cartão à mão (`FormCompra`) | Só para cartões **sem** conexão. Com conexão, as compras vêm do banco. |
| Mercado lança gasto próprio | O Mercado continua para listas e itens, mas **não cria lançamento**: a compra vem do extrato, e a pessoa só liga "esta compra do Assaí foi a compra do mês". |
| Trilha / metas | Continuam (são planos, não registros). O "quanto já guardei" passa a vir das movimentações "Guardar/aplicar". |

---

## 9. O app enxuto: o que fica em cada aba

Regra: **cada informação em um lugar só.**

| Aba | Mostra | Não mostra |
|---|---|---|
| **Início** | Para onde foi o dinheiro este mês (por categoria) · Entrou x saiu no mês · Próximos pagamentos (7 dias) · Aviso "N para revisar" · Botão **Novo lançamento** | Saldos, faturas, limites (isso é de Contas) |
| **Contas** | Tudo da seção 4: saldo, débito, crédito, faturas, limite, movimentações por conta, conectar banco | Análises e gráficos |
| **Resumo** | Análise dos meses: categorias ao longo do tempo, renda descoberta, recorrentes, assinaturas, parcelas, comparações ("gastou 30% a mais em delivery que a média") | Lista de movimentações (isso é de Contas) |
| **Trilha** | Metas e sonhos | — |
| **Configurações** | Perfil, tema, "Coisas que o NAXXO aprendeu" (regras), categorias próprias, bancos conectados/consentimentos, apagar dados | — |

**Renda** e **Fixos** deixam de ser abas separadas e viram seções do **Resumo** (são resultado da leitura, não cadastros). **Mercado** fica no topo, como hoje.

---

## 10. O fluxo completo

```
PRIMEIRA VEZ
Entrar/criar conta
  → Tutorial (4-5 telas, só pergunta o nome)
  → Contas → "Conectar banco" (ou enviar arquivo com 6+ meses)
  → Autoriza no app do banco
  → NAXXO lê 6 a 12 meses
       1. Organiza      2. Aplica regras da pessoa
       3. Reconhece o certeiro (transferências, faturas, parcelas, estornos)
       4. IA categoriza o resto (sem "Outros")
       5. Descobre padrões (renda, fixos, assinaturas, parcelas)
  → Tela "O que encontrei" + "N para revisar"
  → Início já mostra para onde vai o dinheiro

DIA A DIA
Gastou em dinheiro ou quer registrar antes do banco → Novo lançamento ("Aguardando o banco")
Banco atualiza sozinho → itens novos entram categorizados
  → lançamento à mão encontra o par → junta e aprende
Mudou nome/categoria de algo → vira regra → vale para os próximos
```

---

## 11. Ordem de construção sugerida

1. **Categorias novas + subcategorias** e conversão das antigas (base de tudo).
2. **Memória de regras** (seção 5) funcionando com o import de arquivo que já existe. Já resolve "mudei o nome e não lembrou".
3. **Reconhecimentos certeiros** (Etapa 3): transferência entre contas, fatura, estorno, parcelas.
4. **IA na leitura** (Etapa 4) + fila "Para revisar". Fim do "Outros".
5. **Padrões** (Etapa 5): renda e fixos descobertos.
6. **Reorganizar telas:** questionário → tutorial; saldo para Contas; Renda e Fixos para o Resumo; débito/crédito separados em Contas.
7. **Junção do Novo lançamento com o extrato** (seção 7).
8. **Conexão com banco (Open Finance via agregador)**: depende de escolher o agregador, contrato e custos. Por isso fica por último, e tudo antes já funciona com arquivo.

---

## 12. Decisões que dependem da Emilly

- [ ] Qual agregador (Pluggy, Belvo…) depois de comparar preço e bancos.
- [ ] Quanto custo de IA por pessoa é aceitável (e se vale testar o Haiku, mais barato).
- [ ] Conexão bancária só para quem tem login: ok?
- [ ] O que fazer com os dados de quem já usa (respostas do questionário, fontes de renda e fixos cadastrados à mão): converter, ou apagar e reler pelo extrato?
- [ ] Mercado deixar de criar lançamento próprio: ok?
