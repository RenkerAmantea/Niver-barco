# Central de notificações — especificação de entrega

## Objetivo

Todo convidado autenticado pelo perfil do convite vê seus próprios avisos no sino da barra superior. O histórico e o estado de leitura são persistidos no banco; trocar de aparelho ou atualizar a página não perde avisos.

## Interface

- Sino ao lado de **Sair**, presente em todas as páginas autenticadas.
- Badge vermelho mostra avisos não lidos (limite visual `9+`).
- Popover exibe os 40 avisos mais recentes, incluindo lidos, com data relativa, ponto de estado e destino ao toque.
- `Ler todas` marca os pendentes como lidos. Tocar em um aviso também o marca antes de navegar.
- A lista atualiza ao abrir, ao recuperar foco e a cada 30 segundos. Não existe dependência de `localStorage` para os avisos.

## Persistência e API

Para permitir a entrega hoje sem criar ou migrar uma tabela nova, notificações são registros privados na tabela existente `niver_barco_posts`, identificados pelo marcador `[[niver-notification]]`. Cada destinatário recebe seu próprio registro, associado ao `guest_id`.

- `GET /api/notifications?guestId=:id` retorna somente os avisos daquele convidado e `unreadCount`.
- `PATCH /api/notifications/:id/read` recebe `{ guestId }` e grava `readAt` somente se o registro pertence ao convidado.
- Marcadores são filtrados do mural e não aparecem como posts.

## Gatilhos entregues

- Envio da cabine `/admin`: grava o recado para todos os convidados, inclusive quem não ativou push.
- Foto nova: grava para todos os demais convidados.
- Marcação no mural: grava para os convidados marcados.
- Resposta: grava para o dono do post e para os convidados marcados.

Web Push continua complementar: é enviado para os aparelhos inscritos, mas a central interna sempre é a fonte de verdade.

## Limite conhecido de segurança

O convite atual usa seleção de perfil por nome, não autenticação com token de servidor. Por coerência, a API segue esse modelo atual: o `guestId` vem do perfil selecionado no convite. Antes de reutilizar esta arquitetura em um app privado/comercial, migrar para autenticação real e RLS no Supabase.
