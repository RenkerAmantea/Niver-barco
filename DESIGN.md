# Niver Barco — Design System

## Direção

Noite náutica refinada: vidro escuro, dourado suave e pequenas luzes violetas/rosadas. Divertido sem parecer balada genérica ou interface SaaS.

## Tipografia

- Interface e textos: `Outfit`.
- Títulos, números e chamadas: `Syne`.
- Não introduzir outra fonte sem atualizar este documento.

## Cores

- Fundo: marinho profundo `hsl(244 59% 7%)`.
- Superfícies: vidro azul-marinho (`--card`) com borda branca em 5–12%.
- Destaque padrão: dourado `hsl(44 55% 54%)`; texto dourado claro `#fff0c8`.
- Luz complementar: violeta `#9d74ff`; rosa apenas como brilho de cena.
- Estados RSVP: vou = esmeralda, talvez = âmbar, não vou = vermelho. Nunca usar essas cores como cor estrutural da tela.

## Componentes

- Cards: `glass-card`, raio 24–32px, brilho interno de 1px, sombra ampla e discreta.
- CTAs: dourado com texto marinho; `premium-cta` somente para ação primária.
- Ações secundárias: superfície escura translúcida com borda branca baixa.
- Ícones: Lucide/SVG, 16–20px. Sem emoji como ícone de interface.
- Navegação inferior: uma superfície contínua; destaque por tom/borda, nunca “flutuando” acima dela.

## Espaçamento e movimento

- Mobile primeiro, respiro 16–24px entre blocos.
- Microinterações entre 150–300ms; não usar salto que desloque a navegação.
- Antes de publicar: QA em 390×844 e 1024px, console sem erros, sem rolagem horizontal.
