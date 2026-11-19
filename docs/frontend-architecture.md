# Arquitetura do frontend

> Estado do protótipo e convenções de interface. A arquitetura aprovada, a política de dados e o roadmap estão em [backend-architecture.md](backend-architecture.md). A Croebet está construindo sua primeira versão funcional: dados locais, chaves e compatibilidade entre formatos antigos descritos abaixo são detalhes históricos do código, não requisitos de preservação. O frontend foi movido para `apps/web` sem redesign; os caminhos de implementação neste documento são relativos a essa pasta. A fundação Fastify está em `apps/api`, com validações ainda pendentes da instalação das dependências.

## Estado atual e contexto

A aplicação utiliza Next.js App Router, React 19, TypeScript, Tailwind 4, Lucide, GSAP e Lenis. A organização atual separa UI, layout e features, com primitives compartilhados e validação por ESLint, TypeScript, testes Node e Playwright. O frontend está em `apps/web`, preservando relações entre pastas e o alias `@/`.

O Flip 7 já é jogável localmente; os outros jogos exibem “Em breve”. A autenticação agora usa endpoints do Fastify, com execução real ainda pendente das dependências e do banco; carteiras e demais domínios aguardam integração. A integração preservará componentes, metadata, imagens, textos, rotas, GSAP e Lenis; os dados mockados poderão ser descartados.

## Carregamento inicial

Páginas integradas à API recebem seus dados iniciais no servidor; Client Components ficam responsáveis pelas interações e atualizações posteriores. Evite iniciar o conteúdo vazio e carregá-lo em `useEffect`. A decisão de arquitetura, as políticas de cache e as exceções estão em [backend-architecture.md](backend-architecture.md#padrão-de-carregamento-inicial-de-páginas--18112026). No perfil, a rota consulta o endpoint público e passa `profile` pronto para `ProfileView`; `ProfileUnavailable` permite repetir a consulta com `router.refresh()`.

## Organização e dependências

| Diretório           | Responsabilidade                                                   |
| ------------------- | ------------------------------------------------------------------ |
| `app`               | Rotas e composição de Server Components                            |
| `components/ui`     | Primitives adaptados do padrão shadcn/ui, CVA e Radix              |
| `components/layout` | PageShell, navegação, sidebar, topbar, rodapé, providers e Motion  |
| `components/shared` | Tipografia e componentes visuais de produto                        |
| `features/auth`     | Sessão demo, autenticação, menu de conta e armazenamento           |
| `features/wallet`   | Carteira, cálculos, bônus, saldo e histórico                       |
| `features/betting`  | Apostas por opções ou minutos, confirmação e histórico de palpites |
| `features/games`    | Catálogo e grade de jogos                                          |
| `features/home`     | Banners da página inicial                                          |
| `lib`               | `cn` e utilitários sem estado                                      |
| `three`             | Canvas, cenas, modelos, materiais, luzes e controles               |
| `tests`             | Regras de carteira e interações em navegador                       |

As dependências apontam das rotas para features e componentes; componentes UI não conhecem features. Tipos permanecem junto ao domínio, sem um diretório global de tipos sem necessidade. Não há barrels que importem todo o design system ou renderer 3D. Os providers permanecem clientes, enquanto páginas e conteúdo estático continuam no servidor.

`components.json` registra a instalação manual shadcn/ui, o CSS do Tailwind 4, aliases e Lucide. Os componentes pertencem ao projeto e podem ser editados. Radix fornece os comportamentos acessíveis; não foi adicionada uma biblioteca de componentes fechada. Os ícones utilizam imports nomeados de `lucide-react` em componentes de servidor e cliente, preservando o estilo de contorno padrão. Não há dependência de runtime do CLI shadcn.

## Tokens e estilos

`app/globals.css` centraliza cores semânticas, tipografia fluida, espaçamento de página e banner, alturas estruturais, raio de painel, sombras, gradientes e borda fina. As demais dimensões utilizam a escala de `rem` do Tailwind. Proporções e posicionamento das imagens foram preservados.

A paleta da interface usa `background`, `surface`, `foreground`, `muted`, `brand` e `contrast`. `contrast` é branco no dark e `#010101` no light: controles e campos usam `bg-contrast/6`, hover usa `bg-contrast/10` e divisórias usam `border-contrast/6`. Cabeçalho e sidebar compartilham `background`; modais e dropdowns usam `surface` opaca. Bordas de campos que precisam de maior contraste mantêm `field-border`. Estados destrutivos, seleção, previsões e cores próprias dos jogos conservam tokens específicos. Não recrie aliases como `control`, `field`, `chrome`, `accent`, `primary`, `secondary`, `card` ou `popover` para as mesmas cores.

Não existem classes CSS globais de componentes. A sidebar utiliza consultas de container nas classes Tailwind; o espaço do conteúdo segue a mesma variável CSS compartilhada pela sidebar e topbar. `Heading` reúne as variantes de tipografia antes repetidas no CSS. `PageShell` padroniza largura e respiro das páginas internas.

A altura mínima de campos e botões padrão é 2.75rem. Tamanhos menores são explícitos em ferramentas compactas da navegação. Modais e dropdowns não têm borda rosa; os controles usam borda de foco simples. Links textuais preservam indicação de foco de teclado. O efeito de gradiente e sombra interna permanece nos botões primários e na Croin.

## Como criar componentes e variantes

1. Procure um primitive existente e reutilize-o.
2. Uma adaptação usada por um único domínio fica em `features/<domínio>`.
3. Um padrão visual comum entre domínios vai para `components/shared`.
4. Um controle genérico vai para `components/ui`, com props tipadas, `className`, `cn`, estados e acessibilidade.
5. Crie uma variante CVA quando houver uma escolha semântica repetida. Use `className` apenas para o ajuste local de composição.

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

<Button variant="secondary">Cancelar</Button>
<Button type="submit" loading={saving}>Salvar</Button>
<Button asChild><Link href="/jogos">Ver jogos</Link></Button>
<Field>Nome de usuário<Input name="username" autoComplete="username" required /></Field>
```

Use estados `disabled` e `loading` em ações nativas; links representam destinos de navegação. A variante `default` utiliza a marca; `secondary`, `outline`, `ghost`, `destructive` e `link` cobrem os demais papéis. Não copie a string de classes de Button para dentro de uma feature.

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger asChild>
    <Button>Detalhes</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogTitle>Detalhes</DialogTitle>
    <DialogDescription>Informações sobre a operação.</DialogDescription>
    <DialogClose asChild>
      <Button variant="secondary">Fechar</Button>
    </DialogClose>
  </DialogContent>
</Dialog>
```

Se um modal for aberto por um método compartilhado, preserve a referência do controle que o abriu e devolva o foco ao fechar. Conteúdos desmontam ao fechar, limpando campos e senhas de teste. Menus de conta e notificações utilizam os mesmos primitives Radix.

Componentes já necessários e disponíveis: Button, Input, Field, Dialog/drawer, DropdownMenu, Tooltip, Card, Badge, Avatar, Skeleton e Sonner. Textarea, Select, Checkbox, RadioGroup e Tabs ficam adiados porque nenhuma tela atual os utiliza. Adicione-os no mesmo padrão quando uma funcionalidade precisar, sem instalar componentes especulativos.

## Estado atual da demonstração

> As descrições locais abaixo documentam o protótipo anterior à integração. O provider atual de identidade consulta Fastify e não carrega carteiras ou sessões demo; consultar o estado atualizado em [backend-architecture.md](backend-architecture.md). Não transportar compatibilidade histórica desses formatos para a API.

`DemoSessionProvider` coordena a sessão e um reducer de carteira. A persistência começa após a leitura inicial do navegador para não substituir dados existentes pelo saldo padrão. As chaves de localStorage foram mantidas; a carteira agora inclui `transactions`, uma lista de movimentações com identificador, data ISO, descrição, valor com sinal e saldo resultante. Carteiras antigas recebem uma lista vazia sem alterar saldo, bônus ou palpites. Entradas inválidas do histórico são descartadas sem apagar a carteira; dados corrompidos são descartados com fallback em memória. As regras puras de carteira rejeitam valores fracionários, saldo insuficiente e overflow. O bônus diário utiliza `America/Sao_Paulo`.

A autenticação permanece uma demonstração local; não salva a senha e não oferece segurança de backend. As carteiras acompanham eventos de armazenamento entre abas e um evento local após gravações. As mutações passam por um bloqueio compartilhado do navegador e releem o saldo persistido antes de gravar.

A página de apostas apresenta três formatos: Sim/Não, escolha de duração e atraso em minutos inteiros (incluindo zero). O catálogo usa cards compactos, busca por pergunta sem distinção de acentos e filtros combináveis por formato. Sim/Não têm cores semânticas próprias para os dois temas; demais opções aparecem em linhas. Cada card abre um diálogo de regras com o critério do palpite e informa o prazo configurado e a regra de rateio. A seleção usa o ID estável do mercado e abre um diálogo para confirmar o valor em Croins, com atalhos de valores que respeitam o saldo; os cards ficam em duas colunas à esquerda e o histórico ocupa um terço da largura à direita em telas grandes, com resumo de valores registrados, estado vazio e seções empilhadas no mobile. Novos palpites não usam odds nem exibem projeções de retorno ou probabilidades. O campo opcional `odds` continua aceito e validado ao ler palpites antigos, preservando as carteiras existentes. A apuração e o pagamento do protótipo são gerenciados pelas páginas internas do admin, conforme a seção de liquidação abaixo.

A rota `/carteira` mostra saldo atual, totais registrados e movimentações com filtros de entradas e saídas. Recargas de teste, bônus diário e valores apostados registram a movimentação junto da alteração de saldo; apostas são saídas, sem antecipar perdas ou pagamentos de eventos ainda não apurados. Movimentações anteriores à atualização não são reconstruídas. O saldo no topo e na sidebar leva à carteira, também acessível no menu de conta. A recarga saiu do menu de conta e é acessível na interna da própria conta em `/admin/usuarios/minha-conta`. O menu de conta inclui um link Admin somente para sessões com `permissions.canManageSite`.

O menu da conta abre um modal de configurações em `features/settings`, com navegação lateral no desktop e navegação superior no mobile. Geral resume usuário, saldo e bônus; Aparência reutiliza o provider de tema; Conta permite consultar o usuário, adicionar/trocar/remover a foto de perfil e sair; Carteira reutiliza as movimentações e filtros da carteira. A foto é recortada ao centro e reduzida a 256 × 256, salva como JPEG por usuário na chave `croebet:demo-avatar:<nome>` e compartilhada pela navegação e pelo jogador correspondente no Flip7. Aceita JPG, PNG e WebP de até 10 MB; falhas de leitura ou armazenamento exibem feedback sem substituir a foto anterior. O modal mantém rolagem interna, fechamento por Escape e retorno do foco ao menu da conta.

O estado de navegação é independente da carteira. Os diálogos utilizam portais, bloqueio de scroll e controle de foco do Radix. A troca de rota e o breakpoint desktop fecham o menu mobile. As páginas exibem o conteúdo diretamente, sem animações de entrada. `Motion` mantém a rolagem suave com Lenis e respeita a preferência de movimento reduzido.

## 3D sob demanda

O convite de cadastro na sidebar utiliza `CroinBanner`: uma moeda procedural com aro e emblema C nas duas faces, carregada por `next/dynamic` com SSR desativado somente quando visível. A decoração não captura eventos ou foco e falhas de WebGL não afetam o cadastro. O card de resgate diário não utiliza o modelo 3D. `CroinPreview` continua disponível para visualização interativa e pode ser importado por uma página servidor, pois ele mesmo estabelece a fronteira cliente:

```tsx
import { CroinPreview } from "@/three/scenes/croin-preview";

<CroinPreview className="mx-auto max-w-80" />;
```

O módulo de preview contém `SceneCanvas`, `StudioLighting`, `CroinModel`, `BrandMaterial` e `PreviewControls`. Não há render loop ou Canvas no layout. O renderer utiliza `frameloop="demand"`, DPR entre 1 e 1.5 e Suspense; o preview apresenta Skeleton e fallback em caso de erro ou indisponibilidade de WebGL. O banner reutiliza modelo, iluminação e canvas, sem controles interativos.

Materiais leem `--color-brand` uma vez ao montar e invalidam o frame. OrbitControls invalida o renderer quando há interação. No banner, `useFrame` gira uma ref e solicita o próximo frame apenas enquanto a página está visível e o usuário permite animação. O canvas desmonta ao sair da viewport; movimento reduzido mantém a moeda estática. Não há estado React atualizado por frame, downloads de HDR/fontes externas ou migração automática dos jogos.

## Validação

- `pnpm lint`: ESLint com regras Next/React/TypeScript e restrição a controles HTML fora do design system.
- `pnpm typecheck`: tipos de toda a aplicação, incluindo a infraestrutura 3D.
- `pnpm test`: regras puras, persistência das partidas livres, contratos e testes HTTP com dependências controladas; não substitui a integração real da API.
- `pnpm build`: compilação, prerender e metadata das rotas existentes.
- `pnpm test:e2e`: Chrome desktop e viewport mobile; conteúdo/rotas, ausência de overflow horizontal e Canvas global, foco, preferências, partidas livres e recursos públicos desabilitados. As configurações `playwright.session.config.ts`, `playwright.pages.config.ts` e `playwright.games.config.ts` exercitam os fluxos integrados com fixtures HTTP próprias.

Os testes de navegador usam o Google Chrome instalado (`channel: "chrome"`). Next e as fixtures usam, respectivamente, as portas 3100 e 3201; não reutilizam servidores existentes. A saída `.next-e2e` e o `tsconfig.e2e.json` isolam os testes dos artefatos normais de desenvolvimento. Antes de pages/games, execute na raiz `API_INTERNAL_URL=http://127.0.0.1:3201 NEXT_DIST_DIR=.next-e2e pnpm build`; essas configurações usam `next start`. Não limpe `.next` nem encerre o servidor do usuário para liberar locks de teste. Relatórios e traces ficam ignorados pelo Git. Não considere uma validação aprovada até executar o comando e observar seu resultado. As contagens observadas e a falha remanescente das 404 dinâmicas sem JavaScript estão em [backend-architecture.md](backend-architecture.md#execução-real-de-integração-e-e2e--19112026).

Na Carteira mobile, o cartão de saldo oferece o mesmo `RedeemButton` e modal de cupom usados no desktop; o cabeçalho compacto permanece. Resgate e atualização de saldo continuam usando a API, sem carteira local.

## Resultado da migração — 17/11/2026

- Next.js e eslint-config-next atualizados para 16.4.6, incluindo a correção de segurança indicada pelo framework. Lockfile atualizado e instalação confirmada.
- Tailwind/PostCSS 4.3.3, TypeScript 6.0.3 e Three.js 0.186.0. React 19.2.8 e ESLint 9.39.5 mantidos pelas restrições de peer dependencies do Fiber e dos plugins de lint. Não há conflitos de peers.
- Lint sem avisos, TypeScript e quatro testes de carteira aprovados.
- Build de produção com Turbopack aprovado usando Node 22.22.0; todas as rotas foram pré-renderizadas. O modo workerThreads existente foi preservado. O Node 24.18 desativa esse modo por uma proteção do próprio Next e utiliza processos com comunicação por portas locais.
- Testes Playwright implementados, mas a execução interativa permanece pendente: o ambiente recusou a abertura de `127.0.0.1:3100` com `EPERM`. Não houve validação visual em navegador nesta sessão.

## Jogos independentes — Flip7

O primeiro jogo funcional foi integrado em `/jogos/flip7`. Seu módulo em `features/games/flip7` separa motor de regras puro, interface e carregamento dinâmico; a plataforma compõe a página e continua responsável pela navegação. O motor não importa sessão ou carteira. Partidas livres compartilham o dispositivo com bots opcionais; o modo com Croins aceita somente a conta conectada contra bots, com entrada fixa, contribuições simuladas dos bots e rateio do pote entre os vencedores. A integração de carteira fica em `wager-storage.ts`, fora do motor, com recibos determinísticos de entrada/prêmio e retomada sem cobrança ou crédito duplicado. Detalhes da referência, regras, limites e testes estão em `docs/flip7.md`.

## Administração local

`/admin` reúne visão geral, edição e pausa dos jogos existentes, criação/edição/pausa/exclusão de apostas, edição dos textos do Sobre e crédito de Croins para contas presentes neste navegador. Jogos pausados saem do catálogo e a rota direta não monta o jogo. Apostas que deixam o estado Aberta ou chegam ao prazo saem do catálogo. A exclusão só é permitida sem participantes nem liquidação; com participantes, use cancelamento e devolução. Novos jogos executáveis exigem implementação; o painel edita somente os jogos integrados. Apuração, pagamento e devolução estão implementados localmente, conforme a seção de liquidação abaixo.

`SiteConfigProvider` mantém apenas dados do protótipo de apostas/conteúdo em `croebet:demo-site-config:v1`; falhas de escrita preservam o estado anterior e exibem erro. O Sobre usa conteúdo inicial preservado, renderizado sem HTML fornecido pelo usuário. A recarga reutiliza as regras de carteira, limites e histórico. O painel usa `sessionReady` e `permissions.canManageSite`, com acesso negado por padrão. Na demonstração de desenvolvimento, somente nomes explicitamente configurados em `NEXT_PUBLIC_DEMO_ADMIN_USERS` recebem essa permissão. Visitantes e usuários comuns veem a mesma página 404 de uma rota inexistente, sem login específico, link Admin ou título administrativo. O painel é carregado sob demanda após autorização; sair desmonta o painel. As gravações de configuração e a recarga da sessão também verificam permissão. As alterações não são publicadas nem compartilhadas entre dispositivos.

### Editor visual das páginas

A seção Páginas do admin usa BlockNote (`@blocknote/core`, `@blocknote/react` e `@blocknote/ariakit`, versão 0.57.0) no primitive `RichTextEditor`. O editor é carregado por importação dinâmica sem SSR, apenas na administração, com menus em português e tema baseado nos tokens do projeto. A edição oferece parágrafos, títulos de níveis 1–3, listas, citações, negrito, itálico e sublinhado, além de desfazer/refazer e organização em blocos. O menu `/` e a barra flutuante substituem a barra fixa anterior. O schema restringe recursos ao contrato atual das páginas; `lib/blocknote-content.ts` faz a conversão síncrona de blocos para a árvore validada de texto/tags sem interpretar HTML. O conteúdo público continua renderizado no servidor com React; não carrega BlockNote. Esta troca não exige migration.

A instalação das novas dependências ficou pendente nesta sessão por falha de DNS ao acessar registry.npmjs.org. Execute `pnpm install` no ambiente local para resolver e atualizar o lockfile; TypeScript/build do frontend só poderão ser concluídos após essa instalação.

### Acesso administrativo e integração futura

Copie `.env.example` para `.env.local`, configure `NEXT_PUBLIC_DEMO_ADMIN_USERS` com os nomes locais autorizados e reinicie `pnpm dev`. Lista vazia não autoriza ninguém; cadastrar-se ou escolher o nome "admin" não concede permissão automaticamente. Essa configuração é pública e serve apenas para simular permissões no desenvolvimento: a sessão local ainda não verifica identidade. O estado de permissão não é lido de um papel editável no localStorage.

Atualmente, em produção, `app/admin/layout.tsx` executa `notFound()` incondicionalmente. Na integração, o Next.js consultará a sessão via HTTP no Fastify para compor o painel; cada endpoint e evento administrativo será autorizado pelo próprio Fastify. Preserve a resposta 404 para acessos administrativos não autorizados. Não use a lista pública ou um cookie com papel não assinado como autenticação. Os detalhes estão no planejamento central, sem Route Handlers como backend de domínio.

### Catálogo administrativo de jogos

As seções do painel têm URLs próprias: `/admin/jogos`, `/admin/apostas`, `/admin/paginas` e `/admin/usuarios`. A autorização de servidor fica no layout de `/admin`, abrangendo também as rotas internas. O acesso cliente continua condicionado à sessão e à permissão administrativa.

O catálogo de jogos vem do Fastify/PostgreSQL, com dados iniciais consultados pelo servidor. No admin, usa lista em uma superfície com divisórias, busca e filtros, como páginas e usuários. `/admin/jogos/[id]` edita nome, imagem opcional por URL/caminho e estado ativo, com feedback e gravação na API. A home e a grade pública mostram somente jogos ativos; a rota de um jogo pausado responde 404 antes de montar o motor. `GameCover` mostra a imagem cadastrada ou placeholder, sem capa automática por slug. O seed inicial contém apenas o Flip 7 sem imagem. Contratos, segurança e operação do banco estão em `docs/backend-architecture.md`.

## Gerenciamento e liquidação das apostas

`/admin/apostas` usa grid com status, pergunta, montante identificado, participantes, busca e filtros de status. Categoria foi removida do modelo atual, da configuração e do catálogo público. `/admin/apostas/nova` cria rascunhos; `/admin/apostas/[id]` reúne resumo e seções Configuração, Participantes e Finalização, sem modais de edição. Encerrar, apurar, cancelar e pagar usam confirmação na própria página.

Estados: Rascunho → Aberta ⇄ Pausada → Encerrada → Apurada → Paga. O cancelamento prepara uma apuração de devolução, que só vira Cancelada após os créditos. O prazo é validado no momento do débito e convertido em Encerrada ao ler o catálogo; a interface também atualiza os dados periodicamente. Regras, pergunta e opções ficam bloqueadas após o primeiro palpite. Resultado e plano de pagamento são imutáveis após a apuração.

A premiação distribui o montante dos palpites identificados proporcionalmente às apostas vencedoras, sem taxa, incluindo a aposta inicial. O cálculo usa BigInt e distribui sobras inteiras pelos maiores restos, com desempate pelo ID do palpite. Números exigem acerto exato. Sem vencedores ou no cancelamento, cada palpite recebe o valor original. Sem participantes, a liquidação tem total zero.

Novos palpites incluem `id`, `marketId`, `username`, `createdAt` e `status`, gravados junto do débito em uma única carteira. A apuração persiste um plano fixo em `market.settlement` antes de qualquer pagamento. Cada carteira é atualizada uma única vez por plano, com crédito, status dos palpites e recibo determinístico na mesma gravação. Perdedores têm recibo no palpite sem transação de valor zero. O lote faz pré-validação de todas as carteiras, e falhas durante gravação permitem retomar contas pendentes; concluir novamente nunca duplica créditos.

`features/betting/settlement.ts` contém regras puras; `betting-storage.ts` contém operações locais autorizadas, participantes e persistência. Todas as mutações de saldo e de mercado compartilham `navigator.locks`, relendo o estado no bloqueio. O provider de sessão não regrava snapshots antigos após efeitos React. Falhas de gravação não geram toast de sucesso nem fecham a confirmação do palpite. Configurações genéricas de jogos/Sobre preservam os mercados atuais e não alteram seu ciclo de vida. Dados inválidos bloqueiam operações sem substituí-los silenciosamente.

O código local contém conversões de formatos e tratamento de palpites antigos. Esses mecanismos não devem ser transportados para a API: carteiras, palpites e configurações mockadas podem ser descartados. A primeira base funcional começa limpa, com seeds de referência revisados e sem importação dos navegadores.

A implementação continua restrita às contas e ao armazenamento deste navegador. Na integração com Fastify, reutilize as regras puras e os testes de precisão e idempotência; IDs dos mocks não precisam ser mantidos. A persistência local será substituída por autorização e transações de banco. Testes específicos de formatos antigos podem ser removidos junto dos adaptadores descartados; preserve a cobertura das regras e acrescente integração, concorrência e rollback no PostgreSQL.

### Páginas institucionais

A seção Páginas lista Sobre e páginas comuns, com edição em `/admin/paginas/[id]` e criação em `/admin/paginas/nova`. Todas as páginas, incluindo Sobre, usam o mesmo editor de título, slug, conteúdo e publicação. O conteúdo anterior do Sobre é migrado para a coleção versionada de páginas sem ser apagado. Termos de uso e Política de privacidade começam como rascunhos sem texto. Outras páginas permitem título, endereço, documento visual, publicação e visibilidade no menu principal; endereços reservados e duplicados são rejeitados. Apenas páginas publicadas aparecem no rodapé e em `/[slug]`. A configuração antiga recebe os rascunhos ao ser lida, preservando os demais dados. O conteúdo continua local e validado, sem HTML arbitrário.

### Usuários — protótipo visual e conta atual

`/admin/usuarios` lista a conta da sessão em primeiro lugar, seguida dos perfis fictícios. Inclui busca por usuário e filtros Ativos/Suspensos. Os perfis não possuem e-mail; o cadastro solicita apenas usuário e senha. `/admin/usuarios/[id]` apresenta dados da conta, saldo, estatísticas, movimentações e apostas. O card Dados da conta usa posição sticky abaixo da navbar no layout de duas colunas. A navbar oferece retorno à listagem; IDs desconhecidos retornam 404. As rotas usam a mesma autorização administrativa das demais seções.

`/admin/usuarios/minha-conta` usa nome, avatar, saldo, palpites e movimentações reais da sessão local. Dados ainda não disponíveis, como cadastro e estatísticas dos jogos, aparecem como “—”. Apenas essa interna permite adicionar e retirar Croins, em um modal aberto pelo botão “Ajustar Croins” no card de saldo; `adjustOwnLocalWallet` revalida permissão e titular dentro do bloqueio compartilhado e registra o ajuste no histórico, rejeitando saldo negativo, valores fracionários e overflow. A seção e rota Saldo foram removidas.

Os demais registros estão isolados em `features/admin/user-fixtures.ts`, sem ler ou gravar contas, carteiras ou permissões reais. Papéis e status são apenas informações visuais; não concedem acesso nem suspendem sessões. Esses perfis não permitem ajustar o saldo.

### Nome de exibição e usuário

A sessão separa `displayName` de `username`. Configurações → Conta permite editar Nome e consultar Nome de usuário, que permanece o identificador do login, da carteira, das permissões, dos avatares e dos futuros endereços de perfil. O nome público aparece no menu da conta, no resumo das configurações e no perfil administrativo; pode se repetir. É salvo por usuário em `croebet:demo-display-name:<usuário>`, com fallback ao username para contas anteriores e atualização entre abas. Falhas de gravação não alteram o nome em memória nem geram sucesso. O protótipo mantém o username sem edição; não há migração de carteira ou autenticação de produção.

### Visão geral administrativa

`/admin` consulta `/api/v1/admin/overview?days=1|7|30` pelo servidor, com sessão encaminhada e sem cache. Os links Hoje, 7 dias e 30 dias atualizam a URL e consultam novamente a API; o painel já vem no HTML inicial. Falha de leitura usa o componente de indisponibilidade e nova tentativa, sem preencher números com zeros fictícios.

A estrutura visual apresenta contas cadastradas, participantes com movimentação no período, número de movimentações e saldo atual das carteiras vinculadas. O gráfico mostra movimentações por dia; as demais seções exibem resgates diários/cupons, cadastros recentes, circulação de Croins por origem e últimas movimentações. Os cálculos e limites temporais pertencem ao Fastify/PostgreSQL. Não há dados de apostas ou partidas locais no resumo. O provider de configuração do protótipo deixou de ser montado globalmente.

Os testes de contas, permissões, carteiras, pagamentos e administração simulados no localStorage foram removidos. Foram preservados os testes puros de regras e os de persistência atual das partidas livres do Flip 7; as verificações de interface usam contratos HTTP. O resumo possui cenários de HTML sem JavaScript, filtros, indisponibilidade, base vazia e autorização.

## Cupons administrativos (protótipo visual)

`/admin/cupons` lista cards com busca por código e filtros de status. A criação em `/admin/cupons/novo` e a edição em `/admin/cupons/[id]` usam páginas internas, com código definido pelo administrador, Croins por resgate, limite total opcional e início/término opcionais (horário local do navegador). Sem limite, os resgates são ilimitados; sem datas, a disponibilidade é indefinida. O resumo apresenta um resgate por usuário e totais; o histórico permite pesquisar participantes. Cupons podem ser pausados na configuração.

Os exemplos e alterações são exclusivos do protótipo, persistidos em `croebet:demo-admin-coupons:v1`, sem integração com carteiras ou resgate público. O histórico usa valores individuais registrados para preservar os totais após editar a recompensa. O backend deverá validar disponibilidade, limites e unicidade do resgate por conta; a interface não implementa essas garantias de produção.
