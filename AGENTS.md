# Convenções da Croebet

## Referências e responsabilidades

- Este arquivo define como desenvolver e manter o código. Conceito, identidade, linguagem, moeda, economia e direção das funcionalidades têm como referência `CROEBET.md`; consulte-o antes de alterar conteúdo, design ou funcionalidades e não replique suas definições aqui.
- `docs/frontend-architecture.md` detalha a implementação atual e traz exemplos de componentes, composição e cenas 3D. Detalhes do protótipo não devem ser tratados como decisões definitivas de produto.
- Preserve `CROEBET.md`. Não exclua, substitua ou reduza esse documento durante refatorações, limpezas ou reorganizações. Sua remoção exige uma solicitação explícita do usuário.

## Stack e arquitetura

- Next.js App Router, React, TypeScript, Tailwind CSS 4, GSAP e Lenis. Preserve a stack e as funcionalidades existentes.
- `app/`: rotas, metadata e composição de páginas. Use Server Components por padrão.
- `components/ui/`: primitives do design system, no padrão shadcn/ui, com Radix UI para interação acessível.
- `components/layout/`: navegação, sidebar, topbar, rodapé, providers e estrutura de página.
- `components/shared/`: componentes visuais reutilizáveis do produto, independentes de estado de domínio.
- `features/<domínio>/`: componentes, tipos, estado, regras e persistência de cada funcionalidade.
- `lib/`: utilitários sem dependência de features. Importe `cn` de `@/lib/utils`.
- `three/`: experiências 3D opcionais, separadas por canvas, cenas, modelos, materiais, iluminação e controles.
- Crie `hooks`, `types` e `styles` apenas quando houver conteúdo realmente compartilhado. Evite pastas vazias, barrels e abstrações especulativas.
- Use o alias `@/` nos imports entre diretórios. Client Components devem ser as menores fronteiras interativas necessárias; passe conteúdo do servidor como `children`.
- O provider de sessão é exclusivo da demonstração local. Não é autenticação de produção. Preserve as chaves `croebet:demo-username` e `croebet:demo-wallet:<nome>` ao refatorar.

## Design system

- Antes de criar uma solução específica, procure e reutilize um componente em `components/ui` ou `components/shared`.
- Use `Button` para controles e CTAs, `Input` e `Field` para formulários, `Card` para superfícies, `Dialog` para modais e drawers, `DropdownMenu` para menus, `Tooltip` para dicas e `toast` de `sonner` para feedback.
- Links com aparência de botão usam `<Button asChild><Link ... /></Button>`. Não aninhe botões e links.
- Não use tags `button`, `input`, `textarea` ou `select` diretamente fora de `components/ui`. O lint aplica essa regra às páginas e aos componentes de produto.
- Adicione novos primitives como Textarea, Select, Checkbox, RadioGroup e Tabs somente quando uma funcionalidade os utilizar. Use Radix e composição shadcn para interações complexas; não instale a biblioteca inteira.
- Defina variantes reutilizáveis com `class-variance-authority`. Use `cn()` com `clsx` e `tailwind-merge` para combinar classes e permitir overrides.
- `Button`: variantes `default`, `secondary`, `outline`, `ghost`, `destructive`, `link`; tamanhos `default`, `sm`, `lg`, `icon`, `icon-sm`. Use `loading` e `disabled` nos botões de ação.
- Campos e botões padrão têm altura mínima de 2.75rem. Altura mínima permite quebra de linha e ampliação de fonte.
- Estados de teclado alteram apenas a borda dos controles. Sem focus rings ou bordas coloridas decorativas em modais e dropdowns.
- Preserve o gradiente e a sombra interna dos controles primários e da Croin. Respeite `prefers-reduced-motion`.
- Preserve o layout, imagens, textos, animações e comportamento existentes; uma refatoração não autoriza redesign.

## Estilos e tokens

- Use Tailwind CSS nos próprios componentes. Não crie classes globais `.button`, `.input`, `.card`, `.modal` ou equivalentes, nem regras CSS para componentes de layout.
- `app/globals.css` contém somente o import Tailwind, tokens `@theme`, variáveis fundamentais e estilos globais de base.
- Cores, tipografia fluida, espaçamentos especiais, bordas, raios, sombras e gradientes são tokens. Utilize a escala Tailwind para os demais espaçamentos.
- Implemente a cor principal definida em `CROEBET.md` no token `--color-brand`. Use `brand` no logo e nos botões primários. Não espalhe hexadecimais em TSX, inclusive materiais 3D.
- Use `rem` nas dimensões próprias, preferindo passos de 0.25rem; preserve proporções de arte e tamanhos fluidos quando necessários ao design existente. Viewports e proporções de imagem podem usar porcentagens, `vw`, `dvh` e `cqi`.
- Consultas de container da sidebar ficam nas classes Tailwind do componente, sem seletores globais acoplados ao DOM.

## Acessibilidade e ícones

- Use Phosphor Icons (`@phosphor-icons/react`). Importe cada ícone por `/dist/ssr` em Server Components e `/dist/csr` em Client Components.
- Peso regular nos controles e `fill` nas ilustrações; tamanho e cor via Tailwind. Marque ícones decorativos com `aria-hidden` e dê nome acessível aos botões de ícone.
- Mantenha labels, títulos e descrições de diálogos, foco inicial, fechamento por Escape, retorno do foco e navegação por teclado. Prefira os mecanismos do Radix a implementações manuais.
- Use `data-lenis-prevent` em portais com rolagem própria. Não duplique controle global de scroll ou focus traps.

## 3D

- React Three Fiber é o padrão para novas experiências. Não migre jogos existentes automaticamente.
- Carregue cenas com `next/dynamic({ ssr: false })` em uma fronteira cliente. Siga o exemplo em `three/scenes/croin-preview.tsx`.
- Não importe o renderer 3D no layout, nos providers ou nos componentes UI. Não monte Canvas global e não inicie loops antes de a experiência ser solicitada.
- Use `SceneCanvas`, `frameloop="demand"`, DPR limitado, Suspense e fallback para falta de WebGL ou erro. Não adicione `useFrame` sem animação real.
- Evite setState por frame. Se precisar animar, atualize refs e invalide apenas quando necessário; modelos e materiais devem ter ownership e descarte claros.
- Leia a cor da marca do token CSS. Reutilize luzes, controles e modelos de `three/`, sem regras de domínio nos primitives.

## Validação

- Preserve as validações e os contratos de dados existentes ao refatorar; consulte os detalhes de estado e persistência em `docs/frontend-architecture.md`.
- Execute `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build`. Para mudanças interativas, execute `pnpm test:e2e` com Chrome instalado.
- Não ignore erros de TypeScript/build nem desative regras globalmente para fazer a validação passar.
