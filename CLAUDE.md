@AGENTS.md

# NAXXO Finanças: como trabalhar neste projeto

- A dona (Emilly) é iniciante: explique sempre em português simples, curto e direto. Seja rápido e econômico.
- Identidade visual: escuro, rosa #FF4ED8, roxo, azul; fontes Montserrat/Inter. Ícones: Phosphor (via `ICONES` em `src/components/icones-mapa.ts` e `<Icone e="emoji" />`); não use emojis soltos na interface.
- Publicar = mandar para a branch `main` do GitHub: a Vercel publica sozinha em naxxo.com.br. Se estiver numa branch, ao terminar faça o merge na `main` (ou abra um PR e avise que precisa aprovar).
- Antes de mandar, sempre: `npx tsc --noEmit` (sem erros, fora avisos de LayoutProps) e `npx eslint src --quiet`. Código quebrado derruba a publicação.
- Formatação: `npx prettier --print-width 130 --write <arquivos>`.
- Dados ficam no navegador (`src/lib/store.ts`, `criarDado`) e são copiados para o Supabase só em naxxo.com.br (`src/lib/nuvem.ts`).
- Temas: NÃO edite `src/lib/temas.ts`, o bloco de temas no fim do `globals.css` nem `public/temas/*.svg` à mão. Mude `scripts/temas/gerar-temas.js` / `scripts/temas/cenas.js` e rode `node scripts/temas/gerar-temas.js`. Cena nova vai no FIM (os desenhos usam números sorteados em sequência; mudar a ordem muda os outros temas) e use `T.splice` para a posição na tela.
- Segurança: nunca coloque chaves no código nem faça commit de `.env*`. Não use nada do projeto P3urb.
- Commits terminam com: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
