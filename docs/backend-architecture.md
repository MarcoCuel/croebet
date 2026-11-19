# Arquitetura da primeira versão funcional

## Páginas, menu e rodapé — 19/11/2026

Implementação de páginas transferida para o Fastify/PostgreSQL. `GET /api/v1/pages` retorna somente referências de páginas publicadas; `GET /api/v1/pages/:slug` retorna somente conteúdo publicado. Rascunhos e endereços inválidos/inexistentes recebem 404, sem fallback para conteúdo do navegador. Leituras usam no-store. O Next consulta conteúdo e navegação no servidor; falha de serviço apresenta tentativa novamente, distinta de ausência. Sidebar e rodapé usam exclusivamente os menus independentes descritos abaixo; publicar uma página não cria itens de navegação. Revalidação posterior preserva dados confirmados durante falhas.

`GET /api/v1/admin/pages`, `GET /api/v1/admin/pages/:slug`, `POST /api/v1/admin/pages` e `PATCH /api/v1/admin/pages/:slug` usam as proteções administrativas existentes: papel validado na API, sessão revalidada na transação, Origin/CSRF e limites nas escritas. Páginas têm UUID estável, slug único, título, documento JSON validado, publicação, presença no menu e versão positiva. Criação exige versão zero; edição exige a versão atual e incrementa-a sob lock. Conflitos pedem recarregamento, sem sobrescrever outra edição. Alterar slug invalida o endereço anterior, sem aliases. Publicação vazia e rotas reservadas (inclusive perfil) são recusadas. Auditoria e conteúdo confirmam juntos.

Contratos e validação do documento rico ficam em `packages/shared`; o frontend mantém seu renderizador seguro de tags permitidas e não interpreta HTML armazenado. Conteúdo tem limites de profundidade, nós e tamanho; tags executáveis e atributos adicionais são recusados. O editor e o layout existentes foram preservados. A lista e o formulário administrativo recebem dados iniciais via HTTP no servidor; rascunhos nunca são enviados à navegação pública.

As páginas começam vazias, criadas pelo administrador; a migration inicial de páginas não insere mais conteúdo de referência. A migration `0009_complete_grey_gargoyle` acrescenta criação, última edição, usuário responsável (nome registrado na edição) e última publicação. Remove apenas as referências não editadas de Sobre, Termos e Privacidade em ambientes development/test; páginas com auditoria e dados de produção são preservados. Não importa conteúdo do navegador. As datas são gravadas na transação de escrita; a data de publicação muda apenas ao passar de rascunho para publicada. Registros antigos sem essas informações mostram ausência de histórico.

A administração usa lista e editor em duas colunas. A sidebar compacta apresenta status, quando publicar, slug e autor, cada um editado em um modal; as mudanças só são persistidas pela ação principal no topo. Página nova oferece Publicar; escolher rascunho/pendente/privada muda para Salvar. Após a criação, a ação é Salvar, ou Agendar se houver publicação futura. Salvar mantém o administrador no editor. Não há revisões nem controle de menu no editor; a gestão da navegação fica em Admin → Menus.

A migration `0011_perpetual_goliath` acrescenta status editorial (`draft`, `pending`, `private`, `scheduled`, `published`), data desejada de publicação e autor (UUID e nome registrado). Autoria é independente de quem fez a última edição. `GET /api/v1/admin/page-authors` lista administradores ativos para seleção. Rascunho, pendente, privada e agendamento futuro ficam fora das consultas públicas e dos menus. A data usa o fuso de Brasília na interface e timestamps UTC na API. A API normaliza publicação com data futura para agendamento, recusa agendamento novo sem data futura e exige conteúdo para publicar/agendar. Consultas usam o relógio do PostgreSQL para liberar agendas vencidas, sem depender de processo em memória; elas retornam status Publicada e a data agendada como data de publicação. O status persistido pode continuar scheduled até a próxima escrita; a visibilidade pública usa sempre a condição temporal, inclusive nos menus.

A listagem administrativa de páginas tem busca por título/slug (sem distinguir acentos ou caixa), filtros com contadores em botões secondary/ghost e uma lista simples em Card, ordenada por título, sem cabeçalhos de colunas. Cada linha apresenta título, status, slug e ações com os botões do design system. Todos exclui o lixo; estados adicionais aparecem quando presentes. A busca combina com o status selecionado. As páginas iniciais continuam carregadas no servidor.

A migration `0012_zippy_blockbuster` adiciona o status `trash`. Mover para o lixo usa `PATCH /api/v1/admin/pages/:slug`, despublica a página e remove seu agendamento; restaurar a mantém como rascunho. Páginas no lixo não aparecem publicamente nem nos menus e continuam reservando o slug. As operações usam versão atual, sessão, papel, CSRF, rate limit, transação e auditoria de edição. `DELETE /api/v1/admin/pages/:slug` continua sendo exclusão permanente, com confirmação pela interface do lixo e auditoria `page.deleted`. Aplique as migrations antes de usar a lixeira.

Validação atual: lint, TypeScript, suíte unitária e build com Webpack aprovados. Os testes de páginas cobrem estados editoriais, validação de agenda e autor, projeção de agenda vencida, conflito de versão, privacidade e exclusão auditada. Suíte PostgreSQL preparada para agendamento temporal, estados privados e exclusão; E2E preparado para modais, criação, edição, agendamento e exclusão em desktop/mobile. Migration e E2E foram tentados, mas a sessão bloqueou a conexão PostgreSQL e a porta 3100 com EPERM. Não houve validação de integração real dessa revisão.

O layout administrativo deixou de bloquear builds de produção por NODE_ENV e passa a verificar a sessão/papel no servidor pela API. Visitantes e contas sem papel admin recebem 404; falhas de sessão apresentam indisponibilidade com nova tentativa. A autorização efetiva de cada operação permanece no Fastify.

## Menus independentes — 19/11/2026

Admin → Menus (`/admin/menus`) configura duas localizações independentes: `main` (sidebar e menu móvel) e `footer` (rodapé). O editor permite adicionar páginas fixas, páginas criadas e links personalizados; editar rótulos; abrir em nova aba; remover e reordenar por controles acessíveis. Mantém rascunhos locais de edição separados para cada menu até salvar. Navegação é plana, preservando a sidebar atual; não inclui hierarquia ou submenus nesta entrega. Cada menu aceita até 50 itens, inclusive configuração vazia. Publicar uma página não a adiciona automaticamente a nenhum menu. Rótulos são explícitos e não mudam quando o título da página muda.

`navigation_menus` armazena localização, itens JSON validados e versão. Os itens possuem UUID próprio e um destino discriminado: chave de página fixa, UUID estável da página criada ou URL personalizada. Página referenciada por UUID acompanha mudanças de slug; rascunhos ou páginas removidas são omitidos na projeção pública. A configuração administrativa mantém o item para permitir sua correção. Ranking e conquistas continuam indisponíveis com “Em breve”, mesmo se adicionados ao menu. Links personalizados aceitam caminhos internos, âncoras, http/https, mailto e tel, recusando scripts, URLs de protocolo relativo, controles, barras invertidas e credenciais embutidas. Nova aba usa noopener/noreferrer.

`GET /api/v1/navigation` retorna `{ main, footer }`, com somente os destinos públicos resolvidos, em ordem. O Next carrega essa projeção no servidor e a entrega ao provider da navegação; não usa localStorage ou composição automática de páginas. Falha difere de um menu vazio confirmado. O campo anterior showInMenu continua no contrato de páginas, mas não determina mais a navegação; a listagem de páginas publicadas serve para títulos de página, não para montar menus.

`GET /api/v1/admin/menus` retorna os dois menus e opções de páginas (inclusive rascunhos, somente para admin). `PATCH /api/v1/admin/menus/:location` exige versão atual e itens completos. Usa sessão/papel revalidados sob transação, Origin/CSRF, limite de tentativas e o lock de governança existente. Confere páginas referenciadas, bloqueia o menu, incrementa a versão e registra auditoria atomicamente. Edição obsoleta retorna conflito e preserva o formulário; falha da auditoria reverte também o menu. A auditoria usa IDs de recurso estáveis terminados em 0010 (main) e 0011 (footer), sem relação com contas econômicas.

Migration `0010_sudden_mauler` gerada, sem execução nesta rodada. Cria as duas localizações com os links fixos existentes; inclui Sobre somente se a página existir no momento da aplicação. Não cria páginas, contas nem créditos, e não importa configuração do navegador. A migration 0009 dos metadados de publicação, já existente, continua preservada. Ativação depende das migrations pendentes e de reiniciar a API; não houve reset nem aplicação de migrations nesta entrega.

Validação de menus: lint, TypeScript, suíte unitária, build de produção, Drizzle Kit check e git diff --check aprovados. Dezesseis cenários de páginas/menus aprovados em Chrome desktop/mobile pelo comando `pnpm test:e2e --config playwright.pages.config.ts`: projeção pública sem JavaScript, três tipos de destino, ordem, rótulos, nova aba, independência das localizações, ocultação de rascunhos, destino atualizado por ID, remoção, URLs recusadas, permissões, conflito e falha/retry. As fixtures HTTP validam a interface e os contratos; não comprovam operações reais no banco. Suíte PostgreSQL de menus preparada para concorrência, referência por ID, sessão inválida e rollback conjunto de conteúdo/auditoria, pendente de banco isolado com TEST_DATABASE_URL e schema atualizado.

Atualizado em 19/11/2026. Referência técnica e roadmap. Fundação iniciada; consultar o estado de implementação e validação ao final. Registros datados anteriores são históricos; a conferência de 19/11 substitui seus bloqueios de ambiente.

## Referências e situação atual

Este documento concentra decisões técnicas e roadmap. [../CROEBET.md](../CROEBET.md) continua sendo a referência de produto; [frontend-architecture.md](frontend-architecture.md) documenta interface e implementação atual; [flip7.md](flip7.md) detalha regras e apresentação do jogo; [../AGENTS.md](../AGENTS.md) define convenções de desenvolvimento. Ao aprovar uma mudança arquitetural, atualizar esta referência e corrigir os links ou instruções afetados, sem copiar o planejamento inteiro para outros arquivos.

A inspeção atual encontrou Next.js 16.4.6, React 19.2.8, TypeScript 6.0.3, Tailwind 4, Radix, GSAP, Lenis e Three.js/React Three Fiber. O workspace separa `apps/web`, `apps/api` e `packages/shared`. As dependências da API estão instaladas; a fundação, os contratos e a autenticação estão implementados e compilam. Docker, pnpm e conexão PostgreSQL foram confirmados em 19/11, assim como a aplicação das migrations 0000–0005. A validação dos fluxos de cadastro/login e carteira com PostgreSQL continua pendente de banco isolado de teste. Os registros ao final descrevem a sequência das entregas. Não há multiplayer online.

Cadastro, login, logout, consulta de sessão, edição de nome/usuário, exclusão de conta e perfis públicos já chamam a API; o servidor verifica a senha com Argon2id e persiste contas/sessões no PostgreSQL quando o banco está preparado e acessível. Não há fallback para login local. A carteira tem uma primeira base no backend (contas, livro de operações e consultas autenticadas), integrada ao histórico e aos saldos globais, com concessão inicial de 30 Croins e resgate de 10 Croins por dia, renovado à meia-noite de São Paulo. Palpites econômicos continuam indisponíveis. Partidas e configurações do protótipo continuam no navegador. O Flip 7 tem motores puros para Clássico, Vingança e Brutal, pessoas no mesmo dispositivo e bots; os demais jogos do catálogo exibem “Em breve”. Rankings e conquistas estão fora da primeira versão: os itens do menu permanecem desativados com “Em breve”, e suas rotas redirecionam ao início. Usuários administrativos, permissões, suspensão, cupons, resgates e ajustes de Croins estão integrados à API; catálogo, mercados e demais partes administrativas ainda têm dados locais conforme seus domínios. Existem testes Node de regras/persistência e Playwright de interface.

## Decisões confirmadas e limites

| Tema | Decisão aprovada |
| --- | --- |
| Organização | Monorepo pnpm com frontend e backend separados. |
| Frontend | Next.js + React + TypeScript; preservar componentes, estilos, animações e navegação. |
| Backend | Fastify + Node.js + TypeScript, monólito modular responsável por toda a lógica de negócio. |
| Persistência | PostgreSQL, Drizzle + `pg`, migrations de schema e restrições relacionais. |
| Contratos | Zod, validação em runtime e tipos compartilháveis. |
| Autenticação | Username e senha, sem e-mail obrigatório; Argon2id e sessões opacas persistidas. |
| Multiplayer | Socket.IO + HTTP desde a primeira etapa multiplayer; PostgreSQL como fonte de verdade. |
| Avatares | Armazenamento compatível com S3. |
| Economia | Livro imutável, operações atômicas, idempotência e auditoria. |
| Dados atuais | Descartáveis, sem importação ou compatibilidade com o protótipo. |
| Escala inicial | Uma instância da API; sem necessidade concreta de Redis. |
| Docker inicial | Somente PostgreSQL em container no desenvolvimento; Next.js e Fastify continuam como processos Node no host. |

Não usar Route Handlers do Next.js como backend principal, polling da aplicação como transporte principal de partidas, banco acessível pelo frontend ou saldo/resultado calculado como autoridade no cliente. Não introduzir microsserviços, containerização das aplicações, filas externas ou workers separados sem necessidade demonstrada. O fallback HTTP long-polling do protocolo Socket.IO pode permanecer habilitado: ele não equivale à proposta descartada de consultar periodicamente a API para conduzir partidas.

Recomendações de implantação e desenho abaixo são propostas técnicas; valores de economia, regras de recuperação e políticas de partidas continuam abertos quando explicitamente indicados.

## Monorepo e responsabilidades

| Destino proposto | Conteúdo e responsabilidade |
| --- | --- |
| `apps/web/` | Aplicação Next.js existente: `app`, `components`, `features` de interface, `lib` cliente, `three`, fontes e `public`. |
| `apps/api/src/modules/` | Módulos de auth, users, wallet, rewards, coupons, betting, games, pages e administração, criados conforme utilizados. |
| `apps/api/src/db/` | Pool `pg`, schemas Drizzle, migrations e seeds necessários. Credenciais exclusivas da API. |
| `apps/api/src/realtime/` | Inicialização Socket.IO, autenticação de conexões, assinaturas e adaptação de comandos aos serviços. |
| `apps/api/src/scheduling/` | Executor interno de automações persistidas, no mesmo processo da API. |
| `packages/shared/` | Schemas Zod de entrada/saída, erros públicos, contratos HTTP/eventos e tipos de estado público. |
| Raiz | Workspace, lockfile único, comandos de coordenação, documentação e convenções. |

A menor reorganização recomendada é mover o frontend inteiro em uma etapa mecânica e isolada. Manter relações entre pastas e o alias `@/` apontando para `apps/web`, sem extrair o design system ou reescrever features. Mover testes de frontend junto dele; transferir testes de regras para a API quando o motor mudar de responsabilidade. Ajustar scripts, globs de ESLint/TypeScript, Playwright, `components.json` e raiz do Turbopack para o workspace, preservando configurações existentes. O `tsconfig` atual inclui `**/*.ts`: cada aplicação precisará de escopo próprio para não compilar a outra incidentalmente.

Usar recursos nativos do pnpm e dependências `workspace:`; não há justificativa atual para outro orquestrador de monorepo. Cada aplicação terá configuração, build e variáveis próprios. `shared` não pode importar React, Next.js, Fastify, Drizzle, banco, segredos ou módulos internos das aplicações.

O Next.js apresenta páginas e estados de interface, comunica-se por HTTP/Socket.IO e pode consultar a API durante SSR. O Fastify valida, autoriza, executa serviços e persiste. HTTP e Socket.IO chamam os mesmos serviços; não duplicar regras nos handlers. O frontend não importa serviços internos da API, nem mesmo em Server Components.

O tipo atual `Game` contém `deck` e `seed`: não deve ser exportado para `shared`. Reaproveitar motores e testes dentro do módulo de jogo da API, substituindo a aleatoriedade de produção por CSPRNG e mantendo uma fonte determinística injetável para testes. Expor apenas cartas/ações visíveis e o estado público necessário à apresentação. Não criar um pacote de motor compartilhado apenas por antecipação.

## APIs HTTP e Socket.IO

Endpoints de domínio ficam no Fastify sob `/api/v1`. Usar schemas Zod tanto na borda HTTP quanto nos eventos, projeções explícitas de saída, erros estruturados e paginação. O validador padrão do Fastify é JSON Schema: a integração com Zod deve ser explícita, não somente uma anotação TypeScript.

| HTTP | Operação |
| --- | --- |
| `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/csrf` | Cadastro, sessão e proteção das mutações. Recuperação depende da decisão de produto. |
| `/me`, `/me/profile`, `/me/password`, `/me/avatar` | Identidade, configurações e avatar da conta autenticada. |
| `/me/wallet`, `/me/transactions`, `/me/predictions` | Saldo e históricos próprios, com totais e paginação. |
| `/rewards/daily/claim`, `/coupons/redeem` | Concessões transacionais e idempotentes. |
| `/games`, `/pages/:slug`, `/rankings`, `/markets` | Consultas públicas com dados permitidos para visitantes. |
| `/markets/:id/predictions` | Registro de palpite e débito numa transação. |
| `/matches`, `/matches/:id/join`, `/matches/:id/start`, `/matches/:id/leave` | Ciclo de vida persistido, entrada, início e abandono explícito. |
| `/matches/:id` | Snapshot autorizado para carregamento inicial e recuperação. |
| `/admin/*` | Usuários, ajustes, catálogo, páginas, cupons e ciclo de vida de mercados. |

Métodos HTTP devem refletir cada ação: GET para consultas; POST para comandos; PATCH/DELETE somente quando permitidos pelo domínio. Separar editar, encerrar, apurar e pagar um mercado. Não disponibilizar uma gravação genérica de saldo ou de todo o estado de uma partida. Alterações administrativas carregam versão esperada quando sujeitas a edição concorrente.

| Evento Socket.IO proposto | Finalidade |
| --- | --- |
| Cliente → `match:subscribe` | Assinar atualizações após verificar sessão e participação; não cria vaga nem cobra entrada. |
| Cliente → `match:command` | Enviar decisão humana com `commandId`, `matchId`, `expectedVersion` e ação validada. |
| Cliente → `match:sync` | Solicitar eventos posteriores à versão aplicada ou snapshot atual. |
| Cliente → `match:unsubscribe` | Encerrar assinatura; não abandonar a partida. |
| Servidor → `match:updated` | Envelope versionado com eventos ordenados e estado público pertinente. |
| Servidor → `match:presence` | Presença transitória; não altera resultado ou saldo. |
| Servidor → `session:revoked` | Avisar revogação e desconectar a sessão afetada. |

Criação e ingresso via HTTP emitem atualizações do lobby pelo Socket.IO. Room de transporte não é a entidade de domínio. Código da sala e `socket.id` não autorizam jogadas; identidade vem da sessão e vínculo persistido com a vaga. Manter a URL atual `/jogos/flip7?partida=CODIGO`, passando a resolver um código do servidor.

### Comandos, concorrência e recuperação

1. Validar payload, sessão vigente, status da conta e participação. Decisões pendentes podem pertencer a alguém diferente do turno comum; validar o controlador efetivo.
2. Abrir transação e bloquear a partida. Consultar recibo do `commandId` antes de rejeitar uma versão antiga: um retry de comando aceito deve retornar o resultado original.
3. Conferir versão, prazo pelo relógio do servidor e ação legal. Reutilização do ID com conteúdo diferente é conflito. Bloquear contas econômicas em ordem consistente quando necessário.
4. Executar a transição e salvar snapshot privado, versão, comando, eventos públicos e próxima automação. Quando há efeito financeiro imediato, registrar lançamentos na mesma transação.
5. Confirmar no PostgreSQL antes do ack e do broadcast. Não manter transação aberta enquanto aguarda rede ou animação.

Socket.IO mantém ordenação, mas sua entrega padrão é “no máximo uma vez”. A aplicação não pode presumir entrega garantida nem execução única do efeito por receber um evento. Persistir recibos e eventos; repetir com o mesmo `commandId` após ack incerto. Se a aba recarregar, consultar estado/recibo antes de reenviar uma decisão incerta com um novo ID.

Eventos de partida persistidos terão controle de despacho. O executor da API retoma eventos confirmados ainda não despachados se houver queda entre commit e broadcast. Emitir antes de marcar o despacho admite duplicatas, que o cliente descarta pela versão. Despacho não significa confirmação de recebimento de cada navegador; replay/snapshot continua necessário.

Na reconexão, autenticar novamente, reautorizar assinaturas e informar a última versão aplicada. Retornar eventos faltantes disponíveis ou snapshot consistente. Durante a assinatura inicial, armazenar eventos recebidos até concluir o snapshot e aplicar somente versões posteriores; lacunas provocam sincronização. A recuperação automática do Socket.IO não é a garantia de durabilidade: inicialmente pode ficar desativada para usar um único protocolo de recuperação pelo banco. Se habilitada depois, não pular middlewares e revalidar permissões.

O cliente mantém estado confirmado separado da fila visual GSAP. Compras, trocas, estouros e resultados são apresentados em ordem, sem o término de uma animação autorizar o próximo turno. Ao receber snapshot após desconexão prolongada, não é obrigatório reproduzir todas as animações históricas. Comandos de bot, compras obrigatórias e avanço de rodada são internos; o cliente não pode acionar livremente `step` ou `next`.

## Autenticação e segurança por topologia

O Fastify preserva maiúsculas e minúsculas do username informado no cadastro, com unicidade e login sem distinção de caixa; o nome público continua separado e a senha usa hash Argon2id. Um índice único em `lower(users.username)` impede cadastros como `Tonho` e `TONHO`, inclusive sob concorrência. A busca e o limite de tentativas por usuário usam a mesma comparação, sem converter o valor armazenado ou retornado pela API. Não há e-mail obrigatório nem endereço fictício para satisfazer uma biblioteca. Usar biblioteca mantida para Argon2id e APIs criptográficas padrão para tokens, sem implementar algoritmos próprios. Papel inicial `user`; promoção inicial a `admin` por procedimento controlado, sem credenciais padrão em seeds.

Tokens de sessão aleatórios ficam somente em cookie HttpOnly; o banco guarda hash, usuário, expiração absoluta/inatividade e revogação. Logout revoga no banco; troca/recuperação de senha revoga outras sessões; suspensão bloqueia operações. Duração e renovação precisam ser definidas. As conexões Socket.IO também expiram e são desconectadas ao revogar a sessão. Handshake autenticado não substitui validação de sessão/permissão em comandos posteriores e em assinaturas privadas. Hooks HTTP do Fastify não protegem automaticamente os eventos Socket.IO.

Recomendação inicial: mesma origem pública, com proxy HTTPS direcionando `/api/v1` e `/socket.io` ao Fastify e páginas ao Next.js. Cookie de produção host-only, prefixo `__Host-`, `Secure`, `HttpOnly`, `Path=/` e `SameSite=Lax` explícito. O Next.js pode encaminhar somente o cookie necessário ao endereço interno confiável da API em consultas SSR; autenticação continua na API. Login/logout e renovação do cookie passam pelo navegador até o Fastify. Um fetch durante SSR não retransmite automaticamente `Set-Cookie` ao navegador.

| Topologia | Requisitos |
| --- | --- |
| Mesma origem pública recomendada | Evita CORS entre aplicações, mesmo implantadas em máquinas diferentes atrás do proxy. CSRF e autorização continuam obrigatórios. |
| Desenvolvimento em portas diferentes de `localhost` | CORS com origem e porta exatas e credenciais; cookie de desenvolvimento sem `Secure`/prefixo `__Host-`. Portas não isolam cookies. |
| Subdomínios separados | Origens distintas exigem CORS explícito e credenciais. Cookie host-only da API não chega ao SSR do frontend; manter o proxy de mesma origem é preferível a ampliar `Domain`. |
| Domínios de sites diferentes | `SameSite=None; Secure` pode ser necessário, mas bloqueios de cookies de terceiros permanecem. Não adotar como topologia inicial. |

Mutações HTTP, inclusive autenticação, precisam de política CSRF: origem permitida e token adequado ao contexto/sessão, não somente `SameSite`. No Socket.IO, validar origem também no handshake/upgrade com `allowRequest` e validar token CSRF de conexão; CORS sozinho não restringe WebSocket. O token CSRF pode ser acessível ao cliente; o token de sessão não.

Aplicar limites por conta/IP a login, cadastro e recuperação, além de limites de conexões, comandos e tamanho de payload. Na instância única, limites de tráfego podem começar em memória; contadores de tentativas sensíveis que devam sobreviver a reinícios ficam no PostgreSQL. Unicidade de resgates e idempotência nunca dependem de rate limiting. Configurar confiança somente no proxy conhecido, impedir spoofing de IP e excluir senhas, tokens e estado privado dos logs.

Inicialmente, `user` e `admin` bastam; “Moderador” nos fixtures não confirma um terceiro papel. Cada serviço autoriza sujeito, ação e recurso, incluindo administração via HTTP e Socket.IO. O Next.js pode controlar renderização consultando `/me`, mas não concede acesso. Manter 404 para administração não autorizada e respostas de sessão apropriadas nos endpoints pessoais.

Recuperação sem e-mail é questão de produto: recomendação de código de recuperação aleatório mostrado uma vez, hash no banco, consumo único, rotação e limites de tentativas; alternativa de não oferecer recuperação automática, documentando perda de acesso sem credencial. Atendimento manual só com comprovação previamente definida, nunca por conhecer username ou saldo. Não presumir um fluxo de e-mail ou perguntas de segurança.

## Banco, Croins e regras preservadas

O modelo anterior continua adequado; mudar a aplicação proprietária do banco não exige redesenhar os domínios. As tabelas serão introduzidas por etapa, não todas no bootstrap.

| Domínio | Modelo proposto e garantias |
| --- | --- |
| Contas | `users`, `sessions`; `recovery_codes` se aprovado o fluxo. Username preservado com índice único sem distinção de caixa, IDs internos estáveis e sessões por usuário. |
| Croins | `wallet_accounts`, `wallet_operations`, `wallet_entries`. Conta por usuário, contas internas de emissão/casa/potes, chave de idempotência e lançamentos imutáveis. |
| Recompensas | `daily_claims` auditável por carteira, com request id único e uma concessão por dia no fuso America/Sao_Paulo (liberação à meia-noite); `coupons` e `coupon_redemptions` único por usuário/cupom. |
| Jogos | `games`, `matches`, `match_players`, `match_actions`, `match_events`. Vaga única por posição, usuário autenticado por participação online, versão de regras e snapshot privado. |
| Apostas | `markets`, `market_options`, `predictions`, `market_settlements`, `settlement_items`. FKs, opções estáveis, apuração única e recibos de pagamentos. |
| Conteúdo e auditoria | `pages`, `audit_logs`; metadados de avatar conforme necessário. Documento JSON com tags permitidas, autoria e versões. |
| Gamificação | `achievements`, `user_achievements`, `user_daily_activity`. Concessões únicas e dias de atividade registrados pelo servidor. Rankings começam como consultas sobre resultados reais. |

Acrescentar à partida versão monotônica, prazo do turno, `next_action_at` e motivo da próxima automação. Expandir `match_actions` com autor, `commandId`, hash do conteúdo e resultado aceito; criar eventos públicos com unicidade por partida/versão e estado de despacho. Separar esses contratos do snapshot privado. Na liquidação, distinguir “apurada aguardando autorização” de “pagamento solicitado e pendente”.

Croins são inteiros. Usar `BIGINT` no PostgreSQL e `BigInt` nos cálculos proporcionais, com limites definidos e serialização consistente. Para preservar controles numéricos atuais, restringir valores públicos à faixa inteira segura do JavaScript; não converter silenciosamente inteiros maiores. Datas são instantes UTC; dias de bônus/presença usam `America/Sao_Paulo`.

Cada operação registra origem, autor, motivo, referência e chave de idempotência vinculada ao conteúdo e ao escopo do usuário/comando. Transferências somam zero entre contas; emissão explícita usa conta técnica própria. Contas de usuários e potes não podem ficar negativas; a conta técnica de emissão tem tratamento separado. A transação deve garantir lançamentos, saldo materializado e vínculo de domínio juntos, com validação da soma e restrição diferida apropriada no banco. Correções econômicas criam lançamentos compensatórios; não alteram lançamentos anteriores.

No palpite, bloquear mercado e contas, revalidar prazo após o bloqueio e registrar débito, pote e palpite atomicamente. Apuração fixa participantes e plano imutável; manter rateio proporcional sem taxa, acerto exato para números, devolução sem vencedores e sobras determinísticas. Resultado de evento é informado por administrador autorizado e auditado, não comprovado automaticamente pelo servidor. Não permitir editar pergunta, critérios e opções após entrada de participantes. Pagamentos repetidos não duplicam crédito; cancelamento só termina após devoluções. Começar com liquidação inteira transacional; lotes somente se o volume justificar.

Partidas com Croins exigem financiamento antes do início e prêmio ligado ao resultado persistido do motor. O pote atual contra bots usa entradas simuladas: recomendação pendente de produto é a casa financiar as vagas dos bots e receber seus prêmios de volta. Não criar Croins implicitamente ao multiplicar entrada por lugares. A política de financiamento deve ser aprovada antes de habilitar essa modalidade.

Cupons preservam a configuração visual atual: código definido pelo administrador, valor por resgate, limite global opcional, início/término opcionais, pausa e um uso por usuário. Datas ausentes viram `NULL`; o fuso de entrada administrativa precisa ser explícito, sem interpretar silenciosamente horários locais dos mocks. Guardar o valor efetivamente concedido em cada resgate; alterações posteriores não reescrevem histórico. Checagem de limite, unicidade, resgate e crédito ficam na mesma transação.

Avatar é validado e reprocessado pela API, com limites de arquivo e dimensões; salvar chave de objeto/metadados, não data URL no perfil. Credenciais S3 ficam na API. Documento de página é validado no servidor e renderizado sem HTML arbitrário. IDs de usuário e relações não dependem de nomes públicos editáveis.

## Tarefas persistentes sem serviços adicionais

O mesmo processo Fastify executará um loop interno, iniciado após conexão com o banco e encerrado com a aplicação. O PostgreSQL guarda o trabalho pendente: prazo, próxima ação e versão da partida; pedido de pagamento autorizado; eventos ainda não despachados. Não é necessário um worker separado ou uma fila externa inicialmente.

O loop busca lotes pequenos vencidos, bloqueia linhas (`FOR UPDATE`, podendo usar `SKIP LOCKED` para concorrência entre executores) e confere novamente versão/condições na transação. Cada automação usa identidade determinística para não executar duas vezes. Ao reiniciar, reler o banco e retomar pendências. Timers em memória só acordam o executor; não são a agenda durável. A política de tolerância após indisponibilidade não deve punir automaticamente jogadores por uma queda do servidor.

Retomar apenas pagamentos já solicitados/autorizados; não pagar automaticamente mercados somente apurados. Falha entre lançamento e confirmação é resolvida por atomicidade e recibo, não por crédito manual presumido. O encerramento normal deve parar novas conexões, drenar operações e fechar Socket.IO/pool; a recuperação também precisa funcionar em queda abrupta.

Uma instância usa o adapter em memória do Socket.IO para presença e roteamento. PostgreSQL preserva partidas, não conexões. Se houver necessidade medida de múltiplas instâncias, avaliar adapter de broadcast e afinidade de conexões quando houver long-polling; locks, versões e idempotência já deverão funcionar entre processos. Não pressupor que subir duas instâncias resolve distribuição de rooms.

## Dados descartáveis, schema e produção

A Croebet não tem dados reais de produção a migrar. Usuários, saldos, partidas, apostas, cupons, históricos, IDs e formatos do protótipo podem ser descartados. Não criar importadores de localStorage, dual-write, adaptadores de versões antigas, conciliação de saldos fictícios ou rotinas de preservação de fixtures. Caches de interface são dispensáveis. Não há obrigação de manter um modo demo paralelo ao backend para proteger esses dados.

**Migrations de schema** versionam tabelas, colunas, índices, constraints e demais estruturas; **migração de dados antigos** transfere/adapta informações históricas. Precisamos da primeira para reproduzir o banco, não da segunda para transportar o protótipo. Durante desenvolvimento descartável, recriar o banco e consolidar migrations ainda não publicadas é aceitável se a equipe partir da mesma base e a criação limpa continuar reproduzível. Não reescrever migrations já aplicadas em produção.

Seeds devem ser reproduzíveis, com chaves estáveis e execução idempotente para configurações, catálogo e referências necessárias. Não sobrescrever conteúdo administrativo em produção ao repetir seed. Não criar usuários fictícios, partidas ou extratos no seed normal; cenários de testes pertencem às fixtures isoladas dos testes. Criar primeiro administrador por procedimento explícito, sem senha fixa em código.

Descartar os valores do protótipo. A configuração aprovada fica em `apps/api/src/modules/economy/config.ts`: cadastro com 30 Croins, resgate de 10 Croins uma vez por dia com liberação à meia-noite de São Paulo, sem condição de saldo, sugestões 1/5/10/50 e padrão 5. A API publica os valores; o frontend não mantém cópias ou fallback econômico local. A concessão inicial ocorre numa transação com a criação da conta/carteira. Cupons têm valor próprio definido pelo administrador, sem valor padrão.

| Prática | Desenvolvimento/teste descartável | Produção e dados reais |
| --- | --- | --- |
| Reset/recriação | Permitido no banco explicitamente identificado para esse ambiente. | Proibido nos comandos de desenvolvimento e nas rotinas normais de implantação. |
| Evolução do schema | Pode recriar tabelas/base; validar criação limpa. | Migrations revisadas e não destrutivas; preservar dados e compatibilidade do deploy. |
| Dados | Sem importação dos mocks; fixtures isoladas podem ser recriadas. | Preservar usuários, livros, partidas e auditoria; definir retenção explicitamente. |
| Credenciais | Bancos e usuários próprios para desenvolvimento/teste. | Credenciais separadas, acesso mínimo e segredos fora do repositório. |
| Backup | Dados descartáveis não exigem rotina para preservar os mocks. | Backup e restauração testada obrigatórios antes de receber usuários reais. |
| Segurança de domínio | Atomicidade, autorização, validação e idempotência são exigidas desde o começo. | Mesmas garantias, com operação monitorada. |

O futuro comando de reset deve negar por padrão: exigir ambiente development/test, destino de banco explicitamente permitido e confirmação do nome/destino; rejeitar produção mesmo com flag de força. Não confiar somente em `NODE_ENV`, nome parcial ou host localhost, que pode ser túnel para outro ambiente. Combinar identificação de ambiente do banco, allowlist do destino e credenciais segregadas. Não distribuir credenciais de produção ao fluxo de reset/testes; a conta de runtime não deve possuir permissões de DROP/DDL. Testar que configuração ausente, ambígua ou de produção é recusada antes de qualquer operação destrutiva. Não executar reset nesta etapa documental.

O marco de produção é a primeira abertura para usuários reais, mesmo em beta: antes dele, implantar restrições de reset, backups com restauração e migrations não destrutivas. Recriar banco de desenvolvimento continua permitido depois desse marco, desde que isolado e sem dados reais.

## Integração do frontend e descarte dos mocks

Substituir fontes de dados por domínio, preservando apresentação e navegação. O provider de sessão obtém identidade/permissões da API; comandos de carteira, bônus e palpites deixam de gravar localStorage. Manter interfaces de hooks quando coerentes, adaptando ações síncronas a promessas e distinguindo carregamento, erro e sessão expirada. Falha da API não concede saldo inicial, restaura carteira demo ou confirma sucesso localmente.

O `SiteConfigProvider` pode manter uma fachada de leitura para evitar reescrever componentes, mas consultas públicas e administrativas terão respostas distintas. Separar `save` genérico em operações por entidade, com versão esperada e sem enviar toda a configuração obsoleta. Substituir `useDemoCoupons` por consultas/comandos reais, mantendo cards, editor interno e histórico. Sessão não precisa carregar todo o extrato ou palpites; totais devem vir do servidor ao paginar.

O Flip 7 troca a função que hoje executa `transition` e grava snapshots por envio de comandos e aplicação de eventos confirmados. Remover agendamentos de regras no navegador; manter os timers exclusivamente visuais. Reaproveitar regras e testes no módulo da API sem importar snapshots antigos. Caso o modo de pessoas no mesmo dispositivo permaneça, definir controle de vagas convidadas como modalidade livre, sem converter nomes digitados em contas autenticadas.

Tema, visibilidade de painéis e preferências de configuração podem continuar locais. Não é necessário converter seus formatos antigos: valores inválidos podem voltar ao padrão. Remover helpers de migração, limpeza de palpites antigos e fixtures conforme cada domínio deixar de usá-los. Nunca misturar carteira persistente com partidas/apostas locais que controlem Croins; enquanto uma integração não estiver pronta, sua operação econômica permanece indisponível na versão funcional.

## Infraestrutura mínima

Desenvolvimento: Next.js e Fastify como processos Node no host, PostgreSQL em Docker Compose, e bucket S3 exclusivo quando avatares forem integrados. Testes de banco usam destino separado. Docker foi aprovado inicialmente somente para o banco; não adicionar containers das aplicações, emulador S3 ou processo de worker. Um adaptador de arquivos local pode servir apenas ao desenvolvimento de avatar se necessário, sem virar a persistência de produção.

Produção inicial recomendada: um servidor com Next.js e uma instância Fastify em processos separados, supervisionados pelo sistema, com PostgreSQL em container ou serviço gerenciado conforme a implantação definida; bucket S3 para avatares. Proxy reverso termina HTTPS e encaminha páginas ao Next.js e `/api/v1` e `/socket.io` ao Fastify, suportando upgrade WebSocket e timeouts compatíveis com heartbeat. Banco não exposto à internet. Backups ficam fora desse servidor e a restauração é validada antes do lançamento. PostgreSQL gerenciado é alternativa caso a redução de manutenção justifique o custo; provedor e dimensionamento permanecem abertos.

O Next.js não precisa reiniciar para publicar a API, nem a API para publicar o frontend. Cada build inclui a versão dos contratos que utiliza. Antes de mover qualquer processo para outra máquina, preservar a mesma origem pública pelo proxy e manter APIs/eventos compatíveis com clientes já abertos. Alterações de schema são executadas uma vez por implantação, com credenciais de migration separadas. Redis e workers externos só serão reavaliados diante de necessidade concreta de escala, isolamento ou carga.

## Roadmap incremental

As etapas 1–3 tiveram implementação autorizada e iniciada; validar os bloqueios de ambiente antes de considerá-las concluídas. A etapa 4 teve sua base autorizada e iniciada, sem concessões até aprovação dos valores. Perfil e avatar também foram antecipados; os demais recursos continuam planejados. Cada entrega funcional inclui seus testes; o objetivo é integrar código/interface, nunca migrar dados mockados.

| Etapa | Entrega | Dependências | Critério de conclusão |
| --- | --- | --- | --- |
| 1 | Reorganização mecânica do monorepo pnpm | Aprovação para implementar | Frontend em `apps/web`, aliases/assets/rotas preservados, configurações isoladas e verificações existentes aprovadas. Sem redesign. |
| 2 | Fastify, shared, PostgreSQL e Drizzle | 1 | API inicia isolada; migrations constroem base vazia; Zod valida contratos; resets recusam produção/ambiguidade; seeds somente de referência. |
| 3 | Cadastro, sessões e permissões | 2; decisão de username/sessões | Senha verificada, unicidade concorrente, cookie/CSRF/CORS e revogação testados. Recuperação só se houver política aprovada. |
| 4 | Livro de Croins e concessão inicial | 3; valores aprovados | Cadastro/carteira/concessão atômicos; concorrência não permite gasto excessivo; retry não duplica lançamento. |
| 5 | Perfil, avatar e usuários administrativos | 3–4 | Dados reais substituem fixtures; suspensão revoga acesso; ajustes têm motivo e auditoria; arquivos validados na API. |
| 6 | Bônus diário | 4; recompensa aprovada | Uma concessão por usuário/dia de São Paulo, inclusive sob concorrência e retry. |
| 7 | Cupons e resgates | 4–5 | Editor existente integrado; datas/limites/pausa/uso único/crédito validados juntos; histórico exibe valor concedido. |
| 8 | Catálogo e páginas | 2–3 | Publicação compartilhada, rascunhos privados e pausa conferida pelo servidor. Seeds de referência reproduzíveis. |
| 9 | Mercados e registro de palpites | 4 e 8 | Seleção, prazo, débito, pote e palpite atômicos; fechamento concorrente não aceita entrada indevida. |
| 10 | Apuração, pagamento e devolução | 9 | Plano imutável conserva o pote; autor auditado; repetição/rollback não duplicam créditos. |
| 11 | Motor Flip 7 no servidor | 2–3 e 8 | Regras atuais reaproveitadas, RNG seguro em produção e determinístico em testes; snapshot privado persistido sem vazamento nos DTOs. |
| 12 | Salas e comandos multiplayer Socket.IO | 11 | Duas contas reais entram e jogam com autorização, versões, acks e IDs de comandos; lobby sincronizado. Sem polling da aplicação como transporte principal. |
| 13 | Reconexão, bots e timeouts recuperáveis | 12; políticas de tempo/abandono | Queda/reinício entre commit e envio recupera estado; replay não repete ações; automações retomam do banco sem aba aberta. |
| 14 | Croins em partidas | 4 e 13; financiamento/abandono aprovados | Entradas financiadas antes de iniciar; conclusão e prêmio consistentes; empate e retries não duplicam pagamento. |
| 15 (pós-v1) | Rankings, conquistas e visão geral | Fontes reais de 6, 9–10 e 13–14 | Métricas conferem com operações/resultados; bônus, ajustes e devoluções não são ganhos/perdas de jogo. Critérios aprovados. |
| 16 | Preparação e abertura para produção | Recorte funcional escolhido | E2E, testes de reinício/concorrência/rollback, isolamento de resets, deploy independente e restauração de backup aprovados antes dos primeiros dados reais. |

Etapas independentes podem ser reordenadas quando seus pré-requisitos estiverem prontos. Não é obrigatório completar todos os recursos para um lançamento parcial, mas nenhum fluxo econômico pode ficar parcialmente autoritativo. Primeiro recorte recomendado: etapas 1–4. Segurança, limites de produção e backups não podem ser adiados para depois da abertura de um beta real.

Não existem etapas de importação de usuários, conciliação de saldos fictícios, conversão de snapshots ou compatibilidade com dados locais. Testar migrations desde banco vazio é validação de estrutura, não migração do protótipo.

## Validação e decisões ainda abertas

Manter Node test runner e Playwright existentes, sem trocar ferramentas sem necessidade. Reaproveitar testes das regras e substituir testes exclusivos de persistência antiga por integração com PostgreSQL real. Testar comandos duplicados, versões obsoletas, turno/alvos indevidos, duas abas, contas suspensas, cookies/origens, resgates concorrentes, saldo insuficiente, rollback e queda antes/depois do commit. Clientes Socket.IO reais de teste exercitam conexão, autorização e replay; testes HTTP podem usar a injeção do Fastify. Verificar que DTOs, bundles e logs não expõem senhas, tokens, baralho ou estado aleatório.

Após mudanças de implementação, executar lint, typecheck, testes e build por aplicação e as suítes agregadas da raiz; em mudanças interativas, E2E com web + API e banco de teste. Mudança somente documental exige conferir links, consistência e diff, sem alegar execução de testes funcionais inexistente.

Pendências de produto: saldo inicial e bônus; política de username/senha e duração das sessões; recuperação sem e-mail; financiamento dos bots; acesso às salas e eventual espectador; controle do modo no mesmo dispositivo; início/entrada/saída do lobby; tolerância a desconexão, timeouts e abandono; tratamento de indisponibilidade; métricas/períodos dos rankings e concessão de conquistas. A consulta atual ao `CROEBET.md` não autoriza inventar valores finais de economia.

Pendências operacionais: domínio/provedor, dimensionamento e frequência/retenção de backups. Recomendações deste documento não tornam essas escolhas automaticamente aprovadas. Registrar aqui as decisões quando forem fechadas.

## Referências técnicas verificadas

- [pnpm workspaces](https://pnpm.io/workspaces).
- [Fastify: servidor e trustProxy](https://fastify.dev/docs/latest/Reference/Server/) e [validação/TypeScript](https://fastify.dev/docs/latest/Reference/TypeScript/).
- [Socket.IO: garantias de entrega](https://socket.io/docs/v4/delivery-guarantees/), [recuperação](https://socket.io/docs/v4/connection-state-recovery/), [CORS](https://socket.io/docs/v4/handling-cors/) e [proxy reverso](https://socket.io/docs/v4/reverse-proxy/).
- [PostgreSQL: locks](https://www.postgresql.org/docs/current/explicit-locking.html) e [SELECT / SKIP LOCKED](https://www.postgresql.org/docs/current/sql-select.html).
- [Drizzle: transações](https://orm.drizzle.team/docs/transactions).
- [OWASP: sessões](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) e [hash de senhas](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

## Fundação iniciada — operação e validação

O frontend e seus testes foram movidos integralmente para `apps/web`, com `@/` preservado e raiz Turbopack no monorepo. `apps/api` contém Fastify com liveness em `GET /api/v1/health` e readiness em `GET /api/v1/health/ready`, configuração Zod, pool `pg`, conexão Drizzle, migration inicial e seed da identificação operacional do ambiente. Nenhum usuário, valor de economia ou endpoint de domínio foi introduzido. Socket.IO será conectado na etapa multiplayer, sem transporte de polling próprio.

Comandos na raiz:

| Comando | Uso |
| --- | --- |
| `pnpm install` | Instalar/resolver dependências e atualizar o lockfile do workspace. Ainda pendente por indisponibilidade do registry. |
| `pnpm dev` | Iniciar web e API em paralelo; a API exige `.env` configurado. |
| `pnpm dev:web` / `pnpm dev:api` | Iniciar aplicações separadamente. |
| `pnpm build` | Compilar shared, API e frontend na ordem de dependências. |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Verificações agregadas; dependem da instalação completa. |
| `pnpm test:e2e` | Playwright do frontend existente. |
| `pnpm test:integration` | Integração da API com `TEST_DATABASE_URL` de banco isolado, migrado e identificado como test. |
| `pnpm db:migrate` / `pnpm db:seed` | Aplicar estrutura e inserir identificação de ambiente. |
| `pnpm db:generate` | Gerar próximas migrations a partir do schema Drizzle. |
| `pnpm db:reset` | Recriar exclusivamente o destino development/test autorizado, aplicando migration e seed. |

Preparação: copiar `apps/api/.env.example` para `apps/api/.env` e ajustar o banco de desenvolvimento; a configuração demo do frontend está em `apps/web/.env.example` e usa `.env.local` nessa aplicação. `APP_ENV` e `DATABASE_URL` são obrigatórios na API. Não são criados banco ou usuários PostgreSQL automaticamente. Criar o banco isolado, executar migrate e seed antes de esperar readiness positiva. Liveness independe do banco; readiness retorna 503 se conexão, schema ou identificação não estiverem prontos.

Reset exige `APP_ENV=development` ou `test`, `NODE_ENV` diferente de production, identificação compatível já persistida, URL exata em `DB_RESET_ALLOWED_URL` e nome real do banco em `DB_RESET_CONFIRM`. Banco sem identificação não pode ser resetado; criar/migrar e semear explicitamente primeiro. Essas variáveis ficam ausentes por padrão. Não há flag force. Em produção, migrations exigem `DATABASE_MIGRATION_URL` separada; usuário runtime deve ser provisionado sem privilégios DDL. Nunca preencher allowlist de reset com destino de produção.

Validações observadas: 118 testes existentes do frontend aprovados; lint de todo o workspace aprovado; typecheck e build de produção do frontend aprovados com Node 22.22.0; contrato público Zod compilado/testado e guarda de reset testada. O registry npm falhou com `ENOTFOUND`, sem cache de Fastify/Drizzle/pg: instalação, resolução final do lockfile, build/typecheck completo e testes HTTP/Drizzle da API permanecem pendentes. A migration inicial e seu snapshot precisam ser conferidos com Drizzle Kit instalado. O PostgreSQL local instalado não inicia por ausência de `libicui18n.74.dylib`, impedindo validar migrations e rollback reais; nenhum banco existente foi alterado. Playwright foi tentado, mas o ambiente recusou `127.0.0.1:3100` com EPERM. Não considerar as etapas 1 e 2 totalmente validadas enquanto essas pendências não forem resolvidas.

## Cadastro e sessões — implementação iniciada

Acrescentados `users`, `sessions` e `auth_rate_limits`, migration `0001_auth`, schemas Zod e endpoints de cadastro, login, logout, CSRF, identidade e edição do nome público. Hash Argon2id com 19 MiB, duas iterações e paralelismo 1; sessão de 32 bytes aleatórios, armazenada como SHA-256. Contas nascem com papel user; nenhum nome ou variável pública concede admin. Logout exclui a sessão, expiração/suspensão invalida `/me`. Criação da conta e sessão é transacional, sem conceder Croins.

Padrões atuais de implementação: username preserva maiúsculas e minúsculas, com unicidade e login sem distinção de caixa, 3–24 caracteres ASCII (letras/números/ponto/sublinhado), removendo apenas espaços nas extremidades; senha de 8–128 caracteres sem trim (mínimo reduzido para 8 por decisão de produto em 18/11/2026); sessão por até 30 dias, com inatividade de 7 dias. A preservação da caixa foi aprovada em 18/11/2026 e introduzida pela migration `0002_preserve_username_case`; contas já gravadas em minúsculas permanecem como estão, pois a grafia original não foi armazenada. Recuperação sem e-mail e troca de senha permanecem fora desta rodada: não há fluxo de recuperação fictício. Valores econômicos continuam em aberto.

Aplicar `pnpm db:migrate` antes de usar a nova política em um banco existente; a migration substitui a restrição de minúsculas e a unicidade exata pelo índice único sem distinção de caixa. Os testes de contratos verificam a preservação no cadastro, login e resposta pública. O teste HTTP/PostgreSQL foi ampliado para conferir o valor persistido, login com diferentes grafias, colisão de cadastros concorrentes e limite de tentativas compartilhado. Sua execução continua pendente de `TEST_DATABASE_URL` isolada e acesso ao banco; gerar e conferir a migration não equivale a aplicá-la.

O frontend usa o contexto existente como fachada para `/api/v1/me` e os formulários enviam username/senha à API. Não lê sessão, senha, carteira ou permissões do localStorage. Login indisponível não gera identidade local. Nome público agora é salvo por PATCH; avatar/S3 permanece para etapa própria. Croins, bônus e palpites estão indisponíveis; o valor zero na interface é placeholder de carteira ainda não integrada, não regra de saldo inicial. Testes E2E antigos que presumem login demo precisarão de fixtures de contas reais ao integrar suas respectivas features.

Configuração adicional obrigatória na API: gerar `CSRF_SECRET` aleatório com pelo menos 32 caracteres e definir `WEB_ORIGIN` como origem exata, sem barra final. Em desenvolvimento acessar o navegador por `http://localhost:3000`, ou ajustar WEB_ORIGIN. Next encaminha `/api/v1/*` para `API_INTERNAL_URL` (padrão `http://127.0.0.1:3001`); é proxy de transporte, sem lógica de negócio ou banco no Next. Mesma origem pública evita CORS entre aplicações. O proxy definitivo de produção continua pendente e deve suportar Socket.IO quando integrado.

Cookies HttpOnly, host-only, SameSite=Lax; em produção Secure e prefixo __Host-. Toda mutação exige Origin exata e HMAC CSRF vinculado ao nonce HttpOnly e à sessão atual; inclui proteção pré-login. Contadores persistentes limitam cadastro por IP e login por IP/username, com mensagens genéricas para credenciais. Ainda é necessário configurar confiança no proxy conhecido antes de publicar para não agrupar clientes sob o IP do proxy; não habilitar confiança irrestrita. As respostas de auth usam no-store e projeção pública sem hashes/tokens.

Instalar dependências com `pnpm install` (inclui @fastify/cookie e argon2, com build autorizado especificamente no workspace), configurar o banco/segredo e aplicar `pnpm db:migrate` e `pnpm db:seed` antes de usar contas reais. O lockfile completo e a comparação dos snapshots/migrations pelo Drizzle Kit continuam pendentes da instalação. Não há API real funcionando neste ambiente enquanto o registry e PostgreSQL permanecerem indisponíveis. Testes HTTP/PostgreSQL de cadastro, duplicidade, senha incorreta, CSRF, suspensão e logout estão escritos em `apps/api/tests/integration/auth.test.mjs`, sem declarar execução aprovada.

Validação desta rodada: lint do workspace e typecheck do frontend aprovados; build de produção do frontend aprovado com Node 22.22.0; 118 testes unitários existentes e quatro testes de contratos/CSRF/reset aprovados. Typecheck/build/testes agregados da API continuam bloqueados por dependências ausentes; integração não executou por falta de pg/Fastify/Argon2. Playwright voltou a falhar antes de iniciar o navegador com EPERM na porta 3100. Esses resultados não comprovam autenticação real funcionando com banco.

Atualização após instalação pelo usuário: Fastify, pg, Drizzle, cookie e Argon2 estão disponíveis; o carregamento nativo do Argon2 foi confirmado. Shared, API e frontend passaram em TypeScript; os seis testes unitários HTTP/contratos/segurança passaram e Drizzle Kit check aprovou os metadados. O `.env` local da API foi preparado com segredo aleatório, usando provisoriamente o destino de desenvolvimento do exemplo. Ainda falta confirmar/provisionar PostgreSQL e ajustar a conexão antes de aplicar migrations; não houve validação de cadastro/login com banco. O runtime Docker não pôde ser inspecionado pelo assistente por permissão no socket. A versão pnpm 12.21.0 escolhida pelo usuário não foi alterada; o Corepack deste executor tentou acessar um cache fora da área permitida, portanto os testes foram executados pelos binários locais instalados.

## PostgreSQL em Docker — ambiente local

Decisão aprovada: Docker somente para o banco inicialmente. `compose.yaml` na raiz define PostgreSQL 18, volume nomeado em `/var/lib/postgresql` (caminho da imagem oficial 18+), healthcheck `pg_isready`, restart unless-stopped e porta 5432 vinculada exclusivamente a `127.0.0.1`. Next.js e Fastify continuam no host. Não há Dockerfiles de aplicações nem nova fila/worker. Esta configuração é de desenvolvimento e não é um manifesto de produção.

Pré-requisito: Docker Desktop instalado e iniciado no Mac. Docker e Compose já foram encontrados neste computador. O assistente não consegue operar o engine pelo socket nesta sessão; isso não comprova que o Docker Desktop esteja parado. Não alterar permissões do socket para contornar essa restrição.

A raiz tem `.env.example` para POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD e POSTGRES_PORT; `.env` local recebe senha aleatória. A conexão correspondente fica em `apps/api/.env`, com segredo CSRF separado. Os arquivos de segredos são ignorados pelo Git e não devem ser enviados em mensagens. Em novas instalações, copiar o exemplo da raiz para `.env`, definir senha local e montar a mesma DATABASE_URL na API. Credenciais deste container destinam-se ao desenvolvimento, não aos papéis de runtime/migration de produção.

Na raiz do projeto, com Docker Desktop aberto:

```sh
docker compose up -d --wait postgres
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Depois, acessar `http://localhost:3000`; WEB_ORIGIN da API usa essa origem. `pnpm db:up` equivale ao primeiro comando. `pnpm db:stop` para o banco sem remover o volume; `pnpm db:logs` acompanha os logs. `docker compose ps` mostra a saúde do serviço. O banco continua existindo após parar/recriar o container. POSTGRES_* inicializa apenas volume vazio: mudar a senha no `.env` não altera automaticamente a senha de um banco já inicializado. Mudanças de porta precisam ser refletidas em DATABASE_URL.

Não acrescentar remoção de volumes a scripts de reset; as proteções de ambiente/destino dos comandos de banco continuam válidas. Testes de integração ainda precisam de banco separado com marcador test, nunca do banco de desenvolvimento com usuários criados pelo navegador. S3 e Dockerização das aplicações ficam fora desta entrega.

Validação: `docker compose config --quiet` passou com interpolação das variáveis; arquivos de segredos permanecem ignorados. O container não foi iniciado nem migrations aplicadas nesta sessão, por falta de acesso ao socket do engine. Após iniciar pelo terminal do usuário, validar readiness e cadastro/login com banco antes de declarar autenticação funcional.

Referências: [imagem oficial PostgreSQL](https://hub.docker.com/_/postgres), [Docker Desktop para Mac](https://docs.docker.com/desktop/setup/install/mac-install/).

## Conferência após configuração do Docker — 18/11/2026

Validação repetida a partir do código atual: lint e TypeScript de web/API/shared aprovados; build de shared e API aprovado; build de produção do frontend aprovado com Node 22.22.0; 118 testes unitários do frontend, quatro da API e dois de contratos aprovados. `drizzle-kit check` aprovou os metadados das migrations; isso não comprova sua aplicação no PostgreSQL. `docker compose config --quiet` passou e os arquivos de segredos continuam ignorados pelo Git. Como o wrapper pnpm desta sessão não consegue escrever no cache Corepack, as verificações foram executadas pelos binários locais instalados, sem alterar a versão de pnpm do projeto.

Ainda bloqueado nesta sessão: `docker compose ps` recebe permissão negada no socket; a conexão PostgreSQL recebe EPERM; a tentativa de `db:migrate` foi recusada/indisponível. Não foi possível confirmar banco iniciado, migrations aplicadas ou cadastro/login reais. Os dois testes de integração foram tentados e falharam na verificação de pré-requisito porque `TEST_DATABASE_URL` não está definido; não executaram o fluxo com banco. Playwright foi tentado com o teste de visibilidade de senha, mas o servidor não iniciou por EPERM no cache Corepack. Não declarar a etapa 3 concluída com base apenas nas verificações unitárias.

Próxima verificação no terminal do usuário, na raiz: executar `pnpm db:up`, `pnpm db:migrate`, `pnpm db:seed` e `pnpm dev`. Em outro terminal, consultar `curl --fail http://localhost:3000/api/v1/health/ready`; deve retornar `{"status":"ready"}` pelo proxy do Next.js. Depois, em `http://localhost:3000`, criar uma conta, sair, confirmar rejeição da senha incorreta, entrar com a senha correta e recarregar a página para conferir a sessão. Para integração automatizada, provisionar um banco separado, aplicar migrations e seed com `APP_ENV=test` nesse destino e configurar `TEST_DATABASE_URL` na API antes de executar `pnpm test:integration`; nunca apontar essa variável para o banco de desenvolvimento ou produção.


## Alteração de usuário — 18/11/2026

`PATCH /api/v1/me/username` recebe `{ username }` com sessão e CSRF válidos. A primeira alteração é livre; cada troca efetiva, inclusive de caixa, grava `users.username_changed_at` e bloqueia a seguinte por 720 horas. Enviar o valor atual é uma operação sem efeito, sem renovar o prazo. Nomes inválidos/ocupados não consomem a troca. Sessão e usuário são bloqueados e revalidados na transação; o índice único sem distinção de caixa garante disponibilidade sob concorrência. IDs, nome público e sessões existentes permanecem vinculados à conta. O usuário anterior deixa de servir para login e fica disponível para cadastro por outra conta; não há reserva de aliases antigos.

A resposta de sessão inclui `usernameChangeAvailableAt` (UTC, null antes da primeira troca). Configurações → Conta oferece formulário próprio e mostra data/hora da próxima troca no horário de São Paulo. O relógio do navegador controla somente a apresentação; a decisão é sempre do PostgreSQL. Aplicar `pnpm db:migrate` para adicionar a coluna pela migration `0003_username_change_cooldown`. Testes de integração cobrem colisão sem consumo de prazo, alterações concorrentes, troca de caixa, envio sem alteração e liberação após 720 horas; precisam de banco isolado via `TEST_DATABASE_URL`.

Validação desta entrega: lint, TypeScript, builds e 125 testes unitários aprovados; metadados Drizzle conferidos. A tentativa de aplicar a migration foi recusada/indisponível nesta sessão. Integração não executou o fluxo por ausência de `TEST_DATABASE_URL`; o E2E específico de edição/bloqueio em configurações foi escrito com respostas HTTP controladas, mas sua execução foi bloqueada antes de iniciar o navegador por EPERM no cache Corepack. Essas verificações não comprovam a operação da nova rota no PostgreSQL.


## Configurações de conta — 18/11/2026

A aba Conta apresenta nome e usuário em linhas, com edição em modais separados. A regra de 30 dias e sua data de liberação continuam no modal de usuário. Sair permanece no menu da conta; configurações oferece exclusão com confirmação da senha atual.

`DELETE /api/v1/me` recebe `{ password }`, exige sessão, Origin e CSRF válidos e limita tentativas por conta. Verifica Argon2 e revalida sessão/conta sob bloqueio transacional; remove todas as sessões e a conta, limpa cookies e retorna 204. No estágio atual apenas usuários e sessões estão persistidos; futuras integrações de carteira/históricos precisam revisar essa operação antes de adicionar vínculos com a conta.

Validação: lint web/API/shared, TypeScript e builds aprovados pelos executáveis locais; 125 testes unitários aprovados. E2E atualizado para modais, bloqueio do usuário, cancelamento e confirmação da exclusão, mas não executou: Corepack recebeu EPERM no cache e a tentativa direta de iniciar Next recebeu EPERM na porta 3100. Integração ampliada para senha incorreta, CSRF, remoção da conta e invalidação de sessão; execução depende de `TEST_DATABASE_URL`, ausente nesta sessão. A exclusão no PostgreSQL ainda não foi validada em execução.

## Perfil público — 18/11/2026

`GET /api/v1/profiles/:username` consulta contas ativas sem exigir sessão, com busca sem distinção de caixa. A projeção pública contém somente `username` e `displayName`; não reutiliza a resposta de sessão nem expõe papel, prazos de alteração, IDs ou credenciais. Usuários inexistentes, suspensos e parâmetros inválidos recebem 404. Respostas usam `no-store` para refletir alterações e exclusões.

O frontend oferece `/perfil/[username]` com avatar (fallback pela inicial), nome e @usuário. O avatar agora é enviado e processado na API, com armazenamento local no desenvolvimento ou S3 em produção. No próprio perfil, um botão sobre o avatar abre diretamente a seleção de arquivo; aparece no hover ou foco e fica visível em dispositivos sem hover. `/perfil` encaminha a conta autenticada para seu endereço com a grafia salva; URLs com caixa diferente são corrigidas após a consulta pública usando replace, preservando a unicidade sem distinção de caixa; o dropdown oferece “Perfil”. Estatísticas ficam para a integração dos respectivos domínios, sem valores inventados no perfil.

Validação do perfil: lint, TypeScript e builds de shared/API/web aprovados pelos binários locais; 126 testes unitários aprovados, incluindo consulta pública HTTP, preservação da caixa, projeção de campos e respostas 404. E2E desktop/mobile escrito para navegação, redirecionamento, acesso sem login e falha/retry; execução bloqueada pelo cache do Corepack e pela recusa de bind em `127.0.0.1:3100` (EPERM). Consulta real ao PostgreSQL não validada nesta rodada.


## Avatares persistidos — 18/11/2026

Integração autorizada antes da carteira: perfil e avatar não dependem de saldo. `PUT /api/v1/me/avatar` recebe o arquivo binário com Content-Type image/jpeg, image/png ou image/webp; `DELETE /api/v1/me/avatar` remove a foto. Exigem sessão ativa e CSRF/Origin. Upload confere autorização antes de receber o corpo, limita a 20 tentativas por conta/hora e revalida sessão/conta na transação que altera a referência. Arquivos têm limite de 10 MiB e 25 megapixels, no máximo 10.000 pixels por lado, sem animação. Sharp valida o formato decodificado, aplica orientação, recorta ao centro e gera WebP 256 × 256 sem metadados. O navegador envia o arquivo original; validação no cliente é somente feedback antecipado.

Migration `0004_breezy_corsair` acrescenta `users.avatar_key` e a fila `avatar_cleanup`. O banco guarda somente uma chave aleatória, independente do username. Sessão e perfil público retornam `avatarUrl` ou null; nunca caminhos locais, credenciais ou data URLs. `GET /api/v1/avatars/:key` lê o arquivo pelo adaptador após conferir se a chave ainda pertence a uma conta ativa. Bucket privado, servido pela API através do proxy existente, sem exigir CORS público ou ACL de leitura no bucket. A rota usa `private, no-cache`, ETag e nosniff para imagens válidas; revalida o vínculo com uma conta ativa antes de responder 304. Erros permanecem `no-store`. Fotos substituídas, removidas ou de contas excluídas deixam de ser servidas na próxima revalidação.

`AVATAR_STORAGE=local` é o padrão de development/test; arquivos ficam em `AVATAR_LOCAL_DIR` (padrão `.data/avatars` relativo ao processo da API, ignorado pelo Git). Produção recusa o adaptador local e exige `AVATAR_STORAGE=s3`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` e `S3_SECRET_ACCESS_KEY`; configurar `S3_REGION` e, para provedores compatíveis, `S3_ENDPOINT`/`S3_FORCE_PATH_STYLE`. Endpoint explícito em produção exige HTTPS. Credenciais ficam apenas na API e devem permitir GetObject, PutObject e DeleteObject no prefixo avatars/ do bucket destinado ao ambiente. Nenhum serviço Docker extra é necessário para testar localmente.

Antes de escrever um arquivo novo, a API registra limpeza futura em uma hora. Na mesma transação que publica a referência, cancela essa limpeza e agenda a chave anterior. Remoção e exclusão de conta também agendam a chave antiga. A API limpa até 20 itens a cada minuto e ao iniciar, usando bloqueios SKIP LOCKED e rechecagem de referências; falhas preservam a fila para retry. Isso cobre arquivos substituídos e uploads interrompidos sem worker externo. Um erro de salvamento mantém o avatar anterior e não confirma sucesso ao frontend.

Preparação local: instalar dependências, executar `pnpm db:migrate` e reiniciar `pnpm dev`. Para produção ainda é necessário provisionar/configurar o bucket privado; a implementação do adaptador não comprova uma operação no provedor real. O fluxo mantém seleção direta sobre a foto e permite remoção em Configurações → Conta. Não importa avatares do protótipo/localStorage.

Validação da integração de avatares: lint e TypeScript de todo o workspace aprovados; builds de shared/API e frontend (Webpack) aprovados. Os testes Node totalizam 135 aprovações (118 frontend, 14 API e 3 contratos), incluindo reprocessamento/remoção de metadados, dimensões, animação, limite de upload, sessão/CSRF, troca/remoção, preservação da foto anterior em falhas, fila de limpeza e comandos do adaptador S3. Metadados de migrations aprovados pelo Drizzle Kit. A migration foi gerada, mas sua execução foi recusada/indisponível nesta sessão; é necessário aplicar `pnpm db:migrate` antes de usar as novas rotas. A integração PostgreSQL foi ampliada para uploads concorrentes, persistência e limpeza na exclusão, porém não executou o fluxo por ausência de `TEST_DATABASE_URL`. O E2E cobre seleção direta, envio binário, reload e foto pública, mas o servidor de teste não iniciou por EPERM na porta 3100. Nenhum upload contra bucket real foi validado nesta sessão.

## Sessão na primeira renderização — 18/11/2026

O layout raiz do Next.js consulta `GET /api/v1/me` no Fastify antes de renderizar a interface quando recebe um cookie de sessão. Encaminha somente o cookie `__Host-croebet-session` ou `croebet-session` para `API_INTERNAL_URL`, com `no-store`, sem seguir redirects e com limite de três segundos. Apenas a projeção validada pelo contrato de sessão é passada ao provider cliente; tokens e cookies não entram nas props. Sem cookie, a sessão inicial é de visitante e dispensa consulta no servidor. Autenticação, autorização e banco continuam exclusivamente no Fastify.

O provider começa com essa sessão confirmada, eliminando a renderização inicial dos controles de visitante para contas autenticadas. A leitura de cookies no layout torna as páginas dependentes da requisição; o HTML personalizado não deve receber cache compartilhado no proxy/CDN. Permanece a revalidação no navegador ao montar e ao recuperar foco, preservando a identidade confirmada enquanto consulta e sincronizando expiração e mudanças entre abas.

Falhas de rede, timeout, respostas inválidas e erros HTTP deixam a sessão inicial pendente, em vez de confirmar logout. Navbar e sidebar mostram skeletons sem animação quando `prefers-reduced-motion` está ativo. A consulta cliente tenta novamente após 15 segundos em caso de falha e também ao recuperar foco; somente uma resposta de sessão válida confirma visitante ou conta. Respostas anteriores a uma mutação de conta não podem sobrescrever o estado mais recente. Cookies expirados continuam sendo limpos pela resposta da API ao navegador, pois Server Components não alteram cookies.

Testes unitários cobrem ausência de cookie, projeção validada, ausência de cache, sessão expirada e indisponibilidade. A suíte específica `pnpm --filter @croebet/web test:e2e --config playwright.session.config.ts` usa uma API HTTP isolada na porta 3201 e Next na 3100; verifica HTML sem JavaScript, reload, visitantes, expiração e recuperação do skeleton no navegador. A suíte comum não inclui esses testes porque utiliza outro destino de API.

Validação desta alteração: lint e TypeScript aprovados em web/API/shared; builds de shared e API aprovados e frontend aprovado com Node 22.22.0 e Webpack. Os 139 testes unitários passaram (122 web, 14 API, três contratos). Os comandos pnpm foram tentados, mas o Corepack não pôde escrever no cache; as verificações aprovadas usaram os executáveis locais. O build padrão Turbopack não concluiu nesta sessão e foi interrompido antes da execução com Webpack. A suíte E2E específica foi tentada também pelo executável local do Playwright, porém Next não pôde abrir `127.0.0.1:3100` (EPERM); os fluxos no navegador ainda não foram validados nesta sessão.

## Padrão de carregamento inicial de páginas — 18/11/2026

Decisão aprovada: páginas integradas à API carregam no servidor os dados necessários para sua primeira exibição, consultando endpoints HTTP públicos do Fastify e validando seus contratos. Passam apenas os dados de apresentação para as fronteiras cliente responsáveis pelas interações. Não começar com dados vazios, controles de visitante ou texto “Carregando…” para depois buscar o conteúdo inicial em `useEffect`. O Next continua sem acesso ao banco ou a módulos internos do backend. Chamadas usam `API_INTERNAL_URL` exclusivamente no servidor; cookies só são encaminhados quando o endpoint exige sessão. Dados pessoais não recebem cache compartilhado, e dados mutáveis devem definir explicitamente a política de atualização.

Revalidação em segundo plano, interações, recursos exclusivos do navegador e cenas 3D continuam no cliente quando necessário. Revalidação preserva dados confirmados durante a espera; falhas não devem simular ausência de conta ou de conteúdo. Skeletons ficam reservados a esperas efetivas. Os domínios ainda baseados em localStorage permanecem como protótipos: sua integração futura deve seguir esse padrão, sem inventar migrações ou novos endpoints somente para antecipá-la.

Aplicação ao perfil: `/perfil/[username]` consulta `GET /api/v1/profiles/:username` sem cookies, com `no-store`, contrato público, redirects de transporte desabilitados e timeout de três segundos. A página já entrega nome, @usuário e referência do avatar, mantendo edição da foto no cliente. Grafia diferente redireciona no servidor ao username salvo. Resposta 404 chama `notFound()` com apresentação própria; erros do serviço exibem feedback distinto com tentativa novamente via `router.refresh()`. O avatar ainda aguarda o carregamento normal da imagem no navegador; isso não bloqueia o conteúdo do perfil.

`/perfil` consulta a sessão e redireciona no servidor para a conta autenticada. Visitantes recebem a opção de entrar; após login nessa tela, a interação cliente pode encaminhar ao perfil. Sessão indisponível apresenta erro e tentativa novamente. `getInitialSession` usa `React.cache` para compartilhar a mesma consulta entre layout e página dentro da requisição, sem cache de identidade entre requisições/usuários.

A suíte `playwright.session.config.ts` agora inclui os perfis, com fixture HTTP acessível pelo Next, além dos testes de sessão. Os mocks de rede do navegador não substituem consultas de Server Components. A cobertura inclui HTML sem JavaScript, reload, redirecionamento do próprio perfil, correção de caixa, 404, falha/retry e edição/persistência do avatar.


## Cache e antecipação de avatares — 18/11/2026

Imagens válidas usam `Cache-Control: private, no-cache` e ETag derivado da chave UUID imutável do upload. O navegador pode guardar os bytes, mas precisa revalidar antes de reutilizá-los; não há cache compartilhado em CDN. A API confere o vínculo atual com uma conta ativa antes de comparar `If-None-Match` (incluindo listas, validadores fracos e `*`). Em caso de correspondência retorna 304 sem ler o arquivo local/S3 nem transferir os bytes outra vez. Uma troca gera URL/ETag novos; remoção, substituição ou suspensão passam a responder 404, inclusive com validadores antigos. Falhas de armazenamento e demais erros continuam `no-store`; respostas de sessão e perfil também permanecem sem cache.

`AccountAvatarImage` chama `react-dom/preload` durante a renderização, inclusive no servidor, com a URL confirmada da imagem. React emite a indicação de preload no HTML e deduplica URLs repetidas entre navbar, sidebar e perfil. O navegador pode começar a buscar o avatar antes da hidratação. O primitive de imagem usa `next/image` com `unoptimized`, dimensões explícitas e carregamento eager: emite o `img` já no HTML, preservando a URL e o cache da API. O fallback Radix fica oculto por CSS quando existe foto e aparece se a imagem falhar; trocar a URL reinicializa o estado de erro. Isso evita a troca inicial de letra por foto causada pelo carregador cliente do Radix. O cache evita retransmitir a imagem, mas a revalidação ainda exige uma consulta HTTP para preservar remoção e suspensão imediatas na próxima requisição.

Validação do cache de avatares: lint e TypeScript aprovados em web/API/shared, builds de shared/API e frontend com Webpack aprovados; 143 testes unitários passaram (124 web, 16 API, três contratos). Os novos testes HTTP verificam 200/304, ausência de retransmissão/leitura do armazenamento em cache hits, validadores, URL/ETag novos e rejeição de fotos substituídas/removidas/suspensas, além de erros sem cache. O E2E de perfil foi ampliado para verificar preload no HTML sem JavaScript; sua execução foi tentada, mas o servidor de teste recebeu EPERM ao abrir `127.0.0.1:3100`. Scripts pnpm foram tentados e bloqueados pelo cache do Corepack; verificações aprovadas executaram os binários locais instalados.

Correção complementar do flash do avatar: preload sozinho não fazia o `AvatarPrimitive.Image` emitir a foto no HTML. `AvatarImage` agora emite a imagem com Next Image sem otimização adicional, antes da hidratação, e usa fallback por erro. O E2E foi ampliado para conferir a imagem e o fallback sem JavaScript, além de falha e recuperação. Lint, TypeScript e 124 testes frontend aprovados; build Webpack aprovado. Execução E2E novamente bloqueada pela abertura de `127.0.0.1:3100` (EPERM). Nenhuma migration ou dependência nova necessária; reiniciar os processos de desenvolvimento garante que a API carregou a política de cache atualizada.

## Validação de contas e início da carteira — 18/11/2026

Revisados os fluxos atuais de cadastro, login sem distinção de caixa, sessão, CSRF, alteração de nome/usuário, exclusão com senha e avatar. A validação com PostgreSQL continua pendente: não há `TEST_DATABASE_URL` configurada, Docker recebeu recusa de acesso ao socket e o comando de migration não conseguiu operar o banco. A readiness pelo localhost também não estava acessível ao executor. Isso não comprova falha nas contas do usuário nem permite afirmar que todas as migrations estejam aplicadas.

A primeira base da carteira foi autorizada nesta rodada. Migration `0005_cheerful_arclight` adiciona `wallet_accounts`, `wallet_operations` e `wallet_entries`. Cada cadastro cria sua carteira na mesma transação da conta/sessão. Usuários de desenvolvimento já existentes recebem contas vazias pela migration, sem importar saldos locais. Saldo inicial zero é apenas o estado técnico sem concessões; não define o valor de boas-vindas. Concessão inicial e bônus continuam pendentes de aprovação de valores.

`GET /api/v1/me/wallet` retorna `{ balance }`; `GET /api/v1/me/transactions?limit=20&offset=0` retorna `{ items, hasMore }`, com limite de 1–100 itens e offset máximo de 1.000.000. Ambos exigem sessão ativa, validam ambiente e usam `no-store`. O extrato contém somente lançamentos da própria carteira e ordena por sequência de lançamento, sem depender da ordem de início das transações. A UI e o provider ainda usam o estado provisório anterior: esta entrega é exclusivamente a fundação no Fastify. A integração visual deverá carregar os dados iniciais no servidor conforme a convenção do projeto, distinguindo falha de saldo zero.

`transferCroins` é um serviço interno, sem endpoint público de transferência, crédito ou edição de saldo. Operações informam escopo, chave idempotente, autor por conta interna, motivo e referência. A mesma chave/conteúdo retorna o recibo original; conteúdo divergente é conflito. Locks de idempotência e contas em ordem estável serializam retries/gastos concorrentes. BIGINT e BigInt preservam inteiros, limitados à faixa segura do JavaScript. A conta de emissão pode ser negativa, com contrapartida explícita; contas de usuário/casa/pote não podem. Os futuros serviços de domínio devem autorizar sujeito/ação e revalidar sessão, suspensão e recurso dentro da transação de negócio antes de usar os lançamentos; o serviço interno não é uma autorização para transferências entre usuários.

Triggers aplicam o saldo junto com cada lançamento, recusam gravação direta de saldo, alteração/exclusão de lançamentos e operações, e lançamentos adicionais em operações já confirmadas. Constraint trigger diferida exige ao menos duas contrapartidas e soma zero ao confirmar cada operação. A conta só nasce com zero. Operações rejeitadas revertem recibo, lançamentos e saldo. Não há seeds de emissão ou concessões automáticas nesta entrega.

A exclusão com senha continua removendo conta de login e sessões. O vínculo `wallet_accounts.user_id` fica nulo por FK, preservando saldo e livro imutável sem username/nome/senha nas tabelas econômicas. A carteira desvinculada não pode ser movimentada pelo serviço. Uma nova conta com o mesmo username recebe outro ID e outra carteira; não herda histórico. O saldo residual permanece na carteira desvinculada; eventual política de recolhimento exige decisão própria, sem apagar ou reescrever lançamentos. Nenhum dado real de produção foi migrado.

Testes adicionais cobrem contratos numéricos, sessão obrigatória, paginação, ausência de gravação pública e, na integração PostgreSQL, créditos concorrentes idempotentes, conflito de conteúdo, gasto simultâneo, rollback, conservação, imutabilidade e exclusão. A integração continua exigindo banco separado identificado como test, nunca o banco de desenvolvimento usado no navegador. Os registros imutáveis dessa suíte permanecem apenas nesse banco isolado.

Validação desta rodada: 145 testes unitários aprovados (124 web, 18 API e três contratos), lint do workspace aprovado, TypeScript e builds de shared/API aprovados, TypeScript e build de produção do frontend aprovados com Webpack. Metadados Drizzle e `git diff --check` aprovados. Os comandos pnpm foram tentados, mas o Corepack recebeu EPERM no cache; as verificações aprovadas usaram os executáveis locais. Os três testes de integração falharam no pré-requisito `TEST_DATABASE_URL`, sem executar os fluxos de banco. Playwright não iniciou o servidor por EPERM no cache Corepack. A migration 0005 foi gerada e conferida estaticamente, mas não aplicada: executar `pnpm db:migrate` antes de reiniciar a API. Não declarar contas/carteira totalmente validadas nem operações econômicas prontas para produção até passar a suíte PostgreSQL.

## Conferência e composição transacional da carteira — 19/11/2026

Docker/Compose e pnpm 12.21.0 estão acessíveis. PostgreSQL 18 está saudável; a conexão pelas credenciais da API confirmou o marcador development. As seis migrations 0000–0005 já estavam aplicadas, com hashes correspondentes aos arquivos atuais. Nenhuma migration, seed ou reset foi executado nesta rodada. A consulta de readiness por injeção Fastify com verificação do banco real retornou ready; isso não equivale a um servidor HTTP em execução na porta 3001.

O serviço interno passa a oferecer `transferCroinsInTransaction(client, input)`. O domínio deve abrir a transação, autorizar e bloquear seus recursos, executar seus registros e lançamentos com o mesmo PoolClient e confirmar somente ao final. Qualquer erro exige rollback pelo chamador; o recibo retornado é provisório até o commit. A função não abre, confirma, reverte nem libera a conexão. `transferCroins(pool, input)` mantém a interface anterior e gerencia sua própria transação, delegando a mesma lógica. Nenhuma dessas funções constitui autorização de negócio ou endpoint público.

Essa composição é pré-requisito para cadastro com concessão, resgate com crédito e palpite com débito atômicos. Valores econômicos e implementação desses domínios continuam pendentes; a carteira ainda não está integrada à interface. Testes verificam ownership da transação e retry/conflito; a suíte PostgreSQL foi ampliada para conferir rollback conjunto de um registro de domínio, saldo e recibo, invisibilidade antes do commit e reutilização da chave após rollback.

Não há banco isolado de teste no container nem TEST_DATABASE_URL configurada. Não executar a suíte de integração contra development. Próximo passo de validação: preparar explicitamente esse destino e então executar `pnpm test:integration`; essa preparação continua fora desta rodada pela restrição a migrations. Depois, integrar saldo/extrato com carregamento inicial no servidor e definir os valores antes das concessões.

Validação desta rodada: `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` aprovados, com 146 testes (124 web, 19 API e três contratos). Build de produção do frontend aprovado com Turbopack. `git diff --check` aprovado. Integração PostgreSQL pendente pelo pré-requisito acima; não houve alteração interativa nem execução de E2E nesta entrega.


## Carteira simplificada e extrato integrado — 19/11/2026

A página `/historico` consulta saldo e primeiras 20 movimentações no servidor via HTTP autenticado, sem cache e sem acesso direto ao banco. Mostra um Card de saldo disponível com o ícone padrão da Croin e um extrato com título, data, ícone e valor. Não mostra totais acumulados, gráficos, status ou saldo por linha. O modal de cada lançamento contém valor, saldo resultante, data completa e referência da operação quando disponível. Datas usam America/Sao_Paulo; Hoje/Ontem são calculados a partir do mesmo instante enviado pelo servidor para evitar divergência de hidratação.

`GET /api/v1/me/transactions` aceita `direction=all|income|expense` (padrão all), aplicado no SQL antes da paginação, e retorna também `reference` quando disponível. A listagem mantém o botão Carregar mais em lotes de 20. Falhas não são tratadas como saldo zero ou extrato vazio; a primeira consulta oferece nova tentativa e falhas ao carregar mais preservam os itens confirmados. Mudanças de filtro usam navegação do App Router; login/logout/exclusão atualizam os Server Components. O acesso pelo painel de configurações leva à mesma página, evitando um segundo extrato com dados provisórios.

A carteira agrega entradas e saídas; desempenho e resultados de partidas pertencem ao histórico de apostas. As seis origens iniciais previstas são bônus de cadastro, resgate diário, cupom resgatado, aposta realizada, prêmio recebido e aposta devolvida. Esta entrega não habilita concessões, resgates ou partidas econômicas ainda não integrados. O ledger continua auditável e imutável; não se fabricam registros de demonstração. Os saldos no contexto global ainda são provisórios e sua integração permanece pendente.

Validação: lint, TypeScript e testes unitários aprovados. E2E do extrato cobre HTML inicial, detalhes, filtros, paginação e recuperação de falha, mas sua execução ficou bloqueada por EPERM ao abrir a porta 3100. A suíte PostgreSQL requer TEST_DATABASE_URL isolada, ausente nesta sessão. O build Turbopack também encontrou EPERM ao abrir uma porta durante o processamento CSS; o build de produção com Webpack foi aprovado, incluindo compilação, TypeScript e geração das páginas.


## Economia inicial e resgate móvel — 19/11/2026

Referência atual: `CROEBET.md`, seção 4.3. `apps/api/src/modules/economy/config.ts` concentra os valores. `GET /api/v1/economy` publica apenas a configuração de produto validada pelo contrato compartilhado; a conta interna de emissão não é publicada. O frontend carrega configuração e estado econômico no servidor junto à sessão. Navbar/sidebar deixam de exibir zero provisório: usam saldo confirmado ou “—” se o serviço não confirmou os dados. Após login/resgate, o estado confirmado atualiza o contexto; o extrato é revalidado pelo servidor.

Cadastro cria conta, carteira, sessão e operação “Bônus de cadastro” de +30 Croins na mesma transação. Não grava um saldo sem lançamento: uma conta técnica de emissão financia o crédito e o livro conserva o total. Falha em qualquer etapa desfaz todas as gravações. Não há backfill de bônus para usuários antigos nem importação de carteiras locais; contas novas recebem o valor aprovado. Dados descartáveis existentes podem ser recriados pelos comandos de reset protegidos, quando necessário.

`GET /api/v1/rewards/daily` autenticado retorna saldo, último resgate, próxima liberação, elegibilidade e instante do servidor. `POST /api/v1/rewards/daily/claim` recebe somente `{ requestId: UUID }`, exige sessão/Origin/CSRF, limita tentativas e revalida a sessão dentro da transação. Bloqueia usuário/sessão e contas em ordem determinística; confere o último resgate após obter os locks. Disponível sem resgate anterior; depois, a partir da meia-noite seguinte à data local do último crédito em America/Sao_Paulo, inclusive no instante exato. **Não há condição ou teto de saldo.** Cada sucesso adiciona 10 Croins e registra “Resgate diário”, saldo resultante e referência no livro imutável, junto a `daily_claims`. Retry com o mesmo requestId retorna estado confirmado sem novo crédito; dois requests distintos concorrentes no mesmo dia não concedem dois bônus. Falhas desfazem saldo, extrato e recibo juntos. O relógio do navegador só anima a contagem regressiva; o servidor decide a elegibilidade.

Alteração aprovada em 19/11/2026: o dia de resgate renova à meia-noite em America/Sao_Paulo. Quem resgata às 22h pode resgatar à 1h do dia seguinte. O PostgreSQL calcula a fronteira com `AT TIME ZONE`, sem depender do fuso do host ou do navegador. A configuração pública expõe `dailyResetTimeZone` em lugar de `dailyCooldownHours`; frontend/API devem ser atualizados juntos. Não há alteração de schema nem reescrita dos resgates anteriores.

Validação da liberação à meia-noite: lint, TypeScript, testes unitários e build aprovados. Cinco casos da consulta de produção foram aprovados no PostgreSQL em transação somente leitura (sem resgate, 22h, meia-noite, viradas de ano e mês). Suíte PostgreSQL completa continua pendente do banco de teste. E2E de economia inclui liberação do botão na virada; execução bloqueada porque outro Next dev já usa o mesmo projeto na porta 3000. O processo existente não foi interrompido; não houve reset ou migration.

Migration `0006_common_speedball` cria `daily_claims`, índices de consulta/unicidade e proteção contra edição/exclusão, além da conta interna de emissão. Aplicar `pnpm db:migrate` antes de executar a nova API. Não há valores econômicos duplicados na migration.

Sugestões e padrão de aposta são lidos da API no ticket e no Flip 7. Apostas continuam aceitando valores inteiros positivos quando o domínio for integrado; as sugestões não constituem limites. Como os motores econômicos locais não podem controlar a carteira persistente, início e retomada de Flip 7 com Croins permanecem bloqueados até a implementação do débito/prêmio autoritativos no backend. Partidas sem Croins continuam disponíveis.

Cupons não usam bônus diário nem valor de cadastro como padrão: o administrador informa o valor obrigatório por cupom, validado como inteiro positivo seguro. Exemplos fixos foram removidos do catálogo demo; o editor continua local e o resgate de cupons ainda depende de integração própria. Esta rodada não implementa o domínio completo de cupons.


Validação da economia: 153 testes unitários aprovados (125 web, 25 API, três contratos), lint e TypeScript aprovados; builds de shared/API e produção web com Webpack aprovados. A execução padrão de `pnpm build` com Turbopack encontrou EPERM ao abrir porta no processamento CSS. O E2E específico de economia foi preparado para HTML sem JavaScript, crédito do resgate, reload, contador e sugestões de aposta, mas não iniciou o servidor pela restrição da porta 3100. Os quatro testes PostgreSQL não executaram os fluxos por ausência de `TEST_DATABASE_URL`. Tentativa de aplicar `0006` com `pnpm db:migrate` falhou por conexão/permissões; Docker também recusou acesso ao socket. A migration permanece pendente de aplicação e a validação integrada não deve ser considerada concluída.


Compatibilidade do desenvolvimento Node — 19/11/2026: a API usa `--experimental-strip-types`; o TypeScript da API agora exige `erasableSyntaxOnly` para rejeitar sintaxes que necessitam transformação (como parameter properties). `RewardError` declara e atribui sua propriedade explicitamente. Um teste de regressão carrega o grafo das rotas diretamente dos arquivos `.ts` com o mesmo modo do Node, além dos testes sobre `dist`.


## Administração de usuários, cupons e ajustes — 19/11/2026

Migration `0007_lively_psynapse` cria `coupons`, `coupon_redemptions` e `admin_audit`. Não importa fixtures nem altera os saldos existentes. Aplicar `pnpm db:migrate` e reiniciar a API antes de usar os novos fluxos. A listagem de usuários usa contas reais e carteira persistente; os cupons não têm catálogo de exemplo nem persistência local no fluxo integrado. Os dados iniciais dessas páginas são consultados pelo Next.js no servidor via HTTP autenticado, sem cache e sem acesso ao banco. Falhas de serviço oferecem nova tentativa e não são apresentadas como listagens vazias. Busca e filtros são aplicados na API antes da paginação (20 itens por página); movimentações, resgates e auditoria têm carregamento progressivo.

### Endpoints implementados

| Método e rota | Contrato/efeito |
| --- | --- |
| `GET /api/v1/admin/users?q=&status=all&offset=0&limit=20` | Contas reais com nome/usuário, papel, status, data de cadastro, avatar e saldo. |
| `GET /api/v1/admin/users/:id` | Dados da conta, primeiras movimentações e registros administrativos. |
| `GET /api/v1/admin/users/:id/transactions` | Paginação do livro da carteira alvo. |
| `PATCH /api/v1/admin/users/:id` | Papel/status, motivo obrigatório e estado anterior esperado; alterações obsoletas retornam conflito. |
| `POST /api/v1/admin/users/:id/adjustments` | `{ requestId, direction: add|remove, amount, reason }`; saldo, lançamentos e auditoria atômicos. |
| `GET /api/v1/admin/audit/:id` | Registros paginados por recurso alvo, incluindo autor, motivo e detalhes. |
| `GET /api/v1/admin/coupons?q=&status=Todos&offset=0&limit=20` | Cupons, status calculado no servidor, totais reais de resgates e distribuição. |
| `GET /api/v1/admin/coupons/:id` | Configuração, primeiros resgates e auditoria. |
| `GET /api/v1/admin/coupons/:id/redemptions?q=&offset=0&limit=20` | Resgates paginados e busca por usuário. |
| `POST /api/v1/admin/coupons` / `PATCH /api/v1/admin/coupons/:id` | Código, valor livre, limite global opcional, datas opcionais, pausa, versão e motivo obrigatório. |
| `POST /api/v1/coupons/redeem` | `{ code, requestId }`; crédito e recibo de uso único na mesma transação. |

### Permissões e auditoria

Todos os endpoints administrativos exigem sessão ativa e `role=admin` verificados no Fastify. Não autorizados recebem 404. Escritas exigem Origin/CSRF e limite de tentativas por conta. O backend revalida e bloqueia usuário/sessão dentro da transação; uma permissão vista na tela nunca autoriza a operação por si só. Não há campo público de cadastro que conceda admin. O primeiro admin continua sendo promovido por procedimento operacional controlado; os seguintes podem ser concedidos ou removidos em Admin → Usuários.

Alterações administrativas e exclusão de conta compartilham um advisory lock transacional de governança, obtido antes dos locks de usuários, sessões e contas. Linhas de usuários e contas são bloqueadas em ordem determinística. Mudanças de papel/status e exclusão não podem remover o último administrador ativo, inclusive sob concorrência. Suspensão revoga todas as sessões da conta; reativação exige novo login. Papéis são consultados no servidor em cada comando; admin rebaixado perde imediatamente a autorização para novas operações. A UI também atualiza a sessão após mudar permissões.

`admin_audit` é imutável e registra IDs de autor/alvo, ação, motivo, instante e detalhes de antes/depois ou recibo econômico. Esses IDs não possuem FKs de exclusão para usuários: apagar uma conta não apaga a auditoria. O nome atual do autor é obtido por join; conta removida aparece como tal. Nunca registrar senhas, cookies ou tokens. Registros de auditoria aparecem nos detalhes da conta/cupom e podem ser paginados.

### Cupons e carteira

Código é normalizado para maiúsculas e único. Valores são inteiros positivos seguros escolhidos por cupom, sem valor padrão. Datas vazias são NULL; o editor usa explicitamente Brasília (UTC−03), convertido para UTC, e a exibição usa America/Sao_Paulo. Início é inclusivo e término exclusivo; ausência de datas permite validade indefinida. Pausa, expiração, agendamento e esgotamento são estados do recurso, não de lançamentos financeiros concluídos.

Cada resgate bloqueia a sessão/usuário, o cupom e as contas do livro. Limites e validade são conferidos após obter os locks econômicos, usando o relógio do PostgreSQL. Unicidade de cupom/carteira e de carteira/requestId é imposta no banco. Duas pessoas não podem consumir a última vaga; duas abas da mesma pessoa não geram dois créditos. Retry com a mesma chave e código retorna estado confirmado sem pagar novamente; reaproveitar a chave para outro código é conflito. Resgate registra código e valor efetivamente concedidos, preservados mesmo se o cupom for editado depois. Editar configuração exige versão atual e não pode reduzir limite abaixo dos resgates já realizados. Os recibos de resgate são imutáveis.

Créditos de cupom e ajustes usam a conta técnica de emissão e o ledger existente; retiradas não podem tornar a carteira negativa, e overflow é recusado. Todos geram lançamentos com saldo resultante e referência. O motivo do ajuste aparece como referência no extrato e também na auditoria. Ajustes são idempotentes por administrador/requestId, com hash do conteúdo para recusar reutilização com outro alvo, valor, direção ou motivo. Auditoria e lançamento confirmam juntos; falha em um desfaz todos. O contexto de saldo e as páginas de histórico são atualizados após confirmação, sem gravação econômica no localStorage.

Validação desta rodada: 163 testes unitários aprovados (35 API, 125 web, três contratos), lint e TypeScript aprovados; builds shared/API e produção web com Webpack aprovados. O build padrão Turbopack foi tentado e encontrou EPERM no processamento CSS ao abrir uma porta. A suíte E2E específica de gestão foi preparada para HTML inicial, permissões, ajustes, criação/resgate de cupom e recuperação de indisponibilidade, mas o servidor não iniciou por EPERM na porta 3100. A nova suíte PostgreSQL cobre corrida pelo último resgate, uso único, edição concorrente, imutabilidade, rollback após crédito, suspensão e duas demissões simultâneas de admin; sua execução ficou bloqueada pela ausência de TEST_DATABASE_URL. Docker recusou acesso ao socket nesta sessão. Não considerar a validação integrada concluída antes de executar essas suítes em banco de teste isolado e navegador.

Os antigos E2E de usuários/cupons baseados em contas e cupons do localStorage foram substituídos pelos cenários HTTP de `management.spec.ts` (busca/filtros, acesso negado, pausa, criação, resgate, ajustes e permissões). A tentativa de aplicar a migration desta rodada também foi recusada pela conexão/permissões da sessão; `0007` continua pendente no banco local até executar `pnpm db:migrate` no terminal autorizado.
