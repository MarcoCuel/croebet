# Croebet

Plataforma da comunidade Croezinha, com jogos multiplayer e economia fictícia em **Croins**, sem dinheiro real. Este guia reúne os comandos de instalação, desenvolvimento, validação e operação.

**O projeto está em operação e contém dados reais, inclusive na base local de desenvolvimento. Preserve contas, saldos, partidas, imagens e históricos. Não use reset para instalar, atualizar ou corrigir o projeto.**

## Stack e estrutura

| Caminho | Responsabilidade |
| --- | --- |
| `apps/web` | Next.js 16, React 19, TypeScript, Tailwind CSS 4 e componentes Radix; interface e proxy HTTP/Socket.IO |
| `apps/api` | Fastify, autenticação, regras dos jogos, economia, persistência e Socket.IO |
| `packages/shared` | Contratos e validações Zod compartilhados |
| `scripts` | Supervisão dos processos, deploy, backup e rollback |
| `ops` | Configuração do PostgreSQL de produção |
| `docs` | Documentação técnica e regras dos jogos |

PostgreSQL 18 em Docker, com Drizzle ORM. Sessões ficam no banco; senhas usam Argon2id. Imagens podem usar armazenamento local ou S3 compatível. O frontend consulta a API; não acessa diretamente o banco nem executa as regras autoritativas dos jogos.

## Requisitos

- Node.js **22.18.0 ou superior**, conforme `engines` do projeto.
- **pnpm 12.21.0**, versão fixada em `packageManager` na raiz.
- Docker com Docker Compose disponível e iniciado; no Mac, Docker Desktop.
- Git para o fluxo de publicação.
- Google Chrome para os testes de navegador.
- `cloudflared` para publicar a produção pelo túnel configurado.

Execute os comandos deste guia na raiz do repositório, salvo indicação contrária. As versões exatas das dependências estão nos `package.json` e no `pnpm-lock.yaml`.

## Instalação local

### 1. Configurar os ambientes

Em uma instalação nova, copie os exemplos abaixo. Se os arquivos já existirem, preserve os valores atuais e confira apenas as variáveis necessárias.

```sh
cp -n .env.example .env
cp -n apps/api/.env.example apps/api/.env
cp -n apps/web/.env.example apps/web/.env.local
```

| Arquivo | Configuração |
| --- | --- |
| `.env` | Credenciais e porta do PostgreSQL de desenvolvimento |
| `apps/api/.env` | Ambiente, conexão do banco, origem web, segredo CSRF e armazenamento |
| `apps/web/.env.local` | Endereço interno da API e origem pública do site |

Na raiz, defina uma senha em `POSTGRES_PASSWORD`. Na API, configure `DATABASE_URL` com o mesmo usuário, senha, porta e banco do Compose. Para uma instalação nova com os valores padrão:

```dotenv
# apps/api/.env — substitua SUA_SENHA e SEU_SEGREDO
APP_ENV=development
API_HOST=127.0.0.1
API_PORT=3001
DATABASE_URL=postgresql://croebet:SUA_SENHA@127.0.0.1:5432/croebet_development
WEB_ORIGIN=http://localhost:3000
CSRF_SECRET=SEU_SEGREDO
AVATAR_STORAGE=local
AVATAR_LOCAL_DIR=.data/avatars
```

Se a senha tiver caracteres especiais, codifique-os para uso na URL de conexão. Gere um segredo CSRF aleatório com pelo menos 32 caracteres:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

No frontend, mantenha:

```dotenv
API_INTERNAL_URL=http://127.0.0.1:3001
WEB_ORIGIN=http://localhost:3000
```

Não versione arquivos de ambiente nem compartilhe seus segredos. As opções de S3 e demais variáveis estão nos [exemplos da API](apps/api/.env.example) e do [frontend](apps/web/.env.example).

### 2. Instalar e preparar o banco

```sh
pnpm install --frozen-lockfile
pnpm db:up
pnpm db:migrate
pnpm db:seed
```

`db:migrate` aplica migrations pendentes. O seed identifica o ambiente e cadastra Flip 7 sem sobrescrever edições; não popula contas, cupons, páginas ou apostas de exemplo. Em um banco existente, confirme o destino antes de aplicar alterações.

## Desenvolvimento

```sh
pnpm dev
```

Inicia web e API com hot reload em primeiro plano. `Ctrl+C` encerra os processos dessa execução; o PostgreSQL permanece ativo.

| Serviço | Endereço de desenvolvimento |
| --- | --- |
| Site | <http://localhost:3000> |
| API | <http://127.0.0.1:3001> |
| Health do processo | <http://127.0.0.1:3001/api/v1/health> |
| Prontidão do banco/ambiente | <http://127.0.0.1:3001/api/v1/health/ready> |
| PostgreSQL | `127.0.0.1:5432` |

Também é possível manter o desenvolvimento em segundo plano:

| Comando | Uso |
| --- | --- |
| `pnpm dev:start` | Iniciar web e API em segundo plano |
| `pnpm dev:stop` | Parar os processos supervisionados de desenvolvimento |
| `pnpm dev:status` | Consultar o estado dos processos |
| `pnpm dev:logs` | Mostrar as últimas linhas dos logs |
| `pnpm dev:web` | Iniciar somente o frontend |
| `pnpm dev:api` | Iniciar somente a API |

Use os comandos separados em terminais distintos quando precisar acompanhar cada aplicação. Não inicie dois modos ao mesmo tempo nas mesmas portas. Logs do supervisor ficam em `.data/development/logs`.

Para testar no celular, configure `DEV_WEB_ORIGINS=http://<IP-do-Mac>:3000` nos ambientes da API e do frontend, reinicie os processos e acesse esse endereço na mesma rede. A API continua em loopback; HTTP e Socket.IO passam pelo Next. Veja os detalhes em [acesso pela rede local](docs/backend-architecture.md#testar-no-celular-pela-rede-local).

## Banco de dados e migrations

| Comando | Uso |
| --- | --- |
| `pnpm db:up` | Iniciar o PostgreSQL de desenvolvimento e aguardar prontidão |
| `pnpm db:stop` | Parar o PostgreSQL de desenvolvimento, preservando o volume |
| `pnpm db:logs` | Acompanhar os logs do banco |
| `pnpm db:generate` | Gerar migrations a partir das alterações no schema Drizzle |
| `pnpm db:migrate` | Aplicar migrations pendentes no destino configurado |
| `pnpm db:seed` | Executar o seed do projeto |

Alterações de schema devem gerar migrations incrementais, compatíveis com os dados existentes. Revise o SQL gerado, valide em banco exclusivo de teste e mantenha backup recuperável antes da implantação em bases reais. Não edite ou consolide migrations já aplicadas.

O Compose mantém os dados em volume persistente. Alterar `POSTGRES_USER`, `POSTGRES_PASSWORD` ou `POSTGRES_DB` no `.env` não reconfigura um volume já inicializado.

`pnpm db:reset` é destrutivo e exclusivo de bases descartáveis explicitamente autorizadas. Exige as proteções de ambiente e confirmação documentadas em [preservação de dados e reset](docs/backend-architecture.md#preservação-de-dados-e-reset). Não execute esse comando na base local existente nem em produção. Não remova volumes para resolver erros de conexão ou migration.

## Validação e build

Para alterações de código, execute:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

| Comando | Uso |
| --- | --- |
| `pnpm lint` | ESLint de todos os pacotes, sem warnings |
| `pnpm typecheck` | Compilar os contratos compartilhados e verificar TypeScript |
| `pnpm test` | Compilar shared/API e executar testes unitários e operacionais |
| `pnpm build` | Compilar todos os pacotes; frontend com Next/Turbopack |
| `pnpm test:e2e` | Executar a configuração padrão do Playwright |
| `pnpm test:integration` | Executar integração da API em PostgreSQL exclusivo de teste |
| `pnpm test:ops` | Executar testes unitários dos scripts operacionais |
| `pnpm test:ops:integration` | Executar ensaios operacionais em infraestrutura sintética de teste |

Integração exige banco separado com marcador `test`, migrations/seed aplicados e `TEST_DATABASE_URL` configurada. E2E possui configurações específicas, algumas com build próprio; execute as suítes de navegador sequencialmente. A preparação completa está em [Validação](docs/backend-architecture.md#validação).

`pnpm build` apenas gera os artefatos; não publica nem reinicia produção. `pnpm start` inicia somente o frontend compilado e `pnpm start:api` somente a API compilada, com os ambientes dessas aplicações. A operação da produção existente usa os comandos `prod:*` abaixo.

## Produção

### Instalação atual no Mac

Produção usa uma pasta independente, `/Users/marco/Desktop/croebet-production`, com releases, dependências, credenciais, imagens e banco próprios. Desenvolvimento pode continuar na pasta deste repositório.

| Serviço | Destino de produção |
| --- | --- |
| Site público | <https://croebet.marcocuel.com> |
| Web local | `127.0.0.1:6767` |
| API local | `127.0.0.1:6768` |
| PostgreSQL | `127.0.0.1:5433`, banco `croebet_production` |
| Logs | `/Users/marco/Desktop/croebet-production/shared/logs` |

O túnel Cloudflare deve apontar somente para `http://127.0.0.1:6767`. Seu token fica no arquivo privado `shared/tunnel-token` da pasta de produção. O supervisor inicia o túnel após web/API ficarem prontas; sem token, o acesso público fica pendente. Não exponha a API nem o PostgreSQL.

### Primeira configuração

`pnpm prod:setup` é uma operação única de importação dos dados locais existentes, não uma instalação genérica em qualquer servidor. Exige desenvolvimento parado e nenhuma partida em andamento. Preserva a origem, copia banco e imagens, verifica os dados e prepara a primeira publicação. Nunca sobrescreve uma instalação existente.

Antes de executá-lo, confira o procedimento e as condições em [Produção independente no Mac](docs/backend-architecture.md#produção-independente-no-mac). Se a produção já estiver configurada, use `prod:deploy`.

### Operação diária

| Comando | Uso |
| --- | --- |
| `pnpm prod:status` | Consultar prontidão, partidas e configuração do túnel |
| `pnpm prod:start` | Iniciar banco, aplicações e túnel configurado |
| `pnpm prod:stop` | Parar aplicações e túnel; manter o banco |
| `pnpm prod:logs` | Mostrar as últimas linhas dos logs |
| `pnpm prod:deploy` | Construir e publicar uma nova release com backup e ensaio de migrations |
| `pnpm prod:backup` | Parar produção com proteção de partidas e salvar banco, imagens e configuração |
| `pnpm prod:rollback` | Fazer backup e voltar ao build anterior, sem reverter o banco |

Para publicar uma atualização na instalação existente:

```sh
pnpm prod:status
pnpm prod:deploy
pnpm prod:status
```

O deploy usa os arquivos atuais da pasta de desenvolvimento, **incluindo alterações não commitadas e arquivos novos não ignorados**. Não faz pull, commit ou merge. Exclui ambientes locais, dados, dependências e builds; instala com lockfile e gera uma release independente. Revise a árvore de trabalho antes de publicar.

O build acontece enquanto a release anterior atende. Na troca há interrupção controlada, backup e ensaio das migrations em uma cópia isolada de teste. Partidas em andamento podem continuar se a nova release for compatível com seus estados e regras; incompatibilidades impedem o deploy. Parada manual, backup isolado e rollback recusam partidas em andamento.

Depois de `prod:backup`, use `pnpm prod:start` para voltar a atender. `prod:rollback` troca apenas o código e exige compatibilidade com o schema atual; não desfaz migrations nem movimentações em Croins.

### Dados, recuperação e disponibilidade

- Releases ficam em `releases/`, com a ativa selecionada por `current`.
- Configurações privadas ficam em `shared/`; banco usa credenciais distintas para runtime e migrations.
- Avatares e mídia ficam em `shared/images/avatars` e `shared/images/media`.
- Backups ficam em `backups/` e incluem dados pessoais e segredos. Mantenha uma cópia externa protegida; o mesmo Mac não protege contra perda do equipamento.
- O Mac precisa permanecer acordado, com Docker e processos ativos. Os scripts não configuram início automático após reboot.

Se uma publicação falhar após o início das migrations reais, a produção pode permanecer parada para análise; não há restauração automática de dados. Preserve backups e volumes, consulte os logs e siga o [procedimento de recuperação](docs/backend-architecture.md#produção-independente-no-mac). Restaurar dados exige decisão operacional explícita, validação isolada e conciliação das ações posteriores ao backup.

O fluxo operacional atual foi feito para esse Mac, essas portas e esse domínio. Para outro servidor, revise os scripts, ambientes, proxy HTTPS, armazenamento e estratégia de recuperação antes da implantação.

## Problemas comuns

| Sintoma | O que conferir |
| --- | --- |
| Docker indisponível | Inicie o Docker Desktop antes de `db:up` ou operações de produção |
| Porta ocupada | Consulte `dev:status` / `prod:status` e identifique o processo; não encerre serviços desconhecidos |
| Erro de conexão com o banco | Confira `DATABASE_URL`, credenciais do volume existente, porta e `db:logs` |
| Aplicações não ficam prontas | Consulte logs da API e migrations; health de prontidão não substitui migrations |
| Login/CSRF falhando | Confira `WEB_ORIGIN`, segredo CSRF e origens adicionais de desenvolvimento |
| Site público indisponível | Confira `prod:status`, token/rota do túnel, Docker e se o Mac está acordado |

## Documentação do projeto

- [Produto, identidade e economia](CROEBET.md)
- [Backend, ambiente, operação e validação](docs/backend-architecture.md)
- [Frontend, componentes, estilos e 3D](docs/frontend-architecture.md)
- [Flip 7: regras e apresentação](docs/flip7.md)
- [Orientações de desenvolvimento](AGENTS.md)
