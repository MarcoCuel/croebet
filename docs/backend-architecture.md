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

### Testar no celular pela rede local

O Next dev já escuta em `0.0.0.0:3000`. Mantenha a API em `API_HOST=127.0.0.1` e `API_INTERNAL_URL=http://127.0.0.1:3001` no web: o proxy `/api/v1` atende HTTP e Socket.IO, sem abrir a porta da API para a rede.

No Mac, identifique a interface da LAN com `route -n get <IP-do-roteador>` e consulte seu IPv4 com `ipconfig getifaddr <interface>` (a rota padrão pode apontar para uma VPN). Adicione `DEV_WEB_ORIGINS=http://<IP-do-Mac>:3000` tanto em `apps/api/.env` quanto em `apps/web/.env.local`, preservando `WEB_ORIGIN=http://localhost:3000`. Reinicie web e API (`pnpm dev` ou os comandos separados) e abra esse endereço no celular conectado à mesma LAN. Se o IP mudar, atualize os dois arquivos e reinicie novamente. Os arquivos locais de ambiente são ignorados pelo Git.

A API aceita somente origens exatas configuradas, com CSRF obrigatório; produção rejeita `DEV_WEB_ORIGINS` e continua com uma única origem HTTPS. O Next libera os hostnames adicionais apenas no servidor de desenvolvimento. Cookies permanecem HttpOnly, SameSite=Lax e host-only: faça login separadamente em localhost e no IP. Os IDs das ações usam aleatoriedade criptográfica também em HTTP na LAN. A cópia automática de links depende da permissão de clipboard do navegador e pode não estar disponível sem HTTPS.

Se o celular não alcançar o site, verifique se o firewall permite conexões ao Node, se o Wi-Fi isola clientes e se a VPN permite tráfego local. Não exponha a API nem desative CSRF para contornar problemas de rede.

### Compartilhar com amigos pela internet

Com web e API em execução, abra um túnel temporário para o Next: `cloudflared tunnel --no-autoupdate --url http://127.0.0.1:3000 --protocol http2`. Adicione a URL HTTPS exata gerada a `DEV_WEB_ORIGINS` em `apps/api/.env` e `apps/web/.env.local`, mantendo localhost e LAN. No web, use essa URL também em `WEB_ORIGIN` para os links de compartilhamento e metadados. Recarregue os processos web/API e compartilhe `<URL-gerada>/jogos/flip7`; login, cadastro e Socket.IO passam pelo mesmo proxy, com CSRF e origens explícitas. A API continua em loopback.

O Quick Tunnel funciona enquanto o Mac estiver acordado e os processos web, API e `cloudflared` estiverem ativos. Reiniciar o túnel gera outro endereço: substitua a origem antiga nos dois arquivos locais e atualize `WEB_ORIGIN` do web. Ao encerrar o compartilhamento, remova essa origem e restaure o `WEB_ORIGIN` do web para localhost. Não use wildcard de `trycloudflare.com`. Os arquivos locais de ambiente continuam fora do Git. Referência: [Quick Tunnels da Cloudflare](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

### Preservação de dados e reset

O projeto está em operação com usuários reais. Preserve contas, economia, partidas e auditoria; use migrations incrementais, sem consolidar migrations aplicadas. Antes de implantar alterações no banco real, mantenha backup recuperável e valide a migration em uma cópia isolada. Não execute reset ou limpeza destrutiva para implementar funcionalidades.

`db:reset` é exclusivo de bases locais descartáveis explicitamente autorizadas e de test. Exige `APP_ENV=development|test`, `NODE_ENV` diferente de `production`, marcador compatível, `DB_RESET_ALLOWED_URL` exata e `DB_RESET_CONFIRM` igual ao banco. Produção recusa reset e exige credencial separada de migration. Uma base marcada como development pode conter dados reais: o marcador não autoriza seu descarte.

## Conta e autorização

- Username preservado, unicidade/login sem distinguir caixa; nome de exibição independente. Regras de produto em [CROEBET.md, seção 3](../CROEBET.md#3-público-e-acesso); limites exatos nos schemas compartilhados. Senha com Argon2id; sem e-mail ou recuperação implementados. `PATCH /me/password` exige senha atual, valida a nova senha e limita tentativas; revalida hash, conta e sessão dentro da transação, altera o hash e revoga as outras sessões, preservando a atual. Login revalida o hash antes de emitir sessão para impedir autenticação concorrente com senha substituída.
- Sessão opaca aleatória em cookie HttpOnly, host-only, SameSite=Lax; apenas hash no banco. Expiração absoluta de 30 dias e inatividade de 7 dias. Em `APP_ENV=production`, usa Secure e prefixo `__Host-`.
- Toda mutação exige Origin na lista explícita (`WEB_ORIGIN` e extras apenas em development/test) e token CSRF ligado à sessão/nonce, inclusive pré-login. Limites de tentativas são persistidos. Não registrar senhas, cookies ou tokens.
- Papéis `user` e `admin`, conferidos pela API. Sem acesso administrativo: 404. A renderização do Next não substitui autorização no serviço; revalide sessão/conta dentro da transação de escrita.
- Nenhum cadastro, nome ou variável pública concede admin. A primeira promoção é operacional no banco de desenvolvimento; depois, Admin → Usuários gerencia papéis. Não há conta/senha administrativa no seed.
- Alterar papel/status ou excluir conta usa lock de governança antes dos locks de usuário/sessão/carteira; não pode remover o último admin ativo. Suspender revoga sessões; reativação exige login.
- Exclusão pela própria conta exige senha e remove identidade/sessões; carteira fica desvinculada e auditoria permanece, conforme as FKs e invariantes atuais. Históricos administrativos das partidas permanecem independentes da conta excluída.

Admin → Usuários agenda exclusão em 30 dias (`DELETE /admin/users/:id`): suspende imediatamente, revoga sessões e audita na mesma transação. Pedidos repetidos mantêm o prazo. Reativar pelo status cancela o agendamento; suspensão comum não agenda exclusão. O último administrador ativo continua protegido. A API processa lotes vencidos ao iniciar e a cada minuto, usando o relógio do PostgreSQL, lock de governança e validação do ambiente; falhas revertem e são retentadas. Remove identidade/sessões e salas operacionais, agenda limpeza de avatar e preserva carteira desvinculada, auditoria e arquivos de partidas.

Implantação: aplique a migration incremental `0024_odd_hydra.sql` antes de atualizar API/web; contas existentes recebem prazo nulo. Preserve backup antes da implantação. Para interromper a limpeza, pare os processos da API; durante os 30 dias, reativar a conta cancela o prazo. Após a exclusão definitiva, recuperar identidade exige restauração controlada de backup. Em rollback de aplicação, mantenha a coluna para não perder agendamentos; não reverta migrations anteriores.

O perfil público retorna identidade e um calendário do último ano em `America/Sao_Paulo`, ampliado até o início do primeiro mês e da primeira semana para evitar recortes no começo. A API agrega partidas concluídas do arquivo, recibos de bônus diário e cupons, incluindo dias vazios. Cada evento vale uma atividade; vitórias (incluindo empates na maior pontuação, sem bot no resultado) são apenas detalhes. Partidas em andamento/abandonadas e ações administrativas não contam. O histórico usa exclusivamente os registros disponíveis, sem inventar eventos anteriores, e não expõe códigos de cupons, valores, IDs ou estados das partidas. Não requer migration; a agregação acompanha o histórico persistido.

O histórico privado em `GET /me/history` reúne lançamentos da carteira (incluindo bônus e cupons) e partidas concluídas/encerradas em que a conta participou, com paginação e ordem cronológica decrescente. Usa os registros existentes, sem migration ou cópia de eventos. Retorna apenas descrição, data, tipo e valor quando houver movimentação; não expõe estados do motor nem dados de outros participantes.

### Avatares

API recebe JPG/PNG/WebP, valida e reprocessa com Sharp para WebP 256 × 256 sem metadados (limites em `modules/avatars/image.ts`). Banco guarda chave aleatória; perfil/sessão retornam apenas URL pública. Desenvolvimento usa arquivos locais; adaptador S3 privado já existe, configurado pelos `.env.example`.

Leitura pela API revalida o vínculo com conta ativa antes de servir ou responder 304; usa ETag e `private, no-cache`. Substituição/remoção agenda limpeza persistida; o próprio processo retenta a fila ao iniciar e a cada minuto. Credenciais e caminhos de armazenamento ficam exclusivamente na API.

## Carteira e recompensas

Regras e valores aprovados estão em [CROEBET.md, seção 4.3](../CROEBET.md#43-croins-economia-fictícia); a configuração executável fica em `modules/economy/config.ts` e é publicada por `/api/v1/economy`. Frontend não mantém valores econômicos alternativos.

- `wallet_accounts`, `wallet_operations`, `wallet_entries`: livro imutável com lançamentos de soma zero, contas de emissão/casa/pote/usuário e saldo aplicado por triggers. Correções de domínio geram contrapartidas; não editam lançamentos.
- Croins inteiros: PostgreSQL BIGINT/BigInt nos cálculos; contratos públicos limitados à faixa inteira segura de JavaScript. Contas de usuário/pote/casa não ficam negativas; emissão financia concessões explicitamente.
- `transferCroinsInTransaction(client, input)` participa da transação do domínio: chamador autoriza, bloqueia recursos e controla begin/commit/rollback. Recibo só é definitivo após commit. `transferCroins(pool, input)` gerencia uma transação própria; nenhum dos dois é endpoint público de transferência.
- Locks em ordem consistente; chave idempotente por escopo vinculada ao conteúdo. Retry retorna recibo original; mesma chave com conteúdo diferente é conflito. Saldo, recibo, registro de domínio e auditoria confirmam juntos.
- Cadastro concede bônus junto à criação da conta/carteira/sessão. Resgate diário usa o relógio do PostgreSQL e a meia-noite de `America/Sao_Paulo`, sem limite de saldo; unicidade e `requestId` impedem duplicação. Não há backfill para contas antigas.
- Cupons: código normalizado em maiúsculas, valor positivo obrigatório, limite global e datas opcionais, pausa e um uso por conta. Início inclusivo/término exclusivo. Limites, validade, recibo e crédito são conferidos na mesma transação; histórico guarda código/valor efetivamente concedidos.
- Motivo é opcional nas ações administrativas. Ausência de motivo no ajuste usa a descrição padrão; a exigência interna de descrição do livro não cria campo obrigatório na interface.
- `/me/wallet` e `/me/transactions` são autenticados; extrato paginado e filtrado na API, sem carteira local alternativa.

## Conteúdo e administração

- Escritas administrativas usam sessão/papel, CSRF, limites, transação e auditoria atômica. Recursos editáveis têm versão esperada ou estado anterior esperado; conflito não sobrescreve outra edição.
- Usuários: admin edita nome de exibição e username por `/admin/users/:id/identity`, com schemas compartilhados, valores anteriores esperados, locks e auditoria na mesma transação. Unicidade do username continua case-insensitive. Correção administrativa não espera o intervalo de 30 dias, mas uma mudança efetiva de username reinicia esse intervalo para a edição pela própria conta. Permissão/status continuam no fluxo existente, com proteção do último admin e revogação de sessões ao suspender.
- Senha de usuários: `PATCH /admin/users/:id/password` permite ao admin definir uma nova senha de 8 a 128 caracteres sem a senha anterior. Usa Argon2id, limite de tentativas, revalidação de autorização e conflito de alteração concorrente; atualização, revogação de sessões e auditoria ocorrem na mesma transação. Não inclui senha ou hash na resposta/auditoria. Ao editar a própria conta, preserva somente a sessão atual; em outra conta, revoga todas as sessões. Não exige migration.
- Internas e endpoints administrativos identificam entidades existentes por UUID (`/admin/paginas/[id]`, jogos, apostas, usuários e cupons). Slug fica nos endereços públicos; mudar slug não cria alias histórico. `nova`/`novo` são ações de criação, não IDs de entidades.
- Contratos de escrita de páginas e criação de jogos normalizam slugs por `packages/shared/src/slug.ts` antes de validar e persistir. Maiúsculas, acentos e espaços são aceitos na edição; endereços vazios, reservados em páginas ou acima do limite continuam inválidos. Consultas públicas exigem formato canônico, e a unicidade continua sendo conferida no banco, sem alterar endereços já cadastrados.
- Páginas: documento JSON validado em `shared`, sem HTML arbitrário; autoria, datas, versão, status editorial e lixeira. Agendamento vencido é resolvido nas consultas pelo relógio do banco, sem scheduler em memória. Restaurar lixo retorna a rascunho; exclusão definitiva é auditada.
- Menus `main` e `footer` independentes, planos e ordenados. Destinos: página fixa, UUID de página criada ou URL validada. Publicação não adiciona item ao menu; referências por UUID acompanham o slug. Destinos não públicos são omitidos. `showInMenu` ainda existe no contrato de páginas, mas não determina a navegação.
- Ícone de menu é opcional, validado pelo catálogo Lucide; sem escolha, sem ícone. API resolve apenas os vetores dos ícones escolhidos. Ao atualizar `lucide-react`, execute `node scripts/sync-lucide-icons.mjs`; não enviar vetores arbitrários na escrita.
- Jogos: painel cria registros do catálogo e edita nome, descrição em texto simples (opcional, até 2.000 caracteres), ativação e capa selecionada na biblioteca de mídia. URLs/caminhos de capa já cadastrados continuam válidos. Criação usa `/admin/games` (POST), slug único validado e auditoria na mesma transação; o slug é definido no cadastro. Jogos sem motor têm página pública “Em breve”; cadastrar um slug não cria um motor nem libera partidas (o contrato de partidas continua limitado ao Flip 7). Público recebe somente ativos; pausados respondem 404. Sem capa cadastrada, placeholder. Aplicar a migration incremental `0025_redundant_gorgon.sql` antes de implantar a API; ela amplia a restrição de slug preservando registros e referências. Em recuperação, manter essa restrição e os registros criados; versões antigas que aceitam apenas `flip7` precisam da compatibilidade de catálogo antes de um rollback de aplicação.
- Apostas: catálogo começa vazio, com pergunta/critério/formato/opções/prazo/status. Regras puras de rateio permanecem como referência; não há persistência nem pagamento local de apostas.
- Visão geral: períodos 1/7/30 dias no fuso de São Paulo; conta só lançamentos do lado do usuário para não duplicar a emissão. Ativos = contas com movimentação; saldo/contas atuais independem do período. Não agrega partidas ou apostas locais.

- SEO: `/admin/seo` persiste padrões e ajustes de Home/Jogos; páginas e jogos têm campos opcionais próprios. Escrita com versão e auditoria. API pública desativa indexação fora de `APP_ENV=production`; sitemap inclui somente conteúdo público indexável.

### Biblioteca de mídia

Admin → Mídia (`/admin/midia`) lista, busca, envia, visualiza e exclui imagens por `/admin/media`. Metadados em `media_assets`; URLs públicas estáveis em `/api/v1/media/:uuid.webp`. Upload binário JPG/PNG/WebP de até 10 MB e 25 megapixels, estático, reprocessado com Sharp para WebP sem metadados, mantendo proporção/transparência e limitando o maior lado a 4096 px. Nome, dimensões, bytes, autor e data ficam no PostgreSQL; objetos nunca são listados pelo bucket.

Reutiliza o adaptador local/S3 dos avatares, as variáveis `AVATAR_STORAGE`/`S3_*` e o mesmo bucket privado, com prefixo separado `media/`. Localmente usa a pasta `media` ao lado de `AVATAR_LOCAL_DIR`; avatares mantêm seu diretório, prefixo, permissões e limpeza próprios. A API serve o objeto sem expor credenciais. Leitura pública verifica registro ativo antes de servir ou responder 304; cache exige revalidação.

Envio/exclusão exigem admin, CSRF, limite de tentativas e revalidação transacional de sessão/papel; confirmação e auditoria são atômicas. Upload começa como `uploading`, só aparece após confirmação `ready`; exclusão marca `deleted` e oculta imediatamente. Limpeza persistida remove objetos excluídos e uploads incompletos após uma hora, com retentativa no ciclo existente da API. Exclusão recusa referências de capas/SEO de jogos, SEO de páginas (inclusive rascunhos/lixeira), configurações e links de menus. Escritas dessas áreas validam referências da biblioteca sob o mesmo lock administrativo da exclusão, evitando salvar seleções excluídas em formulários abertos. URLs antigas externas/estáticas são preservadas sem importação automática.

Implantação: faça backup e aplique `0026_panoramic_zzzax.sql` antes de atualizar API/web. A migration só acrescenta tabela, índice e restrições; não altera imagens ou dados existentes. Em rollback de aplicação, mantenha a tabela e os objetos: versões antigas continuam lendo suas URLs enquanto a API que serve mídia permanecer disponível; recuperação exige restabelecer API compatível e os backups de banco/bucket, sem reverter migrations antigas.

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

## Partidas integradas

- `modules/matches` executa o ciclo compartilhado; `modules/games/flip7` contém motor, invariantes privadas e driver. `games/cards.ts` fornece embaralhamento puro com RNG injetável; o driver usa `crypto.randomInt`, e testes podem usar seeds determinísticas.
- Migrations de partidas criam salas, participantes vinculados a contas, comandos e eventos. Migrations históricas do protótipo podem conter limpezas de development/test; já aplicadas, não devem ser reaplicadas em bases com dados reais. Criação usa `requestId` por criador; comandos usam `commandId` por conta/sala e `expectedVersion` nas decisões/início. Locks e recibos confirmam junto com o estado; host pode mudar sem perder a identidade do criador.
- `/api/v1/matches`: GET lista publicamente partidas em andamento; POST cria lobby. GET `/lobbies` lista salas abertas e identifica separadamente todos os lobbies da conta, seu lobby próprio e sua partida ativa, mesmo fora do limite das listagens públicas. GET `/:code` consulta publicamente lobby ou mesa, inclusive finalizada. POST `/:code/join`, `/leave`, `/start`, `/update` controlam o lobby; `/commands` aplica decisão, `/abandon` transfere a vaga para bot e `/kick` permite expulsão pelo host no lobby ou jogo. Escritas usam sessão/Origin/CSRF. Uma conta pode ocupar vários lobbies e manter uma criação própria aberta enquanto continua como host dela. Criação, entrada e início verificam ausência de outra vaga ativa sob seu controle. As mutações de ciclo de vida adquirem um advisory lock transacional antes dos locks de conta e sala: o início pode remover vagas em várias salas e precisa serializar essas alterações entre processos, contas e abas. O primeiro início confirmado retira todos os participantes das demais filas, libera suas reservas, transfere hosts e fecha salas vazias na mesma transação; a conta controla no máximo uma partida ativa.
- Capacidade é limite de 2–12 pessoas; iniciar requer host, versão atual e pelo menos duas contas ativas. O host pode alterar modalidade/Brutal/capacidade somente no lobby, sem reduzir o limite abaixo da ocupação. Configuração, expulsão, entrada/saída/início usam o mesmo lock da sala, recibos idempotentes e versões nas decisões do host. Ao sair, o host passa para o participante mais antigo ainda no controle; última saída fecha. Desconectar não retira vaga nem automatiza decisões: não há timeout. Abandono e exclusão de conta usam a mesma ordem de lock de ciclo de vida para não disputar transferências de host e remoções em várias salas. Exclusão de conta encerra suas salas/partidas para evitar vagas sem controlador.
- Cada decisão pertence à conta da vaga indicada pelo motor (`bonusChoice`, ação pendente ou turno). Host não controla os demais. Não há criação pública de convidados ou bots. Abandono/expulsão em jogo mantém identidade, cartas e pontos, remove o controlador da vaga no banco e a entrega a um bot normal; escolhas pendentes e automações continuam na mesma transação. Eventos `replace` registram a mudança antes das jogadas do bot. A conta removida perde o controle da vaga e pode continuar acompanhando como espectador. Sem humanos, a partida gratuita encerra como abandonada. Mesas iniciadas aceitam espectadores autenticados ou visitantes, sem comandos nem ocupação de vagas.
- Convites: host consulta `GET /:code/players?q=`, envia `POST /:code/invite` e compartilha o endereço público da sala. Unicidade por sala/destinatário torna repetição idempotente; convites válidos reservam capacidade e aparecem na projeção do lobby. Entrada consome a reserva; `POST /:code/decline` recusa e libera a vaga, e expulsão também permite remover reservas. Início exige ausência de convites pendentes e presença Socket.IO de todos os participantes na página de jogos, verificada na transação. Reservas e alterações da sala usam o mesmo lock para impedir superlotação. Envio exige sessão revalidada, host, sala aberta e alvo ativo, com limite de frequência. A requisição Socket.IO `presence` renova presença de 75 segundos e retorna convites válidos da conta; a interface chama a cada 15 segundos somente com página visível e recebe alterações de convites por evento, apresentando alertas com Aceitar/Recusar. `match_presence` mantém um lease de 30 segundos por conexão/sala para todos os lobbies da conta enquanto observa a página de jogos, renovados a cada 15 segundos e removidos ao sair da página ou desconectar; presença no site não substitui presença na sala. Presença e convites ficam em PostgreSQL, sem inferir Online apenas pela existência de sessão.
- O executor resolve compras obrigatórias e passagem de rodada na transação até a próxima decisão humana ou fim. Eventos versionados e snapshots privados ficam no banco. Socket.IO envia mudanças da sala e listagens públicas de lobbies/partidas; conexões autenticadas também recebem retomada por conta e convites. Visitantes apenas observam, e a presença na sala só é registrada para participantes autenticados. Cada processo Fastify mantém um `LISTEN` PostgreSQL. A migration `0021_scoped_realtime` envia identificadores e tipos de alteração após commit: mesa, conta, convite, presença, autorização ou catálogo. O servidor consulta somente os domínios afetados e agrupa avisos pendentes por conexão, recuperando todos os eventos persistidos desde a versão confirmada. A mesa não assina listagens; o lobby assina listagens e a sala aberta. Jogadas comuns não refazem consultas de presença, convites ou diretórios. A listagem pública de partidas usa resumos (rodada, participantes e controladores), sem carregar cartas/histórico; atualiza em mudanças de rodada ou ciclo de vida. Uma manutenção a cada 15 segundos renova leases, remove presenças/convites vencidos e revalida sessões; remoções notificam os assinantes afetados, sem polling de jogadas. `REALTIME_MAX_CONNECTIONS` controla o limite por processo (padrão 200); não representa capacidade medida. A confirmação do comando é um recibo, enquanto o evento `room` entrega os frames inclusive a quem enviou. Reabertura/reconexão recupera eventos contíguos ou snapshot, com autorização e deduplicação por versão.
- Snapshot público inclui quantidade de cartas no baralho, nunca ordem/seed. Lista/retomada carregam no servidor Next. Cliente apresenta frames pela fila GSAP, restringe controles à própria decisão e bloqueia ações desconectado. LocalStorage guarda somente preferências; a economia das partidas é confirmada pela API.

### Economia das partidas

`modules/matches/economy.ts` reutiliza `transferCroinsInTransaction`: aceites do valor ficam nas vagas do lobby, a cobrança é conjunta no início e a liquidação acompanha a transação que confirma o resultado. `game_match_stakes` mantém contribuições por carteira/vaga, conta do pote, total, distribuição e status; não tem FK para sala ou usuário, preservando auditoria após exclusões. O extrato e o histórico da conta já consultam os lançamentos do livro. A consulta administrativa cruza o arquivo independente com essa liquidação; nenhum snapshot privado é exposto. Regras em [Flip 7](flip7.md#economia).

A migration `0027` é incremental: salas existentes recebem entrada zero, sem cobranças retroativas. Aplicar antes de publicar API/interface que usam esses campos; não exige reset ou seed de contas reais. Exclusões de contas devolvem potes pendentes sob o lock de ciclo de vida antes da remoção; um trigger impede apagar sala com pote pendente por um caminho que esqueça essa etapa. Falhas operacionais anteriores ao commit revertem integralmente; retries retornam recibos já confirmados. Para reverter a aplicação, interromper a abertura de salas com entrada e concluir ou devolver todos os potes pendentes antes de voltar a uma versão sem suporte econômico; manter tabelas, operações e arquivos, sem migration destrutiva de reversão.

### Histórico administrativo de partidas

Admin → Jogos → editar jogo lista partidas iniciadas, com busca por código/participante, status, modo, datas, pontuações e vencedores (incluindo empates). Partidas finalizadas também expõem `durationSeconds` no estado público, calculado entre início e término do arquivo existente, sem incluir espera no lobby; sem registro, retorna nulo. Não há relógio local nem migration para esse resumo. Lista e reprodução enriquecem os participantes com os avatares atuais em uma consulta em lote por página, sem alterar os nomes/IDs arquivados. Contas removidas ou sem avatar usam fallback no frontend; não há cópia de imagens no arquivo nem migration. A reprodução tem início/final, avanço/retorno, pausa e velocidade, com paginação de frames. Controles só alteram a visualização; não executam comandos na mesa real. O acesso aos endpoints de histórico e reprodução exige admin na API, inclusive para jogos desativados.

`game_match_archives` e `game_match_archive_frames` preservam identidades por vaga, versão das regras e projeções públicas confirmadas. Triggers da migration `0023` registram os eventos na mesma transação da partida; rollback não publica histórico e repetição idempotente não duplica frames. Nenhum baralho privado ou seed é arquivado. A cópia independente não tem FK para usuário ou sala operacional, mantendo histórico após exclusões; remover uma sala em andamento a registra como encerrada sem vencedor. Resultados finalizados não são reescritos por exclusões. A exclusão de conta ainda encerra suas salas operacionais; o arquivo preserva seus registros.

A migration recupera históricos existentes, sem recriar registros já apagados. Para essas partidas antigas, início usa a criação da sala e término usa sua última atualização, pois não existiam timestamps específicos; novas partidas registram início na transição de lobby. Ranking permanece pendente: o arquivo fornece IDs, pontos, empates e indicação de controle por bot; a política de elegibilidade e a agregação ainda precisam ser definidas.

## Próximas integrações

Direção aprovada, ainda não implementada. Não criar estruturas antecipadamente só por constarem aqui.

1. Validar lobbies e partidas entre dispositivos reais, especialmente reconexão durante escolhas especiais. Salas continuam somente públicas, sem espectadores nem substituição por outra conta. Ausências aguardam indefinidamente; bots assumem apenas por abandono ou expulsão explícitos.
2. Validar a operação de partidas com Croins entre dispositivos e acompanhar os registros de entrada, pote, prêmio e devolução. Regras implementadas em [Flip 7](flip7.md#economia).
3. Quando as apostas públicas forem retomadas, integrar palpite/débito/pote, apuração e pagamento separados. Preservar [regras aprovadas](../CROEBET.md#42-apostas), pagamentos idempotentes e devoluções atômicas; não importar palpites locais. Recuperação sem e-mail continua em aberto. Rankings/conquistas seguem fora da v1.

## Validação

- Implementação: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` (Turbopack). Testes unitários não comprovam PostgreSQL nem bucket S3 real. Documentação apenas: conferir referências e `git diff --check`.
- Integração: compile shared/API (`pnpm --filter @croebet/shared build` e `pnpm --filter @croebet/api build`), prepare banco exclusivo, aplique migrate/seed com `APP_ENV=test` e `DATABASE_URL` desse destino, configure `TEST_DATABASE_URL` e execute `pnpm test:integration`. Não reutilize a base development; execução sequencial já está configurada.
- E2E: Chrome instalado. Na raiz, execute `pnpm test:e2e` e `pnpm test:e2e --config playwright.session.config.ts`. Páginas/menus e jogos usam build: `API_INTERNAL_URL=http://127.0.0.1:3201 NEXT_DIST_DIR=.next-e2e pnpm build`, depois `pnpm test:e2e --config playwright.pages.config.ts` e `pnpm test:e2e --config playwright.games.config.ts` (catálogo e Flip 7 multiplayer).
- Suítes de navegador usam fixtures HTTP/Socket.IO em 3201 e Next em 3100, `.next-e2e`/`tsconfig.e2e.json`, sem reutilizar servidores existentes; execute-as sequencialmente. Não apagar `.next` nem encerrar o servidor do usuário para testar. Fixtures validam interface/contratos, não transações PostgreSQL.
- Pendência registrada na última execução: cenários de 404 dinâmico sem JavaScript de jogo pausado e perfil inexistente falhavam pela ausência do conteúdo visível no shell do Next, apesar do HTTP 404. Testes continuam ativos; confirme o resultado atual antes de declarar suíte aprovada.
- Resultados de cada rodada ficam no relato da entrega, não neste documento. Não transformar limitações temporárias do executor em regras do projeto.
