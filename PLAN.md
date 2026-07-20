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

### Fase 6: Regressão de entrada e avatar

- [x] **T6.1** — Corrigir a criação por convite para persistir um avatar náutico aleatório, no mesmo conjunto usado pelo login normal.
  - Verificação: convite novo retorna e salva `avatarUrl` não vazio; abrir o link mostra o avatar no perfil e no mural.
  - Estimativa: 15 min
  - Depende de: nenhuma

- [x] **T6.2** — Investigar e corrigir o bloqueio do CTA “Entrar no Evento” no fluxo nome + senha.
  - Verificação: em uma sessão limpa, nome e senha válidos habilitam o CTA e concluem o login/criação.
  - Estimativa: 20 min
  - Depende de: nenhuma

- [x] **T6.3** — Validar ambos os fluxos em produção e publicar apenas após o QA.
  - Verificação: build/typecheck do app, screenshot mobile e chamadas reais passam; dados temporários de QA são removidos.
  - Estimativa: 15 min
  - Depende de: T6.1, T6.2

## Estado atual

Fase 6 concluída. Convite novo recebeu avatar persistido; convite legado sem avatar é preenchido no primeiro acesso. Login normal e criações diretas também recebem fallback seguro. No QA em produção: convite retornou avatar, login novo retornou avatar, senha de 3 caracteres retornou 400 com alerta visível e todos os perfis de QA foram apagados. Os aliases retornam `index-LWodt2Ht.js` com cache-buster.

### Fase 7: Operação de convites e aguardando resposta

- [x] **T7.1** — Encurtar o trecho secreto dos links para um token seguro e legível ao lado do nome, sem reduzir a segurança a quatro dígitos previsíveis.
  - Verificação: convite novo usa URL com slug legível + código curto aleatório; convite inválido continua bloqueado.
  - Estimativa: 15 min
  - Depende de: nenhuma

- [x] **T7.2** — Ajustar a cópia para que “Copiado” apareça somente após ação explícita e permitir gerar um novo link para convites antigos.
  - Verificação: gerar convite não muda o botão para “Copiado”; cada convite listado oferece novo link e o novo URL é copiável.
  - Estimativa: 20 min
  - Depende de: T7.1

- [x] **T7.3** — Exibir no painel a lista privada de aguardando resposta, incluindo convites ainda não abertos e contas criadas sem RSVP, com remoção segura.
  - Verificação: a lista não aparece publicamente; os dois tipos ficam visíveis e o botão de apagar protege a conta do capitão.
  - Estimativa: 25 min
  - Depende de: T7.2

- [x] **T7.4** — QA de API, desktop e mobile, com limpeza de dados temporários.
  - Verificação: build/typecheck passam; fluxos de URL/cópia/aguardando passam em produção; aliases usam o mesmo bundle.
  - Estimativa: 20 min
  - Depende de: T7.1, T7.2, T7.3

## Estado atual

Fase 7 concluída. Convites novos usam nome + 8 caracteres aleatórios (48 bits); “Copiado” só aparece depois do toque; convites antigos têm “Novo link”; e a lista privada separa convites ainda não abertos de contas pendentes comuns, sem duplicar. QA de API confirmou rotação (URL antiga 404, nova válida), avatar, limpeza dos testes e bundle idêntico nos dois aliases; QA visual mobile confirmou o fluxo de geração e cópia.

### Fase 8: Ativação segura de convite e auditoria de push

- [x] **T8.1** — Trocar a abertura automática do convite por uma tela de boas-vindas que cria a senha antes de ativar o perfil.
  - Verificação: primeiro acesso não cria sessão sem senha; senha válida ativa o perfil; segundo acesso ao mesmo URL não revela nem entra no perfil.
- [x] **T8.2** — Ajustar o FAQ para encaminhar acompanhante ao link público normal com cópia fácil.
  - Verificação: FAQ mostra o URL público e o botão copia com feedback.
- [x] **T8.3** — Encerrar o código privado em quatro dígitos com proteção anti-tentativa e revisar os links existentes.
  - Verificação: novo link tem nome + quatro dígitos; tentativas excessivas são bloqueadas; links antigos continuam válidos até renovados.
- [x] **T8.4** — Auditar inscrições push e a contagem do admin, expondo diagnóstico privado e corrigindo o motivo de `0 aparelhos`.
  - Verificação: painel mostra aparelhos inscritos; envio de teste retorna contagem consistente ou explica o bloqueio concreto.
- [x] **T8.5** — QA de API, desktop/mobile, produção e limpeza dos dados temporários.
  - Verificação: build/typecheck passam; convite, FAQ e push passam em produção; aliases têm o mesmo bundle.

## Estado atual

Fase 8 concluída. Em produção, convite novo segue o formato `nome-1234`, pede senha antes de ativar e se torna inacessível pelo mesmo URL após a ativação. O FAQ oferece cópia do link público normal. A auditoria de push confirma VAPID configurado e par de chaves consistente; a contagem atual é realmente zero inscrições salvas, e o admin deixa isso explícito em vez de fingir entrega. QA real: convite de 4 dígitos criado, senha curta recusada, ativação válida concluída, segundo acesso devolveu 409, FAQ/cópia inspecionados, aliases com o mesmo bundle e perfil temporário removido.
