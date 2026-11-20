# Backend e ambiente de desenvolvimento

## Estado atual

Inspeção do código em 19/11/2026. Implementado não significa validado nesta rodada; comandos e limitações de testes estão em [Validação](#validação).

| Domínio | Implementação atual |
| --- | --- |
| Conta | Cadastro/login/logout, sessões PostgreSQL, nome, troca de username, exclusão com senha, perfil público e avatar |
| Economia | Carteira/extrato, bônus de cadastro, resgate diário, cupons e ajustes administrativos transacionais |
| Administração | Visão geral, usuários/permissões/suspensão, cupons, páginas, menus, catálogo de jogos e catálogo de apostas via API |
| Jogos | Seed com Flip 7 ativo e sem capa; motor e partidas livres na API/PostgreSQL, com lobbies públicos editáveis pelo host, sincronização Socket.IO e bots assumindo vagas após abandono/expulsão |
| Apostas | Apenas catálogo administrativo persistido; sem palpites, apuração ou pagamentos no backend; acesso público desabilitado |
| Rankings e conquistas | Fora da primeira versão; menus com “Em breve” e rotas redirecionadas ao início |

## Arquitetura

- `apps/web`: Next.js App Router, React e interface; consulta Fastify por HTTP no carregamento inicial e usa Socket.IO nas interações multiplayer. [Frontend](frontend-architecture.md).
- `apps/api`: monólito modular Fastify/Node/TypeScript; PostgreSQL com Drizzle + `pg`. Rotas em `src/modules/auth/routes.ts` e `src/modules/admin/routes.ts`; serviços junto ao domínio.
- `packages/shared/src`: schemas Zod de entrada/saída e tipos públicos; validar em runtime, não apenas por tipos TypeScript. Contratos exatos ficam no código.
- `apps/api/src/db/schema.ts` e `apps/api/drizzle`: estrutura e migrations; `src/db/cli.ts`: migrate, seed e reset.
- HTTP em `/api/v1`; Next encaminha esse prefixo para `API_INTERNAL_URL` (padrão `http://127.0.0.1:3001`). É proxy de transporte, sem backend de domínio no Next.
- Docker inicialmente só para PostgreSQL 18. Web e API rodam como processos Node no host. Não adicionar microsserviços, Redis, filas externas ou workers separados sem necessidade concreta.
- Multiplayer usa Socket.IO em `/api/v1/realtime`, com transporte WebSocket, sem barra final e pelo mesmo proxy. O cliente compartilha a conexão entre mesa/lobby e convites. O cliente busca CSRF antes de abrir o WebSocket, inclusive nas reconexões, para que o cookie do upgrade corresponda ao token. O handshake exige Origin, sessão e CSRF; o transporte delega comandos ao mesmo serviço transacional das rotas HTTP, sem executar regras.

## Ambiente local

Use Node compatível com `engines` e o pnpm fixado em `packageManager` na raiz; Docker Desktop iniciado. API em desenvolvimento executa TypeScript com `--experimental-strip-types`: mantenha sintaxe compatível com `erasableSyntaxOnly`.

1. Copie `.env.example` → `.env`, `apps/api/.env.example` → `apps/api/.env` e `apps/web/.env.example` → `apps/web/.env.local`.
2. Defina `POSTGRES_PASSWORD` na raiz e monte `DATABASE_URL` da API com os mesmos usuário, senha, banco e porta. Defina `APP_ENV=development`, `WEB_ORIGIN=http://localhost:3000` e `CSRF_SECRET` aleatório de pelo menos 32 caracteres. Exemplos de variáveis ficam nos `.env.example`; não versione segredos.
3. Instale e prepare a base:

```sh
pnpm install --frozen-lockfile
pnpm db:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Acesse `http://localhost:3000`; API em `127.0.0.1:3001`. `GET /api/v1/health` verifica o processo; `/api/v1/health/ready` verifica conexão e marcador do ambiente, não substitui a aplicação das migrations.

| Comando na raiz | Uso |
| --- | --- |
| `pnpm dev:web` / `pnpm dev:api` | Iniciar aplicações separadamente |
| `pnpm db:up` / `pnpm db:stop` / `pnpm db:logs` | Iniciar, parar ou acompanhar PostgreSQL |
| `pnpm db:generate` / `pnpm db:migrate` | Gerar/aplicar alterações de schema |
| `pnpm db:seed` | Identificar ambiente e cadastrar Flip 7 sem sobrescrever edições |
| `pnpm db:reset` | Recriar schema e executar migrations/seed no destino autorizado |

Compose publica PostgreSQL somente em `127.0.0.1`, com volume persistente. Alterar `POSTGRES_*` não reconfigura um volume já inicializado. Páginas, cupons, usuários e apostas não recebem dados de exemplo pelo seed; a navegação inicial é criada pela migration de menus.

### Dados descartáveis e reset

Não há dados reais a migrar ou preservar. Recriar o banco e consolidar migrations de desenvolvimento é permitido; mantenha criação limpa reproduzível e seeds idempotentes. Não importe localStorage nem mantenha uma economia demo paralela para proteger dados antigos.

`db:reset` exige `APP_ENV=development|test`, `NODE_ENV` diferente de `production`, marcador `application_environment` compatível, `DB_RESET_ALLOWED_URL` igual à URL exata de conexão e `DB_RESET_CONFIRM` igual ao nome real do banco. Configure esses campos em `apps/api/.env` para o destino desejado. Uma base nova precisa primeiro de migrate/seed para receber o marcador. Essas proteções já existem e continuam válidas; não exigem preservar o conteúdo do banco.

O comando recusa produção. Não há operação de produção a planejar nesta etapa; credenciais separadas de migration e S3 obrigatório nesse ambiente são restrições já presentes no código.

## Conta e autorização

- Username preservado, unicidade/login sem distinguir caixa; nome de exibição independente. Regras de produto em [CROEBET.md, seção 3](../CROEBET.md#3-público-e-acesso); limites exatos nos schemas compartilhados. Senha com Argon2id; sem e-mail, recuperação ou troca de senha implementados.
- Sessão opaca aleatória em cookie HttpOnly, host-only, SameSite=Lax; apenas hash no banco. Expiração absoluta de 30 dias e inatividade de 7 dias. Em `APP_ENV=production`, usa Secure e prefixo `__Host-`.
- Toda mutação exige Origin exata e token CSRF ligado à sessão/nonce, inclusive pré-login. Limites de tentativas são persistidos. Não registrar senhas, cookies ou tokens.
- Papéis `user` e `admin`, conferidos pela API. Sem acesso administrativo: 404. A renderização do Next não substitui autorização no serviço; revalide sessão/conta dentro da transação de escrita.
- Nenhum cadastro, nome ou variável pública concede admin. A primeira promoção é operacional no banco de desenvolvimento; depois, Admin → Usuários gerencia papéis. Não há conta/senha administrativa no seed.
- Alterar papel/status ou excluir conta usa lock de governança antes dos locks de usuário/sessão/carteira; não pode remover o último admin ativo. Suspender revoga sessões; reativação exige login.
- Exclusão exige senha e remove identidade/sessões; carteira fica desvinculada e auditoria permanece, conforme as FKs e invariantes atuais. Isso não impede reset completo da base descartável.

### Avatares

API recebe JPG/PNG/WebP, valida e reprocessa com Sharp para WebP 256 × 256 sem metadados (limites em `modules/avatars/image.ts`). Banco guarda chave aleatória; perfil/sessão retornam apenas URL pública. Desenvolvimento usa arquivos locais; adaptador S3 privado já existe, configurado pelos `.env.example`.

Leitura pela API revalida o vínculo com conta ativa antes de servir ou responder 304; usa ETag e `private, no-cache`. Substituição/remoção agenda limpeza persistida; o próprio processo retenta a fila ao iniciar e a cada minuto. Credenciais e caminhos de armazenamento ficam exclusivamente na API.

## Carteira e recompensas

Regras e valores aprovados estão em [CROEBET.md, seção 4.3](../CROEBET.md#43-croins-economia-fictícia); a configuração executável fica em `modules/economy/config.ts` e é publicada por `/api/v1/economy`. Frontend não mantém valores econômicos alternativos.

- `wallet_accounts`, `wallet_operations`, `wallet_entries`: livro imutável com lançamentos de soma zero, contas de emissão/casa/pote/usuário e saldo aplicado por triggers. Correções de domínio geram contrapartidas; não editam lançamentos. Reset completo de desenvolvimento continua permitido.
- Croins inteiros: PostgreSQL BIGINT/BigInt nos cálculos; contratos públicos limitados à faixa inteira segura de JavaScript. Contas de usuário/pote/casa não ficam negativas; emissão financia concessões explicitamente.
- `transferCroinsInTransaction(client, input)` participa da transação do domínio: chamador autoriza, bloqueia recursos e controla begin/commit/rollback. Recibo só é definitivo após commit. `transferCroins(pool, input)` gerencia uma transação própria; nenhum dos dois é endpoint público de transferência.
- Locks em ordem consistente; chave idempotente por escopo vinculada ao conteúdo. Retry retorna recibo original; mesma chave com conteúdo diferente é conflito. Saldo, recibo, registro de domínio e auditoria confirmam juntos.
- Cadastro concede bônus junto à criação da conta/carteira/sessão. Resgate diário usa o relógio do PostgreSQL e a meia-noite de `America/Sao_Paulo`, sem limite de saldo; unicidade e `requestId` impedem duplicação. Não há backfill para contas antigas.
- Cupons: código normalizado em maiúsculas, valor positivo obrigatório, limite global e datas opcionais, pausa e um uso por conta. Início inclusivo/término exclusivo. Limites, validade, recibo e crédito são conferidos na mesma transação; histórico guarda código/valor efetivamente concedidos.
- Motivo é opcional nas ações administrativas. Ausência de motivo no ajuste usa a descrição padrão; a exigência interna de descrição do livro não cria campo obrigatório na interface.
- `/me/wallet` e `/me/transactions` são autenticados; extrato paginado e filtrado na API, sem carteira local alternativa.

## Conteúdo e administração

- Escritas administrativas usam sessão/papel, CSRF, limites, transação e auditoria atômica. Recursos editáveis têm versão esperada ou estado anterior esperado; conflito não sobrescreve outra edição.
- Internas e endpoints administrativos identificam entidades existentes por UUID (`/admin/paginas/[id]`, jogos, apostas, usuários e cupons). Slug fica nos endereços públicos; mudar slug não cria alias histórico. `nova`/`novo` são ações de criação, não IDs de entidades.
- Páginas: documento JSON validado em `shared`, sem HTML arbitrário; autoria, datas, versão, status editorial e lixeira. Agendamento vencido é resolvido nas consultas pelo relógio do banco, sem scheduler em memória. Restaurar lixo retorna a rascunho; exclusão definitiva é auditada.
- Menus `main` e `footer` independentes, planos e ordenados. Destinos: página fixa, UUID de página criada ou URL validada. Publicação não adiciona item ao menu; referências por UUID acompanham o slug. Destinos não públicos são omitidos. `showInMenu` ainda existe no contrato de páginas, mas não determina a navegação.
- Ícone de menu é opcional, validado pelo catálogo Lucide; sem escolha, sem ícone. API resolve apenas os vetores dos ícones escolhidos. Ao atualizar `lucide-react`, execute `node scripts/sync-lucide-icons.mjs`; não enviar vetores arbitrários na escrita.
- Jogos: painel edita nome, ativação e URL/caminho de capa dos jogos implementados; não cria motores por slug arbitrário. Público recebe somente ativos; pausados respondem 404. Sem capa cadastrada, placeholder.
- Apostas: catálogo começa vazio, com pergunta/critério/formato/opções/prazo/status. Regras puras de rateio permanecem como referência; não há persistência nem pagamento local de apostas.
- Visão geral: períodos 1/7/30 dias no fuso de São Paulo; conta só lançamentos do lado do usuário para não duplicar a emissão. Ativos = contas com movimentação; saldo/contas atuais independem do período. Não agrega partidas ou apostas locais.

- SEO: `/admin/seo` persiste padrões e ajustes de Home/Jogos; páginas e jogos têm campos opcionais próprios. Escrita com versão e auditoria. API pública desativa indexação fora de `APP_ENV=production`; sitemap inclui somente conteúdo público indexável.

## Base compartilhada dos jogos

A migração do Flip 7 deve estabelecer uma base pequena de partidas reutilizável pelos próximos jogos. Separar infraestrutura de execução e regras específicas; não construir um framework completo antes de existir um segundo uso real.

| Responsabilidade | Compartilhamento previsto |
| --- | --- |
| Sessão de conta | Reutilizar autenticação existente, suspensão e revogação. Sessão de login é distinta de partida/sala; reconectar não cria participação nem cobra entrada. |
| Partidas e participantes | Identidade da partida, jogo/modo/versão de regras, ciclo de vida, vagas vinculadas a contas, versão do estado e datas. Não exigir lobby, turnos ou múltiplos jogadores de todos os jogos. |
| Comandos | Envelope com partida, `commandId`, `expectedVersion` e ação validada pelo jogo; executor comum autoriza participação, bloqueia, deduplica e persiste. Comandos HTTP e Socket.IO chegam ao mesmo executor; eventos Socket.IO apresentam estados já confirmados. |
| Estado e recuperação | Snapshot privado validado pelo motor, eventos ordenados e projeção por destinatário. O motor define o que cada jogador/espectador pode ver; não enviar o estado inteiro ao cliente. |
| Resultados e histórico | Registro comum de conclusão/participantes, com resultado validado por jogo. Pontuação e estatísticas são específicas: não exigir pontos de roleta/caça-níqueis nem comparar pontos de jogos diferentes. Pontos, vitória e prêmio em Croins são conceitos separados. |
| Economia | Reutilizar o livro e seus recibos/transações; entrada, pote, devolução e prêmio vinculados à partida. Motor produz resultado, não altera saldo diretamente. Cada modalidade define financiamento e distribuição antes de habilitar Croins. |
| Automações | Executor persistente comum para trabalho vencido; motor define bots, compras obrigatórias e próxima decisão. Prazo, controle da decisão e política de desconexão dependem do jogo. |
| Aleatoriedade e cartas | Fonte aleatória segura/injetável reutilizável. Baralho, reposição, descarte, informação oculta e efeito de comprar pertencem ao jogo; extrair utilitários puros de cartas quando houver segundo uso concreto. |

No backend, separar o catálogo já existente em `modules/games` da execução compartilhada de partidas (módulo `matches`). Motores ficam separados por jogo, inicialmente Flip 7 dentro de `games/flip7`, sem dependência de transporte, banco ou React. A base chama operações de criação, aplicação de ação, projeção pública, resultado e automação do motor, com tipos próprios; implementar apenas as operações necessárias ao primeiro fluxo. Não criar uma classe-base com regras de turno/pontos/cartas do Flip 7.

“Pedir carta” é uma ação do jogo, transportada pelo envelope comum, não um endpoint genérico que permite retirar qualquer carta de qualquer baralho. No Flip 7 ela pode estourar, ativar proteção ou abrir escolha de alvo; no blackjack terá outras condições e efeitos. Estado privado e payload de ação mantêm schemas Zod específicos/discriminados por jogo, sem `any` ou JSON sem validação. Tipos atuais `Game`, `Card`, `Player` e a fórmula `score` do Flip 7 não são contratos universais.

Sessão e carteira já existem; não recriá-las por jogo. As rotas de partidas reutilizam a consulta de sessão de `modules/auth/routes.ts` e revalidam conta/sessão na transação. Socket.IO valida sessão/CSRF no handshake e revalida sessão/conta antes de comandos, atualizações e periodicamente, sem renovar o prazo ocioso pelo heartbeat. Contratos comuns publicados ficam em `shared`, estados privados e motores na API. No frontend, compartilhar transporte, sincronização e componentes visuais comprovadamente comuns; tabuleiro, animações, ações disponíveis e cálculo exibido continuam nas features dos jogos.

Primeiro validar a separação com Flip 7 e cenários de comando duplicado, versão obsoleta, ação de outro participante, estado privado e retomada. Quando o segundo jogo chegar, verificar se o executor o aceita sem ramificações de regras do Flip 7; só então extrair novos helpers realmente comuns. Não importar snapshots locais ou criar tabelas/módulos apenas para antecipar esse desenho.

## Partidas livres integradas

- `modules/matches` executa o ciclo compartilhado; `modules/games/flip7` contém motor, invariantes privadas e driver. `games/cards.ts` fornece embaralhamento puro com RNG injetável; o driver usa `crypto.randomInt`, e testes podem usar seeds determinísticas.
- Migrations de partidas criam salas, participantes vinculados a contas, comandos e eventos. A mudança para lobbies descarta somente partidas do protótipo em development/test. Criação usa `requestId` por criador; comandos usam `commandId` por conta/sala e `expectedVersion` nas decisões/início. Locks e recibos confirmam junto com o estado; host pode mudar sem perder a identidade do criador.
- `/api/v1/matches`: GET lista partidas em andamento controladas pela conta; POST cria lobby. GET `/lobbies` lista salas abertas e identifica separadamente o lobby atual da conta, mesmo fora do limite da listagem pública. GET `/:code` consulta lobby ou retoma mesa autorizada, inclusive finalizada. POST `/:code/join`, `/leave`, `/start`, `/update` controlam o lobby; `/commands` aplica decisão, `/abandon` transfere a vaga para bot e `/kick` permite expulsão pelo host no lobby ou jogo. Escritas usam sessão/Origin/CSRF. Uma conta ocupa no máximo um lobby aberto, como host ou participante; criar/entrar usa o lock da conta para impedir concorrência entre salas/abas. Permanece o limite de 30 partidas em andamento sob responsabilidade da conta.
- Capacidade é limite de 2–12 pessoas; iniciar requer host, versão atual e pelo menos duas contas ativas. O host pode alterar modalidade/Brutal/capacidade somente no lobby, sem reduzir o limite abaixo da ocupação. Configuração, expulsão, entrada/saída/início usam o mesmo lock da sala, recibos idempotentes e versões nas decisões do host. Ao sair, o host passa para o participante mais antigo ainda no controle; última saída fecha. Desconectar não retira vaga nem automatiza decisões: não há timeout. Exclusão de conta encerra suas salas/partidas para evitar vagas sem controlador.
- Cada decisão pertence à conta da vaga indicada pelo motor (`bonusChoice`, ação pendente ou turno). Host não controla os demais. Não há criação pública de convidados ou bots. Abandono/expulsão em jogo mantém identidade, cartas e pontos, remove o controlador da vaga no banco e a entrega a um bot normal; escolhas pendentes e automações continuam na mesma transação. Eventos `replace` registram a mudança antes das jogadas do bot. A conta removida perde acesso à mesa em andamento, e a sala sai da sua lista de retomada. Sem humanos, a partida gratuita encerra como abandonada. Não há espectadores nas mesas iniciadas.
- Convites: host consulta `GET /:code/players?q=`, envia `POST /:code/invite` e compartilha o endereço público da sala. Unicidade por sala/destinatário torna repetição idempotente; convites válidos reservam capacidade e aparecem na projeção do lobby. Entrada consome a reserva; `POST /:code/decline` recusa e libera a vaga, e expulsão também permite remover reservas. Início exige ausência de convites pendentes e presença Socket.IO de todos os participantes na sala, verificada na transação. Reservas e alterações da sala usam o mesmo lock para impedir superlotação. Envio exige sessão revalidada, host, sala aberta e alvo ativo, com limite de frequência. A requisição Socket.IO `presence` renova presença de 75 segundos e retorna convites válidos da conta; a interface chama a cada 15 segundos somente com página visível e recebe alterações de convites por evento, apresentando alertas com Aceitar/Recusar. `match_presence` mantém leases de 30 segundos por conexão Socket.IO, renovados a cada 15 segundos e removidos ao desconectar; presença no site não substitui presença na sala. Presença e convites ficam em PostgreSQL, sem inferir Online apenas pela existência de sessão.
- O executor resolve compras obrigatórias e passagem de rodada na transação até a próxima decisão humana ou fim. Eventos versionados e snapshots privados ficam no banco. Socket.IO envia mudanças da sala, listagem de lobbies com retomada por conta e convites na mesma conexão. Cada processo Fastify mantém um `LISTEN` PostgreSQL; triggers notificam após o commit, e o servidor consulta o estado autorizado antes de emitir. Uma manutenção a cada 15 segundos renova leases e verifica expirações; não há polling de jogadas. A confirmação do comando é um recibo, enquanto o evento `room` entrega os frames inclusive a quem enviou. Reabertura/reconexão recupera eventos contíguos ou snapshot, com autorização e deduplicação por versão.
- Snapshot público inclui quantidade de cartas no baralho, nunca ordem/seed. Lista/retomada carregam no servidor Next. Cliente apresenta frames pela fila GSAP, restringe controles à própria decisão e bloqueia ações desconectado. LocalStorage guarda somente preferências; Croins continuam bloqueados.

## Próximas integrações

Direção aprovada, ainda não implementada. Não criar estruturas antecipadamente só por constarem aqui.

1. Validar lobbies e partidas entre dispositivos reais, especialmente reconexão durante escolhas especiais. Salas continuam somente públicas, sem espectadores nem substituição por outra conta. Ausências aguardam indefinidamente; bots assumem apenas por abandono ou expulsão explícitos.
2. Após concluir o gratuito, habilitar Croins somente com entrada, financiamento do pote, resultado, prêmio e devoluções autoritativos/transacionais. O host escolherá a entrada; saldo insuficiente bloqueará a entrada no lobby, com cobrança e revalidação no início. Abandono perderá a entrada e entregará a vaga ao bot. Pendências econômicas restantes em [Flip 7](flip7.md#economia-pendente).
3. Quando as apostas públicas forem retomadas, integrar palpite/débito/pote, apuração e pagamento separados. Preservar [regras aprovadas](../CROEBET.md#42-apostas), pagamentos idempotentes e devoluções atômicas; não importar palpites locais. Recuperação sem e-mail continua em aberto. Rankings/conquistas seguem fora da v1.

## Validação

- Implementação: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` (Turbopack). Testes unitários não comprovam PostgreSQL nem bucket S3 real. Documentação apenas: conferir referências e `git diff --check`.
- Integração: compile shared/API (`pnpm --filter @croebet/shared build` e `pnpm --filter @croebet/api build`), prepare banco exclusivo, aplique migrate/seed com `APP_ENV=test` e `DATABASE_URL` desse destino, configure `TEST_DATABASE_URL` e execute `pnpm test:integration`. Não reutilize a base development; execução sequencial já está configurada.
- E2E: Chrome instalado. Na raiz, execute `pnpm test:e2e` e `pnpm test:e2e --config playwright.session.config.ts`. Páginas/menus e jogos usam build: `API_INTERNAL_URL=http://127.0.0.1:3201 NEXT_DIST_DIR=.next-e2e pnpm build`, depois `pnpm test:e2e --config playwright.pages.config.ts` e `pnpm test:e2e --config playwright.games.config.ts` (catálogo e Flip 7 multiplayer).
- Suítes de navegador usam fixtures HTTP/Socket.IO em 3201 e Next em 3100, `.next-e2e`/`tsconfig.e2e.json`, sem reutilizar servidores existentes; execute-as sequencialmente. Não apagar `.next` nem encerrar o servidor do usuário para testar. Fixtures validam interface/contratos, não transações PostgreSQL.
- Pendência registrada na última execução: cenários de 404 dinâmico sem JavaScript de jogo pausado e perfil inexistente falhavam pela ausência do conteúdo visível no shell do Next, apesar do HTTP 404. Testes continuam ativos; confirme o resultado atual antes de declarar suíte aprovada.
- Resultados de cada rodada ficam no relato da entrega, não neste documento. Não transformar limitações temporárias do executor em regras do projeto.
