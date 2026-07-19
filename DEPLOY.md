# Deploy e domínios — Renker Niver a bordo

## Regra de ouro

Há um único app e um único deployment de produção. Os dois domínios abaixo devem apontar para esse mesmo deployment:

- Canônico para novos convites: `https://renker-niver-barco.vercel.app`
- Legado, só para preservar links/PWAs antigos: `https://niver-barco.vercel.app`

O domínio legado faz a ponte de perfis locais para o canônico. Ele não deve receber deploy independente nem ser usado como origem para novos convites.

## Checklist obrigatório de publicação

1. Rodar `pnpm typecheck` e `pnpm build`.
2. Publicar uma vez em produção.
3. Apontar **ambos** os aliases para o mesmo URL de deployment:

   ```bash
   npx vercel alias set <deployment-url> renker-niver-barco.vercel.app
   npx vercel alias set <deployment-url> niver-barco.vercel.app
   ```

4. Conferir que ambos os HTMLs referenciam o mesmo `/assets/index-*.js`.
5. Conferir `/sw.js` nos dois domínios e navegar em `/admin` sem credenciais: o conteúdo não pode aparecer.

## Cache/PWA

- `sw.js` usa `skipWaiting` e `clients.claim`.
- Conteúdo online sempre vem da rede; o cache é só contingência offline para shell e assets.
- O app consulta atualizações no foco e uma vez por minuto. Se um browser segurar uma versão, o botão “Atualizar app” é a rota de recuperação.
