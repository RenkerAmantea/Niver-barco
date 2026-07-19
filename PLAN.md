# Plano: Perfis por aparelho — Niver Barco

> Criado em 2026-07-19. Status: execução.

## Objetivo

Permitir que mais de uma pessoa use o mesmo aparelho sem perder o acesso aos perfis já criados, mantendo o login simples do evento.

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

Concluído. QA em produção confirmou: lista com dois perfis, entrada em um perfil, logout preservando ambos e remoção local de somente um atalho. `pnpm typecheck`, `pnpm build` e HTTP 200 passaram.
