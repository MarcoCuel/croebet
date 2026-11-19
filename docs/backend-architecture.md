# Backend e ambiente de desenvolvimento

## Estado atual

Inspeção do código em 19/11/2026. Implementado não significa validado nesta rodada; comandos e limitações de testes estão em [Validação](#validação).

| Domínio | Implementação atual |
| --- | --- |
| Conta | Cadastro/login/logout, sessões PostgreSQL, nome, troca de username, exclusão com senha, perfil público e avatar |
| Economia | Carteira/extrato, bônus de cadastro, resgate diário, cupons e ajustes administrativos transacionais |
| Administração | Visão geral, usuários/permissões/suspensão, cupons, páginas, menus, catálogo de jogos e catálogo de apostas via API |
| Jogos | Seed com Flip 7 ativo e sem capa; motor e partidas livres ainda no navegador, sem multiplayer |
| Apostas | Apenas catálogo administrativo persistido; sem palpites, apuração ou pagamentos no backend; acesso público desabilitado |
| Rankings e conquistas | Fora da primeira versão; menus com “Em breve” e rotas redirecionadas ao início |

## Arquitetura

- `apps/web`: Next.js App Router, React e interface; consulta Fastify por HTTP, inclusive no servidor. [Frontend](frontend-architecture.md).
- `apps/api`: monólito modular Fastify/Node/TypeScript; PostgreSQL com Drizzle + `pg`. Rotas em `src/modules/auth/routes.ts` e `src/modules/admin/routes.ts`; serviços junto ao domínio.
- `packages/shared/src`: schemas Zod de entrada/saída e tipos públicos; validar em runtime, não apenas por tipos TypeScript. Contratos exatos ficam no código.
- `apps/api/src/db/schema.ts` e `apps/api/drizzle`: estrutura e migrations; `src/db/cli.ts`: migrate, seed e reset.
- HTTP em `/api/v1`; Next encaminha esse prefixo para `API_INTERNAL_URL` (padrão `http://127.0.0.1:3001`). É proxy de transporte, sem backend de domínio no Next.
- Docker inicialmente só para PostgreSQL 18. Web e API rodam como processos Node no host. Não adicionar microsserviços, Redis, filas externas ou workers separados sem necessidade concreta.
- Socket.IO + HTTP é a decisão para multiplayer, ainda não instalado/integrado. HTTP e eventos deverão chamar os mesmos serviços.

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

## Próximas integrações

Direção aprovada, ainda não implementada. Não criar estruturas antecipadamente só por constarem aqui.

1. Transferir o motor do Flip 7 para a API, preservando regras/testes; persistir partidas e expor somente estado público. Baralho, seed e aleatoriedade ficam privados; usar fonte criptográfica, com determinismo injetável nos testes.
2. Implementar salas e comandos Socket.IO + HTTP. Identidade vem da sessão e vínculo com a vaga, nunca de `socket.id` ou código da sala. Comandos usam `commandId` e `expectedVersion`, recibos persistidos e locks. Retry aceito deve retornar o recibo antes de rejeitar versão antiga; persistir antes de ack/broadcast. Validar quem controla cada decisão pendente, que pode diferir do jogador do turno; bots e avanços de regra são comandos internos.
3. Recuperação por eventos versionados ou snapshot, reautorizando reconexão e assinaturas. Eventos pendentes de despacho, bots e prazos ficam no PostgreSQL, executados no processo Fastify; timers só acordam o executor. Duplicatas são esperadas e deduplicadas; ao assinar, combinar snapshot e eventos sem perder versões. Animações não controlam regras. Revalidar sessão/Origin/CSRF também no Socket.IO; hooks HTTP não protegem seus eventos.
4. Habilitar Croins em partidas somente com entrada, financiamento do pote, resultado e prêmio autoritativos/transacionais. Financiamento dos bots, lobby, convidados, espectadores, desconexão, timeouts e abandono ainda exigem decisão. Não creditar contribuições simuladas de bots na carteira real.
5. Quando as apostas públicas forem retomadas, integrar palpite/débito/pote, apuração e pagamento separados. Preservar [regras aprovadas](../CROEBET.md#42-apostas), pagamentos idempotentes e devoluções atômicas; não importar palpites locais. Recuperação sem e-mail continua em aberto. Rankings/conquistas seguem fora da v1.

## Validação

- Implementação: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` (Turbopack). Testes unitários não comprovam PostgreSQL nem bucket S3 real. Documentação apenas: conferir referências e `git diff --check`.
- Integração: compile shared/API (`pnpm --filter @croebet/shared build` e `pnpm --filter @croebet/api build`), prepare banco exclusivo, aplique migrate/seed com `APP_ENV=test` e `DATABASE_URL` desse destino, configure `TEST_DATABASE_URL` e execute `pnpm test:integration`. Não reutilize a base development; execução sequencial já está configurada.
- E2E: Chrome instalado. Na raiz, execute `pnpm test:e2e` e `pnpm test:e2e --config playwright.session.config.ts`. Páginas/menus e jogos usam build: `API_INTERNAL_URL=http://127.0.0.1:3201 NEXT_DIST_DIR=.next-e2e pnpm build`, depois `pnpm test:e2e --config playwright.pages.config.ts` e `pnpm test:e2e --config playwright.games.config.ts`.
- Suítes de navegador usam fixtures HTTP em 3201 e Next em 3100, `.next-e2e`/`tsconfig.e2e.json`, sem reutilizar servidores existentes; execute-as sequencialmente. Não apagar `.next` nem encerrar o servidor do usuário para testar. Fixtures validam interface/contratos, não transações PostgreSQL.
- Pendência registrada na última execução: cenários de 404 dinâmico sem JavaScript de jogo pausado e perfil inexistente falhavam pela ausência do conteúdo visível no shell do Next, apesar do HTTP 404. Testes continuam ativos; confirme o resultado atual antes de declarar suíte aprovada.
- Resultados de cada rodada ficam no relato da entrega, não neste documento. Não transformar limitações temporárias do executor em regras do projeto.
