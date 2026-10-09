# Pesquisa: IA na leitura do extrato e conexão direta com o banco (Open Finance)

> Feita em 09/10/2026. Complementa o `NOVO-SISTEMA.md` (etapas 4 e 8). Preços mudam: confira nos links antes de decidir.

---

## 1. IA para categorizar (etapa 4)

### O que faria
Só os itens que o app **não** reconheceu com certeza (os que hoje vão para "Para revisar") seriam enviados para a IA (Claude, da Anthropic). Ela devolve, num formato fixo: nome limpo, categoria, subcategoria, natureza (gasto, transferência…), confiança (alta/média/baixa) e um motivo curto.
O que a pessoa já ensinou (regras) e o que as palavras-chave já reconhecem **não** passam pela IA, então com o tempo ela é chamada cada vez menos.

### Preço (API da Anthropic, por 1 milhão de "tokens"; 1 transação ≈ 40 a 60 tokens)
| Modelo | Entrada | Saída | Observação |
|---|---|---|---|
| Claude Opus 5.5 | US$ 4 | US$ 20 | O mais capaz (padrão) |
| Claude Sonnet 5.5 | US$ 2 | US$ 10 | Meio-termo |
| Claude Haiku 4.5 | US$ 1 | US$ 5 | O mais barato |

- **Lote (Batch API):** metade do preço; a resposta demora alguns minutos. Bom para a primeira leitura grande.
- **Cache:** as instruções e a lista de categorias (iguais em toda chamada) ficam em cache e custam cerca de 10% nas chamadas seguintes.

### Estimativa por pessoa (se TODOS os itens fossem para a IA; na prática só os incertos vão)
| Situação | Opus 5.5 | Opus 5.5 em lote | Haiku 4.5 | Haiku 4.5 em lote |
|---|---|---|---|---|
| Primeira leitura (6 a 12 meses, ~1.000 transações) | ~US$ 1,40 | ~US$ 0,70 | ~US$ 0,36 | ~US$ 0,18 |
| Um mês de uso (~100 transações) | ~US$ 0,14 | ~US$ 0,07 | ~US$ 0,04 | ~US$ 0,02 |

Como só os incertos vão (normalmente 20% a 40% depois das palavras-chave e regras), o custo real fica bem abaixo disso.

### Como liga no app (já planejado)
1. Uma rota no servidor da Vercel (`/api/classificar`) chama a IA. A **chave fica só na Vercel**, nunca no navegador nem no GitHub.
2. Só funciona com login (naxxo.com.br), com limite de uso por pessoa (para ninguém gastar a sua conta).
3. Vai para a IA só: descrição do banco, valor, data e tipo. **Não** vai CPF, número de conta, agência nem e-mail.
4. LGPD: a política de privacidade passa a dizer que as descrições do extrato são enviadas para a Anthropic para categorizar.

### O que você precisa fazer para ligar
1. Criar conta em **console.anthropic.com** → **Billing**: colocar crédito (US$ 5 já dá para testar bastante) e definir um **limite de gasto mensal**.
2. **API Keys** → criar uma chave.
3. Na **Vercel** → projeto → Settings → Environment Variables → `ANTHROPIC_API_KEY` = a chave. (Não mande a chave no chat.)
4. Me avisar: eu faço a rota, ligo na fila "Para revisar" e testo com uma amostra antes de deixar para todos.

**Sugestão:** começar com o **Haiku 4.5** em lote na primeira leitura, comparar a qualidade com o Opus 5.5 numa amostra real e decidir.

---

## 2. Conexão direta com o banco (Open Finance, etapa 8)

O NAXXO não pode se ligar sozinho ao Open Finance (precisaria de licença do Banco Central). O caminho é um **agregador** já autorizado.

| Opção | Preço encontrado | Observações |
|---|---|---|
| **Pluggy** | Dados a partir de **R$ 2.500/mês** (mínimo mensal com volume incluso; excedente por requisição). Teste grátis de 15 dias em produção, sem cartão. | Brasileira, muito usada por apps pequenos; widget pronto; já entrega categorização e enriquecimento (poderia até dispensar parte da IA). Lucrativa, Série A em 2026. |
| **Meu Pluggy** | **Grátis** | Para a própria pessoa conectar as próprias contas (uso pessoal e testes de desenvolvedor). Serve para prototipar com os seus bancos, não para os usuários do app. |
| **Belvo** | ~**R$ 6.000/mês** (relato de desenvolvedor) | Latino-americana, mais voltada a empresas maiores. |
| **Tecnospeed** | ~**R$ 1.500 de entrada + R$ 540/mês** (relato de desenvolvedor) | A mais barata dos pacotes; preço oficial não é público. |
| **Banco MCP** | A partir de **R$ 19,90/mês por conta conectada** | Revende a Pluggy por conexão (paga conforme usa). Viável no começo, mas é um intermediário pequeno: risco de depender dele. |
| Klavi, Finansystech (Celcoin), Akropoli, Lina Open X | Sob consulta | Alternativas brasileiras para comparar. |

### Recomendação
1. **Agora:** continuar com o arquivo (OFX, CSV e agora **PDF**), que é grátis. O app já faz tudo com ele (padrões, regras, saldo).
2. **Testar sem custo:** usar o **Meu Pluggy** e o **teste de 15 dias da Pluggy** para validar com os seus próprios bancos (eu integro o widget num ambiente de teste).
3. **Ligar para os usuários quando fizer sentido financeiro:** com R$ 2.500/mês, seriam ~250 pessoas pagando R$ 10/mês só para cobrir. Antes disso, o modelo por conexão (tipo Banco MCP, ~R$ 20 por conta) pode virar um **plano pago** ("conexão automática") em que a pessoa paga a própria conexão.
4. **Antes de ligar:** login obrigatório, tela de consentimento clara, política de privacidade (LGPD) e o botão "Desconectar banco e apagar meus dados bancários".

### Mais a fundo: Meu Pluggy e Banco MCP (pesquisa de 09/10/2026)

**Meu Pluggy (grátis)**
- É o app da própria Pluggy onde a pessoa conecta os bancos dela por Open Finance e gerencia os consentimentos. Para desenvolvedor, existe o conector "Meu Pluggy": o seu app (cadastrado no dashboard.pluggy.ai, com client_id e client_secret) pede autorização e lê os dados.
- Grátis: o dashboard dá 15 dias de teste, mas o conector Meu Pluggy continua funcionando depois que o teste acaba (relato de desenvolvedores).
- **O porém:** cada usuário do NAXXO teria que **criar conta no Meu Pluggy e conectar os bancos lá primeiro**, e só depois autorizar o NAXXO. São dois cadastros e dois consentimentos, uma barreira grande para gente leiga.
- Não há documento dizendo se a Pluggy limita ou permite esse uso com muitos usuários de outro app (a documentação é antiga). Risco: a Pluggy pode cortar ou passar a cobrar.
- **Bom para:** testar agora, de graça, com os seus bancos; e, talvez, oferecer como "modo avançado" para quem não se importar com o cadastro a mais.

**Banco MCP (R$ 19,90/mês)**
- Feito para **assistentes de IA** (Claude, ChatGPT, Cursor) lerem o banco da pessoa via MCP, e não para outros apps. Roda a Pluggy por trás.
- Planos para a pessoa física: grátis (10 consultas por dia), **R$ 19,90/mês (1 banco)**, R$ 29,90 (3 bancos), R$ 49,90 (5 ou mais).
- Operado pela **DL WEB LTDA**; o servidor é fechado (só os manuais são abertos, licença MIT). Somente leitura; limite de 2 requisições por segundo; até 5.000 transações por consulta.
- Integra por **OAuth 2.1**. Ou seja: cada usuário do NAXXO teria que **assinar o Banco MCP** e autorizar o NAXXO a ler. O custo vai para o usuário, e o NAXXO passa a depender de uma empresa pequena e de termos que não falam de uso por outros apps.
- **Bom para:** um "plano conexão automática" em que a própria pessoa paga a conexão. Antes disso, é preciso perguntar a eles, por escrito, se podem usar com outro app e em que condições.

**Conclusão:** nenhuma das duas resolve de graça e sem atrito para todos os usuários. A ordem que eu sugiro:
1. Testar o Meu Pluggy com os seus bancos (grátis).
2. Continuar com arquivo/PDF/print para os usuários.
3. Quando houver pagantes, contratar a Pluggy direto (mais seguro) ou negociar com eles um plano por conexão.

Fontes: https://github.com/pluggyai/meu-pluggy · https://www.tabnews.com.br/marlindo71/d39804a3-211a-4d45-8491-e4a36e85a6e8 · https://banco.mcp.ai/docs · https://github.com/douglac/banco-mcp · https://www.pluggy.ai/docs/termos-e-condicoes-de-uso.pdf

---

## Fontes
- Preços da Pluggy: https://www.pluggy.ai/precos
- Pluggy, Série A e números de 2026: https://fintech.global/2026/08/31/pluggy-secures-3-5m-to-scale-brazils-open-finance/
- Relato de preços (Pluggy, Belvo, Tecnospeed): https://www.tabnews.com.br/GuilhermeVieira/estou-desenvolvendo-um-app-de-financas-pessoais-e-nao-consigo-pagar-o-open-finance-pluggy-r2-5k-mes-belvo-r6k-mes-tecnospeed-r1-5k-de-entrada-r540
- Alternativa por conexão (Banco MCP): https://www.tabnews.com.br/GuilhermeVieira/resolvi-o-problema-do-open-finance-caro-que-postei-aqui-achei-uma-alternativa-e-ja-esta-em-producao
- Meu Pluggy (uso pessoal gratuito): https://actualbudget.org/docs/experimental/pluggyai · https://github.com/pluggyai/meu-pluggy
- Alternativas à Pluggy: https://www.openbankingtracker.com/api-aggregators/pluggy/alternatives
- Preços da API da Anthropic (modelos, lote, cache): documentação oficial da Anthropic (platform.claude.com)
