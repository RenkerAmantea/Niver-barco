# Plano: Ajustes de lançamento — Niver Barco

> Criado em 2026-07-19. Status: execução.

## Objetivo

Concluir ajustes de lançamento do convite: perfis locais, identidade “Renker Niver a bordo”, URL final e limpeza segura dos dados de teste, preservando a conta administrativa.

## Sucesso =

- [ ] Todo perfil usado neste aparelho aparece na tela de entrada após logout.
- [ ] Tocar em um perfil restaura exatamente aquela sessão.
- [ ] Um perfil pode ser removido somente deste aparelho, sem apagar dados do evento.
- [ ] Build e fluxo mobile de alternância entre dois perfis passam no QA.

## Tarefas

### Fase 1: Sessões locais

- [x] **T1.1** — Substituir o registro de último perfil por uma lista local deduplicada por ID.
  - Verificação: salvar duas sessões resulta em dois perfis persistidos; salvar novamente um deles não duplica.
  - Estimativa: 10 min
  - Depende de: nenhuma

- [x] **T1.2** — Mostrar os perfis do aparelho na entrada e permitir entrar/esquecer.
  - Verificação: cada item restaura o perfil correto e “Esquecer” remove apenas o item local.
  - Estimativa: 15 min
  - Depende de: T1.1

### Fase 2: Verificação

- [x] **T2.1** — Rodar typecheck/build e QA do fluxo de troca de perfil.
  - Verificação: build verde; criar/salvar/sair/retomar dois perfis funciona sem duplicação.
  - Estimativa: 15 min
  - Depende de: T1.2

## Riscos

- Em aparelho compartilhado, a lista facilita entrar em perfis existentes. Mitigação: “Esquecer deste aparelho”; não afeta banco nem convites por link.

## Estado atual

Perfis locais concluídos. Nova fase em andamento.

### Fase 3: Fechamento de lançamento

- [x] **T3.1** — Trocar os títulos das telas de entrada e evento para “Renker Niver a bordo” e remover os contadores da entrada.
  - Verificação: título novo aparece nas duas telas e cabe em 390px.
  - Estimativa: 10 min
  - Depende de: nenhuma

- [x] **T3.2** — Limpar conteúdo de teste com preservação comprovada do perfil e credenciais admin.
  - Verificação: fica só a conta admin e seus dois marcadores internos; posts, reações, respostas, inscrições push, avisos e fotos de teste ficam zerados.
  - Estimativa: 30 min
  - Depende de: T3.1

- [x] **T3.3** — Renomear a URL de produção para `renker-niver-barco.vercel.app` e validar os dois endereços.
  - Verificação: novo domínio responde 200; endereço antigo continua compatível e também responde 200.
  - Estimativa: 10 min
  - Depende de: T3.2

## Estado final

Fase 3 concluída. Produção limpa, perfil administrativo Renker preservado e novo endereço público validado.

### Fase 4: Recuperação entre navegador e PWA

- [x] **T4.1** — Garantir que o service worker seja sempre publicado e que a ativação de push recupere de uma instalação antiga que recebeu `sw.js` 404.
  - Verificação: `GET /sw.js` responde JavaScript 200 no domínio canônico; registro testa o arquivo antes de tentar ativar push.
- [x] **T4.2** — Criar autenticação leve por nome + senha, armazenando somente hash com salt no backend.
  - Verificação: perfil novo exige senha; mesmo nome + senha entra no mesmo ID em uma sessão limpa; senha incorreta não revela nem cria outro perfil.
- [x] **T4.3** — Manter atalhos de perfis do aparelho como conveniência e adequar a tela de entrada.
  - Verificação: atalhos continuam funcionando, criação/login têm mensagens claras e o layout móvel não corta controles.
- [x] **T4.4** — QA de regressão e publicação única nos dois aliases.
  - Verificação: build/typecheck, chamadas de auth, `sw.js` e produção passam.

## Estado atual

Fase 4 concluída. Os aliases `renker-niver-barco` e `niver-barco` estão no mesmo deployment (`index-BOql0hc5.js` e `sw.js` v8); QA remoto confirmou `sw.js` 200 nos dois, login com senha correto 200, senha errada 401 e remoção do perfil temporário de QA.

### Fase 5: Usabilidade dos convites individuais

- [x] **T5.1** — Exibir o link recém-gerado inteiro em um campo acessível e permitir copiá-lo por um botão explícito.
  - Verificação: após gerar, o URL não é truncado e o botão copia o valor com feedback de sucesso/erro.
  - Estimativa: 10 min
  - Depende de: nenhuma

- [x] **T5.2** — Rodar typecheck/build e inspeção visual mobile do card de convite.
  - Verificação: painel continua responsivo em 390px; não há rolagem horizontal nem erro de console.
  - Estimativa: 10 min
  - Depende de: T5.1

## Estado atual

Fase 5 concluída. O painel agora preserva o URL completo em campo selecionável, com ação explícita de cópia e feedback. Typecheck/build do app passaram; QA em produção confirmou o painel administrativo em viewport 390px, sem erros de console. Os dois aliases foram conferidos com cache-buster e retornam o mesmo bundle `index-BuW1lMCr.js`.
