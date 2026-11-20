# Frontend

Todos os caminhos de implementação abaixo são relativos a `apps/web`. Stack e versões estão em `package.json`; estado dos domínios, ambiente e testes em [backend-architecture.md](backend-architecture.md).

## Organização

| Diretório | Responsabilidade |
| --- | --- |
| `app/` | Rotas, metadata e composição; Server Components por padrão |
| `components/ui/` | Primitives shadcn/ui, Radix, CVA e controles genéricos |
| `components/layout/` | Navegação, PageShell, sidebar/topbar, rodapé, providers e Motion |
| `components/shared/` | Componentes visuais reutilizáveis, sem estado de domínio |
| `features/<domínio>/` | Componentes, estado e integração HTTP da funcionalidade |
| `lib/` | Utilitários sem dependência de features; `cn` em `@/lib/utils` |
| `three/` | Canvas, cenas, modelos, materiais, iluminação e controles opcionais |

Use `@/` entre diretórios; tipos ficam no domínio. Só crie hooks/types/styles compartilhados quando houver uso real; evite pastas vazias, barrels e abstrações especulativas. UI não importa features. Client Components são as menores fronteiras interativas necessárias; conteúdo do servidor pode entrar como `children`.

## Dados iniciais e sessão

- Consulte endpoints HTTP do Fastify no servidor para dados necessários à primeira exibição e redirecionamentos dependentes deles. Passe projeções validadas para a interface; não comece vazio/deslogado para buscar em `useEffect`.
- Reutilize os loaders `server-*` dos domínios. `API_INTERNAL_URL` é exclusivo do servidor; encaminhe somente o cookie de sessão necessário, sem enviar tokens nas props. Dados pessoais usam `no-store`, sem cache compartilhado.
- `features/auth/server-session.ts` usa `React.cache` por requisição. Sem cookie, confirma visitante; falha da API deixa a sessão indeterminada. Revalidação cliente preserva dados confirmados; falha não confirma logout, saldo zero ou lista vazia.
- Login, logout e mutações atualizam contexto e Server Components. Skeletons ficam para esperas reais; editor, localStorage e WebGL podem carregar no cliente.
- `SessionProvider`/`useSession` expõem identidade, permissões e saldo confirmados pela API; não contêm métodos nem carteiras de demonstração. Não reintroduzir fallback de contas/Croins em localStorage.
- Preferências de tema/painéis e configuração do Flip 7 continuam locais; partidas e comandos vêm da API. [Limites do jogo](flip7.md#escopo).

## Componentes e acessibilidade

- App instalável: `app/manifest.ts` define identidade, ícones e abertura standalone; metadata raiz inclui ícone e configuração Apple. `components/layout/app-install.tsx` oferece instalação quando o navegador emite `beforeinstallprompt` e orienta a instalação manual no Safari do iOS. Ocultar por 7 dias ao dispensar; não mostrar em standalone. Exige HTTPS (ou localhost). A instalação/abertura fica sob controle do navegador; jogos continuam exigindo conexão, sem cache offline de sessões ou partidas.

- Procure em `components/ui` e `components/shared` antes de criar. Adaptação de um domínio fica na feature; padrão visual comum vai para shared; controle genérico vai para ui. Não instalar primitives sem uso.
- Use `Button`, `Input`, `PasswordInput`, `Field`, `Card`, `Dialog`, `DropdownMenu`, `Tooltip` e `toast` do Sonner. Busca usa `SearchInput`; seleção de ícone usa `IconPicker`. O código do primitive é a referência de props/variantes.
- `components/shared/empty-state.tsx` padroniza listas vazias com mensagem e suporte a descrição, ícone e ação opcionais; use dentro do contêiner existente, sem duplicar cards. O componente aceita `className` e funciona no servidor e no cliente. Carregamento e erros continuam tratados pelo domínio.
- `components/shared/editable-row.tsx` apresenta rótulo, valor e lápis com modal controlado; sem formulário, mantém a altura da linha e alinha o valor à direita sem reservar espaço para o lápis. Configurações de conta e dados do usuário no admin reutilizam a mesma linha; formulário, validação e salvamento permanecem na feature. Não duplicar esse layout em cada tela.
- Sem `button`, `input`, `textarea` ou `select` nativos fora de ui; lint aplica isso às telas/componentes de produto. Links com aparência de botão: `<Button asChild><Link href="...">...</Link></Button>`; não aninhar controles interativos.
- Variantes reutilizáveis com CVA; classes com `cn()` para permitir overrides. Ações usam `loading`/`disabled`. Campos/botões padrão têm altura mínima de 2.75rem, permitindo quebra e ampliação de fonte.
- Modais de formulário: título, campos com labels e botões; sem descrições, ícones decorativos ou textos auxiliares permanentes. Validação aparece quando necessária. Sem descrição, use `aria-describedby={undefined}` em `DialogContent`.
- Radix controla foco inicial, retorno do foco, Escape e teclado. Preserve labels e nomes acessíveis. Portais com rolagem própria usam `data-lenis-prevent`; não duplicar scroll lock/focus trap.
- Lucide com imports nomeados dos ícones usados, contorno padrão, tamanho/cor via Tailwind. Ícone decorativo com `aria-hidden`; botão só de ícone com nome acessível. Catálogo completo do seletor carrega sob demanda; menus sem ícone cadastrado ficam sem ícone.

## Estilos e movimento

- Tailwind 4 nos componentes. `app/globals.css` centraliza tokens e base global; não adicionar classes globais de componentes/layout nem seletores acoplados ao DOM. Consultas de container da sidebar ficam no componente.
- O viewport raiz solicita escala fixa no celular; `touch-action: pan-x pan-y` impede gestos de zoom preservando rolagem e toques. O navegador pode manter opções próprias de ampliação por acessibilidade.
- Cores, tipografia fluida, espaçamentos especiais, bordas, raios, sombras e gradientes usam tokens. Demais espaçamentos seguem Tailwind; dimensões próprias em `rem`, preferindo passos de 0.25rem. Proporções/viewports podem usar %, vw, dvh e cqi.
- Use tokens semânticos existentes (`background`, `surface`, `foreground`, `muted`, `brand`, `contrast`) em vez de novos aliases para as mesmas cores. Controles e divisórias usam as opacidades existentes de `contrast`; não espalhar hexadecimais no TSX, inclusive 3D.
- Identidade aprovada em [CROEBET.md, seção 6](../CROEBET.md#6-identidade-visual-e-experiência). Há divergência a resolver em tarefa de design: o documento define `#AD158F`, enquanto `--color-brand` no código está em `#FF2C67`. Não alterar a aparência silenciosamente para reconciliá-los.
- Preserve gradiente e sombra interna dos primários/Croin. Foco de controles altera apenas a borda; sem focus rings ou bordas coloridas decorativas nos modais/dropdowns.
- Preserve layout, imagens, textos e comportamento ao refatorar. Página entra diretamente, sem animação de entrada; Lenis e GSAP respeitam `prefers-reduced-motion`. Cancele timers/timelines ao desmontar.
- Saldos de usuário usam `BalanceValue`/`Balance`: primeira exibição mostra o total; alterações animam por 1 segundo com ease out e indicação da diferença. Resgate de cupom fecha o modal antes de atualizar o saldo. Não duplicar animação nos consumidores.

## Administração e conteúdo

- Layout de `/admin` consulta sessão/papel no servidor; API autoriza cada operação. Seções e URLs ficam em `features/admin/routes.ts`. Entidades existentes usam UUID na interna; slugs só nos endereços públicos. O offset sticky do menu administrativo acompanha o padding superior de `PageShell`, mantendo o mesmo alinhamento em páginas curtas e longas.
- Listagens reutilizam `AdminListHeader`: ações “Criar [item]” ficam à direita da busca, na linha dos filtros, com Plus e fundo sólido primário; no mobile exibem só o ícone, com nome acessível. O header global mantém apenas o título. O conteúdo usa uma superfície com linhas/divisórias, no padrão existente. Na listagem de jogos, toda a linha abre a interna pelo UUID; exibe capa, nome e status, sem slug ou ações de edição/ativação na lista. Sidebar administrativa e painéis laterais de edição usam sticky abaixo da navbar quando há espaço.
- O topo público de entrada usa `features/games/game-entry-header.tsx`, compartilhável pelos jogos e visível também para contas autenticadas, com nome e descrição vindos do catálogo administrativo. O botão de login aparece somente para visitantes; o header aceita ações do jogo, como o botão de regras para visitantes. O lobby usa toda a largura disponível, com três colunas em telas largas e blocos empilhados no mobile. Jogos cadastrados sem implementação exibem “Em breve” no catálogo e uma página pública com nome e descrição, sem carregar lobby ou permitir partidas. Descrição vazia não exibe texto substituto; regras, tabuleiro e configurações específicas permanecem na feature do jogo.
- Na interna de usuários, cadastro é a terceira linha, fixa, após nome e nome de usuário; status vem em seguida e permissão depois do status; saldo é editado na mesma lista, com o modal de ajuste que mostra saldo atual e aceita valor com sinal (negativo retira, positivo adiciona), e também aparece ao lado do nome com `Balance`. O botão inferior agenda exclusão após confirmação; contas agendadas mostram o prazo e a orientação de reativação. [Ciclo de exclusão](backend-architecture.md#conta-e-autorização).
- Páginas, jogos, apostas, usuários, cupons e menus carregam pela API; visão geral também. Não montar novamente o provider de configuração demo global.
- `RichTextEditor` carrega BlockNote dinamicamente sem SSR, apenas no admin. Schema do editor e `lib/blocknote-content.ts` limitam recursos ao documento rico compartilhado; público usa renderização React validada, sem HTML arbitrário e sem BlockNote no bundle.
- Publicar página não cria item de menu. Menus principal e rodapé são editados independentemente. Contratos, agendamento e versões estão em [Conteúdo e administração](backend-architecture.md#conteúdo-e-administração).
- `/carteira` exibe saldo e extrato simples com filtros/paginação, detalhes em modal e datas de São Paulo; sem totais/gráficos extras. Mobile usa o mesmo resgate/modal de cupom do desktop.

- Configurações em `/admin/configuracoes` reutilizam `EditableRow` para editar e salvar cada campo em modal, preservando os padrões do site e as opções da página inicial e da listagem de jogos. O endpoint administrativo de SEO mantém seu contrato e controle de versão; `/admin/seo` redireciona para a nova URL.
- SEO: `features/seo/metadata.ts` compõe título, descrição, canonical e compartilhamento no servidor, sem cache persistente. Campos vazios herdam padrões. Configure `WEB_ORIGIN` (ou `NEXT_PUBLIC_SITE_URL`) no web para URLs absolutas; admin, perfis, carteira e rotas sem SEO público herdam `noindex`.

O editor de jogos inclui a listagem paginada de partidas, com filtros por status e busca por código/participante. A interna `/admin/jogos/[id]/partidas/[matchId]` reproduz projeções confirmadas em páginas de até 100 frames, com início/final, avanço/retorno, pausa e velocidade; não conecta ao executor multiplayer. Resultados e vencedores vêm da API administrativa. [Persistência e limites](backend-architecture.md#histórico-administrativo-de-partidas).

## 3D sob demanda

- React Three Fiber é o padrão de novas experiências; não migrar jogos existentes automaticamente. Siga `three/scenes/croin-preview.tsx`: fronteira cliente com `next/dynamic({ ssr: false })`.
- Renderer fora de layout/providers/ui; nenhum Canvas global nem loop antes da experiência ser solicitada. Reutilize `SceneCanvas`, `StudioLighting`, modelos e controles, sem regras de domínio nos primitives.
- `SceneCanvas` usa `frameloop="demand"`, DPR limitado, Suspense e fallback WebGL/erro. `useFrame` somente com animação real; animar refs, sem setState por frame, invalidando quando necessário. Ownership/descarte de modelos e materiais deve ser claro.
- Materiais leem `--color-brand`. `CroinBanner` monta só na viewport; gira enquanto a página está visível e movimento é permitido. Não captura foco/eventos; falha 3D não bloqueia cadastro. `CroinPreview` permanece como visualização interativa opcional.
